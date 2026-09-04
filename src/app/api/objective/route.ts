export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { normaliserHeure } from "@/lib/races/heure";
import { createClient } from "@/lib/supabase/server";
import { emailEditeur } from "@/lib/admin/acces";
import { createAdminClient } from "@/lib/supabase/admin";
import { setRaceObjective } from "@/lib/coach/objective";

// POST /api/objective {race, distanceKm, targetTime, raceDate}
// → enregistre l'objectif de course du client (notifications type "race_objective"),
//   prévient le coach par e-mail, et alimente l'IA coach (allure/distance visées).
//   L'écriture + la re-synchro des séances sont centralisées dans setRaceObjective().

// "hh:mm:ss" | "h:mm" | "mm:ss" → secondes
function toSeconds(t: string): number | null {
  const parts = t.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { race?: string; distanceKm?: number; targetTime?: string; raceDate?: string; startTime?: string };
  const race = String(body.race ?? "").trim().slice(0, 80);
  const distanceKm = Math.round(Number(body.distanceKm) * 100) / 100;
  const raceDate = String(body.raceDate ?? "").slice(0, 10);
  const targetSeconds = body.targetTime ? toSeconds(String(body.targetTime)) : null;
  // ⚠️ FACULTATIVE, ET REFUSÉE PLUTÔT QUE DEVINÉE. Une heure de départ fausse est pire
  //    qu'une heure absente : elle se planifie, et on rate son départ en s'y fiant.
  //    Une saisie illisible n'enregistre donc RIEN, elle ne « corrige » pas.
  const heureDepart = body.startTime ? normaliserHeure(body.startTime) : null;
  if (body.startTime && !heureDepart) {
    return NextResponse.json({ error: "Heure de départ invalide (ex. 9h30)" }, { status: 400 });
  }

  if (!race) return NextResponse.json({ error: "Nom de la course requis" }, { status: 400 });
  if (!(distanceKm > 0) || distanceKm > 500) return NextResponse.json({ error: "Distance invalide" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  if (targetSeconds == null || targetSeconds <= 0) return NextResponse.json({ error: "Temps visé invalide (hh:mm:ss)" }, { status: 400 });

  const admin = createAdminClient();
  // Écriture de l'objectif + re-synchronisation des séances (centralisé).
  // ⚠️ `setRaceObjective` LÈVE désormais quand l'objectif n'a pas pu être écrit. Sans ce
  // contrôle, la route répondait l'objectif comme s'il était enregistré, l'écran
  // l'affichait, et il avait disparu au rechargement suivant.
  let data;
  try {
    data = await setRaceObjective(admin, user.id, { race, distanceKm, raceDate, targetSeconds, heureDepart });
  } catch (e) {
    console.error("[objectif]", (e as Error).message);
    return NextResponse.json({ error: "Objectif non enregistré. Réessaie dans un instant." }, { status: 500 });
  }

  // Alerte e-mail au coach (best-effort) — même pattern que /api/feedback.
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const COACH_EMAIL = emailEditeur();
  // Sans destinataire exploitable, on n'envoie PAS plutôt que d'écrire au mauvais.
  if (RESEND_API_KEY && COACH_EMAIL) {
    try {
      const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
      const name = (prof?.full_name as string) || (prof?.email as string) || "Un client";
      const dateFr = new Date(raceDate + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const jStr = (() => { const j = Math.ceil((new Date(raceDate + "T00:00:00").getTime() - Date.now()) / 86400000); return j >= 0 ? `J-${j}` : "passée"; })();
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Pacevo <onboarding@resend.dev>",
          to: [COACH_EMAIL],
          reply_to: (prof?.email as string) || undefined,
          subject: `🎯 Objectif de ${name} : ${race} (${data.targetTime})`,
          text: `${name} vient de définir son objectif de course :\n\n• Course : ${race}\n• Distance : ${distanceKm} km\n• Date : ${dateFr} (${jStr})\n• Temps visé : ${data.targetTime}\n• Allure cible : ${data.targetPace}\n\n→ L'IA coach adapte déjà ses séances (forme, sommeil, historique, niveau) vers cet objectif.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch { /* e-mail best-effort : l'objectif est déjà enregistré */ }
  }

  // ── AVERTISSEMENT D'ÂGE, AU MOMENT OÙ IL COMPTE ─────────────────────────────
  // Le calendrier l'affiche déjà, mais trois jours plus tard. L'instant utile est
  // CELUI-CI : l'athlète vient de choisir sa course, il peut encore en changer.
  // On n'a JAMAIS bloqué l'enregistrement — l'objectif est déjà écrit ci-dessus,
  // c'est le sien. On informe, on ne décide pas à sa place.
  const alerteAge = await (async () => {
    try {
      const { data: prof } = await sb.from("profiles").select("age, preferred_language").eq("id", user.id).maybeSingle();
      const p = prof as { age?: number | null; preferred_language?: string | null } | null;
      const age = p?.age ?? null;
      const { avertissementsAge } = await import("@/lib/coach/ageDistance");
      // La langue de l'athlète : citer un règlement FRANÇAIS, en français, à un athlète
      // allemand ne l'informe de rien. Les versions étrangères précisent d'ailleurs que
      // la limite vaut « en France » et invitent à vérifier le règlement local.
      const langues = ["fr", "en", "de", "es", "pt"] as const;
      const lang = langues.includes((p?.preferred_language ?? "") as typeof langues[number])
        ? (p!.preferred_language as typeof langues[number]) : "fr";
      return avertissementsAge({
        age, distanceKm, lang,
        trail: /trail|utmb|ultra|vertical|\bkv\b|montagne/i.test(race) || distanceKm > 45,
      });
    } catch { return []; }
  })();

  return NextResponse.json({ ok: true, objective: data, avertissementsAge: alerteAge ?? [] });
}
