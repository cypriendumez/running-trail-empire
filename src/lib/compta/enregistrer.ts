import { createAdminClient } from "@/lib/supabase/admin";
import { adminsAutorises } from "@/lib/admin/acces";
import type { NouvelleEcriture } from "./stripe";

export const TYPE_ECRITURE = "compta_ecriture";
export const TYPE_REGLAGES = "compta_reglages";

/**
 * À QUI APPARTIENT LE JOURNAL COMPTABLE.
 *
 * ⚠️ PAS AU COMPTE CONNECTÉ — C'ÉTAIT UN DÉFAUT. Depuis que plusieurs adresses peuvent
 * ouvrir l'espace coach, rattacher les écritures à la session affichait une comptabilité
 * DIFFÉRENTE selon la façon de se connecter : les recettes saisies via le compte Google
 * étaient invisibles depuis le compte e-mail, et réciproquement. Deux journaux pour une
 * seule entreprise, sans le moindre message d'erreur.
 *
 * La comptabilité appartient à l'ENTREPRISE. On la rattache donc au premier compte
 * d'`ADMIN_EMAILS` qui existe réellement — en parcourant la liste DANS L'ORDRE, jamais
 * en laissant la base décider : un `in (…)` renvoie ses lignes dans un ordre non garanti,
 * et le journal se serait scindé au gré des requêtes.
 */
export async function idEditeur(): Promise<string | null> {
  const admin = createAdminClient();
  const liste = adminsAutorises();
  if (!liste.length) {
    console.error("[compta] aucune adresse d'administration : le journal n'a pas de propriétaire.");
    return null;
  }
  const { data, error } = await admin.from("profiles").select("id, email").in("email", liste);
  if (error) { console.error("[compta] profils illisibles :", error.message); return null; }
  const parEmail = new Map((data ?? []).map((p) => [String(p.email).toLowerCase(), String(p.id)]));
  for (const e of liste) { const id = parEmail.get(e); if (id) return id; }
  console.error("[compta] aucune adresse d'administration ne correspond à un compte existant.");
  return null;
}

/**
 * Écrit des écritures venues de Stripe, sans jamais en créer deux fois la même.
 *
 * ⚠️ STRIPE RÉÉMET SES NOTIFICATIONS tant qu'il n'a pas reçu de réponse — un délai
 * réseau suffit. Sans contrôle, un abonnement de 14,99 € serait compté deux ou trois
 * fois, et le journal n'aurait rien d'anormal : trois lignes identiques ressemblent à
 * trois vrais paiements. La clé `stripeId` est donc vérifiée AVANT chaque insertion.
 */
export async function enregistrerEcritures(ecritures: NouvelleEcriture[]): Promise<{ creees: number; deja: number; erreur?: string }> {
  if (!ecritures.length) return { creees: 0, deja: 0 };
  const userId = await idEditeur();
  if (!userId) return { creees: 0, deja: 0, erreur: "Aucun compte éditeur : impossible de rattacher les écritures." };

  const admin = createAdminClient();
  let creees = 0, deja = 0;
  for (const e of ecritures) {
    const { data: existe, error: eLire } = await admin.from("notifications")
      .select("id").eq("user_id", userId).eq("type", TYPE_ECRITURE).eq("data->>stripeId", e.stripeId).limit(1);
    // ⚠️ En cas d'erreur de LECTURE, on n'écrit pas. Insérer « dans le doute » est
    // précisément ce qui crée les doublons qu'on essaie d'empêcher.
    if (eLire) return { creees, deja, erreur: `Contrôle d'unicité impossible : ${eLire.message}` };
    if (existe && existe.length) { deja++; continue; }

    const { error } = await admin.from("notifications").insert({
      user_id: userId, type: TYPE_ECRITURE, title: e.libelle, read: true,
      data: { ...e, saisieLe: new Date().toISOString() },
    });
    if (error) return { creees, deja, erreur: `Écriture refusée : ${error.message}` };
    creees++;
  }
  return { creees, deja };
}
