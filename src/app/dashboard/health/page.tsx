export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { HealthCenter } from "@/components/health/HealthCenter";
import { suiviParZone, actives, etatDe, type Signalement, type Douleur } from "@/lib/health/douleurs";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { estUnePanne } from "@/lib/dashboard/lectures";
import { effectiveVma, bestVmaFromWorkouts } from "@/lib/running/fitness";
import { coursesPourNutrition, type CourseNutri } from "@/lib/health/coursesNutrition";
import { douleursDeSeance, type DouleurSeance } from "@/lib/health/douleursSeance";
import { PEREMPTION_JOURS } from "@/lib/health/douleurs";
import { traduireDouleur } from "@/lib/coach/painZonesI18n";
import { LANGS } from "@/lib/i18n/base";
import { chargeAvantDouleur, doitConsulter, type ChargeAvant, type DouleurUnifiee } from "@/lib/health/santeDouleurs";
import { TYPE_CONSIGNES, consignesEnVigueur, type ConsignesKine } from "@/lib/health/consignesKine";
import { cookies } from "next/headers";
import { fuseauOuDefaut } from "@/lib/time/fuseau";
import { jourLocal } from "@/lib/streak/compute";
import { normLang } from "@/lib/i18n/base";
import { chargerDonnees } from "@/lib/indicateurs/donnees";
import { TYPE_BILAN } from "@/lib/health/bilanMatin";
import { donneesRecup, bilansRecents, type DonneesRecup } from "@/lib/health/recuperation";

export const metadata = { title: "Santé" };

/**
 * Le suivi des douleurs est lu ICI, côté serveur.
 *
 * ⚠️ IL EST LU PAR LE MÊME CALCUL QUE LE KINÉ IA (`suiviParZone`). Si l'athlète voyait
 * une évolution et le modèle une autre, l'un des deux mentirait — et rien à l'écran ne
 * dirait lequel. Une seule fonction, deux affichages.
 */
