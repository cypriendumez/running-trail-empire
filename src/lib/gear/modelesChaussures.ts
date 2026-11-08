/**
 * TOUS LES MODÈLES DE CHAUSSURES, ANCIENS ET RÉCENTS — l'autocomplétion du Garage (30/09/2026).
 *
 * Cyprien : « ça ne trouve même pas les paires de base comme la Gel Nimbus 27 ; ça doit
 * mettre tous les nouveaux modèles dès leur sortie, mais aussi les anciens ». Deux défauts :
 *   - la liste écrite en dur s'arrêtait à « Gel-Nimbus 26 » — une seule génération par
 *     gamme, figée le jour où on l'avait tapée ;
 *   - la recherche comparait le texte tel quel : « gel nimbus » (espace) ne trouvait pas
 *     « Gel-Nimbus » (tiret).
 *
 * Désormais une GAMME porte ses générations (« Gel-Nimbus {n} », de 20 à 28) : toutes les
 * versions qu'un athlète peut encore avoir au pied sont proposées, la plus récente d'abord.
 * Le catalogue du comparateur (`data/gear/chaussures.json`, ses cotes) s'y ajoute — et
 * PROLONGE les gammes : dès qu'il connaît « Clifton 11 », la gamme Clifton va jusqu'à 11.
 * La recherche ignore la casse, les accents, les tirets et les espaces, mot par mot.
 * La saisie reste LIBRE : un modèle absent de la liste s'enregistre quand même.
 */

type Gamme = { marque: string; modele: string; de?: number; a?: number };

/**
 * Les gammes et leurs générations connues (relevé du 30/09/2026). `{n}` = le numéro ;
 * sans `de`/`a`, le nom est unique (« Cloudboom Strike »). On remonte ~8 générations :
 * au-delà, plus personne ne court avec.
 */
