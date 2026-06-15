// ─────────────────────────────────────────────────────────────────────────────
//  AUDIT OFFICIEL DES PARCOURS — multi-sources, recoupé, pour mise en vente.
//  Chaque MESURE est vérifiée par des SOURCES INDÉPENDANTES qui doivent concorder :
//    • Tracé GPS ........ OpenStreetMap (Overpass) — cartographie communautaire
//    • Distance ......... calculée sur le tracé + analyse des trous (incertitude)
//    • Dénivelé D+/D- ... IGN RGE ALTI (officiel France, 1-5 m)  RECOUPÉ  open-meteo
//    • Altitude ......... idem (2 sources)
//    • Départements ..... point-in-polygon contours IGN (offline, exact)
//    • Pays traversés ... point-in-polygon Natural Earth (offline) — transfrontalier OK
//    • Communes D/A ..... reverse-geocode IGN (officiel)
//    • Eau / mer ........ altitude ≤ 0 (2 sources concordantes)
//  Difficulté, durée (corrigée du D+) et calories sont recalculées.
//
//  Par lots, reprenable, tout en cache disque. node verifier.js [N] | --from a --count b
//  --report (page de revue)  ·  --stats  ·  --data-scan
// ─────────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");

const DATASET = "data/dataset_france.json";
const DEPTS_FILE = "/tmp/departements.geojson";
const COUNTRIES_FILE = "/tmp/ne_countries.geojson";

// Caches lourds du crawl (~290 Mo / 37k fichiers : tracés OSM, altitudes, reverse-geocode).
// SORTIS de l'arbre du projet pour ne pas étouffer le watcher du dev server (Next/Turbopack
// scanne tout le cwd → 37k fichiers = lenteur extrême). L'app n'y touche JAMAIS ; seul ce
// script les lit/écrit. Emplacement par défaut : dossier frère « ../rte-crawl-cache ».
// Repli automatique sur l'ancien « data/ » s'il n'a pas (encore) été déplacé. Override : $RTE_CACHE_DIR.
const CACHE_BASE = process.env.RTE_CACHE_DIR
  || (fs.existsSync(path.join(__dirname, "..", "rte-crawl-cache")) ? path.join(__dirname, "..", "rte-crawl-cache") : "data");
try { fs.mkdirSync(CACHE_BASE, { recursive: true }); } catch {}
const CACHE_DIR = path.join(CACHE_BASE, "geom_cache");
const ELEV_DIR = path.join(CACHE_BASE, "elev_cache");
const REVGEO_FILE = path.join(CACHE_BASE, "revgeo_cache.json");
const RESULTS = path.join(CACHE_BASE, "verification_results.jsonl");
const DATA_REPORT = "data/data_scan.json";
const APP = "http://localhost:3000/api/parcours/geometry";
const IGN_ELEV = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
const IGN_REV = "https://data.geopf.fr/geocodage/reverse";
const OM_ELEV = "https://api.open-meteo.com/v1/elevation";
const OSRM = "https://router.project-osrm.org/route/v1";
const UA = "RunningTrailEmpire-verif/1.0 (audit qualité parcours)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Allures à plat (km/h) & coût de montée (min / 100 m D+) par sport
const SPEED = { "Running": 11, "Trail": 8.5, "Randonnée": 4.8, "Vélo (Route)": 19, "VTT": 13 };
const CLIMB = { "Running": 6, "Trail": 9, "Randonnée": 10, "Vélo (Route)": 4, "VTT": 6 };
const KCAL = { "Running": 65, "Trail": 70, "Randonnée": 55, "Vélo (Route)": 40, "VTT": 50 };

// ─── Géométrie ──────────────────────────────────────────────────────────────────
function haversine(a, b) {
  const R = 6371, dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function lengthKm(c) { let d = 0; for (let i = 1; i < c.length; i++) d += haversine(c[i - 1], c[i]); return d; }
function sampleEvenly(coords, n) {
  const out = []; const N = Math.min(n, coords.length);
  for (let i = 0; i < N; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (N - 1))]);
  return out;
}

// ─── Point-in-polygon (départements + pays), avec bbox ──────────────────────────
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolygon(lng, lat, polygon) {
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (pointInRing(lng, lat, polygon[k])) return false;
  return true;
}
function withBbox(features, nameKey) {
  for (const f of features) {
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const [x, y] of poly[0]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    f._bbox = [minX, minY, maxX, maxY]; f._name = f.properties[nameKey] ?? f.properties.name ?? f.properties.nom;
  }
  return features;
}
let DEPTS = null, COUNTRIES = null;
function depts() { if (!DEPTS) DEPTS = withBbox(JSON.parse(fs.readFileSync(DEPTS_FILE, "utf-8")).features, "nom"); return DEPTS; }
function countries() { if (!COUNTRIES) COUNTRIES = withBbox(JSON.parse(fs.readFileSync(COUNTRIES_FILE, "utf-8")).features, "name"); return COUNTRIES; }
function hit(features, lng, lat) {
  for (const f of features) {
    const b = f._bbox; if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    const g = f.geometry;
    if (g.type === "Polygon") { if (pointInPolygon(lng, lat, g.coordinates)) return f._name; }
    else for (const poly of g.coordinates) if (pointInPolygon(lng, lat, poly)) return f._name;
  }
  return null;
}
const deptAt = (lng, lat) => hit(depts(), lng, lat);          // null = hors France métropolitaine
const countryAt = (lng, lat) => hit(countries(), lng, lat) || "?";

