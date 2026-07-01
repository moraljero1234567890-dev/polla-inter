import type { MatchDoc, MatchStage } from "./types";
import { matches as staticMatches } from "@/data/worldcup2026";

function groupPairKey(a: string, b: string): string {
  return [a.toLowerCase(), b.toLowerCase()].sort().join("|");
}

// Canonical slot + matchday for every group fixture, keyed by the unordered team
// pair. The seed file order within a group defines the slot (1-based), which is
// exactly the `wiki-G<letter><slot>` id scheme predictions are stored under.
//
// We bind a match's id to the TEAMS, not to its position on the Wikipedia page.
// Wikipedia reorders match boxes and briefly drops them while editors update the
// page live; a position-based id then silently rebinds an id (e.g. wiki-GF4) to a
// different fixture, so every prediction keyed to it shows another game's score.
// Resolving the slot from the seed pairing keeps each fixture's id stable no
// matter how the page is ordered.
const SEED_GROUP_SLOTS: Map<
  string,
  Map<string, { slot: number; matchday: number }>
> = (() => {
  const byGroup = new Map<string, Map<string, { slot: number; matchday: number }>>();
  const counters = new Map<string, number>();
  for (const m of staticMatches) {
    const slot = (counters.get(m.group) ?? 0) + 1;
    counters.set(m.group, slot);
    const inner = byGroup.get(m.group) ?? new Map();
    inner.set(groupPairKey(m.home.code, m.away.code), { slot, matchday: m.matchday });
    byGroup.set(m.group, inner);
  }
  return byGroup;
})();

const UA = "PollaInter/1.0 (info@tirepro.com.co)";

const FIFA_TO_ISO: Record<string, string> = {
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CHI: "cl",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRC: "cr",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  DEN: "dk",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  HUN: "hu",
  IRN: "ir",
  IRQ: "iq",
  ITA: "it",
  JAM: "jm",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NGA: "ng",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  ROU: "ro",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SRB: "rs",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  UAE: "ae",
  UKR: "ua",
  URU: "uy",
  USA: "us",
  UZB: "uz",
  VEN: "ve",
  WAL: "gb-wls",
};

function flagFromFifa(code: string): string {
  const iso = FIFA_TO_ISO[code.toUpperCase()] ?? code.toLowerCase();
  return `https://flagcdn.com/w80/${iso}.png`;
}

const TEAM_NAMES: Record<string, string> = {
  ALG: "Argelia",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Bélgica",
  BIH: "Bosnia y Herzegovina",
  BRA: "Brasil",
  CAN: "Canadá",
  CHI: "Chile",
  CIV: "Costa de Marfil",
  COD: "RD del Congo",
  COL: "Colombia",
  CPV: "Cabo Verde",
  CRC: "Costa Rica",
  CRO: "Croacia",
  CUW: "Curazao",
  CZE: "República Checa",
  DEN: "Dinamarca",
  ECU: "Ecuador",
  EGY: "Egipto",
  ENG: "Inglaterra",
  ESP: "España",
  FRA: "Francia",
  GER: "Alemania",
  GHA: "Ghana",
  HAI: "Haití",
  HUN: "Hungría",
  IRN: "Irán",
  IRQ: "Irak",
  ITA: "Italia",
  JAM: "Jamaica",
  JOR: "Jordania",
  JPN: "Japón",
  KOR: "Corea del Sur",
  KSA: "Arabia Saudita",
  MAR: "Marruecos",
  MEX: "México",
  NED: "Países Bajos",
  NGA: "Nigeria",
  NOR: "Noruega",
  NZL: "Nueva Zelanda",
  PAN: "Panamá",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Catar",
  ROU: "Rumanía",
  RSA: "Sudáfrica",
  SCO: "Escocia",
  SEN: "Senegal",
  SRB: "Serbia",
  SUI: "Suiza",
  SWE: "Suecia",
  TUN: "Túnez",
  TUR: "Turquía",
  UAE: "Emiratos Árabes Unidos",
  UKR: "Ucrania",
  URU: "Uruguay",
  USA: "Estados Unidos",
  UZB: "Uzbekistán",
  VEN: "Venezuela",
  WAL: "Gales",
};

