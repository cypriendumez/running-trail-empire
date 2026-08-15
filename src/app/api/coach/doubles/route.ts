export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAthleteContext } from "@/lib/ai/coachContext";

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
    const ctx = await buildAthleteContext(
      createAdminClient() as unknown as Parameters<typeof buildAthleteContext>[0],
      user.id,
    );
    return NextResponse.json({
      ...ctx.doubles,
      // Le volume qui a servi à trancher : sans lui, « ton volume est insuffisant »
      // reste une opinion. Avec, l'athlète sait exactement ce qu'il lui reste à faire.
      volumeKm: ctx.volume.avg4wkKm,
      cetteSemaineKm: ctx.volume.weekKm,
    });
  } catch {
    // On ne prétend PAS que tout va bien quand on n'a pas pu calculer : l'écran doit
    // pouvoir dire « je n'ai pas réussi à vérifier » plutôt que d'inventer un verdict.
    return NextResponse.json({ error: "Vérification impossible pour le moment" }, { status: 503 });
  }
}