// ─── Tracé : OpenStreetMap (Overpass) EN DIRECT — indépendant du serveur du site ─
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
// Assemblage anti-eau : on garde la plus longue chaîne, on ne rattache que les trous
// < 250 m, jamais de ligne droite entre morceaux éloignés (pas de trait dans l'eau/champs).
function assembleOverpass(elements) {
  const segs = [];
  for (const el of elements) if (el.type === "way" && el.geometry && el.geometry.length >= 2) segs.push(el.geometry.map((g) => [g.lon, g.lat]));
  return chainSegments(segs);
}
function chainKm(c) { let d = 0; for (let i = 1; i < c.length; i++) d += haversine(c[i - 1], c[i]); return d; }
function dedupChain(chain) {
  const out = [];
  for (const p of chain) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - p[0]) >= 1e-9 || Math.abs(l[1] - p[1]) >= 1e-9) out.push(p); }
  return out;
}
function chainSegments(segs) {
  const valid = segs.filter((s) => s.length >= 2);
  if (valid.length <= 1) return dedupChain(valid[0] ?? []);
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 5e-5 && Math.abs(a[1] - b[1]) < 5e-5;
  const used = new Array(valid.length).fill(false);
  const chains = [];
  for (let start = 0; start < valid.length; start++) {
    if (used[start]) continue;
    let chain = valid[start].slice(); used[start] = true; let extended = true;
    while (extended) {
      extended = false; const head = chain[0], tail = chain[chain.length - 1];
      for (let i = 0; i < valid.length; i++) {
        if (used[i]) continue; const s = valid[i], a = s[0], b = s[s.length - 1];
        if (eq(tail, a)) chain = chain.concat(s.slice(1));
        else if (eq(tail, b)) chain = chain.concat(s.slice(0, -1).reverse());
        else if (eq(head, b)) chain = s.slice(0, -1).concat(chain);
        else if (eq(head, a)) chain = s.slice(1).reverse().concat(chain);
        else continue;
        used[i] = true; extended = true; break;
      }
    }
    chains.push(chain);
  }
  if (chains.length === 1) return dedupChain(chains[0]);
  const GAP_KM = 0.25;
  chains.sort((a, b) => chainKm(b) - chainKm(a));
  const usedC = new Array(chains.length).fill(false);
  let result = chains[0].slice(); usedC[0] = true; let added = true;
  while (added) {
    added = false; const head = result[0], tail = result[result.length - 1];
    let best = -1, rev = false, prepend = false, bestGap = Infinity;
    for (let i = 0; i < chains.length; i++) {
      if (usedC[i]) continue; const c = chains[i], a = c[0], b = c[c.length - 1];
      const tA = haversine(tail, a), tB = haversine(tail, b), hA = haversine(head, a), hB = haversine(head, b);
      if (tA < bestGap) { bestGap = tA; best = i; rev = false; prepend = false; }
      if (tB < bestGap) { bestGap = tB; best = i; rev = true; prepend = false; }
      if (hB < bestGap) { bestGap = hB; best = i; rev = false; prepend = true; }
      if (hA < bestGap) { bestGap = hA; best = i; rev = true; prepend = true; }
    }
    if (best >= 0 && bestGap < GAP_KM) {
      usedC[best] = true; added = true;
      const c = rev ? chains[best].slice().reverse() : chains[best];
      result = prepend ? c.concat(result) : result.concat(c);
    }
  }
  return dedupChain(result);
}
async function getGeometry(p) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const type = p.osm_type || "relation";
  const f = path.join(CACHE_DIR, `${type}_${p.osm_id}.json`);
  if (fs.existsSync(f)) { try { const c = JSON.parse(fs.readFileSync(f, "utf-8")); if (c.length > 1) return { coords: c, fromCache: true }; } catch {} }
  const q = `[out:json][timeout:60];${type}(${p.osm_id});${type === "relation" ? ">>;" : ""}out geom;`;
  let netErr = null;
  for (let i = 0; i < OVERPASS.length; i++) {
    try {
      const res = await fetch(OVERPASS[i], {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RunningTrailEmpire/1.0 (parcours; ODbL)" },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(i === 0 ? 40000 : 12000), // miroir de secours : timeout court (ne pas perdre 30 s s'il est mort)
      });
      if (!res.ok) { netErr = "HTTP " + res.status; continue; } // 429 / 5xx → vraie limite réseau → on tente le miroir suivant
      const json = await res.json();
      const coords = assembleOverpass(json.elements ?? []);
      if (coords.length > 1) { fs.writeFileSync(f, JSON.stringify(coords)); return { coords, fromCache: false }; }
      return { coords: [], fromCache: false }; // réponse VALIDE mais aucun tracé en base OSM → GEOM_VIDE, ce n'est PAS une erreur réseau
    } catch (e) { netErr = e.name === "TimeoutError" ? "timeout" : (e.message || "réseau"); }
  }
  return { coords: [], fromCache: false, error: netErr || "réseau" }; // tous les miroirs en échec réseau → GEOM_INDISPO (compté pour la pause)
}

// ─── Réparation des petits trous : route le long des VRAIES voies (OSRM) ────────
function osrmProfile(sport) { return (sport === "Vélo (Route)" || sport === "VTT") ? "bike" : "foot"; }
async function routeGap(a, b, profile) {   // a,b = [lng,lat] → coords routées le long des voies
  const url = `${OSRM}/${profile}/${a[0]},${a[1]};${b[0]},${b[1]}?geometries=geojson&overview=full`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (res.ok) { const j = await res.json(); const c = j.routes?.[0]?.geometry?.coordinates; if (c && c.length > 1) return c; }
    } catch {}
    if (attempt < 1) await sleep(1500);
  }
  return null;
}
// Densifie une polyligne : aucun pas > maxStepKm (interpolation linéaire).
function densify(seg, maxStepKm = 0.2) {
  const out = [seg[0]];
  for (let i = 1; i < seg.length; i++) {
    const a = out[out.length - 1], b = seg[i], d = haversine(a, b);
    if (d > maxStepKm) { const n = Math.ceil(d / maxStepKm); for (let k = 1; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    out.push(b);
  }
  return out;
}
// Comble chaque trou (0,3–5 km) : si OSRM confirme une vraie voie quasi-directe (snap serré,
// détour faible), on densifie → le trou disparaît. Sinon (eau, pas de route) on laisse → exclu.
async function repairTrace(coords, sport) {
  const profile = osrmProfile(sport);
  const out = [coords[0]];
  let fixed = 0, unfixable = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i], gap = haversine(a, b);
    if (gap > 0.3 && gap < 5) {
      const seg = await routeGap(a, b, profile);
      await sleep(300);
      const tight = seg && seg.length > 1 && haversine(a, seg[0]) < 0.25 && haversine(seg[seg.length - 1], b) < 0.25;
      if (tight && lengthKm(seg) < gap * 2.5 + 0.3) {           // vraie voie quasi-directe
        const d = densify([a, ...seg, b], 0.2);
        for (let k = 1; k < d.length; k++) out.push(d[k]);
        fixed++; continue;
      }
      unfixable++;
    } else if (gap >= 5) unfixable++;
    out.push(b);
  }
  return { coords: out, fixed, unfixable };
}

