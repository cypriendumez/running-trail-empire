export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifiantsDe } from "@/lib/intervals/identifiants";

/**
 * GET /api/intervals/status
 * « Cet athlète a-t-il branché intervals.icu ? » — rien d'autre. Aucune clé ne sort.
 *
 * ⚠️ CETTE ROUTE RÉPONDAIT OUI POUR TOUT LE MONDE. Elle acceptait, à défaut d'identifiants
 * au profil, ceux des variables d'environnement — c'est-à-dire le compte intervals.icu de
 * l'ÉDITEUR — et renvoyait alors `configured: true`. Trois écrans s'y fient :
 * `components/AutoSync.tsx` lance la synchronisation automatique sur cette seule réponse,
 * l'onboarding coche l'étape « montre connectée », et l'onglet Sync affiche « connecté ».
 *
 * Le résultat, constaté en base le 23/08/2026 : le second compte de l'application, qui
 * n'a JAMAIS saisi d'identifiants, portait trois séances de l'éditeur dans sa table
 * `workouts` (`i178186948`, `i178009874`, `i177841573`). AutoSync avait lu ce `true` et
 * importé les sorties de quelqu'un d'autre, sans une seule erreur nulle part.
 *
 * `createAdminClient` a disparu avec le repli : la question porte sur l'utilisateur
 * connecté, elle se répond avec sa propre session.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Personne de connecté = personne dont on puisse décrire la configuration. Répondre
  // « configuré » d'après l'environnement revenait à parler du compte de l'éditeur à un
  // visiteur anonyme.
  if (!user) return NextResponse.json({ configured: false, source: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();

  const configured = !!identifiantsDe(profile);
  return NextResponse.json({ configured, source: configured ? "profile" : null });
}
