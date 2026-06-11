"use client";

// Client-only PDF export of a completed prediction (group stage + knockout).
// Lazy-imported on button click so @react-pdf/renderer never touches SSR or the
// initial bundle. Flags are pre-fetched to data URLs so one bad flag can't break
// the whole render.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { formatDate } from "@/data/worldcup2026";
import type { ApiMatch } from "@/lib/matches";
import { displayTeam, normalizeTeam } from "@/lib/team-display";
import type { KnockoutPick, PredictionDoc } from "@/lib/types";

const BRAND = "#d01317";
const BRAND_DARK = "#a00f12";
const DARK = "#2e2e2e";
const MUTED = "#8a8a8a";
const SURFACE = "#f5f5f5";
const LINE = "#e3e3e3";

const STAGE_TITLES: Record<KnockoutPick["stage"], string> = {
  ROUND_OF_32: "Dieciseisavos de final",
  ROUND_OF_16: "Octavos de final",
  QUARTER_FINALS: "Cuartos de final",
  SEMI_FINALS: "Semifinales",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final",
};

type Team = { code: string; name: string; crest: string };
type FlagMap = Record<string, string>;

type GroupRow = {
  home: Team;
  away: Team;
  home_g: number | null;
  away_g: number | null;
  date: string;
};
type GroupBlock = { group: string; rows: GroupRow[] };

type KoRow = {
  home: Team;
  away: Team;
  home_g: number | null;
  away_g: number | null;
  winner: "home" | "away" | null;
  pen: boolean;
};
type KoBlock = { title: string; rows: KoRow[] };

function winnerSide(p: KnockoutPick): "home" | "away" | null {
  if (p.home == null || p.away == null) return null;
  if (p.home > p.away) return "home";
  if (p.away > p.home) return "away";
  return p.penaltyWinner;
}

function buildGroupBlocks(
  prediction: PredictionDoc,
  matches: ApiMatch[],
): GroupBlock[] {
  const byGroup: Record<string, ApiMatch[]> = {};
  for (const m of matches) {
    if (m.stage !== "GROUP_STAGE" || !m.group) continue;
    (byGroup[m.group] ??= []).push(m);
  }
  return Object.keys(byGroup)
    .sort()
    .map((group) => {
      const rows = byGroup[group]
        .slice()
        .sort((a, b) => {
          const md = (a.matchday ?? 0) - (b.matchday ?? 0);
          if (md !== 0) return md;
          return a.date.localeCompare(b.date);
        })
        .map((m): GroupRow => {
          const score = prediction.groupScores?.[m._id];
          const home = normalizeTeam(m.home);
          const away = normalizeTeam(m.away);
          return {
            home: { code: home.code, name: home.name, crest: home.crest ?? "" },
            away: { code: away.code, name: away.name, crest: away.crest ?? "" },
            home_g: typeof score?.home === "number" ? score.home : null,
            away_g: typeof score?.away === "number" ? score.away : null,
            date: m.date,
          };
        });
      return { group, rows };
    });
}

function toKoRow(p: KnockoutPick): KoRow {
  const home = displayTeam(p.homeTeamCode, p.homeTeamName);
  const away = displayTeam(p.awayTeamCode, p.awayTeamName);
  const winner = winnerSide(p);
  return {
    home,
    away,
    home_g: p.home,
    away_g: p.away,
    winner,
    pen: p.home != null && p.home === p.away && p.penaltyWinner != null,
  };
}

