import type {
  GroupScore,
  KnockoutPick,
  MatchDoc,
  PredictionDoc,
} from "./types";

export type StandingRow = {
  teamCode: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  group: string;
};

export function computeGroupStandings(
  groupMatches: MatchDoc[],
  predictedScores: Record<string, GroupScore>,
): Record<string, StandingRow[]> {
  const byGroup: Record<string, MatchDoc[]> = {};
  for (const m of groupMatches) {
    if (!m.group) continue;
    (byGroup[m.group] ??= []).push(m);
  }

  const result: Record<string, StandingRow[]> = {};
  for (const [group, matches] of Object.entries(byGroup)) {
    const rows: Record<string, StandingRow> = {};
    const ensure = (code: string, name: string): StandingRow => {
      return (rows[code] ??= {
        teamCode: code,
        teamName: name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
        group,
      });
    };

    for (const m of matches) {
      const score = predictedScores[m._id];
      if (
        !score ||
        typeof score.home !== "number" ||
        typeof score.away !== "number"
      )
        continue;
      const home = ensure(m.home.code, m.home.name);
      const away = ensure(m.away.code, m.away.name);
      home.played++;
      away.played++;
      home.gf += score.home;
      home.ga += score.away;
      away.gf += score.away;
      away.ga += score.home;
      if (score.home > score.away) {
        home.won++;
        away.lost++;
        home.points += 3;
      } else if (score.home < score.away) {
        away.won++;
        home.lost++;
        away.points += 3;
      } else {
        home.drawn++;
        away.drawn++;
        home.points += 1;
        away.points += 1;
      }
    }
    for (const r of Object.values(rows)) r.gd = r.gf - r.ga;

    const list = Object.values(rows).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.teamName.localeCompare(b.teamName);
    });

    result[group] = list;
  }
  return result;
}

export function isGroupStageComplete(
  groupMatches: MatchDoc[],
  predictedScores: Record<string, GroupScore>,
): boolean {
  return groupMatches.every((m) => {
    const s = predictedScores[m._id];
    return s && typeof s.home === "number" && typeof s.away === "number";
  });
}

// ── Official FIFA World Cup 2026 knockout bracket ───────────────────────────
// Source: 2026 FIFA World Cup competition regulations / official match schedule
// (Wikipedia: "2026 FIFA World Cup knockout stage", matches 73–104).
//
// The 16 Round of 32 ties are listed here in BRACKET (display) order, i.e. each
// consecutive pair feeds the next round. That lets the linear feed-forward in
// buildKnockoutFromGroup() and the linear bracket UI render the correct, official
// pairings without any positional remapping elsewhere.
//
// Slot kinds:
//   W = group winner, R = group runner-up, T = a best third-placed team that
//   faces the winner of group `winnerGroup` (assigned below per FIFA's matrix).
//
// The official match number is kept for traceability only.
type SlotSpec =
  | { kind: "W" | "R"; group: string }
  | { kind: "T"; winnerGroup: string };

const R32_TEMPLATE: Array<{ match: number; home: SlotSpec; away: SlotSpec }> = [
  { match: 74, home: { kind: "W", group: "E" }, away: { kind: "T", winnerGroup: "E" } },
  { match: 77, home: { kind: "W", group: "I" }, away: { kind: "T", winnerGroup: "I" } },
  { match: 73, home: { kind: "R", group: "A" }, away: { kind: "R", group: "B" } },
  { match: 75, home: { kind: "W", group: "F" }, away: { kind: "R", group: "C" } },
  { match: 83, home: { kind: "R", group: "K" }, away: { kind: "R", group: "L" } },
  { match: 84, home: { kind: "W", group: "H" }, away: { kind: "R", group: "J" } },
  { match: 81, home: { kind: "W", group: "D" }, away: { kind: "T", winnerGroup: "D" } },
  { match: 82, home: { kind: "W", group: "G" }, away: { kind: "T", winnerGroup: "G" } },
  { match: 76, home: { kind: "W", group: "C" }, away: { kind: "R", group: "F" } },
  { match: 78, home: { kind: "R", group: "E" }, away: { kind: "R", group: "I" } },
  { match: 79, home: { kind: "W", group: "A" }, away: { kind: "T", winnerGroup: "A" } },
  { match: 80, home: { kind: "W", group: "L" }, away: { kind: "T", winnerGroup: "L" } },
  { match: 86, home: { kind: "W", group: "J" }, away: { kind: "R", group: "H" } },
  { match: 88, home: { kind: "R", group: "D" }, away: { kind: "R", group: "G" } },
  { match: 85, home: { kind: "W", group: "B" }, away: { kind: "T", winnerGroup: "B" } },
  { match: 87, home: { kind: "W", group: "K" }, away: { kind: "T", winnerGroup: "K" } },
];

