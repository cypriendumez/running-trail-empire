// Régénère toutes les icônes (favicon, apple-touch, PWA) à partir de la marque Pacevo.
//   node gen-icons.js
//
// SOURCE DE VÉRITÉ : public/pacevo-mark.svg — du VECTORIEL, et c'est le changement
// important. Le master était auparavant un PNG 1024 sans source : impossible de le
// retoucher, de le décliner ou d'en tirer un favicon net à 32 px sans repasser par un
// outil externe. Toute icône, y compris le master raster, est désormais rendue depuis
// ce fichier — chaque taille est rastérisée à sa résolution native au lieu d'être
// réduite depuis un raster, donc aucun escalier sur les petits formats.
//
// La tuile est carrée bord à bord, sans transparence ni coins arrondis : c'est
// l'exigence des icônes « maskable » iOS/Android. L'arrondi est appliqué en CSS pour
// l'affichage in-app (Logo.tsx) et par le système pour l'icône d'application.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SOURCE = path.join(__dirname, "public", "pacevo-mark.svg");
const OUT_ICONS = path.join(__dirname, "public", "icons");
const PWA = [72, 96, 128, 144, 152, 192, 384, 512];

// `density` élevée : sans elle, sharp rastérise le SVG à 72 ppp (≈ 96 px) puis
// AGRANDIT jusqu'à la taille demandée — le master 1024 sortait flou, en silence.
const rendre = (taille) => sharp(SOURCE, { density: 600 }).resize(taille, taille).png();

(async () => {
  if (!fs.existsSync(SOURCE)) throw new Error("public/pacevo-mark.svg introuvable");
  fs.mkdirSync(OUT_ICONS, { recursive: true });
  for (const s of PWA)
    await rendre(s).toFile(path.join(OUT_ICONS, `icon-${s}x${s}.png`));
  await rendre(1024).toFile(path.join(__dirname, "public", "icon-master-1024.png"));
  // Le logo affiché DANS l'application (Logo.tsx). 512 suffit : il n'est jamais rendu
  // au-delà de ~80 px, même sur un écran à 3× de densité.
  await rendre(512).toFile(path.join(__dirname, "public", "pacevo-logo.png"));
  await rendre(256).toFile(path.join(__dirname, "public", "icon.png"));
  await rendre(180).toFile(path.join(__dirname, "public", "apple-icon.png"));
  await rendre(32).toFile(path.join(__dirname, "public", "favicon.ico"));
  console.log("✅ Icônes rendues depuis public/pacevo-mark.svg :",
    PWA.map(s => `${s}px`).join(", "), "+ master 1024 + logo 512 + icon 256 + apple 180 + favicon 32");
})().catch(e => { console.error(e); process.exit(1); });
