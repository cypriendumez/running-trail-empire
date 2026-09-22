/**
 * LES DONNÉES D'UN TRACÉ — distance, dénivelé, durée : est-ce qu'on dit vrai ?
 *
 * Demandé par Cyprien le 22/09/2026 : « vérifie que les données sont bonnes quand une
 * personne crée un tracé ». Trois défauts trouvés en lisant le calcul, chacun tenu ici :
 *
 *  1. le D+ additionnait CHAQUE écart positif du modèle d'altitude, bruit compris ;
 *  2. le profil était échantillonné à 100 points quelle que soit la longueur — sur
 *     40 km, une mesure tous les 400 m efface les bosses ;
 *  3. une lecture d'altitude en échec rendait des ZÉROS, affichés comme un fait
 *     (« D+ 0 m », difficulté facile, durée sans pénalité de montée).
 *
 * Et un quatrième, trouvé dans l'itinéraire : le profil OSRM `foot` était utilisé même
 * à vélo.
 *
 *   npx tsx tests/trace.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { denivele, distanceKm, haversineKm, indicesEchantillon, etaler, chargerProfil, profilOsrm, SEUIL_M, POINTS_MAX } from "../src/lib/trail/altitude";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void | Promise<void>) {
  return Promise.resolve().then(fn).then(() => { passed++; console.log("  OK " + nom); }, (e) => { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); });
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Une ligne droite vers l'est, `n` points espacés de `pasM` mètres, à Paris. */
function ligne(n: number, pasM: number) {
  const degParM = 1 / (111_320 * Math.cos((48.85 * Math.PI) / 180));
  return Array.from({ length: n }, (_, i) => ({ lat: 48.85, lng: 2.35 + i * pasM * degParM }));
}

