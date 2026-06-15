const fs = require("fs");
const D = JSON.parse(fs.readFileSync("data/dataset_france.json", "utf-8"));
function hav(a, b) { const R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180, dLng = (b[0] - a[0]) * Math.PI / 180; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)); }
async function ov(q) {
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RTE-diag/1.0" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(60000) });
      const t = await r.text();
      if (t.trim().startsWith("{")) return JSON.parse(t).elements || [];
    } catch { /* mirror suivant */ }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return [];
}
function wayStats(els) {
  let pts = 0, L = 0, ways = 0;
  for (const el of els) if (el.type === "way" && el.geometry) { ways++; const c = el.geometry.map(g => [g.lon, g.lat]); pts += c.length; for (let i = 1; i < c.length; i++) L += hav(c[i - 1], c[i]); }
  const memberTypes = {};
  for (const el of els) if (el.type === "relation") for (const m of (el.members || [])) memberTypes[m.type] = (memberTypes[m.type] || 0) + 1;
  return { ways, pts, L: L.toFixed(1), memberTypes };
}
(async () => {
  const targets = D.filter(p => /Gazon vert|Etampes à Angerville|Etampes a Angerville/.test(p.nom)).slice(0, 2);
  for (const p of targets) {
    console.log(`\n📍 ${p.nom} (relation/${p.osm_id}, tag ${p.distance_km} km)`);
    const a = await ov(`[out:json][timeout:60];relation(${p.osm_id});out geom;`);
    console.log("  SANS >> :", JSON.stringify(wayStats(a)));
    await new Promise(r => setTimeout(r, 1500));
    const b = await ov(`[out:json][timeout:60];relation(${p.osm_id});>>;out geom;`);
    console.log("  AVEC >> :", JSON.stringify(wayStats(b)));
    await new Promise(r => setTimeout(r, 1500));
  }
})();
