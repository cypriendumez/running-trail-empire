/**
 * LA PAGE D'UNE FICHE D'INDICATEUR — composant serveur (04/10/2026).
 *
 * Ordre de lecture d'un client : la valeur et son verdict (le héros) → d'où vient le chiffre
 * (les composantes, avec leurs vraies valeurs) → l'évolution (le graphique) → le calcul
 * exact → les repères pour se situer → quoi faire → pourquoi c'est important. Les couleurs
 * suivent la tonalité de l'état, jamais l'inverse : un verdict rouge reste lisible en mots.
 */
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Calculator, CheckCircle2, Compass, Info, Lightbulb, Ruler } from "lucide-react";
import type { Fiche, Ton, CleIndicateur } from "@/lib/indicateurs/types";
import type { Textes } from "@/lib/indicateurs/textes";
import { GrapheIndicateur } from "./GrapheIndicateur";

const TON: Record<Ton, { texte: string; barre: string; pastille: string; fond: string }> = {
  excellent: { texte: "text-emerald-700", barre: "#059669", pastille: "bg-emerald-50 text-emerald-700 ring-emerald-200", fond: "linear-gradient(135deg,#064e3b 0%,#047857 48%,#0d9488 100%)" },
  bon: { texte: "text-teal-700", barre: "#0d9488", pastille: "bg-teal-50 text-teal-700 ring-teal-200", fond: "linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#14b8a6 100%)" },
  moyen: { texte: "text-amber-700", barre: "#d97706", pastille: "bg-amber-50 text-amber-700 ring-amber-200", fond: "linear-gradient(135deg,#78350f 0%,#b45309 52%,#d97706 100%)" },
  alerte: { texte: "text-rose-700", barre: "#e11d48", pastille: "bg-rose-50 text-rose-700 ring-rose-200", fond: "linear-gradient(135deg,#881337 0%,#be123c 52%,#e11d48 100%)" },
  neutre: { texte: "text-zinc-700", barre: "#52525b", pastille: "bg-zinc-100 text-zinc-700 ring-zinc-200", fond: "linear-gradient(135deg,#052e2b 0%,#065f46 50%,#0f766e 100%)" },
};

function Section({ icone: Icone, titre, children, className = "" }: { icone: typeof Info; titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
        <Icone className="h-3.5 w-3.5" aria-hidden /> {titre}
      </h2>
      {children}
    </section>
  );
}

