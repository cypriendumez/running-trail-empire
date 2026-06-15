// ─────────────────────────────────────────────────────────────────────────────
//  Import de VRAIS parcours des Hauts-de-France depuis OpenStreetMap (Overpass).
//  Entrée : /tmp/osm_hdf.json  (relations route= avec géométrie, `out geom;`)
//  Sortie : data/dataset.json  (format ParcoursHdf + vraie géométrie GPS)
//
//  Lancer :  node importer_parcours_reels.js
// ─────────────────────────────────────────────────────────────────────────────
const fs = require("fs");

const SRC = "/tmp/osm_hdf.json";
const OUT = "data/dataset.json";

// ─── Cadres géographiques des 5 départements HDF ────────────────────────────────
const DEPT_BBOX = {
  "Nord":          { latMin: 50.00, latMax: 51.10, lngMin: 2.05, lngMax: 4.25 },
  "Pas-de-Calais": { latMin: 50.00, latMax: 51.00, lngMin: 1.50, lngMax: 3.20 },
  "Somme":         { latMin: 49.55, latMax: 50.40, lngMin: 1.35, lngMax: 3.20 },
  "Oise":          { latMin: 49.05, latMax: 49.75, lngMin: 1.65, lngMax: 3.20 },
  "Aisne":         { latMin: 48.83, latMax: 50.10, lngMin: 3.00, lngMax: 4.30 },
};

// Centres approximatifs des zones (pour rattacher chaque parcours à une zone réelle)
const ZONE_CENTROIDS = {
  "Nord": {
    "Métropole Lilloise": [50.63, 3.06], "Monts de Flandre": [50.78, 2.65], "Avesnois": [50.12, 3.95],
    "Pévèle Carembault": [50.52, 3.18], "Cambrésis": [50.17, 3.40], "Valenciennois": [50.36, 3.52],
    "Plaine de la Lys": [50.66, 2.78], "Littoral Dunkerquois": [51.00, 2.40], "Douaisis": [50.37, 3.08],
  },
  "Pas-de-Calais": {
    "Côte d'Opale": [50.72, 1.61], "Boulonnais": [50.72, 1.75], "Bassin Minier": [50.45, 2.83],
    "Arrageois": [50.29, 2.78], "Audomarois": [50.75, 2.25], "Ternois": [50.38, 2.30],
    "Sept Vallées": [50.36, 2.05], "Calaisis": [50.95, 1.86],
  },
  "Somme": {
    "Baie de Somme": [50.20, 1.60], "Vallée de la Somme": [49.95, 2.40], "Amiénois": [49.89, 2.30],
    "Santerre": [49.85, 2.75], "Ponthieu": [50.13, 1.95], "Vimeu": [50.05, 1.65],
  },
  "Oise": {
    "Forêt de Compiègne": [49.38, 2.90], "Massif de Chantilly": [49.19, 2.47], "Beauvaisis": [49.43, 2.08],
    "Valois": [49.25, 2.88], "Pays de Bray": [49.45, 1.75], "Clermontois": [49.38, 2.41],
  },
  "Aisne": {
    "Thiérache": [49.92, 3.90], "Laonnois": [49.56, 3.62], "Vallée de l'Aisne": [49.40, 3.50],
    "Soissonnais": [49.38, 3.32], "Saint-Quentinois": [49.85, 3.29], "Vermandois": [49.83, 3.20],
  },
};

