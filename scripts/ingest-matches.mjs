import { MongoClient } from "mongodb";

const {
  MONGODB_URI,
  MONGODB_DB = "polla_inter",
  FOOTBALL_DATA_API_KEY,
} = process.env;

if (!MONGODB_URI) {
  console.error(
    "Missing MONGODB_URI. Run with:\n  node --env-file=.env.local scripts/ingest-matches.mjs",
  );
  process.exit(1);
}

const STAGE_LABELS = {
  GROUP_STAGE: "Fase de Grupos",
  PLAYOFFS: "Repechaje",
  ROUND_OF_32: "Dieciseisavos",
  LAST_16: "Octavos",
  ROUND_OF_16: "Octavos",
  QUARTER_FINALS: "Cuartos",
  SEMI_FINALS: "Semifinal",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final",
};

async function fetchFromFootballData(apiKey) {
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches",
    { headers: { "X-Auth-Token": apiKey } },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `football-data.org responded ${res.status}: ${txt.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  return (json.matches ?? []).map((m) => {
    const utc = new Date(m.utcDate);
    return {
      _id: String(m.id),
      externalId: m.id,
      source: "football-data",
      utcDate: m.utcDate,
      date: utc.toISOString().slice(0, 10),
      time: utc.toISOString().slice(11, 16),
      status: m.status,
      stage: m.stage,
      stageLabel: STAGE_LABELS[m.stage] ?? m.stage,
      group: m.group ? m.group.replace(/^GROUP_/, "") : null,
      matchday: m.matchday ?? null,
      venue: m.venue ?? "",
      home: {
        name: m.homeTeam?.name ?? "TBD",
        tla: m.homeTeam?.tla ?? "",
        crest: m.homeTeam?.crest ?? "",
      },
      away: {
        name: m.awayTeam?.name ?? "TBD",
        tla: m.awayTeam?.tla ?? "",
        crest: m.awayTeam?.crest ?? "",
      },
    };
  });
}

async function fetchFromSportsDB() {
  // FIFA World Cup leagueId in TheSportsDB = 4429. Free public test key = "3".
  const res = await fetch(
    "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026",
  );
  if (!res.ok) throw new Error(`thesportsdb responded ${res.status}`);
  const json = await res.json();
  const events = json.events ?? [];
  return events.map((e) => {
    const date = e.dateEvent ?? "";
    const time = (e.strTime ?? "").slice(0, 5);
    return {
      _id: String(e.idEvent),
      externalId: e.idEvent,
      source: "thesportsdb",
      utcDate: `${date}T${time || "00:00"}:00Z`,
      date,
      time,
      status: "SCHEDULED",
      stage: e.strStage ?? "GROUP_STAGE",
      stageLabel: STAGE_LABELS[e.strStage] ?? e.strStage ?? "Fase de Grupos",
      group: e.strGroup ?? null,
      matchday: e.intRound ? Number(e.intRound) : null,
      venue: e.strVenue ?? "",
      home: {
        name: e.strHomeTeam,
        tla: "",
        crest: e.strHomeTeamBadge ?? "",
      },
      away: {
        name: e.strAwayTeam,
        tla: "",
        crest: e.strAwayTeamBadge ?? "",
      },
    };
  });
}

async function main() {
  let docs = [];
  let source = "";

  if (FOOTBALL_DATA_API_KEY) {
    console.log("Fetching from football-data.org…");
    docs = await fetchFromFootballData(FOOTBALL_DATA_API_KEY);
    source = "football-data.org";
  } else {
    console.log(
      "FOOTBALL_DATA_API_KEY not set — falling back to TheSportsDB (free, no key)…",
    );
    docs = await fetchFromSportsDB();
    source = "thesportsdb.com";
  }

  console.log(`Got ${docs.length} matches from ${source}.`);

  if (!docs.length) {
    console.warn(
      `\nNo matches were returned. The 2026 World Cup schedule may not be populated by this provider yet.\n` +
        `For best results, sign up for a free key at https://www.football-data.org/client/register\n` +
        `then add FOOTBALL_DATA_API_KEY to .env.local and run again.\n`,
    );
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(MONGODB_DB);
    const col = db.collection("matches");
    let upserts = 0;
    for (const d of docs) {
      await col.replaceOne({ _id: d._id }, d, { upsert: true });
      upserts++;
    }
    await col.createIndex({ utcDate: 1 });
    await col.createIndex({ stage: 1, group: 1, matchday: 1 });
    console.log(
      `Upserted ${upserts} matches into ${MONGODB_DB}.matches (source: ${source}).`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