// ─── Altitudes IGN + open-meteo (cache par parcours) ────────────────────────────
async function ignZ(points) {           // RGE ALTI officiel — 200 pts/appel
  const out = [];
  for (let c = 0; c < points.length; c += 200) {
    const chunk = points.slice(c, c + 200);
    const lon = chunk.map((p) => p[0].toFixed(6)).join("|"), lat = chunk.map((p) => p[1].toFixed(6)).join("|");
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const res = await fetch(`${IGN_ELEV}?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld&delimiter=|&zonly=true`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
        const j = await res.json();
        if (Array.isArray(j.elevations) && j.elevations.length === chunk.length) { out.push(...j.elevations.map((z) => (z < -1000 ? null : z))); ok = true; }
      } catch {}
      if (!ok && a < 2) await sleep(3000);
    }
    if (!ok) return null;
    if (c + 200 < points.length) await sleep(500);
  }
  return out;
}
let OM_COOLDOWN = 0;                       // open-meteo = source SECONDAIRE (contrôle). Si quota atteint,
async function omZ(points) {              // on la met en pause sans bloquer le crawl (l'IGN officiel suffit).
  if (Date.now() < OM_COOLDOWN) return null;
  const out = [];
  for (let c = 0; c < points.length; c += 100) {
    const chunk = points.slice(c, c + 100);
    const lat = chunk.map((p) => p[1].toFixed(5)).join(","), lon = chunk.map((p) => p[0].toFixed(5)).join(",");
    let ok = false;
    for (let a = 0; a < 2 && !ok; a++) {
      try {
        const res = await fetch(`${OM_ELEV}?latitude=${lat}&longitude=${lon}`, { signal: AbortSignal.timeout(20000) });
        if (res.status === 429) { OM_COOLDOWN = Date.now() + 60 * 60 * 1000; return null; } // quota → pause 1 h
        const j = await res.json();
        if (Array.isArray(j.elevation) && j.elevation.length === chunk.length) { out.push(...j.elevation); ok = true; }
      } catch {}
      if (!ok && a < 1) await sleep(2000);
    }
    if (!ok) return null;
  }
  return out;
}
// D+ / D- avec seuil anti-bruit (hystérésis) — évite de gonfler le dénivelé.
function dplus(elev, T = 4) {
  const e = elev.filter((z) => z != null);
  if (e.length < 2) return { dp: null, dm: null, min: null, max: null };
  let gain = 0, loss = 0, ref = e[0];
  for (const z of e) { const d = z - ref; if (d >= T) { gain += d; ref = z; } else if (d <= -T) { loss += -d; ref = z; } }
  return { dp: Math.round(gain), dm: Math.round(loss), min: Math.round(Math.min(...e)), max: Math.round(Math.max(...e)) };
}

// ─── Reverse-geocode IGN (commune), caché ───────────────────────────────────────
let REV = null;
function revCache() { if (!REV) { try { REV = JSON.parse(fs.readFileSync(REVGEO_FILE, "utf-8")); } catch { REV = {}; } } return REV; }
function flushRev() { if (REV) try { fs.writeFileSync(REVGEO_FILE, JSON.stringify(REV)); } catch {} }
let NOMI_COOLDOWN = 0;   // Nominatim = repli pour zones isolées sans adresse IGN (forêts, montagne)
async function commune(lng, lat) {
  const key = `${lng.toFixed(4)},${lat.toFixed(4)}`; const cache = revCache();
  if (cache[key] !== undefined) return cache[key];
  let val = null;
  try {                 // 1) IGN (officiel France)
    const res = await fetch(`${IGN_REV}?lon=${lng.toFixed(5)}&lat=${lat.toFixed(5)}&index=address&limit=1`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    const j = await res.json();
    const pr = j.features?.[0]?.properties;
    if (pr && (pr.city || pr.name)) val = { city: pr.city || pr.name, postcode: pr.postcode || "", context: pr.context || "" };
  } catch {}
  if (!val && Date.now() > NOMI_COOLDOWN) {   // 2) repli Nominatim (couvre les zones sans adresse)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=10&accept-language=fr`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
      if (res.status === 429) NOMI_COOLDOWN = Date.now() + 30 * 60 * 1000;
      else { const a = (await res.json()).address || {}; const c = a.city || a.town || a.village || a.municipality; if (c) val = { city: c, postcode: a.postcode || "", context: [a.county, a.state].filter(Boolean).join(", ") }; }
      await sleep(1100);  // politesse Nominatim (≤1 req/s)
    } catch {}
  }
  cache[key] = val;   // cache mémoire ; écrit sur disque par flushRev() (évite la course en parallèle)
  return val;
}

