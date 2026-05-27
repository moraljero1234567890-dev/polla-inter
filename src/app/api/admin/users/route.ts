import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { createUser, deleteUser, listAllUsers, updateUserAttempts } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const users = await listAllUsers();
    return NextResponse.json({
      users: users.map((u) => ({
        email: u.email,
        name: u.name,
        attemptsAllowed: u.attemptsAllowed,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { error: "Database error", detail: msg },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    email?: string;
    password?: string;
    name?: string;
    attemptsAllowed?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();
  const name = (body.name ?? "").trim();
  const attemptsAllowed = Number(body.attemptsAllowed);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (
    !Number.isFinite(attemptsAllowed) ||
    attemptsAllowed < 1 ||
    attemptsAllowed > 20
  ) {
    return NextResponse.json(
      { error: "attemptsAllowed must be between 1 and 20" },
      { status: 400 },
    );
  }
  try {
    const user = await createUser({ email, password, name, attemptsAllowed });
    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        attemptsAllowed: user.attemptsAllowed,
        createdAt: user.createdAt,
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

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { email?: string; attemptsAllowed?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const attemptsAllowed = Number(body.attemptsAllowed);
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  if (
    !Number.isFinite(attemptsAllowed) ||
    attemptsAllowed < 1 ||
    attemptsAllowed > 20
  ) {
    return NextResponse.json(
      { error: "attemptsAllowed must be between 1 and 20" },
      { status: 400 },
    );
  }
  try {
    const ok = await updateUserAttempts(email, attemptsAllowed);
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { error: "Database error", detail: msg },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  try {
    const ok = await deleteUser(email);
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { error: "Database error", detail: msg },
      { status: 500 },
    );
  }
}
