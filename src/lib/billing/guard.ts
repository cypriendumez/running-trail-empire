// ─────────────────────────────────────────────────────────────────────────────
//  LE VERROU CÔTÉ SERVEUR — un seul point d'entrée pour toutes les routes.
//
//  Il n'existait RIEN avant : `subscription_tier` servait à afficher un badge, et
//  chaque route servait tout le monde. Une formule payante qui ne verrouille rien
//  n'est pas une formule, c'est une décoration.
//
//  ⚠️ CE CONTRÔLE EST SERVEUR, ET IL DOIT LE RESTER. Masquer un bouton dans
//  l'interface ne protège rien : la route reste appelable à la main, et c'est
//  précisément l'appel qui coûte des jetons Gemini. L'affichage suit le verrou, il
//  ne le remplace pas.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accesDe, peut, motifRefus, type Capacite, type EtatAcces } from "@/lib/billing/access";

/** Les seules colonnes nécessaires pour trancher. Aucune autre n'est lue : une
 *  requête large ici ferait transiter `intervals_api_key` pour rien. */
export const COLONNES_ACCES = "created_at, subscription_tier";

export type Refus = { reponse: NextResponse; acces: EtatAcces };

/**
 * Vérifie qu'un athlète a le droit demandé. Renvoie `null` s'il l'a, sinon une
 * réponse HTTP prête à être retournée telle quelle.
 *
 * Le code est 402 (« Payment Required ») et non 403 : c'est le seul code qui dit
 * « ce n'est pas un problème de droits, c'est un problème d'abonnement », et il
 * permet au client de distinguer une session expirée d'une formule trop courte
 * sans lire le corps de la réponse.
 */
export async function exigeAcces(
  supabase: SupabaseClient,
  userId: string,
  quoi: Capacite,
): Promise<Refus | null> {
  const { data } = await supabase.from("profiles").select(COLONNES_ACCES).eq("id", userId).maybeSingle();
  const acces = accesDe(data as { created_at?: string | null; subscription_tier?: string | null } | null);
  if (peut(acces.etat, quoi)) return null;

  const motif = motifRefus(acces.etat, quoi);
  return {
    acces,
    // On ne renvoie jamais un refus muet : l'athlète doit pouvoir savoir laquelle des
    // deux situations il vit, parce qu'elles ne se résolvent pas du même geste — l'une
    // demande de s'abonner, l'autre de changer de formule.
    reponse: NextResponse.json(
      { error: motif, etat: acces.etat, besoin: quoi },
      { status: 402 },
    ),
  };
}