function buildKoBlocks(prediction: PredictionDoc): KoBlock[] {
  const k = prediction.knockout;
  const blocks: KoBlock[] = [
    { title: STAGE_TITLES.ROUND_OF_32, rows: (k.r32 ?? []).map(toKoRow) },
    { title: STAGE_TITLES.ROUND_OF_16, rows: (k.r16 ?? []).map(toKoRow) },
    { title: STAGE_TITLES.QUARTER_FINALS, rows: (k.qf ?? []).map(toKoRow) },
    { title: STAGE_TITLES.SEMI_FINALS, rows: (k.sf ?? []).map(toKoRow) },
  ];
  if (k.third) blocks.push({ title: STAGE_TITLES.THIRD_PLACE, rows: [toKoRow(k.third)] });
  if (k.final) blocks.push({ title: STAGE_TITLES.FINAL, rows: [toKoRow(k.final)] });
  return blocks.filter((b) => b.rows.length > 0);
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildFlagMap(crests: string[]): Promise<FlagMap> {
  const unique = [...new Set(crests.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (url) => [url, await urlToDataUrl(url)] as const),
  );
  const map: FlagMap = {};
  for (const [url, data] of entries) if (data) map[url] = data;
  return map;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 36,
    paddingHorizontal: 30,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: DARK,
    backgroundColor: "#ffffff",
  },
  hero: {
    backgroundColor: DARK,
    color: "#ffffff",
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  kicker: {
    color: BRAND,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    textTransform: "uppercase",
  },
  heroMeta: { color: "#cfcfcf", fontSize: 8, marginTop: 8, letterSpacing: 1 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: DARK,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    paddingLeft: 8,
    marginBottom: 12,
    marginTop: 6,
  },
  cardsWrap: { flexDirection: "row", flexWrap: "wrap" },
  groupCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: LINE,
  },
  groupHead: {
    backgroundColor: SURFACE,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  groupHeadText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  date: { width: 32, fontSize: 6.5, color: MUTED },
  teamLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  teamRight: { flex: 1, flexDirection: "row", alignItems: "center" },
  teamNameLeft: { fontSize: 7.5, textAlign: "right", marginRight: 4 },
  teamNameRight: { fontSize: 7.5, marginLeft: 4 },
  flag: { width: 14, height: 9, objectFit: "cover", borderWidth: 0.5, borderColor: LINE },
  flagBox: { width: 14, height: 9, backgroundColor: SURFACE },
  score: {
    width: 32,
    textAlign: "center",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  bold: { fontFamily: "Helvetica-Bold" },
  pen: { fontSize: 6, color: BRAND, fontFamily: "Helvetica-Bold" },
  koCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 3,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  koRoundTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: BRAND_DARK,
    marginBottom: 6,
    marginTop: 4,
  },
  champBanner: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: BRAND,
    paddingVertical: 14,
    alignItems: "center",
  },
  champLabel: {
    fontSize: 9,
    letterSpacing: 3,
    color: BRAND,
    fontFamily: "Helvetica-Bold",
  },
  champName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginTop: 8,
  },
  champFlag: { width: 40, height: 26, objectFit: "cover", marginTop: 8, borderWidth: 1, borderColor: LINE },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
  },
});

function Flag({ crest, flags, big }: { crest: string; flags: FlagMap; big?: boolean }) {
  const src = flags[crest];
  if (!src) return <View style={big ? styles.champFlag : styles.flagBox} />;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={src} style={big ? styles.champFlag : styles.flag} />;
}

function scoreText(h: number | null, a: number | null): string {
  if (h == null || a == null) return "–";
  return `${h} - ${a}`;
}

function GroupMatchRow({ row, flags }: { row: GroupRow; flags: FlagMap }) {
  return (
    <View style={styles.matchRow}>
      <Text style={styles.date}>{formatDate(row.date)}</Text>
      <View style={styles.teamLeft}>
        <Text style={styles.teamNameLeft}>{row.home.name}</Text>
        <Flag crest={row.home.crest} flags={flags} />
      </View>
      <Text style={styles.score}>{scoreText(row.home_g, row.away_g)}</Text>
      <View style={styles.teamRight}>
        <Flag crest={row.away.crest} flags={flags} />
        <Text style={styles.teamNameRight}>{row.away.name}</Text>
      </View>
    </View>
  );
}

