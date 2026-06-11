export type Team = { code: string; name: string };
export type Match = {
  id: string;
  group: string;
  matchday: 1 | 2 | 3;
  date: string;
  time: string;
  venue: string;
  city: string;
  home: Team;
  away: Team;
};

const TEAM_DATA: Record<string, [string, string][]> = {
  A: [
    ["mx", "México"],
    ["za", "Sudáfrica"],
    ["kr", "Corea del Sur"],
    ["cz", "República Checa"],
  ],
  B: [
    ["ca", "Canadá"],
    ["ba", "Bosnia y Herzegovina"],
    ["qa", "Catar"],
    ["ch", "Suiza"],
  ],
  C: [
    ["br", "Brasil"],
    ["ma", "Marruecos"],
    ["ht", "Haití"],
    ["gb-sct", "Escocia"],
  ],
  D: [
    ["us", "Estados Unidos"],
    ["py", "Paraguay"],
    ["au", "Australia"],
    ["tr", "Turquía"],
  ],
  E: [
    ["de", "Alemania"],
    ["cw", "Curazao"],
    ["ci", "Costa de Marfil"],
    ["ec", "Ecuador"],
  ],
  F: [
    ["nl", "Países Bajos"],
    ["jp", "Japón"],
    ["se", "Suecia"],
    ["tn", "Túnez"],
  ],
  G: [
    ["be", "Bélgica"],
    ["eg", "Egipto"],
    ["ir", "Irán"],
    ["nz", "Nueva Zelanda"],
  ],
  H: [
    ["es", "España"],
    ["cv", "Cabo Verde"],
    ["sa", "Arabia Saudita"],
    ["uy", "Uruguay"],
  ],
  I: [
    ["fr", "Francia"],
    ["sn", "Senegal"],
    ["iq", "Irak"],
    ["no", "Noruega"],
  ],
  J: [
    ["ar", "Argentina"],
    ["dz", "Argelia"],
    ["at", "Austria"],
    ["jo", "Jordania"],
  ],
  K: [
    ["pt", "Portugal"],
    ["cd", "RD del Congo"],
    ["uz", "Uzbekistán"],
    ["co", "Colombia"],
  ],
  L: [
    ["gb-eng", "Inglaterra"],
    ["hr", "Croacia"],
    ["gh", "Ghana"],
    ["pa", "Panamá"],
  ],
};

type MatchDef = {
  group: string;
  matchday: 1 | 2 | 3;
  date: string;
  time: string;
  venue: string;
  city: string;
  home: [string, string];
  away: [string, string];
};