// For each group winner that hosts a best-third-placed team, the set of groups
// whose third-placed team is allowed to be drawn into that tie (from the official
// bracket — guarantees a winner never faces the third-placed team from a group it
// could otherwise meet improperly, and balances the bracket).
const THIRD_PLACE_SLOTS: Record<string, string[]> = {
  E: ["A", "B", "C", "D", "F"],
  I: ["C", "D", "F", "G", "H"],
  A: ["C", "E", "F", "H", "I"],
  L: ["E", "H", "I", "J", "K"],
  D: ["B", "E", "F", "I", "J"],
  G: ["A", "E", "H", "I", "J"],
  B: ["E", "F", "G", "I", "J"],
  K: ["D", "E", "I", "J", "L"],
};

// Process slots in official match-number order (74,77,79,80,81,82,85,87).
const THIRD_SLOT_ORDER = ["E", "I", "A", "L", "D", "G", "B", "K"];

function topThirdPlaced(
  standings: Record<string, StandingRow[]>,
): StandingRow[] {
  const all = Object.values(standings)
    .map((rows) => rows[2])
    .filter((r): r is StandingRow => Boolean(r));
  return all
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.teamName.localeCompare(b.teamName);
    })
    .slice(0, 8);
}

// Given the groups whose third-placed teams qualified, decide which one fills
// each winner slot. Deterministic backtracking over the official allowed-group
// constraints; always yields a FIFA-legal assignment when one exists (it always
// does for any 8-of-12 combination, by construction of the matrix).
function assignThirdPlaceSlots(
  qualifyingGroups: string[],
): Record<string, string> {
  const groups = [...qualifyingGroups].sort();
  const assignment: Record<string, string> = {};
  const used = new Set<string>();

  const backtrack = (i: number): boolean => {
    if (i === THIRD_SLOT_ORDER.length) return true;
    const winnerGroup = THIRD_SLOT_ORDER[i];
    const allowed = THIRD_PLACE_SLOTS[winnerGroup];
    for (const g of groups) {
      if (used.has(g) || !allowed.includes(g)) continue;
      assignment[winnerGroup] = g;
      used.add(g);
      if (backtrack(i + 1)) return true;
      used.delete(g);
      delete assignment[winnerGroup];
    }
    return false;
  };

  if (backtrack(0)) return assignment;

  // Fallback (e.g. fewer than 8 qualified — incomplete standings): greedily fill
  // whatever slots we can so the bracket degrades gracefully instead of throwing.
  used.clear();
  for (const winnerGroup of THIRD_SLOT_ORDER) {
    const allowed = THIRD_PLACE_SLOTS[winnerGroup];
    const g = groups.find((x) => !used.has(x) && allowed.includes(x));
    if (g) {
      assignment[winnerGroup] = g;
      used.add(g);
    }
  }
  return assignment;
}

export type R32SeedTeam = { code: string; name: string } | null;

export function buildR32Seeds(
  standings: Record<string, StandingRow[]>,
): Array<{ home: R32SeedTeam; away: R32SeedTeam }> {
  const thirds = topThirdPlaced(standings);
  const assignment = assignThirdPlaceSlots(thirds.map((r) => r.group));

  const teamOf = (row: StandingRow | undefined): R32SeedTeam =>
    row ? { code: row.teamCode, name: row.teamName } : null;

  const pick = (slot: SlotSpec): R32SeedTeam => {
    if (slot.kind === "T") {
      const sourceGroup = assignment[slot.winnerGroup];
      return teamOf(sourceGroup ? standings[sourceGroup]?.[2] : undefined);
    }
    const rows = standings[slot.group];
    if (!rows) return null;
    return teamOf(rows[slot.kind === "W" ? 0 : 1]);
  };

  return R32_TEMPLATE.map((t) => ({
    home: pick(t.home),
    away: pick(t.away),
  }));
}

