/**
 * AUDIT ET CORRECTION DU CATALOGUE DE PARCOURS, D'APRÈS L'ÉTAT ACTUEL D'OPENSTREETMAP.
 *
 *   npx tsx scripts/parcours-auditer.ts <etiquettes.json> [--ecrire]
 *
 * `<etiquettes.json>` : les étiquettes OSM actuelles de chaque relation du catalogue
 * ({ "<osm_id>": { name, route, state, … } | null }), relues par Overpass
 * (`relation(id:…);out tags;`). `null` = relation SUPPRIMÉE d'OSM depuis la collecte.
 * Sans `--ecrire`, le script rend seulement le rapport. ⚠️ À lancer SEUL : il réécrit le fichier lu
 * au départ (rapide, sans appel réseau), donc jamais pendant un import ou un contrôle qui écrit.
 *
 * Né de l'audit du 27/11/2026 (Cyprien : « corrige les noms abîmés et vérifie que les
 * 15 000 parcours n'ont aucune erreur ») :
 *  1. sort du catalogue : relation supprimée d'OSM, projet (`state=proposed|planned`),
 *     abandonnée (`state=disused|abandoned`), ou qui n'est plus un itinéraire sportif ;
 *  2. le nom : celui d'OSM AUJOURD'HUI (les contributeurs en corrigent), puis réparé sans
 *     rien inventer (`reparerNom`, src/lib/parcours/noms.ts) ;
 *  3. le sport : d'après le TYPE OSM réel. La collecte rangeait toute randonnée
 *     (`route=hiking`) en « Trail » sauf au-delà de 35 km — 61 randonnées sur 15 708. Règle :
 *       running → Running · bicycle → Vélo (Route) · mtb → VTT ;
 *       hiking / foot → « Trail » si le terrain est vallonné (≥ 25 m de D+ par km, le relief
 *       d'un trail), « Randonnée » sinon ; un `foot` court (≤ 21 km) et plat → Running ;
 *  4. durée, calories et difficulté recalculées pour le sport retenu (mêmes formules que
 *     la certification, verifier.js).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { reparerNom } from "../src/lib/parcours/noms";
import { arreterSiDepasse, seuil } from "./garde-fous";

type Parcours = Record<string, unknown> & {
  osm_id: number; nom: string; sport: string; distance_km: number; denivele_positif_m: number;
  depart?: string | null; arrivee?: string | null;
};
type Etiquettes = Record<string, Record<string, string> | null>;

const SPEED: Record<string, number> = { "Running": 11, "Trail": 8.5, "Randonnée": 4.8, "Vélo (Route)": 19, "VTT": 13 };
const CLIMB: Record<string, number> = { "Running": 6, "Trail": 9, "Randonnée": 10, "Vélo (Route)": 4, "VTT": 6 };
const KCAL: Record<string, number> = { "Running": 65, "Trail": 70, "Randonnée": 55, "Vélo (Route)": 40, "VTT": 50 };

const SPORTIFS = ["hiking", "foot", "running", "bicycle", "mtb"];

/**
 * Le type sportif d'une relation. ⚠️ Deux pièges vus à l'audit du 27/11/2026 :
 *  · `route=hiking;horse` (sentier pédestre ET équestre) est une randonnée ;
 *  · `route=historic` sur un réseau PÉDESTRE (`network=lwn|rwn|nwn|iwn`) est une randonnée
 *    à thème (« Randonnée Trois-Fontaine-L'Abbaye ») — pas une route à retirer.
 */
export function typeSportif(t: Record<string, string> | undefined): string | undefined {
  if (!t) return undefined;
  const types = (t.route ?? "").split(";").map((x) => x.trim());
  const sportif = types.find((x) => SPORTIFS.includes(x));
  if (sportif) return sportif;
  if (types.includes("historic") && /^[lrni]wn$/.test(t.network ?? "")) return "hiking";
  return undefined;
}

export function sportDepuisOsm(route: string | undefined, distanceKm: number, dPlus: number): string | null {
  const parKm = distanceKm > 0 ? dPlus / distanceKm : 0;
  switch (route) {
    case "running": return "Running";
    case "bicycle": return "Vélo (Route)";
    case "mtb": return "VTT";
    case "foot":
      if (distanceKm <= 21 && parKm < 25) return "Running";
      return parKm >= 25 ? "Trail" : "Randonnée";
    case "hiking": return parKm >= 25 ? "Trail" : "Randonnée";
    default: return null;
  }
}

