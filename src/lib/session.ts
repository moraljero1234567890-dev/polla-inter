"use client";

export type Session = {
  email: string;
  name: string;
  attemptsAllowed: number;
  ts: number;
};

const KEY = "polla-inter:session";

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string"
    ) {
      return null;
    }
    return {
      email: parsed.email,
      name: parsed.name,
      attemptsAllowed:
        typeof parsed.attemptsAllowed === "number"
          ? parsed.attemptsAllowed
          : 1,
      ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeSession(session: Omit<Session, "ts">): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ ...session, ts: Date.now() }),
  );
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
