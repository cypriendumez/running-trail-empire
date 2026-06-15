// ─────────────────────────────────────────────────────────────────────────────
//  Collecte de VRAIS parcours sur TOUTE LA FRANCE depuis OpenStreetMap (ODbL).
//  Stratégie : métadonnées par tuiles (léger) → géométrie GPS chargée à la
//  demande au clic (API /api/parcours/geometry). Couvre tout le pays.
//
//  Classement région + département via les contours officiels IGN (point-in-poly).
//  Lancer :  node collecte_france.js
//  Sortie :  data/dataset.json
// ─────────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const { cleanName } = require("./clean_dataset.js");

const OUT = "data/dataset_france.json";
const DEPTS = JSON.parse(fs.readFileSync("/tmp/departements.geojson", "utf-8"));
const REGIONS = JSON.parse(fs.readFileSync("/tmp/regions.geojson", "utf-8"));

// ─── Point-in-polygon (ray casting), gère Polygon & MultiPolygon + trous ────────
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolygon(lng, lat, polygon) { // polygon = [outer, hole, hole…]
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (pointInRing(lng, lat, polygon[k])) return false;
  return true;
}
function classify(lng, lat, features) {
  for (const f of features) {
    const g = f.geometry;
    if (g.type === "Polygon") {
      if (pointInPolygon(lng, lat, g.coordinates)) return f.properties.nom;
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) if (pointInPolygon(lng, lat, poly)) return f.properties.nom;
    }
  }
  return null;
}

// ─── Sport : mapping OSM → catégories de l'app (avec un peu de running) ──────────
function mapSport(route, distance) {
  switch (route) {
    case "bicycle": return "Vélo (Route)";
    case "mtb": return "VTT";
    case "running": return "Running";
    case "foot": return (distance && distance > 25) ? "Randonnée" : "Running"; // urbain/court = running
    case "hiking": return (distance && distance > 35) ? "Randonnée" : "Trail"; // long = rando
    default: return null;
  }
}
const SPEED = { "Running": 11, "Trail": 8.5, "Randonnée": 4.8, "Vélo (Route)": 19, "VTT": 13 };

function parseDistance(tags) {
  const d = tags.distance || tags["distance:km"];
  if (!d) return null;
  const m = String(d).replace(",", ".").match(/[\d.]+/);
  return m ? Math.round(parseFloat(m[0]) * 100) / 100 : null;
}

// ─── Grille de tuiles couvrant la France métropolitaine ─────────────────────────
function buildGrid() {
  const cells = [];
  const latStep = 1.6, lngStep = 2.0;
  for (let lat = 41.0; lat < 51.6; lat += latStep) {
    for (let lng = -5.4; lng < 9.8; lng += lngStep) {
      cells.push([lat, lng, Math.min(lat + latStep, 51.6), Math.min(lng + lngStep, 9.8)]);
    }
  }
  return cells;
}

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTile(cell, attempt = 0) {
  const [S, W, N, E] = cell;
  const q = `[out:json][timeout:120];(relation["route"~"hiking|foot|running|bicycle|mtb"]["name"](${S},${W},${N},${E}););out tags center;`;
  const ep = ENDPOINTS[attempt % ENDPOINTS.length];
  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RunningTrailEmpire/1.0 (parcours import; ODbL)" },
      body: "data=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(140000),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    return json.elements || [];
  } catch (e) {
    if (attempt < 3) { await sleep(4000); return fetchTile(cell, attempt + 1); }
    console.log(`  ⚠️ tuile ${cell.join(",")} échouée: ${e.message}`);
    return null;
  }
}

(async () => {
  const grid = buildGrid();
  console.log(`Collecte sur ${grid.length} tuiles…`);
  const byId = new Map();
  let done = 0;

  for (const cell of grid) {
    const els = await fetchTile(cell);
    done++;
    if (els && els.length) {
      for (const el of els) {
        if (el.type !== "relation" || !el.tags || !el.tags.name || !el.center) continue;
        if (!byId.has(el.id)) byId.set(el.id, el);
      }
    }
    if (done % 5 === 0 || done === grid.length) console.log(`  ${done}/${grid.length} tuiles · ${byId.size} parcours bruts`);
    await sleep(3000); // throttle doux : ne sature ni Overpass ni le PC
  }

  console.log(`Classement géographique de ${byId.size} parcours…`);
  const parcours = [];
  for (const el of byId.values()) {
    const name = cleanName(el.tags.name);
    if (name.length < 4 || !/[A-Za-zÀ-ÿ]{2,}/.test(name)) continue; // codes/placeholders écartés

    const lng = el.center.lon, lat = el.center.lat;
    const region = classify(lng, lat, REGIONS.features);
    if (!region) continue;            // hors France métropolitaine
    const departement = classify(lng, lat, DEPTS.features) || "—";

    const distance = parseDistance(el.tags);
    if (distance && distance < 1) continue; // minimum 1 km (distances connues)
    const sport = mapSport(el.tags.route, distance);
    if (!sport) continue;

    let temps = "—", cal = 0;
    if (distance) {
      const totMin = (distance / SPEED[sport]) * 60;
      temps = `${Math.floor(totMin / 60)}h${String(Math.round(totMin % 60)).padStart(2, "0")}`;
      cal = Math.round(distance * (sport === "Vélo (Route)" ? 40 : 65));
    }
    const diff = !distance ? "Moyen" : distance < 10 ? "Facile" : distance < 25 ? "Moyen" : "Difficile";

    parcours.push({
      id: el.id,
      osm_id: el.id,
      osm_type: "relation",
      nom: name,
      sport,
      difficulte: diff,
      type_parcours: el.tags.roundtrip === "yes" ? "Boucle" : "Aller simple",
      distance_km: distance || 0,
      denivele_positif_m: 0,
      denivele_negatif_m: 0,
      temps_estime: temps,
      calories_kcal: cal,
      pente_mean: "0.0",
      altitude_min_m: 0,
      altitude_max_m: 0,
      lat, lng,
      localisation: { departement, region },
      description: `${sport}${distance ? ` de ${Math.round(distance)} km` : ""} dans ${departement} (${region}). Données © contributeurs OpenStreetMap (ODbL).`,
    });
  }

  parcours.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(parcours), "utf-8");

  const byReg = {}, bySport = {};
  for (const p of parcours) { byReg[p.localisation.region] = (byReg[p.localisation.region] || 0) + 1; bySport[p.sport] = (bySport[p.sport] || 0) + 1; }
  console.log(`\n✅ ${parcours.length} VRAIS parcours France écrits dans ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} Mo)`);
  console.log("   Par sport :", bySport);
  console.log("   Par région :", Object.fromEntries(Object.entries(byReg).sort((a, b) => b[1] - a[1])));
})();
