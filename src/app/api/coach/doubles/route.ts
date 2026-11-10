export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAthleteContext } from "@/lib/ai/coachContext";
import { COLONNES_ACCES, lectureDuCoach } from "@/lib/billing/access";
import { journaliserEchecUneFois, causeStable } from "@/lib/journal/echecServeur";

/**
 * GET /api/coach/doubles → l'athlète peut-il doubler, et sinon que lui manque-t-il ?
 *
 * Appelé quand il coche « deux séances par jour » dans son profil. Sans cette réponse,
 * il coche, ne voit rien changer dans son plan, et conclut que la fonction est cassée —
 * alors que le coach a simplement jugé son volume insuffisant. Une case qui ne produit
 * rien DOIT dire pourquoi, au moment où on la coche.
 *
 * On reconstruit le contexte RÉEL (volume représentatif, fraîcheur, douleurs, phase)
 * plutôt que de deviner à partir du seul profil : une réponse approximative ici
 * contredirait le plan quelques heures plus tard, ce qui est pire que pas de réponse.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    // Client admin : `buildAthleteContext` lit des tables (wellness, séances, objectif)
    // dont certaines politiques ne rendent que ses propres lignes — c'est bien ce qu'on
    // veut, et l'identifiant vient de la session, jamais du corps de la requête.
    // La MÊME lecture que le plan (`lectureDuCoach`) : un verdict tiré de signaux que le
    // plan de cette formule ne lit pas le contredirait au prochain recalcul.
    const { data: acces } = await sb.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle();
    const ctx = await buildAthleteContext(
      createAdminClient() as unknown as Parameters<typeof buildAthleteContext>[0],
      user.id,
      lectureDuCoach(acces as Parameters<typeof lectureDuCoach>[0]),
    );
    return NextResponse.json({
      ...ctx.doubles,
      // Le volume qui a servi à trancher : sans lui, « ton volume est insuffisant »
      // reste une opinion. Avec, l'athlète sait exactement ce qu'il lui reste à faire.
      volumeKm: ctx.volume.avg4wkKm,
      cetteSemaineKm: ctx.volume.weekKm,
    });
  } catch (e) {
    // On ne prétend PAS que tout va bien quand on n'a pas pu calculer : l'écran doit
    // pouvoir dire « je n'ai pas réussi à vérifier » plutôt que d'inventer un verdict.
    // Et la cause part dans `error_logs` (le contexte refuse désormais de se bâtir sur des
    // douleurs illisibles, relecture du 10/11/2026), une fois par jour.
    await journaliserEchecUneFois(null, { source: "coach-doubles", userId: user.id, url: "/api/coach/doubles", message: `Contexte du coach impossible : ${causeStable(e)}` });
    return NextResponse.json({ error: "Vérification impossible pour le moment" }, { status: 503 });
  }
}
