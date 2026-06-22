import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { matchesCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

// Admin-only manual score entry / correction. Marks the match as FINISHED with
// the given full-time score (and optional penalties for knockout ties), and flags
// it manualScore so a later provider refresh won't overwrite it. Use status
// "SCHEDULED" with no scores to clear a result back to pending.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    matchId?: string;
    home?: unknown;
    away?: unknown;
    penaltiesHome?: unknown;
    penaltiesAway?: unknown;
    clear?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const matchId = (body.matchId ?? "").toString().trim();
  if (!matchId) {
    return NextResponse.json({ error: "Falta el partido" }, { status: 400 });
  }

  const col = await matchesCollection();
  const match = await col.findOne({ _id: matchId });
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  // Clear back to scheduled (removes the manual result).
  if (body.clear) {
    await col.updateOne(
      { _id: matchId },
      {
        $set: { status: "SCHEDULED", score: null },
        $unset: { manualScore: "" },
      },
    );
    return NextResponse.json({ ok: true, cleared: true });
  }

  const home = toInt(body.home);
  const away = toInt(body.away);
  if (home == null || away == null) {
    return NextResponse.json(
      { error: "Marcador inválido (usa números 0–99)" },
      { status: 400 },
    );
  }

  const penH = body.penaltiesHome === "" || body.penaltiesHome == null ? null : toInt(body.penaltiesHome);
  const penA = body.penaltiesAway === "" || body.penaltiesAway == null ? null : toInt(body.penaltiesAway);
  const penalties =
    penH != null && penA != null ? { home: penH, away: penA } : null;

  await col.updateOne(
    { _id: matchId },
    {
      $set: {
        status: "FINISHED",
        manualScore: true,
        score: {
          fullTime: { home, away },
          halfTime: match.score?.halfTime ?? null,
          penalties,
        },
      },
    },
  );

  return NextResponse.json({
    ok: true,
    matchId,
    score: `${home}-${away}`,
    penalties: penalties ? `${penalties.home}-${penalties.away}` : null,
  });
}
