export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigeAcces } from "@/lib/billing/guard";
import { generateContent, budget } from "@/lib/ai/gemini";
import { faitsDuBilan, lignesDuBilan, inviteBilan, empreinteBilan } from "@/lib/ai/bilanSemaine";
import { chiffresInconnus } from "@/lib/ai/relectureSemaine";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { aujourdhui, fuseauOuDefaut } from "@/lib/time/fuseau";
import { decaleJour } from "@/lib/streak/compute";
import { objectifEnCours } from "@/lib/coach/prochaineCourse";
import { vmaAffichee } from "@/lib/dashboard/vmaAffichee";
import { predictRaceSec } from "@/lib/running/fitness";
import { socleDesSeances } from "@/lib/dashboard/forme";
import { serieVfc, COLONNES_VFC } from "@/lib/health/vfc";

/**
 * LE BILAN DE LA SEMAINE (Premium) — voir `lib/ai/bilanSemaine`.
 *
 * ⚠️ À LA DEMANDE, ET MÉMORISÉ. Rien ne part au modèle tant que les faits de la semaine
 * n'ont pas changé : rouvrir le tableau de bord resservira le même bilan sans rien dépenser.
 * Le plafond quotidien n'est décompté QUE si le modèle est vraiment appelé.
 *
 * ⚠️ UN CHIFFRE INVENTÉ REJETTE LE BILAN ENTIER (`chiffresInconnus`), comme pour les
 * conseils du coach avancé : un chiffre faux ne se corrige pas, il se refuse.
 */
