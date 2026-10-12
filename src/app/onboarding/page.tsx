"use client";

import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { OB } from "./onboardingI18n";
import { FOCUS, SEGMENT, TUILE, CHAMP } from "./habillage";
import { EtapeMontre } from "./EtapeMontre";
import type { MarqueId } from "./marquesMontre";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthLabel } from "@/data/healthCatalog";
import { TERRAINS, terrainLabel } from "@/data/terrainCatalog";

/**
 * LE QUESTIONNAIRE D'INSCRIPTION — refondu le 11/10/2026.
 *
 * Ce qui a changé, et pourquoi (Cyprien : « ça ne rend pas professionnel, ça fait IA ») :
 *  · QUATRE ÉTAPES ÉQUILIBRÉES au lieu d'une première page de douze questions suivie de deux
 *    pages presque vides : Profil, Entraînement, Santé, Montre.
 *  · DE VRAIS BOUTONS RADIO ET CASES À COCHER (clavier, lecteurs d'écran), dessinés en
 *    contrôles segmentés ou en tuiles neutres. Avant : chaque choix était une pastille verte
 *    pleine — douze rangées de pastilles identiques, la signature d'une page générée.
 *  · Une seule feuille blanche à filets fins plutôt qu'une carte par bloc, des aides lisibles
 *    (plus de gris en 11 px), l'unité DANS le champ, une barre d'actions fixe avec « Retour »
 *    à chaque étape — l'étape Montre était un cul-de-sac.
 *  · Plus d'animation de glissement à chaque étape, plus d'emoji ni de fausse fenêtre de
 *    navigateur dans l'étape Montre : une liste numérotée, parce que c'en est une.
 *
 * Décisions du 11/10/2026 : le chronotype est retiré (il ne changeait aucune séance) ; le
 * volume visé est désormais ENREGISTRÉ (il était jeté) et sert de plafond de progression ;
 * le dénivelé agit sur le plan (lib/coach/denivele).
 *
 * La montre est en DERNIER et FACULTATIVE : exiger un compte intervals.icu avant tout usage
 * de l'app est ce qui fait le plus abandonner à l'inscription. Aucune VMA n'est demandée : la
 * toute première séance prescrite EST le test VMA (voir le verrou dans lib/ai/autoCoach).
 */
type Step = "profile" | "training" | "health" | "watch" | "done";
const STEPS: Step[] = ["profile", "training", "health", "watch", "done"];
const ETAPES = 4;

