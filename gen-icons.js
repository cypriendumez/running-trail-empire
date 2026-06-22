// Génère toutes les icônes (favicon, apple-touch, PWA) à partir d'un seul SVG vectoriel.
//   node gen-icons.js
// Logo Pacevo : « P » blanc dont la base se prolonge en flèche ascendante (allure + progression).
// Dessiné en chemins (aucune police), fond émeraude plein → compatible maskable iOS/Android.
// Reprend exactement le tracé de src/components/brand/Logo.tsx (espace 120) recentré sur 512.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MASTER = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c6e56"/>
      <stop offset="1" stop-color="#0a3a2d"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.26" cy="0.22" r="0.9">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.22"/>
      <stop offset="0.6" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <g transform="scale(4.2667) translate(-5.6,-8.7)">
    <g transform="translate(8,12) scale(0.9)" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
      <rect x="30" y="22" width="16" height="66" rx="8" fill="#ffffff" stroke="none"/>
      <path d="M44 25 C78 25 78 60 44 60" stroke-width="16"/>
      <path d="M18 104 L46 74 L60 88 L102 38" stroke-width="13"/>
      <path d="M102 38 L82 41 M102 38 L99 60" stroke-width="13"/>
    </g>
  </g>
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
