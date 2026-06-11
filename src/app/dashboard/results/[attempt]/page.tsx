"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/data/worldcup2026";
import { staticFallback, type ApiMatch } from "@/lib/matches";
import { clearSession, readSession, type Session } from "@/lib/session";
import { displayTeam, flagUrl, normalizeTeam } from "@/lib/team-display";
import type { KnockoutPick, PredictionDoc } from "@/lib/types";

const INTER_LOGO =
  "https://www.interappsap.co/images/logo.png";

const STAGE_TITLES: Record<KnockoutPick["stage"], string> = {
  ROUND_OF_32: "Dieciseisavos",
  ROUND_OF_16: "Octavos",
  QUARTER_FINALS: "Cuartos",
  SEMI_FINALS: "Semifinales",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final",
};

type MatchWithScore = ApiMatch & {
  score?: {
    fullTime: { home: number; away: number } | null;
  } | null;
  status?: string;
};

type ResultClass = "exact" | "outcome" | "miss" | "pending";
type ScoreLine = { home: number; away: number };
type GroupDetail = {
  predicted: ScoreLine | null;
  actual: ScoreLine | null;
  result: ResultClass;
  points: number;
};
type KoDetail = {
  predicted: ScoreLine | null;
  actual: ScoreLine | null;
  matchup: boolean;
  result: ResultClass;
  points: number;
};
type ScoreDetail = {
  breakdown: {
    group: { points: number; exact: number; outcomes: number };
    knockout: { points: number };
    total: number;
  };
  groups: Record<string, GroupDetail>;
  knockout: Record<string, KoDetail>;
};

function PointsBadge({ points }: { points: number }) {
  const positive = points > 0;
  return (
    <span
      className={
        "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums " +
        (positive
          ? "bg-emerald-600 text-white"
          : "bg-[var(--line)] text-[var(--foreground-muted)]")
      }
    >
      {positive ? `+${points}` : "0"} pts
    </span>
  );
}

