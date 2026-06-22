import { NextResponse, after } from "next/server";
import { getAllMatches } from "@/lib/store";
import { maybeAutoRefresh } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await getAllMatches();
    // Refresh scores after the response is sent (throttled + lock-guarded).
    after(() => maybeAutoRefresh(matches));
    return NextResponse.json({ matches, count: matches.length });
  } catch (error) {
    return NextResponse.json(
      {
        matches: [],
        count: 0,
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
