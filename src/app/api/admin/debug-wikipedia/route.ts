import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const UA = "PollaInter/1.0 (info@tirepro.com.co)";

async function fetchWikitext(page: string): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "parse",
      page,
      format: "json",
      prop: "wikitext",
      formatversion: "2",
    }).toString();
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    error?: { info: string };
    parse?: { wikitext: string };
  };
  if (json.error) throw new Error(json.error.info);
  return json.parse?.wikitext ?? "";
}

function countBoxes(wt: string): number {
  const re = /\{\{(?:#invoke:[Ff]ootball [Bb]ox\|main|[Ff]ootball [Bb]ox(?!\s*\d))/g;
  let count = 0;
  while (re.exec(wt) !== null) count++;
  return count;
}

// Shows the raw section structure and box counts for each candidate page so
// we can diagnose why the knockout scraper isn't picking up certain rounds.
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = [
    "2026_FIFA_World_Cup_knockout_stage",
    "2026_FIFA_World_Cup_round_of_32",
    "2026_FIFA_World_Cup_round_of_16",
    "2026_FIFA_World_Cup_quarter-finals",
    "2026_FIFA_World_Cup_semi-finals",
    "2026_FIFA_World_Cup_third_place_play-off",
    "2026_FIFA_World_Cup_final",
  ];

  const results = await Promise.all(
    pages.map(async (page) => {
      try {
        const wt = await fetchWikitext(page);
        const sectionRe = /^(={2,4})\s*([^=]+?)\s*\1\s*$/gm;
        const sections: Array<{ label: string; level: number }> = [];
        let sm: RegExpExecArray | null;
        while ((sm = sectionRe.exec(wt)) !== null) {
          sections.push({ label: sm[2].trim(), level: sm[1].length });
        }
        const totalBoxes = countBoxes(wt);
        return {
          page,
          ok: true,
          length: wt.length,
          totalBoxes,
          sections,
          preview: wt.slice(0, 500),
        };
      } catch (err) {
        return {
          page,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return NextResponse.json({ results });
}
