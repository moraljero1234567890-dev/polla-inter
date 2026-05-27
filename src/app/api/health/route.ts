import { NextResponse } from "next/server";
import {
  matchesCollection,
  predictionsCollection,
  usersCollection,
} from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasMongoUri = Boolean(process.env.MONGODB_URI);
  const hasMongoDb = Boolean(process.env.MONGODB_DB);
  const hasAdminToken = Boolean(process.env.ADMIN_TOKEN);
  const hasApiFootball = Boolean(process.env.API_FOOTBALL_KEY);
  const hasFootballData = Boolean(process.env.FOOTBALL_DATA_API_KEY);

  const env = {
    MONGODB_URI: hasMongoUri ? "set" : "missing",
    MONGODB_DB: hasMongoDb
      ? (process.env.MONGODB_DB as string)
      : "missing (will default to polla_inter)",
    ADMIN_TOKEN: hasAdminToken ? "set" : "missing",
    API_FOOTBALL_KEY: hasApiFootball ? "set" : "not set (ok, optional)",
    FOOTBALL_DATA_API_KEY: hasFootballData ? "set" : "not set (ok, optional)",
    provider_fallback: hasApiFootball
      ? "api-sports"
      : hasFootballData
        ? "football-data"
        : "wikipedia",
  };

  if (!hasMongoUri) {
    return NextResponse.json(
      {
        ok: false,
        env,
        error:
          "MONGODB_URI is not set in this environment. Add it in Vercel → Project Settings → Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  try {
    const [matches, users, predictions] = await Promise.all([
      matchesCollection(),
      usersCollection(),
      predictionsCollection(),
    ]);
    const [matchCount, userCount, predictionCount] = await Promise.all([
      matches.estimatedDocumentCount(),
      users.estimatedDocumentCount(),
      predictions.estimatedDocumentCount(),
    ]);
    return NextResponse.json({
      ok: true,
      env,
      counts: {
        matches: matchCount,
        users: userCount,
        predictions: predictionCount,
      },
      note:
        matchCount === 0
          ? "matches collection is empty — it lazy-seeds on first GET /api/matches"
          : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let hint = "";
    if (/ENOTFOUND|getaddrinfo|EAI/i.test(msg)) {
      hint = "DNS resolution failed — likely a typo in the MONGODB_URI host.";
    } else if (/Authentication failed|authentication/i.test(msg)) {
      hint = "Wrong username or password in MONGODB_URI.";
    } else if (/IP|whitelist|not allowed|connection.*refused/i.test(msg)) {
      hint =
        "MongoDB Atlas is rejecting Vercel's IP. Go to Atlas → Network Access → Add IP → 0.0.0.0/0 (allow from anywhere).";
    } else if (/ServerSelectionTimeoutError|topology/i.test(msg)) {
      hint =
        "Could not reach the cluster. Check the host in MONGODB_URI, and confirm Atlas Network Access allows 0.0.0.0/0.";
    }
    return NextResponse.json(
      {
        ok: false,
        env,
        error: msg,
        hint: hint || "Check Vercel function logs for the full stack trace.",
      },
      { status: 500 },
    );
  }
}
