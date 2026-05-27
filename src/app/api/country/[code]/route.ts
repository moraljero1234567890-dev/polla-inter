import { NextResponse } from "next/server";
import { loadCountry } from "@/lib/country-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  try {
    const data = await loadCountry(code);
    if (!data) {
      return NextResponse.json({ error: "unknown country" }, { status: 404 });
    }
    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
