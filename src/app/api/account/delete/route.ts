export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estJetonOAuth, jetonDe } from "@/lib/intervals/auth";
import { revoquer } from "@/lib/intervals/oauth";
import { stripe, stripeConfigured } from "@/lib/stripe/client";
import { SEAU_PJ } from "@/lib/messages/piecesJointes";
import { journaliserEchec } from "@/lib/journal/echecServeur";

/**
 * Ce que voit l'athlète quand une étape échoue. Les étapes ne se défont pas (il n'y a pas
 * de transaction entre le stockage, Stripe et la base) : on ne promet donc pas que « rien
 * n'est perdu » dès que la première suppression a eu lieu (relecture du 08/11/2026). Chaque
 * étape se rejoue sans dommage : réessayer termine le travail.
 */
const RIEN_EFFACE = "Suppression impossible pour l'instant : rien n'a été effacé, ton compte est intact. Réessaie dans un instant, ou écris-nous.";
const EN_PARTIE = "Suppression interrompue avant la fin : ton compte existe encore, mais ta photo, tes pièces jointes ou ton inscription à la lettre ont pu être déjà effacées. Réessaie pour terminer, ou écris-nous.";
/** Le profil et tout ce qui en dépend sont partis ; seul l'identifiant de connexion reste. */
const DONNEES_EFFACEES = "Tes données sont effacées, mais la fermeture de ton identifiant de connexion a échoué. L'incident est enregistré et sera terminé à la main ; tu peux aussi nous écrire.";

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
  // Le jeton intervals.icu est lu AVANT l'effacement (la ligne `profiles` l'emporte), et rendu
  // APRÈS : sans cela, Pacevo restait autorisé chez intervals.icu (audit du 24/10/2026).
  //
  // ⚠️ ET TOUT CE QUE `profiles` N'EMPORTE PAS (audit du 08/11/2026). La cascade efface les
  // tables liées, pas : l'avatar (seau PUBLIC, toujours servi par son adresse), les pièces
  // jointes (seau privé), l'inscription à la lettre (clé : l'e-mail, la lettre partait encore
  // chaque lundi), les lignes du journal d'erreurs, ni l'abonnement Stripe (la carte restait
  // débitée). Chaque étape est lue ; une seule en échec arrête tout AVANT le profil.
  let entame = false;
  let resilie = false;
  const echec = async (etape: string, cause: string) => {
    await journaliserEchec(admin, { source: "compte", userId: user.id, url: "/api/account/delete", message: `Suppression de compte arrêtée (${etape}) : ${cause}` });
    const message = entame ? EN_PARTIE + (resilie ? " Ton abonnement est déjà résilié : tu ne seras plus prélevé." : "") : RIEN_EFFACE;
    return NextResponse.json({ error: message }, { status: 500 });
  };
  const { data: montre, error: eMontre } = await admin.from("profiles").select("intervals_api_key").eq("id", user.id).maybeSingle();
  if (eMontre) return echec("lecture du profil", `${eMontre.code ?? "?"} ${eMontre.message}`);

  // 1. Les fichiers : avatar public et pièces jointes, rangés sous `<compte>/`, retirés par
  //    lots jusqu'au dernier (`list` n'en rend que 1 000 à la fois).
  for (const seau of ["avatars", SEAU_PJ]) {
    for (let tour = 0; tour < 50; tour++) {
      const { data: fichiers, error: eListe } = await admin.storage.from(seau).list(user.id, { limit: 1000 });
      if (eListe) return echec(`fichiers ${seau}`, eListe.message);
      const chemins = (fichiers ?? []).map((f) => `${user.id}/${f.name}`);
      if (!chemins.length) break;
      entame = true;
      const { error: eRetrait } = await admin.storage.from(seau).remove(chemins);
      if (eRetrait) return echec(`fichiers ${seau}`, eRetrait.message);
    }
  }

  // 2. La lettre (par compte ET par adresse : une inscription du pied de page n'a pas de compte)
  //    et le journal d'erreurs rattaché au compte.
  entame = true;
  const { error: eLettreCompte } = await admin.from("newsletter_subscribers").delete().eq("user_id", user.id);
  if (eLettreCompte) return echec("lettre", `${eLettreCompte.code ?? "?"} ${eLettreCompte.message}`);
  if (user.email) {
    const { error: eLettreAdresse } = await admin.from("newsletter_subscribers").delete().eq("email", user.email.toLowerCase());
    if (eLettreAdresse) return echec("lettre", `${eLettreAdresse.code ?? "?"} ${eLettreAdresse.message}`);
  }
  const { error: eJournal } = await admin.from("error_logs").delete().eq("user_id", user.id);
  if (eJournal) return echec("journal", `${eJournal.code ?? "?"} ${eJournal.message}`);

  // ⚠️ PAS DE SUPPRESSION ANTICIPÉE DES NOTIFICATIONS (relecture du 08/11/2026). Cette table
  // porte l'objectif de course, la course planifiée et l'état d'abonnement : effacée avant une
  // étape qui échoue, elle laissait un compte vivant sans objectif. `notifications.user_id`
  // cascade depuis `profiles(id)` (vérifié en production le 08/11/2026) : le profil l'emporte.
  //
  // 3. L'abonnement, en DERNIER avant le profil : une étape précédente en échec ne doit pas
  //    arrêter l'abonnement d'un compte qui reste en place ; après le profil, plus personne
  //    ne saurait lequel arrêter.
  const { data: facturation, error: eFacturation } = await admin.from("profiles").select("stripe_subscription_id").eq("id", user.id).maybeSingle();
  if (eFacturation) return echec("lecture de l'abonnement", `${eFacturation.code ?? "?"} ${eFacturation.message}`);
  const abonnement = (facturation as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
  if (abonnement && !stripeConfigured) {
    // Sans clé Stripe sur ce serveur, l'abonnement ne peut pas être arrêté d'ici. La suppression
    // continue (c'est un droit), mais la résiliation à faire à la main est écrite, avec l'id
    // que le profil emporte (relecture du 08/11/2026).
    await journaliserEchec(admin, { source: "compte", userId: user.id, url: "/api/account/delete", message: `Abonnement ${abonnement} à résilier à la main : Stripe non configuré sur ce serveur` });
  }
  if (abonnement && stripeConfigured) {
    try {
      await stripe.subscriptions.cancel(abonnement, { cancellation_details: { comment: "Suppression du compte" } });
      resilie = true;
    } catch (e) {
      // Déjà résilié chez Stripe : rien à arrêter, on continue.
      if ((e as { code?: string }).code !== "resource_missing") return echec("résiliation Stripe", e instanceof Error ? e.message : String(e));
    }
  }

  const { error: eProfil } = await admin.from("profiles").delete().eq("id", user.id);
  if (eProfil) {
    return echec("profil", eProfil.message);
  }
  // Au mieux : `revoquer` ne lève jamais, et un refus d'intervals.icu ne retient pas la suppression.
  const jeton = montre?.intervals_api_key;
  if (estJetonOAuth(jeton)) await revoquer(jetonDe(String(jeton)));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  // Les données sont parties, l'identifiant de connexion reste : à finir à la main, et DIT
  // comme tel. L'écran déconnecte l'athlète : rester sur un compte sans profil n'a plus de sens.
  if (error) {
    await journaliserEchec(admin, { source: "compte", userId: user.id, url: "/api/account/delete", message: `Suppression de compte arrêtée (compte de connexion, données déjà effacées) : ${error.message}` });
    return NextResponse.json({ error: DONNEES_EFFACEES, donneesEffacees: true }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
