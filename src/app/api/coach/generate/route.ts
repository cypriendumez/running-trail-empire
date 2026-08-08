export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";

// ─────────────────────────────────────────────────────────────────────────────
//  GÉNÉRATION IMMÉDIATE DU PLAN — appelée à la fin de l'onboarding.
//
//  POURQUOI CETTE ROUTE EXISTE
//  Le plan était produit uniquement par le cron de 3 h 30. Un athlète inscrit à 10 h
//  attendait donc 17 heures avant de voir quoi que ce soit dans son calendrier — et
//  pendant tout ce temps, le tableau de bord appelait Gemini à CHAQUE affichage pour
//  suggérer une séance de remplacement (BentoDashboard : `if (coachSession) return`).
//  Sur un palier gratuit plafonné à 20 requêtes par jour, une poignée d'inscriptions le
//  même après-midi suffisait à épuiser tout le quota IA de l'application — le jour du
//  lancement, précisément.
//
//  Générer le plan tout de suite ferme les deux problèmes d'un coup : le calendrier est
//  rempli immédiatement (meilleure première impression) et le repli IA ne se déclenche
//  plus. Coût : ZÉRO requête IA — `autoPlan` est entièrement déterministe.
//
//  ⚠️ L'identifiant de l'athlète vient de la SESSION, jamais du corps de la requête.
//  Une route qui accepterait un `userId` fourni par l'appelant laisserait n'importe qui
//  régénérer — et donc écraser — le plan d'un autre. C'est exactement la faille trouvée
//  sur quatre routes pendant l'audit.
// ─────────────────────────────────────────────────────────────────────────────

/** Délai minimal entre deux générations. Protège intervals.icu : chaque génération pousse
 *  jusqu'à 5 séances vers la montre, et rien n'empêcherait sinon de marteler le bouton. */
const COOLDOWN_MS = 60_000;

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();

  // Anti-martèlement : on renvoie le dernier passage plutôt que de régénérer.
  const { data: state } = await admin.from("notifications")
    .select("data").eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle();
  const lastAt = ((state?.data ?? null) as { at?: string } | null)?.at;
  if (lastAt) {
    const age = Date.now() - new Date(lastAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, skipped: "trop_recent", at: lastAt });
    }
  }

  // La clé intervals.icu est lue ici pour la passer au générateur (poussée montre) et
  // ne quitte jamais le serveur — elle n'apparaît dans aucune réponse.
  const { data: creds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();

  const r = await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
  }).catch((e) => ({ processed: false, reason: String((e as Error).message) }));

  // `days`/`pushed` sont des compteurs, jamais de données sensibles.
  return NextResponse.json({ ok: r.processed, ...r });
}
