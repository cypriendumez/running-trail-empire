/**
 * LE RAPPEL AVANT RECONDUCTION D'UN ABONNEMENT ANNUEL.
 *
 * ⚠️ OBLIGATION (art. L215-1 du code de la consommation) : pour un contrat à durée
 * déterminée reconduit tacitement, le professionnel prévient le consommateur PAR ÉCRIT,
 * au plus tôt trois mois et au plus tard un mois avant l'échéance, qu'il peut ne pas le
 * reconduire. Sans ce rappel, l'abonné peut résilier à tout moment après la reconduction
 * et se faire rembourser la période entamée. Le premier abonnement annuel souscrit le
 * 01/01/2027 se reconduit le 01/01/2028 : ce rappel partira donc à partir de novembre 2027.
 *
 * Un abonnement MENSUEL n'a pas de terme à annoncer un mois à l'avance : il se résilie à
 * tout moment, en un clic (art. L215-1-1, déjà en place). Seul l'annuel est concerné.
 *
 * ⚠️ PAS DE SÉLECTEUR DE JOURS CHEZ STRIPE : l'événement `invoice.upcoming` part un nombre
 * de jours réglé dans le tableau de bord, dont la valeur maximale n'est pas documentée.
 * S'il plafonnait sous un mois, le rappel arriverait trop tard pour la loi. On le
 * déclenche donc nous-mêmes, depuis la tâche quotidienne `/api/cron/sync-all`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { TYPE_ETAT_ABO, litEtatAbo, type EtatAbonnement } from "@/lib/billing/etatAbonnement";
import { PRIX_AFFICHES } from "@/lib/billing/prix";
import { emailRappelReconduction } from "@/lib/billing/emailsAbonnement";
import { envoyerEmail } from "@/lib/email/envoyer";
import { EDITEUR } from "@/lib/brand/editeur";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";

/** Type de la ligne `notifications` qui note chaque rappel envoyé. */
export const TYPE_RAPPEL_RECONDUCTION = "rappel_reconduction";

/** On prévient entre J-60 et J-35 : dans la fenêtre légale (J-90 à J-30), avec de la marge
 *  des deux côtés, et vingt-cinq passages quotidiens pour rattraper une panne. */
export const RAPPEL_AU_PLUS_TOT_JOURS = 60;
export const RAPPEL_AU_PLUS_TARD_JOURS = 35;

