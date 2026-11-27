/**
 * LE JETON DE L'ABONNEMENT DE CALENDRIER — l'adresse secrète vaut une clé : qui la possède
 * lit le plan du coureur. D'où :
 *   - 32 octets aléatoires (256 bits), sans AUCUN lien avec l'identifiant du compte ;
 *   - seule son EMPREINTE (SHA-256) est gardée en base (table `calendrier_abonnements`) ;
 *   - un format strict à la lecture : tout autre chemin répond 404 avant d'interroger la base.
 */
import { createHash, randomBytes } from "node:crypto";

/** 32 octets en base64url : 43 caractères [A-Za-z0-9_-]. */
export function nouveauJeton(): string {
  return randomBytes(32).toString("base64url");
}

export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

const FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** Le jeton tel qu'il arrive dans l'adresse (« …/flux/<jeton>.ics ») ; `null` s'il n'en a pas la forme. */
export function jetonDuChemin(segment: string | null | undefined): string | null {
  const brut = String(segment ?? "").replace(/\.ics$/i, "");
  return FORMAT.test(brut) ? brut : null;
}

/** L'adresse d'abonnement, servie une seule fois au coureur. */
export function adresseFlux(origine: string, jeton: string): { https: string; webcal: string; google: string } {
  const https = `${origine.replace(/\/+$/, "")}/api/calendrier/flux/${jeton}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return { https, webcal, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` };
}
