/**
 * ENREGISTRER UNE COURSE SANS RÉSEAU.
 *
 * Cyprien, 21/09/2026 : « que les personnes puissent enregistrer leurs courses malgré le
 * fait qu'il n'y ait pas de 4G, comme sur Strava ». Avant : un seul `fetch` à l'arrivée,
 * et sans réseau le tracé n'existait plus qu'en mémoire.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sauverEnCours, lireEnCours, effacerEnCours, vautEnregistrement,
  mettreEnAttente, lireAttente, retirerAttente, envoyerAttente, CLE_ATTENTE, CLE_EN_COURS,
} from "../src/lib/courses/horsLigne";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void | Promise<void>) {
  return Promise.resolve().then(fn).then(() => { passed++; console.log(`  OK ${nom}`); })
    .catch((e) => { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); });
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Un localStorage en mémoire ; `casse` simule la navigation privée (tout lève). */
const stockage = (casse = false) => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => { if (casse) throw new Error("refusé"); return m.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (casse) throw new Error("refusé"); m.set(k, v); },
    removeItem: (k: string) => { if (casse) throw new Error("refusé"); m.delete(k); },
    brut: m,
  };
};
const corps = (km: number) => ({ title: `Course ${km} km`, distanceKm: km, durationSeconds: 1800, type: "easy" });

