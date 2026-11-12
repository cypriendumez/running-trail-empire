/**
 * CRASH-TEST AU HASARD — FC MAX, CIBLES FC ENVOYÉES À LA MONTRE, TEMPÉRATURE DE L'AIR (07/11/2026).
 *
 * Des milliers d'athlètes tirés au hasard (FC max mesurée, déclarée, d'âge ou absente ; repos ;
 * seuil ; footings ; pics de saison ; prévisions météo ; séances) et autant de valeurs « sales »
 * (null, 0, négatifs, NaN, chaînes, valeurs absurdes). Ce qui est interdit :
 *  · une cible hors du domaine physiologique, inversée, plus large que 12 bpm, ou NaN ;
 *  · une récupération au-dessus de l'endurance ;
 *  · une FC max de saison au-dessus de la référence, ou qui sort de nulle part ;
 *  · une étape envoyée à la montre en battements bruts (« bpm », ignorés par intervals.icu),
 *    un % HR hors 30-100, ou une étape sans cible là où l'athlète a des cibles ;
 *  · une température tirée d'autre chose que la réponse d'Open-Meteo.
 *
 *   npx tsx tests/fc-temperature.fuzz.test.ts         (FUZZ_TOURS=20000 pour creuser)
 */
import assert from "node:assert/strict";
import {
  referencesFc, ciblesFcAthlete, footingTropIntense, plageEnPctMax, avecFcMaxMontre, maxDeReference,
  fcMaxSaison, airFroid, plageFc, BAISSE_HIVER_BPM, LARGEUR_MAX,
} from "../src/lib/coach/fcCible";
import { avecSaison } from "../src/lib/coach/ciblesFcServeur";
import { stepsForType, parseReps } from "../src/lib/watch/intervals";
import { heureMilieu, temperaturesAir, enInterieur } from "../src/lib/weather/temperatureSeances";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

let graine = Number(process.env.FUZZ_GRAINE) || 20261107;
const alea = () => { graine |= 0; graine = (graine + 0x6d2b79f5) | 0; let t = Math.imul(graine ^ (graine >>> 15), 1 | graine); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a: number, b: number) => Math.floor(a + alea() * (b - a + 1));
const un = <T,>(xs: readonly T[]): T => xs[Math.floor(alea() * xs.length)];
const peut = (p = 0.5) => alea() < p;
const SALE: unknown[] = [null, undefined, 0, -1, -200, 1e9, Number.NaN, Number.POSITIVE_INFINITY, "", "abc", "190", 0.5, 300];
const nb = (lo: number, hi: number): unknown => (peut(0.8) ? lo + alea() * (hi - lo) : un(SALE));
const TOURS = Number(process.env.FUZZ_TOURS) || 3000;

/** Un athlète au hasard : de l'élite au débutant, données complètes ou trouées. */
function athlete() {
  const max = nb(170, 215), repos = nb(38, 75), seuil = peut(0.3) ? nb(150, 200) : null;
  const refs = referencesFc({
    maxDeclaree: peut(0.3) ? max : null, maxObservee: peut(0.7) ? nb(140, 220) : null,
    repos: peut(0.7) ? repos : null, seuil,
  });
  const footings = Array.from({ length: entre(0, 30) }, () => nb(110, 185) as number);
  return { refs, footings };
}
const domaine = (p: { lo: number; hi: number } | null, refs: { max: number | null; repos: number | null }) => {
  if (!p) return;
  for (const v of [p.lo, p.hi]) assert.ok(Number.isInteger(v), `borne non entière ${v}`);
  assert.ok(p.lo < p.hi, `plage inversée ${p.lo}-${p.hi}`);
  assert.ok(p.hi - p.lo <= LARGEUR_MAX, `plage de ${p.hi - p.lo} bpm`);
  assert.ok(p.lo >= 90 || (refs.repos != null && p.lo >= refs.repos + 10), `plancher ${p.lo}`);
  if (refs.max != null) assert.ok(p.hi <= refs.max, `${p.hi} au-dessus de la FC max ${refs.max}`);
};