/** Jours entiers entre deux dates civiles AAAA-MM-JJ. */
function joursEntre(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/**
 * Faut-il envoyer le rappel AUJOURD'HUI ? Fonction pure, testée sans base ni réseau.
 * `aujourdHui` est une date civile (AAAA-MM-JJ).
 */
export function doitRappelerReconduction(etat: EtatAbonnement | null, aujourdHui: string): boolean {
  if (!etat || etat.intervalle !== "an" || etat.statut !== "active" || etat.annuleALaFin || !etat.periodeFin) return false;
  const reste = joursEntre(aujourdHui, etat.periodeFin);
  return reste <= RAPPEL_AU_PLUS_TOT_JOURS && reste >= RAPPEL_AU_PLUS_TARD_JOURS;
}

/**
 * Envoie les rappels dus. IDEMPOTENT : chaque envoi est noté avec son échéance, et une
 * échéance déjà annoncée ne l'est pas deux fois, même si la tâche passe cent fois par jour.
 * Ne lève jamais : un rappel raté ne doit pas faire échouer la synchronisation des séances.
 */
export async function envoyerRappelsReconduction(
  admin: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<{ envoyes: number; echecs: number }> {
  let envoyes = 0, echecs = 0;
  try {
    const aujourdHui = maintenant.toISOString().slice(0, 10);
    const { data: etats, error } = await admin.from("notifications")
      .select("user_id, data").eq("type", TYPE_ETAT_ABO).eq("data->>intervalle", "an");
    if (error) { console.error("[reconduction] lecture des abonnements :", error.message); return { envoyes, echecs: 1 }; }

    for (const ligne of (etats ?? []) as { user_id: string; data: unknown }[]) {
      const etat = litEtatAbo(ligne.data);
      if (!doitRappelerReconduction(etat, aujourdHui) || !etat?.periodeFin) continue;

      // ⚠️ SANS RÉPONSE, ON NE SAIT PAS S'IL EST DÉJÀ PARTI (08/11/2026) : la lecture ratée
      // valait « jamais envoyé », et le même e-mail légal repartait à chaque passage de la
      // synchronisation (toutes les ~30 min). On n'envoie rien et on le dit.
      const { data: deja, error: eDeja } = await admin.from("notifications").select("id")
        .eq("user_id", ligne.user_id).eq("type", TYPE_RAPPEL_RECONDUCTION)
        .eq("data->>echeance", etat.periodeFin).maybeSingle();
      if (eDeja) {
        await journaliserEchecUneFois(admin, { source: "reconduction", userId: ligne.user_id, url: "/api/cron/sync-all", message: `Rappel de reconduction non vérifié, rien envoyé : ${eDeja.message}` });
        echecs++; continue;
      }
      if (deja) continue;

      const { data: p } = await admin.from("profiles")
        .select("email, preferred_language, subscription_tier").eq("id", ligne.user_id).maybeSingle();
      const profil = (p ?? {}) as { email?: string | null; preferred_language?: string | null; subscription_tier?: string | null };
      const formule = profil.subscription_tier === "starter" || profil.subscription_tier === "premium" ? profil.subscription_tier : null;
      if (!profil.email || !formule) { echecs++; continue; }

      const base = process.env.NEXT_PUBLIC_APP_URL || "https://pacevo.fr";
      const m = emailRappelReconduction({
        lang: profil.preferred_language ?? "fr", formule,
        montantCentimes: PRIX_AFFICHES[formule].an, echeance: etat.periodeFin,
        lien: `${base}/dashboard/profile?onglet=abonnement`,
      });
      // La trace sert de preuve de l'information ET de verrou contre un second envoi : elle
      // est donc posée AVANT l'envoi (08/11/2026). Après, son échec renvoyait le rappel à
      // chaque passage. Si l'envoi échoue, on la retire pour réessayer au passage suivant.
      const { data: trace, error: eTrace } = await admin.from("notifications").insert({
        user_id: ligne.user_id, type: TYPE_RAPPEL_RECONDUCTION, title: "rappel de reconduction", body: "",
        // L'adresse fait partie de la preuve de l'information (rattachée au compte, effacée avec lui).
        data: { echeance: etat.periodeFin, envoyeLe: maintenant.toISOString(), email: profil.email },
      }).select("id").single();
      if (eTrace || !trace) {
        await journaliserEchecUneFois(admin, { source: "reconduction", userId: ligne.user_id, url: "/api/cron/sync-all", message: `Rappel de reconduction non envoyé : verrou non posé (${eTrace?.message ?? "aucune ligne"})` });
        echecs++; continue;
      }
      const r = await envoyerEmail("reconduction", {
        to: [profil.email], subject: m.objet, text: m.texte, html: m.html, reply_to: EDITEUR.email,
      }, { userId: ligne.user_id, url: "/api/cron/sync-all" });
      if (!r.ok) {
        // L'échec d'envoi est déjà journalisé par `envoyerEmail` ; on libère le verrou.
        const { error: eRetrait } = await admin.from("notifications").delete().eq("id", (trace as { id: string }).id);
        if (eRetrait) await journaliserEchecUneFois(admin, { source: "reconduction", userId: ligne.user_id, url: "/api/cron/sync-all", message: `Rappel non envoyé ET verrou resté posé : il ne sera pas retenté (${eRetrait.message})` });
        echecs++; continue;
      }
      envoyes++;
    }
  } catch (e) {
    console.error("[reconduction]", (e as Error).message);
    echecs++;
  }
  return { envoyes, echecs };
}
