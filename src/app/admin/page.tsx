"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const INTER_LOGO =
  "https://www.interappsap.co/images/logo.png";

const TOKEN_KEY = "polla-inter:admin-token";

type AdminUser = {
  email: string;
  name: string;
  attemptsAllowed: number;
  createdAt: string | Date;
};

type LeaderboardRow = {
  email: string;
  name: string;
  attempt: number;
  attemptsAllowed: number;
  totalAttempts: number;
  breakdown: {
    group: {
      outcomes: number;
      exact: number;
      points: number;
    };
    knockout: {
      r32Outcomes: number;
      r32Exact: number;
      perfectBrackets: number;
      bracketOutcomes: number;
      bracketExact: number;
      advanceR16: number;
      advanceQf: number;
      advanceSf: number;
      advanceFinal: number;
      champion: number;
      runnerUp: number;
      third: number;
      fourth: number;
      points: number;
    };
    total: number;
  };
};

type LeaderboardStats = {
  totalUsers: number;
  totalPredictions: number;
  finishedGroupMatches: number;
  finishedKnockoutMatches: number;
};

type Banner = { kind: "ok" | "err"; text: string } | null;

type AdminMatch = {
  _id: string;
  group: string | null;
  stage: string;
  stageLabel: string;
  date: string;
  status: string;
  home: { name: string };
  away: { name: string };
  score?: {
    fullTime: { home: number; away: number } | null;
    penalties: { home: number; away: number } | null;
  } | null;
};

type KnockoutStageEntry = {
  label: string;
  total: number;
  finished: number;
  matches: { home: string; away: string; score: string | null; penalties: string | null; id: string }[];
};