// ─── Estimations (durée corrigée du D+, calories, difficulté) ───────────────────
function estDuration(sport, dist, dp) { return Math.round((dist / (SPEED[sport] || 8)) * 60 + ((dp || 0) / 100) * (CLIMB[sport] || 8)); }
function fmtDur(min) { if (!min || min <= 0) return "—"; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`; }
function estKcal(sport, dist, dp) { return Math.round(dist * (KCAL[sport] || 60) + (dp || 0) * 0.9); }
function diffFromEffort(dist, dp, sport) {            // effort = km + D+/100 (pondéré sport montagne)
  const w = sport === "Trail" || sport === "Randonnée" || sport === "VTT" ? 1.3 : 1;
  const eff = dist + ((dp || 0) / 100) * w;
  return eff < 12 ? "Facile" : eff < 28 ? "Moyen" : "Difficile";
}

// ─── Vérif DONNÉES seules (instantané) ──────────────────────────────────────────
function verifyData(p) {
  const issues = [];
  if (/^\(projet\)/i.test(p.nom.trim())) issues.push("PROJET");
  if (!p.distance_km || p.distance_km <= 0) issues.push("SANS_DISTANCE");
  if (p.nom.trim().length < 4 || !/[A-Za-zÀ-ÿ]{3,}/.test(p.nom)) issues.push("NOM_DOUTEUX");
  if (!p.localisation?.departement || p.localisation.departement === "—") issues.push("SANS_DEPT");
  if (!deptAt(p.lng, p.lat)) issues.push("CENTRE_HORS_FR");
  return issues;
}

// ─── AUDIT COMPLET d'un parcours ────────────────────────────────────────────────
async function audit(p) {
  const issues = verifyData(p).filter((i) => i !== "CENTRE_HORS_FR"); // requalifié via altitude
  const r = { osm_id: p.osm_id, nom: p.nom, sport: p.sport, dept_stocke: p.localisation.departement, region_stocke: p.localisation.region, dist_tag: p.distance_km };
  const conf = {}; // confiance par mesure

  const { coords: coordsRaw, fromCache, error } = await getGeometry(p);
  r.fromCache = fromCache;
  if (error) { r.geom_pts = 0; issues.push("GEOM_INDISPO"); r.geom_error = error; r.issues = issues; r.verdict = "PROBLÈME"; return r; }
  if (coordsRaw.length < 2) { r.geom_pts = coordsRaw.length; issues.push("GEOM_VIDE"); r.issues = issues; r.verdict = "PROBLÈME"; return r; }

  // 0) RÉPARATION des petits trous : on route le long des vraies voies AVANT tout calcul,
  //    pour récupérer un max de parcours réels (cf. « malgré de nombreuses recherches »).
  let coords = coordsRaw;
  let nGaps = 0; for (let i = 1; i < coordsRaw.length; i++) if (haversine(coordsRaw[i - 1], coordsRaw[i]) > 0.3) nGaps++;
  if (nGaps > 0 && nGaps <= 12) {
    const rep = await repairTrace(coordsRaw, p.sport);
    if (rep.fixed > 0) {
      coords = rep.coords; r.repaired = true; r.gaps_fixed = rep.fixed; r.gaps_unfixable = rep.unfixable;
      try { fs.writeFileSync(path.join(CACHE_DIR, `relation_${p.osm_id}.json`), JSON.stringify(coords)); } catch {} // trace réparée = trace de référence
      try { fs.unlinkSync(path.join(ELEV_DIR, `${p.osm_id}.json`)); } catch {} // altitude à recalculer sur le tracé réparé
    }
  }
  r.geom_pts = coords.length;

  // 1) DISTANCE + continuité (sur le tracé réparé)
  let len = 0, gapKm = 0, jumps = 0, maxJump = 0;
  for (let i = 1; i < coords.length; i++) { const d = haversine(coords[i - 1], coords[i]); len += d; if (d > 0.3) { jumps++; gapKm += d; if (d > maxJump) maxJump = d; } }
  r.distance_km = Math.round(len * 100) / 100; r.gap_km = Math.round(gapKm * 100) / 100; r.jumps = jumps; r.max_jump_km = Math.round(maxJump * 100) / 100;
  conf.distance = gapKm < len * 0.02 ? "haute" : gapKm < len * 0.1 ? "moyenne" : "basse";
  if (jumps > 5) issues.push("FRAGMENTÉ"); else if (jumps > 0) issues.push("DISCONTINU");
  if (r.distance_km < 1) issues.push("TROP_COURT");   // < 1 km = bout d'accès/fragment, pas un parcours vendable
  if (p.distance_km > 0) {                            // recoupement avec la distance tagguée OSM
    const ec = Math.abs(len - p.distance_km) / p.distance_km;
    r.dist_ecart_tag_pct = Math.round(ec * 100);
    if (ec > 0.35) issues.push("DISTANCE_INCOHÉRENTE");
    else if (ec < 0.1) conf.distance = "haute (confirmée par le tag OSM)";
  }

  // 2) ALTITUDE (IGN + open-meteo) + COMMUNES départ/arrivée — TOUT EN PARALLÈLE (≈2× plus rapide)
  const N = Math.max(20, Math.min(300, Math.round(len / 0.12)));   // ~1 pt/120 m, cap 300
  const pts = sampleEvenly(coords, N);
  const sub = sampleEvenly(pts, Math.min(100, pts.length));        // sous-ensemble commun pour le recoupement
  const start = coords[0], end = coords[coords.length - 1];
  const loop = haversine(start, end) < 0.4;                        // boucle si départ ≈ arrivée
  let elevPack = {};
  const cf = path.join(ELEV_DIR, `${p.osm_id}.json`); fs.mkdirSync(ELEV_DIR, { recursive: true });
  if (fs.existsSync(cf)) { try { elevPack = JSON.parse(fs.readFileSync(cf, "utf-8")); } catch {} }
  const elevHadCache = !!elevPack.ign;
  const [ignR, omR, cStart, cEnd] = await Promise.all([
    elevPack.ign ? Promise.resolve(elevPack.ign) : ignZ(pts),
    elevPack.om ? Promise.resolve(elevPack.om) : omZ(sub),
    commune(start[0], start[1]),
    loop ? Promise.resolve(null) : commune(end[0], end[1]),
  ]);
  elevPack.ign = ignR; elevPack.om = omR;
  if (elevPack.ign || elevPack.om) fs.writeFileSync(cf, JSON.stringify(elevPack));
  r.elevFromCache = elevHadCache;

  const ign = elevPack.ign, om = elevPack.om;
  if (ign) {
    const D = dplus(ign); r.dplus = D.dp; r.dmoins = D.dm; r.alt_min = D.min; r.alt_max = D.max; r.elev_src = "IGN RGE ALTI";
    // recoupement open-meteo sur le sous-ensemble commun
    if (om) {
      const ignSub = sampleEvenly(ign, Math.min(100, ign.length));
      const dIgn = dplus(ignSub).dp, dOm = dplus(om).dp;
      r.dplus_om = dOm;
      const diff = (dIgn != null && dOm != null) ? Math.abs(dIgn - dOm) : null;
      if (diff != null) {
        r.dplus_ecart = (dIgn ? Math.round(diff / Math.max(dIgn, 1) * 100) : 0);
        // IGN RGE ALTI (1-5 m) = référence officielle retenue. open-meteo (90 m) = contrôle indicatif.
        if (diff < 40 || r.dplus_ecart < 25) conf.denivele = "haute (IGN officiel + open-meteo concordent)";
        else { conf.denivele = `moyenne (IGN officiel retenu ; open-meteo indicatif diverge de ${r.dplus_ecart}%)`; issues.push("DÉNIVELÉ_À_CONFIRMER"); }
      }
    } else conf.denivele = "moyenne (IGN seul, open-meteo indispo)";
  } else if (om) { const D = dplus(om); r.dplus = D.dp; r.dmoins = D.dm; r.alt_min = D.min; r.alt_max = D.max; r.elev_src = "open-meteo (IGN indispo)"; conf.denivele = "moyenne (1 source)"; }
  else { issues.push("ALTITUDE_INDISPO"); conf.denivele = "—"; }

  // 2b) PROFIL ALTIMÉTRIQUE (graphe), PENTE MAX %, PLUS GROSSE MONTÉE — depuis l'altitude déjà récupérée
  const zArr = ign || om, zPtsE = ign ? pts : sub;
  if (zArr && zArr.length === zPtsE.length) {
    let cum = 0, climb = 0, climbMax = 0;
    const prof = [];
    for (let i = 0; i < zPtsE.length; i++) {
      if (i > 0) cum += haversine(zPtsE[i - 1], zPtsE[i]);
      if (i > 0 && zArr[i] != null && zArr[i - 1] != null) {
        const dz = zArr[i] - zArr[i - 1];
        if (dz > 0) climb += dz; else { if (climb > climbMax) climbMax = climb; climb = 0; }
      }
      if (zArr[i] != null) prof.push([Math.round(cum * 100) / 100, Math.round(zArr[i])]);
    }
    if (climb > climbMax) climbMax = climb;
    // PENTE MAX robuste : gradient sur fenêtre glissante ≥ 200 m → lisse les pics de bruit DEM
    let maxGrad = 0;
    for (let i = 0; i < prof.length; i++) for (let j = i + 1; j < prof.length; j++) {
      const ddm = (prof[j][0] - prof[i][0]) * 1000;
      if (ddm >= 200) { const g = Math.abs(prof[j][1] - prof[i][1]) / ddm * 100; if (g > maxGrad && g < 45) maxGrad = g; break; }
    }
    r.pente_max_pct = Math.round(maxGrad); r.montee_max_m = Math.round(climbMax);
    const stp = Math.max(1, Math.floor(prof.length / 60));            // profil compact ~60 pts pour le produit
    r.profil = prof.filter((_, i) => i % stp === 0 || i === prof.length - 1);
  }

  // 3) EAU/MER (altitude ≤ 0) + 4) PAYS & DÉPARTEMENTS traversés
  const z = ign || om || [];
  const zPts = ign ? pts : sub;
  let seaPts = 0;
  const deptsSet = new Set(), countriesSet = new Set();
  for (let i = 0; i < zPts.length; i++) {
    const [lng, lat] = zPts[i];
    if (z[i] != null && z[i] <= 0) seaPts++;
    const d = deptAt(lng, lat);
    if (d) { deptsSet.add(d); countriesSet.add("France"); } else countriesSet.add(countryAt(lng, lat));
  }
  r.sea_pts = seaPts; r.n_alt = zPts.length;
  r.departements = [...deptsSet]; r.pays = [...countriesSet].filter((c) => c !== "?");
  if (r.pays.length > 1) r.transfrontalier = true;
  if (seaPts >= Math.max(2, zPts.length * 0.15)) issues.push("TRACÉ_EN_MER");
  else if (seaPts > 0) issues.push("TRACÉ_FRÔLE_MER");

  // 5) Boucle + 6) communes départ/arrivée (déjà récupérées en parallèle ci-dessus)
  r.type = loop ? "Boucle" : "Aller simple";
  r.depart = cStart?.city || null; r.arrivee = (loop ? cStart : cEnd)?.city || null;
  r.bbox = coords.reduce((b, c) => [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])], [180, 90, -180, -90]);

  // 7) recentrage vignette si centre hors-chemin/eau
  if (!deptAt(p.lng, p.lat) && !r.transfrontalier) { const mid = coords[Math.floor(coords.length / 2)]; r.fix_center = [Math.round(mid[1] * 1e6) / 1e6, Math.round(mid[0] * 1e6) / 1e6]; }

  // 8) Recalculs prêts-à-vendre
  r.difficulte = diffFromEffort(r.distance_km, r.dplus, p.sport);
  r.duree_min = estDuration(p.sport, r.distance_km, r.dplus); r.duree = fmtDur(r.duree_min);
  r.calories = estKcal(p.sport, r.distance_km, r.dplus);

  r.confiance = conf; r.issues = issues;
  // GRAVE = bloquant pour la vente. DÉNIVELÉ_À_CONFIRMER n'est PAS bloquant (IGN officiel retenu).
  const GRAVE = ["TRACÉ_EN_MER", "GEOM_VIDE", "GEOM_INDISPO", "FRAGMENTÉ", "ALTITUDE_INDISPO"];
  r.verdict = issues.length === 0 ? "OK" : (issues.some((i) => GRAVE.includes(i)) ? "PROBLÈME" : "MINEUR");
  return r;
}

// ─── Reprise & bilans ───────────────────────────────────────────────────────────
function doneIds() {
  if (!fs.existsSync(RESULTS)) return new Set();
  const s = new Set();
  for (const l of fs.readFileSync(RESULTS, "utf-8").split("\n")) if (l.trim()) try { s.add(JSON.parse(l).osm_id); } catch {}
  return s;
}
function printStats() {
  if (!fs.existsSync(RESULTS)) return console.log("Aucun résultat.");
  const rows = fs.readFileSync(RESULTS, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const byV = {}, byI = {};
  for (const r of rows) { byV[r.verdict] = (byV[r.verdict] || 0) + 1; for (const i of r.issues || []) byI[i] = (byI[i] || 0) + 1; }
  console.log(`\n══ BILAN ${rows.length} parcours / 22186 (${(rows.length / 22186 * 100).toFixed(1)}%) ══`);
  console.log("  Verdicts :", byV);
  console.log("  Problèmes :", Object.fromEntries(Object.entries(byI).sort((a, b) => b[1] - a[1])));
}
function dataScan() {
  const all = JSON.parse(fs.readFileSync(DATASET, "utf-8"));
  const byI = {}, ex = {}; let clean = 0;
  for (const p of all) { const is = verifyData(p); if (!is.length) clean++; for (const i of is) { byI[i] = (byI[i] || 0) + 1; (ex[i] ??= []).length < 3 && ex[i].push(p.nom.slice(0, 38)); } }
  fs.writeFileSync(DATA_REPORT, JSON.stringify({ total: all.length, clean, byI, ex, at: new Date().toISOString() }, null, 2));
  console.log(`\n══ SCAN DONNÉES — ${all.length} parcours ══\n  Propres : ${clean} (${(clean / all.length * 100).toFixed(1)}%)`);
  for (const [k, v] of Object.entries(byI).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(16)} ${String(v).padStart(6)} (${(v / all.length * 100).toFixed(1)}%)`);
}

