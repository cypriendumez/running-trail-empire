/**
 * LES SITES OFFICIELS DES COURSES À SOURCE FERMÉE (jogging-plus) — recherche web + lecture
 * polie + contrôles (lib/races/sitesOfficiels). À BLANC par défaut : rapport seulement.
 *
 *   npx tsx scripts/sites-officiels.ts <rapport.json> [--max 40] [--ecrire] [--jumeaux-seulement]
 *   npx tsx scripts/sites-officiels.ts <rapport.json> --gratuit [--fma fma.csv] [--ecrire]
 *
 * --gratuit : SANS IA — jumeaux, puis DATAtourisme (si --fma) et adresses devinées.
 *
 * Étape 1, gratuite : le site connu d'un JUMEAU relu (même nom canonique, même ville).
 * Étape 2 : la recherche web (quota du modèle) pour le reste — sautée avec --jumeaux-seulement.
 *
 * Le même moteur tourne sur le serveur (/api/cron/sites-officiels), par petits lots.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { idEditeur } from "../src/lib/compta/enregistrer";
import { traiterLot, traiterGratuit, appliquerJumeaux } from "../src/lib/races/sitesOfficiels";
import { lireCsv, evenementOuvert } from "../src/lib/races/datatourisme";
import { indexOuvert, type EvenementOuvert } from "../src/lib/races/siteOfficielWeb";
import { seuil } from "./garde-fous";

const ECRIRE = process.argv.includes("--ecrire");
const MAX = seuil(process.argv, "--max", 40);
const [rapport] = process.argv.slice(2).filter((a, i, t) => !a.startsWith("--") && !t[i - 1]?.startsWith("--"));
const FMA = (() => { const i = process.argv.indexOf("--fma"); return i > 0 ? process.argv[i + 1] : null; })();

/** Les événements sportifs de DATAtourisme (Licence Ouverte), indexés par commune. */
function ouverts(fichier: string) {
  const brut = lireCsv(readFileSync(fichier, "utf8")) as string[][];
  const tete = brut[0];
  const evts = brut.slice(1).map((l) => evenementOuvert(Object.fromEntries(tete.map((c, i) => [c, l[i] ?? ""]))))
    .filter((e): e is EvenementOuvert => !!e);
  console.log(`[DATAtourisme] ${evts.length} événements sportifs avec un site`);
  return indexOuvert(evts);
}

function afficher(b: Awaited<ReturnType<typeof traiterGratuit>>) {
  for (const d of b.details) {
    if (!d.url && !process.argv.includes("--tout")) continue;
    console.log(`${d.url ? "✓" : "·"} ${d.date ?? "à venir"} | ${d.nom} (${d.ville ?? "?"}) → ${d.url ?? d.motif}${d.force ? ` [${d.force}]` : ""}`);
  }
}

async function main() {
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const j = await appliquerJumeaux(createAdminClient(), ECRIRE);
  console.log(`[jumeaux] ${j.trouves} fiche(s) reçoivent le site de leur jumeau · ${j.ecrits} écrite(s) · ${j.erreurs} erreur(s)`);
  j.exemples.forEach((x) => console.log(`   ${x}`));
  if (j.erreurs) process.exitCode = 1;
  // Le mardi (GitHub) ne fait QUE cette étape : ni clé du modèle, ni compte d'administration requis.
  if (process.argv.includes("--jumeaux-seulement")) return;
  if (process.argv.includes("--gratuit")) {
    const b = await traiterGratuit(createAdminClient(), {
      aujourdhui, ecrire: ECRIRE, max: process.argv.includes("--max") ? MAX : undefined,
      ouverts: FMA && existsSync(FMA) ? ouverts(FMA) : undefined,
    });
    if (rapport) writeFileSync(rapport, JSON.stringify(b, null, 1));
    afficher(b);
    console.log(`\n[gratuit] ${b.trouvees}/${b.cherchees} sites trouvés · ${b.lignesMisesAJour} ligne(s) écrite(s) · ${b.erreursEcriture} erreur(s)${ECRIRE ? "" : " — À BLANC, rien écrit"}`);
    if (b.erreursEcriture) process.exitCode = 1;
    return;
  }
  const proprietaire = await idEditeur();
  if (!proprietaire) throw new Error("aucun compte d'administration : l'état n'a pas de propriétaire");
  const b = await traiterLot(createAdminClient(), { proprietaire, aujourdhui, lot: MAX, ecrire: ECRIRE });
  if (rapport) writeFileSync(rapport, JSON.stringify(b, null, 1));
  for (const d of b.details) {
    console.log(`${d.url ? "✓" : "·"} ${d.date ?? "à venir"} | ${d.nom} (${d.ville ?? "?"}) → ${d.url ?? d.motif}${d.force ? ` [${d.force}]` : ""}`);
    if (!d.url) for (const c of d.candidats) console.log(`      ${c.url} — ${c.motif}`);
  }
  console.log(`\n${b.trouvees}/${b.cherchees} sites trouvés · ${b.lignesMisesAJour} ligne(s) écrite(s) · ${b.erreursEcriture} erreur(s)${b.indisponible ? " · modèle indisponible (quota ?) — arrêt" : ""}${ECRIRE ? "" : " — À BLANC, rien écrit"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