function pickClass(
  predicted: { home: number; away: number } | null,
  actual: { home: number; away: number } | null,
): string {
  if (!actual) return "border-[var(--line)] bg-white";
  if (!predicted) return "border-[var(--line)] bg-white";
  if (predicted.home === actual.home && predicted.away === actual.away) {
    return "border-emerald-600 bg-emerald-50";
  }
  const predDiff = predicted.home - predicted.away;
  const actDiff = actual.home - actual.away;
  const sameOutcome =
    (predDiff > 0 && actDiff > 0) ||
    (predDiff < 0 && actDiff < 0) ||
    (predDiff === 0 && actDiff === 0);
  if (sameOutcome) return "border-amber-500 bg-amber-50";
  return "border-red-400 bg-red-50";
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams<{ attempt: string }>();
  const attemptNum = Number(params.attempt);

  const [session, setSession] = useState<Session | null>(null);
  const [matches, setMatches] = useState<MatchWithScore[]>([]);
  const [prediction, setPrediction] = useState<PredictionDoc | null>(null);
  const [detail, setDetail] = useState<ScoreDetail | null>(null);
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
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch(
        `/api/predictions/${attemptNum}?email=${encodeURIComponent(session.email)}`,
      ).then((r) => r.json()),
      fetch(
        `/api/results/${attemptNum}?email=${encodeURIComponent(session.email)}`,
      )
        .then((r) => (r.ok ? r.json() : { detail: null }))
        .catch(() => ({ detail: null })),
    ])
      .then(([m, p, d]) => {
        if (cancelled) return;
        const arr: MatchWithScore[] = Array.isArray(m.matches)
          ? m.matches
          : staticFallback();
        setMatches(arr.length ? arr : staticFallback());
        setPrediction(p.prediction);
        setDetail(d?.detail ?? null);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No pudimos cargar tu boleta.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, attemptNum]);

  const groupMatches = useMemo(
    () => matches.filter((m) => m.stage === "GROUP_STAGE" && m.group),
    [matches],
  );

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
          <button
            onClick={handleLogout}
            className="rounded-sm border border-[var(--line)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-[var(--foreground)] text-white">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--brand)]">
              Boleta · Intento {attemptNum}
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-tight md:text-5xl">
              Tu pronóstico vs. resultados reales
            </h1>
            <p className="mt-3 max-w-xl text-white/70">
              Los marcadores se actualizan diariamente durante el Mundial.
              <span className="text-emerald-300"> Verde</span> = exacto,{" "}
              <span className="text-amber-300">amarillo</span> = mismo resultado,{" "}
              <span className="text-red-300">rojo</span> = fallaste.
            </p>
            {detail && (
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6 font-mono text-[11px] uppercase tracking-[0.28em] text-white/60">
                <div>
                  <dt>Grupos</dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums text-white">
                    {detail.breakdown.group.points}
                  </dd>
                </div>
                <div>
                  <dt>Eliminatorias</dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums text-white">
                    {detail.breakdown.knockout.points}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--brand)]">Total</dt>
                  <dd className="mt-1 text-3xl font-black tabular-nums text-white">
                    {detail.breakdown.total}
                  </dd>
                </div>
              </div>
            )}
          </div>
        </section>

        {loading || !prediction ? (
          <section className="mx-auto max-w-6xl px-6 py-12">
            <div className="border border-dashed border-[var(--line)] bg-white p-12 text-center text-sm text-[var(--foreground-muted)]">
              Cargando…
            </div>
          </section>
        ) : (
          <>
            {error && (
              <div className="mx-auto mt-6 max-w-6xl border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] p-4 px-6 text-sm text-[var(--brand-dark)]">
                {error}
              </div>
            )}

            <section className="mx-auto max-w-6xl px-6 py-10">
              <h2 className="border-b border-[var(--foreground)] pb-2 font-mono text-xs font-bold uppercase tracking-[0.3em]">
                Fase de grupos
              </h2>
              <ul className="mt-6 grid gap-3">
                {groupMatches.map((m) => {
                  const predicted = prediction.groupScores[m._id] ?? null;
                  const actual = m.score?.fullTime ?? null;
                  const homeT = normalizeTeam(m.home);
                  const awayT = normalizeTeam(m.away);
                  return (
                    <li
                      key={m._id}
                      className={`grid grid-cols-1 items-center gap-3 border p-4 md:grid-cols-[120px_1fr_auto_1fr_auto] ${pickClass(
                        predicted,
                        actual,
                      )}`}
                    >
                      <div className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)] md:block">
                        <div>{formatDate(m.date)}</div>
                        <div>Grupo {m.group}</div>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end">
                        <span className="text-right text-base font-bold uppercase tracking-tight">
                          {homeT.name}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={homeT.crest}
                          alt=""
                          aria-hidden
                          className="h-9 w-12 border border-[var(--line)] object-cover"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center font-mono text-sm">
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                            Tú
                          </div>
                          <div className="mt-1 text-2xl font-black tabular-nums">
                            {predicted
                              ? `${predicted.home}–${predicted.away}`
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                            Real
                          </div>
                          <div className="mt-1 text-2xl font-black tabular-nums">
                            {actual
                              ? `${actual.home}–${actual.away}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={awayT.crest}
                          alt=""
                          aria-hidden
                          className="h-9 w-12 border border-[var(--line)] object-cover"
                        />
                        <span className="text-base font-bold uppercase tracking-tight">
                          {awayT.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)] md:flex-col md:items-end">
                        {detail?.groups[m._id] && (
                          <PointsBadge points={detail.groups[m._id].points} />
                        )}
                        <span>
                          {m.status === "FINISHED"
                            ? "Final"
                            : m.status === "IN_PLAY"
                              ? "En juego"
                              : "Programado"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="mx-auto max-w-6xl px-6 pb-16">
              <h2 className="border-b border-[var(--foreground)] pb-2 font-mono text-xs font-bold uppercase tracking-[0.3em]">
                Eliminatorias (tu llave)
              </h2>
              <div className="mt-6 grid gap-8">
                {(
                  [
                    { stage: "ROUND_OF_32" as const, picks: prediction.knockout.r32 },
                    { stage: "ROUND_OF_16" as const, picks: prediction.knockout.r16 },
                    { stage: "QUARTER_FINALS" as const, picks: prediction.knockout.qf },
                    { stage: "SEMI_FINALS" as const, picks: prediction.knockout.sf },
                  ] as const
                ).map(({ stage, picks }) => {
                  if (!picks.length) return null;
                  return (
                    <div key={stage}>
                      <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em]">
                        {STAGE_TITLES[stage]}
                      </h3>
                      <ul className="grid gap-3 md:grid-cols-2">
                        {picks.map((p) => {
                          const h = displayTeam(p.homeTeamCode, p.homeTeamName);
                          const a = displayTeam(p.awayTeamCode, p.awayTeamName);
                          const d = detail?.knockout[p.matchId];
                          return (
                            <li
                              key={p.matchId}
                              className="border border-[var(--line)] bg-white p-4"
                            >
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <div className="flex items-center justify-end gap-2 text-right text-sm font-bold uppercase tracking-tight">
                                  <span>{h.name || "—"}</span>
                                  {h.crest && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={h.crest}
                                      alt=""
                                      aria-hidden
                                      className="h-6 w-9 shrink-0 border border-[var(--line)] object-cover"
                                    />
                                  )}
                                </div>
                                <span className="font-mono text-lg font-black tabular-nums">
                                  {p.home != null && p.away != null
                                    ? `${p.home}–${p.away}${p.penaltyWinner ? " (pen)" : ""}`
                                    : "—"}
                                </span>
                                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight">
                                  {a.crest && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={a.crest}
                                      alt=""
                                      aria-hidden
                                      className="h-6 w-9 shrink-0 border border-[var(--line)] object-cover"
                                    />
                                  )}
                                  <span>{a.name || "—"}</span>
                                </div>
                              </div>
                              {d && (
                                <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--foreground-muted)]">
                                  <span>
                                    Real:{" "}
                                    <span className="font-bold text-[var(--foreground)]">
                                      {d.actual
                                        ? `${d.actual.home}–${d.actual.away}`
                                        : "no se jugó"}
                                    </span>
                                  </span>
                                  <PointsBadge points={d.points} />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}

                {(prediction.knockout.third || prediction.knockout.final) && (
                  <div className="grid gap-6 md:grid-cols-2">
                    {(["third", "final"] as const).map((key) => {
                      const p = prediction.knockout[key];
                      if (!p) return null;
                      const h = displayTeam(p.homeTeamCode, p.homeTeamName);
                      const a = displayTeam(p.awayTeamCode, p.awayTeamName);
                      return (
                        <div key={key}>
                          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em]">
                            {STAGE_TITLES[key === "third" ? "THIRD_PLACE" : "FINAL"]}
                          </h3>
                          <div className="border border-[var(--line)] bg-white p-4">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                              <div className="flex items-center justify-end gap-2 text-right text-sm font-bold uppercase tracking-tight">
                                <span>{h.name || "—"}</span>
                                {h.crest && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={h.crest}
                                    alt=""
                                    aria-hidden
                                    className="h-6 w-9 shrink-0 border border-[var(--line)] object-cover"
                                  />
                                )}
                              </div>
                              <span className="font-mono text-lg font-black tabular-nums">
                                {p.home != null && p.away != null
                                  ? `${p.home}–${p.away}${p.penaltyWinner ? " (pen)" : ""}`
                                  : "—"}
                              </span>
                              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight">
                                {a.crest && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={a.crest}
                                    alt=""
                                    aria-hidden
                                    className="h-6 w-9 shrink-0 border border-[var(--line)] object-cover"
                                  />
                                )}
                                <span>{a.name || "—"}</span>
                              </div>
                            </div>
                            {detail?.knockout[p.matchId] && (
                              <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--foreground-muted)]">
                                <span>
                                  Real:{" "}
                                  <span className="font-bold text-[var(--foreground)]">
                                    {detail.knockout[p.matchId].actual
                                      ? `${detail.knockout[p.matchId].actual!.home}–${detail.knockout[p.matchId].actual!.away}`
                                      : "no se jugó"}
                                  </span>
                                </span>
                                <PointsBadge points={detail.knockout[p.matchId].points} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {prediction.champion && (
                  <div className="border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] p-8">
                    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand-dark)]">
                      Tu campeón pronosticado
                    </p>
                    <p className="mt-3 text-4xl font-black uppercase tracking-tight text-[var(--brand-dark)]">
                      {displayTeam(
                        prediction.champion.code,
                        prediction.champion.name,
                      ).name}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
