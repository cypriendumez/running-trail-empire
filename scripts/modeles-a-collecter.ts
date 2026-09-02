/**
 * LES MODÈLES DONT ON VEUT LA FICHE.
 *
 * ⚠️ CE FICHIER NE CONTIENT QUE DES NOMS, JAMAIS DE CARACTÉRISTIQUES. Le nom sert de
 * question posée à la recherche ; les valeurs viennent de la collecte et portent leur
 * source. Écrire ici un poids « de tête » reviendrait exactement à ce que l'app s'interdit.
 *
 * Le terrain est le seul classement conservé ici — et depuis `decouverte-irun.ts`, il
 * vient même de la catégorie du marchand plutôt que de nous.
 */
import type { Terrain } from "../src/lib/shop/modele";

type Entree = { slug: string; marque: string; nom: string; annee: number; terrain: Terrain };

// ⚠️ PLUS D'USAGE ICI. Il était saisi modèle par modèle ; il se DÉDUIT désormais des
// cotes relevées (`lib/shop/usage`). Le garder aurait laissé une donnée morte qui a
// l'air d'une référence — et qui aurait divergé de la déduction au premier écart.
const m = (marque: string, nom: string, annee: number, terrain: Terrain): Entree => ({
  slug: `${marque}-${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  marque, nom, annee, terrain,
});

export const MODELES_A_COLLECTER: Entree[] = [
  // ── ADIDAS ────────────────────────────────────────────────────────────────────────
  m("Adidas", "Adizero Evo SL", 2025, "route"),
  m("Adidas", "Adizero Adios Pro 4", 2025, "route"),
  m("Adidas", "Adizero Boston 13", 2025, "route"),
  m("Adidas", "Adizero Adios 9", 2025, "route"),
  m("Adidas", "Adizero Takumi Sen 11", 2025, "route"),
  m("Adidas", "Supernova Rise 2", 2025, "route"),
  m("Adidas", "Ultraboost 5", 2025, "route"),
  m("Adidas", "Terrex Agravic Speed Ultra", 2025, "trail"),
  m("Adidas", "Terrex Agravic Sl", 2025, "trail"),
  // ── ASICS ─────────────────────────────────────────────────────────────────────────
  m("Asics", "Novablast 5", 2025, "route"),
  m("Asics", "Novablast 6", 2026, "route"),
  m("Asics", "Superblast 2", 2025, "route"),
  m("Asics", "Gel-Nimbus 28", 2026, "route"),
  m("Asics", "Gel-Kayano 32", 2026, "route"),
  m("Asics", "Gel-Cumulus 27", 2025, "route"),
  m("Asics", "Metaspeed Sky Tokyo", 2025, "route"),
  m("Asics", "Metaspeed Edge Tokyo", 2025, "route"),
  m("Asics", "Magic Speed 5", 2025, "route"),
  m("Asics", "Trabuco 14", 2026, "trail"),
  m("Asics", "Fujilite 5", 2025, "trail"),
  // ── HOKA ──────────────────────────────────────────────────────────────────────────
  m("Hoka", "Clifton 10", 2025, "route"),
  m("Hoka", "Bondi 9", 2025, "route"),
  m("Hoka", "Mach 7", 2025, "route"),
  m("Hoka", "Mach X 3", 2026, "route"),
  m("Hoka", "Rocket X 3", 2025, "route"),
  m("Hoka", "Cielo X1 2.0", 2025, "route"),
  m("Hoka", "Speedgoat 6", 2024, "trail"),
  m("Hoka", "Speedgoat 7", 2026, "trail"),
  m("Hoka", "Mafate 5", 2025, "trail"),
  m("Hoka", "Tecton X 3", 2025, "trail"),
  m("Hoka", "Challenger 8", 2025, "trail"),
  m("Hoka", "Arahi 8", 2025, "route"),
  // ── NIKE ──────────────────────────────────────────────────────────────────────────
  m("Nike", "Pegasus 41", 2024, "route"),
  m("Nike", "Pegasus 42", 2025, "route"),
  m("Nike", "Pegasus Premium", 2025, "route"),
  m("Nike", "Vomero 18", 2025, "route"),
  m("Nike", "Vaporfly Next 4", 2025, "route"),
  m("Nike", "Air Zoom Alphafly Next 3", 2024, "route"),
  m("Nike", "Zoom Fly 6", 2025, "route"),
  m("Nike", "Structure 26", 2025, "route"),
  m("Nike", "Invincible 4", 2025, "route"),
  m("Nike", "Ultrafly Trail", 2024, "trail"),
  m("Nike", "Pegasus Trail 5", 2024, "trail"),
  // ── NEW BALANCE ───────────────────────────────────────────────────────────────────
  m("New Balance", "FuelCell Rebel v5", 2025, "route"),
  m("New Balance", "FuelCell SuperComp Elite v5", 2025, "route"),
  m("New Balance", "Fresh Foam X 1080v14", 2025, "route"),
  m("New Balance", "Fresh Foam X More v5", 2025, "route"),
  m("New Balance", "Fresh Foam X Hierro v9", 2025, "trail"),
  // ── SAUCONY ───────────────────────────────────────────────────────────────────────
  m("Saucony", "Endorphin Speed 5", 2025, "route"),
  m("Saucony", "Endorphin Pro 5", 2025, "route"),
  m("Saucony", "Endorphin Elite 2", 2025, "route"),
  m("Saucony", "Ride 18", 2025, "route"),
  m("Saucony", "Triumph 23", 2025, "route"),
  m("Saucony", "Peregrine 16", 2026, "trail"),
  m("Saucony", "Xodus Ultra 4", 2025, "trail"),
  m("Saucony", "Kinvara 15", 2024, "route"),
  // ── ON ────────────────────────────────────────────────────────────────────────────
  m("On", "Cloudmonster 2", 2024, "route"),
  m("On", "Cloudsurfer 2", 2025, "route"),
  m("On", "Cloudboom Strike", 2024, "route"),
  m("On", "Cloudultra 2", 2024, "trail"),
  m("On", "Cloudflow 4", 2024, "route"),
  m("On", "Cloudvista 2", 2025, "trail"),
  // ── PUMA ──────────────────────────────────────────────────────────────────────────
  m("Puma", "Deviate Nitro 3", 2024, "route"),
  m("Puma", "Velocity Nitro 4", 2025, "route"),
  m("Puma", "Fast-R Nitro Elite 3", 2025, "route"),
  m("Puma", "Deviate Nitro Elite 3", 2024, "route"),
  // ── SALOMON ───────────────────────────────────────────────────────────────────────
  m("Salomon", "Speedcross 6", 2023, "trail"),
  m("Salomon", "Sense Ride 5", 2023, "trail"),
  m("Salomon", "S/Lab Genesis", 2024, "trail"),
  m("Salomon", "Ultra Glide 3", 2024, "trail"),
  m("Salomon", "Pulsar Trail 2", 2024, "trail"),
  m("Salomon", "Thundercross", 2024, "trail"),
  m("Salomon", "Aero Glide 3", 2025, "route"),
  m("Salomon", "XT-6", 2022, "trail"),
  // ── BROOKS ────────────────────────────────────────────────────────────────────────
  m("Brooks", "Ghost 17", 2025, "route"),
  m("Brooks", "Glycerin 22", 2024, "route"),
  m("Brooks", "Hyperion Max 2", 2024, "route"),
  m("Brooks", "Caldera 8", 2025, "trail"),
  m("Brooks", "Cascadia 19", 2024, "trail"),
  m("Brooks", "Adrenaline GTS 24", 2024, "route"),
  // ── MIZUNO ────────────────────────────────────────────────────────────────────────
  m("Mizuno", "Wave Rider 29", 2025, "route"),
  m("Mizuno", "Wave Sky 9", 2025, "route"),
  m("Mizuno", "Wave Rebellion Pro 3", 2025, "route"),
  m("Mizuno", "Wave Daichi 8", 2024, "trail"),
  m("Mizuno", "Neo Vista 2", 2025, "route"),
  // ── KIPRUN (DECATHLON) ────────────────────────────────────────────────────────────
  m("Kiprun", "KD900X LD+", 2024, "route"),
  m("Kiprun", "KD900", 2024, "route"),
  m("Kiprun", "KS900", 2024, "route"),
  m("Kiprun", "Race 900", 2025, "route"),
  m("Kiprun", "XT8", 2024, "trail"),
  // ── ALTRA ─────────────────────────────────────────────────────────────────────────
  m("Altra", "Lone Peak 9", 2025, "trail"),
  m("Altra", "Torin 8", 2025, "route"),
  m("Altra", "Escalante 4", 2024, "route"),
  // ── LA SPORTIVA ───────────────────────────────────────────────────────────────────
  m("La Sportiva", "Bushido III", 2024, "trail"),
  m("La Sportiva", "Prodigio", 2024, "trail"),
  m("La Sportiva", "Prodigio Pro", 2025, "trail"),
  m("La Sportiva", "Jackal II", 2024, "trail"),
  m("La Sportiva", "Akasha II", 2023, "trail"),
  // ── AUTRES SPÉCIALISTES DU TRAIL ──────────────────────────────────────────────────
  m("Merrell", "Agility Peak 5", 2024, "trail"),
  m("Scott", "Kinabalu 3", 2024, "trail"),
  m("Scott", "Supertrac 3", 2024, "trail"),
  m("Inov-8", "Trailfly Ultra G 280", 2023, "trail"),
  m("Inov-8", "Mudclaw G 260 V2", 2022, "trail"),
  m("Topo Athletic", "Ultraventure 4", 2024, "trail"),
  m("NNormal", "Kjerag", 2023, "trail"),
  m("NNormal", "Tomir 2", 2024, "trail"),
  m("Norda", "001", 2023, "trail"),
];