function emptyPick(
  matchId: string,
  stage: KnockoutPick["stage"],
  home: R32SeedTeam,
  away: R32SeedTeam,
): KnockoutPick {
  return {
    matchId,
    stage,
    homeTeamCode: home?.code ?? "",
    homeTeamName: home?.name ?? "",
    awayTeamCode: away?.code ?? "",
    awayTeamName: away?.name ?? "",
    home: null,
    away: null,
    penaltyWinner: null,
  };
}

function winnerOf(pick: KnockoutPick): R32SeedTeam {
  if (pick.home == null || pick.away == null) return null;
  if (pick.home > pick.away)
    return { code: pick.homeTeamCode, name: pick.homeTeamName };
  if (pick.away > pick.home)
    return { code: pick.awayTeamCode, name: pick.awayTeamName };
  if (pick.penaltyWinner === "home")
    return { code: pick.homeTeamCode, name: pick.homeTeamName };
  if (pick.penaltyWinner === "away")
    return { code: pick.awayTeamCode, name: pick.awayTeamName };
  return null;
}

function loserOf(pick: KnockoutPick): R32SeedTeam {
  if (pick.home == null || pick.away == null) return null;
  if (pick.home > pick.away)
    return { code: pick.awayTeamCode, name: pick.awayTeamName };
  if (pick.away > pick.home)
    return { code: pick.homeTeamCode, name: pick.homeTeamName };
  if (pick.penaltyWinner === "home")
    return { code: pick.awayTeamCode, name: pick.awayTeamName };
  if (pick.penaltyWinner === "away")
    return { code: pick.homeTeamCode, name: pick.homeTeamName };
  return null;
}

export function buildKnockoutFromGroup(
  standings: Record<string, StandingRow[]>,
  existing?: PredictionDoc["knockout"],
): PredictionDoc["knockout"] {
  const r32Seeds = buildR32Seeds(standings);
  const r32: KnockoutPick[] = r32Seeds.map((seed, i) => {
    const id = `R32-${i + 1}`;
    const prev = existing?.r32?.find((p) => p.matchId === id);
    const fresh = emptyPick(id, "ROUND_OF_32", seed.home, seed.away);
    if (
      prev &&
      prev.homeTeamCode === fresh.homeTeamCode &&
      prev.awayTeamCode === fresh.awayTeamCode
    ) {
      return { ...fresh, home: prev.home, away: prev.away, penaltyWinner: prev.penaltyWinner };
    }
    return fresh;
  });

  const r16: KnockoutPick[] = [];
  for (let i = 0; i < 8; i++) {
    const winA = winnerOf(r32[i * 2]);
    const winB = winnerOf(r32[i * 2 + 1]);
    const id = `R16-${i + 1}`;
    const prev = existing?.r16?.find((p) => p.matchId === id);
    const fresh = emptyPick(id, "ROUND_OF_16", winA, winB);
    if (
      prev &&
      prev.homeTeamCode === fresh.homeTeamCode &&
      prev.awayTeamCode === fresh.awayTeamCode
    ) {
      r16.push({ ...fresh, home: prev.home, away: prev.away, penaltyWinner: prev.penaltyWinner });
    } else {
      r16.push(fresh);
    }
  }

  const qf: KnockoutPick[] = [];
  for (let i = 0; i < 4; i++) {
    const winA = winnerOf(r16[i * 2]);
    const winB = winnerOf(r16[i * 2 + 1]);
    const id = `QF-${i + 1}`;
    const prev = existing?.qf?.find((p) => p.matchId === id);
    const fresh = emptyPick(id, "QUARTER_FINALS", winA, winB);
    if (
      prev &&
      prev.homeTeamCode === fresh.homeTeamCode &&
      prev.awayTeamCode === fresh.awayTeamCode
    ) {
      qf.push({ ...fresh, home: prev.home, away: prev.away, penaltyWinner: prev.penaltyWinner });
    } else {
      qf.push(fresh);
    }
  }

  const sf: KnockoutPick[] = [];
  for (let i = 0; i < 2; i++) {
    const winA = winnerOf(qf[i * 2]);
    const winB = winnerOf(qf[i * 2 + 1]);
    const id = `SF-${i + 1}`;
    const prev = existing?.sf?.find((p) => p.matchId === id);
    const fresh = emptyPick(id, "SEMI_FINALS", winA, winB);
    if (
      prev &&
      prev.homeTeamCode === fresh.homeTeamCode &&
      prev.awayTeamCode === fresh.awayTeamCode
    ) {
      sf.push({ ...fresh, home: prev.home, away: prev.away, penaltyWinner: prev.penaltyWinner });
    } else {
      sf.push(fresh);
    }
  }

  const sfLoserA = loserOf(sf[0]);
  const sfLoserB = loserOf(sf[1]);
  const thirdFresh = emptyPick("THIRD-1", "THIRD_PLACE", sfLoserA, sfLoserB);
  const thirdPrev = existing?.third;
  const third: KnockoutPick =
    thirdPrev &&
    thirdPrev.homeTeamCode === thirdFresh.homeTeamCode &&
    thirdPrev.awayTeamCode === thirdFresh.awayTeamCode
      ? { ...thirdFresh, home: thirdPrev.home, away: thirdPrev.away, penaltyWinner: thirdPrev.penaltyWinner }
      : thirdFresh;

  const sfWinA = winnerOf(sf[0]);
  const sfWinB = winnerOf(sf[1]);
  const finalFresh = emptyPick("FINAL-1", "FINAL", sfWinA, sfWinB);
  const finalPrev = existing?.final;
  const final: KnockoutPick =
    finalPrev &&
    finalPrev.homeTeamCode === finalFresh.homeTeamCode &&
    finalPrev.awayTeamCode === finalFresh.awayTeamCode
      ? { ...finalFresh, home: finalPrev.home, away: finalPrev.away, penaltyWinner: finalPrev.penaltyWinner }
      : finalFresh;

  return { r32, r16, qf, sf, third, final };
}

