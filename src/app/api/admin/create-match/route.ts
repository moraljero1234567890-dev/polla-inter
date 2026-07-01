import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { matchesCollection } from "@/lib/mongodb";
import type { MatchDoc, MatchStage } from "@/lib/types";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<MatchStage, string> = {
  GROUP_STAGE: "Fase de Grupos",
  ROUND_OF_32: "Dieciseisavos",
  ROUND_OF_16: "Octavos",
  QUARTER_FINALS: "Cuartos",
  SEMI_FINALS: "Semifinal",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final",
};

const TEAM_NAMES: Record<string, string> = {
  ar: "Argentina", au: "Australia", at: "Austria", be: "Bélgica",
  ba: "Bosnia y Herzegovina", br: "Brasil", ca: "Canadá", cl: "Chile",
  ci: "Costa de Marfil", cd: "RD del Congo", co: "Colombia", cv: "Cabo Verde",
  cr: "Costa Rica", hr: "Croacia", cw: "Curazao", cz: "República Checa",
  dk: "Dinamarca", ec: "Ecuador", eg: "Egipto", "gb-eng": "Inglaterra",
  es: "España", fr: "Francia", de: "Alemania", gh: "Ghana",
  ht: "Haití", hu: "Hungría", ir: "Irán", iq: "Irak",
  it: "Italia", jm: "Jamaica", jo: "Jordania", jp: "Japón",
  kr: "Corea del Sur", sa: "Arabia Saudita", ma: "Marruecos",
  mx: "México", nl: "Países Bajos", ng: "Nigeria", no: "Noruega",
  nz: "Nueva Zelanda", pa: "Panamá", py: "Paraguay", pt: "Portugal",
  qa: "Catar", ro: "Rumanía", za: "Sudáfrica", "gb-sct": "Escocia",
  sn: "Senegal", rs: "Serbia", ch: "Suiza", se: "Suecia",
  tn: "Túnez", tr: "Turquía", ae: "Emiratos Árabes Unidos",
  ua: "Ucrania", uy: "Uruguay", us: "Estados Unidos", uz: "Uzbekistán",
  ve: "Venezuela", "gb-wls": "Gales", dz: "Argelia", gh2: "Ghana",
  mu: "Marruecos", nz2: "Nueva Zelanda",
};

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

// Creates or updates a knockout match with a manual score. The match is keyed
// by stage + sorted team codes so creating the same match twice is idempotent.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    stage?: string;
    homeCode?: string;
    awayCode?: string;
    homeScore?: unknown;
    awayScore?: unknown;
    penaltyHome?: unknown;
    penaltyAway?: unknown;
    date?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stage = (body.stage ?? "").trim().toUpperCase() as MatchStage;
  const homeCode = (body.homeCode ?? "").trim().toLowerCase();
  const awayCode = (body.awayCode ?? "").trim().toLowerCase();

  if (!stage || !STAGE_LABELS[stage] || stage === "GROUP_STAGE") {
    return NextResponse.json(
      { error: "Etapa inválida. Usa: ROUND_OF_32, ROUND_OF_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL" },
      { status: 400 },
    );
  }
  if (!homeCode || !awayCode) {
    return NextResponse.json(
      { error: "Faltan códigos de equipo (ej: de, py, br, ar)" },
      { status: 400 },
    );
  }

  const homeScore = toInt(body.homeScore);
  const awayScore = toInt(body.awayScore);
  const hasScore = homeScore != null && awayScore != null;

  const penH =
    body.penaltyHome === "" || body.penaltyHome == null
      ? null
      : toInt(body.penaltyHome);
  const penA =
    body.penaltyAway === "" || body.penaltyAway == null
      ? null
      : toInt(body.penaltyAway);
  const penalties =
    penH != null && penA != null ? { home: penH, away: penA } : null;

  const dateStr = body.date ?? new Date().toISOString().slice(0, 10);
  const utcDate = new Date(`${dateStr}T12:00:00Z`).toISOString();

  // Stable ID: stage + sorted team codes — idempotent on repeated saves.
  const sortedPair = [homeCode, awayCode].sort().join("-");
  const id = `manual-${stage}-${sortedPair}`;

  const doc: MatchDoc = {
    _id: id,
    source: "wikipedia",
    externalId: id,
    utcDate,
    date: dateStr,
    time: "12:00",
    status: hasScore ? "FINISHED" : "SCHEDULED",
    stage,
    stageLabel: STAGE_LABELS[stage],
    group: null,
    matchday: null,
    venue: "",
    city: "",
    home: {
      code: homeCode,
      name: TEAM_NAMES[homeCode] ?? homeCode.toUpperCase(),
      crest: `https://flagcdn.com/w80/${homeCode}.png`,
    },
    away: {
      code: awayCode,
      name: TEAM_NAMES[awayCode] ?? awayCode.toUpperCase(),
      crest: `https://flagcdn.com/w80/${awayCode}.png`,
    },
    score: hasScore
      ? {
          fullTime: { home: homeScore!, away: awayScore! },
          halfTime: null,
          penalties,
        }
      : null,
    manualScore: true,
  };

  const col = await matchesCollection();
  await col.replaceOne({ _id: id }, doc, { upsert: true });

  return NextResponse.json({
    ok: true,
    id,
    stage,
    match: `${TEAM_NAMES[homeCode] ?? homeCode} ${homeScore ?? "?"}-${awayScore ?? "?"} ${TEAM_NAMES[awayCode] ?? awayCode}`,
    penalties: penalties ? `${penH}-${penA}` : null,
  });
}