(async () => {
  console.log("\n=== DONNÉES D'UN TRACÉ ===\n");

  await test("la distance est juste : un degré de latitude fait ~111 km, et un aller-retour compte double", () => {
    assert.ok(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111.19) < 0.1, "1° de latitude ≠ 111,19 km");
    // Paris → Lyon : 392 km à vol d'oiseau (référence géodésique).
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.7640, lng: 4.8357 });
    assert.ok(Math.abs(d - 392) < 4, `Paris–Lyon calculé à ${d.toFixed(0)} km`);
    // Une ligne de 100 points espacés de 50 m fait 4,95 km (99 segments).
    assert.ok(Math.abs(distanceKm(ligne(100, 50)) - 4.95) < 0.02);
    // Un aller-retour : la distance parcourue, pas la distance à vol d'oiseau.
    const aller = ligne(3, 1000);
    assert.ok(Math.abs(distanceKm([...aller, aller[1], aller[0]]) - 4) < 0.02, "un aller-retour doit compter les deux sens");
    assert.equal(distanceKm([]), 0); assert.equal(distanceKm([{ lat: 1, lng: 1 }]), 0);
  });

  await test("le D+ ignore le bruit du modèle d'altitude, mais jamais une vraie côte", () => {
    // Un plat bruité à ±2 m : le modèle d'altitude fait ça en permanence. D+ attendu : 0.
    const bruit = Array.from({ length: 200 }, (_, i) => 100 + ((i * 7919) % 5) - 2);
    const { gain } = denivele(bruit);
    assert.equal(gain, 0, `un plat bruité a produit ${gain} m de D+ — c'est le bruit qu'on mesure`);
    // La somme naïve, elle, aurait inventé des centaines de mètres : on le prouve.
    let naif = 0; for (let i = 1; i < bruit.length; i++) if (bruit[i] > bruit[i - 1]) naif += bruit[i] - bruit[i - 1];
    assert.ok(naif > 100, `la somme naïve ne gonfle que de ${naif} m : l'exemple ne prouve rien`);
    // Une vraie côte de 300 m, montée puis descendue : 300 / 300.
    const cote = [...Array.from({ length: 100 }, (_, i) => 100 + i * 3), ...Array.from({ length: 100 }, (_, i) => 400 - i * 3)];
    const c = denivele(cote);
    assert.ok(Math.abs(c.gain - 297) <= 6, `côte de 300 m mesurée à ${c.gain} m`);
    assert.ok(Math.abs(c.perte - 297) <= 6, `descente de 300 m mesurée à ${c.perte} m`);
    // Deux bosses de 20 m comptent, une ondulation de 3 m non (elle est sous le seuil).
    assert.equal(denivele([0, 20, 0, 20, 0]).gain, 40);
    assert.equal(denivele([0, 3, 0, 3, 0]).gain, 0);
    assert.ok(SEUIL_M >= 3 && SEUIL_M <= 10, "le seuil d'hystérésis a quitté la plage raisonnable");
    assert.deepEqual(denivele([]), { gain: 0, perte: 0 });
    assert.deepEqual(denivele([42]), { gain: 0, perte: 0 });
  });

  await test("l'échantillonnage suit la LONGUEUR du parcours, pas un nombre fixe", () => {
    // 3 km : un point tous les ~50 m → ~61 mesures, pas 100 sur toute la trace.
    const court = ligne(600, 5);   // 600 points espacés de 5 m = 3 km
    const iCourt = indicesEchantillon(court);
    assert.ok(iCourt.length >= 55 && iCourt.length <= 70, `${iCourt.length} mesures sur 3 km`);
    // 40 km : l'ancien code en prenait 100 (une tous les 400 m). On veut le plafond.
    const long = ligne(4000, 10);  // 40 km
    const iLong = indicesEchantillon(long);
    assert.equal(iLong.length, POINTS_MAX, `${iLong.length} mesures sur 40 km : les bosses disparaissent`);
    assert.ok(POINTS_MAX >= 300, "le plafond de mesures est redescendu trop bas");
    // Extrémités toujours incluses, indices croissants et dans les bornes.
    assert.equal(iLong[0], 0); assert.equal(iLong[iLong.length - 1], long.length - 1);
    for (let k = 1; k < iLong.length; k++) assert.ok(iLong[k] > iLong[k - 1], "indices non croissants");
    // Deux points : les deux sont mesurés.
    assert.deepEqual(indicesEchantillon(ligne(2, 100)), [0, 1]);
  });

  await test("les altitudes mesurées sont réétalées sur toute la trace, en interpolant", () => {
    const e = etaler(5, [0, 4], [100, 140]);
    assert.deepEqual(e, [100, 110, 120, 130, 140], "l'interpolation entre deux mesures est fausse");
    assert.equal(etaler(3, [0, 1, 2], [1, 2, 3]).length, 3);
    // Entrées incohérentes : rien plutôt que n'importe quoi.
    assert.deepEqual(etaler(5, [0, 4], [100]), []);
    assert.deepEqual(etaler(5, [], []), []);
  });

  await test("une lecture d'altitude en échec rend `null` — jamais un profil plat inventé", async () => {
    const pts = ligne(10, 100);
    const echecs: (() => Promise<Response>)[] = [
      async () => new Response("", { status: 500 }),
      async () => new Response(JSON.stringify({}), { status: 200 }),
      async () => new Response(JSON.stringify({ elevation: [1, 2] }), { status: 200 }),          // longueur ≠
      async () => new Response(JSON.stringify({ elevation: new Array(10).fill(null) }), { status: 200 }),
      async () => { throw new Error("réseau coupé"); },
    ];
    for (const f of echecs) {
      const r = await chargerProfil(pts, { fetch: f as unknown as typeof fetch });
      assert.equal(r, null, "un échec de lecture a produit un profil — donc un D+ inventé");
    }
    // Cas normal : le profil sort, avec le D+ calculé au seuil.
    const ok = await chargerProfil(pts, {
      fetch: (async (u: string) => {
        const n = String(u).split("latitude=")[1].split("&")[0].split(",").length;
        return new Response(JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 100 + i * 10) }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.ok(ok, "un profil valide a été refusé");
    assert.equal(ok!.altitudes.length, pts.length);
    assert.ok(ok!.gain > 0 && ok!.perte === 0, `montée régulière : gain ${ok!.gain}, perte ${ok!.perte}`);
    assert.equal(ok!.min, 100);
  });

  await test("un parcours long est interrogé par paquets de 100 — la limite de l'API", async () => {
    const appels: number[] = [];
    const pts = ligne(4000, 10); // 40 km → 500 mesures → 5 paquets
    await chargerProfil(pts, {
      fetch: (async (u: string) => {
        const n = String(u).split("latitude=")[1].split("&")[0].split(",").length;
        appels.push(n);
        return new Response(JSON.stringify({ elevation: new Array(n).fill(200) }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.equal(appels.length, 5, `${appels.length} requête(s) : les paquets ne font plus 100 points`);
    assert.ok(appels.every((n) => n <= 100), `un paquet de ${Math.max(...appels)} points dépasse la limite de l'API`);
    assert.equal(appels.reduce((a, b) => a + b, 0), POINTS_MAX);
  });

  await test("l'itinéraire suit le bon profil : à pied à pied, à vélo à vélo", () => {
    assert.equal(profilOsrm("course"), "foot");
    assert.equal(profilOsrm("trail"), "foot");
    assert.equal(profilOsrm("marche"), "foot");
    assert.equal(profilOsrm("velo"), "bike");
    assert.equal(profilOsrm("vtt"), "bike");
    const src = codeNu("src/components/trail/TrailBuilder.tsx");
    assert.ok(!/route\/v1\/foot\//.test(src), "le profil OSRM « foot » est de nouveau écrit en dur : un parcours vélo suivrait les sentiers piétons");
    assert.match(src, /route\/v1\/\$\{profilOsrm\(/, "l'itinéraire ne dépend plus de l'activité");
  });

  await test("le constructeur utilise ce calcul, et dit quand l'altitude manque", () => {
    const src = codeNu("src/components/trail/TrailBuilder.tsx");
    assert.match(src, /chargerProfil\(/, "le constructeur ne passe plus par le chargement de profil vérifié");
    assert.ok(!/new Array\(pts\.length\)\.fill\(0\)/.test(src), "le repli « profil plat » (des zéros présentés comme un fait) est revenu");
    assert.match(src, /altitudeIndispo/, "rien n'indique à l'écran que l'altitude n'a pas pu être lue");
    // Le D+ affiché vient du calcul au seuil, pas d'une somme locale.
    assert.ok(!/if \(d > 0\) gain \+= d; else loss \+= -d;/.test(src), "la somme naïve du dénivelé est revenue dans le composant");
  });

  await test("un parcours enregistré ne porte jamais un D+ de 0 inventé", () => {
    const ui = codeNu("src/components/trail/TrailBuilder.tsx");
    assert.match(ui, /elevation_gain_m: altitudeIndispo \? null : elevGain/, "l'enregistrement en ligne écrit 0 m quand l'altitude est inconnue");
    assert.match(ui, /elevation_gain_m: altitudeIndispo \? null : Math\.round\(elevGain\)/, "le repli local écrit 0 m quand l'altitude est inconnue");
    const api = codeNu("src/app/api/routes/route.ts");
    assert.ok(!/elevation_gain_m: Math\.round\(elevation_gain_m\),/.test(api), "`Math.round(null)` vaut 0 : la route écrirait un parcours plat");
    assert.match(api, /Number\.isFinite\(elevation_gain_m\) \? Math\.round\(elevation_gain_m\) : null/);
  });

  await test("la carte tient dans un téléphone : plein écran, commandes à portée du pouce, attribution visible", () => {
    const ui = codeNu("src/components/trail/TrailBuilder.tsx");
    // Plein écran : la boîte de 68 % de hauteur avec les marges de la page a disparu.
    assert.ok(!/h-\[68vh\] min-h-\[460px\]/.test(ui), "la carte est revenue dans sa boîte de 68 % de hauteur");
    assert.match(ui, /-mx-6 flex h-\[calc\(100dvh-16rem\)\]/, "la carte ne prend plus la largeur et la hauteur de l'écran sur téléphone");
    // Les commandes flottantes sont réservées au bureau ; le téléphone a sa barre.
    assert.match(ui, /hidden items-start justify-between gap-3 sm:flex/, "la barre d'outils flotte de nouveau sur la carte du téléphone");
    assert.match(ui, /absolute inset-x-0 bottom-0 z-\[1000\] sm:hidden/, "la barre du pouce a disparu");
    assert.match(ui, /setReglagesOuverts\(true\)/, "les réglages ne s'ouvrent plus en feuille");
    // ⚠️ Le fond de la barre doit être une classe qui EXISTE : `bg-white/97` ne produit
    // aucun CSS (hors échelle Tailwind) et la barre s'affichait transparente.
    // Le contrôle porte sur le CODE (commentaires retirés) : la phrase qui raconte le
    // piège cite la classe fautive, et doit pouvoir continuer à le faire.
    const classes = [...ui.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).join(" ");
    const horsEchelle = [...classes.matchAll(/bg-white\/(\d+)/g)].map((m) => Number(m[1])).filter((n) => n % 5 !== 0);
    assert.deepEqual(horsEchelle, [], `opacité(s) hors échelle Tailwind : ${horsEchelle.join(", ")} — ces classes ne produisent AUCUN CSS`);
    // L'attribution des cartes est obligatoire : elle remonte au-dessus de la barre.
    const css = readFileSync("src/app/globals.css", "utf8");
    assert.match(css, /\.leaflet-bottom \{ bottom: 64px; \}/, "l'attribution OpenStreetMap repasse sous la barre du pouce");
    assert.match(css, /\.leaflet-control-zoom \{ display: none; \}/, "les boutons +/− de Leaflet reviennent gêner le pouce");
    // La vue relief : même traitement, et MapLibre préchargé pendant qu'on construit.
    assert.match(codeNu("src/components/trail/Relief3D.tsx"), /-mx-6 overflow-hidden border-y/, "la vue relief est revenue dans son hublot");
    assert.match(codeNu("src/components/trail/TrailModes.tsx"), /void import\("\.\/Relief3D"\)/, "MapLibre n'est plus préchargé : 1 Mo à télécharger au clic sur « Vue relief »");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
