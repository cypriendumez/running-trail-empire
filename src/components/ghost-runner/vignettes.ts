/**
 * LES VIGNETTES DESSINÉES DU TIROIR DES MODÈLES (Cyprien, 27/11/2026 : « améliore les
 * images qui représentent VTT, vélo… il faut que ce soit parfait »).
 *
 * Pour un FOND, la vignette est la vraie tuile du quartier (`tuileDe`). Pour un CALQUE,
 * c'était aussi la vraie tuile — mais un calque est transparent là où il n'y a rien : à
 * Rouen, la tuile VTT ou Vélo est vide, et la vignette n'était qu'un dégradé muet. Chaque
 * calque a donc sa petite carte DESSINÉE, aux couleurs de Pacevo : le même plan de
 * quartier, et par-dessus ce que le calque ajoute (sentier balisé, piste VTT, voie
 * cyclable, ombrage, pentes, courbes…). Rien n'est copié d'une autre application.
 *
 * Tout est en SVG inline (data URI) : aucune requête, aucune image à héberger, net sur
 * écran Retina.
 */

type Teinte = { fond: string; bati: string; parc: string; eau: string; route: string; bord: string };

const JOUR: Teinte = { fond: "#f2f1ed", bati: "#dfdcd5", parc: "#bfe3a3", eau: "#9ccdf2", route: "#ffffff", bord: "#d3d0c8" };
const NUIT: Teinte = { fond: "#16191e", bati: "#252a32", parc: "#1b3324", eau: "#0e2638", route: "#3a404a", bord: "#23272e" };
const HIVER: Teinte = { fond: "#f4f7fb", bati: "#e3e8ef", parc: "#dfe9f3", eau: "#b9dcf5", route: "#ffffff", bord: "#cfd8e3" };

/** Le quartier de base : eau en bas, parc en haut à droite, deux rues, quelques bâtiments. */
function plan(t: Teinte, sansRues = false): string {
  const batis = [[4, 4, 9, 7], [15, 6, 7, 9], [5, 15, 8, 6], [42, 30, 9, 6], [54, 28, 8, 8], [46, 40, 7, 5]]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${t.bati}"/>`).join("");
  const rues = sansRues ? "" :
    `<path d="M-4 30 L72 16" stroke="${t.bord}" stroke-width="7"/><path d="M-4 30 L72 16" stroke="${t.route}" stroke-width="5"/>` +
    `<path d="M24 -4 L34 72" stroke="${t.bord}" stroke-width="5"/><path d="M24 -4 L34 72" stroke="${t.route}" stroke-width="3.4"/>`;
  return `<rect width="68" height="68" fill="${t.fond}"/>` +
    `<path d="M40 0 H68 V20 C58 25 48 17 41 12 Z" fill="${t.parc}"/>` +
    `<path d="M0 48 C14 42 22 54 36 50 S58 38 68 44 V68 H0 Z" fill="${t.eau}"/>` +
    batis + rues;
}