const GAMMES: Gamme[] = [
  // Asics
  { marque: "Asics", modele: "Gel-Nimbus {n}", de: 20, a: 28 }, { marque: "Asics", modele: "Gel-Kayano {n}", de: 25, a: 32 },
  { marque: "Asics", modele: "Gel-Cumulus {n}", de: 20, a: 28 }, { marque: "Asics", modele: "Novablast {n}", de: 1, a: 5 },
  { marque: "Asics", modele: "Superblast {n}", de: 1, a: 2 }, { marque: "Asics", modele: "Magic Speed {n}", de: 1, a: 4 },
  { marque: "Asics", modele: "GT-2000 {n}", de: 9, a: 14 }, { marque: "Asics", modele: "GT-1000 {n}", de: 10, a: 13 },
  { marque: "Asics", modele: "Gel-Pulse {n}", de: 12, a: 16 }, { marque: "Asics", modele: "Gel-Excite {n}", de: 8, a: 10 },
  { marque: "Asics", modele: "Gel-Trabuco {n}", de: 9, a: 13 }, { marque: "Asics", modele: "Trabuco Max {n}", de: 1, a: 4 },
  { marque: "Asics", modele: "Fuji Lite {n}", de: 2, a: 5 }, { marque: "Asics", modele: "Gel-Sonoma {n}", de: 6, a: 8 },
  { marque: "Asics", modele: "Metaspeed Sky" }, { marque: "Asics", modele: "Metaspeed Edge" }, { marque: "Asics", modele: "Metaspeed Sky Paris" },
  { marque: "Asics", modele: "Metaspeed Edge Paris" }, { marque: "Asics", modele: "Metaspeed Sky Tokyo" }, { marque: "Asics", modele: "Metaspeed Edge Tokyo" },
  { marque: "Asics", modele: "Megablast" }, { marque: "Asics", modele: "Sonicblast" }, { marque: "Asics", modele: "Gel-Nimbus 10.1" },
  // Nike
  { marque: "Nike", modele: "Pegasus {n}", de: 36, a: 42 }, { marque: "Nike", modele: "Pegasus Plus" }, { marque: "Nike", modele: "Pegasus Premium" },
  { marque: "Nike", modele: "Vomero {n}", de: 15, a: 18 }, { marque: "Nike", modele: "Vomero Plus" }, { marque: "Nike", modele: "Vomero Premium" },
  { marque: "Nike", modele: "Structure {n}", de: 23, a: 26 }, { marque: "Nike", modele: "Invincible {n}", de: 1, a: 3 },
  { marque: "Nike", modele: "Zoom Fly {n}", de: 4, a: 6 }, { marque: "Nike", modele: "Vaporfly {n}", de: 1, a: 4 },
  { marque: "Nike", modele: "Alphafly {n}", de: 1, a: 3 }, { marque: "Nike", modele: "Streakfly {n}", de: 1, a: 2 },
  { marque: "Nike", modele: "Pegasus Trail {n}", de: 3, a: 5 }, { marque: "Nike", modele: "Kiger {n}", de: 8, a: 10 },
  { marque: "Nike", modele: "Wildhorse {n}", de: 7, a: 10 }, { marque: "Nike", modele: "Zegama {n}", de: 1, a: 2 },
  { marque: "Nike", modele: "Winflo {n}", de: 9, a: 11 }, { marque: "Nike", modele: "Ultrafly" }, { marque: "Nike", modele: "Infinity Run 4" },
  // Hoka
  { marque: "Hoka", modele: "Clifton {n}", de: 7, a: 10 }, { marque: "Hoka", modele: "Bondi {n}", de: 7, a: 9 },
  { marque: "Hoka", modele: "Mach {n}", de: 4, a: 6 }, { marque: "Hoka", modele: "Mach X {n}", de: 1, a: 3 },
  { marque: "Hoka", modele: "Rocket X {n}", de: 1, a: 3 }, { marque: "Hoka", modele: "Cielo X1 {n}", de: 1, a: 3 },
  { marque: "Hoka", modele: "Speedgoat {n}", de: 4, a: 6 }, { marque: "Hoka", modele: "Challenger {n}", de: 6, a: 8 },
  { marque: "Hoka", modele: "Arahi {n}", de: 5, a: 8 }, { marque: "Hoka", modele: "Gaviota {n}", de: 4, a: 5 },
  { marque: "Hoka", modele: "Tecton X {n}", de: 1, a: 3 }, { marque: "Hoka", modele: "Torrent {n}", de: 2, a: 4 },
  { marque: "Hoka", modele: "Zinal {n}", de: 1, a: 2 }, { marque: "Hoka", modele: "Rincon {n}", de: 3, a: 4 },
  { marque: "Hoka", modele: "Mafate Speed {n}", de: 3, a: 4 }, { marque: "Hoka", modele: "Skyward X" }, { marque: "Hoka", modele: "Mafate X" },
  { marque: "Hoka", modele: "Transport" }, { marque: "Hoka", modele: "Kawana 2" }, { marque: "Hoka", modele: "Stinson 7" },
  // Adidas
  { marque: "Adidas", modele: "Adizero Adios Pro {n}", de: 2, a: 4 }, { marque: "Adidas", modele: "Adizero Adios Pro Evo {n}", de: 1, a: 2 },
  { marque: "Adidas", modele: "Adizero Boston {n}", de: 10, a: 13 }, { marque: "Adidas", modele: "Adizero SL {n}", de: 1, a: 2 },
  { marque: "Adidas", modele: "Adizero Evo SL" }, { marque: "Adidas", modele: "Adizero Takumi Sen {n}", de: 8, a: 10 },
  { marque: "Adidas", modele: "Supernova Rise {n}", de: 1, a: 2 }, { marque: "Adidas", modele: "Supernova Prima" },
  { marque: "Adidas", modele: "Adistar {n}", de: 2, a: 3 }, { marque: "Adidas", modele: "Ultraboost Light" }, { marque: "Adidas", modele: "Ultraboost 5" },
  { marque: "Adidas", modele: "Terrex Agravic Speed" }, { marque: "Adidas", modele: "Terrex Agravic Ultra" }, { marque: "Adidas", modele: "Terrex Speed Ultra" },
  { marque: "Adidas", modele: "Terrex Speed Pro" }, { marque: "Adidas", modele: "Duramo SL" }, { marque: "Adidas", modele: "Solarglide 6" },
  // Saucony
  { marque: "Saucony", modele: "Endorphin Speed {n}", de: 2, a: 5 }, { marque: "Saucony", modele: "Endorphin Pro {n}", de: 2, a: 4 },
  { marque: "Saucony", modele: "Endorphin Elite {n}", de: 1, a: 2 }, { marque: "Saucony", modele: "Kinvara {n}", de: 12, a: 16 },
  { marque: "Saucony", modele: "Ride {n}", de: 15, a: 18 }, { marque: "Saucony", modele: "Triumph {n}", de: 20, a: 23 },
  { marque: "Saucony", modele: "Guide {n}", de: 15, a: 18 }, { marque: "Saucony", modele: "Tempus {n}", de: 1, a: 2 },
  { marque: "Saucony", modele: "Peregrine {n}", de: 12, a: 15 }, { marque: "Saucony", modele: "Xodus Ultra {n}", de: 2, a: 4 },
  { marque: "Saucony", modele: "Hurricane 24" }, { marque: "Saucony", modele: "Endorphin Edge" }, { marque: "Saucony", modele: "Endorphin Trail" },
  { marque: "Saucony", modele: "Axon 3" },
  // Brooks
  { marque: "Brooks", modele: "Ghost {n}", de: 14, a: 17 }, { marque: "Brooks", modele: "Ghost Max {n}", de: 1, a: 3 },
  { marque: "Brooks", modele: "Glycerin {n}", de: 20, a: 22 }, { marque: "Brooks", modele: "Glycerin Max" },
  { marque: "Brooks", modele: "Adrenaline GTS {n}", de: 21, a: 25 }, { marque: "Brooks", modele: "Launch {n}", de: 8, a: 11 },
  { marque: "Brooks", modele: "Hyperion {n}", de: 1, a: 3 }, { marque: "Brooks", modele: "Hyperion Max {n}", de: 1, a: 3 },
  { marque: "Brooks", modele: "Hyperion Elite {n}", de: 3, a: 5 }, { marque: "Brooks", modele: "Caldera {n}", de: 6, a: 8 },
  { marque: "Brooks", modele: "Cascadia {n}", de: 16, a: 19 }, { marque: "Brooks", modele: "Catamount {n}", de: 2, a: 4 },
  { marque: "Brooks", modele: "Divide {n}", de: 4, a: 5 }, { marque: "Brooks", modele: "Levitate 6" },
  // New Balance
  { marque: "New Balance", modele: "Fresh Foam X 1080v{n}", de: 11, a: 14 }, { marque: "New Balance", modele: "Fresh Foam X More v{n}", de: 4, a: 5 },
  { marque: "New Balance", modele: "Fresh Foam X 880v{n}", de: 12, a: 15 }, { marque: "New Balance", modele: "Fresh Foam X 860v{n}", de: 13, a: 14 },
  { marque: "New Balance", modele: "FuelCell Rebel v{n}", de: 3, a: 5 }, { marque: "New Balance", modele: "FuelCell SC Elite v{n}", de: 3, a: 5 },
  { marque: "New Balance", modele: "FuelCell SC Trainer v{n}", de: 2, a: 3 }, { marque: "New Balance", modele: "FuelCell Propel v{n}", de: 4, a: 5 },
  { marque: "New Balance", modele: "Fresh Foam X Hierro v{n}", de: 7, a: 9 }, { marque: "New Balance", modele: "Fresh Foam X Balos" },
  { marque: "New Balance", modele: "Fresh Foam X Vongo v6" }, { marque: "New Balance", modele: "FuelCell Supercomp Trail" },
  // Salomon
  { marque: "Salomon", modele: "Speedcross {n}", de: 5, a: 6 }, { marque: "Salomon", modele: "Sense Ride {n}", de: 4, a: 5 },
  { marque: "Salomon", modele: "S/Lab Pulsar {n}", de: 1, a: 3 }, { marque: "Salomon", modele: "Pulsar Trail Pro {n}", de: 1, a: 2 },
  { marque: "Salomon", modele: "Ultra Glide {n}", de: 1, a: 3 }, { marque: "Salomon", modele: "Aero Glide {n}", de: 1, a: 3 },
  { marque: "Salomon", modele: "Aero Blaze {n}", de: 1, a: 2 }, { marque: "Salomon", modele: "XA Pro 3D v{n}", de: 8, a: 9 },
  { marque: "Salomon", modele: "S/Lab Genesis" }, { marque: "Salomon", modele: "Genesis" }, { marque: "Salomon", modele: "Pulsar Trail" },
  { marque: "Salomon", modele: "Thundercross" }, { marque: "Salomon", modele: "S/Lab Ultra 3" }, { marque: "Salomon", modele: "S/Lab Phantasm 2" },
  { marque: "Salomon", modele: "DRX Bliss" }, { marque: "Salomon", modele: "Sense Pro 5" }, { marque: "Salomon", modele: "Sense Flow 2" },
  // On
  { marque: "On", modele: "Cloudmonster {n}", de: 1, a: 2 }, { marque: "On", modele: "Cloudmonster Hyper" }, { marque: "On", modele: "Cloudboom Echo 3" },
  { marque: "On", modele: "Cloudboom Strike" }, { marque: "On", modele: "Cloudsurfer {n}", de: 1, a: 2 }, { marque: "On", modele: "Cloudsurfer Next" },
  { marque: "On", modele: "Cloudsurfer Trail" }, { marque: "On", modele: "Cloudeclipse" }, { marque: "On", modele: "Cloudflow 4" },
  { marque: "On", modele: "Cloudrunner 2" }, { marque: "On", modele: "Cloudultra 2" }, { marque: "On", modele: "Cloudvista 2" },
  { marque: "On", modele: "Cloudstratus 3" }, { marque: "On", modele: "Cloudflyer 4" }, { marque: "On", modele: "Cloudspark" },
  // Puma
  { marque: "Puma", modele: "Deviate Nitro {n}", de: 2, a: 3 }, { marque: "Puma", modele: "Deviate Nitro Elite {n}", de: 2, a: 3 },
  { marque: "Puma", modele: "Velocity Nitro {n}", de: 2, a: 4 }, { marque: "Puma", modele: "Magnify Nitro {n}", de: 1, a: 2 },
  { marque: "Puma", modele: "ForeverRun Nitro {n}", de: 1, a: 2 }, { marque: "Puma", modele: "Fast-R Nitro Elite {n}", de: 1, a: 3 },
  { marque: "Puma", modele: "Fast-Trac Nitro {n}", de: 2, a: 3 }, { marque: "Puma", modele: "Voyage Nitro 3" }, { marque: "Puma", modele: "Liberate Nitro 2" },
  // Mizuno
  { marque: "Mizuno", modele: "Wave Rider {n}", de: 25, a: 29 }, { marque: "Mizuno", modele: "Wave Inspire {n}", de: 18, a: 21 },
  { marque: "Mizuno", modele: "Wave Sky {n}", de: 6, a: 9 }, { marque: "Mizuno", modele: "Wave Rebellion Pro {n}", de: 1, a: 3 },
  { marque: "Mizuno", modele: "Wave Rebellion Flash {n}", de: 1, a: 2 }, { marque: "Mizuno", modele: "Wave Mujin {n}", de: 9, a: 10 },
  { marque: "Mizuno", modele: "Wave Daichi {n}", de: 7, a: 8 }, { marque: "Mizuno", modele: "Wave Neo Ultra" }, { marque: "Mizuno", modele: "Wave Neo Wind" },
  { marque: "Mizuno", modele: "Neo Zen" },
  // Altra
  { marque: "Altra", modele: "Torin {n}", de: 6, a: 8 }, { marque: "Altra", modele: "Escalante {n}", de: 3, a: 4 },
  { marque: "Altra", modele: "Lone Peak {n}", de: 6, a: 9 }, { marque: "Altra", modele: "Olympus {n}", de: 5, a: 6 },
  { marque: "Altra", modele: "Timp {n}", de: 4, a: 5 }, { marque: "Altra", modele: "Mont Blanc" }, { marque: "Altra", modele: "Mont Blanc Carbon" },
  { marque: "Altra", modele: "Vanish Carbon 2" }, { marque: "Altra", modele: "Rivera 4" }, { marque: "Altra", modele: "Superior 6" }, { marque: "Altra", modele: "Experience Flow" },
  // Kiprun (Decathlon) — les plus vendues en France
  { marque: "Kiprun", modele: "KD900X" }, { marque: "Kiprun", modele: "KD900X LD" }, { marque: "Kiprun", modele: "KD900" }, { marque: "Kiprun", modele: "KD900 2" },
  { marque: "Kiprun", modele: "KS900" }, { marque: "Kiprun", modele: "KS900 2" }, { marque: "Kiprun", modele: "KD800" }, { marque: "Kiprun", modele: "KD500" },
  { marque: "Kiprun", modele: "KD500 2" }, { marque: "Kiprun", modele: "KS500" }, { marque: "Kiprun", modele: "KS500 2" }, { marque: "Kiprun", modele: "KS Light" },
  { marque: "Kiprun", modele: "XT8" }, { marque: "Kiprun", modele: "MT Cushion 2" }, { marque: "Kiprun", modele: "Race Light" }, { marque: "Kiprun", modele: "Jogflow 500.1" },
  // Trail
  { marque: "La Sportiva", modele: "Bushido {n}", de: 2, a: 3 }, { marque: "La Sportiva", modele: "Akasha 2" }, { marque: "La Sportiva", modele: "Prodigio" },
  { marque: "La Sportiva", modele: "Jackal 2" }, { marque: "La Sportiva", modele: "Mutant" }, { marque: "La Sportiva", modele: "Cyklon" },
  { marque: "Inov-8", modele: "Trailfly" }, { marque: "Inov-8", modele: "Trailfly Ultra G 300 Max" }, { marque: "Inov-8", modele: "Terraultra G 270" },
  { marque: "Inov-8", modele: "X-Talon" }, { marque: "Merrell", modele: "Agility Peak {n}", de: 4, a: 5 }, { marque: "Merrell", modele: "MTL Long Sky 2" },
  { marque: "Scott", modele: "Supertrac RC {n}", de: 2, a: 3 }, { marque: "Scott", modele: "Kinabalu {n}", de: 2, a: 3 }, { marque: "Scott", modele: "Speed Carbon RC" },
  { marque: "Norda", modele: "001" }, { marque: "Norda", modele: "002" }, { marque: "NNormal", modele: "Kjerag" }, { marque: "NNormal", modele: "Tomir 2" },
  { marque: "Dynafit", modele: "Ultra 100" }, { marque: "Dynafit", modele: "Alpine" }, { marque: "Craft", modele: "CTM Ultra 3" },
  { marque: "Under Armour", modele: "Velociti Elite 2" }, { marque: "Under Armour", modele: "Infinite Elite" }, { marque: "Reebok", modele: "Floatride Energy 5" },
];