/** Une question de la feuille : intitulé, aide d'une phrase, contrôle. */
function Question({ id, titre, aide, marque, children }: {
  id: string; titre: string; aide?: string;
  /** Petite mention à droite de l'intitulé (« Facultatif », « À renseigner »). */
  marque?: { texte: string; ton: "neutre" | "alerte" };
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 px-5 py-6 sm:px-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-t`} className="text-[15px] font-semibold text-zinc-900">{titre}</h2>
        {marque && (
          <span className={`shrink-0 text-xs font-medium ${marque.ton === "alerte" ? "text-amber-700" : "text-zinc-500"}`}>{marque.texte}</span>
        )}
      </div>
      {aide && <p id={`${id}-a`} className="mt-1 max-w-prose text-sm leading-relaxed text-zinc-500">{aide}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Choix UNIQUE : de vrais boutons radio (flèches du clavier, lecteur d'écran). */
function Choix<V extends string | number>({ id, options, valeur, onChange, variante, grille, aide }: {
  id: string; options: readonly { v: V; l: string }[]; valeur: V | null | "";
  onChange: (v: V) => void; variante: "segment" | "tuiles";
  /** Classes de grille, écrites en entier (Tailwind ne génère pas les classes composées). */
  grille: string; aide?: boolean;
}) {
  const segment = variante === "segment";
  return (
    <div role="radiogroup" aria-labelledby={`${id}-t`} aria-describedby={aide ? `${id}-a` : undefined}
      className={`grid ${grille} ${segment ? "gap-1 rounded-xl bg-zinc-100 p-1" : "gap-2"}`}>
      {options.map((o) => {
        const oid = `${id}-${o.v}`;
        const coche = valeur === o.v;
        return (
          <label key={String(o.v)} htmlFor={oid} className="relative cursor-pointer">
            <input id={oid} type="radio" name={id} value={String(o.v)} checked={coche}
              onChange={() => onChange(o.v)} className="peer sr-only" />
            <span className={segment ? SEGMENT : TUILE}>
              {!segment && coche && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
              {o.l}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Choix MULTIPLE : de vraies cases à cocher, la coche double la couleur. */
function Cases({ id, options, valeurs, onToggle, disposition, aide }: {
  id: string; options: readonly { v: string; l: string; sr?: string }[]; valeurs: readonly string[];
  onToggle: (v: string) => void; disposition: string; aide?: boolean;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-t`} aria-describedby={aide ? `${id}-a` : undefined} className={disposition}>
      {options.map((o) => {
        const oid = `${id}-${o.v}`;
        const coche = valeurs.includes(o.v);
        return (
          <label key={o.v} htmlFor={oid} className="relative cursor-pointer">
            <input id={oid} type="checkbox" checked={coche} onChange={() => onToggle(o.v)} className="peer sr-only" />
            <span className={TUILE}>
              {coche && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
              <span aria-hidden={o.sr ? true : undefined}>{o.l}</span>
              {o.sr && <span className="sr-only">{o.sr}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Mesure chiffrée, unité DANS le champ (16 px sur mobile : iOS ne zoome pas). */
function Mesure({ id, label, unite, valeur, onChange, placeholder, min, max }: {
  id: string; label: string; unite: string; valeur: string; onChange: (v: string) => void;
  placeholder: string; min: number; max: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">{label}</label>
      <div className="relative mt-1.5">
        <input id={id} type="number" inputMode="numeric" value={valeur} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} min={min} max={max} className={CHAMP} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">{unite}</span>
      </div>
    </div>
  );
}

/** « Taille (cm) » → « Taille » : l'unité est désormais affichée dans le champ. */
const sansUnite = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "");

export default function OnboardingPage() {
  // ⚠️ Les libellés visibles n'étaient reliés à aucun champ : un lecteur d'écran
  // annonçait le `placeholder` à leur place. `useId()` évite toute collision.
  const cid = useId();
  const router = useRouter();
  const { lang } = useT();
  const tr = (k: string, v?: Record<string, string | number>) => {
    let s = (OB[lang] ?? OB.fr)[k] ?? OB.fr[k] ?? k;
    // `split/join` et non `replace` : une phrase peut citer deux fois la même variable
    // (« une fenêtre {m} s'ouvre : connecte-toi avec ton compte {m} »).
    if (v) for (const key in v) s = s.split(`{${key}}`).join(String(v[key]));
    return s;
  };

  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  // L'étape où l'on a tenté de continuer avec des réponses manquantes : on ne signale
  // un manque qu'APRÈS cette tentative, pas en rouge dès l'arrivée sur la page.
  const [tente, setTente] = useState<Step | null>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);

  const [profile, setProfile] = useState({
    age: "",
    height_cm: "",
    weight_kg: "",
    // Pas de valeur par défaut sur le sexe : un défaut « male » silencieux fausserait tout le
    // coaching d'une athlète qui n'aurait pas touché au champ. On l'oblige à choisir.
    gender: "" as "" | "male" | "female" | "other",
    is_female_cycle_sync: false,
    warmup_min: 15,
    cooldown_min: 10,
    long_run_mode: "run" as "run" | "bike",
    // Contexte d'entraînement : aucun défaut, ces réponses changent radicalement la prescription.
    running_years: null as number | null,
    // Terrains MULTIPLES : beaucoup alternent route en semaine et sentier/sable le week-end.
    main_terrains: [] as string[],
    elevation_pref: "" as "" | "evite" | "modere" | "aime" | "specialiste",
    // Santé : contraint la prescription (la santé prime sur la performance).
    health_conditions: [] as string[],
    injury_zones: [] as string[],
    health_notes: "",
    // Disponibilités : sans elles le plan remplit 7 jours pour tout le monde.
    days_per_week: null as number | null,
    available_days: [0, 1, 2, 3, 4, 5, 6] as number[],
  });
  // Volume visé : `null` tant que le curseur n'a pas été touché — la valeur affichée par
  // défaut n'est pas une réponse (voir lib/coach/volumeCible).
  const [volume, setVolume] = useState<number | null>(null);
  // « Rien à signaler » coché explicitement — on distingue « pas de problème de santé »
  // de « l'utilisateur a survolé la question sans répondre ».
  const [healthNone, setHealthNone] = useState(false);

  // Bascule d'une case santé. Cocher une pathologie annule « rien à signaler ».
  const toggleHealth = (key: "health_conditions" | "injury_zones", slug: string) => {
    setHealthNone(false);
    setProfile(p => ({ ...p, [key]: p[key].includes(slug) ? p[key].filter(s => s !== slug) : [...p[key], slug] }));
  };
  // Une réponse santé est donnée soit en cochant au moins une entrée, soit « rien à signaler ».
  const healthAnswered = healthNone || profile.health_conditions.length > 0 || profile.injury_zones.length > 0;

  // FC déclarées — FACULTATIVES. Vides, le coach s'en passe très bien (migration 029).
  const [fc, setFc] = useState({ max_hr: "", resting_hr: "" });

  // Étape Montre (le détail vit dans EtapeMontre.tsx) : la page ne garde que ce dont sa
  // barre d'actions a besoin — la marque choisie et « la clé est enregistrée ».
  const [marque, setMarque] = useState<MarqueId | null>(null);
  const [watchSaved, setWatchSaved] = useState(false);

  const stepIdx = STEPS.indexOf(step);

  // Nouvelle étape : on remonte en haut et le focus va au titre (lecteur d'écran, clavier).
  useEffect(() => {
    window.scrollTo({ top: 0 });
    titreRef.current?.focus({ preventScroll: true });
  }, [step]);

  // ── Ce qui manque, étape par étape (l'identifiant sert à y amener la personne) ──
  const sansEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "");
  const manquants = (s: Step): { id: string; label: string }[] => {
    const m: [boolean, string, string][] =
      s === "profile" ? [
        [!profile.age, `${cid}-age`, tr("age")],
        [!profile.height_cm, `${cid}-taille`, sansUnite(tr("height"))],
        [!profile.weight_kg, `${cid}-poids`, sansUnite(tr("weight"))],
        [!profile.gender, `${cid}-genre`, tr("gender")],
      ] : s === "training" ? [
        [profile.running_years == null, `${cid}-anciennete`, tr("expTitle")],
        [profile.days_per_week == null, `${cid}-frequence`, tr("dpwShort")],
        [profile.main_terrains.length === 0, `${cid}-terrains`, tr("terrTitle")],
        [!profile.elevation_pref, `${cid}-denivele`, tr("elevTitle")],
      ] : s === "health" ? [
        [!healthAnswered, `${cid}-sante`, tr("healthTitle")],
      ] : [];
    return m.filter(([manque]) => manque).map(([, id, label]) => ({ id, label: sansEmoji(label) }));
  };
  const manqueIci = tente === step ? manquants(step) : [];
  const manque = (id: string) => manqueIci.some(x => x.id === id);
  const marqueManque = (id: string) => (manque(id) ? { texte: tr("missingShort"), ton: "alerte" as const } : undefined);

  function next() { if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]); }
  function prev() { if (stepIdx > 0) { setTente(null); setStep(STEPS[stepIdx - 1]); } }

  /** « Continuer » reste cliquable : il dit ce qui manque et y amène, plutôt qu'un bouton mort. */
  function continuer() {
    const m = manquants(step);
    if (m.length) {
      setTente(step);
      const cible = document.getElementById(m[0].id);
      const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      cible?.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "center" });
      (cible?.querySelector("input") ?? cible)?.focus?.({ preventScroll: true });
      return;
    }
    setTente(null);
    next();
  }

  async function handleFinish() {
    setLoading(true);
    // La montre n'est plus bloquante : le plan d'entraînement fonctionne sans elle, la
    // synchro peut être branchée plus tard depuis l'onglet Sync Montre.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: profileError } = await supabase.from("profiles").update({
      age: parseInt(profile.age),
      height_cm: parseInt(profile.height_cm),
      weight_kg: parseFloat(profile.weight_kg),
      gender: profile.gender,
      is_female_cycle_sync: profile.is_female_cycle_sync,
      // Pas de VMA à l'inscription → mode par défaut prudent ; le coach l'affine ensuite.
      mode: "ludique",
      onboarding_completed: true,
    }).eq("id", user.id);

    // ⚠️ CETTE ÉCRITURE ÉTAIT MUETTE (relevé le 11/10/2026) : son résultat n'était pas lu.
    // Elle porte l'ancienneté, le dénivelé et la santé — trois réponses qui changent la
    // prescription. Un échec doit se voir, comme pour les disponibilités plus bas.
    const { error: eContexte } = await supabase.from("profiles").update({
      warmup_min: profile.warmup_min,
      cooldown_min: profile.cooldown_min,
      long_run_mode: profile.long_run_mode,
      // `|| null` : les contraintes CHECK en base refusent la chaîne vide.
      running_years: profile.running_years,
      elevation_pref: profile.elevation_pref || null,
      health_conditions: profile.health_conditions,
      injury_zones: profile.injury_zones,
      health_notes: profile.health_notes.trim() || null,
      health_declared: healthAnswered,
    }).eq("id", user.id);

    /**
     * ⚠️ CES ÉCRITURES ÉTAIENT MUETTES, SOUS UNE RAISON QUI N'EXISTE PLUS.
     *
     * Elles sont ISOLÉES pour de bonnes raisons — une colonne manquante ne doit pas
     * emporter la sauvegarde de l'ancienneté, du dénivelé et de la santé. Mais les
     * commentaires les justifiaient par « ces colonnes arrivent avec la migration 011 »
     * et « avec la migration 009 » : les quatre ont été VÉRIFIÉES en base le
     * 04/09/2026, elles existent. Isolées, oui ; muettes, non.
     *
     * Ce que coûtait le silence, ici précisément : le plan d'entraînement est généré
     * JUSTE APRÈS, à partir de ces disponibilités. Un athlète qui déclare courir trois
     * jours par semaine et dont l'écriture échoue reçoit un plan bâti sur autre chose,
     * dès sa première minute dans l'application — et rien, nulle part, ne le dit.
     */
    const echecs: string[] = [];
    const noter = (e: { message: string } | null, quoi: string) => { if (e) echecs.push(`${quoi}: ${e.message}`); };
    noter(eContexte, "contexte et santé");

    const { error: eDispo } = await supabase.from("profiles").update({
      days_per_week: profile.days_per_week,
      available_days: profile.available_days,
    }).eq("id", user.id);
    noter(eDispo, "disponibilités");

    // Terrains multiples — écriture ISOLÉE, avec repli sur l'ancienne colonne mono-choix.
    const { error: eTer } = await supabase.from("profiles")
      .update({ main_terrains: profile.main_terrains }).eq("id", user.id);
    noter(eTer, "terrains");
    const { error: eTer1 } = await supabase.from("profiles")
      .update({ main_terrain: profile.main_terrains[0] ?? null }).eq("id", user.id);
    noter(eTer1, "terrain principal");

    // ⚠️ AUCUNE VMA N'EST PLUS ÉCRITE À L'INSCRIPTION. La VMA se mesure via le test que le
    // coach prescrit en première séance, et l'athlète en saisit le résultat depuis son
    // tableau de bord (/api/vma, client de service). L'inscription n'a donc plus rien à
    // dire sur `performance_baselines` — elle ne l'écrit plus depuis le navigateur.

    /**
     * FC DÉCLARÉES ET VOLUME VISÉ (facultatifs) — ÉCRITURES ISOLÉES, NON BLOQUANTES.
     *
     * Les FC vivent sur `profiles` (migration 029), le volume visé aussi (migration 035,
     * à lancer à la main). ⚠️ Tant qu'une colonne manque, PostgREST répond « column does not
     * exist ». Faire échouer « Terminer » pour ça reproduirait EXACTEMENT le défaut du
     * 14/09/2026 — 100 % des inscrits bloqués — et cette fois pour une donnée FACULTATIVE.
     * L'échec va donc au journal (jamais muet) mais n'entre pas dans `echecs`.
     */
    const journaliserFacultatif = (quoi: string, message: string) => {
      fetch("/api/log-error", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ source: "onboarding", message: `${quoi}: ${message}`, url: location.href }),
      }).catch(() => {});
    };
    if (fc.max_hr || fc.resting_hr) {
      const { error: eFc } = await supabase.from("profiles").update({
        max_hr: parseInt(fc.max_hr) || null,
        resting_hr: parseInt(fc.resting_hr) || null,
      }).eq("id", user.id);
      if (eFc) {
        console.error("[inscription] FC déclarées non enregistrées :", eFc.message);
        // Facultatives, donc non bloquantes — mais plus jamais muettes : la console du
        // navigateur n'est lue par personne, le journal /admin › Bugs l'est.
        fetch("/api/log-error", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
          body: JSON.stringify({ source: "onboarding", message: `fc: ${eFc.message}`, url: location.href }),
        }).catch(() => {});
      }
    }
    if (volume != null) {
      const { error: eVol } = await supabase.from("profiles").update({ target_weekly_km: volume }).eq("id", user.id);
      if (eVol) journaliserFacultatif("volume visé", eVol.message);
    }

    if (profileError || echecs.length) {
      if (profileError) echecs.unshift(`profil: ${profileError.message}`);
      console.error("[inscription] champs non enregistrés :", echecs);
      // ⚠️ LA CONSOLE DU NAVIGATEUR N'EST LUE PAR PERSONNE. Le premier vrai inscrit a vu ce
      // toast le 14/09/2026 (politique RLS absente sur performance_baselines) : l'échec n'a
      // existé que sur son écran. Il est désormais journalisé, visible dans l'espace coach.
      try {
        fetch("/api/log-error", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
          body: JSON.stringify({ source: "onboarding", message: echecs.join(" · "), url: location.href, meta: { echecs } }),
        }).catch(() => {});
      } catch { /* le journal ne doit pas ajouter une erreur à l'erreur */ }
      toast.error(tr("tSaveError"));
      setLoading(false);
      return;
    }

    // ── PLAN GÉNÉRÉ TOUT DE SUITE, sans attendre le cron de 3 h 30 ──────────────
    //
    // Deux problèmes réglés d'un coup. D'abord l'expérience : un athlète inscrit à 10 h
    // découvrait un calendrier VIDE jusqu'au lendemain matin. Ensuite le quota : tant
    // qu'aucune séance n'existe, le tableau de bord interroge Gemini à chaque affichage
    // pour proposer une séance de remplacement — et le palier gratuit ne tolère que
    // 20 requêtes par jour. Quelques inscriptions le même après-midi épuisaient tout.
    //
    // `await` volontaire : la génération est déterministe et rapide, et on veut que le
    // calendrier soit prêt AVANT que l'athlète n'y arrive. `catch` silencieux : le profil
    // est déjà enregistré, et le cron de la nuit rattrapera de toute façon — un échec ici
    // ne doit pas retenir l'écran de fin.
    await fetch("/api/coach/generate", { method: "POST" }).catch(() => { /* le cron rattrapera */ });

    setStep("done");
    setLoading(false);
  }

  // ── Contenu ─────────────────────────────────────────────────────────────────────
  const titres: Record<Exclude<Step, "done">, [string, string]> = {
    profile: [tr("t1"), tr("d1")],
    training: [tr("t2"), tr("d2")],
    health: [tr("t3"), tr("d3")],
    watch: [tr("t4"), tr("d4")],
  };
  const minutes = [5, 10, 15, 20, 25, 30].map(m => ({ v: m, l: `${m}` }));
  // Les jours, du lundi au dimanche ; les valeurs restent au format JS (0 = dimanche).
  // Le nom complet du jour, dans la langue de la personne, pour les lecteurs d'écran.
  const jourLong = (d: number) => new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + d)));

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* En-tête fixe : la marque, l'étape, la progression. */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={26} />
            <Wordmark className="text-lg" />
          </div>
          {step !== "done" && (
            <span className="text-sm tabular-nums text-zinc-500">{tr("stepOf", { n: stepIdx + 1, t: ETAPES })}</span>
          )}
        </div>
        {step !== "done" && (
          <div role="progressbar" aria-valuemin={1} aria-valuemax={ETAPES} aria-valuenow={stepIdx + 1}
            aria-label={tr("stepOf", { n: stepIdx + 1, t: ETAPES })}
            className="mx-auto flex max-w-2xl gap-1 px-4 pb-3 sm:px-6">
            {Array.from({ length: ETAPES }, (_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIdx ? "bg-emerald-600" : "bg-zinc-200"}`} />
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-44 pt-8 sm:px-6 sm:pt-12">
        {step !== "done" && (
          <>
            <h1 ref={titreRef} tabIndex={-1} className="text-[26px] font-semibold leading-tight tracking-tight text-zinc-900 outline-none sm:text-3xl">
              {titres[step][0]}
            </h1>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-zinc-600">{titres[step][1]}</p>
          </>
        )}

        {/* ── 1. PROFIL ── */}
        {step === "profile" && (
          <div className="mt-8 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="grid grid-cols-3 gap-3 px-5 py-6 sm:gap-4 sm:px-7">
              <Mesure id={`${cid}-age`} label={tr("age")} unite={tr("uAns")} valeur={profile.age}
                onChange={(v) => setProfile(p => ({ ...p, age: v }))} placeholder="30" min={10} max={99} />
              <Mesure id={`${cid}-taille`} label={sansUnite(tr("height"))} unite={tr("uCm")} valeur={profile.height_cm}
                onChange={(v) => setProfile(p => ({ ...p, height_cm: v }))} placeholder="175" min={140} max={220} />
              <Mesure id={`${cid}-poids`} label={sansUnite(tr("weight"))} unite={tr("uKg")} valeur={profile.weight_kg}
                onChange={(v) => setProfile(p => ({ ...p, weight_kg: v }))} placeholder="70" min={40} max={150} />
            </div>
            <Question id={`${cid}-genre`} titre={tr("gender")} marque={marqueManque(`${cid}-genre`)}>
              <Choix id={`${cid}-genre`} variante="segment" grille="grid-cols-3" valeur={profile.gender}
                onChange={(v) => setProfile(p => ({ ...p, gender: v }))}
                options={[{ v: "male" as const, l: tr("male") }, { v: "female" as const, l: tr("female") }, { v: "other" as const, l: tr("other") }]} />
            </Question>
            {profile.gender === "female" && (
              <Question id={`${cid}-cycle`} titre={tr("cycle")} aide={tr("cycleSub")}>
                <label htmlFor={`${cid}-cycle-c`} className="relative inline-flex cursor-pointer items-center">
                  <input id={`${cid}-cycle-c`} type="checkbox" role="switch" aria-labelledby={`${cid}-cycle-t`}
                    checked={profile.is_female_cycle_sync}
                    onChange={() => setProfile(p => ({ ...p, is_female_cycle_sync: !p.is_female_cycle_sync }))}
                    className="peer sr-only" />
                  <span aria-hidden="true" className={`relative h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-emerald-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 ${FOCUS}`} />
                </label>
              </Question>
            )}
          </div>
        )}

        {/* ── 2. ENTRAÎNEMENT ── */}
        {step === "training" && (
          <div className="mt-8 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {/* Ancienneté — plafonne la charge que le coach se permet de prescrire. */}
            <Question id={`${cid}-anciennete`} titre={tr("expTitle")} aide={tr("expHint2")} marque={marqueManque(`${cid}-anciennete`)}>
              <Choix id={`${cid}-anciennete`} variante="tuiles" grille="grid-cols-2 sm:grid-cols-3" aide
                valeur={profile.running_years} onChange={(v) => setProfile(p => ({ ...p, running_years: v }))}
                options={([[0, "exp0"], [1, "exp1"], [2, "exp2"], [4, "exp4"], [8, "exp8"], [12, "exp12"]] as const).map(([v, k]) => ({ v, l: tr(k) }))} />
            </Question>
            {/* Disponibilités — le plan n'a de valeur que s'il est tenable. */}
            <Question id={`${cid}-frequence`} titre={tr("dpwShort")} aide={tr("dpwHint")} marque={marqueManque(`${cid}-frequence`)}>
              <Choix id={`${cid}-frequence`} variante="segment" grille="grid-cols-6" aide
                valeur={profile.days_per_week} onChange={(v) => setProfile(p => ({ ...p, days_per_week: v }))}
                options={[2, 3, 4, 5, 6, 7].map(n => ({ v: n, l: String(n) }))} />
            </Question>
            <Question id={`${cid}-jours`} titre={tr("daysShortTitle")} aide={tr("daysHint")}>
              <Cases id={`${cid}-jours`} disposition="grid grid-cols-7 gap-1.5 sm:gap-2" aide
                valeurs={profile.available_days.map(String)}
                onToggle={(v) => { const d = Number(v); setProfile(p => ({ ...p, available_days: p.available_days.includes(d) ? p.available_days.filter(x => x !== d) : [...p.available_days, d] })); }}
                options={[1, 2, 3, 4, 5, 6, 0].map(d => ({ v: String(d), l: tr("dayShort").split(",")[d], sr: jourLong(d) }))} />
            </Question>
            {/* Terrains — CHOIX MULTIPLE : décide si les séances se pilotent à l'allure ou à la FC. */}
            <Question id={`${cid}-terrains`} titre={tr("terrTitle")} aide={tr("terrHint2")} marque={marqueManque(`${cid}-terrains`)}>
              <Cases id={`${cid}-terrains`} disposition="grid grid-cols-2 gap-2 sm:grid-cols-4" aide
                valeurs={profile.main_terrains}
                onToggle={(v) => setProfile(p => ({ ...p, main_terrains: p.main_terrains.includes(v) ? p.main_terrains.filter(s => s !== v) : [...p.main_terrains, v] }))}
                options={TERRAINS.map(t => ({ v: t.slug, l: terrainLabel(t, lang) }))} />
            </Question>
            {/* Dénivelé — place des côtes et du D+ dans le plan (lib/coach/denivele). */}
            <Question id={`${cid}-denivele`} titre={tr("elevTitle")} aide={tr("elevHint2")} marque={marqueManque(`${cid}-denivele`)}>
              <Choix id={`${cid}-denivele`} variante="tuiles" grille="grid-cols-2 sm:grid-cols-4" aide
                valeur={profile.elevation_pref} onChange={(v) => setProfile(p => ({ ...p, elevation_pref: v }))}
                options={([["evite", "elevEvite"], ["modere", "elevModere"], ["aime", "elevAime"], ["specialiste", "elevSpec"]] as const).map(([v, k]) => ({ v, l: tr(k) }))} />
            </Question>
            <Question id={`${cid}-longue`} titre={tr("longTitle")} aide={tr("longHint2")}>
              <Choix id={`${cid}-longue`} variante="segment" grille="grid-cols-2" aide
                valeur={profile.long_run_mode} onChange={(v) => setProfile(p => ({ ...p, long_run_mode: v }))}
                options={[{ v: "run" as const, l: tr("longRun") }, { v: "bike" as const, l: tr("longBike") }]} />
            </Question>
            <Question id={`${cid}-wc`} titre={tr("wcGroup")} aide={tr("wcHint2")}>
              <div className="space-y-4">
                {([["warmup_min", "warmup", "echauffement"], ["cooldown_min", "cooldown", "retour"]] as const).map(([cle, k, suffixe]) => (
                  <div key={cle}>
                    <p id={`${cid}-${suffixe}-t`} className="text-sm font-medium text-zinc-700">{tr(k)} <span className="font-normal text-zinc-500">({tr("uMin")})</span></p>
                    <div className="mt-2">
                      <Choix id={`${cid}-${suffixe}`} variante="segment" grille="grid-cols-6"
                        valeur={profile[cle]} onChange={(v) => setProfile(p => ({ ...p, [cle]: v }))} options={minutes} />
                    </div>
                  </div>
                ))}
              </div>
            </Question>
            <Question id={`${cid}-volume`} titre={tr("volTitle")} aide={tr("volHint")} marque={{ texte: tr("facultatif"), ton: "neutre" }}>
              <input id={`${cid}-vol`} type="range" min={5} max={200} step={5} value={volume ?? 40}
                aria-labelledby={`${cid}-volume-t`} aria-describedby={`${cid}-volume-a`}
                aria-valuetext={volume == null ? tr("volUnset") : tr("volValue", { v: volume })}
                onChange={(e) => setVolume(Number(e.target.value))}
                className={`w-full accent-emerald-600 ${volume == null ? "opacity-50" : ""}`} />
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span aria-live="polite" className={volume == null ? "text-zinc-500" : "font-semibold tabular-nums text-zinc-900"}>
                  {volume == null ? tr("volUnset") : tr("volValue", { v: volume })}
                </span>
                {volume != null && (
                  <button type="button" onClick={() => setVolume(null)} className="text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">
                    {tr("volClear")}
                  </button>
                )}
              </div>
            </Question>
          </div>
        )}

        {/* ── 3. SANTÉ ── la seule section où « rien » est une réponse parfaitement valable. */}
        {step === "health" && (
          <div className="mt-8 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div id={`${cid}-sante`} className="scroll-mt-32">
              {([["health_conditions", "condTitle", HEALTH_CONDITIONS, "pathologies"], ["injury_zones", "injTitle", INJURY_ZONES, "blessures"]] as const).map(([key, titreKey, catalogue, suffixe]) => (
                <Question key={key} id={`${cid}-${suffixe}`} titre={tr(titreKey)}
                  marque={manque(`${cid}-sante`) ? { texte: tr("missingShort"), ton: "alerte" } : undefined}>
                  <Cases id={`${cid}-${suffixe}`} disposition="flex flex-wrap gap-2"
                    valeurs={profile[key]} onToggle={(v) => toggleHealth(key, v)}
                    options={catalogue.map(item => ({ v: item.slug, l: healthLabel(item, lang) }))} />
                </Question>
              ))}
              {/* Réponse explicite « rien à signaler » — sans quoi on ne saurait pas distinguer
                  un athlète en pleine forme d'un athlète qui a sauté la question. */}
              <div className="px-5 pb-6 sm:px-7">
                <label htmlFor={`${cid}-rien`} className="relative block cursor-pointer">
                  <input id={`${cid}-rien`} type="checkbox" checked={healthNone}
                    onChange={() => { setHealthNone(v => !v); setProfile(p => ({ ...p, health_conditions: [], injury_zones: [] })); }}
                    className="peer sr-only" />
                  <span className={`${TUILE} w-full`}>
                    {healthNone && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    {tr("healthNoneLong")}
                  </span>
                </label>
              </div>
            </div>
            <div className="px-5 py-6 sm:px-7">
              <label htmlFor={`${cid}-notes`} className="text-[15px] font-semibold text-zinc-900">{tr("notesTitle")}</label>
              <textarea id={`${cid}-notes`} value={profile.health_notes}
                onChange={e => setProfile(p => ({ ...p, health_notes: e.target.value }))}
                placeholder={tr("notesPh")} rows={3} maxLength={500}
                className="mt-3 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 sm:text-[15px]" />
            </div>
            <Question id={`${cid}-fc`} titre={tr("fcGroup")} aide={tr("fcHint2")} marque={{ texte: tr("facultatif"), ton: "neutre" }}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Mesure id={`${cid}-fcmax`} label={sansUnite(tr("maxHr"))} unite={tr("uBpm")} valeur={fc.max_hr}
                  onChange={(v) => setFc(p => ({ ...p, max_hr: v }))} placeholder="190" min={140} max={230} />
                <Mesure id={`${cid}-fcrepos`} label={sansUnite(tr("restHr"))} unite={tr("uBpm")} valeur={fc.resting_hr}
                  onChange={(v) => setFc(p => ({ ...p, resting_hr: v }))} placeholder="55" min={30} max={100} />
              </div>
            </Question>
            <p className="px-5 py-4 text-sm leading-relaxed text-zinc-500 sm:px-7">{tr("healthDisc")}</p>
          </div>
        )}

        {/* ── 4. MONTRE ── on choisit sa marque, puis on ne lit que ses gestes (12/10/2026). */}
        {step === "watch" && (
          <EtapeMontre tr={tr} cid={cid} marque={marque} onMarque={setMarque}
            enregistre={watchSaved} onEnregistre={() => setWatchSaved(true)} />
        )}

        {/* ── FIN ── */}
        {step === "done" && (
          <div className="mx-auto mt-6 max-w-md text-center sm:mt-16">
            <CheckCircle2 aria-hidden="true" className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-zinc-900 sm:text-3xl">{tr("doneTitle2")}</h1>
            <p className="mt-2 text-[15px] text-zinc-600">{tr("doneSub2")}</p>
            <button type="button" onClick={() => router.push("/dashboard")} className="btn-brand mt-8 w-full justify-center py-3 text-base">
              {tr("doneCta2")}
            </button>
          </div>
        )}
      </main>

      {/* Barre d'actions FIXE : « Retour » à chaque étape après la première, l'action principale à droite. */}
      {step !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto max-w-2xl px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-6">
            {manqueIci.length > 0 && (
              <p role="alert" className="mb-3 flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{tr("missing")} {manqueIci.map(m => m.label).join(", ")}</span>
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              {stepIdx > 0 ? (
                <button type="button" onClick={prev} disabled={loading} className="btn-secondary disabled:opacity-50">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {tr("back")}
                </button>
              ) : <span />}
              {step !== "watch" ? (
                <button type="button" onClick={continuer} className="btn-brand min-w-[9rem] justify-center">{tr("continuer")}</button>
              ) : watchSaved || marque === "aucune" ? (
                <button type="button" onClick={handleFinish} disabled={loading} className="btn-brand min-w-[9rem] justify-center disabled:opacity-60">
                  {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                  {loading ? tr("saving") : tr("wFinish")}
                </button>
              ) : (
                // Sortie facultative : on termine sans montre et on synchronisera plus tard.
                // C'est l'écran qui coûte le plus d'inscriptions — il ne doit jamais être un mur.
                <button type="button" onClick={handleFinish} disabled={loading} className="btn-secondary justify-center disabled:opacity-60">
                  {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                  {loading ? tr("saving") : tr("wSkip2")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
