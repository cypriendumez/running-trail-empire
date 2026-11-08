// ─────────────────────────────────────────────────────────────────────────────
//  L'ADRESSE D'UNE PAGE QUI PLANTE, SANS CE QU'ELLE PEUT PORTER DE SECRET.
//
//  Constaté le 08/11/2026 (audit des données de santé) : le journal recevait
//  `location.href` COMPLET. Sur la page de suivi en direct, `/suivre/<id>`, l'identifiant
//  est le SEUL secret du lien qui montre la position GPS d'un coureur en temps réel :
//  toute erreur JavaScript sur cette page l'écrivait dans `error_logs`. Même risque pour
//  une requête (`?suivre=`, `?code=`, `?next=`) ou un fragment d'un flux de connexion.
//
//  On garde l'ORIGINE (le tri du bruit de développement en a besoin) et le chemin
//  ramené à son gabarit, comme les statistiques de visites (`normaliserChemin`).
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserChemin } from "@/lib/visites/empreinte";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function urlJournalisable(brut: unknown): string | null {
  if (typeof brut !== "string" || !brut.trim()) return null;
  let origine = "";
  let chemin = brut.trim();
  try {
    const u = new URL(chemin);
    origine = u.origin;
    chemin = u.pathname;
  } catch {
    chemin = chemin.split(/[?#]/)[0];
  }
  // Les chemins techniques (`/api/…`) ne sont pas des pages : `normaliserChemin` les écarte,
  // on les garde nus, identifiants masqués.
  const gabarit = normaliserChemin(chemin) ?? chemin.split(/[?#]/)[0].replace(UUID, "[id]");
  return `${origine}${gabarit}`.slice(0, 1000);
}
