import { NextResponse } from "next/server";
import { findUserByCredentials } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; nit?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const nit = (body.nit ?? "").replace(/\D/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || nit.length < 6) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  try {
    const user = await findUserByCredentials(email, nit);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        email: user.email,
        nit: user.nit,
        name: user.name,
        attemptsAllowed: user.attemptsAllowed,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    console.error("Login DB error:", err);
    return NextResponse.json(
      { error: "Database error", detail: msg },
      { status: 500 },
    );
  }
}
