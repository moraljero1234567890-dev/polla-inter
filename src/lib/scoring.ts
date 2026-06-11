import "server-only";
import type { KnockoutPick, MatchDoc, PredictionDoc } from "./types";

export const POINTS = {
  MATCH_OUTCOME: 3,
  MATCH_EXACT: 5,
  ADVANCE_R16: 5,
  ADVANCE_QF: 7,
  ADVANCE_SF: 8,
  ADVANCE_FINAL: 10,
  CHAMPION: 15,
  RUNNER_UP: 10,
  THIRD: 8,
  FOURTH: 7,
  PERFECT_BRACKET: 5,
} as const;

export type ScoreBreakdown = {
  group: {
    outcomes: number;
    exact: number;
    points: number;
  };
  knockout: {
    r32Outcomes: number;
    r32Exact: number;
    perfectBrackets: number;
    bracketOutcomes: number;
    bracketExact: number;
    advanceR16: number;
    advanceQf: number;
    advanceSf: number;
    advanceFinal: number;
    champion: number;
    runnerUp: number;
    third: number;
    fourth: number;
    points: number;
  };
  total: number;
};

export type LeaderboardRow = {
  email: string;
  name: string;
  attempt: number;
  attemptsAllowed: number;
  totalAttempts: number;
  breakdown: ScoreBreakdown;
};

// Per-match detail used by the user-facing results page to show points earned
// next to each prediction. "pending" = the real match hasn't finished yet.
export type MatchResultClass = "exact" | "outcome" | "miss" | "pending";

export type GroupResultDetail = {
  predicted: { home: number; away: number } | null;
  actual: { home: number; away: number } | null;
  result: MatchResultClass;
  points: number;
};

export type KnockoutResultDetail = {
  predicted: { home: number; away: number } | null;
  // Actual scoreline of the user's predicted pairing, oriented to their home/away.
  // null when that exact pairing never happened (or hasn't finished yet).
  actual: { home: number; away: number } | null;
  matchup: boolean; // the user's exact pairing actually occurred
  result: MatchResultClass;
  points: number; // bracket + exact/outcome points attributable to this pick
};

export type PredictionScoreDetail = {
  breakdown: ScoreBreakdown;
  groups: Record<string, GroupResultDetail>; // keyed by group match _id
  knockout: Record<string, KnockoutResultDetail>; // keyed by pick.matchId
};

function outcome(home: number, away: number): "H" | "A" | "D" {
  if (home > away) return "H";
  if (away > home) return "A";
  return "D";
}

function scoreMatch(
  pickHome: number | null,
  pickAway: number | null,
  realHome: number,
  realAway: number,
): "exact" | "outcome" | "miss" {
  if (pickHome == null || pickAway == null) return "miss";
  if (pickHome === realHome && pickAway === realAway) return "exact";
  if (outcome(pickHome, pickAway) === outcome(realHome, realAway)) return "outcome";
  return "miss";
}

function makeMatchupKey(code1: string, code2: string): string {
  return [code1, code2].sort().join("|");
}

function knockoutMatchWinner(m: MatchDoc): { winner: string; loser: string } | null {
  if (m.status !== "FINISHED") return null;
  const ft = m.score?.fullTime;
  if (!ft) return null;
  let winnerCode: string | null = null;
  if (ft.home > ft.away) winnerCode = m.home.code;
  else if (ft.away > ft.home) winnerCode = m.away.code;
  else {
    const pens = m.score?.penalties;
    if (pens) {
      if (pens.home > pens.away) winnerCode = m.home.code;
      else if (pens.away > pens.home) winnerCode = m.away.code;
    }
  }
  if (!winnerCode) return null;
  return {
    winner: winnerCode,
    loser: winnerCode === m.home.code ? m.away.code : m.home.code,
  };
}

type RealMatchup = {
  homeCode: string;
  awayCode: string;
  ftHome: number;
  ftAway: number;
};

type RealKnockoutData = {
  matchups: Map<string, RealMatchup[]>;
  r32Winners: Set<string>;
  r16Winners: Set<string>;
  qfWinners: Set<string>;
  sfWinners: Set<string>;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  fourthPlace: string | null;
};