function KoMatchRow({ row, flags }: { row: KoRow; flags: FlagMap }) {
  const homeName =
    row.winner === "home" ? [styles.teamNameLeft, styles.bold] : styles.teamNameLeft;
  const awayName =
    row.winner === "away" ? [styles.teamNameRight, styles.bold] : styles.teamNameRight;
  return (
    <View style={styles.koCard} wrap={false}>
      <View style={styles.teamLeft}>
        {row.winner === "home" && row.pen ? <Text style={styles.pen}>pen </Text> : null}
        <Text style={homeName}>{row.home.name}</Text>
        <Flag crest={row.home.crest} flags={flags} />
      </View>
      <Text style={styles.score}>{scoreText(row.home_g, row.away_g)}</Text>
      <View style={styles.teamRight}>
        <Flag crest={row.away.crest} flags={flags} />
        <Text style={awayName}>{row.away.name}</Text>
        {row.winner === "away" && row.pen ? <Text style={styles.pen}> pen</Text> : null}
      </View>
    </View>
  );
}

function PredictionDocument({
  groups,
  ko,
  champion,
  email,
  attempt,
  generated,
  flags,
}: {
  groups: GroupBlock[];
  ko: KoBlock[];
  champion: Team | null;
  email: string;
  attempt: number;
  generated: string;
  flags: FlagMap;
}) {
  return (
    <Document title={`Polla Mundialista — Pronóstico ${attempt}`} author="Polla Inter">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.hero}>
          <Text style={styles.kicker}>POLLA MUNDIALISTA · INTENTO {attempt}</Text>
          <Text style={styles.heroTitle}>Mi Pronóstico</Text>
          <Text style={styles.heroMeta}>{email}</Text>
        </View>

        <Text style={styles.sectionTitle}>Fase de grupos</Text>
        <View style={styles.cardsWrap}>
          {groups.map((g) => (
            <View key={g.group} style={styles.groupCard} wrap={false}>
              <View style={styles.groupHead}>
                <Text style={styles.groupHeadText}>Grupo {g.group}</Text>
              </View>
              {g.rows.map((row, i) => (
                <GroupMatchRow key={i} row={row} flags={flags} />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Polla Mundialista · Grupo Inter</Text>
          <Text>{generated}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>Eliminatorias</Text>
        {ko.map((block) => (
          <View key={block.title}>
            <Text style={styles.koRoundTitle}>{block.title}</Text>
            <View style={styles.cardsWrap}>
              {block.rows.map((row, i) => (
                <KoMatchRow key={i} row={row} flags={flags} />
              ))}
            </View>
          </View>
        ))}

        {champion ? (
          <View style={styles.champBanner} wrap={false}>
            <Text style={styles.champLabel}>CAMPEÓN DEL MUNDO</Text>
            <Flag crest={champion.crest} flags={flags} big />
            <Text style={styles.champName}>{champion.name}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>Polla Mundialista · Grupo Inter</Text>
          <Text>{generated}</Text>
        </View>
      </Page>
    </Document>
  );
}

export type ExportArgs = {
  prediction: PredictionDoc;
  matches: ApiMatch[];
  email: string;
  attempt: number;
};

export async function downloadPredictionPdf(args: ExportArgs): Promise<void> {
  const groups = buildGroupBlocks(args.prediction, args.matches);
  const ko = buildKoBlocks(args.prediction);
  const champion = args.prediction.champion
    ? (() => {
        const c = displayTeam(
          args.prediction.champion!.code,
          args.prediction.champion!.name,
        );
        return { code: c.code, name: c.name, crest: c.crest };
      })()
    : null;

  const crests = [
    ...groups.flatMap((g) => g.rows.flatMap((r) => [r.home.crest, r.away.crest])),
    ...ko.flatMap((b) => b.rows.flatMap((r) => [r.home.crest, r.away.crest])),
    ...(champion ? [champion.crest] : []),
  ];
  const flags = await buildFlagMap(crests);

  const generated = new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const blob = await pdf(
    <PredictionDocument
      groups={groups}
      ko={ko}
      champion={champion}
      email={args.email}
      attempt={args.attempt}
      generated={generated}
      flags={flags}
    />,
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `polla-pronostico-intento-${args.attempt}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
