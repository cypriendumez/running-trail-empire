export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exigeAcces } from "@/lib/billing/guard";
import { COLONNES_ACCES, profilPeut } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAthleteContext, COACH_SYSTEM } from "@/lib/ai/coachContext";
import { generateContent } from "@/lib/ai/gemini";
import {
  SESSION_CACHE_TYPE, PROFILE_FINGERPRINT_COLUMNS, fingerprint, isCacheUsable, serverDay,
  type SessionSignals, type AiSession,
} from "@/lib/ai/sessionCache";

/**
 * Séance-clé du jour proposée par l'IA.
 *
 * Déroulé en deux temps, et l'ordre compte : on lit d'ABORD les signaux qui décident
 * la séance (7 petites requêtes indexées) et on rend la réponse mémorisée si rien n'a
 * bougé. Le contexte coach complet n'est construit qu'en cas de besoin réel — il coûte
 * une quinzaine de requêtes ET un appel à l'API météo, tout ça pour alimenter un
 * appel Gemini qu'on cherche justement à éviter.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── VERROU D'ABONNEMENT ──────────────────────────────────────────────────
  // Cette route fait PARLER un modèle : c'est exactement ce que la formule Complet
  // facture, parce que c'est la seule partie du produit dont le coût grandit avec
  // le nombre d'athlètes. Masquer le bouton côté interface ne suffirait pas — la
  // route resterait appelable à la main, et c'est l'appel qui coûte.
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return refus.reponse;

  const day = serverDay();

  // ── 1. Signaux + entrée mémorisée, en parallèle ───────────────────────────────
  const [profileRow, workoutRow, hrvRow, sleepRow, objectiveRow, baselineRow, cacheRow, accesRow] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FINGERPRINT_COLUMNS.join(",")).eq("id", user.id).maybeSingle(),
    // `count: exact` + la dernière date : une séance importée fait bouger l'un des deux au
    // moins. Une simple RETOUCHE d'une séance déjà là (même date, même compte) ne périme
    // rien — c'est assumé : elle ne change pas la charge sur laquelle se cale le conseil.
    supabase.from("workouts").select("date", { count: "exact" }).eq("user_id", user.id).order("date", { ascending: false }).limit(1),
    supabase.from("hrv_data").select("date,hrv_ms").eq("user_id", user.id).order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sleep_data").select("date,sleep_score").eq("user_id", user.id).order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    supabase.from("performance_baselines").select("tested_at").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    // Volontairement `limit(1)` et non `maybeSingle()` : deux appareils qui ouvrent le
    // tableau de bord en même temps peuvent insérer deux lignes avant que l'une soit
    // visible de l'autre. `maybeSingle()` échouerait alors DÉFINITIVEMENT sur « plusieurs
    // lignes », et le cache serait cassé pour de bon. Là, on garde simplement la plus
    // récente et la mise à jour suivante réécrit celle-là.
    supabase.from("notifications").select("id,data").eq("user_id", user.id).eq("type", SESSION_CACHE_TYPE)
      .order("created_at", { ascending: false }).limit(1),
    // Le palier, dans le MÊME lot que le reste : pas un aller-retour de plus.
    supabase.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle(),
  ]);
  const acces = accesRow.data as Parameters<typeof profilPeut>[0];
  const cached = (cacheRow.data?.[0] ?? null) as { id?: string; data?: unknown } | null;

  const signals: SessionSignals = {
    day,
    lastWorkoutDate: (workoutRow.data?.[0] as { date?: string } | undefined)?.date ?? null,
    workoutCount: workoutRow.count ?? 0,
    lastHrvDate: (hrvRow.data as { date?: string } | null)?.date ?? null,
    lastHrvMs: (hrvRow.data as { hrv_ms?: number } | null)?.hrv_ms ?? null,
    lastSleepDate: (sleepRow.data as { date?: string } | null)?.date ?? null,
    lastSleepScore: (sleepRow.data as { sleep_score?: number } | null)?.sleep_score ?? null,
    objective: (objectiveRow.data as { data?: unknown } | null)?.data ?? null,
    baselineTestedAt: (baselineRow.data as { tested_at?: string } | null)?.tested_at ?? null,
    profile: (profileRow.data as Record<string, unknown> | null) ?? null,
  };
  const fp = fingerprint(signals);

  const entry = cached?.data as { day?: string; fp?: string; session?: AiSession } | null | undefined;
  if (isCacheUsable(entry, day, fp)) {
    return NextResponse.json({ session: entry.session, cached: true });
  }

  // ── 2. Rien de mémorisé d'utilisable : on paie l'appel ────────────────────────
  const ctx = await buildAthleteContext(supabase, user.id);
  const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long" });

  const prompt = `${COACH_SYSTEM}

VOICI L'ATHLÈTE (analyse CHAQUE ligne) :
${ctx.text}

MISSION : recommande LA séance-clé à faire AUJOURD'HUI (${jour}), parfaitement calibrée sur sa forme du jour, sa charge et son objectif de course.
- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.

Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour) :
{"title":"nom court de la séance","subtitle":"description concrète : structure, allure/zone, durée/distance","tags":["2 à 3 tags très courts ex Z2, 10 km, VMA, Allure marathon"],"why":"1 phrase de justification personnalisée citant une donnée clé (VFC, sommeil, charge ou objectif)"}`;

  try {
    // Passe par la chaîne de repli commune : la route appelait `gemini-2.5-flash` en dur,
    // donc sans bascule vers `flash-lite`. Les quotas étant comptés PAR MODÈLE, elle se
    // privait de la moitié de la capacité disponible dès que le premier modèle saturait.
    const res = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      {
        temperature: 0.8,
        // ⚠️ « Analyses longues et détaillées » était annoncé sous Premium dans les cinq
        // langues, et n'existait NULLE PART dans le code : les deux formules payantes
        // recevaient exactement la même analyse. C'est ici que la promesse devient vraie.
        // La longueur du texte est le seul levier honnête — on ne dégrade pas la
        // PERTINENCE d'une analyse selon ce qu'on paie, on en donne plus ou moins.
        maxOutputTokens: profilPeut(acces, "analyse_longue") ? 600 : 380,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 429 ? "Quota IA atteint" : `IA indisponible (${res.status})` },
        { status: 502 },
      );
    }
    const m = res.text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Réponse IA illisible" }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    if (!parsed.title || !Array.isArray(parsed.tags)) return NextResponse.json({ error: "Format IA invalide" }, { status: 502 });
    const session: AiSession = {
      title: String(parsed.title).slice(0, 60),
      subtitle: String(parsed.subtitle ?? "").slice(0, 140),
      tags: parsed.tags.slice(0, 3).map((t: unknown) => String(t).slice(0, 16)),
      why: String(parsed.why ?? "").slice(0, 170),
    };

    // ── 3. Mémorisation (une seule ligne par athlète, réécrite) ─────────────────
    // `read: true` : cette ligne est de l'état, pas une notification. La cloche ne
    // compte que les `coach_message` non lus, mais autant ne pas compter dessus.
    const payload = { day, fp, session, at: new Date().toISOString() };
    const admin = createAdminClient();
    const existingId = cached?.id;
    if (existingId) {
      await admin.from("notifications").update({ data: payload }).eq("id", existingId);
    } else {
      await admin.from("notifications").insert({
        user_id: user.id, type: SESSION_CACHE_TYPE, title: "Séance IA du jour", body: "", read: true, data: payload,
      });
    }

    return NextResponse.json({ session });
  } catch (e) {
    return NextResponse.json({ error: `Erreur IA: ${(e as Error).message}` }, { status: 502 });
  }
}
