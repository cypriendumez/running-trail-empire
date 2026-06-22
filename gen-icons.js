// Régénère toutes les icônes (favicon, apple-touch, PWA) à partir du master Pacevo.
//   node gen-icons.js
// SOURCE DE VÉRITÉ : public/icon-master-1024.png — le logo Pacevo nettoyé (P + flèche
// ascendante sur tuile émeraude pleine, carré bord à bord, sans transparence ni coins
// arrondis : compatible icône maskable iOS/Android). Pour repartir d'un nouveau logo,
// remplace simplement ce fichier master puis relance ce script.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const MASTER = path.join(__dirname, "public", "icon-master-1024.png");
const OUT_ICONS = path.join(__dirname, "public", "icons");
const PWA = [72, 96, 128, 144, 152, 192, 384, 512];

(async () => {
  if (!fs.existsSync(MASTER)) throw new Error("public/icon-master-1024.png introuvable");
  fs.mkdirSync(OUT_ICONS, { recursive: true });
  for (const s of PWA)
    await sharp(MASTER).resize(s, s).png().toFile(path.join(OUT_ICONS, `icon-${s}x${s}.png`));
  await sharp(MASTER).resize(256, 256).png().toFile(path.join(__dirname, "public", "icon.png"));
  await sharp(MASTER).resize(180, 180).png().toFile(path.join(__dirname, "public", "apple-icon.png"));
  await sharp(MASTER).resize(32, 32).png().toFile(path.join(__dirname, "public", "favicon.ico"));
  console.log("✅ Icônes générées depuis le master :", PWA.map(s => `${s}px`).join(", "), "+ favicon + apple 180");
})().catch(e => { console.error(e); process.exit(1); });
