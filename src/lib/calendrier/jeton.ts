/**
 * LE JETON DE L'ABONNEMENT DE CALENDRIER — l'adresse secrète vaut une clé : qui la possède
 * lit le plan du coureur (type et durée des séances seulement, voir ics.ts). D'où :
 *   - 32 octets (256 bits), illisibles sans la clé du serveur : aucun lien VISIBLE avec le compte ;
 *   - seule son EMPREINTE (SHA-256) est gardée en base (table `calendrier_abonnements`) ;
 *   - un format strict à la lecture : tout autre chemin répond 404 avant d'interroger la base.
 *
 * RÉAFFICHABLE (28/11/2026). Le premier jeton était tiré au hasard et ne s'affichait qu'UNE fois :
 * Cyprien l'a ajouté à Google depuis l'ordinateur, en a recréé un pour l'iPhone, et Google, resté
 * sur l'ancien lien mort, n'affichait plus rien. Un parent qui « n'y connaît rien » ne doit pas
 * avoir à comprendre ça. Le jeton est donc DÉRIVÉ : HMAC(clé du serveur, compte + date de
 * création). Le serveur le recalcule à chaque visite, le coureur retrouve ses boutons sur tous ses
 * appareils, et la base ne garde toujours que l'empreinte. Changer de lien = nouvelle date.
 * La clé dérive de SUPABASE_SERVICE_ROLE_KEY (déjà présente, jamais envoyée au navigateur). Si
 * elle change, les liens déjà donnés aux agendas MARCHENT ENCORE (le flux cherche par empreinte,
 * voir flux.ts) ; seul le réaffichage devient impossible : l'encart passe en « ancien lien ».
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

/** 32 octets au hasard en base64url (43 caractères) : l'ancien tirage, servi seulement aux tests (liens d'avant le 28/11). */
export function nouveauJeton(): string {
  return randomBytes(32).toString("base64url");
}

export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

/**
 * Le jeton du compte pour une date de création donnée. `maitre` : la clé du serveur (lue dans
 * l'environnement à défaut ; injectée par les tests). Lève si la clé ou la date manque : jamais
 * de jeton calculé sur une valeur par défaut, il serait devinable.
 */
export function jetonDe(userId: string, creeLe: string, maitre = process.env.SUPABASE_SERVICE_ROLE_KEY): string {
  if (!maitre) throw new Error("clé du serveur absente : jeton de calendrier impossible");
  const t = Date.parse(creeLe);
  if (!userId || !Number.isFinite(t)) throw new Error("compte ou date de création illisible");
  const cle = createHmac("sha256", maitre).update("pacevo/calendrier/jeton/v1").digest();
  return createHmac("sha256", cle).update(`${userId}:${t}`).digest("base64url");
}

/**
 * Le jeton de la ligne d'abonnement, s'il se recalcule (sinon `null` : lien d'avant le 28/11/2026,
 * tiré au hasard, que le serveur ne peut plus retrouver).
 */
export function jetonRetrouve(userId: string, ligne: { cree_le?: string | null; jeton_empreinte?: string | null }, maitre?: string): string | null {
  if (!ligne.cree_le || !ligne.jeton_empreinte) return null;
  const j = jetonDe(userId, ligne.cree_le, maitre ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
  return empreinteJeton(j) === ligne.jeton_empreinte ? j : null;
}

const FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** Le jeton tel qu'il arrive dans l'adresse (« …/flux/<jeton>.ics ») ; `null` s'il n'en a pas la forme. */
export function jetonDuChemin(segment: string | null | undefined): string | null {
  const brut = String(segment ?? "").replace(/\.ics$/i, "");
  return FORMAT.test(brut) ? brut : null;
}

export type Liens = { https: string; webcal: string; google: string; outlook: string; outlookPro: string };

/**
 * Les adresses d'abonnement : https (copie, autres agendas), webcal (Apple), page d'ajout (Google),
 * page d'ajout d'Outlook.com (`outlook`) et d'Outlook d'un compte de travail ou d'école (`outlookPro`).
 *
 * OUTLOOK EN UN CLIC (28/11/2026). Microsoft ne documente pas `/calendar/0/addfromweb?url=…&name=…`,
 * mais l'essai réel de Cyprien (compte d'école, renvoyé vers outlook.cloud.microsoft) a ajouté le
 * calendrier d'un coup ; non connecté, Microsoft garde l'adresse (`deeplink=`) le temps de la
 * connexion. Avant : un guide en 3 étapes (copier, ouvrir, « S'abonner à partir du web ») où
 * Cyprien s'est perdu. Si Microsoft retire cette adresse, le bouton ouvre Outlook sans rien ajouter :
 * « Copier le lien » reste là pour le faire à la main.
 *
 * ⚠️ OUTLOOK REÇOIT L'ADRESSE HTTPS, JAMAIS WEBCAL (28/11/2026). Avec `webcal://`, Outlook lit
 * `http://pacevo.fr/…`, que l'hébergeur renvoie vers https par un 308 ; les serveurs de Microsoft
 * ne le suivent pas : « Nous n'avons pas pu importer le calendrier », et aucune lecture du flux
 * côté Pacevo. Même essai avec l'adresse https : calendrier importé, séances affichées.
 */
export function adresseFlux(origine: string, jeton: string): Liens {
  const https = `${origine.replace(/\/+$/, "")}/api/calendrier/flux/${jeton}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  const ajoutOutlook = (hote: string) => `https://${hote}/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=Pacevo`;
  return {
    https, webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: ajoutOutlook("outlook.live.com"),
    outlookPro: ajoutOutlook("outlook.office.com"),
  };
}
