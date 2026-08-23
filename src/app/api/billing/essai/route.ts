export const dynamic = "force-dynamic";
/**
 * COMBIEN DE JOURS D'ESSAI CE VISITEUR OBTIENDRAIT-IL S'IL S'ABONNAIT MAINTENANT ?
 *
 * ⚠️ CETTE ROUTE EXISTE POUR QUE LE BOUTON NE MENTE PAS. Depuis que l'essai Stripe ne
 * dure plus que les jours RESTANTS de l'essai gratuit, un libellé figé « Essayer 7 jours »
 * serait faux pour tout le monde sauf le jour de l'inscription : trois jours accordés
 * sous un bouton qui en promet sept, c'est le même défaut que celui qu'on vient de
 * corriger, déplacé d'un cran.
 *
 * Elle ne renvoie qu'un ENTIER et un booléen — aucune donnée de profil, aucun montant,
 * rien qui puisse servir à autre chose qu'à écrire le bon libellé.
 *
 * Un visiteur non connecté obtient l'essai complet : il n'a pas encore de compte, donc
 * son essai gratuit n'a pas commencé. Le bouton l'enverra créer un compte.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { joursEssaiStripe, JOURS_ESSAI, COLONNES_ACCES } from "@/lib/billing/access";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connecte: false, jours: JOURS_ESSAI });

  // `COLONNES_ACCES` est la liste que `accesDe` attend : la nommer ici plutôt que de
  // recopier « created_at, subscription_tier » évite qu'un ajout de colonne côté accès
  // laisse cette route en arrière, avec un calcul qui diverge en silence.
  const { data: profile } = await supabase
    .from("profiles").select(COLONNES_ACCES).eq("id", user.id).single();

  return NextResponse.json({ connecte: true, jours: joursEssaiStripe(profile) });
}
