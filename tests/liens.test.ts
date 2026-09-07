/**
 * UN LIEN INTERNE QUI MÈNE À UNE 404 NE SE VOIT NULLE PART.
 *
 * ⚠️ DÉFAUT RÉEL, COMMIS LE 07/09/2026 ET TROUVÉ EN BALAYANT LE SITE EN LIGNE. Le bloc
 * d'analyse de séance affiche un bouton « Voir les formules » à l'athlète qui n'a pas
 * l'abonnement. Il pointait vers `/tarifs`. La page s'appelle `/pricing`, et les cinq
 * autres endroits du code qui vendent l'abonnement y pointaient correctement.
 *
 * Le lien menait donc à une 404 EXACTEMENT au moment où quelqu'un décide de payer. Rien
 * ne le signalait : ni le typage, ni le build, ni aucun test — un `href` est une chaîne.
 *
 * Ce fichier compare chaque lien interne du code aux routes qui existent VRAIMENT dans
 * `src/app`, en lisant l'arborescence plutôt qu'une liste écrite à la main : une liste
 * recopiée se périme au premier renommage, ce qui est précisément le défaut d'origine.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const APP = "src/app";

/** Routes réellement servies, lues sur le disque. Les segments dynamiques ([id]) et les
 *  groupes ((auth)) sont traités comme Next les traite. */
function routesReelles(): { fixes: Set<string>; dynamiques: string[] } {
  const fixes = new Set<string>(); const dynamiques: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) parcourir(p);
    }
    const fs = readdirSync(dir);
    if (fs.some((f) => /^(page|route)\.(tsx?|jsx?)$/.test(f))) {
      const segs = dir.slice(APP.length).split("/").filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
      const chemin = "/" + segs.join("/");
      if (segs.some((s) => s.startsWith("["))) dynamiques.push(chemin);
      else fixes.add(chemin === "/" ? "/" : chemin);
    }
  };
  parcourir(APP);
  return { fixes, dynamiques };
}

/** Tous les liens internes écrits en dur dans le code. */
function liensInternes(): { fichier: string; href: string }[] {
  const out: { fichier: string; href: string }[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { parcourir(p); continue; }
      if (!/\.tsx$/.test(e)) continue;
      const src = readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
      for (const m of src.matchAll(/href=["'](\/[^"'{}#?]*)["']/g)) out.push({ fichier: p, href: m[1] });
    }
  };
  for (const d of ["src/app", "src/components"]) parcourir(d);
  return out;
}

console.log("\nCHAQUE LIEN INTERNE MÈNE QUELQUE PART");

test("les routes sont lues sur le disque, pas recopiées", () => {
  const { fixes } = routesReelles();
  assert.ok(fixes.has("/"), "la racine n'est pas détectée : la lecture de l'arborescence est cassée");
  assert.ok(fixes.has("/pricing"), "la page des formules n'est pas détectée");
  assert.ok(fixes.size > 30, `${fixes.size} routes trouvées : la lecture est incomplète`);
  assert.ok(!fixes.has("/tarifs"), "« /tarifs » n'existe pas — c'est bien le lien qui était faux");
});

test("aucun href ne pointe vers une page inexistante", () => {
  const { fixes, dynamiques } = routesReelles();
  // Un lien vers une route dynamique (/courses/mon-10-km) est valable si un segment
  // dynamique existe à ce niveau : on compare les préfixes.
  const prefixesDyn = dynamiques.map((d) => d.slice(0, d.indexOf("/[")));
  const casses: string[] = [];
  for (const { fichier, href } of liensInternes()) {
    const chemin = href.replace(/\/$/, "") || "/";
    if (fixes.has(chemin)) continue;
    if (prefixesDyn.some((pre) => pre && chemin.startsWith(pre + "/"))) continue;
    casses.push(`${href}  (${fichier})`);
  }
  assert.deepEqual(casses, [],
    `lien(s) interne(s) vers une page inexistante — une 404 au clic, que rien d'autre ne signale :\n    ${casses.join("\n    ")}`);
});

test("la page des formules est la MÊME partout", () => {
  // Le défaut d'origine : cinq endroits pointaient vers /pricing, un sixième vers
  // /tarifs. Un seul lien divergent suffit à perdre la vente.
  const vendeurs = liensInternes().filter(({ href }) => /pricing|tarif|abonnement|formule/i.test(href));
  assert.ok(vendeurs.length >= 4, `${vendeurs.length} lien(s) vers les formules : la lecture est incomplète`);
  const distincts = [...new Set(vendeurs.map((v) => v.href))];
  assert.deepEqual(distincts, ["/pricing"],
    `plusieurs adresses pour la même page : ${distincts.join(" · ")}`);
});

console.log(`\n${passed} test(s) de liens passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
