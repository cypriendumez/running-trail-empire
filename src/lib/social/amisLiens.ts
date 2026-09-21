/**
 * AJOUTER DES AMIS — les fonctions pures derrière le QR code, les contacts et l'invitation.
 *
 * Rien ici ne touche au réseau ni au DOM : tout se teste avec des chaînes, y compris
 * les entrées absurdes (`tests/amis.crash.test.ts`).
 */

/** Un identifiant Supabase : un UUID, et rien d'autre. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const estUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/**
 * Le lien qu'encode le QR code d'un athlète : `/amis/<id>` sur le domaine public.
 *
 * ⚠️ UNE PAGE PUBLIQUE, PAS `/dashboard/…` : l'ami qui scanne n'est pas forcément
 * connecté, et le tableau de bord le renverrait vers /login en PERDANT le lien. La
 * page `/amis/<id>` reste lisible sans compte et garde l'intention jusqu'à la connexion.
 */
export function lienAmi(origine: string, id: string): string {
  return `${origine.replace(/\/+$/, "")}/amis/${id}`;
}

/**
 * L'identifiant d'athlète porté par un lien scanné — ou `null` pour tout ce qui n'est
 * pas un lien Pacevo vers un athlète. Un QR code d'un autre service (une affiche, une
 * carte de visite) ne doit jamais devenir une navigation.
 */
export function idDepuisLien(texte: unknown, origine?: string): string | null {
  if (typeof texte !== "string" || texte.length > 300) return null;
  let url: URL;
  try { url = new URL(texte.trim()); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (origine && url.origin !== origine) return null;
  const m = url.pathname.match(/^\/amis\/([^/]+)\/?$/);
  return m && estUuid(m[1]) ? m[1].toLowerCase() : null;
}

/**
 * Les adresses e-mail à comparer aux comptes — nettoyées, dédoublonnées, bornées.
 *
 * ⚠️ BORNÉES (100) : le sélecteur de contacts peut renvoyer un carnet entier ; sans
 * plafond, la requête `.in("email", …)` deviendrait un moyen d'énumérer les inscrits par
 * paquets de milliers. Cent adresses couvrent un carnet d'amis, pas un annuaire.
 */
export const CONTACTS_MAX = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliserEmails(entree: unknown): string[] {
  if (!Array.isArray(entree)) return [];
  const vus = new Set<string>();
  for (const v of entree) {
    if (typeof v !== "string") continue;
    const e = v.trim().toLowerCase();
    if (e.length > 254 || !EMAIL.test(e)) continue;
    vus.add(e);
    if (vus.size >= CONTACTS_MAX) break;
  }
  return [...vus];
}

/**
 * Un chemin de retour après connexion (`/login?next=…`) n'est accepté que s'il reste
 * SUR le site : un chemin absolu, sans `//` (qui ferait une adresse externe dans un
 * navigateur) ni schéma. Tout le reste retombe sur le tableau de bord.
 */
export function cheminSur(next: unknown, defaut = "/dashboard"): string {
  if (typeof next !== "string" || next.length > 500) return defaut;
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\s]/.test(next) || /^\/[^/]*:/.test(next.split("?")[0])) return defaut;
  return next;
}
