import { NextResponse, type NextRequest } from "next/server";
import { refreshMatches } from "@/lib/refresh";

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
  let result;
  try {
    result = await refreshMatches();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provider error" },
      { status: 502 },
    );
  }

  // upserts kept for backwards compatibility with the admin UI; `skipped`
  // explains the no-op cases (provider empty, refused source switch, …).
  return NextResponse.json({
    source: result.source,
    upserts: result.updated,
    skipped: result.skipped ?? null,
  });
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
