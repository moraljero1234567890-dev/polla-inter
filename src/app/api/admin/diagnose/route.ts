import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAllMatches, listAllPredictions } from "@/lib/store";

export const dynamic = "force-dynamic";

// READ-ONLY health check for match/score tracking. Surfaces the failure modes
// that silently drop points: matches finished without a usable score, and
// predictions whose stored keys/codes no longer line up with the match docs
// (which happens when a refresh swaps the data source / id scheme).
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [matches, predictions] = await Promise.all([
    getAllMatches(),
    listAllPredictions(),
  ]);

  const group = matches.filter((m) => m.stage === "GROUP_STAGE");
  const finishedGroup = group.filter((m) => m.status === "FINISHED");

  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const m of matches) {
    bySource[m.source] = (bySource[m.source] ?? 0) + 1;
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
  }

  // Finished but no usable fullTime score -> scoring silently skips these.
  const finishedNoScore = matches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        (!m.score ||
          !m.score.fullTime ||
          m.score.fullTime.home == null ||
          m.score.fullTime.away == null),
    )
    .map((m) => ({
      id: m._id,
      stage: m.stage,
      teams: `${m.home?.name} vs ${m.away?.name}`,
    }));

  // Knockout matches that finished level (draw) but have no penalty score.
  // The winner is unknown so those teams are silently excluded from r32Winners /
  // r16Winners / etc., which silently drops every user's advancement points for
  // that match. Fix: set the penalty score via /api/admin/set-score.
  const knockoutDrawsNoPenalty = matches
    .filter(
      (m) =>
        m.stage !== "GROUP_STAGE" &&
        m.status === "FINISHED" &&
        m.score?.fullTime != null &&
        m.score.fullTime.home === m.score.fullTime.away &&
        m.score.penalties == null,
    )
    .map((m) => ({
      id: m._id,
      stage: m.stage,
      teams: `${m.home?.name} vs ${m.away?.name}`,
      score: `${m.score!.fullTime!.home}-${m.score!.fullTime!.away}`,
      manualScore: (m as { manualScore?: boolean }).manualScore ?? false,
    }));

  // Do prediction groupScores keys still point at real match _ids?
  const matchIds = new Set(matches.map((m) => m._id));
  let totalKeys = 0;
  let matchedKeys = 0;
  const unmatched = new Set<string>();
  for (const p of predictions) {
    for (const key of Object.keys(p.groupScores ?? {})) {
      totalKeys++;
      if (matchIds.has(key)) matchedKeys++;
      else if (unmatched.size < 10) unmatched.add(key);
    }
  }

  // Finished group matches with at least one prediction keyed to them.
  const finishedGroupOrphans = finishedGroup
    .filter((m) => !predictions.some((p) => p.groupScores?.[m._id] !== undefined))
    .map((m) => ({ id: m._id, teams: `${m.home?.name} vs ${m.away?.name}` }));

  // Knockout matches by team code: are prediction codes present in match docs?
  const matchCodes = new Set<string>();
  for (const m of matches) {
    if (m.home?.code) matchCodes.add(m.home.code);
    if (m.away?.code) matchCodes.add(m.away.code);
  }
  const predCodes = new Set<string>();
  for (const p of predictions) {
    for (const stage of ["r32", "r16", "qf", "sf"] as const) {
      for (const pick of p.knockout?.[stage] ?? []) {
        if (pick.homeTeamCode) predCodes.add(pick.homeTeamCode);
        if (pick.awayTeamCode) predCodes.add(pick.awayTeamCode);
      }
    }
  }
  const codesMissingInMatches = [...predCodes].filter((c) => !matchCodes.has(c));

  // Knockout stage breakdown — key health check for whether match data exists.
  const KNOCKOUT_STAGE_ORDER = [
    "ROUND_OF_32",
    "ROUND_OF_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "THIRD_PLACE",
    "FINAL",
  ] as const;
  const STAGE_LABEL: Record<string, string> = {
    ROUND_OF_32: "Dieciseisavos (R32)",
    ROUND_OF_16: "Octavos (R16)",
    QUARTER_FINALS: "Cuartos de final",
    SEMI_FINALS: "Semifinales",
    THIRD_PLACE: "Tercer puesto",
    FINAL: "Final",
  };
  const knockoutByStage: Record<
    string,
    { label: string; total: number; finished: number; matches: { home: string; away: string; score: string | null; penalties: string | null; id: string }[] }
  > = {};
  for (const s of KNOCKOUT_STAGE_ORDER) {
    knockoutByStage[s] = { label: STAGE_LABEL[s], total: 0, finished: 0, matches: [] };
  }
  for (const m of matches) {
    if (m.stage === "GROUP_STAGE") continue;
    const entry = knockoutByStage[m.stage];
    if (!entry) continue;
    entry.total++;
    if (m.status === "FINISHED") {
      entry.finished++;
      entry.matches.push({
        home: m.home?.code ?? "?",
        away: m.away?.code ?? "?",
        score: m.score?.fullTime != null
          ? `${m.score.fullTime.home}-${m.score.fullTime.away}`
          : null,
        penalties: m.score?.penalties != null
          ? `${m.score.penalties.home}-${m.score.penalties.away}`
          : null,
        id: m._id,
      });
    }
  }

  const finishedList = matches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => (a.utcDate < b.utcDate ? -1 : 1))
    .map((m) => ({
      date: m.date,
      stage: m.stage,
      home: m.home?.name,
      away: m.away?.name,
      score: m.score?.fullTime
        ? `${m.score.fullTime.home}-${m.score.fullTime.away}`
        : null,
      penalties: m.score?.penalties
        ? `${m.score.penalties.home}-${m.score.penalties.away}`
        : null,
      id: m._id,
      source: m.source,
    }));

  return NextResponse.json({
    summary: {
      matches: matches.length,
      predictions: predictions.length,
      bySource,
      byStatus,
      groupMatches: group.length,
      finishedGroupMatches: finishedGroup.length,
    },
    knockoutByStage,
    diagnostics: {
      finishedWithoutScore: { count: finishedNoScore.length, items: finishedNoScore },
      knockoutDrawsNoPenalty: { count: knockoutDrawsNoPenalty.length, items: knockoutDrawsNoPenalty },
      groupKeyAlignment: {
        totalKeys,
        matchedKeys,
        unmatchedKeys: totalKeys - matchedKeys,
        sampleUnmatchedKeys: [...unmatched],
        sampleCurrentGroupIds: group.slice(0, 6).map((m) => m._id),
      },
      finishedGroupMatchesWithNoMatchingPrediction: {
        count: finishedGroupOrphans.length,
        items: finishedGroupOrphans,
      },
      knockoutCodeAlignment: {
        sampleMatchCodes: [...matchCodes].slice(0, 12),
        samplePredCodes: [...predCodes].slice(0, 12),
        predCodesMissingInMatches: codesMissingInMatches,
      },
    },
    finishedMatches: finishedList,
  });
}
