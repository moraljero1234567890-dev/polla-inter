"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, readSession, type Session } from "@/lib/session";

const INTER_LOGO = "https://www.interappsap.co/images/logo.png";

type LeaderboardRow = {
  rank: number;
  email: string;
  name: string;
  attempt: number;
  attemptsAllowed: number;
  total: number;
  groupPoints: number;
  knockoutPoints: number;
};

type LeaderboardResponse = {
  rows: LeaderboardRow[];
  stats: { totalParticipants: number; finishedMatches: number };
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [stats, setStats] = useState<LeaderboardResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: LeaderboardResponse) => {
        if (cancelled) return;
        setRows(data.rows ?? []);
        setStats(data.stats ?? null);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No pudimos cargar la tabla de posiciones.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--foreground-muted)]">
        Cargando…
      </main>
    );
  }

  const myEmail = session.email.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={INTER_LOGO} alt="Grupo Inter" className="h-9 w-auto" />
            <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">
              Polla Mundialista
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-[var(--foreground-soft)] hover:text-[var(--brand)]"
            >
              Mis boletas
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-sm border border-[var(--line)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-[var(--foreground)] text-white">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--brand)]">
              Clasificación general
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-tight md:text-5xl">
              Tabla de posiciones
            </h1>
            <p className="mt-3 max-w-xl text-white/70">
              Así va todo el mundo. Los puntos se actualizan a medida que se
              juegan los partidos del Mundial.
            </p>
            {stats && (
              <div className="mt-6 flex flex-wrap gap-8">
                <div>
                  <p className="font-mono text-3xl font-black tabular-nums">
                    {stats.totalParticipants}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
                    Participantes
                  </p>
                </div>
                <div>
                  <p className="font-mono text-3xl font-black tabular-nums">
                    {stats.finishedMatches}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
                    Partidos jugados
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-12">
          {loading ? (
            <div className="border border-dashed border-[var(--line)] bg-white p-12 text-center text-sm text-[var(--foreground-muted)]">
              Cargando…
            </div>
          ) : error ? (
            <div className="border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] p-6 text-sm text-[var(--brand-dark)]">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="border border-dashed border-[var(--line)] bg-white p-12 text-center text-sm text-[var(--foreground-muted)]">
              Aún no hay puntajes. La tabla se llenará cuando comiencen los
              partidos.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--line)] bg-white">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
                    <th className="px-4 py-4 font-semibold">#</th>
                    <th className="px-4 py-4 font-semibold">Participante</th>
                    <th className="px-4 py-4 text-right font-semibold">Grupos</th>
                    <th className="px-4 py-4 text-right font-semibold">
                      Eliminatorias
                    </th>
                    <th className="px-4 py-4 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isMe = row.email.toLowerCase() === myEmail;
                    const showAttempt = row.attemptsAllowed > 1;
                    return (
                      <tr
                        key={`${row.email}-${row.attempt}`}
                        className={`border-b border-[var(--line)] last:border-0 ${
                          isMe ? "bg-[var(--brand-soft)]" : ""
                        }`}
                      >
                        <td className="px-4 py-4">
                          <span
                            className={`grid h-8 w-8 place-items-center font-mono text-sm font-black ${
                              row.rank <= 3
                                ? "bg-[var(--brand)] text-white"
                                : "text-[var(--foreground-muted)]"
                            }`}
                          >
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold">{row.name}</span>
                          {showAttempt && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
                              Intento {row.attempt}
                            </span>
                          )}
                          {isMe && (
                            <span className="ml-2 rounded-sm bg-[var(--brand)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                              Tú
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-[var(--foreground-soft)]">
                          {row.groupPoints}
                        </td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-[var(--foreground-soft)]">
                          {row.knockoutPoints}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-lg font-black tabular-nums text-[var(--brand)]">
                          {row.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-[var(--foreground-soft)] md:flex-row">
          <span>© {new Date().getFullYear()} · Polla Mundialista Grupo Inter</span>
          <span className="text-[var(--foreground-muted)]">
            Uso interno · Grupo Inter
          </span>
        </div>
      </footer>
    </div>
  );
}
