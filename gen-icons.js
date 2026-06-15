// Génère toutes les icônes (favicon, apple-touch, PWA) à partir d'un seul SVG vectoriel.
//   node gen-icons.js
// Le « R » est dessiné en chemins (aucune dépendance à une police installée).
// Fond plein (pas de transparence) → compatible icônes maskable iOS/Android.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MASTER = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#1C1C24"/>
      <stop offset="1" stop-color="#09090B"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.26" cy="0.22" r="0.85">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <!-- stem + bowl du R (blanc) -->
  <line x1="196" y1="150" x2="196" y2="376" stroke="#ffffff" stroke-width="50" stroke-linecap="round"/>
  <path d="M196 152 H268 A60 60 0 0 1 268 272 H196" fill="none" stroke="#ffffff" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- jambe du R (émeraude = mouvement) -->
  <path d="M252 266 L340 376" fill="none" stroke="#34d399" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const master = Buffer.from(MASTER);
const OUT_ICONS = path.join(__dirname, "public", "icons");
fs.mkdirSync(OUT_ICONS, { recursive: true });

const PWA = [72, 96, 128, 144, 152, 192, 384, 512];

(async () => {
  for (const s of PWA) {
    await sharp(master, { density: 384 }).resize(s, s).png().toFile(path.join(OUT_ICONS, `icon-${s}x${s}.png`));
  }
  // Favicon (App Router : metadata.icons.icon -> /icon.png) + apple-touch (180, fond plein).
  await sharp(master, { density: 384 }).resize(256, 256).png().toFile(path.join(__dirname, "public", "icon.png"));
  await sharp(master, { density: 384 }).resize(180, 180).png().toFile(path.join(__dirname, "public", "apple-icon.png"));
  // favicon.ico classique (32) pour les vieux clients.
  await sharp(master, { density: 384 }).resize(32, 32).png().toFile(path.join(__dirname, "public", "favicon.ico"));
  console.log("✅ Icônes générées :", PWA.map(s => `${s}px`).join(", "), "+ favicon 256/32 + apple 180");
})().catch(e => { console.error(e); process.exit(1); });
