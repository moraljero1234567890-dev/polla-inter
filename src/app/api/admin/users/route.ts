import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  changeUserEmail,
  createUser,
  deleteUser,
  listAllUsers,
  updateUserFields,
} from "@/lib/store";

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
  let body: {
    email?: string;
    name?: string;
    password?: string;
    attemptsAllowed?: number;
    newEmail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  // Validate whatever the caller chose to send; every field is optional.
  const fields: { name?: string; password?: string; attemptsAllowed?: number } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    fields.name = name;
  }
  if (body.password !== undefined && String(body.password).trim() !== "") {
    const password = String(body.password).trim();
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }
    fields.password = password;
  }
  if (body.attemptsAllowed !== undefined) {
    const attemptsAllowed = Number(body.attemptsAllowed);
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
    fields.attemptsAllowed = attemptsAllowed;
  }

  const newEmail =
    body.newEmail !== undefined ? String(body.newEmail).trim().toLowerCase() : "";
  if (newEmail && newEmail !== email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    let targetEmail = email;
    if (newEmail && newEmail !== email) {
      const moved = await changeUserEmail(email, newEmail);
      if (!moved.ok && moved.reason === "not_found") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (!moved.ok && moved.reason === "exists") {
        return NextResponse.json(
          { error: "Ese correo ya está en uso por otro usuario" },
          { status: 409 },
        );
      }
      targetEmail = newEmail;
    }

    const ok = await updateUserFields(targetEmail, fields);
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, email: targetEmail });
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
