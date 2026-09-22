import {
  Activity, Gauge, Footprints, TrendingUp, HeartPulse, Mountain, Target, GraduationCap, Utensils, Shirt, Flag, Shield,
  BrainCircuit, HeartHandshake, ThermometerSun, AlertTriangle, ArrowRight, BookOpenCheck, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { normLang } from "@/lib/i18n/translations";
import { getCoursContent } from "@/data/cours";
import { fmtPaceSec } from "@/lib/running/fitness";
import { CoursChat } from "@/components/cours/CoursChat";
import { CoursSommaire } from "@/components/cours/CoursSommaire";
import { CoursSearch } from "@/components/cours/CoursSearch";
import { CoursQuiz } from "@/components/cours/CoursQuiz";
import { CoursFlashcards } from "@/components/cours/CoursFlashcards";
import { AskCoachButton } from "@/components/cours/AskCoachButton";
import { CoursBarreProgression, CoursMarquerLu, CoursSommaireMobile } from "@/components/cours/CoursProgression";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cours du coureur" };

// Structure visuelle par chapitre (stable inter-langues, jointe au contenu par id).
const META: Record<string, { icon: typeof Activity; from: string; to: string; accent: string }> = {
  physio:    { icon: Activity,   from: "#059669", to: "#0d9488", accent: "text-emerald-700" },
  zones:     { icon: Gauge,      from: "#2563eb", to: "#4f46e5", accent: "text-blue-700" },
  seances:   { icon: Footprints, from: "#ea580c", to: "#d97706", accent: "text-orange-700" },
  charge:    { icon: TrendingUp, from: "#7c3aed", to: "#9333ea", accent: "text-violet-700" },
  techni:    { icon: Footprints, from: "#db2777", to: "#e11d48", accent: "text-pink-700" },
  recup:     { icon: HeartPulse, from: "#0d9488", to: "#0891b2", accent: "text-teal-700" },
  nutrition: { icon: Utensils,   from: "#ea580c", to: "#f59e0b", accent: "text-orange-700" },
  trail:     { icon: Mountain,   from: "#d97706", to: "#ca8a04", accent: "text-amber-700" },
  jourj:     { icon: Flag,       from: "#e11d48", to: "#f43f5e", accent: "text-rose-700" },
  materiel:  { icon: Shirt,      from: "#0891b2", to: "#2563eb", accent: "text-cyan-700" },
  blessures: { icon: Shield,     from: "#dc2626", to: "#ea580c", accent: "text-red-700" },
  plan:      { icon: Target,     from: "#059669", to: "#16a34a", accent: "text-emerald-700" },
  coach:     { icon: BrainCircuit, from: "#0f766e", to: "#0891b2", accent: "text-teal-700" },
  femmes:    { icon: HeartHandshake, from: "#be185d", to: "#e11d48", accent: "text-pink-700" },
  milieu:    { icon: ThermometerSun, from: "#b45309", to: "#0369a1", accent: "text-amber-700" },
};

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));

