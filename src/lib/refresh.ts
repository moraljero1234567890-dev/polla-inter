import "server-only";
import { matchesCollection, metaCollection } from "./mongodb";
import { fetchLatestFromConfiguredProvider } from "./providers";
import type { MatchDoc } from "./types";

// How often the auto-refresh-on-read is allowed to actually hit the provider.
// Reads in between are served from the last stored result.
const AUTO_REFRESH_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_LOCK_ID = "match-refresh";

export type RefreshOutcome = {
  ok: boolean;
  source?: string;
  updated: number;
  skipped?: string;
};

function isScored(m: MatchDoc | null | undefined): boolean {
  return Boolean(
    m &&
      m.status === "FINISHED" &&
      m.score?.fullTime &&
      m.score.fullTime.home != null &&
      m.score.fullTime.away != null,
  );
}

// Pull live data from the provider and fold it into the matches collection
// WITHOUT ever losing a result that was already recorded. The old behaviour
// (delete everything, insert whatever the provider returned) meant a single
// laggy/partial provider response could wipe finished scores and zero out
// people's points. This version is defensive:
//   • aborts if the provider returns nothing,
//   • refuses to switch data source once the tournament has real results
//     (a source switch rewrites every match _id and orphans predictions),
//   • never regresses a FINISHED + scored match back to scheduled / no-score.
export async function refreshMatches(): Promise<RefreshOutcome> {
  const provider = await fetchLatestFromConfiguredProvider();
  const incoming = provider.docs;
  if (!incoming.length) {
    return {
      ok: false,
      source: provider.source,
      updated: 0,
      skipped: "provider returned 0 matches",
    };
  }

  const col = await matchesCollection();
  const existing = await col.find({}).toArray();
  const existingById = new Map(existing.map((m) => [m._id, m]));
  const existingHasResults = existing.some(isScored);
  // "dummy" is the static seed; the first real provider load is allowed to
  // replace it. After that we lock onto whatever provider is live.
  const lockedSource =
    existing.find((m) => m.source !== "dummy")?.source ?? null;

  // Guard rail: never change the id scheme mid-tournament.
  if (
    existingHasResults &&
    lockedSource &&
    lockedSource !== provider.source
  ) {
    return {
      ok: false,
      source: provider.source,
      updated: 0,
      skipped: `refused to switch source ${lockedSource} -> ${provider.source} while results exist`,
    };
  }

  // First real load (replacing the seed, no results yet): clean replace so we
  // don't leave seed docs lingering next to provider docs.
  const isInitialProviderLoad =
    !existingHasResults &&
    (lockedSource === null || lockedSource !== provider.source);

  if (isInitialProviderLoad) {
    await col.deleteMany({});
    await col.insertMany(incoming);
    await col.createIndex({ utcDate: 1 });
    await col.createIndex({ stage: 1, group: 1, matchday: 1 });
    return { ok: true, source: provider.source, updated: incoming.length };
  }

  // Steady state: same source, stable ids -> upsert in place and merge so a
  // previously recorded result is never clobbered by a regressed provider doc.
  const ops = incoming.map((doc) => {
    const prev = existingById.get(doc._id);
    const replacement =
      isScored(prev) && !isScored(doc)
        ? { ...doc, status: prev!.status, score: prev!.score }
        : doc;
    return {
      replaceOne: {
        filter: { _id: replacement._id },
        replacement,
        upsert: true,
      },
    };
  });

  if (ops.length) await col.bulkWrite(ops, { ordered: false });
  await col.createIndex({ utcDate: 1 });
  await col.createIndex({ stage: 1, group: 1, matchday: 1 });

  return { ok: true, source: provider.source, updated: ops.length };
}

// Decide whether the tournament is "live" enough to be worth polling. Outside
// this window (before the first kickoff, long after the last match) auto-refresh
// stays idle so we never burn provider calls for nothing.
function withinTournamentWindow(matches: MatchDoc[], now: number): boolean {
  if (!matches.length) return false;
  let earliest = Infinity;
  let latest = -Infinity;
  for (const m of matches) {
    const t = new Date(m.utcDate).getTime();
    if (!Number.isFinite(t)) continue;
    if (t < earliest) earliest = t;
    if (t > latest) latest = t;
  }
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return false;
  const DAY = 24 * 60 * 60 * 1000;
  // Start polling 3h before the first match, keep going 1 day past the last.
  return now >= earliest - 3 * 60 * 60 * 1000 && now <= latest + DAY;
}

// Throttled, lock-guarded auto-refresh meant to be called from read paths
// (leaderboard / matches). At most one caller per throttle window actually hits
// the provider; everyone else returns immediately. Returns true when it updated
// the data (so the caller can re-read). Best-effort: any failure is swallowed so
// it can never break a page load.
export async function maybeAutoRefresh(matches: MatchDoc[]): Promise<boolean> {
  try {
    const now = Date.now();
    if (!withinTournamentWindow(matches, now)) return false;

    const meta = await metaCollection();
    const cutoff = new Date(now - AUTO_REFRESH_THROTTLE_MS);

    // Atomically claim the slot: only succeeds if the last attempt is stale.
    const claimed = await meta.updateOne(
      { _id: REFRESH_LOCK_ID, lastAttemptAt: { $lt: cutoff } },
      { $set: { lastAttemptAt: new Date(now) } },
    );

    let won = claimed.modifiedCount === 1;
    if (!won && claimed.matchedCount === 0) {
      // Lock doc doesn't exist yet — try to create it. Whoever wins the insert
      // (unique _id) runs the refresh; the loser throws a duplicate-key error.
      try {
        await meta.insertOne({
          _id: REFRESH_LOCK_ID,
          lastAttemptAt: new Date(now),
        });
        won = true;
      } catch {
        won = false;
      }
    }
    if (!won) return false;

    const result = await refreshMatches();
    await meta.updateOne(
      { _id: REFRESH_LOCK_ID },
      {
        $set: {
          lastSuccessAt: new Date(),
          lastSource: result.source ?? null,
          lastSkipped: result.skipped ?? null,
        },
      },
    );
    return result.ok;
  } catch {
    // Never let auto-refresh break the request it piggybacks on.
    return false;
  }
}
