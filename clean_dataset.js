// Nettoyage du dataset : retire les "?" placeholders des noms + les parcours < 1 km.
const fs = require("fs");
const F = "data/dataset_france.json";

function cleanName(n) {
  let s = (n || "").trim();
  s = s.replace(/^\s*\?\s*[-–—]\s*/, "");   // "? - X"  -> "X"
  s = s.replace(/\s*[-–—]\s*\?\s*$/, "");   // "X - ?"  -> "X"
  s = s.replace(/^\s*\?\s+/, "");           // "? X"    -> "X"
  s = s.replace(/\s*\?\s*$/, "");           // "X ?"    -> "X"
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}
module.exports = { cleanName };

if (require.main === module) {
  const D = JSON.parse(fs.readFileSync(F, "utf-8"));
  let dropped = 0, cleaned = 0;
  const out = [];
  for (const p of D) {
    if (p.distance_km > 0 && p.distance_km < 1) { dropped++; continue; } // minimum 1 km (distances connues)
    const nn = cleanName(p.nom);
    if (nn.length < 3 || !/[A-Za-zÀ-ÿ]{2,}/.test(nn)) { dropped++; continue; }
    if (nn !== p.nom) cleaned++;
    p.nom = nn;
    out.push(p);
  }
  fs.writeFileSync(F, JSON.stringify(out), "utf-8");
  console.log(`Avant: ${D.length} | Après: ${out.length} | noms nettoyés: ${cleaned} | retirés (<1km ou nom invalide): ${dropped}`);
}