const TYPE_BILAN = "ai_bilan";
const COLS = "date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,elevation_gain_m,hr_zone_seconds,cardiac_decoupling,weather_temp_c";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 0. La formule (402 pour Starter) — ne consomme rien ─────────────────────
  const refus = await exigeAcces(supabase, user.id, "bilan");
  if (refus) return refus.reponse;

  const jour = aujourdhui(fuseauOuDefaut(decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? "")));
  const lang = await getAccountLang(supabase, user.id);

  // ── 1. Les données, toutes à l'athlète (RLS) ───────────────────────────────
  const [seancesRes, sommeilRes, vfcRes, objRes, etatRes, baseRes, profilRes] = await Promise.all([
    // Six mois : la tendance d'efficacité se lit sur des blocs de quatre semaines.
    supabase.from("workouts").select(COLS).eq("user_id", user.id).gte("date", decaleJour(jour, -182)).order("date", { ascending: false }),
    supabase.from("sleep_data").select("date,sleep_score").eq("user_id", user.id).gte("date", decaleJour(jour, -27)),
    supabase.from("hrv_data").select(COLONNES_VFC).eq("user_id", user.id).gte("date", decaleJour(jour, -34)),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle(),
    supabase.from("performance_baselines").select("vma_kmh,max_hr,tested_at").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("garmin_vo2max,pace_curve").eq("id", user.id).maybeSingle(),
  ]);
  // Sans les séances, il n'y a pas de bilan : on le dit plutôt que d'en écrire un vide.
  if (seancesRes.error) {
    console.error("[bilan] séances illisibles :", seancesRes.error.message);
    return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  }
  const seances = (seancesRes.data ?? []) as unknown as (Parameters<typeof faitsDuBilan>[0]["seances"][number] & { max_hr?: number | null; type?: string | null; weather_temp_c?: number | null })[];

  // La VMA et la prédiction : le MÊME calcul que la carte du tableau de bord (40 dernières séances).
  const { vma } = vmaAffichee({
    seances: seances.slice(0, 40) as Parameters<typeof vmaAffichee>[0]["seances"],
    baseline: baseRes.data as { vma_kmh?: number | null; tested_at?: string | null } | null,
    profil: profilRes.data as Parameters<typeof vmaAffichee>[0]["profil"],
  });
  type Course = { race?: string; raceDate?: string; distanceKm?: number };
  const objBrut = objRes.data?.data as (Course & { targetSeconds?: number; precedente?: Course | null }) | null;
  const objectif = objectifEnCours(objBrut as { race: string; raceDate: string; distanceKm: number; targetSeconds: number } | null, jour);
  const recup = (etatRes.data?.data as { recuperation?: { course?: string; reprise?: string } | null } | null)?.recuperation;
  const fcObservee = Math.max(0, ...seances.map((s) => Number(s.max_hr) || 0));
  const fcMax = Number((baseRes.data as { max_hr?: number | null } | null)?.max_hr) || (fcObservee > 120 ? fcObservee : null);

  const faits = faitsDuBilan({
    aujourdhui: jour,
    seances,
    sommeil: (sommeilRes.data ?? []) as { date: string; sleep_score?: number | null }[],
    vfc: serieVfc((vfcRes.data ?? []) as { date: string; rmssd?: number | null; sdnn?: number | null }[]).lignes as { date: string; hrv_ms?: number | null }[],
    fcMax,
    objectif: objectif ? {
      nom: objectif.race, date: objectif.raceDate, distanceKm: objectif.distanceKm, viseSec: objectif.targetSeconds,
      predictionSec: vma > 0 ? predictRaceSec(vma, objectif.distanceKm, socleDesSeances(seances as Parameters<typeof socleDesSeances>[0], jour)) : null,
    } : null,
    recuperation: recup?.course && recup.reprise ? { course: recup.course, reprise: recup.reprise } : null,
    // L'objectif et la course qu'il a remplacée : celle COURUE cette semaine sera nommée.
    courses: [objBrut, objBrut?.precedente].filter((c): c is Course => !!c?.race && !!c.raceDate)
      .map((c) => ({ nom: String(c.race), date: String(c.raceDate), distanceKm: Number(c.distanceKm) || 0 })),
  });
  const lignes = lignesDuBilan(faits);
  const empreinte = empreinteBilan(lignes, lang);

  // ── 2. Déjà écrit pour ces faits ? ─────────────────────────────────────────
  const admin = createAdminClient();
  const { data: memo } = await admin.from("notifications").select("id, data").eq("user_id", user.id).eq("type", TYPE_BILAN).maybeSingle();
  const prec = memo?.data as { empreinte?: string; texte?: string } | null;
  if (prec?.empreinte === empreinte && prec.texte) return NextResponse.json({ ok: true, texte: prec.texte, memorise: true });

  // ── 3. Le plafond du jour, décompté seulement maintenant ───────────────────
  const plafond = await exigeAcces(supabase, user.id, "ia");
  if (plafond) return plafond.reponse;

  // ── 4. Le modèle rédige ────────────────────────────────────────────────────
  const r = await generateContent(
    [{ role: "user", parts: [{ text: inviteBilan(lignes, lang) }] }],
    { ...budget(400, 650), temperature: 0.5 },
  );
  if (!r.ok || !r.text?.trim()) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  const texte = r.text.trim();
  const inventes = chiffresInconnus(texte, lignes);
  if (inventes.length) {
    console.warn("[bilan] rejeté, chiffres absents des faits :", inventes.join(", "));
    return NextResponse.json({ ok: false, error: "bilan_non_fiable" }, { status: 502 });
  }

  // ── 5. Mémoriser — une écriture ratée se repaierait à chaque ouverture ─────
  const donnees = { empreinte, texte, semaine: faits.debut, lang, at: new Date().toISOString() };
  const { error: eMemo } = memo?.id
    ? await admin.from("notifications").update({ data: donnees }).eq("id", memo.id)
    : await admin.from("notifications").insert({ user_id: user.id, type: TYPE_BILAN, title: "bilan", body: "", read: true, data: donnees });
  if (eMemo) console.error("[bilan] non mémorisé, il sera repayé :", eMemo.message);

  return NextResponse.json({ ok: true, texte, memorise: false });
}