(async () => {
  console.log("\n=== COURSES SANS RÉSEAU ===\n");

  await test("la course en cours s'écrit, se relit, s'efface — et un stockage cassé ne fait pas planter", () => {
    const st = stockage();
    assert.equal(lireEnCours(st), null);
    assert.equal(sauverEnCours(st, { demarreeA: 1, elapsedSec: 600, km: 2.1, elevation: 30, track: [[49.4, 1.1], [49.41, 1.11]], misAJourA: 2 }), true);
    assert.equal(lireEnCours(st)?.km, 2.1);
    effacerEnCours(st);
    assert.equal(lireEnCours(st), null);
    const mort = stockage(true);
    assert.equal(sauverEnCours(mort, { demarreeA: 1, elapsedSec: 1, km: 1, elevation: 0, track: [], misAJourA: 1 }), false);
    assert.equal(lireEnCours(mort), null);
    effacerEnCours(mort); // ne lève pas
    // Une entrée corrompue ne vaut rien.
    const st2 = stockage(); st2.setItem(CLE_EN_COURS, "{pas du json");
    assert.equal(lireEnCours(st2), null);
  });

  await test("une course retrouvée n'est proposée que si elle vaut quelque chose (≥ 0,1 km et ≥ 30 s)", () => {
    assert.equal(vautEnregistrement({ km: 0.05, elapsedSec: 600 }), false);
    assert.equal(vautEnregistrement({ km: 3, elapsedSec: 20 }), false);
    assert.equal(vautEnregistrement({ km: 0.1, elapsedSec: 30 }), true);
  });

  await test("la file d'attente conserve l'ordre, et une entrée illisible est ignorée", () => {
    const st = stockage();
    const a = mettreEnAttente(st, corps(5), 1000);
    const b = mettreEnAttente(st, corps(8), 2000);
    assert.notEqual(a.id, b.id);
    assert.deepEqual(lireAttente(st).map((c) => c.corps.distanceKm), [5, 8]);
    retirerAttente(st, a.id);
    assert.deepEqual(lireAttente(st).map((c) => c.corps.distanceKm), [8]);
    st.setItem(CLE_ATTENTE, JSON.stringify([{ id: "x", corps: corps(1), creeeA: 1, tentatives: 0 }, null, { pasDeCorps: true }]));
    assert.equal(lireAttente(st).length, 1, "une entrée corrompue devrait être ignorée, pas planter la file");
  });

  await test("le renvoi : acceptée → retirée ; réseau absent → tout est gardé ; refusée 3× → abandonnée", async () => {
    const st = stockage();
    mettreEnAttente(st, corps(5), 1); mettreEnAttente(st, corps(8), 2);
    // Réseau absent au premier envoi : on n'a rien perdu, rien envoyé.
    let r = await envoyerAttente(st, async () => { throw new Error("réseau"); });
    assert.deepEqual(r, { envoyees: 0, restantes: 2 });
    // Réseau revenu : les deux partent, dans l'ordre.
    const ordre: number[] = [];
    r = await envoyerAttente(st, async (c) => { ordre.push(c.distanceKm); return { ok: true }; });
    assert.deepEqual(ordre, [5, 8]);
    assert.deepEqual(r, { envoyees: 2, restantes: 0 });
    // Refusée par le serveur (course invalide) : on réessaie deux fois, puis on abandonne
    // pour ne pas bloquer les suivantes.
    mettreEnAttente(st, corps(0.05), 3);
    for (let i = 1; i <= 3; i++) {
      r = await envoyerAttente(st, async () => ({ ok: false, refusee: true }));
      assert.equal(r.restantes, i < 3 ? 1 : 0, `tentative ${i}`);
    }
  });

  await test("l'écran « Enregistrer » écrit la course en cours, met en file sans réseau, et propose une course retrouvée", () => {
    const src = codeNu("src/components/ghost-runner/GhostRunner.tsx");
    assert.match(src, /sauverEnCours\(typeof localStorage !== "undefined" \? localStorage : null, \{/, "la course en cours n'est plus écrite pendant l'effort");
    assert.match(src, /if \(typeof navigator !== "undefined" && navigator\.onLine === false\) \{\s*mettreEnAttente\(st, corps\)/, "hors ligne, la course n'est plus mise en file");
    assert.match(src, /catch \{\s*mettreEnAttente\(st, corps\); effacerEnCours\(st\)/, "un réseau qui lâche pendant l'envoi ne met plus la course en file");
    assert.match(src, /if \(c && vautEnregistrement\(c\)\) setCourseRetrouvee\(c\)/, "une course retrouvée n'est plus proposée à l'ouverture");
    assert.match(src, /\{courseRetrouvee && \(/, "le bandeau de course retrouvée a disparu");
    // Et le layout renvoie la file dès que le réseau revient.
    assert.match(codeNu("src/app/dashboard/layout.tsx"), /<FileAttenteCourses \/>/, "la file d'attente n'est plus montée dans le layout");
    assert.match(codeNu("src/components/courses/FileAttenteCourses.tsx"), /window\.addEventListener\("online", vider\)/, "le retour du réseau ne déclenche plus l'envoi");
  });

  await test("le service worker garde la page « Enregistrer » pour l'ouvrir sans réseau, et la déconnexion vide tout", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    assert.match(sw, /const garder = url\.pathname === "\/dashboard\/ghost-runner";/, "la page Enregistrer n'est plus gardée hors ligne");
    assert.match(sw, /\(garder && \(await caches\.match\(req\)\)\)/, "hors ligne, la page gardée n'est pas servie");
    const d = codeNu("src/lib/auth/deconnexion.ts");
    assert.match(d, /caches\.delete\(k\)/, "la déconnexion ne vide plus le cache : la page d'un athlète resterait pour le suivant");
    assert.match(d, /removeItem\(CLE_EN_COURS\); localStorage\.removeItem\(CLE_ATTENTE\)/, "la déconnexion ne vide plus les courses locales");
    for (const f of ["src/components/layout/Sidebar.tsx", "src/components/layout/TopBar.tsx", "src/components/layout/MobileTabBar.tsx"]) {
      assert.match(codeNu(f), /await deconnexion\(\)/, `${f} ne passe plus par la déconnexion commune`);
    }
    const i18n = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
    for (const k of ["t.queued", "t.recovered", "t.recoverSave", "t.recoverDrop"]) {
      assert.equal([...i18n.matchAll(new RegExp(`"${k.replace(".", "\\.")}": "`, "g"))].length, 5, `« ${k} » manque à une langue`);
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})();
