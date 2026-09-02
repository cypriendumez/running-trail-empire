/**
 * LES MODÈLES DONT ON VEUT LA FICHE.
 *
 * ⚠️ CE FICHIER NE CONTIENT QUE DES NOMS, JAMAIS DE CARACTÉRISTIQUES. Le nom sert de
 * question posée à la recherche ; les valeurs viennent de la collecte et portent leur
 * source. Écrire ici un poids « de tête » reviendrait exactement à ce que l'app s'interdit.
 *
 * Le terrain et l'usage, eux, sont un classement éditorial assumé : ils disent à qui la
 * chaussure s'adresse, ce qu'aucune fiche fabricant ne dit clairement.
 */
import type { Terrain, Usage } from "../src/lib/shop/modele";

type Entree = { slug: string; marque: string; nom: string; annee: number; terrain: Terrain; usage: Usage };

const m = (marque: string, nom: string, annee: number, terrain: Terrain, usage: Usage): Entree => ({
  slug: `${marque}-${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  marque, nom, annee, terrain, usage,
});

export const MODELES_A_COLLECTER: Entree[] = [
  // ── ADIDAS ────────────────────────────────────────────────────────────────────────
  m("Adidas", "Adizero Evo SL", 2025, "route", "tempo"),
  m("Adidas", "Adizero Adios Pro 4", 2025, "route", "competition"),
  m("Adidas", "Adizero Boston 13", 2025, "route", "tempo"),
  m("Adidas", "Adizero Adios 9", 2025, "route", "tempo"),
  m("Adidas", "Adizero Takumi Sen 11", 2025, "route", "competition"),
  m("Adidas", "Supernova Rise 2", 2025, "route", "quotidien"),
  m("Adidas", "Ultraboost 5", 2025, "route", "quotidien"),
  m("Adidas", "Terrex Agravic Speed Ultra", 2025, "trail", "trail_long"),
  m("Adidas", "Terrex Agravic Sl", 2025, "trail", "trail_court"),
  // ── ASICS ─────────────────────────────────────────────────────────────────────────
  m("Asics", "Novablast 5", 2025, "route", "quotidien"),
  m("Asics", "Novablast 6", 2026, "route", "quotidien"),
  m("Asics", "Superblast 2", 2025, "route", "polyvalent"),
  m("Asics", "Gel-Nimbus 28", 2026, "route", "amorti_max"),
  m("Asics", "Gel-Kayano 32", 2026, "route", "quotidien"),
  m("Asics", "Gel-Cumulus 27", 2025, "route", "quotidien"),
  m("Asics", "Metaspeed Sky Tokyo", 2025, "route", "competition"),
  m("Asics", "Metaspeed Edge Tokyo", 2025, "route", "competition"),
  m("Asics", "Magic Speed 5", 2025, "route", "tempo"),
  m("Asics", "Trabuco 14", 2026, "trail", "trail_court"),
  m("Asics", "Fujilite 5", 2025, "trail", "trail_court"),
  // ── HOKA ──────────────────────────────────────────────────────────────────────────
  m("Hoka", "Clifton 10", 2025, "route", "quotidien"),
  m("Hoka", "Bondi 9", 2025, "route", "amorti_max"),
  m("Hoka", "Mach 7", 2025, "route", "tempo"),
  m("Hoka", "Mach X 3", 2026, "route", "tempo"),
  m("Hoka", "Rocket X 3", 2025, "route", "competition"),
  m("Hoka", "Cielo X1 2.0", 2025, "route", "competition"),
  m("Hoka", "Speedgoat 6", 2024, "trail", "trail_long"),
  m("Hoka", "Speedgoat 7", 2026, "trail", "trail_long"),
  m("Hoka", "Mafate 5", 2025, "trail", "trail_long"),
  m("Hoka", "Tecton X 3", 2025, "trail", "trail_long"),
  m("Hoka", "Challenger 8", 2025, "trail", "trail_court"),
  m("Hoka", "Arahi 8", 2025, "route", "quotidien"),
  // ── NIKE ──────────────────────────────────────────────────────────────────────────
  m("Nike", "Pegasus 41", 2024, "route", "quotidien"),
  m("Nike", "Pegasus 42", 2025, "route", "quotidien"),
  m("Nike", "Pegasus Premium", 2025, "route", "quotidien"),
  m("Nike", "Vomero 18", 2025, "route", "amorti_max"),
  m("Nike", "Vaporfly Next 4", 2025, "route", "competition"),
  m("Nike", "Air Zoom Alphafly Next 3", 2024, "route", "competition"),
  m("Nike", "Zoom Fly 6", 2025, "route", "tempo"),
  m("Nike", "Structure 26", 2025, "route", "quotidien"),
  m("Nike", "Invincible 4", 2025, "route", "amorti_max"),
  m("Nike", "Ultrafly Trail", 2024, "trail", "trail_long"),
  m("Nike", "Pegasus Trail 5", 2024, "trail", "trail_court"),
  // ── NEW BALANCE ───────────────────────────────────────────────────────────────────
  m("New Balance", "FuelCell Rebel v5", 2025, "route", "tempo"),
  m("New Balance", "FuelCell SuperComp Elite v5", 2025, "route", "competition"),
  m("New Balance", "Fresh Foam X 1080v14", 2025, "route", "quotidien"),
  m("New Balance", "Fresh Foam X More v5", 2025, "route", "amorti_max"),
  m("New Balance", "Fresh Foam X Hierro v9", 2025, "trail", "trail_court"),
  // ── SAUCONY ───────────────────────────────────────────────────────────────────────
  m("Saucony", "Endorphin Speed 5", 2025, "route", "tempo"),
  m("Saucony", "Endorphin Pro 5", 2025, "route", "competition"),
  m("Saucony", "Endorphin Elite 2", 2025, "route", "competition"),
  m("Saucony", "Ride 18", 2025, "route", "quotidien"),
  m("Saucony", "Triumph 23", 2025, "route", "amorti_max"),
  m("Saucony", "Peregrine 16", 2026, "trail", "trail_court"),
  m("Saucony", "Xodus Ultra 4", 2025, "trail", "trail_long"),
  m("Saucony", "Kinvara 15", 2024, "route", "tempo"),
  // ── ON ────────────────────────────────────────────────────────────────────────────
  m("On", "Cloudmonster 2", 2024, "route", "quotidien"),
  m("On", "Cloudsurfer 2", 2025, "route", "quotidien"),
  m("On", "Cloudboom Strike", 2024, "route", "competition"),
  m("On", "Cloudultra 2", 2024, "trail", "trail_long"),
  m("On", "Cloudflow 4", 2024, "route", "tempo"),
  m("On", "Cloudvista 2", 2025, "trail", "trail_court"),
  // ── PUMA ──────────────────────────────────────────────────────────────────────────
  m("Puma", "Deviate Nitro 3", 2024, "route", "tempo"),
  m("Puma", "Velocity Nitro 4", 2025, "route", "quotidien"),
  m("Puma", "Fast-R Nitro Elite 3", 2025, "route", "competition"),
  m("Puma", "Deviate Nitro Elite 3", 2024, "route", "competition"),
  // ── SALOMON ───────────────────────────────────────────────────────────────────────
  m("Salomon", "Speedcross 6", 2023, "trail", "trail_court"),
  m("Salomon", "Sense Ride 5", 2023, "trail", "trail_court"),
  m("Salomon", "S/Lab Genesis", 2024, "trail", "trail_long"),
  m("Salomon", "Ultra Glide 3", 2024, "trail", "trail_long"),
  m("Salomon", "Pulsar Trail 2", 2024, "trail", "trail_court"),
  m("Salomon", "Thundercross", 2024, "trail", "trail_court"),
  m("Salomon", "Aero Glide 3", 2025, "route", "quotidien"),
  m("Salomon", "XT-6", 2022, "trail", "trail_court"),
  // ── BROOKS ────────────────────────────────────────────────────────────────────────
  m("Brooks", "Ghost 17", 2025, "route", "quotidien"),
  m("Brooks", "Glycerin 22", 2024, "route", "amorti_max"),
  m("Brooks", "Hyperion Max 2", 2024, "route", "tempo"),
  m("Brooks", "Caldera 8", 2025, "trail", "trail_long"),
  m("Brooks", "Cascadia 19", 2024, "trail", "trail_court"),
  m("Brooks", "Adrenaline GTS 24", 2024, "route", "quotidien"),
  // ── MIZUNO ────────────────────────────────────────────────────────────────────────
  m("Mizuno", "Wave Rider 29", 2025, "route", "quotidien"),
  m("Mizuno", "Wave Sky 9", 2025, "route", "amorti_max"),
  m("Mizuno", "Wave Rebellion Pro 3", 2025, "route", "competition"),
  m("Mizuno", "Wave Daichi 8", 2024, "trail", "trail_court"),
  m("Mizuno", "Neo Vista 2", 2025, "route", "quotidien"),
  // ── KIPRUN (DECATHLON) ────────────────────────────────────────────────────────────
  m("Kiprun", "KD900X LD+", 2024, "route", "competition"),
  m("Kiprun", "KD900", 2024, "route", "tempo"),
  m("Kiprun", "KS900", 2024, "route", "quotidien"),
  m("Kiprun", "Race 900", 2025, "route", "competition"),
  m("Kiprun", "XT8", 2024, "trail", "trail_long"),
  // ── ALTRA ─────────────────────────────────────────────────────────────────────────
  m("Altra", "Lone Peak 9", 2025, "trail", "trail_long"),
  m("Altra", "Torin 8", 2025, "route", "quotidien"),
  m("Altra", "Escalante 4", 2024, "route", "quotidien"),
  // ── LA SPORTIVA ───────────────────────────────────────────────────────────────────
  m("La Sportiva", "Bushido III", 2024, "trail", "trail_court"),
  m("La Sportiva", "Prodigio", 2024, "trail", "trail_long"),
  m("La Sportiva", "Prodigio Pro", 2025, "trail", "trail_long"),
  m("La Sportiva", "Jackal II", 2024, "trail", "trail_long"),
  m("La Sportiva", "Akasha II", 2023, "trail", "trail_long"),
  // ── AUTRES SPÉCIALISTES DU TRAIL ──────────────────────────────────────────────────
  m("Merrell", "Agility Peak 5", 2024, "trail", "trail_court"),
  m("Scott", "Kinabalu 3", 2024, "trail", "trail_court"),
  m("Scott", "Supertrac 3", 2024, "trail", "trail_court"),
  m("Inov-8", "Trailfly Ultra G 280", 2023, "trail", "trail_long"),
  m("Inov-8", "Mudclaw G 260 V2", 2022, "trail", "trail_court"),
  m("Topo Athletic", "Ultraventure 4", 2024, "trail", "trail_long"),
  m("NNormal", "Kjerag", 2023, "trail", "trail_long"),
  m("NNormal", "Tomir 2", 2024, "trail", "trail_long"),
  m("Norda", "001", 2023, "trail", "trail_long"),
];
