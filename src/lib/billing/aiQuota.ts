// ─────────────────────────────────────────────────────────────────────────────
//  PLAFOND D'APPELS IA PAR ATHLÈTE ET PAR JOUR.
//
//  POURQUOI CE MODULE EXISTE. Tant que la clé Gemini est sur le palier gratuit, la
//  contrainte est un plafond de 20 requêtes/jour PARTAGÉ par toute l'application :
//  le produit tombe en panne pour tout le monde dès les premiers clients. En passant
//  la clé en payant, ce plafond disparaît — et le risque CHANGE DE NATURE. Il ne
//  s'agit plus d'une panne bruyante mais d'une facture silencieuse : une clé payante
//  sans plafond par athlète est un chèque en blanc, qu'une boucle, un script ou un
//  simple usage intensif suffit à vider.
//
//  CHIFFRES MESURÉS SUR LE COMPTE DE PRODUCTION (pas estimés) : le contexte envoyé
//  au modèle pèse 18 336 caractères, soit ≈ 4 584 jetons d'entrée. Avec ~700 jetons
//  de sortie, un appel coûte ≈ 0,29 centime d'euro. Ce qui donne, par athlète :
//
//      5 appels/jour  → 0,43 €/mois   (3 % du prix de Complet)
//     25 appels/jour  → 2,16 €/mois   (14 %)
//    100 appels/jour  → 8,63 €/mois   (58 % — la marge est morte)
//
//  D'où le plafond ci-dessous : large pour un usage réel (un athlète en fait trois
//  ou quatre), mais qui borne le pire cas à une fraction supportable du prix.
//
//  AUCUNE MIGRATION : le compteur vit dans `notifications`, le fourre-tout typé déjà
//  utilisé pour `user_settings`, `race_objective`, `auto_coach_state`…
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { jourLocal } from "@/lib/streak/compute";
import type { Acces } from "@/lib/billing/access";

export const TYPE_QUOTA = "ai_quota";

/**
 * Appels IA autorisés par jour, selon l'accès.
 *
 * Essentiel est à ZÉRO et ce n'est pas une punition : c'est la définition même de la
 * formule. Le verrou d'accès l'arrête déjà avant d'arriver ici ; la valeur est
 * présente pour que la table soit lisible d'un coup d'œil et qu'aucun état n'y manque.
 */
export const PLAFOND_JOUR: Record<Acces, number> = {
  essai: 25,
  complet: 25,
  essentiel: 0,
  consultation: 0,
};

/**
 * `accorde` dit si CET appel a le droit de partir. Le déduire d'un `utilises >= plafond`
 * chez l'appelant est exactement le genre de comparaison qu'on écrit de travers une fois
 * sur deux — et la première version de ce module l'avait écrite de travers : au 26ᵉ appel,
 * un `utilises > plafond` laissait passer parce que le compteur, déjà bloqué à 25,
 * n'était plus incrémenté. On rend donc la décision explicite.
 */
export type EtatQuota = { utilises: number; plafond: number; restants: number; accorde: boolean };

/** Lit le compteur du jour sans l'incrémenter — pour l'affichage. */
export async function quotaDuJour(
  supabase: SupabaseClient,
  userId: string,
  etat: Acces,
  aujourdhui: string = jourLocal(),
): Promise<EtatQuota> {
  const plafond = PLAFOND_JOUR[etat];
  const { data } = await supabase.from("notifications")
    .select("data").eq("user_id", userId).eq("type", TYPE_QUOTA).maybeSingle();
  const d = (data as { data?: { jour?: string; n?: number } } | null)?.data;
  // Un compteur d'hier ne compte pas : le jour a changé, la remise à zéro est implicite.
  const utilises = d?.jour === aujourdhui ? Number(d?.n ?? 0) : 0;
  return { utilises, plafond, restants: Math.max(0, plafond - utilises), accorde: utilises < plafond };
}

/**
 * Consomme un appel. Renvoie l'état APRÈS consommation, ou l'état de refus.
 *
 * ⚠️ ON INCRÉMENTE AVANT L'APPEL, pas après. Compter après le succès paraît plus
 * juste pour l'athlète, mais laisse passer autant d'appels simultanés qu'on veut :
 * dix requêtes parties en même temps liraient toutes le même compteur et le
 * dépasseraient ensemble. C'est précisément le scénario d'une boucle, donc celui
 * qu'on cherche à borner. Un appel qui échoue coûte donc un crédit — c'est le prix
 * d'un plafond qui tient vraiment, et il en reste vingt-quatre.
 */
export async function consommerAppelIA(
  supabase: SupabaseClient,
  userId: string,
  etat: Acces,
  aujourdhui: string = jourLocal(),
): Promise<EtatQuota> {
  const avant = await quotaDuJour(supabase, userId, etat, aujourdhui);
  if (!avant.accorde) return avant;   // plafond déjà atteint : on n'incrémente plus

  const n = avant.utilises + 1;
  // ⚠️ PAS d'`upsert` : `onConflict: "user_id,type"` exigerait une contrainte unique
  // sur (user_id, type), qui n'existe PAS — `notifications` porte au contraire
  // plusieurs lignes du même type par athlète (les séances du coach, par exemple).
  // L'upsert aurait donc échoué en production, ou pire, inséré un doublon par appel.
  // On suit le motif déjà utilisé pour `auto_coach_state` : on cherche, puis on met à
  // jour ou on insère.
  const ligne = { jour: aujourdhui, n };
  const { data: existante } = await supabase.from("notifications")
    .select("id").eq("user_id", userId).eq("type", TYPE_QUOTA).maybeSingle();
  if ((existante as { id?: string } | null)?.id) {
    await supabase.from("notifications").update({ data: ligne }).eq("id", (existante as { id: string }).id);
  } else {
    await supabase.from("notifications")
      .insert({ user_id: userId, type: TYPE_QUOTA, title: "quota ia", body: "", read: true, data: ligne });
  }
  // Cet appel-ci est accordé : c'est lui qu'on vient de compter.
  return { utilises: n, plafond: avant.plafond, restants: Math.max(0, avant.plafond - n), accorde: true };
}
