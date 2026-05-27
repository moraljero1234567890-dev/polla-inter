"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { writeSession } from "@/lib/session";

const HERO_IMAGE =
  "https://media.cnn.com/api/v1/images/stellar/prod/221219105607-messi-crowd-world-cup-121822.jpg?q=w_3000,c_fill";

const INTER_LOGO =
  "https://www.interappsap.co/images/logo.png";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPw = password.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Ingresa un correo válido.");
      return;
    }
    if (trimmedPw.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPw }),
      });
      if (!res.ok) {
        setError(
          "No encontramos una cuenta con esas credenciales. Verifica tus datos e intenta de nuevo.",
        );
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as {
        user: {
          email: string;
          name: string;
          attemptsAllowed: number;
        };
      };
      writeSession(data.user);
      router.push("/dashboard");
    } catch {
      setError("No pudimos validar tu sesión. Intenta de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      {/* Visual panel */}
      <aside className="relative isolate hidden overflow-hidden bg-[var(--foreground)] text-white lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--foreground)]/65 via-[var(--foreground)]/55 to-[var(--foreground)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,rgba(208,19,23,0.3),transparent_55%)]"
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-white/15"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 1600 900"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="800" y1="0" x2="800" y2="900" />
          <circle cx="800" cy="450" r="120" />
          <circle cx="800" cy="450" r="3" fill="currentColor" stroke="none" />
          <rect x="0" y="280" width="160" height="340" />
          <rect x="1440" y="280" width="160" height="340" />
        </svg>

        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={INTER_LOGO}
              alt="Grupo Inter"
              className="h-8 w-auto brightness-0 invert"
            />
            <span className="h-6 w-px bg-white/30" />
            <span className="text-sm font-semibold tracking-wide">
              Polla Mundialista
            </span>
          </Link>

          <div className="max-w-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">
              Acceso · Edición Mundial 2026
            </p>
            <h2 className="mt-5 text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-5xl">
              Entra a tu
              <br />
              <span className="text-[var(--brand)]">boleta</span> de
              pronósticos.
            </h2>
            <p className="mt-5 text-white/75">
              Ingresa con el correo y contraseña que te fueron asignados.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-3 border border-white/15 bg-black/30 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--brand)]" />
            FIFA World Cup · 2026
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col bg-[var(--background)]">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4 lg:hidden">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={INTER_LOGO} alt="Grupo Inter" className="h-8 w-auto" />
            <span className="text-sm font-semibold">Polla Mundialista</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--foreground-soft)] hover:text-[var(--brand)]"
          >
            Volver
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-16 lg:px-16">
          <div className="w-full max-w-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">
              Iniciar sesión
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
              Bienvenido de vuelta.
            </h1>
            <p className="mt-3 text-[var(--foreground-soft)]">
              Usa tus credenciales para entrar.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-10 space-y-5"
              noValidate
            >
              <div>
                <label
                  htmlFor="email"
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--foreground-muted)]"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="mt-2 h-12 w-full border border-[var(--line)] bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--foreground-muted)]"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="mt-2 h-12 w-full border border-[var(--line)] bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--brand-dark)]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-sm bg-[var(--brand)] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Entrando…" : "Iniciar sesión"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
