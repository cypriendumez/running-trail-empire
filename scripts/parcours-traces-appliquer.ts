/**
 * APPLIQUER LE CONTRÔLE DES TRACÉS AU CATALOGUE (scripts/parcours-traces-controler.ts).
 *
 *   npx tsx scripts/parcours-traces-appliquer.ts <dossier-du-contrôle> [--ecrire]
 *
 *  · « partiel » et « vide » : RETIRÉS. L'application refuserait d'afficher leur tracé
 *    (« tracé incomplet ») — un parcours qu'on ne peut pas ouvrir n'a rien à faire dans la liste ;
 *  · « écart » (le tracé d'aujourd'hui ne fait pas la distance annoncée : « Au grès de la
 *    Juine », 14,3 km annoncés, 41,3 km de tracé) : distance, dénivelé, altitudes, durée,
 *    calories et difficulté REMESURÉS sur le tracé actuel (altitude IGN) — un coureur ne doit
 *    pas lire 14 km et en courir 41. Si l'altitude ne répond pas (panne passagère), le parcours
 *    est gardé tel quel, compté « à remesurer », et repris au passage suivant ;
 *    Au-delà d'un facteur 1,6 (ou en deçà de 0,6), le tracé n'est plus le parcours annoncé (des
 *    variantes ajoutées à la relation, un itinéraire redessiné) : RETIRÉ, pas remesuré — on ne
 *    montre pas 41 km de tronçons mis bout à bout sous le nom d'une boucle de 14 km ;
 *  · le profil d'altitude et la plus longue montée d'origine, devenus faux, sont effacés ; la
 *    pente maximale est recalculée ;
 *  · « ok », « troué » (le tracé affiché couvre la distance), « super-relation » : inchangés.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { altitudes, denivele, alleger, penteMax, estAllerRetour } from "./parcours-importer";
export { estAllerRetour };
import { arreterSiDepasse, seuil } from "./garde-fous";

type LL = [number, number];
const SPEED: Record<string, number> = { "Running": 11, "Trail": 8.5, "Randonnée": 4.8, "Vélo (Route)": 19, "VTT": 13 };
const CLIMB: Record<string, number> = { "Running": 6, "Trail": 9, "Randonnée": 10, "Vélo (Route)": 4, "VTT": 6 };
const KCAL: Record<string, number> = { "Running": 65, "Trail": 70, "Randonnée": 55, "Vélo (Route)": 40, "VTT": 50 };
const fmt = (min: number) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`; };

/** Le tracé d'aujourd'hui est-il encore le parcours annoncé ? (sinon : retiré, pas remesuré) */
export const ecartAcceptable = (km: number, annonce: number) => annonce > 0 && km / annonce <= 1.6 && km / annonce >= 0.6;

export function remesurer<T extends Record<string, unknown> & { sport: string }>(p: T, km: number, dn: { dp: number; dm: number; min: number; max: number }, pente: number): T {
  const sport = p.sport;
  // Le profil et la plus longue montée venaient de l'ANCIEN tracé : faux désormais, effacés.
  const { profil: _p, montee_max_m: _m, ...reste } = p as Record<string, unknown>;
  void _p; void _m;
  const duree = Math.round((km / SPEED[sport]) * 60 + (dn.dp / 100) * CLIMB[sport]);
  const w = sport === "Trail" || sport === "Randonnée" || sport === "VTT" ? 1.3 : 1;
  const effort = km + (dn.dp / 100) * w;
  return {
    ...(reste as T), distance_km: Math.round(km * 100) / 100,
    denivele_positif_m: dn.dp, denivele_negatif_m: dn.dm, altitude_min_m: dn.min, altitude_max_m: dn.max,
    duree_min: duree, temps_estime: fmt(duree), calories_kcal: Math.round(km * KCAL[sport] + dn.dp * 0.9),
    difficulte: effort < 12 ? "Facile" : effort < 28 ? "Moyen" : "Difficile", pente_max_pct: pente,
    confiance_distance: "haute (tracé OSM remesuré le 28/11/2026)", confiance_denivele: "IGN RGE ALTI (remesuré le 28/11/2026)",
  };
}

/**
 * Les décisions (par identifiant : `null` = retiré, un objet = remesuré) appliquées au catalogue
 * RELU juste avant d'écrire : l'altitude de centaines d'écarts prend du temps, et un import ou un
 * audit écrit entre-temps ne doit pas être écrasé (relecture du 28/11/2026). Un parcours sans
 * décision — ajouté entre-temps — est gardé tel quel.
 */
export function appliquerDecisions<T extends { osm_id: number }>(frais: T[], decisions: Map<number, Partial<T> | null>): T[] {
  const out: T[] = [];
  for (const p of frais) {
    if (!decisions.has(p.osm_id)) { out.push(p); continue; }
    const d = decisions.get(p.osm_id);
    if (!d) continue;
    // Seuls les champs MESURÉS s'appliquent, sur la ligne fraîche : un nom réparé ou un sport
    // recalculé entre-temps survit (relecture du 28/11/2026). Le profil de l'ancien tracé s'efface.
    const { profil: _p, montee_max_m: _m, ...reste } = p as Record<string, unknown>;
    void _p; void _m;
    out.push({ ...(reste as T), ...d });
  }
  return out;
}

