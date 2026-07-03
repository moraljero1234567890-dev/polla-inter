import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAllMatches, getPrediction, getUserByEmail } from "@/lib/store";
import { POINTS } from "@/lib/scoring";
import type { KnockoutPick, MatchDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

function makeMatchupKey(a: string, b: string) {
  return [a, b].sort().join("|");
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
  const w = pickedWinnerCode(p);
  if (!w) return null;
  return w === p.homeTeamCode ? p.awayTeamCode : p.homeTeamCode;
}

function knockoutWinner(m: MatchDoc): string | null {
  if (m.status !== "FINISHED") return null;
  const ft = m.score?.fullTime;
  if (!ft) return null;
  if (ft.home > ft.away) return m.home.code;
  if (ft.away > ft.home) return m.away.code;
  const pens = m.score?.penalties;
  if (pens) {
    if (pens.home > pens.away) return m.home.code;
    if (pens.away > pens.home) return m.away.code;
  }
  return null;
}

type RealEntry = {
  home: string;
  away: string;
  score: string;
  winner: string | null;
  penScore?: string;
};

type PickDiag = {
  matchId: string;
  pick: string;
  predictedScore: string;
  predictedWinner: string | null;
  penaltyWinner: string | null;
  realResult: string;
  realWinner: string | null;
  matchupFound: boolean;
  exact: boolean;
  outcomeCorrect: boolean;
  matchPts: number;
  bracketPts: number;
  advanceHit: boolean;
  advancePts: number;
};

function diagnoseStage(
  picks: KnockoutPick[],
  realMatchups: RealEntry[],
  winnerSet: Set<string>,
  advancePts: number,
  isR32: boolean,
): PickDiag[] {
  return picks.map((pick) => {
    const pickKey = makeMatchupKey(pick.homeTeamCode, pick.awayTeamCode);
    const real = realMatchups.find((r) => makeMatchupKey(r.home, r.away) === pickKey);
    const predictedWinner = pickedWinnerCode(pick);
    const realWinner = real?.winner ?? null;
    const matched = !!real;

    let exact = false;
    let outcomeCorrect = false;
    if (matched && real.score !== "(not finished)" && pick.home != null && pick.away != null) {
      const [rh, ra] = real.score.split("-").map(Number);
      const [ph, pa] =
        pick.homeTeamCode === real.home
          ? [pick.home, pick.away]
          : [pick.away, pick.home];
      if (ph === rh && pa === ra) {
        exact = true;
      } else if (predictedWinner !== null && predictedWinner === realWinner) {
        outcomeCorrect = true;
      }
    }

    let matchPts = 0;
    if (matched && exact) matchPts = POINTS.MATCH_EXACT;
    else if (matched && outcomeCorrect) matchPts = POINTS.MATCH_OUTCOME;

    const bracketPts = !isR32 && matched ? POINTS.PERFECT_BRACKET : 0;
    const advanceHit = predictedWinner !== null && winnerSet.has(predictedWinner);

    return {
      matchId: pick.matchId,
      pick: `${pick.homeTeamCode} vs ${pick.awayTeamCode}`,
      predictedScore: pick.home != null ? `${pick.home}-${pick.away}` : "no score",
      predictedWinner,
      penaltyWinner: pick.penaltyWinner,
      realResult: real
        ? `${real.score}${real.penScore ? ` (pen ${real.penScore})` : ""}`
        : "no real match found",
      realWinner,
      matchupFound: matched,
      exact,
      outcomeCorrect,
      matchPts,
      bracketPts,
      advanceHit,
      advancePts: advanceHit ? advancePts : 0,
    };
  });
}

// Full diagnostic of one user's knockout scoring: raw picks, real match data,
// and exactly which picks/advancements earned points and which didn't.
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const attempt = Number(request.nextUrl.searchParams.get("attempt") ?? "1");
  if (!email) return NextResponse.json({ error: "Missing ?email=" }, { status: 400 });

  const [user, prediction, matches] = await Promise.all([
    getUserByEmail(email),
    getPrediction(email, attempt),
    getAllMatches(),
  ]);

  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  if (!prediction) return NextResponse.json({ error: "No prediction for that attempt" }, { status: 404 });

  // Build real knockout data indexed by stage
  const realByStage: Record<string, RealEntry[]> = {};
  const winnersByStage: Record<string, Set<string>> = {
    ROUND_OF_32: new Set(),
    ROUND_OF_16: new Set(),
    QUARTER_FINALS: new Set(),
    SEMI_FINALS: new Set(),
    THIRD_PLACE: new Set(),
    FINAL: new Set(),
  };
  let champion: string | null = null;
  let runnerUp: string | null = null;
  let thirdPlace: string | null = null;
  let fourthPlace: string | null = null;

  for (const m of matches) {
    if (m.stage === "GROUP_STAGE") continue;
    const entry: RealEntry = {
      home: m.home.code,
      away: m.away.code,
      score: m.score?.fullTime != null
        ? `${m.score.fullTime.home}-${m.score.fullTime.away}`
        : "(not finished)",
      winner: knockoutWinner(m),
      penScore: m.score?.penalties != null
        ? `${m.score.penalties.home}-${m.score.penalties.away}`
        : undefined,
    };
    realByStage[m.stage] = realByStage[m.stage] ?? [];
    realByStage[m.stage].push(entry);

    if (m.status !== "FINISHED") continue;
    const w = knockoutWinner(m);
    if (!w) continue;
    winnersByStage[m.stage]?.add(w);
    const loser = w === m.home.code ? m.away.code : m.home.code;
    if (m.stage === "FINAL") { champion = w; runnerUp = loser; }
    if (m.stage === "THIRD_PLACE") { thirdPlace = w; fourthPlace = loser; }
  }

  const r32Diag = diagnoseStage(
    prediction.knockout.r32,
    realByStage["ROUND_OF_32"] ?? [],
    winnersByStage["ROUND_OF_32"],
    POINTS.ADVANCE_R16,
    true,
  );
  const r16Diag = diagnoseStage(
    prediction.knockout.r16,
    realByStage["ROUND_OF_16"] ?? [],
    winnersByStage["ROUND_OF_16"],
    POINTS.ADVANCE_QF,
    false,
  );
  const qfDiag = diagnoseStage(
    prediction.knockout.qf,
    realByStage["QUARTER_FINALS"] ?? [],
    winnersByStage["QUARTER_FINALS"],
    POINTS.ADVANCE_SF,
    false,
  );
  const sfDiag = diagnoseStage(
    prediction.knockout.sf,
    realByStage["SEMI_FINALS"] ?? [],
    winnersByStage["SEMI_FINALS"],
    POINTS.ADVANCE_FINAL,
    false,
  );
  const thirdDiag = prediction.knockout.third
    ? diagnoseStage(
        [prediction.knockout.third],
        realByStage["THIRD_PLACE"] ?? [],
        winnersByStage["THIRD_PLACE"],
        POINTS.THIRD,
        false,
      )
    : [];
  const finalDiag = prediction.knockout.final
    ? diagnoseStage(
        [prediction.knockout.final],
        realByStage["FINAL"] ?? [],
        winnersByStage["FINAL"],
        POINTS.MATCH_EXACT,
        false,
      )
    : [];

  // Special position points
  const championPts =
    champion && prediction.champion?.code === champion ? POINTS.CHAMPION : 0;
  const runnerUpPts = (() => {
    if (!runnerUp || !prediction.knockout.final) return 0;
    const loser = pickedLoserCode(prediction.knockout.final);
    return loser === runnerUp ? POINTS.RUNNER_UP : 0;
  })();
  const thirdPts = (() => {
    if (!thirdPlace || !prediction.knockout.third) return 0;
    const w = pickedWinnerCode(prediction.knockout.third);
    return w === thirdPlace ? POINTS.THIRD : 0;
  })();
  const fourthPts = (() => {
    if (!fourthPlace || !prediction.knockout.third) return 0;
    const l = pickedLoserCode(prediction.knockout.third);
    return l === fourthPlace ? POINTS.FOURTH : 0;
  })();

  const sum = (arr: PickDiag[], key: keyof PickDiag) =>
    arr.reduce((s, d) => s + (d[key] as number), 0);

  const tally = {
    r32_match: sum(r32Diag, "matchPts"),
    r32_advanceToR16: sum(r32Diag, "advancePts"),
    r16_bracket: sum(r16Diag, "bracketPts"),
    r16_match: sum(r16Diag, "matchPts"),
    r16_advanceToQF: sum(r16Diag, "advancePts"),
    qf_bracket: sum(qfDiag, "bracketPts"),
    qf_match: sum(qfDiag, "matchPts"),
    qf_advanceToSF: sum(qfDiag, "advancePts"),
    sf_bracket: sum(sfDiag, "bracketPts"),
    sf_match: sum(sfDiag, "matchPts"),
    sf_advanceToFinal: sum(sfDiag, "advancePts"),
    third_bracket: sum(thirdDiag, "bracketPts"),
    third_match: sum(thirdDiag, "matchPts"),
    third_pos: thirdPts,
    fourth_pos: fourthPts,
    final_bracket: sum(finalDiag, "bracketPts"),
    final_match: sum(finalDiag, "matchPts"),
    champion: championPts,
    runnerUp: runnerUpPts,
  };

  const knockoutTotal = Object.values(tally).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    user: { email: user.email, name: user.name },
    attempt,
    predictedChampion: prediction.champion,
    realChampion: champion,
    realRunnerUp: runnerUp,
    realThirdPlace: thirdPlace,
    realFourthPlace: fourthPlace,
    r32: r32Diag,
    r16: r16Diag,
    qf: qfDiag,
    sf: sfDiag,
    third: thirdDiag,
    final: finalDiag,
    tally,
    knockoutTotal,
    realMatchesByStage: realByStage,
  });
}
