import { NextResponse, type NextRequest } from "next/server";
import {
  getAllMatches,
  listAllPredictions,
  upsertPrediction,
} from "@/lib/store";
import {
  computeGroupStandings,
  isGroupStageComplete,
  smartCarryOverKnockout,
  championFromFinal,
} from "@/lib/bracket";
import type { MatchDoc, PredictionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const got =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  return got === expected;
}

// Re-derive every stored prediction's knockout on the corrected FIFA 2026 bracket,
// carrying over each user's original intent. Safe to run multiple times.
// Pass ?dryRun=1 to preview the result without writing anything.
async function migrate(dryRun: boolean): Promise<Response> {
  const matches: MatchDoc[] = await getAllMatches();
  const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
  const predictions = await listAllPredictions();

  let migrated = 0;
  let emptied = 0;
  const details: Array<{
    email: string;
    attempt: number;
    champion: string | null;
    groupComplete: boolean;
  }> = [];

  for (const p of predictions) {
    let next: PredictionDoc;
    if (!isGroupStageComplete(groupMatches, p.groupScores)) {
      next = {
        ...p,
        knockout: { r32: [], r16: [], qf: [], sf: [], third: null, final: null },
        champion: null,
        updatedAt: new Date(),
      };
      emptied += 1;
    } else {
      const standings = computeGroupStandings(groupMatches, p.groupScores);
      const knockout = smartCarryOverKnockout(standings, p.knockout);
      next = {
        ...p,
        knockout,
        champion: championFromFinal(knockout.final),
        updatedAt: new Date(),
      };
      migrated += 1;
    }
    if (!dryRun) await upsertPrediction(next);
    details.push({
      email: p.userEmail,
      attempt: p.attempt,
      champion: next.champion?.name ?? null,
      groupComplete: isGroupStageComplete(groupMatches, p.groupScores),
    });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    total: predictions.length,
    migrated,
    emptied,
    details,
  });
}

function isDryRun(request: NextRequest): boolean {
  const v = request.nextUrl.searchParams.get("dryRun");
  return v === "1" || v === "true";
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return migrate(isDryRun(request));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return migrate(isDryRun(request));
}