const SCHEDULE: MatchDef[] = [
  // ── Group A ──
  { group: "A", matchday: 1, date: "2026-06-11", time: "14:00", venue: "Estadio Azteca", city: "Ciudad de México", home: ["mx", "México"], away: ["za", "Sudáfrica"] },
  { group: "A", matchday: 1, date: "2026-06-11", time: "21:00", venue: "Estadio Akron", city: "Zapopan", home: ["kr", "Corea del Sur"], away: ["cz", "República Checa"] },
  { group: "A", matchday: 2, date: "2026-06-18", time: "11:00", venue: "Mercedes-Benz Stadium", city: "Atlanta", home: ["cz", "República Checa"], away: ["za", "Sudáfrica"] },
  { group: "A", matchday: 2, date: "2026-06-18", time: "20:00", venue: "Estadio Akron", city: "Zapopan", home: ["mx", "México"], away: ["kr", "Corea del Sur"] },
  { group: "A", matchday: 3, date: "2026-06-24", time: "20:00", venue: "Estadio Azteca", city: "Ciudad de México", home: ["cz", "República Checa"], away: ["mx", "México"] },
  { group: "A", matchday: 3, date: "2026-06-24", time: "20:00", venue: "Estadio BBVA", city: "Monterrey", home: ["za", "Sudáfrica"], away: ["kr", "Corea del Sur"] },

  // ── Group B ──
  { group: "B", matchday: 1, date: "2026-06-12", time: "14:00", venue: "BMO Field", city: "Toronto", home: ["ca", "Canadá"], away: ["ba", "Bosnia y Herzegovina"] },
  { group: "B", matchday: 1, date: "2026-06-13", time: "14:00", venue: "Levi's Stadium", city: "Santa Clara, CA", home: ["qa", "Catar"], away: ["ch", "Suiza"] },
  { group: "B", matchday: 2, date: "2026-06-18", time: "14:00", venue: "SoFi Stadium", city: "Los Ángeles", home: ["ch", "Suiza"], away: ["ba", "Bosnia y Herzegovina"] },
  { group: "B", matchday: 2, date: "2026-06-18", time: "17:00", venue: "BC Place", city: "Vancouver", home: ["ca", "Canadá"], away: ["qa", "Catar"] },
  { group: "B", matchday: 3, date: "2026-06-24", time: "14:00", venue: "BC Place", city: "Vancouver", home: ["ch", "Suiza"], away: ["ca", "Canadá"] },
  { group: "B", matchday: 3, date: "2026-06-24", time: "14:00", venue: "Lumen Field", city: "Seattle", home: ["ba", "Bosnia y Herzegovina"], away: ["qa", "Catar"] },

  // ── Group C ──
  { group: "C", matchday: 1, date: "2026-06-13", time: "17:00", venue: "MetLife Stadium", city: "East Rutherford, NJ", home: ["br", "Brasil"], away: ["ma", "Marruecos"] },
  { group: "C", matchday: 1, date: "2026-06-13", time: "20:00", venue: "Gillette Stadium", city: "Foxborough, MA", home: ["ht", "Haití"], away: ["gb-sct", "Escocia"] },
  { group: "C", matchday: 2, date: "2026-06-19", time: "17:00", venue: "Gillette Stadium", city: "Foxborough, MA", home: ["gb-sct", "Escocia"], away: ["ma", "Marruecos"] },
  { group: "C", matchday: 2, date: "2026-06-19", time: "19:30", venue: "Lincoln Financial Field", city: "Filadelfia", home: ["br", "Brasil"], away: ["ht", "Haití"] },
  { group: "C", matchday: 3, date: "2026-06-24", time: "17:00", venue: "Hard Rock Stadium", city: "Miami Gardens, FL", home: ["gb-sct", "Escocia"], away: ["br", "Brasil"] },
  { group: "C", matchday: 3, date: "2026-06-24", time: "17:00", venue: "Mercedes-Benz Stadium", city: "Atlanta", home: ["ma", "Marruecos"], away: ["ht", "Haití"] },

  // ── Group D ──
  { group: "D", matchday: 1, date: "2026-06-12", time: "20:00", venue: "SoFi Stadium", city: "Los Ángeles", home: ["us", "Estados Unidos"], away: ["py", "Paraguay"] },
  { group: "D", matchday: 1, date: "2026-06-13", time: "23:00", venue: "BC Place", city: "Vancouver", home: ["au", "Australia"], away: ["tr", "Turquía"] },
  { group: "D", matchday: 2, date: "2026-06-19", time: "14:00", venue: "Lumen Field", city: "Seattle", home: ["us", "Estados Unidos"], away: ["au", "Australia"] },
  { group: "D", matchday: 2, date: "2026-06-19", time: "22:00", venue: "Levi's Stadium", city: "Santa Clara, CA", home: ["tr", "Turquía"], away: ["py", "Paraguay"] },
  { group: "D", matchday: 3, date: "2026-06-25", time: "21:00", venue: "SoFi Stadium", city: "Los Ángeles", home: ["tr", "Turquía"], away: ["us", "Estados Unidos"] },
  { group: "D", matchday: 3, date: "2026-06-25", time: "21:00", venue: "Levi's Stadium", city: "Santa Clara, CA", home: ["py", "Paraguay"], away: ["au", "Australia"] },

  // ── Group E ──
  { group: "E", matchday: 1, date: "2026-06-14", time: "12:00", venue: "NRG Stadium", city: "Houston", home: ["de", "Alemania"], away: ["cw", "Curazao"] },
  { group: "E", matchday: 1, date: "2026-06-14", time: "18:00", venue: "Lincoln Financial Field", city: "Filadelfia", home: ["ci", "Costa de Marfil"], away: ["ec", "Ecuador"] },
  { group: "E", matchday: 2, date: "2026-06-20", time: "15:00", venue: "BMO Field", city: "Toronto", home: ["de", "Alemania"], away: ["ci", "Costa de Marfil"] },
  { group: "E", matchday: 2, date: "2026-06-20", time: "19:00", venue: "Arrowhead Stadium", city: "Kansas City, MO", home: ["ec", "Ecuador"], away: ["cw", "Curazao"] },
  { group: "E", matchday: 3, date: "2026-06-25", time: "15:00", venue: "Lincoln Financial Field", city: "Filadelfia", home: ["cw", "Curazao"], away: ["ci", "Costa de Marfil"] },
  { group: "E", matchday: 3, date: "2026-06-25", time: "15:00", venue: "MetLife Stadium", city: "East Rutherford, NJ", home: ["ec", "Ecuador"], away: ["de", "Alemania"] },

  // ── Group F ──
  { group: "F", matchday: 1, date: "2026-06-14", time: "15:00", venue: "AT&T Stadium", city: "Arlington, TX", home: ["nl", "Países Bajos"], away: ["jp", "Japón"] },
  { group: "F", matchday: 1, date: "2026-06-14", time: "21:00", venue: "Estadio BBVA", city: "Monterrey", home: ["se", "Suecia"], away: ["tn", "Túnez"] },
  { group: "F", matchday: 2, date: "2026-06-20", time: "12:00", venue: "NRG Stadium", city: "Houston", home: ["nl", "Países Bajos"], away: ["se", "Suecia"] },
  { group: "F", matchday: 2, date: "2026-06-20", time: "23:00", venue: "Estadio BBVA", city: "Monterrey", home: ["tn", "Túnez"], away: ["jp", "Japón"] },
  { group: "F", matchday: 3, date: "2026-06-25", time: "18:00", venue: "AT&T Stadium", city: "Arlington, TX", home: ["jp", "Japón"], away: ["se", "Suecia"] },
  { group: "F", matchday: 3, date: "2026-06-25", time: "18:00", venue: "Arrowhead Stadium", city: "Kansas City, MO", home: ["tn", "Túnez"], away: ["nl", "Países Bajos"] },

  // ── Group G ──
  { group: "G", matchday: 1, date: "2026-06-15", time: "14:00", venue: "Lumen Field", city: "Seattle", home: ["be", "Bélgica"], away: ["eg", "Egipto"] },
  { group: "G", matchday: 1, date: "2026-06-15", time: "20:00", venue: "SoFi Stadium", city: "Los Ángeles", home: ["ir", "Irán"], away: ["nz", "Nueva Zelanda"] },
  { group: "G", matchday: 2, date: "2026-06-21", time: "14:00", venue: "SoFi Stadium", city: "Los Ángeles", home: ["be", "Bélgica"], away: ["ir", "Irán"] },
  { group: "G", matchday: 2, date: "2026-06-21", time: "20:00", venue: "BC Place", city: "Vancouver", home: ["nz", "Nueva Zelanda"], away: ["eg", "Egipto"] },
  { group: "G", matchday: 3, date: "2026-06-26", time: "22:00", venue: "Lumen Field", city: "Seattle", home: ["eg", "Egipto"], away: ["ir", "Irán"] },
  { group: "G", matchday: 3, date: "2026-06-26", time: "22:00", venue: "BC Place", city: "Vancouver", home: ["nz", "Nueva Zelanda"], away: ["be", "Bélgica"] },

  // ── Group H ──
  { group: "H", matchday: 1, date: "2026-06-15", time: "11:00", venue: "Mercedes-Benz Stadium", city: "Atlanta", home: ["es", "España"], away: ["cv", "Cabo Verde"] },
  { group: "H", matchday: 1, date: "2026-06-15", time: "17:00", venue: "Hard Rock Stadium", city: "Miami Gardens, FL", home: ["sa", "Arabia Saudita"], away: ["uy", "Uruguay"] },
  { group: "H", matchday: 2, date: "2026-06-21", time: "11:00", venue: "Mercedes-Benz Stadium", city: "Atlanta", home: ["es", "España"], away: ["sa", "Arabia Saudita"] },
  { group: "H", matchday: 2, date: "2026-06-21", time: "17:00", venue: "Hard Rock Stadium", city: "Miami Gardens, FL", home: ["uy", "Uruguay"], away: ["cv", "Cabo Verde"] },
  { group: "H", matchday: 3, date: "2026-06-26", time: "19:00", venue: "NRG Stadium", city: "Houston", home: ["cv", "Cabo Verde"], away: ["sa", "Arabia Saudita"] },
  { group: "H", matchday: 3, date: "2026-06-26", time: "19:00", venue: "Estadio Akron", city: "Zapopan", home: ["uy", "Uruguay"], away: ["es", "España"] },

  // ── Group I ──
  { group: "I", matchday: 1, date: "2026-06-16", time: "14:00", venue: "MetLife Stadium", city: "East Rutherford, NJ", home: ["fr", "Francia"], away: ["sn", "Senegal"] },
  { group: "I", matchday: 1, date: "2026-06-16", time: "17:00", venue: "Gillette Stadium", city: "Foxborough, MA", home: ["iq", "Irak"], away: ["no", "Noruega"] },
  { group: "I", matchday: 2, date: "2026-06-22", time: "16:00", venue: "Lincoln Financial Field", city: "Filadelfia", home: ["fr", "Francia"], away: ["iq", "Irak"] },
  { group: "I", matchday: 2, date: "2026-06-22", time: "19:00", venue: "MetLife Stadium", city: "East Rutherford, NJ", home: ["no", "Noruega"], away: ["sn", "Senegal"] },
  { group: "I", matchday: 3, date: "2026-06-26", time: "14:00", venue: "Gillette Stadium", city: "Foxborough, MA", home: ["no", "Noruega"], away: ["fr", "Francia"] },
  { group: "I", matchday: 3, date: "2026-06-26", time: "14:00", venue: "BMO Field", city: "Toronto", home: ["sn", "Senegal"], away: ["iq", "Irak"] },

  // ── Group J ──
  { group: "J", matchday: 1, date: "2026-06-16", time: "20:00", venue: "Arrowhead Stadium", city: "Kansas City, MO", home: ["ar", "Argentina"], away: ["dz", "Argelia"] },
  { group: "J", matchday: 1, date: "2026-06-16", time: "23:00", venue: "Levi's Stadium", city: "Santa Clara, CA", home: ["at", "Austria"], away: ["jo", "Jordania"] },
  { group: "J", matchday: 2, date: "2026-06-22", time: "12:00", venue: "AT&T Stadium", city: "Arlington, TX", home: ["ar", "Argentina"], away: ["at", "Austria"] },
  { group: "J", matchday: 2, date: "2026-06-22", time: "22:00", venue: "Levi's Stadium", city: "Santa Clara, CA", home: ["jo", "Jordania"], away: ["dz", "Argelia"] },
  { group: "J", matchday: 3, date: "2026-06-27", time: "21:00", venue: "Arrowhead Stadium", city: "Kansas City, MO", home: ["dz", "Argelia"], away: ["at", "Austria"] },
  { group: "J", matchday: 3, date: "2026-06-27", time: "21:00", venue: "AT&T Stadium", city: "Arlington, TX", home: ["jo", "Jordania"], away: ["ar", "Argentina"] },

  // ── Group K ──
  { group: "K", matchday: 1, date: "2026-06-17", time: "12:00", venue: "NRG Stadium", city: "Houston", home: ["pt", "Portugal"], away: ["cd", "RD del Congo"] },
  { group: "K", matchday: 1, date: "2026-06-17", time: "21:00", venue: "Estadio Azteca", city: "Ciudad de México", home: ["uz", "Uzbekistán"], away: ["co", "Colombia"] },
  { group: "K", matchday: 2, date: "2026-06-23", time: "12:00", venue: "NRG Stadium", city: "Houston", home: ["pt", "Portugal"], away: ["uz", "Uzbekistán"] },
  { group: "K", matchday: 2, date: "2026-06-23", time: "21:00", venue: "Estadio Akron", city: "Zapopan", home: ["co", "Colombia"], away: ["cd", "RD del Congo"] },
  { group: "K", matchday: 3, date: "2026-06-27", time: "18:30", venue: "Hard Rock Stadium", city: "Miami Gardens, FL", home: ["co", "Colombia"], away: ["pt", "Portugal"] },
  { group: "K", matchday: 3, date: "2026-06-27", time: "18:30", venue: "Mercedes-Benz Stadium", city: "Atlanta", home: ["cd", "RD del Congo"], away: ["uz", "Uzbekistán"] },

  // ── Group L ──
  { group: "L", matchday: 1, date: "2026-06-17", time: "15:00", venue: "AT&T Stadium", city: "Arlington, TX", home: ["gb-eng", "Inglaterra"], away: ["hr", "Croacia"] },
  { group: "L", matchday: 1, date: "2026-06-17", time: "18:00", venue: "BMO Field", city: "Toronto", home: ["gh", "Ghana"], away: ["pa", "Panamá"] },
  { group: "L", matchday: 2, date: "2026-06-23", time: "15:00", venue: "Gillette Stadium", city: "Foxborough, MA", home: ["gb-eng", "Inglaterra"], away: ["gh", "Ghana"] },
  { group: "L", matchday: 2, date: "2026-06-23", time: "18:00", venue: "BMO Field", city: "Toronto", home: ["pa", "Panamá"], away: ["hr", "Croacia"] },
  { group: "L", matchday: 3, date: "2026-06-27", time: "16:00", venue: "MetLife Stadium", city: "East Rutherford, NJ", home: ["pa", "Panamá"], away: ["gb-eng", "Inglaterra"] },
  { group: "L", matchday: 3, date: "2026-06-27", time: "16:00", venue: "Lincoln Financial Field", city: "Filadelfia", home: ["hr", "Croacia"], away: ["gh", "Ghana"] },
];

function buildMatches(): Match[] {
  return SCHEDULE.map((m) => ({
    id: `${m.group}${m.matchday}-${m.home[0]}-${m.away[0]}`,
    group: m.group,
    matchday: m.matchday,
    date: m.date,
    time: m.time,
    venue: m.venue,
    city: m.city,
    home: { code: m.home[0], name: m.home[1] },
    away: { code: m.away[0], name: m.away[1] },
  }));
}

export const matches: Match[] = buildMatches();
export const teamsByGroup: Record<string, Team[]> = Object.fromEntries(
  Object.entries(TEAM_DATA).map(([k, arr]) => [
    k,
    arr.map(([code, name]) => ({ code, name })),
  ]),
);
export const groupKeys = Object.keys(TEAM_DATA);

export function flagSrc(code: string, w: 40 | 80 | 160 = 80): string {
  return `https://flagcdn.com/w${w}/${code}.png`;
}

export function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
  ];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}
