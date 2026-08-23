import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * L'ESPACE COACH NE S'OUVRE QUE DEPUIS UN APPAREIL DE CONFIANCE.
 *
 * ⚠️ UN MOT DE PASSE NE LIE RIEN À UNE MACHINE. Tant que l'accès ne dépend que d'un
 * couple adresse + mot de passe, toute machine où ce couple est saisi — ou toute session
 * restée ouverte ailleurs — ouvre les factures des clients et le chiffre d'affaires.
 *
 * Le principe : l'appareil reçoit UNE FOIS un jeton scellé par le serveur, après saisie
 * d'un code que seul l'éditeur connaît. Ce jeton vit dans un cookie que le navigateur ne
 * peut pas lire (HttpOnly) et qui ne part que vers ce site (Secure, SameSite). Sans lui,
 * la bonne adresse et le bon mot de passe ne suffisent pas.
 *
 * Ce que ça protège vraiment : une session volée, un mot de passe deviné, ou une
 * connexion depuis une machine tierce. Ce que ça ne protège pas : quelqu'un ASSIS DEVANT
 * le Mac déverrouillé — aucune barrière logicielle ne le fera.
 *
 * ⚠️ ET SI RIEN N'EST CONFIGURÉ, ON NE VÉRIFIE RIEN. Exiger un jeton avant que les
 * variables d'environnement existent enfermerait l'éditeur dehors de son propre espace,
 * sans recours. L'écran insiste, il ne bloque pas.
 */

export const COOKIE_APPAREIL = "pacevo_admin_appareil";
/** Au-delà, il faut resaisir le code. Un jeton éternel ne se révoque jamais tout seul. */
export const DUREE_JOURS = 180;

/** La protection n'est active que si les DEUX secrets existent. */
export function appareilExige(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean((env.ADMIN_DEVICE_SECRET ?? "").trim() && (env.ADMIN_DEVICE_CODE ?? "").trim());
}

const sceau = (secret: string, charge: string): string =>
  createHmac("sha256", secret).update(charge).digest("base64url");

/**
 * ⚠️ L'IDENTIFIANT DU COMPTE EST DANS LA SIGNATURE. Sans lui, un jeton délivré à un
 * compte servirait à n'importe quel autre : il suffirait de le recopier.
 */
export function signerAppareil(secret: string, userId: string, appareilId: string, emisLe: number): string {
  if (!secret) throw new Error("Secret d'appareil manquant : refus de signer.");
  return `${appareilId}.${emisLe}.${sceau(secret, `${userId}|${appareilId}|${emisLe}`)}`;
}

export type Verdict = { ok: true; appareilId: string } | { ok: false; motif: string };

export function verifierAppareil(opts: {
  secret: string; userId: string; jeton: string | null | undefined;
  maintenant?: number; dureeJours?: number;
}): Verdict {
  const { secret, userId, jeton, maintenant = Date.now(), dureeJours = DUREE_JOURS } = opts;
  // ⚠️ Un secret vide rendrait toute signature triviale à fabriquer : on refuse, on ne
  // « laisse pas passer faute de mieux ».
  if (!secret) return { ok: false, motif: "Secret d'appareil non configuré." };
  const parts = String(jeton ?? "").split(".");
  if (parts.length !== 3) return { ok: false, motif: "Aucun appareil de confiance." };

  const [appareilId, emisTxt, signature] = parts;
  const emisLe = Number(emisTxt);
  if (!appareilId || !Number.isFinite(emisLe)) return { ok: false, motif: "Jeton illisible." };

  const attendu = sceau(secret, `${userId}|${appareilId}|${emisLe}`);
  const a = Buffer.from(attendu), b = Buffer.from(signature);
  // ⚠️ Comparaison à temps constant : un `===` sur une signature laisse mesurer, essai
  // après essai, combien de caractères sont justes.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, motif: "Appareil non reconnu." };

  if (maintenant - emisLe > dureeJours * 86400000) return { ok: false, motif: "Appareil expiré : resaisis le code." };
  // Un jeton daté du futur est forcément fabriqué ou l'horloge a été manipulée.
  if (emisLe - maintenant > 86400000) return { ok: false, motif: "Jeton daté du futur." };
  return { ok: true, appareilId };
}

/** Le code d'enrôlement, comparé sans laisser fuir sa longueur ni son contenu. */
export function codeValide(saisi: string, attendu: string): boolean {
  if (!attendu) return false;
  const a = Buffer.from(sceau("code", saisi)), b = Buffer.from(sceau("code", attendu));
  return timingSafeEqual(a, b);
}
