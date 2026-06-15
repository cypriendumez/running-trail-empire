// Vérification UN PAR UN des N premiers parcours (tracé + longueur + sauts + localisation).
const N = Number(process.argv[2] || 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function havKm(a, b) { const R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180, dLng = (b[0] - a[0]) * Math.PI / 180; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)); }
async function getJson(url, opts) { const r = await fetch(url, opts); return r.json(); }
async function reverse(lat, lng) {
  try { const j = await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=8&accept-language=fr`, { headers: { "User-Agent": "RTE-verif/1.0" } }); const a = j.address || {}; return a.county || a.state_district || a.state || "?"; } catch { return "?"; }
}
(async () => {
  const list = await getJson(`http://localhost:3000/api/parcours?pageSize=${N}`);
  let ok = 0, frag = 0, incomplete = 0, tagBad = 0, locBad = 0;
  console.log(`Vérification UN PAR UN des ${list.items.length} premiers parcours (sur ${list.total}) :`);
  let i = 0;
  for (const p of list.items) {
    i++;
    console.log(`\n──────── #${i} : ${p.nom}`);
    console.log(`   App : ${p.sport} · ${p.distance_km || "?"} km · ${p.localisation.departement} (${p.localisation.region}) · OSM relation/${p.osm_id}`);
    try {
      const g = await getJson(`http://localhost:3000/api/parcours/geometry?id=${p.osm_id}&type=${p.osm_type || "relation"}`);
      const c = g.coordinates;
      if (!Array.isArray(c) || c.length < 2) { console.log("   ❌ TRACÉ vide/indisponible"); incomplete++; await sleep(1500); continue; }
      let L = 0, jumps = 0, maxJ = 0;
      for (let k = 1; k < c.length; k++) { const d = havKm(c[k - 1], c[k]); L += d; if (d > 0.3) jumps++; if (d > maxJ) maxJ = d; }
      const tag = p.distance_km, ecart = tag ? Math.abs(L - tag) / tag : null;
      console.log(`   Tracé : ${c.length} pts · ${L.toFixed(1)} km${tag ? ` (annoncé ${tag})` : ""} · ${jumps} sauts>300m · saut max ${(maxJ * 1000).toFixed(0)} m`);
      let verdict;
      if (L < 0.4 || c.length < 4) { verdict = "❌ INCOMPLET (relation OSM coquille)"; incomplete++; }
      else if (maxJ > 1) { verdict = `⚠️  fragmenté (saut max ${maxJ.toFixed(1)} km)`; frag++; }
      else if (ecart != null && ecart > 0.35) { verdict = "⚠️  tag distance douteux (tracé OK)"; tagBad++; }
      else { verdict = "✅ TRACÉ COHÉRENT"; ok++; }
      console.log(`   → ${verdict}`);
      await sleep(1500);
      const rev = await reverse(p.lat, p.lng);
      const okLoc = rev.toLowerCase().includes((p.localisation.departement || "").toLowerCase()) || (p.localisation.departement || "").toLowerCase().includes(rev.toLowerCase());
      if (!okLoc) locBad++;
      console.log(`   📍 Localisation : Nominatim dit « ${rev} » → ${okLoc ? "✅ correspond" : "⚠️  à vérifier"}`);
      await sleep(1500);
    } catch (e) { console.log("   ⚠️ erreur :", e.message); await sleep(1500); }
  }
  console.log(`\n════════ BILAN ${list.items.length} premiers ════════`);
  console.log(`  ✅ tracé cohérent : ${ok}   ⚠️ tag douteux : ${tagBad}   ⚠️ fragmenté : ${frag}   ❌ incomplet OSM : ${incomplete}`);
  console.log(`  📍 localisations OK : ${list.items.length - locBad}/${list.items.length}`);
})();