export type ModeleChaussure = { marque: string; nom: string };

/** Sans casse, sans accents, sans tirets ni espaces : « Gel-Nimbus » = « gel nimbus » = « GELNIMBUS ». */
export const compact = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const numero = (nom: string) => Number(nom.match(/(\d+(?:\.\d+)?)\D*$/)?.[1] ?? -1);

/**
 * La liste complète : les générations de chaque gamme, prolongées par le catalogue (un
 * « Clifton 11 » du comparateur étend la gamme jusqu'à 11), plus les modèles du catalogue.
 */
/** Combien de générations un catalogue peut ajouter à une gamme écrite (une par an, environ). */
export const AVANCE_MAX_GENERATIONS = 3;

export function tousLesModeles(catalogue: readonly ModeleChaussure[] = []): ModeleChaussure[] {
  const vus = new Map<string, ModeleChaussure>();
  const ajouter = (marque: string, nom: string) => { const k = `${compact(marque)}|${compact(nom)}`; if (!vus.has(k)) vus.set(k, { marque, nom }); };
  for (const g of GAMMES) {
    if (g.de == null || g.a == null) { ajouter(g.marque, g.modele); continue; }
    // Le catalogue connaît-il une génération plus récente de cette gamme ?
    const motif = new RegExp(`^${g.modele.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace("\\{n\\}", "(\\d+)")}$`, "i");
    let a = g.a;
    // ⚠️ UN NOMBRE N'EST PAS TOUJOURS UNE GÉNÉRATION (02/10/2026) : « Olympus 275 » est un
    // modèle d'Altra, pas la 275ᵉ Olympus — la gamme s'étendait de 7 à 275 et le Garage
    // proposait 268 chaussures qui n'existent pas. Une gamme gagne une génération par an :
    // au-delà de quelques numéros d'avance, c'est un autre modèle (ajouté tel quel plus bas).
    for (const m of catalogue) if (compact(m.marque) === compact(g.marque)) {
      const x = m.nom.match(motif);
      if (x && Number(x[1]) <= g.a + AVANCE_MAX_GENERATIONS) a = Math.max(a, Number(x[1]));
    }
    for (let n = g.de; n <= a; n++) ajouter(g.marque, g.modele.replace("{n}", String(n)));
  }
  for (const m of catalogue) ajouter(m.marque, m.nom);
  return [...vus.values()];
}