export function FicheIndicateur({ fiche: f, titres, textes: c, lang, pannes = [] }: {
  fiche: Fiche; titres: Record<CleIndicateur, string>; textes: Textes["commun"]; lang: string; pannes?: string[];
}) {
  const ton = TON[f.statut?.ton ?? "neutre"];
  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {/* Retour + les autres fiches, à portée de pouce */}
      <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard" className="inline-flex w-fit flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:text-zinc-900 hover:ring-zinc-300">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {c.retour}
        </Link>
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" aria-label={c.toutesLesFiches}>
          {(Object.keys(titres) as CleIndicateur[]).map((k) => (
            <Link key={k} href={`/dashboard/indicateurs/${k}`} aria-current={k === f.cle ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${k === f.cle ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:text-zinc-900"}`}>
              {titres[k]}
            </Link>
          ))}
        </div>
      </nav>

      {pannes.length > 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{pannes.join(" · ")}</p>
      )}

      {/* ── Le héros : la valeur, son état, son verdict ── */}
      <header className="relative overflow-hidden rounded-[2rem] p-6 text-white shadow-2xl shadow-emerald-950/20 ring-1 ring-white/10 sm:p-8" style={{ background: ton.fond }}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-emerald-200/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/75">{f.titre}</h1>
            {f.statut && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">{f.statut.libelle}</span>
            )}
          </div>
          {f.vide ? (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/90">{f.vide}</p>
          ) : (
            <>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-6xl font-black leading-none tracking-tight tabular-nums drop-shadow-sm sm:text-7xl">{f.valeur}</span>
                {f.unite && <span className="text-xl font-semibold text-white/70">{f.unite}</span>}
              </div>
              <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-white/90 sm:text-base">{f.verdict}</p>
              {f.base && <p className="mt-3 text-[12px] text-white/60">{f.base}</p>}
            </>
          )}
        </div>
      </header>

      {f.vide ? (
        <>
          <Section icone={Info} titre={c.mesure}><p className="text-[15px] leading-relaxed text-zinc-600">{f.mesure}</p></Section>
          {f.liens && <Liens liens={f.liens} />}
        </>
      ) : (
        <>
          {/* ── D'où vient le chiffre ── */}
          {f.composantes && f.composantes.length > 0 && (
            <div className={`grid gap-3 ${f.composantes.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : f.composantes.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {f.composantes.map((co) => {
                const t = TON[co.ton];
                return (
                  <div key={co.libelle} className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{co.libelle}</div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className={`text-3xl font-bold tabular-nums ${co.ton === "neutre" ? "text-zinc-900" : t.texte}`}>{co.valeur}</span>
                      {co.unite && <span className="text-sm text-zinc-400">{co.unite}</span>}
                    </div>
                    {co.part != null && (
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, co.part))}%`, background: t.barre }} />
                      </div>
                    )}
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-zinc-500">{co.detail}</p>
                  </div>
                );
              })}
            </div>
          )}

          {f.graphe && (
            <Section icone={Compass} titre={f.graphe.titre}>
              <GrapheIndicateur g={f.graphe} lang={lang} />
            </Section>
          )}

          {f.tableaux?.map((tab) => (
            <Section key={tab.titre} icone={Ruler} titre={tab.titre}>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>{tab.colonnes.map((col, i) => (
                      <th key={col} className={`px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 ${i === 0 ? "text-left" : "text-right"}`}>{col}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {tab.lignes.map((l, li) => (
                      <tr key={li} className={l.actif ? "bg-emerald-50/60" : ""}>
                        {l.cellules.map((cel, i) => (
                          <td key={i} className={`border-t border-zinc-100 px-2 py-2.5 ${i === 0 ? "text-left font-medium text-zinc-700" : "text-right font-semibold tabular-nums text-zinc-900"} ${li === 0 ? "border-t-0" : ""}`}>{cel}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tab.note && <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">{tab.note}</p>}
            </Section>
          ))}

          <div className="grid gap-5 lg:grid-cols-5">
            <Section icone={Calculator} titre={c.calcul} className="lg:col-span-3">
              <ol className="space-y-3">
                {f.calcul.map((ligne, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500">{i + 1}</span>
                    <p className="text-[14px] leading-relaxed text-zinc-700">{ligne}</p>
                  </li>
                ))}
              </ol>
            </Section>
            {f.reperes && (
              <Section icone={Ruler} titre={f.reperes.titre} className="lg:col-span-2">
                <ul className="space-y-2">
                  {f.reperes.lignes.map((r) => {
                    const t = TON[r.ton];
                    return (
                      <li key={r.libelle} className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 ${r.actif ? `ring-2 ${t.pastille}` : "bg-zinc-50"}`}>
                        <span className="flex items-center gap-2.5 text-sm font-semibold text-zinc-700">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: t.barre }} />
                          {r.libelle}
                        </span>
                        <span className="text-[13px] tabular-nums text-zinc-500">{r.plage}</span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </div>

          {f.conseils.length > 0 && (
            <Section icone={Lightbulb} titre={c.conseils}>
              <ul className="grid gap-3 md:grid-cols-2">
                {f.conseils.map((co) => (
                  <li key={co} className="flex gap-3 rounded-2xl bg-emerald-50/60 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden />
                    <p className="text-[14px] leading-relaxed text-zinc-700">{co}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <Section icone={Info} titre={c.mesure}><p className="text-[14px] leading-relaxed text-zinc-600">{f.mesure}</p></Section>
            <Section icone={BookOpen} titre={c.pourquoi}><p className="text-[14px] leading-relaxed text-zinc-600">{f.pourquoi}</p></Section>
          </div>

          {f.liens && <Liens liens={f.liens} />}

          {f.sources && f.sources.length > 0 && (
            <div className="px-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">{c.sources}</div>
              <ul className="mt-2 space-y-1">
                {f.sources.map((s) => <li key={s} className="text-[12px] leading-relaxed text-zinc-400">{s}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Liens({ liens }: { liens: { libelle: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {liens.map((l, i) => (
        <Link key={l.href} href={l.href}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${i === 0 ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-zinc-300"}`}>
          {l.libelle} <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      ))}
    </div>
  );
}
