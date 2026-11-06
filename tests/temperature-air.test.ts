/**
 * LA VRAIE TEMPÉRATURE DE L'AIR, JAMAIS CELLE DE LA MONTRE (07/11/2026).
 *
 * Cyprien : « ne prends surtout pas la température Garmin ou Coros, elle est au moins 12 degrés
 * au-dessus ; prends la vraie météo de la personne à l'endroit où elle court ». Relevé sur son
 * compte : 11 à 21 °C le matin de séances de janvier à Lille, 15-16 °C de moyenne en hiver.
 *
 *   npx tsx tests/temperature-air.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { heureMilieu, temperaturesAir, enInterieur } from "../src/lib/weather/temperatureSeances";
import { buildWorkoutRow } from "../src/lib/intervals/workoutRow";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

(async () => {
  console.log("\nL'HEURE QUI COMPTE : LE MILIEU DE LA SÉANCE, EN HEURE LOCALE");

  await test("départ 08:12 + 46 min → 08:00 ; 07:40 + 1 h 40 → 08:00 ; sans durée → l'heure de départ", () => {
    assert.equal(heureMilieu("2026-01-20T08:12:33", 46 * 60), "2026-01-20T08:00");
    assert.equal(heureMilieu("2026-01-20T07:40:00", 100 * 60), "2026-01-20T08:00");
    assert.equal(heureMilieu("2026-01-20T23:50:00", 60 * 60), "2026-01-21T00:00", "une séance qui passe minuit");
    assert.equal(heureMilieu("2026-01-20T08:12:33", null), "2026-01-20T08:00");
    assert.equal(heureMilieu("pas une date", 600), null);
  });

  console.log("\nOPEN-METEO, À L'ENDROIT OÙ IL COURT");

  const MAINTENANT = Date.parse("2026-11-06T12:00:00Z");
  const appels: string[] = [];
  const reponse = (heures: Record<string, number>) => new Response(JSON.stringify({ hourly: { time: Object.keys(heures), temperature_2m: Object.values(heures) } }), { status: 200 });
  const fetchReel = globalThis.fetch;
  globalThis.fetch = (async (u: string) => {
    appels.push(String(u));
    if (String(u).includes("archive-api")) return reponse({ "2026-01-20T08:00": 2.4, "2026-01-19T11:00": 4.1 });
    return reponse({ "2026-11-05T18:00": 9.6 });
  }) as typeof fetch;

  await test("récent → prévisions (jours passés), ancien → archive ; une requête par lieu ; au dixième", async () => {
    appels.length = 0;
    const t = await temperaturesAir([
      { cle: "a", lat: 50.63, lon: 3.07, debutLocal: "2026-01-20T07:40:00", dureeSec: 6000 },
      { cle: "b", lat: 50.64, lon: 3.06, debutLocal: "2026-01-19T10:40:00", dureeSec: 3600 },
      { cle: "c", lat: 50.63, lon: 3.07, debutLocal: "2026-11-05T17:45:00", dureeSec: 1800 },
    ], MAINTENANT);
    assert.equal(t.get("a"), 2.4, "la séance du 20/01 à Lille : 2,4 °C, pas les 11 °C du capteur");
    assert.equal(t.get("b"), 4.1);
    assert.equal(t.get("c"), 9.6);
    assert.equal(appels.length, 2, `deux sources pour un même lieu, pas une requête par séance (${appels.length})`);
    assert.ok(appels.some((u) => u.includes("archive-api") && u.includes("start_date=2026-01-19&end_date=2026-01-20")), "l'archive couvre les dates anciennes");
    assert.ok(appels.some((u) => u.includes("api.open-meteo.com/v1/forecast") && u.includes("past_days=7")), "le récent passe par les prévisions");
    assert.ok(appels.every((u) => u.includes("hourly=temperature_2m") && u.includes("timezone=auto")));
  });

  await test("réseau en panne, heure absente ou position absurde : rien, plutôt qu'une valeur fausse", async () => {
    globalThis.fetch = (async () => { throw new Error("hors ligne"); }) as typeof fetch;
    assert.equal((await temperaturesAir([{ cle: "a", lat: 50.6, lon: 3.1, debutLocal: "2026-01-20T08:00:00" }], MAINTENANT)).size, 0);
    globalThis.fetch = (async () => reponse({ "2026-01-20T09:00": 3 })) as typeof fetch;
    assert.equal((await temperaturesAir([{ cle: "a", lat: 50.6, lon: 3.1, debutLocal: "2026-01-20T08:00:00" }], MAINTENANT)).size, 0, "une autre heure ne remplace pas la bonne");
    assert.equal((await temperaturesAir([{ cle: "a", lat: 999, lon: 3.1, debutLocal: "2026-01-20T08:00:00" }], MAINTENANT)).size, 0);
  });
  globalThis.fetch = fetchReel;

  await test("tapis, home-trainer, virtuel : pas de température d'air", () => {
    for (const t of ["VirtualRun", "Treadmill", "IndoorCycling", "VirtualRide"]) assert.equal(enInterieur(t), true, t);
    for (const t of ["Run", "TrailRun", "Ride", "Hike"]) assert.equal(enInterieur(t), false, t);
  });

  console.log("\nLE CAPTEUR DE LA MONTRE N'EST PLUS ENREGISTRÉ");

  await test("la ligne écrite ne prend JAMAIS `average_temp` ; sans température de l'air, la clé est absente", () => {
    const act = { id: "i1", type: "Run", start_date_local: "2026-01-20T08:12:33", name: "Footing", moving_time: 2760, distance: 10000, average_temp: 11.07 } as never;
    const sans = buildWorkoutRow(act, { userId: "u", type: "easy" });
    assert.ok(!("weather_temp_c" in sans), "une ligne sans température de l'air écraserait une vraie valeur, ou garderait le capteur");
    const avec = buildWorkoutRow(act, { userId: "u", type: "easy", tempAir: 2.4 });
    assert.equal(avec.weather_temp_c, 2.4);
    assert.doesNotMatch(code("src/lib/intervals/workoutRow.ts"), /act\.average_temp/, "la température du capteur repasse dans la base");
  });

  await test("les deux synchronisations demandent la vraie température, à la position de l'athlète", () => {
    for (const f of ["src/lib/intervals/syncUser.ts", "src/app/api/intervals/sync/route.ts"]) {
      const c = code(f);
      assert.match(c, /const position = await positionHabituelle\(/, `${f} : position`);
      assert.match(c, /tempAir: tempsAir\.get\(String\(act\.id\)\) \?\? null/, `${f} : la température n'est plus transmise`);
      assert.match(c, /!enInterieur\(a\.type\)/, `${f} : une séance en intérieur reçoit une température d'air`);
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})();