type DiagnoseResult = {
  summary: {
    matches: number;
    predictions: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    groupMatches: number;
    finishedGroupMatches: number;
  };
  knockoutByStage?: Record<string, KnockoutStageEntry>;
  diagnostics: {
    finishedWithoutScore: {
      count: number;
      items: { id: string; stage: string; teams: string }[];
    };
    knockoutDrawsNoPenalty: {
      count: number;
      items: { id: string; stage: string; teams: string; score: string; manualScore: boolean }[];
    };
    groupKeyAlignment: {
      totalKeys: number;
      matchedKeys: number;
      unmatchedKeys: number;
      sampleUnmatchedKeys: string[];
      sampleCurrentGroupIds: string[];
    };
    finishedGroupMatchesWithNoMatchingPrediction: {
      count: number;
      items: { id: string; teams: string }[];
    };
    knockoutCodeAlignment: {
      sampleMatchCodes: string[];
      samplePredCodes: string[];
      predCodesMissingInMatches: string[];
    };
  };
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [attempts, setAttempts] = useState("1");
  const [creating, setCreating] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diag, setDiag] = useState<DiagnoseResult | null>(null);
  const [debuggingWiki, setDebuggingWiki] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wikiDebug, setWikiDebug] = useState<any | null>(null);

  const [adminMatches, setAdminMatches] = useState<AdminMatch[]>([]);
  const [scoreMatchId, setScoreMatchId] = useState("");
  const [scoreHome, setScoreHome] = useState("");
  const [scoreAway, setScoreAway] = useState("");
  const [scorePenH, setScorePenH] = useState("");
  const [scorePenA, setScorePenA] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  const [cmStage, setCmStage] = useState("ROUND_OF_16");
  const [cmHome, setCmHome] = useState("");
  const [cmAway, setCmAway] = useState("");
  const [cmHomeScore, setCmHomeScore] = useState("");
  const [cmAwayScore, setCmAwayScore] = useState("");
  const [cmPenH, setCmPenH] = useState("");
  const [cmPenA, setCmPenA] = useState("");
  const [cmDate, setCmDate] = useState("");
  const [savingCm, setSavingCm] = useState(false);
  const [cmResult, setCmResult] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAttempts, setEditAttempts] = useState("1");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardStats, setLeaderboardStats] =
    useState<LeaderboardStats | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(TOKEN_KEY) ?? "";
    setToken(saved);
    setSavedToken(saved);
  }, []);

  const loadUsers = useCallback(
    async (t: string) => {
      if (!t) {
        setUsers([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/admin/users", {
          headers: { authorization: `Bearer ${t}` },
        });
        if (res.status === 401) {
          setBanner({ kind: "err", text: "Token rechazado. Revisa ADMIN_TOKEN en Vercel." });
          setUsers([]);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setBanner({
            kind: "err",
            text: data.detail ?? data.error ?? `Error ${res.status}`,
          });
          setUsers([]);
          return;
        }
        const data = (await res.json()) as { users: AdminUser[] };
        setUsers(data.users);
        setBanner(null);
      } catch (err) {
        setBanner({
          kind: "err",
          text: err instanceof Error ? err.message : "Error desconocido",
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadLeaderboard = useCallback(async (t: string) => {
    if (!t) {
      setLeaderboard([]);
      setLeaderboardStats(null);
      return;
    }
    setLeaderboardLoading(true);
    try {
      const res = await fetch("/api/admin/leaderboard", {
        headers: { authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        setLeaderboard([]);
        setLeaderboardStats(null);
        return;
      }
      const data = (await res.json()) as {
        rows: LeaderboardRow[];
        stats: LeaderboardStats;
      };
      setLeaderboard(data.rows);
      setLeaderboardStats(data.stats);
    } catch {
      setLeaderboard([]);
      setLeaderboardStats(null);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (savedToken) {
      void loadUsers(savedToken);
      void loadLeaderboard(savedToken);
    }
  }, [savedToken, loadUsers, loadLeaderboard]);

  function handleSaveToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    window.localStorage.setItem(TOKEN_KEY, token);
    setSavedToken(token);
  }

  function handleClearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setSavedToken("");
    setUsers([]);
    setLeaderboard([]);
    setLeaderboardStats(null);
    setBanner(null);
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!savedToken) {
      setBanner({ kind: "err", text: "Guarda primero tu token de admin." });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanPw = password.trim();
    const cleanName = name.trim();
    const n = Number(attempts);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setBanner({ kind: "err", text: "Correo inválido." });
      return;
    }
    if (cleanPw.length < 6) {
      setBanner({ kind: "err", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (!cleanName) {
      setBanner({ kind: "err", text: "El nombre es obligatorio." });
      return;
    }
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      setBanner({ kind: "err", text: "Intentos: entre 1 y 20." });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPw,
          name: cleanName,
          attemptsAllowed: n,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({
          kind: "err",
          text: data.detail ?? data.error ?? `Error ${res.status}`,
        });
        return;
      }
      setBanner({
        kind: "ok",
        text: `Usuario "${cleanEmail}" creado con ${n} intento${n === 1 ? "" : "s"}.`,
      });
      setEmail("");
      setPassword("");
      setName("");
      setAttempts("1");
      await loadUsers(savedToken);
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(userEmail: string) {
    if (!savedToken) return;
    if (!confirm(`¿Eliminar al usuario ${userEmail} y todas sus boletas?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBanner({ kind: "err", text: data.error ?? `Error ${res.status}` });
        return;
      }
      setBanner({ kind: "ok", text: `Usuario "${userEmail}" eliminado.` });
      await loadUsers(savedToken);
    } catch (err) {
      setBanner({ kind: "err", text: err instanceof Error ? err.message : "Error desconocido" });
    }
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditAttempts(String(u.attemptsAllowed));
    setEditPassword("");
  }

  function closeEdit() {
    setEditing(null);
    setEditPassword("");
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!savedToken || !editing) return;
    const originalEmail = editing.email;
    const newEmail = editEmail.trim().toLowerCase();
    const cleanName = editName.trim();
    const cleanPw = editPassword.trim();
    const n = Number(editAttempts);
    if (!cleanName) {
      setBanner({ kind: "err", text: "El nombre es obligatorio." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setBanner({ kind: "err", text: "Correo inválido." });
      return;
    }
    if (cleanPw && cleanPw.length < 6) {
      setBanner({ kind: "err", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      setBanner({ kind: "err", text: "Intentos: entre 1 y 20." });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({
          email: originalEmail,
          newEmail: newEmail !== originalEmail ? newEmail : undefined,
          name: cleanName,
          attemptsAllowed: n,
          ...(cleanPw ? { password: cleanPw } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data.detail ?? data.error ?? `Error ${res.status}` });
        return;
      }
      setBanner({ kind: "ok", text: `Usuario "${newEmail}" actualizado.` });
      closeEdit();
      await loadUsers(savedToken);
      await loadLeaderboard(savedToken);
    } catch (err) {
      setBanner({ kind: "err", text: err instanceof Error ? err.message : "Error desconocido" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRefreshMatches() {
    if (!savedToken) {
      setBanner({ kind: "err", text: "Guarda primero tu token de admin." });
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/refresh-matches", {
        method: "POST",
        headers: { authorization: `Bearer ${savedToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({
          kind: "err",
          text: data.error ?? `Error ${res.status}`,
        });
        return;
      }
      setBanner({
        kind: "ok",
        text: data.skipped
          ? `Sin cambios (${data.skipped}).`
          : `${data.upserts} partidos actualizados desde ${data.source}.`,
      });
      await loadLeaderboard(savedToken);
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDebugWiki() {
    if (!savedToken) {
      setBanner({ kind: "err", text: "Guarda primero tu token de admin." });
      return;
    }
    setDebuggingWiki(true);
    try {
      const res = await fetch("/api/admin/debug-wikipedia", {
        headers: { authorization: `Bearer ${savedToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data.error ?? `Error ${res.status}` });
        return;
      }
      setWikiDebug(data);
      setBanner(null);
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setDebuggingWiki(false);
    }
  }

  async function handleDiagnose() {
    if (!savedToken) {
      setBanner({ kind: "err", text: "Guarda primero tu token de admin." });
      return;
    }
    setDiagnosing(true);
    try {
      const res = await fetch("/api/admin/diagnose", {
        headers: { authorization: `Bearer ${savedToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data.error ?? `Error ${res.status}` });
        return;
      }
      setDiag(data as DiagnoseResult);
      setBanner(null);
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setDiagnosing(false);
    }
  }

  async function handleCreateMatch() {
    if (!savedToken) {
      setBanner({ kind: "err", text: "Guarda primero tu token de admin." });
      return;
    }
    if (!cmHome.trim() || !cmAway.trim()) {
      setBanner({ kind: "err", text: "Ingresa los códigos de ambos equipos (ej: de, py, br, ar)." });
      return;
    }
    setSavingCm(true);
    setCmResult(null);
    try {
      const res = await fetch("/api/admin/create-match", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({
          stage: cmStage,
          homeCode: cmHome.trim().toLowerCase(),
          awayCode: cmAway.trim().toLowerCase(),
          homeScore: cmHomeScore !== "" ? Number(cmHomeScore) : null,
          awayScore: cmAwayScore !== "" ? Number(cmAwayScore) : null,
          penaltyHome: cmPenH !== "" ? Number(cmPenH) : null,
          penaltyAway: cmPenA !== "" ? Number(cmPenA) : null,
          date: cmDate || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data.error ?? `Error ${res.status}` });
        return;
      }
      const label = data.match + (data.penalties ? ` (pen: ${data.penalties})` : "");
      setCmResult(label);
      setBanner({ kind: "ok", text: `Guardado: ${label}` });
      loadAdminMatches();
    } catch (err) {
      setBanner({ kind: "err", text: err instanceof Error ? err.message : "Error desconocido" });
    } finally {
      setSavingCm(false);
    }
  }

  const loadAdminMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.matches)) setAdminMatches(data.matches);
    } catch {
      /* ignore — the score editor just won't have options */
    }
  }, []);

  useEffect(() => {
    loadAdminMatches();
  }, [loadAdminMatches]);

  // When a match is picked, prefill the inputs with its current score.
  useEffect(() => {
    const m = adminMatches.find((x) => x._id === scoreMatchId);
    const ft = m?.score?.fullTime ?? null;
    const pen = m?.score?.penalties ?? null;
    setScoreHome(ft ? String(ft.home) : "");
    setScoreAway(ft ? String(ft.away) : "");
    setScorePenH(pen ? String(pen.home) : "");
    setScorePenA(pen ? String(pen.away) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreMatchId]);

  async function handleSetScore(clear = false) {
    if (!savedToken) {
      setBanner({ kind: "err", text: "Guarda primero tu token de admin." });
      return;
    }
    if (!scoreMatchId) {
      setBanner({ kind: "err", text: "Elige un partido." });
      return;
    }
    setSavingScore(true);
    try {
      const res = await fetch("/api/admin/set-score", {
        method: "POST",
        headers: {
          authorization: `Bearer ${savedToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          matchId: scoreMatchId,
          home: scoreHome,
          away: scoreAway,
          penaltiesHome: scorePenH,
          penaltiesAway: scorePenA,
          clear,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data.error ?? `Error ${res.status}` });
        return;
      }
      setBanner({
        kind: "ok",
        text: clear
          ? "Marcador borrado (vuelve a programado)."
          : `Marcador guardado: ${data.score}${data.penalties ? ` (pen ${data.penalties})` : ""}.`,
      });
      await loadAdminMatches();
      await loadLeaderboard(savedToken);
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSavingScore(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={INTER_LOGO} alt="Grupo Inter" className="h-9 w-auto" />
            <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">
              Polla Mundialista · Admin
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[var(--foreground-soft)] hover:text-[var(--brand)]"
          >
            Ir al dashboard →
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">
          Panel · Administración
        </p>
        <h1 className="mt-3 text-3xl font-black uppercase leading-tight md:text-4xl">
          Crear usuarios y partidos
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--foreground-soft)]">
          Esta página usa el <code className="font-mono text-sm">ADMIN_TOKEN</code>{" "}
          que configuraste en Vercel. Se guarda en tu navegador después de
          ingresarlo una vez.
        </p>

        {banner && (
          <div
            role="status"
            className={
              "mt-6 border-l-4 p-4 text-sm " +
              (banner.kind === "ok"
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-red-500 bg-red-50 text-red-800")
            }
          >
            {banner.text}
          </div>
        )}

        <section className="mt-10 border border-[var(--line)] bg-white p-6">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
            1 · Token de admin
          </h2>
          <form onSubmit={handleSaveToken} className="mt-4 flex flex-wrap gap-3">
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega tu ADMIN_TOKEN"
              className="h-11 flex-1 min-w-[260px] border border-[var(--line)] bg-white px-3 font-mono text-sm outline-none focus:border-[var(--brand)]"
            />
            <button
              type="submit"
              className="h-11 bg-[var(--brand)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--brand-dark)]"
            >
              Guardar
            </button>
            {savedToken && (
              <button
                type="button"
                onClick={handleClearToken}
                className="h-11 border border-[var(--line)] px-5 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                Olvidar
              </button>
            )}
          </form>
          {savedToken ? (
            <p className="mt-3 text-xs text-emerald-700">
              Token guardado · ya puedes crear usuarios y refrescar partidos.
            </p>
          ) : (
            <p className="mt-3 text-xs text-[var(--foreground-muted)]">
              Sin token no puedes crear usuarios.
            </p>
          )}
        </section>

        <section className="mt-8 border border-[var(--line)] bg-white p-6">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
            2 · Crear usuario
          </h2>
          <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                Correo electrónico
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--brand)]"
                required
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                Contraseña
              </span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min. 6 caracteres"
                className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--brand)]"
                required
              />
            </label>
            <label className="block md:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                Nombre
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--brand)]"
                required
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                Intentos permitidos (1–20)
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={attempts}
                onChange={(e) => setAttempts(e.target.value)}
                className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 font-mono tabular-nums outline-none focus:border-[var(--brand)]"
                required
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating || !savedToken}
                className="h-11 w-full bg-[var(--brand)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 border border-[var(--line)] bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
              3 · Usuarios existentes
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
              {loading ? "Cargando…" : `${users.length} usuario${users.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {users.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--foreground-muted)]">
              {savedToken
                ? "Aún no hay usuarios. Crea uno arriba."
                : "Guarda tu token para ver los usuarios."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--line)]">
              {users.map((u) => (
                <li
                  key={u.email}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{u.name}</p>
                    <p className="font-mono text-xs text-[var(--foreground-muted)]">
                      {u.email}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                    {u.attemptsAllowed} intento{u.attemptsAllowed === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="inline-flex items-center border border-[var(--foreground)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.email)}
                    className="inline-flex items-center border border-red-300 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-red-600 transition hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 border border-[var(--line)] bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
              4 · Tabla de posiciones
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                {leaderboardLoading
                  ? "Cargando…"
                  : `${leaderboard.length} boleta${leaderboard.length === 1 ? "" : "s"}`}
              </span>
              <button
                type="button"
                onClick={() => void loadLeaderboard(savedToken)}
                disabled={!savedToken || leaderboardLoading}
                className="h-8 border border-[var(--line)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Recalcular
              </button>
            </div>
          </div>
          {leaderboardStats && (
            <p className="mt-3 font-mono text-[11px] text-[var(--foreground-muted)]">
              {leaderboardStats.finishedGroupMatches} partido
              {leaderboardStats.finishedGroupMatches === 1 ? "" : "s"} de fase de
              grupos terminado
              {leaderboardStats.finishedGroupMatches === 1 ? "" : "s"} ·{" "}
              {leaderboardStats.finishedKnockoutMatches} de eliminatorias ·{" "}
              {leaderboardStats.totalPredictions} boletas registradas
            </p>
          )}
          {leaderboard.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--foreground-muted)]">
              {savedToken
                ? "Aún no hay puntos para mostrar. Los puntos se calcularán automáticamente cuando los partidos terminen y los marcadores se carguen."
                : "Guarda tu token para ver la tabla."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--foreground)] text-left font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Participante</th>
                    <th className="py-2 pr-3">Intento</th>
                    <th className="py-2 pr-3 text-right">Grupos</th>
                    <th className="py-2 pr-3 text-right">Elim.</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, idx) => {
                    const rank = idx + 1;
                    return (
                      <tr
                        key={`${row.email}-${row.attempt}`}
                        className="border-b border-[var(--line)] align-top"
                      >
                        <td className="py-3 pr-3 font-mono text-sm font-bold tabular-nums">
                          {rank === 1
                            ? "🥇"
                            : rank === 2
                              ? "🥈"
                              : rank === 3
                                ? "🥉"
                                : rank.toString().padStart(2, "0")}
                        </td>
                        <td className="py-3 pr-3">
                          <p className="font-semibold">{row.name}</p>
                          <p className="font-mono text-[11px] text-[var(--foreground-muted)]">
                            {row.email}
                          </p>
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-[var(--foreground-soft)]">
                          {row.attempt}/{row.attemptsAllowed}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <div className="font-mono font-bold tabular-nums">
                            {row.breakdown.group.points}
                          </div>
                          <div className="font-mono text-[10px] text-[var(--foreground-muted)]">
                            {row.breakdown.group.exact}ex ·{" "}
                            {row.breakdown.group.outcomes}g
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <div className="font-mono font-bold tabular-nums">
                            {row.breakdown.knockout.points}
                          </div>
                          <div className="font-mono text-[10px] text-[var(--foreground-muted)]">
                            {row.breakdown.knockout.perfectBrackets}lp ·{" "}
                            av{row.breakdown.knockout.advanceR16 + row.breakdown.knockout.advanceQf + row.breakdown.knockout.advanceSf + row.breakdown.knockout.advanceFinal}
                            {row.breakdown.knockout.champion ? " ·camp" : ""}
                            {row.breakdown.knockout.runnerUp ? " ·sub" : ""}
                            {row.breakdown.knockout.third ? " ·3°" : ""}
                            {row.breakdown.knockout.fourth ? " ·4°" : ""}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-lg font-black tabular-nums">
                          {row.breakdown.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Grupos: ex = exactos, g = ganador/empate · Elim: lp = llaves
                perfectas, av = equipos que avanzan correctos (+ camp / sub /
                3° / 4°)
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 border border-[var(--line)] bg-white p-6">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
            5 · Partidos del Mundial
          </h2>
          <p className="mt-3 text-sm text-[var(--foreground-soft)]">
            Los marcadores ahora se actualizan solos: cada vez que alguien abre
            el dashboard o la tabla, la app revisa el proveedor (como máximo una
            vez cada 10 minutos) y guarda los resultados nuevos. Ya no necesitas
            refrescar a mano — el botón queda como recarga manual opcional.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRefreshMatches}
              disabled={refreshing || !savedToken}
              className="h-11 border border-[var(--foreground)] px-5 text-sm font-semibold uppercase tracking-[0.18em] transition hover:bg-[var(--foreground)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Cargando…" : "Refrescar partidos"}
            </button>
            <button
              type="button"
              onClick={handleDiagnose}
              disabled={diagnosing || !savedToken}
              className="h-11 border border-[var(--line)] px-5 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {diagnosing ? "Revisando…" : "Diagnóstico de puntos"}
            </button>
            <button
              type="button"
              onClick={handleDebugWiki}
              disabled={debuggingWiki || !savedToken}
              className="h-11 border border-[var(--line)] px-5 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {debuggingWiki ? "Leyendo…" : "Debug Wikipedia"}
            </button>
          </div>

          {wikiDebug && (
            <div className="mt-4 border border-[var(--line)] bg-[var(--background)] p-4 text-xs font-mono">
              <p className="mb-2 font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Wikipedia — estructura de páginas</p>
              {(wikiDebug.results ?? []).map((r: { page: string; ok: boolean; length?: number; totalBoxes?: number; sections?: {label: string; level: number}[]; error?: string }) => (
                <div key={r.page} className="mb-3 border-b border-dashed border-[var(--line)] pb-2">
                  <p className={r.ok ? "text-green-700" : "text-red-600"}>
                    {r.ok ? "✓" : "✗"} <b>{r.page}</b>
                    {r.ok && ` — ${r.length} chars, ${r.totalBoxes} boxes`}
                    {!r.ok && `: ${r.error}`}
                  </p>
                  {r.ok && r.sections && r.sections.length > 0 && (
                    <ul className="mt-1 pl-4">
                      {r.sections.map((s, i) => (
                        <li key={i}>{`${"=".repeat(s.level)} ${s.label} ${"=".repeat(s.level)}`}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {diag && (
            <div className="mt-6 border border-[var(--line)] bg-[var(--background)] p-5 text-sm">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                Diagnóstico
              </h3>

              {/* Knockout stage health table */}
              {diag.knockoutByStage && (
                <div className="mt-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">
                    Eliminatorias en la base de datos
                  </p>
                  <table className="mt-2 w-full border border-[var(--line)] text-xs">
                    <thead>
                      <tr className="bg-[var(--surface)] font-mono text-[9px] uppercase tracking-widest">
                        <th className="px-2 py-1 text-left">Ronda</th>
                        <th className="px-2 py-1 text-center">En DB</th>
                        <th className="px-2 py-1 text-center">Terminados</th>
                        <th className="px-2 py-1 text-left">Resultados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(diag.knockoutByStage).map(([stage, entry]) => (
                        <tr key={stage} className="border-t border-[var(--line)]">
                          <td className="px-2 py-1 font-medium">{entry.label}</td>
                          <td className={`px-2 py-1 text-center font-bold ${entry.total === 0 ? "text-red-500" : ""}`}>
                            {entry.total}
                          </td>
                          <td className={`px-2 py-1 text-center font-bold ${
                            entry.finished === 0 && entry.total === 0 ? "text-red-500"
                            : entry.finished === 0 ? "text-amber-600"
                            : "text-emerald-700"
                          }`}>
                            {entry.finished}
                          </td>
                          <td className="px-2 py-1 font-mono text-[10px] text-[var(--foreground-soft)]">
                            {entry.matches.length > 0
                              ? entry.matches.map(m =>
                                  `${m.home} ${m.score ?? "?"} ${m.away}${m.penalties ? ` (p:${m.penalties})` : ""}`
                                ).join(" · ")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 font-mono text-[9px] text-[var(--foreground-muted)]">
                    Rojo = sin datos · Amarillo = hay partidos pero ninguno terminado · Verde = hay resultados
                  </p>
                </div>
              )}

              <ul className="mt-4 grid gap-2">
                <li>
                  Partidos totales: <b>{diag.summary.matches}</b> · Grupos terminados:{" "}
                  <b>{diag.summary.finishedGroupMatches}</b> · Predicciones:{" "}
                  <b>{diag.summary.predictions}</b> · Fuente:{" "}
                  <b>
                    {Object.entries(diag.summary.bySource)
                      .map(([s, n]) => `${s} (${n})`)
                      .join(", ") || "—"}
                  </b>
                </li>
                <li
                  className={
                    diag.diagnostics.finishedWithoutScore.count > 0
                      ? "text-red-600"
                      : ""
                  }
                >
                  Terminados <b>sin marcador</b> (dan 0 puntos):{" "}
                  <b>{diag.diagnostics.finishedWithoutScore.count}</b>
                  {diag.diagnostics.finishedWithoutScore.count > 0 && (
                    <span> — {diag.diagnostics.finishedWithoutScore.items.map((i) => i.teams).join("; ")}</span>
                  )}
                </li>
                <li
                  className={
                    diag.diagnostics.knockoutDrawsNoPenalty.count > 0
                      ? "text-red-600 font-semibold"
                      : ""
                  }
                >
                  Eliminatorias <b>empatadas sin penales</b> (el ganador es desconocido — puntos de avance no se cuentan):{" "}
                  <b>{diag.diagnostics.knockoutDrawsNoPenalty.count}</b>
                  {diag.diagnostics.knockoutDrawsNoPenalty.count > 0 && (
                    <span>
                      {" "}— {diag.diagnostics.knockoutDrawsNoPenalty.items.map(
                        (i) => `${i.teams} (${i.score})`,
                      ).join("; ")}
                      {" "}→ usa <em>Editar marcador</em> para agregar el resultado de penales
                    </span>
                  )}
                </li>
                <li
                  className={
                    diag.diagnostics.groupKeyAlignment.unmatchedKeys > 0
                      ? "text-red-600"
                      : "text-emerald-700"
                  }
                >
                  Predicciones de grupos vinculadas:{" "}
                  <b>
                    {diag.diagnostics.groupKeyAlignment.matchedKeys}/
                    {diag.diagnostics.groupKeyAlignment.totalKeys}
                  </b>
                  {diag.diagnostics.groupKeyAlignment.unmatchedKeys > 0 && (
                    <span> — {diag.diagnostics.groupKeyAlignment.unmatchedKeys} huérfanas</span>
                  )}
                </li>
                {diag.diagnostics.knockoutCodeAlignment.predCodesMissingInMatches.length > 0 && (
                  <li className="text-amber-600">
                    Códigos en predicciones eliminatorias sin partido en DB:{" "}
                    <b>{diag.diagnostics.knockoutCodeAlignment.predCodesMissingInMatches.join(", ")}</b>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* ── NEW: manual knockout match creation ── */}
          <div className="mt-8 border-t border-[var(--line)] pt-6">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
              Crear / registrar partido de eliminatorias
            </h3>
            <p className="mt-2 text-sm text-[var(--foreground-soft)]">
              Usa esto cuando Wikipedia no trae un partido de eliminatorias. Ingresa los
              códigos ISO en minúscula (de, py, br, ar, us, mx, fr, es, hr, nl…). El
              partido queda marcado como manual y no se sobreescribe en recargas.
            </p>
            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap gap-3">
                <label className="text-xs">
                  <span className="block text-[var(--foreground-muted)]">Ronda</span>
                  <select
                    value={cmStage}
                    onChange={(e) => setCmStage(e.target.value)}
                    className="mt-1 h-11 border border-[var(--line)] bg-white px-3 text-sm"
                  >
                    <option value="ROUND_OF_32">Dieciseisavos (R32)</option>
                    <option value="ROUND_OF_16">Octavos (R16)</option>
                    <option value="QUARTER_FINALS">Cuartos de final</option>
                    <option value="SEMI_FINALS">Semifinales</option>
                    <option value="THIRD_PLACE">Tercer puesto</option>
                    <option value="FINAL">Final</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block text-[var(--foreground-muted)]">Fecha (opc.)</span>
                  <input
                    type="date"
                    value={cmDate}
                    onChange={(e) => setCmDate(e.target.value)}
                    className="mt-1 h-11 border border-[var(--line)] px-3 text-sm"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs">
                  <span className="block text-[var(--foreground-muted)]">Local (código)</span>
                  <input
                    type="text"
                    value={cmHome}
                    onChange={(e) => setCmHome(e.target.value.toLowerCase())}
                    placeholder="de"
                    maxLength={8}
                    className="mt-1 h-11 w-20 border border-[var(--line)] px-2 text-center text-base font-bold uppercase"
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-[var(--foreground-muted)]">Goles</span>
                  <input
                    type="number"
                    min={0}
                    value={cmHomeScore}
                    onChange={(e) => setCmHomeScore(e.target.value)}
                    className="mt-1 h-11 w-16 border border-[var(--line)] px-2 text-center text-lg font-bold"
                  />
                </label>
                <span className="pb-3 text-lg font-bold">–</span>
                <label className="text-xs">
                  <span className="block text-[var(--foreground-muted)]">Goles</span>
                  <input
                    type="number"
                    min={0}
                    value={cmAwayScore}
                    onChange={(e) => setCmAwayScore(e.target.value)}
                    className="mt-1 h-11 w-16 border border-[var(--line)] px-2 text-center text-lg font-bold"
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-[var(--foreground-muted)]">Visitante (código)</span>
                  <input
                    type="text"
                    value={cmAway}
                    onChange={(e) => setCmAway(e.target.value.toLowerCase())}
                    placeholder="py"
                    maxLength={8}
                    className="mt-1 h-11 w-20 border border-[var(--line)] px-2 text-center text-base font-bold uppercase"
                  />
                </label>

                <div className="ml-2 flex items-end gap-2 border-l border-[var(--line)] pl-4">
                  <label className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">
                    <span className="block">Pen. local (opc.)</span>
                    <input
                      type="number"
                      min={0}
                      value={cmPenH}
                      onChange={(e) => setCmPenH(e.target.value)}
                      placeholder="—"
                      className="mt-1 h-11 w-14 border border-[var(--line)] px-2 text-center"
                    />
                  </label>
                  <span className="pb-3">–</span>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">
                    <span className="block">Pen. visit.</span>
                    <input
                      type="number"
                      min={0}
                      value={cmPenA}
                      onChange={(e) => setCmPenA(e.target.value)}
                      placeholder="—"
                      className="mt-1 h-11 w-14 border border-[var(--line)] px-2 text-center"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleCreateMatch}
                  disabled={savingCm || !savedToken || !cmHome.trim() || !cmAway.trim()}
                  className="h-11 bg-[var(--brand)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCm ? "Guardando…" : "Guardar partido"}
                </button>
                {cmResult && (
                  <span className="font-bold text-emerald-700">✓ {cmResult}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-[var(--line)] pt-6">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
              Editar marcador (manual)
            </h3>
            <p className="mt-2 text-sm text-[var(--foreground-soft)]">
              Usa esto cuando el proveedor (Wikipedia) no tiene un partido o trae
              un marcador equivocado. El marcador manual queda fijo y las recargas
              automáticas ya no lo sobrescriben. Los puntos se recalculan solos.
            </p>

            <div className="mt-4 grid gap-3">
              <select
                value={scoreMatchId}
                onChange={(e) => setScoreMatchId(e.target.value)}
                className="h-11 border border-[var(--line)] bg-white px-3 text-sm"
              >
                <option value="">— Elige un partido —</option>
                {[...adminMatches]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((m) => {
                    const ft = m.score?.fullTime;
                    const label = `${m.stageLabel}${m.group ? ` ${m.group}` : ""} · ${m.home.name} vs ${m.away.name} ${
                      ft ? `(${ft.home}-${ft.away})` : "(—)"
                    }${m.status === "SCHEDULED" ? " ·prog" : ""}`;
                    return (
                      <option key={m._id} value={m._id}>
                        {label}
                      </option>
                    );
                  })}
              </select>

              {scoreMatchId && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs">
                    <span className="block text-[var(--foreground-muted)]">
                      {adminMatches.find((m) => m._id === scoreMatchId)?.home.name ??
                        "Local"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={scoreHome}
                      onChange={(e) => setScoreHome(e.target.value)}
                      className="mt-1 h-11 w-20 border border-[var(--line)] px-3 text-center text-lg font-bold"
                    />
                  </label>
                  <span className="pb-3 text-lg font-bold">–</span>
                  <label className="text-xs">
                    <span className="block text-[var(--foreground-muted)]">
                      {adminMatches.find((m) => m._id === scoreMatchId)?.away.name ??
                        "Visitante"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={scoreAway}
                      onChange={(e) => setScoreAway(e.target.value)}
                      className="mt-1 h-11 w-20 border border-[var(--line)] px-3 text-center text-lg font-bold"
                    />
                  </label>

                  <div className="ml-2 flex items-end gap-2 border-l border-[var(--line)] pl-4">
                    <label className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">
                      <span className="block">Penales (opc.)</span>
                      <input
                        type="number"
                        min={0}
                        value={scorePenH}
                        onChange={(e) => setScorePenH(e.target.value)}
                        placeholder="—"
                        className="mt-1 h-11 w-16 border border-[var(--line)] px-2 text-center"
                      />
                    </label>
                    <span className="pb-3">–</span>
                    <label className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">
                      <span className="block">&nbsp;</span>
                      <input
                        type="number"
                        min={0}
                        value={scorePenA}
                        onChange={(e) => setScorePenA(e.target.value)}
                        placeholder="—"
                        className="mt-1 h-11 w-16 border border-[var(--line)] px-2 text-center"
                      />
                    </label>
                  </div>
                </div>
              )}

              {scoreMatchId && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleSetScore(false)}
                    disabled={savingScore || !savedToken}
                    className="h-11 bg-[var(--brand)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingScore ? "Guardando…" : "Guardar marcador"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetScore(true)}
                    disabled={savingScore || !savedToken}
                    className="h-11 border border-[var(--line)] px-5 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Borrar (volver a programado)
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <p className="mt-10 text-xs text-[var(--foreground-muted)]">
          ¿Necesitas diagnosticar la conexión a Mongo? Abre{" "}
          <Link className="underline" href="/api/health">
            /api/health
          </Link>
          .
        </p>
      </main>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-md border border-[var(--line)] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
                Editar usuario
              </h3>
              <button
                type="button"
                onClick={closeEdit}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)] hover:text-[var(--brand)]"
              >
                Cerrar ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-5 grid gap-4">
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                  Nombre
                </span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--brand)]"
                  required
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                  Correo electrónico
                </span>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--brand)]"
                  required
                />
                <span className="mt-1 block text-[10px] text-[var(--foreground-muted)]">
                  Cambiarlo migra sus boletas al nuevo correo.
                </span>
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                  Nueva contraseña (opcional)
                </span>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar en blanco para no cambiarla"
                  className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
                  Intentos permitidos (1–20)
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editAttempts}
                  onChange={(e) => setEditAttempts(e.target.value)}
                  className="mt-1 h-11 w-full border border-[var(--line)] bg-white px-3 font-mono tabular-nums outline-none focus:border-[var(--brand)]"
                  required
                />
              </label>
              <div className="mt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="h-11 flex-1 bg-[var(--brand)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? "Guardando…" : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="h-11 border border-[var(--line)] px-5 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
