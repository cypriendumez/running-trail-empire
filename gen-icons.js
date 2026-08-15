// Régénère toutes les icônes (favicon, apple-touch, PWA) à partir de la marque Pacevo.
//   node gen-icons.js
//
// SOURCE DE VÉRITÉ : public/pacevo-mark.png — la marque officielle fournie par
// Cyprien (P dont la hampe se prolonge en sentier). C'est CE fichier qu'il faut
// remplacer pour changer de logo, et lui seul : les quatorze fichiers ci-dessous en
// sont tous dérivés. La version vectorielle qui vivait ici a été retirée — deux
// sources concurrentes pour une même marque finissent toujours par diverger, et
// c'est la marque fournie qui fait foi.
//
// Vérifié sur le fichier : 1024×1024, sans canal alpha, et les QUATRE COINS sont
// verts pleins (#046949 / #036846 / #0b5439 / #053124). C'est la condition d'une
// icône « maskable » : un arrondi déjà cuit dans l'image laisserait un liseré clair
// une fois le masque appliqué par iOS ou Android.
//
// La tuile est carrée bord à bord, sans transparence ni coins arrondis : c'est
// l'exigence des icônes « maskable » iOS/Android. L'arrondi est appliqué en CSS pour
// l'affichage in-app (Logo.tsx) et par le système pour l'icône d'application.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SOURCE = path.join(__dirname, "public", "pacevo-mark.png");
const OUT_ICONS = path.join(__dirname, "public", "icons");
const PWA = [72, 96, 128, 144, 152, 192, 384, 512];

// `kernel: lanczos3` : le rééchantillonnage par défaut adoucit les diagonales, et
// cette marque n'est presque QUE des diagonales (la lame du P, les virages du
// sentier). La différence ne se voit pas à 512 px, elle décide de la lisibilité à 32.
const rendre = (taille) => sharp(SOURCE).resize(taille, taille, { kernel: "lanczos3" }).png();

(async () => {
  if (!fs.existsSync(SOURCE)) throw new Error("public/pacevo-mark.png introuvable");
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
  console.log("✅ Icônes rendues depuis public/pacevo-mark.png :",
    PWA.map(s => `${s}px`).join(", "), "+ master 1024 + logo 512 + icon 256 + apple 180 + favicon 32");
})().catch(e => { console.error(e); process.exit(1); });