function extractKnockoutData(matches: MatchDoc[]): RealKnockoutData {
  const data: RealKnockoutData = {
    matchups: new Map(),
    r32Winners: new Set(),
    r16Winners: new Set(),
    qfWinners: new Set(),
    sfWinners: new Set(),
    champion: null,
    runnerUp: null,
    thirdPlace: null,
    fourthPlace: null,
  };

  for (const m of matches) {
    if (m.stage === "GROUP_STAGE") continue;
    if (m.status !== "FINISHED") continue;
    const ft = m.score?.fullTime;
    if (!ft) continue;

    const stageList = data.matchups.get(m.stage) ?? [];
    stageList.push({
      homeCode: m.home.code,
      awayCode: m.away.code,
      ftHome: ft.home,
      ftAway: ft.away,
    });
    data.matchups.set(m.stage, stageList);

    const result = knockoutMatchWinner(m);
    if (!result) continue;

    switch (m.stage) {
      case "ROUND_OF_32":
        data.r32Winners.add(result.winner);
        break;
      case "ROUND_OF_16":
        data.r16Winners.add(result.winner);
        break;
      case "QUARTER_FINALS":
        data.qfWinners.add(result.winner);
        break;
      case "SEMI_FINALS":
        data.sfWinners.add(result.winner);
        break;
      case "THIRD_PLACE":
        data.thirdPlace = result.winner;
        data.fourthPlace = result.loser;
        break;
      case "FINAL":
        data.champion = result.winner;
        data.runnerUp = result.loser;
        break;
    }
  }

  return data;
}

function pickedWinnerCode(p: KnockoutPick): string | null {
  if (p.home == null || p.away == null) return null;
  if (p.home > p.away) return p.homeTeamCode;
  if (p.away > p.home) return p.awayTeamCode;
  if (p.penaltyWinner === "home") return p.homeTeamCode;
  if (p.penaltyWinner === "away") return p.awayTeamCode;
  return null;
}

function pickedLoserCode(p: KnockoutPick): string | null {
  const winner = pickedWinnerCode(p);
  if (!winner) return null;
  return winner === p.homeTeamCode ? p.awayTeamCode : p.homeTeamCode;
}

function scorePickAgainstReal(
  pick: KnockoutPick,
  realMatchups: RealMatchup[],
): {
  matched: boolean;
  result: "exact" | "outcome" | "miss";
  actual: { home: number; away: number } | null;
} {
  if (!pick.homeTeamCode || !pick.awayTeamCode)
    return { matched: false, result: "miss", actual: null };
  const pickKey = makeMatchupKey(pick.homeTeamCode, pick.awayTeamCode);

  for (const real of realMatchups) {
    const realKey = makeMatchupKey(real.homeCode, real.awayCode);
    if (pickKey !== realKey) continue;

    let userH: number | null;
    let userA: number | null;
    let actual: { home: number; away: number };
    if (pick.homeTeamCode === real.homeCode) {
      userH = pick.home;
      userA = pick.away;
      actual = { home: real.ftHome, away: real.ftAway };
    } else {
      userH = pick.away;
      userA = pick.home;
      actual = { home: real.ftAway, away: real.ftHome };
    }
    return {
      matched: true,
      result: scoreMatch(userH, userA, real.ftHome, real.ftAway),
      actual,
    };
  }

  return { matched: false, result: "miss", actual: null };
}

function emptyBreakdown(): ScoreBreakdown {
  return {
    group: { outcomes: 0, exact: 0, points: 0 },
    knockout: {
      r32Outcomes: 0,
      r32Exact: 0,
      perfectBrackets: 0,
      bracketOutcomes: 0,
      bracketExact: 0,
      advanceR16: 0,
      advanceQf: 0,
      advanceSf: 0,
      advanceFinal: 0,
      champion: 0,
      runnerUp: 0,
      third: 0,
      fourth: 0,
      points: 0,
    },
    total: 0,
  };
}

type ScoringContext = {
  groupReal: Array<{ id: string; home: number; away: number }>;
  knock: RealKnockoutData;
  r32Matchups: RealMatchup[];
  r16Matchups: RealMatchup[];
  qfMatchups: RealMatchup[];
  sfMatchups: RealMatchup[];
  thirdMatchups: RealMatchup[];
  finalMatchups: RealMatchup[];
};

