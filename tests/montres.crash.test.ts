/**
 * CRASH-TESTS PAR MARQUE DE MONTRE.
 *
 * La question posée était : « est-ce que ça marche pour chaque marque comme pour
 * Garmin ? » Ce fichier y répond pour tout ce qui est SOUS NOTRE CONTRÔLE, et il faut
 * dire tout de suite ce qui ne l'est pas.
 *
 * ── CE QU'ON NE PEUT PAS TESTER ICI ──────────────────────────────────────────
 * Qu'une Suunto physique affiche bien la séance à son porteur. Il faudrait la montre,
 * un compte intervals.icu avec cette marque activée, et une sortie réelle. Ce qui EST
 * vérifié, et qui l'a été sur l'API le 21/08/2026 : les champs `*_upload_workouts`
 * existent pour les sept destinations, donc intervals.icu accepte de leur transmettre
 * une séance. Le reste — que la séance transmise soit COMPLÈTE et LISIBLE par la
 * montre — dépend entièrement du texte qu'on produit, et c'est ce qu'on teste ici.
 *
 * ── LE DÉFAUT QU'ON TRAQUE ───────────────────────────────────────────────────
 * intervals.icu n'exporte QU'UNE métrique directrice par séance. Sur une Garmin, une
 * séance qui mélange FC (échauffement) et allure (efforts) passe. Sur toutes les autres,
 * les blocs portant la métrique secondaire arrivent **SANS AUCUNE CIBLE** : le coureur
 * voit « 8 min » et rien d'autre. Aucune erreur nulle part — la séance part, elle est
 * simplement vide de sa prescription.
 *
 * L'invariant est donc : sur une montre non-Garmin, TOUTES les étapes d'une séance
 * portent la MÊME métrique. Et sur TOUTES les montres, aucune étape n'est sans cible.
 *
 *   npx tsx tests/montres.crash.test.ts
 */
import { buildWorkoutDescription, DESTINATIONS_MONTRE, metriquesMixtesSupportees } from "../src/lib/watch/intervals";

const MARQUES = [...DESTINATIONS_MONTRE.map((d) => d.nom), "Polar", "Strava", "inconnue", null];

/** Séances hostiles : valeurs manquantes, extrêmes, contradictoires, absurdes. */
const SEANCES: { nom: string; title: string; detail: string; type: string; vma: number | null }[] = [
  { nom: "VMA normale", title: "VMA courte", detail: "VMA courte : 10×400 m à ~3'40/km, récup 45 s", type: "VMA", vma: 17 },
  { nom: "Seuil normal", title: "Seuil", detail: "3×8 min à 4'10/km, récup 2 min", type: "Seuil", vma: 17 },
  { nom: "Côtes (FC partout)", title: "Côtes", detail: "8×45 s en côte, récup descente", type: "Côtes", vma: 17 },
  { nom: "Endurance", title: "Sortie longue", detail: "Sortie longue 16 km en endurance", type: "Endurance", vma: 17 },
  { nom: "Allure marathon", title: "Allure marathon", detail: "2×20 min à 4'35/km", type: "Allure marathon", vma: 16 },
  { nom: "Fractionné long", title: "VMA longue", detail: "5×1000 m à 3'50/km, récup 2'30", type: "VMA", vma: 18 },
  // ── Les hostiles ──
  { nom: "SANS VMA", title: "Seuil", detail: "3×8 min à 4'10/km, récup 2 min", type: "Seuil", vma: null },
  { nom: "VMA nulle", title: "VMA", detail: "10×400 m", type: "VMA", vma: 0 },
  { nom: "VMA négative", title: "VMA", detail: "10×400 m", type: "VMA", vma: -5 },
  { nom: "VMA absurde (60)", title: "VMA", detail: "10×400 m à 1'00/km", type: "VMA", vma: 60 },
  { nom: "détail vide", title: "Endurance", detail: "", type: "Endurance", vma: 15 },
  { nom: "titre ET détail vides", title: "", detail: "", type: "Endurance", vma: 15 },
  { nom: "aucune allure citée", title: "Seuil", detail: "3×8 min, récup 2 min", type: "Seuil", vma: 16 },
  { nom: "100 répétitions", title: "VMA", detail: "100×200 m à 3'20/km, récup 30 s", type: "VMA", vma: 19 },
  { nom: "récup plus longue que l'effort", title: "VMA", detail: "6×30 s à 3'10/km, récup 10 min", type: "VMA", vma: 18 },
  { nom: "type inconnu", title: "Yoga", detail: "45 min de mobilité", type: "Mobilité", vma: 15 },
  { nom: "vélo (cross-training)", title: "Vélo home-trainer", detail: "60 min à 70 % FTP", type: "Vélo", vma: 15 },
  { nom: "durée absurde (600 min)", title: "Sortie longue", detail: "600 min en endurance", type: "Endurance", vma: 14 },
  { nom: "texte unicode hostile", title: "🏃‍♂️ VMA — « spéciale »", detail: "10×400 m à 3'40/km — récup 45 s ⚡", type: "VMA", vma: 17 },
  { nom: "allure malformée", title: "Seuil", detail: "3×8 min à 99'99/km", type: "Seuil", vma: 16 },
];

