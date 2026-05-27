import Link from "next/link";

const HERO_IMAGE =
  "https://d3i6fh83elv35t.cloudfront.net/static/2022/12/2022-12-03T214056Z_478945793_UP1EIC31INQ10_RTRMADP_3_SOCCER-WORLDCUP-ARG-AUS-REPORT-1024x621.jpg";

const INTER_LOGO =
  "https://www.interappsap.co/images/logo.png";

const matchRows = [
  { phase: "Acierto de ganador o empate", points: 3 },
  { phase: "Marcador exacto (120 min)", points: 5 },
];

const advanceRows = [
  { phase: "Equipo pasa a Octavos", points: 5 },
  { phase: "Equipo pasa a Cuartos", points: 7 },
  { phase: "Equipo pasa a Semifinal", points: 8 },
  { phase: "Equipo pasa a la Final", points: 10 },
];

const positionRows = [
  { phase: "Campeón", points: 15 },
  { phase: "Subcampeón", points: 10 },
  { phase: "Tercer puesto", points: 8 },
  { phase: "Cuarto puesto", points: 7 },
];

const prizeRows = [
  { place: "1er puesto", pct: "60%" },
  { place: "2do puesto", pct: "25%" },
  { place: "3er puesto", pct: "15%" },
];

function PitchMarkings() {
  return (
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
      <rect x="0" y="380" width="60" height="140" />
      <rect x="1440" y="280" width="160" height="340" />
      <rect x="1540" y="380" width="60" height="140" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--background)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={INTER_LOGO} alt="Grupo Inter" className="h-9 w-auto" />
            <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">
              Polla Mundialista
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="#puntuacion"
              className="hidden text-sm font-medium text-[var(--foreground-soft)] hover:text-[var(--brand)] md:inline"
            >
              Puntuación
            </a>
            <Link
              href="/login"
              className="rounded-sm bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-dark)]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="relative isolate overflow-hidden bg-[var(--foreground)] text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            alt="Estadio mundial"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--foreground)]/70 via-[var(--foreground)]/55 to-[var(--foreground)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(208,19,23,0.25),transparent_55%)]"
          />
          <PitchMarkings />

          <div className="relative border-b border-white/10 bg-black/30">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-white/70">
              <span>FIFA World Cup · 2026</span>
              <span className="hidden sm:inline">
                Polla Interna · Grupo Inter
              </span>
              <span className="text-[var(--brand)]">● En vivo pronto</span>
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 md:pb-32 md:pt-24">
            <div className="max-w-3xl">
              <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--brand)]">
                <span className="h-px w-8 bg-[var(--brand)]" />
                Edición Mundial 2026
              </p>
              <h1 className="mt-6 text-[44px] font-black uppercase leading-[0.95] tracking-[-0.02em] md:text-[80px]">
                Pronostica.
                <br />
                <span className="text-[var(--brand)]">Suma puntos.</span>
                <br />
                <span className="italic font-light normal-case tracking-tight">
                  Gana con tu equipo.
                </span>
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/80">
                La Polla Mundialista de Grupo Inter: pronostica los partidos del
                Mundial, acumula puntos y compite por los premios.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-sm bg-[var(--brand)] px-7 text-sm font-semibold text-white transition hover:bg-[var(--brand-dark)]"
                >
                  Entrar a mi polla
                </Link>
                <a
                  href="#puntuacion"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white underline-offset-[6px] hover:underline"
                >
                  Ver sistema de puntos
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* PUNTUACIÓN */}
        <section
          id="puntuacion"
          className="bg-[var(--foreground)] text-white"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">
                Reglamento y puntuación
              </p>
              <h2 className="mt-4 text-3xl font-black leading-[1.05] md:text-[40px]">
                Cada partido cuenta.
                <br />
                <span className="italic font-light text-white/80">
                  La final lo decide todo.
                </span>
              </h2>
              <p className="mt-5 text-white/70">
                Pronostica marcadores, equipos que avanzan y posiciones finales.
                El sistema premia la constancia en grupos y la visión de torneo
                en eliminatorias.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Premios */}
              <div>
                <div className="flex items-baseline justify-between border-b border-white/20 pb-3">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                    Premios
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                    Del acumulado
                  </span>
                </div>
                <dl className="mt-2 divide-y divide-white/10">
                  {prizeRows.map((r) => (
                    <div
                      key={r.place}
                      className="flex items-baseline justify-between py-3"
                    >
                      <dt className="text-sm">{r.place}</dt>
                      <dd className="font-mono text-2xl font-black tabular-nums text-[var(--brand)]">
                        {r.pct}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-white/50">
                  En caso de empate, el dinero se reparte en partes iguales.
                </p>
              </div>

              {/* Por partido */}
              <div>
                <div className="flex items-baseline justify-between border-b border-white/20 pb-3">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                    Por partido
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                    Todas las fases
                  </span>
                </div>
                <dl className="mt-2 divide-y divide-white/10">
                  {matchRows.map((r) => (
                    <div
                      key={r.phase}
                      className="flex items-baseline justify-between py-3"
                    >
                      <dt className="text-sm">{r.phase}</dt>
                      <dd className="font-mono text-2xl font-black tabular-nums text-[var(--brand)]">
                        {r.points.toString().padStart(2, "0")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-white/50">
                  Resultado válido hasta 120 min. Los penaltis no cuentan para
                  el marcador.
                </p>
              </div>

              {/* Progresión */}
              <div>
                <div className="flex items-baseline justify-between border-b border-white/20 pb-3">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                    Progresión
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                    Por equipo
                  </span>
                </div>
                <dl className="mt-2 divide-y divide-white/10">
                  {advanceRows.map((r) => (
                    <div
                      key={r.phase}
                      className="flex items-baseline justify-between py-3"
                    >
                      <dt className="text-sm">{r.phase}</dt>
                      <dd className="font-mono text-2xl font-black tabular-nums text-[var(--brand)]">
                        {r.points.toString().padStart(2, "0")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Posiciones finales */}
              <div>
                <div className="flex items-baseline justify-between border-b border-white/20 pb-3">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                    Posiciones finales
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                    Del torneo
                  </span>
                </div>
                <dl className="mt-2 divide-y divide-white/10">
                  {positionRows.map((r) => (
                    <div
                      key={r.phase}
                      className="flex items-baseline justify-between py-3"
                    >
                      <dt className="text-sm">{r.phase}</dt>
                      <dd className="font-mono text-2xl font-black tabular-nums text-[var(--brand)]">
                        {r.points.toString().padStart(2, "0")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Llaves perfectas */}
              <div className="md:col-span-2 lg:col-span-2">
                <div className="flex items-baseline justify-between border-b border-white/20 pb-3">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                    Llaves perfectas
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                    Desde octavos
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="border border-[var(--brand)]/40 bg-[var(--brand)]/10 p-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand)]">
                      Bono
                    </span>
                    <p className="mt-2 text-sm">
                      Acertar la ubicación exacta de los equipos en un cruce
                      (ej: 1° del Grupo A vs 2° del Grupo B) otorga{" "}
                      <strong className="text-[var(--brand)]">+5 pts</strong>{" "}
                      por cada llave perfecta.
                    </p>
                  </div>
                  <div className="border border-white/15 bg-white/5 p-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
                      Restricción
                    </span>
                    <p className="mt-2 text-sm text-white/80">
                      A partir de octavos, los puntos por partido (3 o 5 pts)
                      solo se otorgan si tuviste la{" "}
                      <strong className="text-white">llave perfecta</strong> en
                      ese cruce.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reglas técnicas */}
            <div className="mt-12 border-t border-white/15 pt-6">
              <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                Reglas técnicas
              </h3>
              <ul className="mt-4 grid gap-3 text-sm text-white/70 md:grid-cols-3">
                <li className="border-l-2 border-[var(--brand)]/50 pl-4">
                  Resultado válido hasta los 120 minutos (incluye prórroga).
                </li>
                <li className="border-l-2 border-[var(--brand)]/50 pl-4">
                  Penaltis no cuentan para el marcador final.
                </li>
                <li className="border-l-2 border-[var(--brand)]/50 pl-4">
                  Empate en eliminatorias requiere definir ganador por penaltis.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-y border-[var(--line)] bg-[var(--brand)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
            <p className="max-w-xl text-xl font-black leading-snug text-white md:text-2xl">
              El pitazo inicial está cerca. Entra y empieza a pronosticar.
            </p>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-sm bg-white px-7 text-sm font-semibold text-[var(--brand)] transition hover:bg-white/90"
            >
              Iniciar sesión
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--foreground)] text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm md:flex-row">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={INTER_LOGO}
              alt="Grupo Inter"
              className="h-7 w-auto brightness-0 invert"
            />
            <span>
              © {new Date().getFullYear()} · Polla Mundialista Grupo Inter
            </span>
          </div>
          <p className="text-white/50">Uso interno.</p>
        </div>
      </footer>
    </div>
  );
}
