/**
 * LE DOMAINE D'UNE ADRESSE REÇOIT-IL DU COURRIER ?
 *
 * ⚠️ PERSONNE NE PEUT SAVOIR SI UNE BOÎTE EXISTE avant d'y écrire : Gmail, Outlook et les
 * autres refusent de répondre à cette question, précisément pour que les spammeurs ne
 * puissent pas tester des adresses. Ce qu'on PEUT savoir, c'est si le DOMAINE a un serveur
 * de courrier — et c'est là que tombent la plupart des fautes de frappe (« gmial.com »,
 * « outlok.fr », « hotmal.fr »). Jusqu'ici, l'inscription répondait « c'est envoyé » à
 * n'importe quelle adresse bien formée, et la personne attendait un e-mail qui ne
 * partirait jamais nulle part.
 *
 * Deux garde-fous, dans cet ordre :
 *  1. `suggestionDomaine` — la faute de frappe évidente sur un fournisseur courant, sans
 *     réseau : on propose « tu voulais dire outlook.fr ? ».
 *  2. `domaineRecoitDuCourrier` — une requête DNS (MX, sinon A) sur le domaine. Elle ne
 *     dit rien sur l'existence d'un COMPTE Pacevo (règle anti-annuaire de la route
 *     d'inscription) : elle parle du domaine, pas de la personne.
 *
 * ⚠️ EN CAS DE DOUTE, ON LAISSE PASSER. Un DNS qui ne répond pas (délai, panne) rend
 * « inconnu », et l'inscription continue : bloquer un vrai coureur parce qu'un résolveur
 * tousse serait pire que laisser passer une faute de frappe.
 */
import { promises as dns } from "node:dns";

/** Les domaines de messagerie qu'on rencontre réellement chez des coureurs français. */
export const FOURNISSEURS_COURANTS = [
  "gmail.com", "outlook.fr", "outlook.com", "hotmail.fr", "hotmail.com", "live.fr", "live.com",
  "yahoo.fr", "yahoo.com", "icloud.com", "me.com", "orange.fr", "wanadoo.fr", "free.fr",
  "sfr.fr", "laposte.net", "gmx.fr", "gmx.com", "protonmail.com", "proton.me", "bbox.fr",
] as const;

/** Distance de Levenshtein : le nombre de lettres à changer pour passer de a à b. */
export function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Le fournisseur courant le plus proche d'un domaine mal tapé, ou `null`.
 *
 * Seuil : 1 ou 2 lettres. Au-delà, ce n'est plus une faute de frappe mais un autre
 * domaine (« outlook.fr » et « outlook.com » sont à 3 : deux adresses légitimes, on ne
 * suggère pas). Un domaine exactement égal à un fournisseur n'a rien à suggérer.
 */
export function suggestionDomaine(domaine: string): string | null {
  const d = domaine.trim().toLowerCase();
  if (!d || (FOURNISSEURS_COURANTS as readonly string[]).includes(d)) return null;
  let meilleur: { nom: string; dist: number } | null = null;
  for (const nom of FOURNISSEURS_COURANTS) {
    const dist = distance(d, nom);
    if (dist >= 1 && dist <= 2 && (!meilleur || dist < meilleur.dist)) meilleur = { nom, dist };
  }
  return meilleur?.nom ?? null;
}

export type EtatDomaine = "oui" | "non" | "inconnu";

/**
 * « oui » si le domaine a un enregistrement MX (ou, à défaut, une adresse A/AAAA : la
 * norme autorise la livraison sur l'hôte lui-même) ; « non » s'il n'existe pas ou n'a
 * ni l'un ni l'autre ; « inconnu » si le DNS n'a pas répondu à temps.
 */
export async function domaineRecoitDuCourrier(domaine: string, delaiMs = 2500): Promise<EtatDomaine> {
  const d = domaine.trim().toLowerCase();
  if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return "non";
  const garde = new Promise<"inconnu">((res) => setTimeout(() => res("inconnu"), delaiMs));
  const requete = (async (): Promise<EtatDomaine> => {
    try {
      const mx = await dns.resolveMx(d);
      if (mx.length) return "oui";
    } catch (e) {
      const code = (e as { code?: string }).code;
      // ENOTFOUND : le domaine n'existe pas. ENODATA : il existe mais sans MX → on tente A.
      if (code !== "ENOTFOUND" && code !== "ENODATA") return "inconnu";
      if (code === "ENOTFOUND") return "non";
    }
    try {
      const a = await dns.resolve4(d);
      return a.length ? "oui" : "non";
    } catch (e) {
      const code = (e as { code?: string }).code;
      return code === "ENOTFOUND" || code === "ENODATA" ? "non" : "inconnu";
    }
  })();
  return Promise.race([requete, garde]);
}