function teamName(code: string): string {
  return TEAM_NAMES[code.toUpperCase()] ?? code;
}

async function fetchWikitext(page: string): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "parse",
      page,
      format: "json",
      prop: "wikitext",
      formatversion: "2",
    }).toString();
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Wikipedia ${page}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    error?: { info: string };
    parse?: { wikitext: string };
  };
  if (json.error) throw new Error(`Wikipedia ${page}: ${json.error.info}`);
  return json.parse?.wikitext ?? "";
}

function unwrapTemplates(input: string): string {
  let s = input;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(
    /\{\{#invoke:flag\|[^|}]+\|([A-Z]{2,4})\}\}/g,
    (_m, code) => code,
  );
  s = s.replace(/\{\{flagicon\|([^|}]+)\}\}/gi, (_m, code) => code);
  s = s.replace(
    /\{\{Start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})[^}]*\}\}/g,
    (_m, y, mo, d) =>
      `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  );
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_m, _link, label) => label);
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, label) => label);
  s = s.replace(/&nbsp;/g, " ");
  return s;
}

function splitTemplateArgs(body: string): Record<string, string> {
  const args: Record<string, string> = {};
  let depth = 0;
  let current = "";
  const tokens: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{" && body[i + 1] === "{") {
      depth++;
      current += c;
    } else if (c === "}" && body[i + 1] === "}") {
      depth--;
      current += c;
    } else if (c === "[" && body[i + 1] === "[") {
      depth++;
      current += c;
    } else if (c === "]" && body[i + 1] === "]") {
      depth--;
      current += c;
    } else if (c === "|" && depth === 0) {
      tokens.push(current);
      current = "";
      continue;
    } else {
      current += c;
    }
  }
  tokens.push(current);
  for (const t of tokens) {
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim();
    args[key] = value;
  }
  return args;
}

function extractFootballBoxes(wikitext: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const startRe = /\{\{#invoke:football box\|main\b/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(wikitext)) !== null) {
    let i = m.index + 2;
    let depth = 1;
    let end = -1;
    while (i < wikitext.length) {
      if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
        depth++;
        i += 2;
      } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
        depth--;
        i += 2;
        if (depth === 0) {
          end = i;
          break;
        }
      } else {
        i++;
      }
    }
    if (end < 0) continue;
    const body = wikitext.slice(m.index + 2, end - 2);
    const stripped = body.replace(/^#invoke:football box\|main\|?/i, "");
    out.push(splitTemplateArgs(stripped));
  }
  return out;
}

function parseLocalTime(raw: string): {
  hour: number;
  minute: number;
  offsetHours: number;
} | null {
  const cleaned = raw.replace(/&nbsp;/g, " ").trim();
  const tz = /UTC[−−–—-](\d{1,2})/.exec(cleaned);
  const offsetHours = tz ? -Number(tz[1]) : 0;
  const tm = /(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.|am|pm)?/i.exec(cleaned);
  if (!tm) return null;
  let hour = Number(tm[1]);
  const minute = Number(tm[2]);
  const ampm = (tm[3] ?? "").toLowerCase();
  if (ampm.startsWith("p") && hour < 12) hour += 12;
  if (ampm.startsWith("a") && hour === 12) hour = 0;
  return { hour, minute, offsetHours };
}

// Returns the true UTC instant plus the Colombia-local (UTC−5) date/time used for
// display, so stored matches read in Colombian time regardless of the venue zone.
function combineUtc(
  date: string,
  local: { hour: number; minute: number; offsetHours: number },
): { utcDate: string; date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const localMs = Date.UTC(y, mo - 1, d, local.hour, local.minute);
  const utcMs = localMs - local.offsetHours * 3600 * 1000;
  const cot = new Date(utcMs - 5 * 3600 * 1000); // America/Bogota, UTC−5, no DST
  return {
    utcDate: new Date(utcMs).toISOString(),
    date: cot.toISOString().slice(0, 10),
    time: cot.toISOString().slice(11, 16),
  };
}

function parseScore(raw: string): {
  home: number;
  away: number;
  penaltyHome?: number;
  penaltyAway?: number;
  status: "FINISHED" | "SCHEDULED";
} {
  const s = unwrapTemplates(raw).trim();
  if (!s || /^score link/i.test(s)) return { home: 0, away: 0, status: "SCHEDULED" };
  const m = /(\d{1,2})\s*[–\-]\s*(\d{1,2})/.exec(s);
  if (!m) return { home: 0, away: 0, status: "SCHEDULED" };
  const pen = /\((\d+)\s*[–\-]\s*(\d+)[^)]*\)/.exec(s);
  return {
    home: Number(m[1]),
    away: Number(m[2]),
    status: "FINISHED",
    penaltyHome: pen ? Number(pen[1]) : undefined,
    penaltyAway: pen ? Number(pen[2]) : undefined,
  };
}

function teamFromField(raw: string): { code: string; name: string } | null {
  const s = unwrapTemplates(raw).trim();
  if (!s) return null;
  const code = /\b([A-Z]{3})\b/.exec(s);
  if (code) {
    const fifa = code[1];
    return { code: fifa, name: teamName(fifa) };
  }
  return { code: "", name: s };
}

function parseStadium(raw: string): { venue: string; city: string } {
  const s = unwrapTemplates(raw).trim();
  const parts = s.split(",").map((x) => x.trim());
  return {
    venue: parts[0] ?? "",
    city: parts.slice(1).join(", "),
  };
}

export type WikipediaMatchOptions = {
  groupKey?: string;
  matchday?: number;
  stage: MatchStage;
  stageLabel: string;
  externalId: string;
};

function toMatchDoc(
  fields: Record<string, string>,
  opts: WikipediaMatchOptions,
): MatchDoc | null {
  const home = teamFromField(fields.team1 ?? "");
  const away = teamFromField(fields.team2 ?? "");
  if (!home || !away) return null;
  const dateRaw = unwrapTemplates(fields.date ?? "").trim();
  const dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(dateRaw);
  if (!dateMatch) return null;
  const localDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  const local = parseLocalTime(fields.time ?? "") ?? {
    hour: 0,
    minute: 0,
    offsetHours: 0,
  };
  const { utcDate, date, time } = combineUtc(localDate, local);
  const scoreInfo = parseScore(fields.score ?? "");
  const { venue, city } = parseStadium(fields.stadium ?? "");

  return {
    _id: `wiki-${opts.externalId}`,
    source: "wikipedia" as const,
    externalId: opts.externalId,
    utcDate,
    date,
    time,
    status: scoreInfo.status,
    stage: opts.stage,
    stageLabel: opts.stageLabel,
    group: opts.groupKey ?? null,
    matchday: opts.matchday ?? null,
    venue,
    city,
    home: {
      code: (FIFA_TO_ISO[home.code] ?? home.code).toLowerCase(),
      name: home.name,
      crest: home.code ? flagFromFifa(home.code) : "",
    },
    away: {
      code: (FIFA_TO_ISO[away.code] ?? away.code).toLowerCase(),
      name: away.name,
      crest: away.code ? flagFromFifa(away.code) : "",
    },
    score:
      scoreInfo.status === "FINISHED"
        ? {
            fullTime: { home: scoreInfo.home, away: scoreInfo.away },
            halfTime: null,
            penalties:
              scoreInfo.penaltyHome != null && scoreInfo.penaltyAway != null
                ? {
                    home: scoreInfo.penaltyHome,
                    away: scoreInfo.penaltyAway,
                  }
                : null,
          }
        : null,
  };
}

const GROUP_KEYS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
] as const;

const KNOCKOUT_STAGES: Record<string, { stage: MatchStage; stageLabel: string }> = {
  "Round of 32": { stage: "ROUND_OF_32", stageLabel: "Dieciseisavos" },
  "Round of 16": { stage: "ROUND_OF_16", stageLabel: "Octavos" },
  Quarterfinals: { stage: "QUARTER_FINALS", stageLabel: "Cuartos" },
  Semifinals: { stage: "SEMI_FINALS", stageLabel: "Semifinal" },
  "Match for third place": { stage: "THIRD_PLACE", stageLabel: "Tercer puesto" },
  Final: { stage: "FINAL", stageLabel: "Final" },
};

async function parseGroupPage(letter: string): Promise<MatchDoc[]> {
  const page = `2026_FIFA_World_Cup_Group_${letter}`;
  const wt = await fetchWikitext(page);
  // Wikipedia editors use both "==Matches==" and "== Matches ==" (with spaces),
  // and the casing or wording may vary while pages are actively edited. Accept
  // any of the common variants so a single editor whitespace change can't silently
  // drop an entire group from the scrape.
  const headingMatch = /==\s*(?:Matches|Results|Group matches)\s*==/i.exec(wt);
  if (!headingMatch) return [];
  const start = headingMatch.index;
  const sliced = wt.slice(start);
  const boxes = extractFootballBoxes(sliced);
  const seedSlots = SEED_GROUP_SLOTS.get(letter);
  return boxes
    .map((fields, idx) => {
      // Resolve the stable slot from the team pairing (seed) so the id never
      // tracks Wikipedia's fluctuating box order. Fall back to page position only
      // for a box whose teams aren't in the seed (e.g. a stray/placeholder row).
      const home = teamFromField(fields.team1 ?? "");
      const away = teamFromField(fields.team2 ?? "");
      const homeIso = home?.code ? (FIFA_TO_ISO[home.code] ?? home.code) : "";
      const awayIso = away?.code ? (FIFA_TO_ISO[away.code] ?? away.code) : "";
      const seed =
        homeIso && awayIso
          ? seedSlots?.get(groupPairKey(homeIso, awayIso))
          : undefined;
      const slot = seed?.slot ?? idx + 1;
      const matchday = seed?.matchday ?? Math.floor(idx / 2) + 1;
      return toMatchDoc(fields, {
        groupKey: letter,
        matchday,
        stage: "GROUP_STAGE",
        stageLabel: "Fase de Grupos",
        externalId: `G${letter}${slot}`,
      });
    })
    .filter((d): d is MatchDoc => d != null);
}

async function parseKnockoutPage(): Promise<MatchDoc[]> {
  const wt = await fetchWikitext("2026_FIFA_World_Cup_knockout_stage");
  const sectionRe = /^==\s*([^=]+?)\s*==\s*$/gm;
  const sections: Array<{ label: string; start: number }> = [];
  let sm: RegExpExecArray | null;
  while ((sm = sectionRe.exec(wt)) !== null) {
    sections.push({ label: sm[1].trim(), start: sm.index });
  }
  const out: MatchDoc[] = [];
  for (let i = 0; i < sections.length; i++) {
    const { label, start } = sections[i];
    const cfg = KNOCKOUT_STAGES[label];
    if (!cfg) continue;
    const end = sections[i + 1]?.start ?? wt.length;
    const segment = wt.slice(start, end);
    const boxes = extractFootballBoxes(segment);
    boxes.forEach((fields, idx) => {
      const doc = toMatchDoc(fields, {
        stage: cfg.stage,
        stageLabel: cfg.stageLabel,
        externalId: `${cfg.stage}-${idx + 1}`,
      });
      if (doc) out.push(doc);
    });
  }
  return out;
}

async function parseFinalPage(): Promise<MatchDoc[]> {
  try {
    const wt = await fetchWikitext("2026_FIFA_World_Cup_final");
    const boxes = extractFootballBoxes(wt);
    return boxes
      .map((fields, idx) =>
        toMatchDoc(fields, {
          stage: "FINAL",
          stageLabel: "Final",
          externalId: `FINAL-${idx + 1}`,
        }),
      )
      .filter((d): d is MatchDoc => d != null);
  } catch {
    return [];
  }
}

export async function fetchMatchesFromWikipedia(): Promise<MatchDoc[]> {
  const groupResults = await Promise.all(
    GROUP_KEYS.map((letter) => parseGroupPage(letter)),
  );
  const knockout = await parseKnockoutPage();
  const final = await parseFinalPage();
  return [...groupResults.flat(), ...knockout, ...final];
}