function buildScoringContext(matches: MatchDoc[]): ScoringContext {
  const groupReal: Array<{ id: string; home: number; away: number }> = [];
  for (const m of matches) {
    if (m.stage !== "GROUP_STAGE" || m.status !== "FINISHED") continue;
    const ft = m.score?.fullTime;
    if (!ft) continue;
    groupReal.push({ id: m._id, home: ft.home, away: ft.away });
  }
  const knock = extractKnockoutData(matches);
  return {
    groupReal,
    knock,
    r32Matchups: knock.matchups.get("ROUND_OF_32") ?? [],
    r16Matchups: knock.matchups.get("ROUND_OF_16") ?? [],
    qfMatchups: knock.matchups.get("QUARTER_FINALS") ?? [],
    sfMatchups: knock.matchups.get("SEMI_FINALS") ?? [],
    thirdMatchups: knock.matchups.get("THIRD_PLACE") ?? [],
    finalMatchups: knock.matchups.get("FINAL") ?? [],
  };
}

// Score one prediction against the real results, returning both the aggregate
// breakdown (used by the leaderboard) and per-match detail (used by the results
// page). Single source of truth so the two views can never disagree.
function scoreSinglePrediction(
  p: PredictionDoc,
  ctx: ScoringContext,
): {
  breakdown: ScoreBreakdown;
  groups: Record<string, GroupResultDetail>;
  knockout: Record<string, KnockoutResultDetail>;
} {
  const br = emptyBreakdown();
  const groups: Record<string, GroupResultDetail> = {};
  const knockout: Record<string, KnockoutResultDetail> = {};

  // ── GROUP STAGE: 3 pts outcome, 5 pts exact ──
  for (const m of ctx.groupReal) {
    const pick = p.groupScores[m.id];
    const predicted =
      pick && typeof pick.home === "number" && typeof pick.away === "number"
        ? { home: pick.home, away: pick.away }
        : null;
    const r = predicted
      ? scoreMatch(predicted.home, predicted.away, m.home, m.away)
      : "miss";
    let points = 0;
    if (r === "exact") {
      br.group.exact += 1;
      points = POINTS.MATCH_EXACT;
      br.group.points += points;
    } else if (r === "outcome") {
      br.group.outcomes += 1;
      points = POINTS.MATCH_OUTCOME;
      br.group.points += points;
    }
    groups[m.id] = {
      predicted,
      actual: { home: m.home, away: m.away },
      result: r,
      points,
    };
  }

  // ── R32: match points always apply (no perfect-bracket restriction) ──
  for (const pick of p.knockout.r32) {
    const { matched, result, actual } = scorePickAgainstReal(pick, ctx.r32Matchups);
    let points = 0;
    if (matched && result === "exact") {
      br.knockout.r32Exact += 1;
      points = POINTS.MATCH_EXACT;
      br.knockout.points += points;
    } else if (matched && result === "outcome") {
      br.knockout.r32Outcomes += 1;
      points = POINTS.MATCH_OUTCOME;
      br.knockout.points += points;
    }
    knockout[pick.matchId] = {
      predicted: pick.home != null && pick.away != null ? { home: pick.home, away: pick.away } : null,
      actual,
      matchup: matched,
      result: matched ? result : "miss",
      points,
    };
  }

  // ── R16+: perfect-bracket bonus + match points only with perfect bracket ──
  const scoreBracketStage = (picks: KnockoutPick[], realM: RealMatchup[]) => {
    for (const pick of picks) {
      const { matched, result, actual } = scorePickAgainstReal(pick, realM);
      let points = 0;
      if (matched) {
        br.knockout.perfectBrackets += 1;
        points += POINTS.PERFECT_BRACKET;
        br.knockout.points += POINTS.PERFECT_BRACKET;
        if (result === "exact") {
          br.knockout.bracketExact += 1;
          points += POINTS.MATCH_EXACT;
          br.knockout.points += POINTS.MATCH_EXACT;
        } else if (result === "outcome") {
          br.knockout.bracketOutcomes += 1;
          points += POINTS.MATCH_OUTCOME;
          br.knockout.points += POINTS.MATCH_OUTCOME;
        }
      }
      knockout[pick.matchId] = {
        predicted: pick.home != null && pick.away != null ? { home: pick.home, away: pick.away } : null,
        actual,
        matchup: matched,
        result: matched ? result : "miss",
        points,
      };
    }
  };

  scoreBracketStage(p.knockout.r16, ctx.r16Matchups);
  scoreBracketStage(p.knockout.qf, ctx.qfMatchups);
  scoreBracketStage(p.knockout.sf, ctx.sfMatchups);
  if (p.knockout.third) scoreBracketStage([p.knockout.third], ctx.thirdMatchups);
  if (p.knockout.final) scoreBracketStage([p.knockout.final], ctx.finalMatchups);

  // ── TEAM ADVANCEMENT: correct teams reaching each round ──
  const collectWinners = (picks: KnockoutPick[]): Set<string> => {
    const s = new Set<string>();
    for (const pick of picks) {
      const w = pickedWinnerCode(pick);
      if (w) s.add(w);
    }
    return s;
  };

  for (const code of collectWinners(p.knockout.r32)) {
    if (ctx.knock.r32Winners.has(code)) {
      br.knockout.advanceR16 += 1;
      br.knockout.points += POINTS.ADVANCE_R16;
    }
  }
  for (const code of collectWinners(p.knockout.r16)) {
    if (ctx.knock.r16Winners.has(code)) {
      br.knockout.advanceQf += 1;
      br.knockout.points += POINTS.ADVANCE_QF;
    }
  }
  for (const code of collectWinners(p.knockout.qf)) {
    if (ctx.knock.qfWinners.has(code)) {
      br.knockout.advanceSf += 1;
      br.knockout.points += POINTS.ADVANCE_SF;
    }
  }
  for (const code of collectWinners(p.knockout.sf)) {
    if (ctx.knock.sfWinners.has(code)) {
      br.knockout.advanceFinal += 1;
      br.knockout.points += POINTS.ADVANCE_FINAL;
    }
  }

  // ── FINAL POSITIONS ──
  if (ctx.knock.champion && p.champion?.code === ctx.knock.champion) {
    br.knockout.champion = 1;
    br.knockout.points += POINTS.CHAMPION;
  }
  if (ctx.knock.runnerUp && p.knockout.final) {
    const loser = pickedLoserCode(p.knockout.final);
    if (loser && loser === ctx.knock.runnerUp) {
      br.knockout.runnerUp = 1;
      br.knockout.points += POINTS.RUNNER_UP;
    }
  }
  if (ctx.knock.thirdPlace && p.knockout.third) {
    const winner = pickedWinnerCode(p.knockout.third);
    if (winner && winner === ctx.knock.thirdPlace) {
      br.knockout.third = 1;
      br.knockout.points += POINTS.THIRD;
    }
  }
  if (ctx.knock.fourthPlace && p.knockout.third) {
    const loser = pickedLoserCode(p.knockout.third);
    if (loser && loser === ctx.knock.fourthPlace) {
      br.knockout.fourth = 1;
      br.knockout.points += POINTS.FOURTH;
    }
  }

  br.total = br.group.points + br.knockout.points;
  return { breakdown: br, groups, knockout };
}