/** Une ligne d'itinéraire : un liseré blanc, puis la couleur du balisage. */
function ligne(d: string, couleur: string, largeur = 2.6, tirets = ""): string {
  return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${largeur + 2.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${couleur}" stroke-width="${largeur}" stroke-linecap="round" stroke-linejoin="round"${tirets ? ` stroke-dasharray="${tirets}"` : ""}/>`;
}

const SENTIER = "M6 62 C14 52 12 42 22 36 S38 30 44 20 S56 10 62 6";

const DESSINS: Record<string, string> = {
  plan: plan(JOUR),
  nuit: plan(NUIT),
  // Randonnée : un sentier balisé rouge, en pointillé, comme sur les cartes de rando.
  rando: plan(JOUR) + ligne(SENTIER, "#e11d48", 2.6, "4 2.6") + `<circle cx="62" cy="6" r="3.2" fill="#e11d48" stroke="#fff" stroke-width="1.4"/>`,
  // Randonnée suisse : le jaune du balisage pédestre suisse.
  "rando-ch": plan(JOUR) + ligne(SENTIER, "#eab308", 2.8, "4 2.6"),
  // VTT : une trace qui zigzague dans le relief, brun orangé.
  vtt: plan(JOUR) + ligne("M4 58 L14 50 L9 41 L22 35 L17 25 L32 20 L29 10 L46 5", "#c2410c", 2.6, "6 2"),
  // Vélo : une voie cyclable bleue le long de la grande rue, et une petite bicyclette.
  velo: plan(JOUR) + ligne("M-4 34.5 L72 20.5", "#2563eb", 2.4) +
    `<g transform="translate(34 46)" fill="none" stroke="#1e3a8a" stroke-width="1.6" stroke-linecap="round">` +
    `<circle cx="-5" cy="0" r="4" fill="#ffffff"/><circle cx="5" cy="0" r="4" fill="#ffffff"/><path d="M-5 0 L-1 -6 L4 -6 L5 0 M-1 -6 L1 0 L-5 0 M3 -8 L5 -8"/></g>`,
  // Ski : des pistes colorées (vert, bleu, rouge, noir) sur fond d'hiver.
  ski: plan(HIVER, true) + ligne("M8 4 C14 20 10 34 18 62", "#16a34a", 2.2) + ligne("M26 4 C32 22 26 40 34 62", "#2563eb", 2.2) +
    ligne("M44 4 C40 24 48 40 44 62", "#dc2626", 2.2) + ligne("M60 4 C56 22 62 42 58 62", "#18181b", 2.2),
  // Ombrage : le même quartier, estompé par le relief.
  ombrage: plan(JOUR) + `<defs><radialGradient id="o" cx="0.28" cy="0.25" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.55" stop-color="#6b7563" stop-opacity="0.15"/><stop offset="1" stop-color="#3f4a3a" stop-opacity="0.55"/></radialGradient></defs>` +
    `<rect width="68" height="68" fill="url(#o)"/><path d="M0 40 C16 26 30 34 44 18 S62 8 68 6 V0 H0 Z" fill="#3f4a3a" opacity="0.16"/>`,
  // Pentes : les paliers de l'IGN (30° → 45°+) sur un versant de montagne.
  pentes: `<rect width="68" height="68" fill="#eef1ea"/>` +
    `<path d="M0 68 L22 26 L34 40 L50 12 L68 40 V68 Z" fill="#dfe6d6"/>` +
    `<path d="M14 42 L22 26 L30 36 Z" fill="#F2E205" opacity="0.9"/><path d="M40 30 L50 12 L56 22 Z" fill="#E8471C" opacity="0.9"/>` +
    `<path d="M36 38 L44 24 L50 30 L44 40 Z" fill="#F29D0C" opacity="0.9"/><path d="M50 12 L54 6 L58 14 L56 22 Z" fill="#A0329B" opacity="0.9"/>`,
  // Courbes de niveau : des isolignes brunes autour d'un sommet.
  courbes: plan(JOUR, true) + [10, 17, 24, 31].map((r, i) =>
    `<ellipse cx="40" cy="26" rx="${r + 4}" ry="${r * 0.72}" fill="none" stroke="#a16207" stroke-width="${i === 1 ? 1.4 : 0.8}" opacity="0.75"/>`).join(""),
  // Relief 3D : des sommets en perspective.
  relief: `<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3f5"/><stop offset="1" stop-color="#eef3f8"/></linearGradient></defs>` +
    `<rect width="68" height="68" fill="url(#c)"/>` +
    `<path d="M-2 60 L18 26 L28 38 L42 14 L58 36 L70 28 V70 H-2 Z" fill="#8fa883"/>` +
    `<path d="M18 26 L28 38 L22 44 Z M42 14 L58 36 L48 40 Z" fill="#5f7556"/>` +
    `<path d="M42 14 L46 20 L40 22 Z M18 26 L21 31 L16 32 Z" fill="#ffffff"/>` +
    `<path d="M-2 66 L70 52 V70 H-2 Z" fill="#bfe3a3"/>`,
  poi: plan(JOUR),
  // Eau & toilettes : des anneaux cyan (jamais un rond bleu plein : c'est le point GPS) et un « WC » violet.
  eau: plan(JOUR) +
    `<circle cx="18" cy="40" r="5" fill="#fff" stroke="#0891b2" stroke-width="3"/><circle cx="50" cy="22" r="5" fill="#fff" stroke="#0891b2" stroke-width="3"/>` +
    `<rect x="36" y="38" width="15" height="11" rx="3" fill="#7c3aed" stroke="#fff" stroke-width="1.6"/>` +
    `<text x="43.5" y="46.3" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#fff">WC</text>`,
};

/** Les rues seules, posées sur la photo satellite pour la vignette « Hybride ». */
const RUES_SEULES = `<path d="M-4 30 L72 16" stroke="#fff6d8" stroke-width="4" opacity="0.95"/><path d="M24 -4 L34 72" stroke="#ffffff" stroke-width="2.6" opacity="0.9"/>`;

const enUrl = (corps: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 68">${corps}</svg>`)}")`;

/** La vignette dessinée d'un modèle ou d'un calque (fond CSS). Inconnu → le plan Pacevo. */
export function vignetteDessinee(id: string): string {
  return `${enUrl(DESSINS[id] ?? DESSINS.plan)} center/cover`;
}

/** Les rues d'« Hybride », à poser PAR-DESSUS la vraie photo du quartier. */
export const VIGNETTE_RUES = `${enUrl(RUES_SEULES)} center/cover`;
