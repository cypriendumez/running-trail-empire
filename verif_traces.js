// Vérification statistique de la QUALITÉ des tracés sur un large échantillon.
// Pour chaque parcours : longueur réelle (via endpoint app) vs distance annoncée,
// + nombre de discontinuités. Classe en "propre" / "tag douteux" / "fragmenté".
const fs = require("fs");
const D = JSON.parse(fs.readFileSync("data/dataset_france.json", "utf-8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function hav(a, b) { const R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180, dLng = (b[0] - a[0]) * Math.PI / 180; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)); }

// Échantillon : 3 par sport, avec distance annoncée (pour comparer), variés.
const SPORTS = ["Running", "Trail", "Randonnée", "Vélo (Route)", "VTT"];
const sample = [];
for (const sp of SPORTS) {
  const pool = D.filter((p) => p.sport === sp && p.distance_km >= 5 && p.distance_km <= 60);
  for (let k = 0; k < 3 && pool.length; k++) sample.push(pool[Math.floor((k + 0.5) / 3 * pool.length)]);
}

(async () => {
  let clean = 0, tagBad = 0, frag = 0, err = 0;
  console.log(`Vérification de ${sample.length} tracés (3 par sport)…\n`);
  for (const p of sample) {
    try {
      const r = await fetch(`http://localhost:3000/api/parcours/geometry?id=${p.osm_id}&type=relation`);
      const j = await r.json();
      if (!Array.isArray(j.coordinates) || j.coordinates.length < 2) { console.log(`  ?? ${p.nom.slice(0,40)} : pas de géométrie`); err++; await sleep(2000); continue; }
      const c = j.coordinates;
      let L = 0, jumps = 0;
      for (let i = 1; i < c.length; i++) { const d = hav(c[i - 1], c[i]); L += d; if (d > 0.3) jumps++; }
      const ecart = p.distance_km ? Math.abs(L - p.distance_km) / p.distance_km : 0;
      let verdict;
      if (jumps > 4) { verdict = "FRAGMENTÉ"; frag++; }
      else if (ecart > 0.30) { verdict = "tag douteux"; tagBad++; }
      else { verdict = "PROPRE ✓"; clean++; }
      console.log(`  ${verdict.padEnd(12)} ${p.sport.slice(0,4).padEnd(4)} | ${L.toFixed(1)}km (tag ${p.distance_km}) | ${jumps} sauts | ${p.nom.slice(0,38)}`);
    } catch (e) { console.log(`  ?? ${p.nom.slice(0,40)} : ${e.message}`); err++; }
    await sleep(2500);
  }
  const n = sample.length;
  console.log(`\n── BILAN (${n} tracés) ──`);
  console.log(`  PROPRES (longueur ≈ tag, continus) : ${clean}/${n} (${Math.round(clean/n*100)}%)`);
  console.log(`  Tag distance douteux (tracé OK)    : ${tagBad}/${n}`);
  console.log(`  Fragmentés (trous OSM réels)       : ${frag}/${n}`);
  console.log(`  Erreurs réseau                     : ${err}/${n}`);
})();
