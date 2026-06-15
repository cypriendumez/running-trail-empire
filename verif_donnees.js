// Vérification INDÉPENDANTE des données : tracé, localisation, dénivelé.
// Sources croisées : Overpass (géométrie), Nominatim (reverse-geocode), open-meteo (altitude).
const fs = require("fs");
const D = JSON.parse(fs.readFileSync("data/dataset_france.json", "utf-8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversine(a, b) { // [lng,lat]
  const R = 6371, dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function lengthKm(c) { let d = 0; for (let i = 1; i < c.length; i++) d += haversine(c[i - 1], c[i]); return d; }

async function geometry(id) {
  const q = `[out:json][timeout:60];relation(${id});out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RTE-verif/1.0" },
    body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(60000),
  });
  const j = await res.json();
  const coords = [];
  for (const el of j.elements || []) if (el.type === "relation") for (const m of el.members || []) if (m.type === "way" && m.geometry) for (const g of m.geometry) coords.push([g.lon, g.lat]);
  return coords;
}
async function reverse(lat, lng) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=8&accept-language=fr`, { headers: { "User-Agent": "RTE-verif/1.0 (verification)" }, signal: AbortSignal.timeout(20000) });
  const j = await res.json();
  const a = j.address || {};
  return { dept: a.county || a.state_district || "?", region: a.state || a["ISO3166-2-lvl4"] || "?", display: (j.display_name || "").split(",").slice(0, 3).join(", ") };
}
async function elevation(coords) {
  const step = Math.max(1, Math.floor(coords.length / 60));
  const s = coords.filter((_, i) => i % step === 0).slice(0, 80);
  const lats = s.map((c) => c[1].toFixed(5)).join(","), lngs = s.map((c) => c[0].toFixed(5)).join(",");
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`, { signal: AbortSignal.timeout(20000) });
  const j = await res.json();
  const e = j.elevation || [];
  let gain = 0, loss = 0;
  for (let i = 1; i < e.length; i++) { const d = e[i] - e[i - 1]; if (d > 0) gain += d; else loss -= d; }
  return { gain: Math.round(gain), loss: Math.round(loss), min: Math.round(Math.min(...e)), max: Math.round(Math.max(...e)), n: e.length };
}

(async () => {
  // 3 échantillons variés AVEC distance annoncée (pour comparer le tracé)
  const wanted = ["Provence-Alpes-Côte d'Azur", "Bretagne", "Grand Est"];
  const samples = wanted.map((reg) => D.find((p) => p.localisation.region === reg && p.distance_km > 5 && p.distance_km < 60)).filter(Boolean);

  for (const p of samples) {
    console.log("\n══════════════════════════════════════════════════════");
    console.log(`📍 ${p.nom}`);
    console.log(`   App dit : ${p.sport} · ${p.distance_km} km · ${p.localisation.departement} (${p.localisation.region}) · D+ stocké = ${p.denivele_positif_m} m`);
    console.log(`   OSM id : relation/${p.osm_id}  →  https://www.openstreetmap.org/relation/${p.osm_id}`);
    try {
      const coords = await geometry(p.osm_id);
      const len = lengthKm(coords);
      console.log(`   ✅ TRACÉ : ${coords.length} points GPS réels · longueur calculée = ${len.toFixed(1)} km (annoncé ${p.distance_km} km → écart ${Math.abs(len - p.distance_km).toFixed(1)} km)`);
      await sleep(1200);
      const rev = await reverse(p.lat, p.lng);
      const okDept = (rev.dept || "").toLowerCase().includes((p.localisation.departement || "").toLowerCase()) || (p.localisation.departement || "").toLowerCase().includes((rev.dept || "").toLowerCase());
      console.log(`   ${okDept ? "✅" : "⚠️ "} LOCALISATION : Nominatim dit « ${rev.dept} / ${rev.region} » (${rev.display})`);
      await sleep(1200);
      const el = await elevation(coords);
      console.log(`   ✅ DÉNIVELÉ RÉEL (open-meteo, ${el.n} pts) : D+ ${el.gain} m · D− ${el.loss} m · alt ${el.min}→${el.max} m`);
      await sleep(1200);
    } catch (e) {
      console.log("   ⚠️ erreur de vérif :", e.message);
    }
  }
  console.log("\n══════════════════════════════════════════════════════");
})();