// ─── Certification stricte : « sûr et certain » → vendable ──────────────────────
function isCertified(r) {
  if (r.verdict === "PROBLÈME") return false;
  const KO = ["PROJET", "NOM_DOUTEUX", "TROP_COURT", "FRAGMENTÉ", "DISCONTINU", "TRACÉ_EN_MER", "TRACÉ_FRÔLE_MER", "GEOM_VIDE", "GEOM_INDISPO", "ALTITUDE_INDISPO"];
  if ((r.issues || []).some((i) => KO.includes(i))) return false;
  if (r.dplus == null) return false;            // dénivelé connu (IGN)
  if ((r.jumps || 0) > 0) return false;         // tracé 100 % continu
  if ((r.sea_pts || 0) > 0) return false;       // aucun point sous l'eau
  if (!r.distance_km || r.distance_km <= 0) return false;
  return true;
}
// Produit data/parcours_certifies.json — uniquement les parcours sûrs, valeurs corrigées.
function buildCertified() {
  if (!fs.existsSync(RESULTS)) return console.log("Aucun résultat.");
  const byId = new Map();
  for (const l of fs.readFileSync(RESULTS, "utf-8").split("\n")) if (l.trim()) { const r = JSON.parse(l); byId.set(r.osm_id, r); }
  const out = [];
  for (const r of byId.values()) {
    if (!isCertified(r)) continue;
    let coords = []; const f = path.join(CACHE_DIR, `relation_${r.osm_id}.json`);
    if (fs.existsSync(f)) { try { coords = JSON.parse(fs.readFileSync(f, "utf-8")); } catch {} }
    if (coords.length < 2) continue;
    const mid = coords[Math.floor(coords.length / 2)];
    out.push({
      osm_id: r.osm_id, osm_type: "relation", nom: r.nom, sport: r.sport,
      distance_km: r.distance_km, denivele_positif_m: r.dplus, denivele_negatif_m: r.dmoins,
      altitude_min_m: r.alt_min, altitude_max_m: r.alt_max,
      type_parcours: r.type, difficulte: r.difficulte, temps_estime: r.duree, duree_min: r.duree_min, calories_kcal: r.calories,
      pente_max_pct: r.pente_max_pct, montee_max_m: r.montee_max_m, profil: r.profil,
      depart: r.depart, arrivee: r.arrivee, departements: r.departements, region: r.region_stocke, pays: r.pays,
      lat: Math.round(mid[1] * 1e6) / 1e6, lng: Math.round(mid[0] * 1e6) / 1e6,
      confiance_distance: r.confiance?.distance, confiance_denivele: r.confiance?.denivele,
      source: "OpenStreetMap (ODbL) · dénivelé IGN RGE ALTI",
    });
  }
  fs.writeFileSync("data/parcours_certifies.json", JSON.stringify(out));
  const audited = byId.size;
  console.log(`✅ CERTIFIÉS : ${out.length} / ${audited} audités (${(out.length / Math.max(audited, 1) * 100).toFixed(0)}%) sûrs & vendables → data/parcours_certifies.json`);
  return out.length;
}

