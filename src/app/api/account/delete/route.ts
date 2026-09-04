export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/account/delete — supprime le compte de l'utilisateur connecté (irréversible).
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();

  /**
   * ⚠️ L'ORDRE ET LES CONTRÔLES SONT ICI UNE OBLIGATION LÉGALE, PAS UNE PRÉCAUTION.
   *
   * Ces deux suppressions étaient « best-effort », dans un `try` qui ne pouvait RIEN
   * rattraper : un client Supabase RETOURNE ses erreurs, il ne les lève pas. Le compte
   * d'authentification était ensuite supprimé quoi qu'il arrive, et la route répondait
   * « ok ».
   *
   * Ce que ça donne quand la ligne `profiles` ne part pas : le nom, l'âge, le poids,
   * les pathologies déclarées, les notes de santé, les zones de blessure ET la clé
   * d'API intervals.icu restent en base — c'est cette ligne qui les emporte, 35 tables
   * cascadant depuis `profiles(id)`. L'athlète, lui, ne peut plus se connecter pour
   * réessayer : ses données sont non seulement conservées, mais devenues orphelines,
   * rattachées à personne, impossibles à réclamer. On lui a répondu que son compte
   * était supprimé.
   *
   * Un déclencheur existe déjà dans le schéma : `team_challenges.created_by` référence
   * `profiles(id)` SANS clause de suppression (migration 001, ligne 330). Un athlète
   * ayant créé un défi collectif verrait la suppression de son profil refusée par la
   * contrainte. Cette table n'a aucun écrivain à ce jour — le chemin n'est donc pas
   * atteignable aujourd'hui — mais la suppression peut échouer pour bien d'autres
   * raisons, et le résultat serait identique.
   *
   * On supprime donc les données D'ABORD, on VÉRIFIE, et on ne retire le compte que si
   * elles sont réellement parties. Un échec laisse l'athlète connecté, capable de
   * recommencer.
   */
  const { error: eNotifs } = await admin.from("notifications").delete().eq("user_id", user.id);
  if (eNotifs) {
    console.error("[compte] notifications non supprimées :", eNotifs.message);
    return NextResponse.json(
      { error: "Suppression impossible pour le moment. Ton compte et tes données sont intacts, réessaie." },
      { status: 500 },
    );
  }
  const { error: eProfil } = await admin.from("profiles").delete().eq("id", user.id);
  if (eProfil) {
    console.error("[compte] profil non supprimé, compte conservé :", eProfil.message);
    return NextResponse.json(
      { error: "Suppression impossible pour le moment. Ton compte et tes données sont intacts, réessaie." },
      { status: 500 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
