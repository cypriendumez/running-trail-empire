/**
 * CRASH-TESTS DE L'ANALYSE D'UNE SÉANCE — du débutant à l'élite, de Starter à Premium.
 *
 * Cyprien, 31/10/2026 : « l'analyse des séances, c'est le plus important de mon application :
 * si ça ne fonctionne pas, mon application ne vaut rien ». Ces tests fabriquent, SANS modèle,
 * la consigne réellement envoyée à l'IA pour chaque niveau d'athlète, chaque type de séance,
 * chaque formule et chaque langue, puis vérifient ce qu'elle contient :
 *  · aucun « NaN », « undefined », « Infinity », clé technique ou objet brut ;
 *  · Starter ne reçoit AUCUNE dimension réservée à Premium, Premium les reçoit toutes ;
 *  · une séance ininterprétable est déclarée telle ;
 *  · les chiffres restent physiologiquement plausibles ;
 *  · des données corrompues (montre, intervals.icu, base) ne font rien planter.
 *
 *   npx tsx tests/analyse-seance.crash.test.ts
 */
import assert from "node:assert/strict";
import { faitsDeSeance, type SeanceBrute, type ContexteSeance } from "../src/lib/ai/analyseSeance";
import { inviteAnalyse } from "../src/lib/ai/inviteAnalyse";
import type { IntervalleIcu, FluxSeance } from "../src/lib/intervals/performance";
import { peut } from "../src/lib/billing/access";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
const v = (secParKm: number) => 1000 / secParKm;
const pace = (sec: number) => `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;

/** Les quatre niveaux : FC max, allure facile, allure de seuil, allure de VMA (s/km). */
const NIVEAUX = {
  debutant: { fcMax: 196, facile: 500, seuil: 400, vma: 360, fcFacile: 160, fcSeuil: 178, fcVma: 188 },
  intermediaire: { fcMax: 192, facile: 390, seuil: 300, vma: 267, fcFacile: 145, fcSeuil: 170, fcVma: 182 },
  confirme: { fcMax: 188, facile: 320, seuil: 245, vma: 212, fcFacile: 138, fcSeuil: 165, fcVma: 178 },
  elite: { fcMax: 194, facile: 255, seuil: 195, vma: 167, fcFacile: 135, fcSeuil: 170, fcVma: 185 },
} as const;
type Niveau = keyof typeof NIVEAUX;

type Cas = {
  nom: string; seance: SeanceBrute; prevu: { type: string; titre: string; detail: string } | null;
  liste: IntervalleIcu[]; flux?: FluxSeance; attendu: RegExp[]; ininterpretable?: boolean;
};

/** Un parcours de trail : plat, montée de `dplus` m, descente, plat (± 2 m de bruit GPS). */
function fluxTrail(dplus: number, vitPlat: number): FluxSeance {
  const temps: number[] = [], distance: number[] = [], altitude: number[] = [], fc: number[] = [];
  let t = 0;
  for (let d = 0; d <= 12000; d += 10) {
    const montee = d >= 2000 && d < 5000, descente = d >= 5000 && d < 8000;
    const alt = montee ? 200 + (d - 2000) * dplus / 3000 : descente ? 200 + dplus - (d - 5000) * dplus / 3000 : d < 2000 ? 200 : 200;
    const vit = montee ? vitPlat * 0.45 : descente ? vitPlat * 1.05 : vitPlat;
    temps.push(Math.round(t)); distance.push(d); altitude.push(alt + (d % 20 === 0 ? 2 : -2)); fc.push(montee ? 170 : 150);
    t += 10 / vit;
  }
  return { temps, distance, altitude, fc };
}

function casDe(niv: Niveau): Cas[] {
  const n = NIVEAUX[niv];
  const date = "2026-10-20";
  const base = { id: `w-${niv}`, date, sport: "run", elevation_gain_m: 40, external_id: "i1" };
  const footingMin = niv === "debutant" ? 35 : niv === "elite" ? 70 : 50;
  const km = (min: number, s: number) => Math.round((min * 60 / s) * 100) / 100;
  return [
    {
      nom: "footing", attendu: [/Zone visée Z2/, /Écart à la séance prévue/],
      seance: { ...base, distance_km: km(footingMin, n.facile), duration_seconds: footingMin * 60, avg_pace_min_km: n.facile / 60, avg_hr: n.fcFacile, max_hr: n.fcFacile + 15, hr_zone_seconds: [300, footingMin * 60 - 600, 300, 0, 0] },
      prevu: { type: "Endurance", titre: "Footing en endurance", detail: `Échauffement 10 min progressif FC Z1→Z2 → Corps : ${footingMin - 15} min en Z2 à ~${pace(n.facile)}/km, tu dois pouvoir tenir une conversation → Retour au calme 5 min FC Z1.` },
      liste: [],
    },
    {
      nom: "sortie longue", attendu: [/Zone visée Z2/],
      seance: { ...base, distance_km: km(100, n.facile + 10), duration_seconds: 6000, avg_pace_min_km: (n.facile + 10) / 60, avg_hr: n.fcFacile + 5, max_hr: n.fcFacile + 20, hr_zone_seconds: [600, 4800, 600, 0, 0], cardiac_decoupling: 4.2 },
      prevu: { type: "Sortie longue", titre: "Sortie longue", detail: `Échauffement 15 min progressif FC Z1→Z2 → Corps : ~${Math.round(km(70, n.facile))} km en Z2 (~${pace(n.facile)}/km), allure conversationnelle du début à la fin → Retour au calme 10 min FC Z1.` },
      liste: [],
    },
    {
      nom: "fractionné", attendu: [/Répétitions relevées par la montre : 8/, /8 répétitions prévues/],
      seance: { ...base, distance_km: 8, duration_seconds: 2700, avg_pace_min_km: n.facile / 60, avg_hr: n.fcSeuil, max_hr: n.fcVma + 4, hr_zone_seconds: [900, 600, 300, 300, 600] },
      prevu: { type: "VMA", titre: "8×400 m", detail: `Échauffement 20 min → Corps : 8×400 m à ${pace(n.vma)}/km, récup 1 min 30 trottinée → Retour au calme 10 min.` },
      liste: [
        { zone: 2, average_speed: v(n.facile), moving_time: 1200, average_heartrate: n.fcFacile },
        ...Array.from({ length: 8 }, (_, i) => [
          { zone: 5, average_speed: v(n.vma + i), moving_time: Math.round(0.4 * (n.vma + i)), distance: 400, average_heartrate: n.fcVma },
          { zone: 2, average_speed: v(n.facile + 60), moving_time: 90, average_heartrate: n.fcFacile },
        ]).flat(),
      ],
    },
    {
      nom: "seuil", attendu: [/corps de séance \(20 min/],
      seance: { ...base, distance_km: 9, duration_seconds: 3000, avg_pace_min_km: (n.seuil + 40) / 60, avg_hr: n.fcSeuil - 10, max_hr: n.fcSeuil + 5, hr_zone_seconds: [900, 600, 300, 1200, 0] },
      prevu: { type: "Seuil", titre: "Séance au seuil", detail: `Échauffement 20 min → Corps : 20 min à ${pace(n.seuil)}/km → Retour au calme 10 min FC Z1.` },
      liste: [
        { zone: 2, average_speed: v(n.facile), moving_time: 1200 },
        ...Array.from({ length: 5 }, () => ({ zone: 4, average_speed: v(n.seuil + 2), moving_time: 240, average_heartrate: n.fcSeuil })),
        { zone: 1, average_speed: v(n.facile + 30), moving_time: 600 },
      ],
    },
    {
      nom: "trail", attendu: [/En montée/, /En descente/],
      seance: { ...base, distance_km: 12, duration_seconds: Math.round(12000 / v(n.facile) * 1.2), avg_pace_min_km: n.facile * 1.2 / 60, avg_hr: n.fcFacile + 10, max_hr: n.fcSeuil, elevation_gain_m: 420, hr_zone_seconds: [600, 2400, 900, 300, 0] },
      prevu: { type: "Trail", titre: "Sortie trail", detail: "Corps : 12 km de trail en Z2, à l'effort." },
      liste: [], flux: fluxTrail(400, v(n.facile)),
    },
    {
      nom: "sans cardio", attendu: [],
      seance: { ...base, distance_km: 8, duration_seconds: Math.round(8 * n.facile), avg_pace_min_km: n.facile / 60, avg_hr: null, max_hr: null, hr_zone_seconds: null },
      prevu: null, liste: [],
    },
    {
      nom: "séance vide", attendu: [], ininterpretable: true,
      seance: { ...base, distance_km: null, duration_seconds: null, avg_hr: null, max_hr: null },
      prevu: null, liste: [],
    },
    {
      nom: "montre au repos", attendu: [], ininterpretable: true,
      seance: { ...base, distance_km: 0.01, duration_seconds: 900, avg_hr: 64, max_hr: 66 },
      prevu: null, liste: [],
    },
    {
      nom: "vélo", attendu: [],
      seance: { ...base, sport: "bike", distance_km: 30, duration_seconds: 3600, avg_pace_min_km: 2, avg_hr: n.fcFacile, max_hr: n.fcSeuil, elevation_gain_m: 250 },
      prevu: null, liste: [],
    },
    {
      nom: "marche", attendu: [],
      seance: { ...base, sport: "walk", distance_km: 5, duration_seconds: 3300, avg_pace_min_km: 11, avg_hr: 118, max_hr: 130 },
      prevu: null, liste: [],
    },
  ];
}

const CONTEXTE: ContexteSeance = { ressenti: { rpe: 6 }, nuit: { score: 74, minutes: 432 }, vfc: { matin: 63, base: 68 }, forme: { tsb: -6, ctl: 48, atl: 54 } };
const comparables = (niv: Niveau): SeanceBrute[] => Array.from({ length: 6 }, (_, i) => ({
  date: `2026-10-${String(1 + i * 2).padStart(2, "0")}`, sport: "run", distance_km: 8 + (i % 2), duration_seconds: Math.round((8 + (i % 2)) * NIVEAUX[niv].facile * 1.01),
  avg_pace_min_km: NIVEAUX[niv].facile / 60, avg_hr: NIVEAUX[niv].fcFacile + 1, max_hr: NIVEAUX[niv].fcFacile + 15,
}));

/** Ce qu'une consigne ne doit JAMAIS contenir. */
const INTERDITS: [RegExp, string][] = [
  [/NaN/, "NaN"], [/undefined/, "undefined"], [/Infinity/, "Infinity"], [/\bnull\b/, "null"], [/\[object /, "objet brut"],
  [/— (run|bike|walk|hike|swim|row|ski|other)\b/, "clé technique de sport"],
];
/** Les lignes réservées à l'analyse complète. */
const PREMIUM_SEUL = [/Temps en zones/, /Cadence/, /Foulée/, /Dérive cardiaque/, /Température/, /Parmi ses séances/, /Zone visée/,
  /Répétitions relevées/, /Écart à la séance prévue/, /Ressenti déclaré/, /Nuit précédente/, /VFC du matin/, /Fraîcheur la veille/,
  /Progression :/, /En montée/, /En descente/];

console.log("\nLA MATRICE — 4 niveaux × 10 séances × 3 formules × 5 langues");

for (const niv of Object.keys(NIVEAUX) as Niveau[]) {
  test(`${niv} : chaque séance, chaque formule, chaque langue — une consigne propre`, () => {
    for (const c of casDe(niv)) {
      for (const formule of ["starter", "premium", "essai"] as const) {
        const complet = peut(formule, "analyse_complete");
        const faits = complet
          ? faitsDeSeance({ ...c.seance, temp: undefined } as SeanceBrute, { fcMax: NIVEAUX[niv].fcMax }, comparables(niv), c.prevu, { liste: c.liste }, CONTEXTE, c.flux)
          : faitsDeSeance(c.seance, { fcMax: NIVEAUX[niv].fcMax }, comparables(niv), c.prevu);
        for (const lang of LANGUES) {
          const invite = inviteAnalyse(faits, lang, complet);
          const ou = `${niv} / ${c.nom} / ${formule} / ${lang}`;
          for (const [motif, quoi] of INTERDITS) assert.ok(!motif.test(invite), `${ou} : « ${quoi} » dans la consigne\n${invite.split("\n").find((l) => motif.test(l))}`);
          assert.ok(invite.length < 6000, `${ou} : consigne démesurée (${invite.length} caractères)`);
          if (!complet) for (const m of PREMIUM_SEUL) assert.ok(!m.test(invite), `${ou} : Starter reçoit « ${m.source} »`);
          if (complet) for (const m of c.attendu) assert.ok(m.test(invite), `${ou} : il manque « ${m.source} »`);
          if (complet && !c.ininterpretable && faits.exploitable) assert.match(invite, /VFC du matin : 63 ms/, `${ou} : le contexte du jour manque`);
          assert.equal(/N'EST PAS INTERPRÉTABLE/.test(invite), !!c.ininterpretable, `${ou} : interprétabilité mal jugée`);
        }
      }
    }
  });
}

console.log("\nLES CHIFFRES — plausibles à tous les niveaux");

test("l'allure n'est donnée qu'aux sports qui se mesurent au kilomètre", () => {
  const velo = faitsDeSeance(casDe("confirme").find((c) => c.nom === "vélo")!.seance, { fcMax: 188 });
  const invite = inviteAnalyse(velo, "fr", true);
  assert.ok(!/Allure \d'\d{2}\/km/.test(invite), "une sortie vélo décrite en minutes par kilomètre");
  assert.match(invite, /Vitesse moyenne 30 km\/h/, "la vitesse d'une sortie vélo n'est pas donnée");
});

test("l'intensité suit la FC de CHAQUE athlète : le footing de l'élite est facile, ses répétitions dures", () => {
  for (const niv of ["confirme", "elite"] as const) {
    const cas = casDe(niv);
    const footing = faitsDeSeance(cas[0].seance, { fcMax: NIVEAUX[niv].fcMax });
    assert.equal(footing.intensite, "facile", `${niv} : footing mal classé`);
    const vma = faitsDeSeance(cas[2].seance, { fcMax: NIVEAUX[niv].fcMax }, [], cas[2].prevu, { liste: cas[2].liste });
    assert.ok(vma.repetitions && vma.repetitions.allures.every((a) => a < NIVEAUX[niv].seuil), `${niv} : répétitions mal relevées`);
  }
});

console.log("\nLES DONNÉES CORROMPUES — rien ne plante, rien d'inventé");

test("montre, intervals.icu et base qui envoient n'importe quoi", () => {
  const n = NIVEAUX.intermediaire;
  const seance: SeanceBrute = {
    id: "x", date: "2026-10-20", sport: "run", distance_km: Number.NaN, duration_seconds: -60, avg_pace_min_km: Number.POSITIVE_INFINITY,
    avg_hr: Number.NaN, max_hr: -1, elevation_gain_m: Number.NaN, hr_zone_seconds: { z1: "abc", z2: -5, z3: null } as unknown,
    avg_cadence_spm: 0, weather_temp_c: Number.NaN, cardiac_decoupling: Number.NaN, external_id: null,
  };
  const liste = [{ zone: 5, average_speed: 0, moving_time: -10 }, { zone: Number.NaN, average_speed: Number.NaN }, {} as IntervalleIcu];
  const flux: FluxSeance = { temps: [0, Number.NaN, 2], distance: [0, 10], altitude: [Number.NaN, 5, 6], fc: [null as unknown as number] };
  const contexte: ContexteSeance = { ressenti: { rpe: 7 }, nuit: { score: null, minutes: null }, vfc: { matin: 50, base: 0 }, forme: { tsb: Number.NaN, ctl: Number.NaN, atl: Number.NaN } };
  const comparablesFous = [{ date: "pas une date", distance_km: "10" as unknown as number, avg_hr: Number.NaN } as SeanceBrute];
  const prevu = { type: "VMA", titre: "?", detail: "Corps : 99×9999 m à 1'05/km, récup ∞" };
  for (const lang of LANGUES) {
    const faits = faitsDeSeance(seance, { fcMax: n.fcMax }, comparablesFous, prevu, { liste }, contexte, flux);
    const invite = inviteAnalyse(faits, lang, true);
    for (const [motif, quoi] of INTERDITS) assert.ok(!motif.test(invite), `${lang} : « ${quoi} » dans la consigne\n${invite.split("\n").find((l) => motif.test(l))}`);
  }
});

test("chaque formule : le gratuit n'a pas l'analyse, Starter l'essentielle, Premium et l'essai la complète", () => {
  assert.ok(!peut("gratuit", "ia"), "le gratuit appelle le modèle");
  assert.ok(peut("starter", "ia") && !peut("starter", "analyse_complete"));
  assert.ok(peut("premium", "analyse_complete") && peut("essai", "analyse_complete"));
});

console.log(`\n${passed} crash-test(s) d'analyse passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f.split("\n")[0]); process.exit(1); }
