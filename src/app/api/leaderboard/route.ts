import { NextResponse, after } from "next/server";
import { computeLeaderboard } from "@/lib/scoring";
import { maybeAutoRefresh } from "@/lib/refresh";
import {
  getAllMatches,
  listAllPredictions,
  listAllUsers,
} from "@/lib/store";

export const dynamic = "force-dynamic";

// Public (logged-in user) leaderboard. Mirrors the trust-the-client model used
// by /api/predictions: any participant can see how everyone is performing.
// Only non-sensitive fields are returned (no credentials).
export async function GET() {
  try {
    const [matches, predictions, users] = await Promise.all([
      getAllMatches(),
      listAllPredictions(),
      listAllUsers(),
    ]);
    // Pull fresh scores AFTER this response is sent (throttled, at most once per
    // window across all visitors, lock-guarded). The next visitor sees the new
    // data — keeps the page fast and avoids the platform timeout on slow
    // providers like Wikipedia.
    after(() => maybeAutoRefresh(matches));
    const full = computeLeaderboard(
      matches,
      predictions,
      users.map((u) => ({
        email: u.email,
        name: u.name,
        attemptsAllowed: u.attemptsAllowed,
      })),
    );
    const rows = full.map((r, i) => ({
      rank: i + 1,
      email: r.email,
      name: r.name,
      attempt: r.attempt,
      attemptsAllowed: r.attemptsAllowed,
      total: r.breakdown.total,
      groupPoints: r.breakdown.group.points,
      knockoutPoints: r.breakdown.knockout.points,
    }));
    const finishedMatches = matches.filter((m) => m.status === "FINISHED").length;
    return NextResponse.json({
      rows,
      stats: {
        totalParticipants: rows.length,
        finishedMatches,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { error: "Database error", detail: msg },
      { status: 500 },
    );
  }
}