export function computeLeaderboard(
  matches: MatchDoc[],
  predictions: PredictionDoc[],
  users: { email: string; name: string; attemptsAllowed: number }[],
): LeaderboardRow[] {
  const ctx = buildScoringContext(matches);
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  const totalAttemptsByEmail = new Map<string, number>();
  for (const p of predictions) {
    totalAttemptsByEmail.set(
      p.userEmail,
      (totalAttemptsByEmail.get(p.userEmail) ?? 0) + 1,
    );
  }

  const rows: LeaderboardRow[] = [];
  for (const p of predictions) {
    const user = userByEmail.get(p.userEmail);
    if (!user) continue;
    const { breakdown } = scoreSinglePrediction(p, ctx);
    rows.push({
      email: user.email,
      name: user.name,
      attempt: p.attempt,
      attemptsAllowed: user.attemptsAllowed,
      totalAttempts: totalAttemptsByEmail.get(p.userEmail) ?? 0,
      breakdown,
    });
  }

  rows.sort((a, b) => {
    if (b.breakdown.total !== a.breakdown.total) return b.breakdown.total - a.breakdown.total;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.attempt - b.attempt;
  });

  return rows;
}

// Detailed score for a single prediction — powers the user results page.
export function scorePredictionDetail(
  matches: MatchDoc[],
  prediction: PredictionDoc,
): PredictionScoreDetail {
  const ctx = buildScoringContext(matches);
  const { breakdown, groups, knockout } = scoreSinglePrediction(prediction, ctx);
  return { breakdown, groups, knockout };
}
