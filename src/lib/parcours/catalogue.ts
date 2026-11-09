import fs from "fs";
import path from "path";
import { gunzipSync } from "zlib";

/**
 * LE PARCOURS EXISTE-T-IL DANS LE CATALOGUE PACEVO ? (09/11/2026)
 *
 * La route du tracé journalise un parcours « supprimé d'OpenStreetMap » pour qu'on le retire du
 * catalogue. Sans ce contrôle, n'importe quel compte connecté écrivait une ligne d'error_logs par
 * identifiant inventé (relecture « échecs muets ») — et un chemin demandé comme relation passait pour
 * un parcours mort. On ne journalise que ce qui est vraiment au catalogue, sous le même type.
 *
 * Le fichier compact (`data/parcours_certifies.min.json.gz`, embarqué pour cette route dans
 * next.config.ts) n'est lu qu'au premier refus, puis gardé en mémoire. Illisible ⇒ `null` : la porte
 * reste fermée (rien n'est journalisé comme « supprimé »), RIEN n'est retenu (on relit au refus
 * suivant) et la route journalise la panne elle-même — un ensemble vide mémorisé aurait fait taire
 * pour toujours la liste des parcours morts, sans trace (relecture « échecs muets », 09/11/2026).
 */
let CLES: Map<string, number> | null = null;

function cles(): Map<string, number> | null {
  if (CLES) return CLES;
  try {
    const brut = JSON.parse(gunzipSync(fs.readFileSync(path.join(process.cwd(), "data", "parcours_certifies.min.json.gz"))).toString("utf-8")) as { osm_id?: number; osm_type?: string; distance_km?: number }[];
    CLES = new Map(brut.filter((p) => Number(p.osm_id) > 0).map((p) => [`${p.osm_type || "relation"}/${p.osm_id}`, Number(p.distance_km) || 0]));
    return CLES;
  } catch {
    return null;
  }
}

/** `true`/`false` : au catalogue ou non ; `null` : catalogue illisible (à journaliser par l'appelant). */
export function estDuCatalogue(type: string, id: string): boolean | null {
  const c = cles();
  return c ? c.has(`${type}/${id}`) : null;
}

/**
 * Distance AFFICHÉE du parcours (km), celle à laquelle le navigateur compare le tracé ; 0 hors
 * catalogue (le navigateur garde son contrôle) ; `null` si le catalogue est ILLISIBLE — à ne pas
 * confondre avec 0 : la route coupe alors le cache, sinon un morceau y resterait 30 jours sans
 * contrôle et sans trace (relecture « échecs muets » du 09/11/2026).
 */
export function distanceDuCatalogue(type: string, id: string): number | null {
  const c = cles();
  return c ? c.get(`${type}/${id}`) ?? 0 : null;
}
