/**
 * DOUBLONS PARFAITS — la même course, deux fois, à la lettre près (30/09/2026).
 *
 * Audit du catalogue : « Trail des Fontaines » (Le Montat), « 20 km de Maroilles »,
 * « Trail des Marathoniers » (Groix)… deux lignes identiques — même nom (à l'article et à la
 * typographie près, `nomCanonique`), même ville, même date, même distance — reprises deux
 * fois d'une source fermée. Rien ne les distingue : l'une est de trop.
 *
 * ⚠️ UNE PREUVE, PAS UNE RESSEMBLANCE. On ne rapproche jamais « Course de Bondues » et
 * « Foulées de Bondues » (lib/races/groupes) : seuls les quatre champs identiques comptent.
 * Et on ne retire JAMAIS une ligne finishers (l'application hebdomadaire la recréerait ;
 * deux fiches finishers en double relèvent de `fichesJumelles`) ni une ligne en favori.
 */
import { nomCanonique } from "./groupes";

export type LigneDoublon = {
  id: string; name: string; city: string | null; date: string; distance_km: number | null;
  organization?: string | null; elevation_gain_m?: number | null; resultats_url?: string | null;
  inscription_url?: string | null; site_officiel?: string | null; latitude?: number | null;
};

const ville = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const estFinishers = (l: LigneDoublon) => l.organization === "finishers.com";
/** Ce que la ligne apporte : on garde la plus renseignée. */
const richesse = (l: LigneDoublon) => [l.elevation_gain_m, l.resultats_url, l.inscription_url, l.site_officiel, l.latitude]
  .filter((x) => x != null && x !== "").length;

/** Les lignes à retirer : dans chaque groupe identique, toutes sauf la meilleure. */
export function doublonsParfaits(lignes: readonly LigneDoublon[], favoris: ReadonlySet<string>): string[] {
  const groupes = new Map<string, LigneDoublon[]>();
  for (const l of lignes) {
    const nom = nomCanonique(l.name);
    if (!nom || !(Number(l.distance_km) > 0)) continue;
    const k = `${nom}|${ville(l.city)}|${String(l.date).slice(0, 10)}|${Number(l.distance_km)}`;
    groupes.set(k, [...(groupes.get(k) ?? []), l]);
  }
  const aRetirer: string[] = [];
  for (const g of groupes.values()) {
    if (g.length < 2) continue;
    const ordre = [...g].sort((a, b) =>
      Number(favoris.has(b.id)) - Number(favoris.has(a.id))
      || Number(estFinishers(b)) - Number(estFinishers(a))
      || richesse(b) - richesse(a)
      || a.id.localeCompare(b.id));
    for (const l of ordre.slice(1)) if (!favoris.has(l.id) && !estFinishers(l)) aRetirer.push(l.id);
  }
  return aRetirer;
}
