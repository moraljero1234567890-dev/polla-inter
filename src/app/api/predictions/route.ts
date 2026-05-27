import { NextResponse } from "next/server";
import {
  getUserByEmail,
  listPredictionsForUser,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  }
  const predictions = await listPredictionsForUser(email);
  return NextResponse.json({
    user: {
      email: user.email,
      name: user.name,
      attemptsAllowed: user.attemptsAllowed,
    },
    predictions: predictions.map((p) => ({
      attempt: p.attempt,
      status: p.status,
      champion: p.champion,
      updatedAt: p.updatedAt,
      completedAt: p.completedAt,
      groupCount: Object.keys(p.groupScores ?? {}).length,
    })),
  });
}