const SPORT_MAP = {
  hiking: "Trail", foot: "Randonnée", running: "Running",
  bicycle: "Vélo (Route)", mtb: "VTT",
};

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function totalKm(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
  return d;
}
// Assemble la géométrie des ways membres en une seule polyligne (lng,lat).
function assemble(members) {
  const coords = [];
  for (const m of members) {
    if (m.type !== "way" || !Array.isArray(m.geometry)) continue;
    for (const g of m.geometry) {
      const pt = [g.lon, g.lat];
      const last = coords[coords.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) coords.push(pt);
    }
  }
  return coords;
}
// Réduit la polyligne à maxPts points (garde départ + arrivée).
function simplify(coords, maxPts) {
  if (coords.length <= maxPts) return coords;
  const step = Math.ceil(coords.length / maxPts);
  const out = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  if (out[out.length - 1] !== coords[coords.length - 1]) out.push(coords[coords.length - 1]);
  return out.map(([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);
}
function centroid(coords) {
  let lat = 0, lng = 0;
  for (const [x, y] of coords) { lng += x; lat += y; }
  return [lng / coords.length, lat / coords.length]; // [lng, lat]
}
function deptOf(c) { // c = [lng,lat] — renvoie null si hors des 5 départements HDF
  for (const [name, b] of Object.entries(DEPT_BBOX)) {
    if (c[1] >= b.latMin && c[1] <= b.latMax && c[0] >= b.lngMin && c[0] <= b.lngMax) return name;
  }
  return null;
}
// Exclut la Belgique : la frontière NE de la région est diagonale (Dunkerque →
// Lille → Maubeuge), un simple rectangle laisse passer la Flandre belge.
function inBelgium(c) { // c = [lng, lat]
  const [lng, lat] = c;
  if (lat > 51.12) return true;                       // au nord de Dunkerque
  if (lng > 2.4) {
    const borderLat = 51.0 - (lng - 2.5) * 0.43;      // ligne frontière approx.
    if (lat > borderLat) return true;
  }
  return false;
}

function zoneOf(dept, c) { // c = [lng,lat]
  const zones = ZONE_CENTROIDS[dept];
  let best = Object.keys(zones)[0], bd = Infinity;
  for (const [name, [zlat, zlng]] of Object.entries(zones)) {
    const d = (c[1] - zlat) ** 2 + (c[0] - zlng) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

// ─── Lecture ────────────────────────────────────────────────────────────────────
let raw;
try {
  raw = JSON.parse(fs.readFileSync(SRC, "utf-8"));
} catch (e) {
  console.error(`❌ Impossible de lire ${SRC} :`, e.message);
  process.exit(1);
}
const elements = raw.elements || [];
console.log(`Relations reçues d'OSM : ${elements.length}`);

const SPEED = { "Running": 11, "Trail": 8.5, "Randonnée": 4.8, "Vélo (Route)": 19, "VTT": 13 };
const parcours = [];
const seen = new Set();

for (const el of elements) {
  if (el.type !== "relation" || !el.tags || !el.tags.name) continue;
  const sport = SPORT_MAP[el.tags.route];
  if (!sport) continue;

  // Qualité des noms : on écarte les codes de réseau à points-nœuds ("22-21",
  // "04-03"…) et les noms sans la moindre lettre.
  const name = el.tags.name.trim();
  if (name.length < 4 || !/[A-Za-zÀ-ÿ]{2,}/.test(name)) continue;

  const coordsFull = assemble(el.members || []);
  if (coordsFull.length < 2) continue;

  const distance = totalKm(coordsFull);
  if (distance < 1 || distance > 400) continue; // écarte le bruit

  // Dédoublonnage nom+distance arrondie
  const key = `${name}|${Math.round(distance)}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const c = centroid(coordsFull);
  if (inBelgium(c)) continue; // Flandre belge → ignoré
  const dept = deptOf(c);
  if (!dept) continue; // hors Hauts-de-France → ignoré
  const zone = zoneOf(dept, c);
  const coords = simplify(coordsFull, 220);

  const start = coordsFull[0], end = coordsFull[coordsFull.length - 1];
  const boucle = haversine(start, end) < 0.25; // < 250 m → boucle

  const diff = distance < 10 ? "Facile" : distance < 22 ? "Moyen" : "Difficile";
  const spd = SPEED[sport];
  const totMin = (distance / spd) * 60;
  const hrs = Math.floor(totMin / 60), mins = Math.round(totMin % 60);

  parcours.push({
    id: el.id,
    osm_type: "relation",
    nom: name,
    sport,
    difficulte: diff,
    type_parcours: boucle ? "Boucle" : "Aller simple",
    distance_km: Math.round(distance * 100) / 100,
    denivele_positif_m: 0, // calculé en direct à l'ouverture (vraie altimétrie)
    denivele_negatif_m: 0,
    temps_estime: `${hrs}h${mins < 10 ? "0" : ""}${mins}`,
    calories_kcal: Math.round(distance * (sport === "Vélo (Route)" ? 40 : 65)),
    pente_mean: "0.0",
    altitude_min_m: 0,
    altitude_max_m: 0,
    localisation: { departement: dept, zone },
    description: `${sport} réel de ${Math.round(distance)} km dans ${zone} (${dept})${el.tags.network ? ` · réseau ${el.tags.network}` : ""}. Tracé issu d'OpenStreetMap.`,
    coordinates: coords, // VRAIE géométrie GPS [lng,lat]
  });
}

// Tri : boucles d'abord, puis par distance croissante (UX agréable)
parcours.sort((a, b) =>
  (a.type_parcours === b.type_parcours ? a.distance_km - b.distance_km : a.type_parcours === "Boucle" ? -1 : 1));

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(parcours), "utf-8");

const bySport = {}, byDept = {};
for (const p of parcours) { bySport[p.sport] = (bySport[p.sport] || 0) + 1; byDept[p.localisation.departement] = (byDept[p.localisation.departement] || 0) + 1; }
console.log(`✅ ${parcours.length} VRAIS parcours écrits dans ${OUT}`);
console.log("   Par sport :", bySport);
console.log("   Par département :", byDept);
console.log(`   Taille fichier : ${(fs.statSync(OUT).size / 1e6).toFixed(1)} Mo`);