/** La métrique d'une étape : `pace`, `HR`, ou `null` si elle n'a AUCUNE cible. */
function metriqueDe(ligne: string): "pace" | "HR" | null {
  if (/\bpace\b/.test(ligne)) return "pace";
  if (/\bHR\b/.test(ligne)) return "HR";
  return null;
}

let ko = 0;
let verifiees = 0;

for (const marque of MARQUES) {
  const etiquette = marque ?? "(non détectée)";
  const mixteAutorise = metriquesMixtesSupportees(marque);
  const soucis: string[] = [];

  for (const s of SEANCES) {
    let b: ReturnType<typeof buildWorkoutDescription>;
    try {
      b = buildWorkoutDescription(s.title, s.detail, s.type, "Marathon de Lille", s.vma, 15, 10, marque);
    } catch (e) {
      soucis.push(`${s.nom} → EXCEPTION : ${(e as Error).message.slice(0, 80)}`);
      continue;
    }
    // Rendre `null` est une réponse LÉGITIME (rien de prescriptible) : on ne fabrique pas
    // une séance pour faire joli. Ce qui compte, c'est ce qui sort quand ça sort.
    if (!b) continue;
    verifiees++;

    if (!b.name.trim()) soucis.push(`${s.nom} → séance sans nom`);
    if (b.name.length > 90) soucis.push(`${s.nom} → nom de ${b.name.length} caractères (montre : 90 max)`);
    if (b.sport !== "Run" && b.sport !== "Ride") soucis.push(`${s.nom} → sport « ${b.sport} » inconnu de la montre`);

    const etapes = b.description.split("\n").filter((l) => l.startsWith("- "));
    if (!etapes.length) { soucis.push(`${s.nom} → séance sans aucune étape`); continue; }

    const metriques = new Set<string>();
    for (const l of etapes) {
      const m = l.match(/^- (\d+)([ms]) /);
      if (!m) { soucis.push(`${s.nom} → étape illisible par la montre : « ${l.slice(0, 46)} »`); continue; }
      const sec = Number(m[1]) * (m[2] === "m" ? 60 : 1);
      if (sec <= 0) soucis.push(`${s.nom} → étape de durée nulle`);
      if (sec > 5 * 3600) soucis.push(`${s.nom} → étape de plus de 5 h (${Math.round(sec / 60)} min)`);

      const met = metriqueDe(l);
      // ⚠️ LE CŒUR. Une étape sans cible arrive au poignet comme un simple minuteur :
      // le coureur voit « 8 min » et doit deviner à quelle intensité.
      if (!met) soucis.push(`${s.nom} → étape SANS CIBLE : « ${l.slice(0, 46)} »`);
      else metriques.add(met);
    }

    // ⚠️ L'INVARIANT PAR MARQUE. Seule Garmin sait lire deux métriques dans une séance.
    // Partout ailleurs, les blocs portant la métrique secondaire perdent leur cible en
    // silence à l'export intervals.icu.
    //
    // ⚠️ `montre === null` NE FAIT PLUS EXCEPTION. Le repli était « traiter l'inconnu
    // comme une Garmin » ; il laissait un porteur de Coros recevoir, le jour d'une panne
    // de détection, une séance aux blocs sans cible. Basculé en tout-allure le
    // 21/08/2026 : moins fin sur Garmin, jamais vide nulle part.
    if (!mixteAutorise && metriques.size > 1) {
      soucis.push(`${s.nom} → ${[...metriques].join(" + ")} dans la MÊME séance : ${etiquette} n'en lit qu'une`);
    }
  }

  if (soucis.length) {
    ko++;
    console.log(`  ✗ ${etiquette}\n      ${[...new Set(soucis)].slice(0, 4).join("\n      ")}`);
  } else {
    // L'étiquette doit dire le comportement RÉEL, pas la valeur d'un drapeau : sur montre
    // non détectée, `metriquesMixtesSupportees` rend `false` alors que la construction
    // garde le mode Garmin. Afficher « tout-allure » ici serait faux.
    const mode = marque === null
      ? "repli tout-allure (détection impossible)"
      : mixteAutorise ? "métriques mixtes autorisées" : "tout-allure ou tout-FC";
    console.log(`  ✓ ${etiquette} — ${mode}`);
  }
}

console.log(`\n${MARQUES.length} marques × ${SEANCES.length} séances · ${verifiees} séances construites · ${ko} marque(s) en défaut`);
process.exit(ko ? 1 : 0);