// ─── Page de revue HTML enrichie ────────────────────────────────────────────────
function buildReport() {
  if (!fs.existsSync(RESULTS)) return console.log("Aucun résultat.");
  const byId = new Map();
  for (const l of fs.readFileSync(RESULTS, "utf-8").split("\n")) if (l.trim()) { const r = JSON.parse(l); byId.set(r.osm_id, r); }
  const allRows = [...byId.values()];
  // Compteurs GLOBAUX (sur tout l'audité), exacts.
  const counts = { OK: 0, MINEUR: 0, "PROBLÈME": 0, certified: 0, total: allRows.length };
  for (const r of allRows) { counts[r.verdict] = (counts[r.verdict] || 0) + 1; if (isCertified(r)) counts.certified++; }
  // On n'EMBARQUE les tracés que pour les 500 derniers audités (sinon page géante à 22k).
  const CAP = 500;
  const shown = allRows.slice(-CAP);
  const items = shown.map((r) => {
    let coords = []; const f = path.join(CACHE_DIR, `relation_${r.osm_id}.json`);
    if (fs.existsSync(f)) { try { coords = JSON.parse(fs.readFileSync(f, "utf-8")); } catch {} }
    return { ...r, coordinates: coords, certified: isCertified(r) };
  });
  const html = REPORT_HTML(items, counts, allRows.length > CAP);
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/verification-parcours.html", html);
  console.log(`✅ Page de revue : public/verification-parcours.html (${items.length} parcours)\n   → http://localhost:3000/verification-parcours.html`);
  buildCertified();
}
function REPORT_HTML(items, counts, capped) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Parcours vérifiés — audit qualité</title><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;color:#18181b}
header{padding:14px 20px;background:#fff;border-bottom:1px solid #e4e4e7;position:sticky;top:0;z-index:20}
h1{margin:0;font-size:18px}.sub{color:#71717a;font-size:13px;margin-top:3px}
.badges{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.b{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700}
.b.ok{background:#dcfce7;color:#15803d}.b.min{background:#fef9c3;color:#a16207}.b.pb{background:#fee2e2;color:#b91c1c}.b.cert{background:#16a34a;color:#fff}
.filter{margin-top:8px;font-size:13px;color:#3f3f46}.filter input{vertical-align:middle}
.wrap{display:flex;height:calc(100vh - 92px)}#map{flex:1;height:100%}
.list{width:460px;max-width:50vw;overflow-y:auto;background:#fff;border-left:1px solid #e4e4e7}
.card{padding:12px 16px;border-bottom:1px solid #f1f1f3;cursor:pointer}.card:hover{background:#fafafa}.card.active{background:#eff6ff;border-left:3px solid #2563eb;padding-left:13px}
.card h3{margin:0 0 4px;font-size:14px;display:flex;gap:6px}.dot{width:9px;height:9px;border-radius:50%;flex:none;margin-top:4px}.dot.ok{background:#22c55e}.dot.min{background:#eab308}.dot.pb{background:#ef4444}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:12px;color:#3f3f46;margin-top:4px}.grid b{color:#18181b}
.tags{margin-top:6px;display:flex;gap:5px;flex-wrap:wrap}.tag{font-size:10.5px;padding:1px 7px;border-radius:6px;background:#f4f4f5;color:#71717a;font-weight:600}
.tag.sea{background:#dbeafe;color:#1d4ed8}.tag.world{background:#f0fdf4;color:#15803d}.tag.warn{background:#fef3c7;color:#92400e}.tag.ok{background:#dcfce7;color:#15803d}
.conf{font-size:11px;color:#16a34a}.conf.bad{color:#dc2626}</style></head><body>
<header><h1>🔎 Audit qualité des parcours — multi-sources</h1>
<div class="sub"><b>${counts.total}</b> parcours audités / 22 186 · dénivelé <b>IGN RGE ALTI</b> recoupé <b>open-meteo</b> · distance sur tracé OSM · communes/pays officiels${capped ? ` · <i>(carte = les ${items.length} derniers audités)</i>` : ""} · clique une fiche → tracé réel</div>
<div class="badges"><span class="b cert">🏅 ${counts.certified} CERTIFIÉS (sûrs & vendables)</span><span class="b ok">✅ ${counts.OK} OK</span><span class="b min">⚠️ ${counts.MINEUR} mineurs</span><span class="b pb">❌ ${counts["PROBLÈME"]} à corriger</span></div>
<div class="filter"><label><input type="checkbox" id="onlyCert"> N'afficher que les <b>certifiés</b> (ceux qu'on garde pour la vente)</label></div></header>
<div class="wrap"><div id="map"></div><div class="list" id="list"></div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const DATA=${JSON.stringify(items)};
const map=L.map('map').setView([46.6,2.4],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
let layer=null;const cls=v=>v==='OK'?'ok':v==='MINEUR'?'min':'pb';
function show(it,el){document.querySelectorAll('.card').forEach(c=>c.classList.remove('active'));if(el)el.classList.add('active');
 if(layer)map.removeLayer(layer);if(!it.coordinates||it.coordinates.length<2)return;
 const ll=it.coordinates.map(c=>[c[1],c[0]]);
 const casing=L.polyline(ll,{color:'#fff',weight:7,opacity:.9});
 const core=L.polyline(ll,{color:it.verdict==='PROBLÈME'?'#ef4444':it.verdict==='MINEUR'?'#f59e0b':'#16a34a',weight:4});
 L.circleMarker(ll[0],{radius:6,color:'#16a34a',fillColor:'#16a34a',fillOpacity:1}).addTo(map);
 layer=L.layerGroup([casing,core]).addTo(map);map.fitBounds(core.getBounds(),{padding:[40,40]});}
const list=document.getElementById('list');
DATA.forEach((it,i)=>{const c=document.createElement('div');c.className='card';c.dataset.cert=it.certified?'1':'0';
 const tags=[];(it.issues||[]).forEach(x=>{const k=/MER/.test(x)?'sea':/FRAGMENT|GEOM|DIVERG|INDISPO/.test(x)?'warn':'';tags.push('<span class="tag '+k+'">'+x+'</span>');});
 if(it.transfrontalier)tags.push('<span class="tag world">🌍 '+(it.pays||[]).join('-')+'</span>');
 if(!(it.issues||[]).length)tags.push('<span class="tag ok">✓ vérifié</span>');
 if(it.certified)tags.unshift('<span class="tag cert">🏅 CERTIFIÉ</span>');
 const conf=it.confiance||{};
 c.innerHTML='<h3><span class="dot '+cls(it.verdict)+'"></span><span>'+(i+1)+'. '+it.nom+'</span></h3>'+
  '<div class="grid">'+
   '<div>📏 <b>'+(it.distance_km??'—')+' km</b> <span class="'+(conf.distance==='basse'?'conf bad':'conf')+'">('+(conf.distance||'?')+')</span></div>'+
   '<div>⛰️ <b>D+ '+(it.dplus??'—')+' m</b> '+(it.dplus_om!=null?'<span class="'+((conf.denivele||'').startsWith('haute')?'conf':'conf bad')+'">(om '+it.dplus_om+')</span>':'')+'</div>'+
   '<div>🏔️ alt '+(it.alt_min??'—')+'→'+(it.alt_max??'—')+' m</div>'+
   '<div>⏱️ '+(it.duree||'—')+' · 🔥 '+(it.calories??'—')+'</div>'+
   '<div>🧭 '+(it.type||'?')+' · '+(it.sport||'')+'</div>'+
   '<div>🎯 '+(it.difficulte||'?')+'</div>'+
   '<div style="grid-column:1/3">📍 '+(it.depart||'?')+(it.type==='Boucle'?' (boucle)':' → '+(it.arrivee||'?'))+'</div>'+
   '<div style="grid-column:1/3">🗺️ '+((it.departements||[]).slice(0,4).join(', ')||it.dept_stocke)+'</div>'+
   (it.sea_pts?'<div style="grid-column:1/3;color:#1d4ed8">🌊 '+it.sea_pts+'/'+it.n_alt+' points sous le niveau mer</div>':'')+
  '</div><div class="tags">'+tags.join('')+'</div>';
 c.onclick=()=>show(it,c);list.appendChild(c);});
document.getElementById('onlyCert').onchange=e=>{document.querySelectorAll('.card').forEach(c=>{c.style.display=(e.target.checked&&c.dataset.cert!=='1')?'none':'';});};
if(DATA.length)show(DATA[0],list.firstChild);
</script></body></html>`;
}

// ─── Main ───────────────────────────────────────────────────────────────────────
// ── Auto-réparation des contours géo : /tmp est volatile (vidé au reboot du Mac).
//    On (re)télécharge départements/pays s'ils manquent → le crawl survit à un redémarrage.
const GEO_SOURCES = [
  { file: DEPTS_FILE, url: "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson", country: false },
  { file: COUNTRIES_FILE, url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson", country: true },
];
async function ensureGeo() {
  for (const { file, url, country } of GEO_SOURCES) {
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    console.log(`⤓ ${path.basename(file)} manquant → téléchargement…`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const gj = await res.json();
    // Le worker lit les pays via la clé "name" ; Natural Earth la stocke en majuscules.
    if (country) for (const f of gj.features || []) { const p = f.properties || {}; p.name = p.name || p.NAME || p.ADMIN || p.SOVEREIGNT || p.NAME_LONG; }
    fs.writeFileSync(file, JSON.stringify(gj));
    console.log(`  ✅ ${path.basename(file)} — ${(gj.features || []).length} features`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (args.includes("--stats")) return printStats();
  if (args.includes("--data-scan")) return dataScan();
  if (args.includes("--certify")) return buildCertified();
  if (args.includes("--report")) return buildReport();

  const all = JSON.parse(fs.readFileSync(DATASET, "utf-8"));
  const compact = args.includes("--compact");
  const ICON = { OK: "✅", MINEUR: "⚠️ ", "PROBLÈME": "❌" };

  await ensureGeo();   // garantit /tmp/departements.geojson + ne_countries.geojson (survie au reboot)

  async function processFrom(from, count) {
    const batch = all.slice(from, from + count);
    console.log(`\n🔎 AUDIT parcours ${from + 1} → ${from + batch.length} / ${all.length}\n`);
    for (let k = 0; k < batch.length; k++) {
      const p = batch[k]; const r = await audit(p);
      fs.appendFileSync(RESULTS, JSON.stringify(r) + "\n");
      if (compact) console.log(`${ICON[r.verdict]} ${String(from + k + 1).padStart(5)}. ${p.nom.slice(0, 40).padEnd(40)} | ${r.distance_km ?? "—"}km D+${r.dplus ?? "?"} ${r.issues.length ? "[" + r.issues.join(",") + "]" : ""}`);
      else printAudit(from + k + 1, p, r);
      if (r.geom_pts > 1 && !r.elevFromCache) await sleep(1000);
    }
  }
  const nextFrom = () => { const done = doneIds(); let i = 0; while (i < all.length && done.has(all[i].osm_id)) i++; return i; };

  // 2e passe : re-tente les parcours tombés (GEOM/ALTITUDE indispo) — victimes de coupures/limites.
  async function retryFailed() {
    if (!fs.existsSync(RESULTS)) return;
    const rows = fs.readFileSync(RESULTS, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const byOsm = new Map(all.map((p) => [p.osm_id, p]));
    const targets = rows.map((r, i) => ({ r, i })).filter((x) => (x.r.issues || []).some((s) => s === "GEOM_INDISPO" || s === "ALTITUDE_INDISPO"));
    if (!targets.length) return;
    console.log(`\n🔁 2e passe : re-tentative de ${targets.length} parcours échoués…`);
    let fixed = 0;
    for (const { r, i } of targets) {
      const p = byOsm.get(r.osm_id); if (!p) continue;
      const nr = await audit(p);
      if (!nr.issues.includes("GEOM_INDISPO") && !nr.issues.includes("ALTITUDE_INDISPO")) { rows[i] = nr; fixed++; }
      if (nr.geom_pts > 1 && !nr.elevFromCache) await sleep(700);
    }
    fs.writeFileSync(RESULTS, rows.map((x) => JSON.stringify(x)).join("\n") + "\n");
    flushRev();
    console.log(`   → ${fixed}/${targets.length} récupérés.`);
  }

  if (args.includes("--retry-failed")) { await retryFailed(); buildReport(); return; }

  if (args.includes("--loop")) {
    const size = Number(args[args.indexOf("--loop") + 1]) || 60;
    const PAUSE_AFTER = 8, PAUSE_MS = 10 * 60 * 1000, MAX_PAUSES = 3; // seuils coupure réseau
    let from = nextFrom(), consecFail = 0, pauseRetries = 0, sinceReport = 0;
    console.log(`\n🔁 LOOP — reprise au parcours ${from + 1} / ${all.length} (lots de ${size}, reprise auto sur coupure)\n`);
    while (from < all.length) {
      const p = all[from];
      const r = await audit(p);
      const transient = r.issues.includes("GEOM_INDISPO");
      // Coupure/limite probable : beaucoup d'échecs d'affilée → on ATTEND et on REPREND le même parcours.
      if (transient && consecFail >= PAUSE_AFTER && pauseRetries < MAX_PAUSES) {
        console.log(`⏸️  ${new Date().toLocaleString("fr-FR")} — ${consecFail} échecs réseau d'affilée (limite/coupure probable). Pause ${PAUSE_MS / 60000} min, reprise automatique…`);
        flushRev(); await sleep(PAUSE_MS); pauseRetries++;
        continue; // ne pas avancer ni enregistrer : on re-tente le même parcours
      }
      pauseRetries = 0;
      fs.appendFileSync(RESULTS, JSON.stringify(r) + "\n");
      consecFail = transient ? consecFail + 1 : 0;
      if (compact) console.log(`${ICON[r.verdict]} ${String(from + 1).padStart(5)}. ${p.nom.slice(0, 40).padEnd(40)} | ${r.distance_km ?? "—"}km D+${r.dplus ?? "?"} ${r.issues.length ? "[" + r.issues.join(",") + "]" : ""}`);
      from++; sinceReport++;
      if (r.geom_pts > 1 && !r.elevFromCache) await sleep(700);
      else if (!r.fromCache) await sleep(300); // courtoisie Overpass sur les longues séries de parcours sans tracé
      if (sinceReport >= size) { flushRev(); buildReport(); sinceReport = 0; }
    }
    flushRev(); buildReport();
    await retryFailed(); buildReport();
    try { fs.writeFileSync("data/CRAWL_DONE", new Date().toISOString()); } catch {} // signal de fin pour le démon
    console.log("\n🎉 AUDIT COMPLET — tous les parcours traités.");
  } else {
    let from, count;
    if (args.includes("--from")) { from = Number(args[args.indexOf("--from") + 1]) || 0; count = Number(args[args.indexOf("--count") + 1]) || 10; }
    else { count = Number(args[0]) || 10; from = nextFrom(); }
    await processFrom(from, count);
    flushRev();
  }
  printStats();
})();

function printAudit(n, p, r) {
  const ICON = { OK: "✅", MINEUR: "⚠️ ", "PROBLÈME": "❌" };
  console.log(`${ICON[r.verdict]} #${n} — ${p.nom}`);
  if (r.geom_pts < 2 || r.geom_error) { console.log(`     Tracé indisponible (${r.geom_error || "vide"}) → à exclure\n`); return; }
  console.log(`     Sport ${p.sport} · ${r.type} · ${(r.departements || []).join(", ") || r.dept_stocke}${r.transfrontalier ? ` · 🌍 ${r.pays.join("-")}` : ""}`);
  console.log(`     Trajet     : ${r.depart || "?"}${r.type === "Boucle" ? " (boucle)" : " → " + (r.arrivee || "?")}`);
  console.log(`     Distance   : ${r.distance_km} km  (confiance ${r.confiance?.distance})${r.gap_km ? ` · trous ${r.gap_km} km` : ""}`);
  console.log(`     Dénivelé   : D+ ${r.dplus ?? "?"} m · D- ${r.dmoins ?? "?"} m · alt ${r.alt_min ?? "?"}→${r.alt_max ?? "?"} m  [${r.elev_src}]${r.dplus_om != null ? ` · recoupé open-meteo ${r.dplus_om} m (écart ${r.dplus_ecart}%)` : ""}`);
  console.log(`     Confiance  : dénivelé = ${r.confiance?.denivele || "—"}`);
  console.log(`     Tracé      : ${r.geom_pts} pts · ${r.jumps === 0 ? "continu ✓" : r.jumps + " saut(s) max " + r.max_jump_km + " km"}${r.sea_pts ? ` · 🌊 ${r.sea_pts}/${r.n_alt} pts en mer` : ""}`);
  console.log(`     Relief     : pente max ${r.pente_max_pct ?? "?"}% · plus grosse montée ${r.montee_max_m ?? "?"} m · profil ${r.profil ? r.profil.length + " pts" : "—"}`);
  console.log(`     À vendre   : ${r.difficulte} · ${r.duree} · ${r.calories} kcal`);
  if (r.fix_center) console.log(`     Vignette   : recentrer sur (${r.fix_center[0]}, ${r.fix_center[1]})`);
  console.log(`     Verdict    : ${ICON[r.verdict]} ${r.verdict}${r.issues.length ? "  [" + r.issues.join(", ") + "]" : ""}\n`);
}