/**
 * Les suggestions pour une saisie : chaque mot tapé doit se retrouver dans « marque + nom »
 * (sans tirets ni espaces) ; la marque saisie, si elle est reconnue, restreint la liste.
 * Tri : ce qui COMMENCE par la saisie d'abord, puis la génération la plus récente.
 */
export function suggererModeles(tous: readonly ModeleChaussure[], marque: string, saisie: string, max = 10): ModeleChaussure[] {
  const m = compact(marque);
  const mots = saisie.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const marqueConnue = m && tous.some((x) => compact(x.marque) === m);
  const q = compact(saisie);
  return tous
    .filter((x) => !marqueConnue || compact(x.marque) === m)
    .filter((x) => { const t = `${compact(x.marque)}${compact(x.nom)}`; return mots.every((w) => t.includes(w)); })
    // ⚠️ LA CORRESPONDANCE EXACTE RESTE PROPOSÉE (30/09/2026). L'ancien filtre retirait
    // « ce qui est déjà tapé » : taper « gel nimbus 27 » faisait DISPARAÎTRE Gel-Nimbus 27
    // — exactement « ça ne trouve même pas la Gel Nimbus 27 ». Seul un texte identique au
    // caractère près est omis ; sinon la suggestion donne la forme officielle et la marque.
    .filter((x) => x.nom !== saisie.trim())
    .sort((a, b) => Number(compact(b.nom).startsWith(q)) - Number(compact(a.nom).startsWith(q)) || numero(b.nom) - numero(a.nom) || a.nom.localeCompare(b.nom))
    .slice(0, max);
}

/** Les marques connues, pour l'autocomplétion du premier champ. */
export function toutesLesMarques(tous: readonly ModeleChaussure[]): string[] {
  return [...new Set(tous.map((x) => x.marque))];
}
