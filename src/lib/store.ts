import "server-only";
import {
  matchesCollection,
  predictionsCollection,
  usersCollection,
} from "./mongodb";
import { buildMatchSeed } from "./seed-data";
import { migratePrediction, KNOCKOUT_BRACKET_VERSION } from "./bracket";
import type { MatchDoc, PredictionDoc, UserDoc } from "./types";

// Bring any stored predictions onto the current bracket version (intent preserved)
// and persist the result. Runs at most once per prediction: once stamped, the
// version check short-circuits and no DB work happens. Returns migrated copies so
// every read path serves a correct bracket without a manual migration step.
async function applyMigration(
  preds: PredictionDoc[],
): Promise<PredictionDoc[]> {
  const stale = preds.filter(
    (p) => p.bracketVersion !== KNOCKOUT_BRACKET_VERSION,
  );
  if (stale.length === 0) return preds;

  const groupMatches = (await getAllMatches()).filter(
    (m) => m.stage === "GROUP_STAGE",
  );
  const col = await predictionsCollection();
  const migrated = new Map<string, PredictionDoc>();
  for (const p of stale) {
    const { prediction, changed } = migratePrediction(p, groupMatches);
    if (changed) {
      await col.replaceOne({ _id: prediction._id }, prediction, {
        upsert: true,
      });
    }
    migrated.set(p._id, prediction);
  }
  return preds.map((p) => migrated.get(p._id) ?? p);
}

async function ensureMatchesSeeded(): Promise<void> {
  const col = await matchesCollection();
  const count = await col.estimatedDocumentCount();
  if (count > 0) return;
  const docs = buildMatchSeed();
  if (docs.length === 0) return;
  await col.insertMany(docs);
  await col.createIndex({ utcDate: 1 });
  await col.createIndex({ stage: 1, group: 1, matchday: 1 });
}

async function ensureUsersIndex(): Promise<void> {
  const col = await usersCollection();
  await col.createIndex({ email: 1 }, { unique: true });
}

export async function getAllMatches(): Promise<MatchDoc[]> {
  await ensureMatchesSeeded();
  const col = await matchesCollection();
  return col.find({}).sort({ utcDate: 1 }).toArray();
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<UserDoc | null> {
  const col = await usersCollection();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPw = password.trim();
  return col.findOne({ email: cleanEmail, password: cleanPw });
}

export async function listAllUsers(): Promise<UserDoc[]> {
  const col = await usersCollection();
  return col.find({}).sort({ createdAt: -1 }).toArray();
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  attemptsAllowed: number;
}): Promise<UserDoc> {
  await ensureUsersIndex();
  const col = await usersCollection();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const doc: UserDoc = {
    _id: email,
    email,
    password,
    name: input.name.trim(),
    attemptsAllowed: Math.max(1, Math.min(20, Math.floor(input.attemptsAllowed))),
    createdAt: new Date(),
  };
  await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
  return doc;
}

export async function deleteUser(email: string): Promise<boolean> {
  const col = await usersCollection();
  const result = await col.deleteOne({ email: email.trim().toLowerCase() });
  if (result.deletedCount > 0) {
    const pred = await predictionsCollection();
    await pred.deleteMany({ userEmail: email.trim().toLowerCase() });
  }
  return result.deletedCount > 0;
}

export async function updateUserAttempts(
  email: string,
  attemptsAllowed: number,
): Promise<boolean> {
  const col = await usersCollection();
  const result = await col.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { attemptsAllowed: Math.max(1, Math.min(20, Math.floor(attemptsAllowed))) } },
  );
  return result.modifiedCount > 0;
}

export async function getUserByEmail(email: string): Promise<UserDoc | null> {
  const col = await usersCollection();
  return col.findOne({ email: email.trim().toLowerCase() });
}

export async function listPredictionsForUser(
  email: string,
): Promise<PredictionDoc[]> {
  const col = await predictionsCollection();
  const preds = await col
    .find({ userEmail: email.trim().toLowerCase() })
    .sort({ attempt: 1 })
    .toArray();
  return applyMigration(preds);
}

export async function listAllPredictions(): Promise<PredictionDoc[]> {
  const col = await predictionsCollection();
  const preds = await col.find({}).toArray();
  return applyMigration(preds);
}

export async function getPrediction(
  email: string,
  attempt: number,
): Promise<PredictionDoc | null> {
  const col = await predictionsCollection();
  const pred = await col.findOne({
    userEmail: email.trim().toLowerCase(),
    attempt,
  });
  if (!pred) return null;
  const [migrated] = await applyMigration([pred]);
  return migrated;
}

export async function upsertPrediction(doc: PredictionDoc): Promise<void> {
  const col = await predictionsCollection();
  await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
}

// Hard cutoff for filling/editing predictions, independent of the schedule.
// 1:00 PM Colombia time (UTC-5) on June 11 2026 == 18:00 UTC.
export const PREDICTION_DEADLINE_UTC = "2026-06-11T18:00:00Z";

export async function isTournamentLocked(): Promise<boolean> {
  const deadline = new Date(PREDICTION_DEADLINE_UTC).getTime();
  // Never allow edits past the first kickoff either — whichever comes first wins.
  const col = await matchesCollection();
  const first = await col
    .find({ stage: "GROUP_STAGE" })
    .sort({ utcDate: 1 })
    .limit(1)
    .toArray();
  const firstKickoff = first.length
    ? new Date(first[0].utcDate).getTime()
    : Number.POSITIVE_INFINITY;
  return Date.now() >= Math.min(deadline, firstKickoff);
}