/** Un itinéraire qu'on ne peut pas (ou plus) parcourir n'a rien à faire dans le catalogue. */
export function raisonDeRetrait(t: Record<string, string> | null | undefined): string | null {
  if (t === null) return "supprimé d'OpenStreetMap";
  if (!t) return null;   // non relu : on garde, sans rien changer
  const etat = (t.state ?? "").toLowerCase();
  if (["proposed", "planned", "construction"].includes(etat)) return "projet (non réalisé)";
  if (["disused", "abandoned", "dismantled"].includes(etat) || t["disused:route"] || t["abandoned:route"]) return "abandonné";
  if (!typeSportif(t)) return `n'est plus un itinéraire sportif (${t.type === "route" ? `route=${t.route ?? "—"}` : `type=${t.type ?? "—"}`})`;
  return null;
}

const duree = (sport: string, d: number, dp: number) => Math.round((d / (SPEED[sport] || 8)) * 60 + (dp / 100) * (CLIMB[sport] || 8));
const fmtDuree = (min: number) => { if (!min || min <= 0) return "—"; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`; };
const kcal = (sport: string, d: number, dp: number) => Math.round(d * (KCAL[sport] || 60) + dp * 0.9);
const difficulte = (d: number, dp: number, sport: string) => {
  const w = sport === "Trail" || sport === "Randonnée" || sport === "VTT" ? 1.3 : 1;
  const e = d + (dp / 100) * w;
  return e < 12 ? "Facile" : e < 28 ? "Moyen" : "Difficile";
};

export function auditer(items: Parcours[], etiquettes: Etiquettes) {
  const gardes: Parcours[] = [];
  const retires: { id: number; nom: string; raison: string }[] = [];
  const noms: { id: number; avant: string; apres: string }[] = [];
  const sports: Record<string, number> = {};
  for (const p of items) {
    const t = etiquettes[String(p.osm_id)];
    const raison = raisonDeRetrait(t);
    if (raison) { retires.push({ id: p.osm_id, nom: p.nom, raison }); continue; }
    const q = { ...p };
    // `||` et non `??` : un `name` OSM vide garde le nom du catalogue (relecture du 28/11/2026).
    const nomOsm = (t?.name?.trim() || p.nom).trim();
    const nom = reparerNom({ nom: nomOsm, depart: p.depart, arrivee: p.arrivee });
    if (nom !== p.nom) noms.push({ id: p.osm_id, avant: p.nom, apres: nom });
    q.nom = nom;
    const sport = t ? sportDepuisOsm(typeSportif(t), p.distance_km, p.denivele_positif_m) ?? p.sport : p.sport;
    if (sport !== p.sport) {
      sports[`${p.sport} → ${sport}`] = (sports[`${p.sport} → ${sport}`] ?? 0) + 1;
      q.sport = sport;
      const dm = duree(sport, p.distance_km, p.denivele_positif_m);
      q.duree_min = dm; q.temps_estime = fmtDuree(dm);
      q.calories_kcal = kcal(sport, p.distance_km, p.denivele_positif_m);
      q.difficulte = difficulte(p.distance_km, p.denivele_positif_m, sport);
    }
    gardes.push(q);
  }
  return { gardes, retires, noms, sports };
}

if (process.argv[1]?.endsWith("parcours-auditer.ts")) {
  const [fichierEtiquettes] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const ecrire = process.argv.includes("--ecrire");
  const SOURCE = "data/parcours_certifies.json";
  const items = JSON.parse(readFileSync(SOURCE, "utf8")) as Parcours[];
  const etiquettes = JSON.parse(readFileSync(fichierEtiquettes, "utf8")) as Etiquettes;
  const relus = items.filter((p) => String(p.osm_id) in etiquettes).length;
  const { gardes, retires, noms, sports } = auditer(items, etiquettes);
  const parRaison: Record<string, number> = {};
  for (const r of retires) parRaison[r.raison] = (parRaison[r.raison] ?? 0) + 1;
  const compte = (l: Parcours[]) => l.reduce<Record<string, number>>((a, p) => { a[p.sport] = (a[p.sport] ?? 0) + 1; return a; }, {});
  console.log(JSON.stringify({
    total: items.length, relus, gardes: gardes.length, retires: retires.length, parRaison,
    exemplesRetires: retires.slice(0, 8), nomsReparés: noms.length, exemplesNoms: noms.slice(0, 25),
    changementsDeSport: sports, sportsAvant: compte(items), sportsApres: compte(gardes),
  }, null, 1));
  if (ecrire) {
    // Garde-fou : un fichier d'étiquettes incomplet (relations relues `null` à tort) ne vide pas le catalogue.
    arreterSiDepasse([{ quoi: "parcours retirés", n: retires.length, max: seuil(process.argv, "--max-retraits", 500) }]);
    writeFileSync(SOURCE, JSON.stringify(gardes));
    console.log(`écrit : ${SOURCE} (${gardes.length} parcours)\n⚠️ relancer « npx tsx scripts/parcours-compacter.ts » : la production lit le .min.json.gz`);
  }
}