/** Les champs qu'une remesure change (rien d'autre ne passe de la décision au catalogue). */
export const CHAMPS_MESURES = ["distance_km", "denivele_positif_m", "denivele_negatif_m", "altitude_min_m", "altitude_max_m",
  "duree_min", "temps_estime", "calories_kcal", "difficulte", "pente_max_pct", "confiance_distance", "confiance_denivele"] as const;

if (process.argv[1]?.endsWith("parcours-traces-appliquer.ts")) {
  const dossier = process.argv[2];
  const ecrire = process.argv.includes("--ecrire");
  const SOURCE = "data/parcours_certifies.json";
  const items = JSON.parse(readFileSync(SOURCE, "utf8")) as (Record<string, unknown> & { osm_id: number; sport: string; nom: string })[];
  const verdicts = JSON.parse(readFileSync(path.join(dossier, "verdicts.json"), "utf8")) as Record<string, { verdict: string; km?: number }>;
  const tracés = new Map<number, LL[]>();
  const f = path.join(dossier, "a-remesurer.jsonl");
  if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) if (l.trim()) { try { const o = JSON.parse(l); tracés.set(o.id, o.c); } catch { /* ligne coupée */ } }
  (async () => {
    const decisions = new Map<number, Partial<(typeof items)[number]> | null>();
    const bilan: Record<string, number> = {};
    const exemples: string[] = [];
    const n = (k: string) => { bilan[k] = (bilan[k] ?? 0) + 1; };
    for (const p of items) {
      const v = verdicts[String(p.osm_id)];
      if (!v) { n("non contrôlé (gardé)"); continue; }
      if (v.verdict === "partiel" || v.verdict === "vide") { n(`retiré : ${v.verdict}`); decisions.set(p.osm_id, null); continue; }
      if (v.verdict === "écart") {
        // Comme à l'import : moins d'un kilomètre de tracé n'est pas un parcours.
        if (v.km && v.km < 1) { n("retiré : moins d'un kilomètre de tracé"); decisions.set(p.osm_id, null); continue; }
        const c0 = tracés.get(p.osm_id);
        const allerRetour = !!c0 && !!v.km && v.km / Number(p.distance_km) >= 1.85 && v.km / Number(p.distance_km) <= 2.15 && estAllerRetour(c0);
        if (!v.km || (!ecartAcceptable(v.km, Number(p.distance_km)) && !allerRetour)) { n("retiré : tracé sans rapport avec le parcours annoncé"); decisions.set(p.osm_id, null); if (exemples.length < 15) exemples.push(`RETIRÉ ${p.nom} : ${p.distance_km} km annoncés, ${v.km} km de tracé`); continue; }
        const c = tracés.get(p.osm_id);
        const ech = c ? alleger(c, 50, 400) : null;
        const z = ech ? await altitudes(ech) : null;
        const dn = z && denivele(z);
        // Altitude présente mais trouée : le dénivelé ne se mesure pas, et la distance affichée est
        // fausse. Retiré (définitif), plutôt qu'un dénivelé sous-estimé présenté comme mesuré.
        if (ech && z && !dn) { n("retiré : altitude IGN incomplète"); decisions.set(p.osm_id, null); continue; }
        // Altitude injoignable : une panne PASSAGÈRE ne retire rien. Gardé tel quel, compté, et
        // remesuré au prochain passage (les verdicts restent).
        if (!ech || !z || !dn) { n(c ? "à remesurer (altitude IGN injoignable), gardé tel quel" : "à remesurer (tracé non gardé), gardé tel quel"); continue; }
        const q = remesurer(p, v.km, dn, penteMax(ech, z));
        if (exemples.length < 15) exemples.push(`${p.nom} : ${p.distance_km} km → ${q.distance_km} km · D+ ${p.denivele_positif_m} → ${q.denivele_positif_m} m`);
        const champs = Object.fromEntries(CHAMPS_MESURES.map((k) => [k, (q as Record<string, unknown>)[k]])) as Record<string, unknown>;
        if (allerRetour) champs.type_parcours = "Aller-retour";
        n(allerRetour ? "remesuré (aller-retour)" : "remesuré"); decisions.set(p.osm_id, champs as Partial<(typeof items)[number]>); continue;
      }
      n(v.verdict);
    }
    // Le catalogue d'AUJOURD'HUI, relu au dernier moment.
    const out = appliquerDecisions(JSON.parse(readFileSync(SOURCE, "utf8")) as typeof items, decisions);
    console.log(JSON.stringify({ avant: items.length, apres: out.length, bilan, exemples }, null, 1));
    // Garde-fou : un contrôle faussé (réponses tronquées) ne vide pas le catalogue.
    const retires = [...decisions.values()].filter((d) => d === null).length;
    if (ecrire) arreterSiDepasse([{ quoi: "parcours retirés", n: retires, max: seuil(process.argv, "--max-retraits", 1500) }]);
    if (ecrire) { writeFileSync(SOURCE, JSON.stringify(out)); console.log(`écrit : ${SOURCE}\n⚠️ relancer « npx tsx scripts/parcours-compacter.ts » : la production lit le .min.json.gz`); }
  })();
}