export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let suivi: ReturnType<typeof suiviParZone> = [];
  const etats: { cle: string; id: string; etat: string }[] = [];
  let enPanne = false;
  let coursesNutrition: CourseNutri[] = [];
  let poidsKg: number | null = null;
  let douleursSeance: (DouleurSeance & { ilYaJours: number; libelle: Record<string, string> })[] = [];
  // Santé, lot 1 (10/11/2026) : une seule liste, ce que la douleur a changé, quand consulter,
  // la charge d'avant, et les consignes du kinésithérapeute.
  let douleurs: (DouleurUnifiee & { libelle?: Record<string, string>; zone?: string })[] = [];
  let effets: { qualiteRetiree: number; sortieLongue: { prevueKm: number; reduiteKm: number } | null; lignesDroites: boolean } | null = null;
  let consignes: ConsignesKine | null = null;
  let charge: ChargeAvant | null = null;
  let rappel: ReturnType<typeof doitConsulter> = null;
  // Santé, lot 2 (10/11/2026) : l'onglet Récupération et le bilan du matin.
  let recup: DonneesRecup | null = null;
  if (user) {
    // Pour la nutrition, les courses à venir et de quoi PRÉDIRE leur durée — la même VMA effective que le coach
    // (`effectiveVma`, seule définition de l'app) : lus ensemble, en une vague.
    // La consultation du « kiné IA » n'est plus lue : elle est retirée (lib/health/kineIa).
    const [objRes, planRes, profilRes, baseRes, seancesRes] = await Promise.all([
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("pace_curve,garmin_vo2max,weight_kg,preferred_language").eq("id", user.id).single(),
      supabase.from("performance_baselines").select("vma_kmh").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("date,sport,distance_km,duration_seconds").eq("user_id", user.id).order("date", { ascending: false }).limit(200),
    ]);
    for (const [nom, r] of [["objectif", objRes], ["courses", planRes], ["profil", profilRes], ["séances", seancesRes]] as const) {
      if (r.error && estUnePanne(r)) console.error("[santé] lecture illisible :", nom, r.error.message);
    }
    const { vma } = effectiveVma({
      vmaStored: baseRes.data?.vma_kmh ?? null,
      paceCurveBest: (profilRes.data?.pace_curve as { best?: { m: number; sec: number }[] } | null)?.best ?? null,
      garminVo2: profilRes.data?.garmin_vo2max ?? null,
      fromRuns: bestVmaFromWorkouts((seancesRes.data ?? []) as { distance_km?: number | null; duration_seconds?: number | null }[]),
    });
    coursesNutrition = coursesPourNutrition(
      objRes.data?.data as Parameters<typeof coursesPourNutrition>[0],
      (planRes.data ?? []).map((r) => r.data as Parameters<typeof coursesPourNutrition>[1][number]),
      aujourdhui(FUSEAU_DEFAUT), vma,
    );
    const p = Number(profilRes.data?.weight_kg);
    poidsKg = Number.isFinite(p) && p > 0 ? p : null;
    /**
     * ⚠️ « AUCUNE DOULEUR » N'EST PAS « ON N'A PAS PU LIRE ».
     *
     * Ces lignes sont les douleurs que l'athlète a DÉCLARÉES lui-même. Sans contrôle,
     * un échec de lecture rendait `[]` et l'écran affichait un historique vierge : de
     * quoi croire que l'application a oublié ce qu'on lui a dit, et tout re-saisir.
     * C'est aussi la mémoire dans laquelle puise le kiné IA.
     */
    const { data, error } = await supabase.from("notifications")
      .select("id,data,created_at").eq("user_id", user.id).eq("type", "pain_report")
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(120);
    const brutes = ((data ?? []) as { id: string; data: Douleur | null; created_at: string }[])
      .map((r) => ({ ...(r.data ?? {}), id: r.id, date: String(r.data?.date ?? r.created_at ?? "").slice(0, 10) }));
    // ⚠️ CE QUE L'ATHLÈTE A DÉCLARÉ PASSÉ NE REMONTE PLUS DANS LE SUIVI — sinon l'écran
    // continue d'afficher une douleur qu'il vient lui-même d'éteindre.
    const retenues = actives(brutes, aujourdhui(FUSEAU_DEFAUT), 60);
    const rows: Signalement[] = retenues.map((r) => ({
      zone: String(r.zone ?? ""),
      cle: r.slot ? String(r.slot) : null,
      level: Number(r.level),
      date: String(r.date ?? "").slice(0, 10),
    }));
    suivi = suiviParZone(rows, aujourdhui(FUSEAU_DEFAUT));
    // La déclaration la PLUS RÉCENTE de chaque zone : c'est elle qu'on met à jour quand
    // l'athlète dit « ça va mieux » ou « c'est passé ».
    const vues = new Set<string>();
    for (const r of retenues) {
      const cle = String(r.slot || r.zone || "");
      if (!cle || vues.has(cle) || !r.id) continue;
      vues.add(cle);
      etats.push({ cle, id: String(r.id), etat: etatDe(r) });
    }
    enPanne = estUnePanne({ error });
    if (enPanne) console.error("[santé] douleurs illisibles :", error?.message);

    // ── LES DOULEURS COCHÉES APRÈS UNE SÉANCE, celles que le coach compte encore ─────────
    //    (lib/health/douleursSeance : 14 jours, « c'est passé », ou un « Aucune douleur » plus
    //    récent). Elles n'avaient aucun bouton pour s'éteindre (Cyprien, 09/11/2026).
    //    Une lecture ratée met l'écran en panne : une liste vide dirait « rien ne pèse ».
    const { data: ress, error: eRess } = await supabase.from("notifications").select("data")
      .eq("user_id", user.id).eq("type", "session_feedback")
      .gte("created_at", new Date(Date.now() - (PEREMPTION_JOURS + 1) * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(60);
    if (eRess && estUnePanne({ error: eRess })) {
      enPanne = true;
      console.error("[santé] ressentis illisibles :", eRess.message);
    }
    // L'ancienneté se calcule ICI, côté serveur, avec le fuseau commun : la calculer dans le
    // navigateur ferait différer le rendu serveur la nuit (erreur React #418, lib/time).
    const jourJ = aujourdhui(FUSEAU_DEFAUT);
    douleursSeance = douleursDeSeance(((ress ?? []) as { data: Record<string, unknown> | null }[]).map((r) => r.data ?? {}), jourJ)
      .map((d) => ({
        ...d,
        ilYaJours: Math.max(0, Math.round((Date.parse(`${jourJ}T12:00:00Z`) - Date.parse(`${d.date}T12:00:00Z`)) / 86400000)),
        libelle: Object.fromEntries(LANGS.map(({ code }) => [code, traduireDouleur(d.zone, code)])),
      }));

    // ── UNE SEULE LISTE : déclarées (schéma corporel) + cochées après une séance ─────────
    const depuis = (jour: string) => Math.max(0, Math.round((Date.parse(`${jourJ}T12:00:00Z`) - Date.parse(`${jour}T12:00:00Z`)) / 86400000));
    douleurs = [
      ...suivi.map((z) => {
        const e = etats.find((x) => x.cle === z.cle);
        return {
          cle: z.cle, source: "declaree" as const, zone: z.zone,
          depuisJours: z.depuisJours, derniereIlYaJours: z.derniereIlYaJours,
          id: e?.id, etat: e?.etat, premier: z.premier, dernier: z.dernier, signalements: z.signalements, tendance: z.tendance,
        };
      }),
      ...douleursSeance.map((d) => ({
        cle: d.zone, source: "seance" as const, libelle: d.libelle,
        depuisJours: depuis(d.premiere), derniereIlYaJours: d.ilYaJours,
      })),
    ];
    rappel = doitConsulter(douleurs);
    // La charge des deux semaines avant la PLUS ANCIENNE douleur encore active.
    const plusAncienne = douleurs.reduce((m, d) => Math.max(m, d.depuisJours), -1);
    if (plusAncienne >= 0) {
      const debut = new Date(`${jourJ}T12:00:00Z`); debut.setUTCDate(debut.getUTCDate() - plusAncienne);
      charge = chargeAvantDouleur((seancesRes.data ?? []) as { date?: string; distance_km?: number; sport?: string }[], debut.toISOString().slice(0, 10));
    }
    // Ce que le coach a retiré, et les consignes saisies (relues pour le formulaire).
    const [etatRes, consRes] = await Promise.all([
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle(),
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", TYPE_CONSIGNES).order("created_at", { ascending: false }).limit(1),
    ]);
    for (const [nom, r] of [["état du coach", etatRes], ["consignes", consRes]] as const) {
      if (r.error && estUnePanne(r)) console.error("[santé] lecture illisible :", nom, r.error.message);
    }
    const etat = etatRes.data?.data as { douleurEffets?: typeof effets } | null;
    effets = douleurs.length ? (etat?.douleurEffets ?? null) : null;
    consignes = consignesEnVigueur(((consRes.data ?? []) as { data?: unknown }[])[0]?.data, jourJ);

    // ── RÉCUPÉRATION : le bilan du matin au jour de l'ATHLÈTE (son fuseau, comme la route et le
    //    tableau de bord) ; forme, VFC et sommeil par les MÊMES calculs que les pages Indicateurs.
    const jourAthlete = jourLocal(new Date(), fuseauOuDefaut(decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? "")));
    const lang = normLang(String((profilRes.data as { preferred_language?: string } | null)?.preferred_language ?? "fr"));
    const [bilanRes, donnees] = await Promise.all([
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", TYPE_BILAN).order("created_at", { ascending: false }).limit(30),
      // Une exception ne casse pas toute la page Santé : l'onglet Récupération se dit en panne.
      chargerDonnees(supabase, user.id, lang, jourJ).catch((e) => {
        console.error("[santé] indicateurs de récupération illisibles :", e instanceof Error ? e.message : String(e));
        return null;
      }),
    ]);
    const bilanPanne = !!bilanRes.error && estUnePanne(bilanRes);
    if (bilanPanne) console.error("[santé] lecture illisible : bilan du matin", bilanRes.error?.message);
    recup = donnees
      ? donneesRecup(donnees, (bilanRes.data ?? []) as { data?: unknown }[], jourAthlete, bilanPanne)
      : { ...bilansRecents((bilanRes.data ?? []) as { data?: unknown }[], jourAthlete), forme: null, vfc: null,
          sommeil: { derniere: null, moyenneMin: null, nuits: 0 }, fcRepos: null, panne: true, fatigueDurable: false };
  }
  return <HealthCenter suivi={suivi} douleurs={douleurs} effets={effets} consignes={consignes} charge={charge} rappel={rappel}
    enPanne={enPanne} coursesNutrition={coursesNutrition} poidsKg={poidsKg} recup={recup} />;
}
