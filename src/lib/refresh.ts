import "server-only";
import { matchesCollection, metaCollection } from "./mongodb";
import { fetchLatestFromConfiguredProvider } from "./providers";
import { matches as staticMatches, flagSrc } from "@/data/worldcup2026";
import type { Collection } from "mongodb";
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

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// Self-healing safety net for the Wikipedia source: the scraper (and Wikipedia
// itself) sometimes omits a match, which used to make it vanish from the DB and
// orphan everyone's prediction for that game. Here we guarantee the full 72-match
// group schedule always exists, refilling any gap from the canonical seed under
// the SAME `wiki-G<letter><slot>` id the predictions use. Reinserted matches are
// SCHEDULED with no score; a later refresh fills the score if/when the provider
// lists them. Existing matches are never touched. Returns the number refilled.
async function ensureFullGroupSchedule(
  col: Collection<MatchDoc>,
  existing: MatchDoc[],
): Promise<number> {
  const existingByGroup = new Map<string, MatchDoc[]>();
  for (const m of existing) {
    if (m.stage !== "GROUP_STAGE" || !m.group) continue;
    const list = existingByGroup.get(m.group) ?? [];
    list.push(m);
    existingByGroup.set(m.group, list);
  }

  const groups = [...new Set(staticMatches.map((m) => m.group))];
  const toInsert: MatchDoc[] = [];

  for (const letter of groups) {
    const seedMatches = staticMatches.filter((m) => m.group === letter);
    const present = existingByGroup.get(letter) ?? [];
    const presentPairs = new Set(
      present.map((m) => pairKey(m.home.code, m.away.code)),
    );

    const missing = seedMatches.filter(
      (sm) => !presentPairs.has(pairKey(sm.home.code, sm.away.code)),
    );
    if (!missing.length) continue;

    missing.forEach((sm) => {
      // Slot is the canonical seed position (1-based, seed file order) for this
      // fixture — the SAME slot the Wikipedia parser binds by team pairing — so a
      // backfilled match lands on the exact id its predictions are keyed to.
      const slot = seedMatches.indexOf(sm) + 1;
      if (!slot) return;
      const utcDate = new Date(`${sm.date}T${sm.time}:00-05:00`).toISOString();
      toInsert.push({
        _id: `wiki-G${letter}${slot}`,
        source: "wikipedia",
        externalId: `G${letter}${slot}`,
        utcDate,
        date: sm.date,
        time: sm.time,
        status: "SCHEDULED",
        stage: "GROUP_STAGE",
        stageLabel: "Fase de Grupos",
        group: letter,
        matchday: sm.matchday,
        venue: sm.venue,
        city: sm.city,
        home: { code: sm.home.code, name: sm.home.name, crest: flagSrc(sm.home.code, 80) },
        away: { code: sm.away.code, name: sm.away.name, crest: flagSrc(sm.away.code, 80) },
        score: null,
      });
    });
  }

  if (toInsert.length) {
    await col.bulkWrite(
      toInsert.map((d) => ({
        // insert-only: never overwrite a match that already exists.
        updateOne: {
          filter: { _id: d._id },
          update: { $setOnInsert: d },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  return toInsert.length;
}

// Remove group-stage docs whose _id slot doesn't match the team pair the seed
// assigns to that slot. This happens when an older run used position-based slot
// assignment and Wikipedia later reordered its match boxes: the wrong-pair doc
// occupies the slot and blocks ensureFullGroupSchedule's $setOnInsert, so the
// correct match never gets backfilled. Only removes docs without manualScore.
async function removeStaleGroupDocs(
  col: Collection<MatchDoc>,
  existing: MatchDoc[],
): Promise<number> {
  // Build the expected canonical pair for every slot from the seed.
  const expectedPairBySlot = new Map<string, string>(); // "wiki-GA1" -> "kr|mx" (sorted)
  const counters = new Map<string, number>();
  for (const sm of staticMatches) {
    const slot = (counters.get(sm.group) ?? 0) + 1;
    counters.set(sm.group, slot);
    expectedPairBySlot.set(
      `wiki-G${sm.group}${slot}`,
      pairKey(sm.home.code, sm.away.code),
    );
  }

  const toDelete: string[] = [];
  for (const m of existing) {
    if (m.stage !== "GROUP_STAGE") continue;
    if (!m._id.startsWith("wiki-G")) continue;
    if (m.manualScore) continue; // never auto-delete admin-entered results
    const expected = expectedPairBySlot.get(m._id);
    if (!expected) continue; // unknown slot, leave alone
    const actual = pairKey(m.home.code, m.away.code);
    if (actual !== expected) toDelete.push(m._id);
  }

  if (toDelete.length) {
    await col.deleteMany({ _id: { $in: toDelete } } as Parameters<typeof col.deleteMany>[0]);
  }
  return toDelete.length;
}

// Correct group matchday labels from the seed. The Wikipedia parser infers the
// round from page position (floor(idx/2)+1), which mislabels matches when the
// page order isn't strictly round-by-round. The seed is the authoritative
// fixture, so we overwrite matchday by team pairing after every refresh.
async function syncGroupMatchdays(col: Collection<MatchDoc>): Promise<number> {
  const seedByPair = new Map<string, number>();
  for (const sm of staticMatches) {
    if (sm.matchday == null) continue;
    seedByPair.set(`${sm.group}:${pairKey(sm.home.code, sm.away.code)}`, sm.matchday);
  }
  const group = await col.find({ stage: "GROUP_STAGE" }).toArray();
  const ops = [];
  for (const g of group) {
    if (!g.group) continue;
    const want = seedByPair.get(`${g.group}:${pairKey(g.home.code, g.away.code)}`);
    if (want != null && g.matchday !== want) {
      ops.push({
        updateOne: {
          filter: { _id: g._id },
          update: { $set: { matchday: want } },
        },
      });
    }
  }
  if (ops.length) await col.bulkWrite(ops, { ordered: false });
  return ops.length;
}

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
    let replacement = doc;
    if (prev?.manualScore) {
      // An admin-entered score always wins over the provider.
      replacement = {
        ...doc,
        status: prev.status,
        score: prev.score,
        manualScore: true,
      };
    } else if (isScored(prev) && !isScored(doc)) {
      // Never regress a recorded result back to scheduled / no-score.
      replacement = { ...doc, status: prev!.status, score: prev!.score };
    }
    return {
      replaceOne: {
        filter: { _id: replacement._id },
        replacement,
        upsert: true,
      },
    };
  });

  if (ops.length) await col.bulkWrite(ops, { ordered: false });

  // Backfill any group match the provider omitted so a Wikipedia gap can never
  // again make a predicted game disappear.
  let refilled = 0;
  if (provider.source === "wikipedia") {
    const afterUpsert = await col.find({}).toArray();
    // First remove any docs whose slot ID doesn't match the seed's expected
    // team pair — stale docs from old position-based assignment block the
    // $setOnInsert backfill below, leaving correct matches permanently absent.
    await removeStaleGroupDocs(col, afterUpsert);
    const afterCleanup = await col.find({ stage: "GROUP_STAGE" }).toArray();
    refilled = await ensureFullGroupSchedule(col, afterCleanup);
    await syncGroupMatchdays(col);
  }

  await col.createIndex({ utcDate: 1 });
  await col.createIndex({ stage: 1, group: 1, matchday: 1 });

  return {
    ok: true,
    source: provider.source,
    updated: ops.length + refilled,
  };
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