(async () => {
  console.log(`\nCRASH-TEST AU HASARD — ${TOURS} tours par calcul, graine ${graine}\n`);

  await test("cibles : toujours dans le domaine de l'athlète, récup sous l'endurance, rien sans mesure", () => {
    for (let k = 0; k < TOURS; k++) {
      const { refs, footings } = athlete();
      const c = ciblesFcAthlete(refs, footings);
      if (refs.source !== "mesures" && refs.source !== "seuil") { assert.equal(c, null, `tour ${k} : des cibles sans mesure (${refs.source})`); continue; }
      if (!c) continue;
      domaine(c.endurance, refs); domaine(c.recup, refs);
      assert.ok(c.recup.hi <= c.endurance.lo, `tour ${k} : récup ${c.recup.hi} au-dessus de l'endurance ${c.endurance.lo}`);
      assert.ok(Number.isFinite(c.plafondFooting) && c.plafondFooting > c.endurance.hi, `tour ${k} : plafond ${c.plafondFooting} sous l'endurance ${c.endurance.hi}`);
      const th = plageFc("endurance", refs)!;
      assert.ok(c.endurance.hi <= th.hi, `tour ${k} : la cible d'endurance a monté au-dessus de la théorie`);
    }
  });

  await test("footing trop intense : booléen, jamais vrai sans cibles, sans durée ou sous le plafond", () => {
    for (let k = 0; k < TOURS; k++) {
      const { refs, footings } = athlete();
      const c = ciblesFcAthlete(refs, footings);
      const fc = nb(100, 210), sec = nb(300, 10000);
      const r = footingTropIntense(fc, sec, c);
      assert.equal(typeof r, "boolean");
      if (r) {
        assert.ok(c != null && Number(fc) >= c.plafondFooting && Number(sec) >= 1200, `tour ${k} : dur à tort (${fc} bpm, ${sec} s, plafond ${c?.plafondFooting})`);
      }
    }
  });

  await test("FC max de référence et de saison : jamais au-dessus de la référence, jamais inventée", () => {
    for (let k = 0; k < TOURS; k++) {
      const ref = nb(150, 220) as number | null;
      const recent = nb(140, 220), anDernier = peut(0.6) ? nb(140, 220) : null, froid = peut();
      const s = fcMaxSaison(ref, recent, anDernier, froid);
      // Même lecture que le code : un nombre écrit en texte (« 190 ») reste un nombre.
      const refN = ref == null || (ref as unknown) === "" ? Number.NaN : Number(ref);
      const refOk = Number.isFinite(refN) && refN > 150 && refN < 240 ? refN : null;
      if (refOk == null) { assert.equal(s, null, `tour ${k} : une FC max de saison sans référence (${ref} → ${s})`); continue; }
      assert.ok(s != null && Number.isFinite(s) && s <= refOk, `tour ${k} : ${s} au-dessus de la référence ${refOk}`);
      const anN = anDernier == null || (anDernier as unknown) === "" ? Number.NaN : Number(anDernier);
      assert.ok(s >= refOk - BAISSE_HIVER_BPM || (Number.isFinite(anN) && anN > 150 && anN < 240), `tour ${k} : ${s} — une baisse de plus de 5 bpm sans hiver enregistré`);
      const m = maxDeReference(nb(150, 230), nb(150, 230));
      assert.ok(m === null || (m > 100 && m < 240), `tour ${k} : FC max de référence ${m}`);
      const refs = referencesFc({ maxDeclaree: ref, maxObservee: recent });
      const a = avecSaison(refs, peut() ? { recent: recent as number, anDernier: anDernier as number } : null, froid);
      assert.ok(a.max == null || refs.max == null || a.max <= refs.max, `tour ${k} : la saison a monté la FC max`);
      if (refs.source !== "mesures") assert.equal(a.max, refs.max, `tour ${k} : une estimation (${refs.source}) recalée sur la saison`);
    }
  });

  await test("air froid : booléen, faux sans au moins trois jours lisibles", () => {
    for (let k = 0; k < TOURS; k++) {
      const jours = Array.from({ length: entre(0, 10) }, () => ({ tempMin: nb(-20, 25), tempMax: nb(-15, 40) }));
      const r = airFroid(peut(0.05) ? null : jours);
      assert.equal(typeof r, "boolean");
      const lisibles = jours.filter((j) => typeof j.tempMin === "number" && typeof j.tempMax === "number" && Number.isFinite(j.tempMin) && Number.isFinite(j.tempMax));
      if (lisibles.length < 3) assert.equal(r, false, `tour ${k} : froid sur ${lisibles.length} jour(s)`);
    }
  });

  await test("la montre ne reçoit que des % HR lisibles par intervals.icu, jamais de bpm bruts ni d'étape vide", () => {
    const TYPES = ["Endurance", "Sortie longue", "Récup", "Seuil", "VMA", "Allure spécifique", "Côtes", "Vélo endurance", "Footing progressif", "?"];
    for (let k = 0; k < TOURS; k++) {
      const { refs, footings } = athlete();
      const maxMontre = un([null, 0, 150, 190, 205, 212, 230, Number.NaN] as (number | null)[]);
      const cibles = avecFcMaxMontre(ciblesFcAthlete(refs, footings), maxMontre);
      const type = un(TYPES);
      const reps = peut(0.3) ? parseReps(un(["6×1000 m à 3'20/km, récup 2 min", "10×400 m à ~3'05/km, récup 45 s", "3×10 min à 3'45/km, récup 2 min"]), null) : null;
      const s = stepsForType(type, entre(10, 200), peut() ? 12 + alea() * 10 : null, peut() ? entre(180, 420) : null, entre(5, 30), entre(5, 30), reps, "", peut(0.3), cibles) ?? "";
      assert.doesNotMatch(s, /\dbpm/, `tour ${k} : des battements bruts, qu'intervals.icu ignore`);
      assert.doesNotMatch(s, /NaN|undefined|Infinity|null/, `tour ${k} : ${s}`);
      for (const m of s.matchAll(/(\d+(?:\.\d)?)-(\d+(?:\.\d)?)% HR/g)) {
        const a = Number(m[1]), b = Number(m[2]);
        assert.ok(a > 30 && b <= 100 && a < b, `tour ${k} : ${m[0]} (FC max montre ${maxMontre})`);
      }
      for (const ligne of s.split("\n").filter((l) => l.startsWith("- "))) {
        assert.match(ligne, /pace|HR/, `tour ${k} : étape sans cible « ${ligne} »`);
      }
      if (s.includes("% HR")) assert.ok(cibles?.maxMontre, `tour ${k} : % HR sans FC max de la montre`);
    }
  });

  await test("% HR : conversion exacte au dixième, toujours dans 30-100 pour une plage du domaine", () => {
    for (let k = 0; k < TOURS; k++) {
      const max = entre(160, 225), lo = entre(95, max - 12), hi = Math.min(max, lo + entre(4, 12));
      const t = plageEnPctMax({ lo, hi }, max);
      const m = t.match(/^(\d+(?:\.\d)?)-(\d+(?:\.\d)?)% HR$/);
      assert.ok(m, `tour ${k} : ${t}`);
      assert.ok(Math.abs(Number(m![1]) * max / 100 - lo) <= 0.2 && Math.abs(Number(m![2]) * max / 100 - hi) <= 0.2, `tour ${k} : ${t} pour ${lo}-${hi} / ${max}`);
    }
  });

  await test("heure du milieu : toujours « AAAA-MM-JJTHH:00 » valide, ou rien", () => {
    for (let k = 0; k < TOURS * 2; k++) {
      const brut = peut(0.8)
        ? `2026-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}T${String(entre(0, 23)).padStart(2, "0")}:${String(entre(0, 59)).padStart(2, "0")}:00`
        : un(["", "pas une date", "2026-13-40T99:99", "2026-01-01", null as unknown as string]);
      const h = heureMilieu(brut, nb(0, 30000) as number);
      if (h != null) {
        assert.match(h, /^\d{4}-\d{2}-\d{2}T\d{2}:00$/, `tour ${k} : ${brut} → ${h}`);
        assert.ok(!Number.isNaN(Date.parse(`${h}:00Z`)), `tour ${k} : ${h} n'est pas une heure`);
      }
    }
  });

  await test("température de l'air : seulement ce qu'Open-Meteo rend, à la bonne heure, jamais inventée", async () => {
    const fetchReel = globalThis.fetch;
    try {
      for (let k = 0; k < Math.min(600, TOURS); k++) {
        const panne = peut(0.15);
        const heures: Record<string, unknown> = {};
        const seances = Array.from({ length: entre(0, 8) }, (_, i) => {
          const debut = `2026-${String(entre(1, 11)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}T${String(entre(5, 21)).padStart(2, "0")}:${String(entre(0, 59)).padStart(2, "0")}:00`;
          const d = entre(600, 9000);
          const h = heureMilieu(debut, d)!;
          if (peut(0.85)) heures[h] = peut(0.9) ? Math.round((-15 + alea() * 50) * 10) / 10 : un([null, "x", 999, Number.NaN]);
          return { cle: `s${i}`, lat: peut(0.95) ? 43 + alea() * 8 : un([999, Number.NaN, -200]), lon: peut(0.95) ? -1 + alea() * 9 : 400, debutLocal: debut, dureeSec: d };
        });
        globalThis.fetch = (async () => {
          if (panne) throw new Error("hors ligne");
          return new Response(JSON.stringify({ hourly: { time: Object.keys(heures), temperature_2m: Object.values(heures) } }), { status: 200 });
        }) as typeof fetch;
        const t = await temperaturesAir(seances, Date.parse("2026-11-06T12:00:00Z"));
        for (const [cle, v] of t) {
          const s = seances.find((x) => x.cle === cle)!;
          const attendue = heures[heureMilieu(s.debutLocal, s.dureeSec)!];
          assert.ok(!panne, `tour ${k} : une température malgré la panne`);
          assert.ok(typeof attendue === "number" && Number.isFinite(attendue) && attendue > -60 && attendue < 60, `tour ${k} : ${v} °C sorti de nulle part`);
          // Tolérance : JSON écrit −0 « 0 », et une égalité stricte les distingue.
          assert.ok(Math.abs(v - Math.round((attendue as number) * 10) / 10) < 1e-9, `tour ${k} : mauvaise heure (${v} contre ${attendue})`);
          assert.ok(Number.isFinite(s.lat) && Math.abs(s.lat) <= 90 && Number.isFinite(s.lon) && Math.abs(s.lon) <= 180, `tour ${k} : position absurde acceptée`);
        }
      }
    } finally { globalThis.fetch = fetchReel; }
  });

  await test("intérieur : tapis et virtuel exclus, plein air gardé, entrée sale sans plantage", () => {
    for (let k = 0; k < TOURS; k++) {
      const t = un(["Run", "TrailRun", "VirtualRun", "Treadmill", "IndoorCycling", "Ride", "VirtualRide", "", null, 42, "Walk"]);
      const r = enInterieur(t);
      assert.equal(typeof r, "boolean");
    }
    assert.equal(enInterieur("VirtualRun"), true);
    assert.equal(enInterieur("TrailRun"), false);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f.slice(0, 600)); process.exit(1); }
})();
