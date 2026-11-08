/**
 * LE CONSENTEMENT AUX DONNÉES DE SANTÉ — ENREGISTRÉ, PLUS SEULEMENT COCHÉ.
 *
 * ⚠️ CONSTATÉ LE 11/10/2026 : la case « …et le traitement de mes données de santé pour le
 * coaching » n'existait que dans le formulaire d'inscription, en `required` HTML. Rien ne
 * la gardait en mémoire, et « Continuer avec Google » sur la page de CONNEXION créait un
 * compte neuf sans jamais la montrer. Or Pacevo traite des données de santé (fréquence
 * cardiaque, sommeil, douleurs) : le RGPD (art. 9) exige un accord EXPLICITE, et de pouvoir
 * prouver qu'il a été donné.
 *
 * L'accord vit désormais dans `app_metadata` du compte (écrit par le serveur seul, la
 * personne ne peut ni le forger ni l'effacer) : la date, le chemin, la version du texte.
 * Tout compte sans accord passe par `/consentement` avant le tableau de bord ou
 * l'onboarding — y compris les comptes créés AVANT cette date : un accord qu'on n'a pas
 * enregistré, on ne le fabrique pas, on le redemande.
 *
 * Module PUR (importable par les pages) : l'écriture passe par l'API d'administration.
 */
export const VERSION_CONSENTEMENT = "2026-10-11";

/** Par où l'accord a été donné : la case du formulaire, la case avant Google, l'écran dédié. */
export type ViaConsentement = "inscription" | "google" | "ecran";

/** Vrai si ce compte a un accord enregistré. */
export function aConsenti(appMetadata: Record<string, unknown> | null | undefined): boolean {
  const le = appMetadata?.consentement_sante_le;
  return typeof le === "string" && le.length > 0;
}

/** Les champs `app_metadata` qui enregistrent un accord donné maintenant. */
export function champsConsentement(via: ViaConsentement, maintenant = new Date()) {
  return { consentement_sante_le: maintenant.toISOString(), consentement_sante_via: via, consentement_version: VERSION_CONSENTEMENT };
}

/** Les mêmes champs, effacés (`null` supprime la clé côté GoTrue). */
export const CONSENTEMENT_EFFACE = { consentement_sante_le: null, consentement_sante_via: null, consentement_version: null };

/**
 * Cookie posé par l'INSCRIPTION juste avant de partir chez Google, une fois la case cochée :
 * au retour (`/auth/callback`), l'accord est enregistré sans le redemander. Absent (Google
 * lancé depuis la CONNEXION), le nouveau compte passe par `/consentement`.
 */
export const COOKIE_ACCORD = "pacevo_accord";