// Re-derive a knockout bracket on the NEW structure while preserving as much of
// the user's ORIGINAL intent as possible. Used to migrate predictions that were
// filled against the previous (incorrect) bracket. For every new tie we keep the
// user's literal scoreline if they predicted that exact pairing anywhere; failing
// that we advance whichever team they sent furthest in their old bracket.
export function smartCarryOverKnockout(
  standings: Record<string, StandingRow[]>,
  old: PredictionDoc["knockout"] | undefined,
): PredictionDoc["knockout"] {
  // 1. Intent depth: how far the user advanced each team (won R32 → reached R16 …).
  const depth = new Map<string, number>();
  const bump = (team: R32SeedTeam, d: number) => {
    if (!team) return;
    if ((depth.get(team.code) ?? -1) < d) depth.set(team.code, d);
  };
  const recordWinners = (picks: KnockoutPick[] | undefined, d: number) => {
    for (const p of picks ?? []) bump(winnerOf(p), d);
  };
  recordWinners(old?.r32, 1);
  recordWinners(old?.r16, 2);
  recordWinners(old?.qf, 3);
  recordWinners(old?.sf, 4);
  if (old?.final) recordWinners([old.final], 5);

  // 2. Decisive scorelines the user gave for specific pairings (any round).
  const scoreByPair = new Map<
    string,
    { homeCode: string; home: number; away: number; pen: "home" | "away" | null }
  >();
  const recordScore = (p: KnockoutPick | null | undefined) => {
    if (!p || p.home == null || p.away == null) return;
    if (!p.homeTeamCode || !p.awayTeamCode) return;
    const decisive = p.home !== p.away || p.penaltyWinner != null;
    if (!decisive) return;
    const key = [p.homeTeamCode, p.awayTeamCode].sort().join("|");
    if (!scoreByPair.has(key)) {
      scoreByPair.set(key, {
        homeCode: p.homeTeamCode,
        home: p.home,
        away: p.away,
        pen: p.penaltyWinner,
      });
    }
  };
  for (const list of [old?.r32, old?.r16, old?.qf, old?.sf]) {
    for (const p of list ?? []) recordScore(p);
  }
  recordScore(old?.third);
  recordScore(old?.final);

  // 3. Fill one tie: reuse the exact prediction for this pairing if we have one,
  //    otherwise advance the team the user pushed deeper (ties default to home).
  const fill = (
    matchId: string,
    stage: KnockoutPick["stage"],
    home: R32SeedTeam,
    away: R32SeedTeam,
  ): KnockoutPick => {
    const pick = emptyPick(matchId, stage, home, away);
    if (!home || !away) return pick;
    const exact = scoreByPair.get([home.code, away.code].sort().join("|"));
    if (exact) {
      if (exact.homeCode === home.code) {
        pick.home = exact.home;
        pick.away = exact.away;
        pick.penaltyWinner = exact.pen;
      } else {
        pick.home = exact.away;
        pick.away = exact.home;
        pick.penaltyWinner =
          exact.pen === "home" ? "away" : exact.pen === "away" ? "home" : null;
      }
      return pick;
    }
    const dh = depth.get(home.code) ?? -1;
    const da = depth.get(away.code) ?? -1;
    if (da > dh) {
      pick.home = 0;
      pick.away = 1;
    } else {
      pick.home = 1;
      pick.away = 0;
    }
    return pick;
  };

  const r32Seeds = buildR32Seeds(standings);
  const r32 = r32Seeds.map((s, i) =>
    fill(`R32-${i + 1}`, "ROUND_OF_32", s.home, s.away),
  );

  const r16: KnockoutPick[] = [];
  for (let i = 0; i < 8; i++) {
    r16.push(
      fill(`R16-${i + 1}`, "ROUND_OF_16", winnerOf(r32[i * 2]), winnerOf(r32[i * 2 + 1])),
    );
  }

  const qf: KnockoutPick[] = [];
  for (let i = 0; i < 4; i++) {
    qf.push(
      fill(`QF-${i + 1}`, "QUARTER_FINALS", winnerOf(r16[i * 2]), winnerOf(r16[i * 2 + 1])),
    );
  }

  const sf: KnockoutPick[] = [];
  for (let i = 0; i < 2; i++) {
    sf.push(
      fill(`SF-${i + 1}`, "SEMI_FINALS", winnerOf(qf[i * 2]), winnerOf(qf[i * 2 + 1])),
    );
  }

  const third = fill("THIRD-1", "THIRD_PLACE", loserOf(sf[0]), loserOf(sf[1]));
  const final = fill("FINAL-1", "FINAL", winnerOf(sf[0]), winnerOf(sf[1]));

  return { r32, r16, qf, sf, third, final };
}

