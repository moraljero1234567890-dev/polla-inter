import { matches as staticMatches, flagSrc } from "@/data/worldcup2026";
import { seedUsers } from "@/data/users";
import type { MatchDoc, UserDoc } from "./types";

export function buildMatchSeed(): MatchDoc[] {
  return staticMatches.map((m) => {
    const utcDate = `${m.date}T${m.time}:00Z`;
    return {
      _id: m.id,
      source: "dummy",
      utcDate,
      date: m.date,
      time: m.time,
      status: "SCHEDULED",
      stage: "GROUP_STAGE",
      stageLabel: "Fase de Grupos",
      group: m.group,
      matchday: m.matchday,
      venue: m.venue,
      city: m.city,
      home: {
        code: m.home.code,
        name: m.home.name,
        crest: flagSrc(m.home.code, 80),
      },
      away: {
        code: m.away.code,
        name: m.away.name,
        crest: flagSrc(m.away.code, 80),
      },
      score: null,
    };
  });
}

export function buildUserSeed(): UserDoc[] {
  const now = new Date();
  return seedUsers.map((u) => ({
    _id: u.email.toLowerCase(),
    email: u.email.toLowerCase(),
    password: u.password,
    name: u.name,
    attemptsAllowed: 1,
    createdAt: now,
  }));
}