export default async function CoursPage() {
  // Langue + données perso (VMA, FC max, cadence) — la page parle la langue de l'utilisateur
  // et le cours affiche SES chiffres.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let lang = "fr";
  let vma: number | null = null, maxHr: number | null = null, cadence: number | null = null;
  if (user) {
    const [profileRes, baselineRes, workoutsRes] = await Promise.all([
      supabase.from("profiles").select("preferred_language").eq("id", user.id).single(),
      supabase.from("performance_baselines").select("vma_kmh,max_hr").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("avg_cadence_spm").eq("user_id", user.id).order("date", { ascending: false }).limit(12),
    ]);
    lang = normLang(profileRes.data?.preferred_language ?? "fr");
    vma = Number(baselineRes.data?.vma_kmh) || null;
    maxHr = Number(baselineRes.data?.max_hr) || null;
    const cads = (workoutsRes.data ?? []).map((w) => Number(w.avg_cadence_spm)).filter((x) => x > 0);
    cadence = cads.length ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) : null;
  }
  const { chapters, quiz, ui } = getCoursContent(lang);

  // ── Repères personnalisés : calculés depuis TES données, par (chapitre, index de notion) ──
  const pace = (pct: number) => (vma ? fmtPaceSec(3600 / (vma * pct)) : "");
  const bpm = (pct: number) => (maxHr ? Math.round(maxHr * pct) : 0);
  const perso: Record<string, string> = {};
  if (vma) {
    perso["physio:1"] = fill(ui.perso.vma, { vma, pace: pace(1) });
    perso["physio:2"] = fill(ui.perso.seuil, { lo: pace(0.88), hi: pace(0.82) });
    perso["seances:2"] = fill(ui.perso.zonePace, { lo: pace(1.05), hi: pace(0.95) });
    perso["seances:4"] = fill(ui.perso.zonePace, { lo: pace(0.88), hi: pace(0.82) });
  }
  if (maxHr) {
    const z = (i: number, lo: number, hi: number, label: string) => {
      perso[`zones:${i}`] = fill(ui.perso.zoneBpm, { zone: label, lo: bpm(lo), hi: bpm(hi) });
    };
    z(0, 0.6, 0.7, "Z1"); z(1, 0.7, 0.8, "Z2"); z(2, 0.8, 0.87, "Z3"); z(3, 0.87, 0.92, "Z4"); z(4, 0.92, 1.0, "Z5");
    if (vma) {
      perso["zones:1"] += ` · ${fill(ui.perso.zonePace, { lo: pace(0.75), hi: pace(0.65) })}`;
      perso["zones:3"] += ` · ${fill(ui.perso.zonePace, { lo: pace(0.88), hi: pace(0.82) })}`;
      perso["zones:4"] += ` · ${fill(ui.perso.zonePace, { lo: pace(1.05), hi: pace(0.95) })}`;
    }
  }
  if (cadence) perso["techni:0"] = fill(ui.perso.cadence, { spm: cadence });

  const totalNotions = chapters.reduce((s, c) => s + c.concepts.length, 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero — resserré le 21/09/2026 (Cyprien : « trop grand, il prend trop de place ») :
          padding 40→20 px, titre 4xl→3xl, sous-titre plus petit et limité à 2 lignes sur
          téléphone. */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 45%,#0d9488 100%)" }}>
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-5 sm:py-7 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur-md">
            <GraduationCap className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-50">{ui.heroEyebrow}</span>
          </span>
          <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-sm">{ui.heroTitle}</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] sm:text-[15px] leading-relaxed text-white/85 line-clamp-2 sm:line-clamp-none">{ui.heroSub}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[fill(ui.chipChapters, { n: chapters.length }), fill(ui.chipNotions, { n: totalNotions }), ui.chipCoach].map((c) => (
              <span key={c} className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/90 ring-1 ring-white/15 backdrop-blur-md">
                {c}
              </span>
            ))}
          </div>
          {/* La progression du lecteur — locale à l'appareil, remplie après montage. */}
          <CoursBarreProgression ids={chapters.map((c) => c.id)} gabarit={ui.progression.compteur} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-0 py-6 sm:px-5 sm:py-8">
        {/* ⚠️ `grid-cols-12 gap-8` SUR TÉLÉPHONE = 11 GOUTTIÈRES DE 32 px = 352 px DE VIDE dans
            une colonne de 287 : la colonne de contenu débordait de 65 px à droite (mesuré le
            22/09/2026). Une seule colonne sous lg ; la grille à douze colonnes n'a de sens
            qu'avec le sommaire latéral. */}
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-12 lg:gap-8">
          {/* Sommaire — scroll-spy (la section lue se surligne) */}
          <aside className="hidden lg:block lg:col-span-3">
            <CoursSommaire label={ui.sommaire} items={chapters.map((ch) => ({ id: ch.id, title: ch.title, color: META[ch.id]?.from ?? "#059669" }))} />
          </aside>

          {/* Contenu */}
                    <div className="min-w-0 space-y-12 lg:col-span-9">
            <div className="space-y-4">
              {/* Sur téléphone, le sommaire n'existait pas (aside `hidden lg:block`) : une
                  rangée de puces qui défile, la section lue en vert. */}
              <CoursSommaireMobile items={chapters.map((ch) => ({ id: ch.id, title: ch.title, color: META[ch.id]?.from ?? "#059669" }))} />
              {/* Recherche instantanée dans les notions du cours */}
              <CoursSearch
                placeholder={ui.searchPlaceholder}
                emptyText={ui.searchEmpty}
                items={chapters.flatMap((ch) => ch.concepts.map((c) => ({ slug: slugify(`${ch.id}-${c.term}`), term: c.term, short: c.short, chapter: ch.title, color: META[ch.id]?.from ?? "#059669" })))}
              />

              {/* Chat IA — pose ta question (accessible à tous) */}
              <CoursChat />
            </div>

            {chapters.map((ch) => {
              const m = META[ch.id] ?? META.physio;
              const Icon = m.icon;
              return (
                <section key={ch.id} id={ch.id} className="scroll-mt-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: `linear-gradient(135deg,${m.from},${m.to})` }}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <h2 className="text-xl font-bold text-zinc-900 leading-tight">{ch.title}</h2>
                    </div>
                    <AskCoachButton label={ui.askCoach} question={fill(ui.askCoachQuestion, { chapter: ch.title.replace(/^\d+ · /, "") })} />
                  </div>
                  <p className="mb-3 text-sm text-zinc-500 leading-relaxed">{ch.intro}</p>
                  {/* Ce qui fait d'un glossaire un cours : l'objectif annoncé AVANT les notions. */}
                  {ch.objectif && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed" style={{ borderColor: `${m.from}33`, background: `${m.from}0d` }}>
                      <BookOpenCheck className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: m.from }} aria-hidden />
                      <p className="text-zinc-800"><b className={m.accent}>{ui.objectifLabel}</b> {ch.objectif}</p>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ch.concepts.map((c, i) => (
                      <div key={c.term} id={slugify(`${ch.id}-${c.term}`)} className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="mr-0.5 inline-block h-2 w-2 flex-shrink-0 self-center rounded-full" style={{ background: m.from }} />
                          <h3 className="font-bold text-zinc-900">{c.term}</h3>
                          {c.short && <span className="text-xs italic text-zinc-400">— {c.short}</span>}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{c.def}</p>
                        {c.why && <p className="mt-2 text-sm leading-relaxed text-zinc-600"><b className={m.accent}>{ui.whyLabel}</b> {c.why}</p>}
                        {c.repere && <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500" style={{ borderLeft: `3px solid ${m.from}` }}><b className="text-zinc-700">{ui.repereLabel}</b> {c.repere}</div>}
                        {perso[`${ch.id}:${i}`] && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
                            <Target className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" aria-hidden />
                            <span><b>{ui.persoLabel}</b> {perso[`${ch.id}:${i}`]}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Erreurs classiques + action de la semaine (dans l'app) + sources vérifiées. */}
                  {(ch.erreurs?.length || ch.action) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {ch.erreurs && ch.erreurs.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800"><AlertTriangle className="h-4 w-4" aria-hidden />{ui.erreursLabel}</div>
                          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-amber-950">
                            {ch.erreurs.map((e) => <li key={e} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />{e}</li>)}
                          </ul>
                        </div>
                      )}
                      {ch.action && (
                        <Link href={ch.action.href} className="group flex flex-col justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 transition hover:border-emerald-400 hover:shadow-md">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800"><Target className="h-4 w-4" aria-hidden />{ui.actionLabel}</div>
                            <p className="mt-2 text-sm leading-relaxed text-emerald-950">{ch.action.text}</p>
                          </div>
                          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 group-hover:gap-2.5 transition-all">{ch.action.label}<ArrowRight className="h-4 w-4" /></span>
                        </Link>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    {ch.sources && ch.sources.length > 0 ? (
                      <details className="min-w-0 text-xs text-zinc-500">
                        <summary className="cursor-pointer select-none font-semibold text-zinc-600 hover:text-zinc-900">{ui.sourcesLabel} · {ch.sources.length}</summary>
                        <ul className="mt-2 space-y-1">
                          {ch.sources.map((src) => (
                            <li key={src.pmid}>
                              <a href={`https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-emerald-700 hover:underline">
                                {src.label} — <i>{src.titre}</i><ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : <span />}
                    <CoursMarquerLu id={ch.id} libelles={ui.progression} />
                  </div>
                </section>
              );
            })}

            {/* Quiz — ancre le cours par la pratique */}
            <CoursQuiz bank={quiz} ui={ui.quiz} />

            {/* Flashcards — révision espacée des notions ratées au quiz */}
            <CoursFlashcards ui={ui.flash} />

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-sm text-emerald-900" dangerouslySetInnerHTML={{ __html: ui.resume }} />

            {/* Du cours à la pratique — les outils du site qui appliquent ces notions */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { href: "/dashboard/ghost-runner", title: ui.practice.ghost, desc: ui.practice.ghostDesc },
                { href: "/dashboard", title: ui.practice.dash, desc: ui.practice.dashDesc },
                { href: "/dashboard/health", title: ui.practice.sante, desc: ui.practice.santeDesc },
              ].map((l) => (
                <a key={l.href} href={l.href}
                  className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900">{l.title}</span>
                    <span className="text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">→</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{l.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