// Bump whenever the bracket structure changes so stored predictions re-migrate.
// v2 = official FIFA 2026 Round of 32 layout + per-slot third-place assignment.
export const KNOCKOUT_BRACKET_VERSION = 2;

// One-time, idempotent migration of a single stored prediction onto the current
// bracket version. Preserves the user's intent via smartCarryOverKnockout. Once a
// prediction is stamped at the current version it is returned untouched, so this
// never fights the user's later edits.
export function migratePrediction(
  prediction: PredictionDoc,
  groupMatches: MatchDoc[],
): { prediction: PredictionDoc; changed: boolean } {
  if (prediction.bracketVersion === KNOCKOUT_BRACKET_VERSION) {
    return { prediction, changed: false };
  }

  if (!isGroupStageComplete(groupMatches, prediction.groupScores ?? {})) {
    return {
      prediction: {
        ...prediction,
        knockout: { r32: [], r16: [], qf: [], sf: [], third: null, final: null },
        champion: null,
        bracketVersion: KNOCKOUT_BRACKET_VERSION,
      },
      changed: true,
    };
  }

  const standings = computeGroupStandings(groupMatches, prediction.groupScores);
  const knockout = smartCarryOverKnockout(standings, prediction.knockout);
  return {
    prediction: {
      ...prediction,
      knockout,
      champion: championFromFinal(knockout.final),
      bracketVersion: KNOCKOUT_BRACKET_VERSION,
    },
    changed: true,
  };
}

export function championFromFinal(
  final: KnockoutPick | null,
): { code: string; name: string } | null {
  if (!final) return null;
  const winner = winnerOf(final);
  return winner;
}
