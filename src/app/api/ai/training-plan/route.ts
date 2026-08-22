export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateContent } from "@/lib/ai/gemini";
import { exigeAcces } from "@/lib/billing/guard";
import { buildAthleteContext, COACH_SYSTEM } from "@/lib/ai/coachContext";


export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── VERROU D'ABONNEMENT ──────────────────────────────────────────────────
  // Cette route fait PARLER un modèle : c'est exactement ce que la formule Complet
  // facture, parce que c'est la seule partie du produit dont le coût grandit avec
  // le nombre d'athlètes. Masquer le bouton côté interface ne suffirait pas — la
  // route resterait appelable à la main, et c'est l'appel qui coûte.
  const refus = await exigeAcces(supabase, user.id, "plan_ia");
  if (refus) return refus.reponse;

  const body = await req.json().catch(() => ({})) as { race_id?: string; target_time?: number };
  const ctx = await buildAthleteContext(supabase, user.id);

  // Cible : une course du catalogue (race_id) sinon l'objectif saisi par le client.
  let raceId: string | null = null;
  let raceName = "", distanceKm = 0, elevationM = 0, raceDate = "", targetSeconds: number | null = null;

  if (body.race_id) {
    const { data: race } = await supabase.from("races").select("*").eq("id", body.race_id).single();
    if (!race) return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
    raceId = body.race_id; raceName = race.name; distanceKm = race.distance_km;
    elevationM = race.elevation_gain_m ?? 0; raceDate = race.date; targetSeconds = body.target_time ?? null;
  } else if (ctx.objective) {
    raceName = ctx.objective.race; distanceKm = ctx.objective.distanceKm;
    raceDate = ctx.objective.raceDate; targetSeconds = ctx.objective.targetSeconds;
  } else {
    return NextResponse.json({ error: "Aucun objectif : définis d'abord ta course cible sur le dashboard." }, { status: 400 });
  }

  const weeksUntilRace = Math.floor((new Date(raceDate + "T00:00:00").getTime() - Date.now()) / (7 * 86400000));
  if (weeksUntilRace < 2) return NextResponse.json({ error: "Course trop proche pour un plan multi-semaines (< 2 semaines) — suis la séance du jour et l'affûtage." }, { status: 400 });
  const planWeeks = Math.min(weeksUntilRace, 16); // bloc structuré borné (build + pic + affûtage)
  const startDate = new Date(Date.now() + Math.max(0, weeksUntilRace - planWeeks) * 7 * 86400000).toISOString().split("T")[0];

  const targetTxt = targetSeconds ? `${Math.floor(targetSeconds / 3600)}h${String(Math.floor((targetSeconds % 3600) / 60)).padStart(2, "0")} (allure ${Math.floor((targetSeconds / distanceKm) / 60)}'${String(Math.round((targetSeconds / distanceKm) % 60)).padStart(2, "0")}/km)` : "finisher";

  const prompt = `${COACH_SYSTEM}

VOICI L'ATHLÈTE (analyse CHAQUE ligne, n'oublie rien) :
${ctx.text}

OBJECTIF DU PLAN
- Course : ${raceName} · ${distanceKm} km${elevationM ? ` · ${elevationM} m D+` : ""}
- Date : ${raceDate} (dans ${weeksUntilRace} semaines)
- Temps visé : ${targetTxt}

MISSION : construis un plan d'entraînement PÉRIODISÉ de ${planWeeks} semaines (début ${startDate}) qui amène CET athlète à son objectif, calibré sur son niveau, sa charge actuelle (CTL/ATL/TSB), sa VFC, son sommeil et son volume réel.
- Périodisation : base aérobie → développement (VMA/seuil/côtes) → spécifique (allure course + dénivelé) → AFFÛTAGE final (volume −40 %, fraîcheur, TSB cible positif le jour J).
- Progressivité ≤ +10 %/sem, semaine d'assimilation ~1/4. Modèle polarisé ~80/20.
- FRÉQUENCE selon le NIVEAU : débutant 3-4 séances/sem · amateur 4-6 · avancé/élite visant un chrono rapide jusqu'à 10-12/sem AVEC doubles séances (2 le même jour, ex. footing matin + qualité soir). Pour une double, ajoute DEUX entrées avec le MÊME "day_of_week". Descriptions concrètes (allure/zone, durée, dénivelé). Marque is_key_session sur les séances décisives.
- Estime CTL/ATL/TSB par semaine de façon réaliste (TSB positif la semaine de course).

Réponds UNIQUEMENT par du JSON valide (sans markdown), structure EXACTE :
{"summary":"2 phrases : logique du plan et points de vigilance pour cet athlète","weeks":[{"week_number":1,"phase":"base|development|specific|taper","start_date":"YYYY-MM-DD","total_km":50,"total_elevation_m":500,"ctl":45,"atl":48,"tsb":-3,"sessions":[{"day_of_week":1,"type":"easy|tempo|interval|long_run|trail|vma|hill_repeat|recovery","title":"Titre court","description":"Détail STRUCTURÉ séparé par ' → ' : Échauffement (≥15 min footing à la FC Z1→Z2) → Corps (allure /km ; format chiffré pour la qualité) → Retour au calme (≥10 min FC Z1). Allure /km UNIQUEMENT sur le corps ; échauffement/retour au calme en FC. Repos/Renfo = pas d'échauffement course, juste les exercices clés","target_duration_min":60,"target_distance_km":10,"target_elevation_m":0,"intensity_zone":"Z1|Z2|Z3|Z4|Z5","is_key_session":false}]}]}`;

  // ⚠️ CLIENT PARTAGÉ, et plus un `fetch` vers une URL bâtie à la main. Cette route
  // écrivait le nom du modèle DANS son URL : elle échappait à la mémoire de quota (elle
  // continuait donc d'appeler Google après épuisement) et à la bascule de modèle. Google
  // a déjà retiré `gemini-2.0-flash` ; le jour où `2.5` suivra, une URL codée en dur
  // tomberait en silence.
  const r = await generateContent(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.5, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
  );
  // `r.error` porte déjà le bon message, y compris « quota journalier atteint — il se
  // réinitialise à minuit heure du Pacifique », que cette route réécrivait moins bien.
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const rawText = r.text || "{}";
  let planJson: Record<string, unknown>;
  try { planJson = JSON.parse(rawText); }
  catch { const match = rawText.match(/\{[\s\S]*\}/); planJson = match ? JSON.parse(match[0]) : {}; }
  const weeks = (planJson.weeks as Array<{ total_km?: number }> | undefined) ?? [];
  if (!weeks.length) return NextResponse.json({ error: "Plan IA illisible, réessaie." }, { status: 502 });

  const admin = createAdminClient();
  // Un seul plan actif par client → on désactive les précédents.
  await admin.from("training_plans").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);
  const { data: plan, error } = await admin.from("training_plans").insert({
    user_id: user.id,
    race_id: raceId,
    name: `Plan ${raceName} — ${new Date(raceDate + "T00:00:00").toLocaleDateString("fr")}`,
    start_date: startDate,
    race_date: raceDate,
    weekly_km: weeks[0]?.total_km ?? Math.round(distanceKm),
    target_seconds: targetSeconds,
    plan_json: planJson,
    created_by: "ai",
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Matérialisation : on étale le plan en séances datées (notifications "coach_session")
  //    → visibles dans le calendrier ET pilotent la « séance du jour ». On ne touche
  //    qu'aux séances générées par l'IA (source=ai_plan), pas à celles du coach humain.
  type PlanSession = { day_of_week?: number; type?: string; title?: string; description?: string; target_distance_km?: number; target_duration_min?: number; intensity_zone?: string; is_key_session?: boolean };
  type PlanWeek = { week_number?: number; phase?: string; sessions?: PlanSession[] };
  // Ancre = lundi de la semaine 1 (tout en UTC → pas de décalage de fuseau).
  const anchor = new Date(startDate + "T00:00:00Z");
  anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7));
  // Regroupe par date : 2+ séances le même jour (doubles élite) → une seule entrée riche.
  const byDate = new Map<string, { sessions: PlanSession[]; wn: number; phase?: string }>();
  for (const wk of weeks as PlanWeek[]) {
    const wn = Number(wk.week_number) || 1;
    for (const s of wk.sessions ?? []) {
      const dow = Math.min(7, Math.max(1, Number(s.day_of_week) || 1));
      const d = new Date(anchor); d.setUTCDate(anchor.getUTCDate() + (wn - 1) * 7 + (dow - 1));
      const date = d.toISOString().slice(0, 10);
      const g = byDate.get(date) ?? { sessions: [] as PlanSession[], wn, phase: wk.phase };
      g.sessions.push(s); byDate.set(date, g);
    }
  }
  const slot = ["🌅 Matin", "🌙 Soir", "➕ Séance 3"];
  const coachRows: Record<string, unknown>[] = [];
  for (const [date, g] of byDate) {
    const double = g.sessions.length > 1;
    const tags = [...new Set(g.sessions.flatMap(s => [s.intensity_zone, s.target_distance_km ? `${s.target_distance_km} km` : null].filter(Boolean)))].slice(0, 4) as string[];
    coachRows.push({
      user_id: user.id, type: "coach_session", read: true,
      title: double ? `Double séance (${g.sessions.length})` : String(g.sessions[0].title ?? "Séance").slice(0, 80),
      body: double ? "double" : String(g.sessions[0].type ?? ""),
      data: {
        date, sessionType: g.sessions[0].type ?? "easy",
        subtitle: (double
          ? g.sessions.map((s, i) => `${slot[i] ?? "➕"} — ${s.title}${s.description ? ` : ${s.description}` : ""}`).join("  ·  ")
          : String(g.sessions[0].description ?? "")).slice(0, 400),
        tags,
        why: `Semaine ${g.wn}${g.phase ? ` · ${g.phase}` : ""} — vers ${raceName}`,
        source: "ai_plan", key: g.sessions.some(s => s.is_key_session), double,
      },
    });
  }
  // Remplace l'ancien plan IA (sans toucher aux séances du coach humain).
  await admin.from("notifications").delete().eq("user_id", user.id).eq("type", "coach_session").contains("data", { source: "ai_plan" });
  if (coachRows.length) await admin.from("notifications").insert(coachRows);

  return NextResponse.json({ ok: true, plan, weeks: weeks.length, sessions: coachRows.length, summary: planJson.summary ?? null });
}
