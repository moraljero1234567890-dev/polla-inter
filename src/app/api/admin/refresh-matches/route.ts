import { NextResponse, type NextRequest } from "next/server";
import { matchesCollection } from "@/lib/mongodb";
import { fetchLatestFromConfiguredProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const got =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  return got === expected;
}

async function handleRefresh(): Promise<Response> {
  let provider;
  try {
    provider = await fetchLatestFromConfiguredProvider();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provider error" },
      { status: 502 },
    );
  }

  if (!provider.docs.length) {
    return NextResponse.json(
      {
        source: provider.source,
        upserts: 0,
        warning: "Provider returned 0 matches",
      },
      { status: 200 },
    );
  }

  const col = await matchesCollection();
  await col.deleteMany({});
  await col.insertMany(provider.docs);
  await col.createIndex({ utcDate: 1 });
  await col.createIndex({ stage: 1, group: 1, matchday: 1 });

  return NextResponse.json({ source: provider.source, upserts: provider.docs.length });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRefresh();
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRefresh();
}
