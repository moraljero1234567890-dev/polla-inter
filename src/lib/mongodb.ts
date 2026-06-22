import { MongoClient, type Db, type Collection } from "mongodb";
import type { MatchDoc, PredictionDoc, UserDoc } from "./types";

// Bookkeeping singletons keyed by a string _id (e.g. the auto-refresh lock).
export type MetaDoc = {
  _id: string;
  lastAttemptAt?: Date;
  lastSuccessAt?: Date;
  lastSource?: string | null;
  lastSkipped?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) return global._mongoClientPromise;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Set it in your environment (Vercel) before calling the API.",
    );
  }
  const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
  });
  global._mongoClientPromise = client.connect();
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const dbName = process.env.MONGODB_DB ?? "polla_inter";
  const client = await getClientPromise();
  return client.db(dbName);
}

export async function matchesCollection(): Promise<Collection<MatchDoc>> {
  const db = await getDb();
  return db.collection<MatchDoc>("matches");
}

export async function usersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function predictionsCollection(): Promise<
  Collection<PredictionDoc>
> {
  const db = await getDb();
  return db.collection<PredictionDoc>("predictions");
}

// Small key/value collection for bookkeeping (e.g. the auto-refresh throttle
// lock). Holds a handful of singleton docs keyed by a string _id.
export async function metaCollection(): Promise<Collection<MetaDoc>> {
  const db = await getDb();
  return db.collection<MetaDoc>("meta");
}

export default getClientPromise;
