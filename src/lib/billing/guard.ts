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
import { accesDe, peut, motifRefus, COLONNES_ACCES, type Capacite, type EtatAcces } from "@/lib/billing/access";
import { consommerAppelIA } from "@/lib/billing/aiQuota";

// Réexporté pour que les appelants n'aient qu'un import à faire.
export { COLONNES_ACCES };

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

  // ── PLAFOND JOURNALIER ──────────────────────────────────────────────────────
  //  Avoir le DROIT d'appeler un modèle ne veut pas dire pouvoir l'appeler sans fin.
  //  Sur le palier gratuit de Google, le plafond est partagé par toute l'application
  //  et le produit tombe en panne pour tout le monde ; sur une clé payante, il n'y a
  //  plus de plafond du tout et c'est la facture qui monte, en silence. Le plafond
  //  par athlète est ce qui rend la clé payante utilisable — voir lib/billing/aiQuota.
  if (quoi === "ia" && peut(acces.etat, quoi)) {
    const q = await consommerAppelIA(supabase, userId, acces.etat);
    if (!q.accorde) {
      // ⚠️ NE PAS CONFONDRE « PLAFOND ATTEINT » ET « COMPTEUR ILLISIBLE ». Le premier se
      // résout demain, le second dans une minute : annoncer l'un pour l'autre envoie
      // l'athlète attendre vingt-quatre heures pour une panne de quelques secondes.
      if (q.indisponible) {
        return {
          acces,
          reponse: NextResponse.json(
            { error: "quota_indisponible", etat: acces.etat },
            { status: 503 },
          ),
        };
      }
      return {
        acces,
        reponse: NextResponse.json(
          { error: "quota_ia_atteint", etat: acces.etat, plafond: q.plafond, utilises: q.utilises },
          { status: 429 },
        ),
      };
    }
    return null;
  }

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
