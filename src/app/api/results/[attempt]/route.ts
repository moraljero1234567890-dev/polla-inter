import { NextResponse, type NextRequest } from "next/server";
import { getAllMatches, getPrediction, getUserByEmail } from "@/lib/store";
import { scorePredictionDetail } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type Params = { attempt: string };

function parseAttempt(value: string): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  return n;
}

// Returns the per-match points detail (predicted vs actual vs points) for one
// user's attempt, so the results page can show what each pick scored.
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { attempt: rawAttempt } = await ctx.params;
  const attempt = parseAttempt(rawAttempt);
  if (attempt == null) {
    return NextResponse.json({ error: "Invalid attempt" }, { status: 400 });
  }
  const email = (request.nextUrl.searchParams.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  }

  const prediction = await getPrediction(email, attempt);
  if (!prediction) {
    return NextResponse.json({ error: "No prediction" }, { status: 404 });
  }

  const matches = await getAllMatches();
  const detail = scorePredictionDetail(matches, prediction);
  return NextResponse.json({ detail });
}
