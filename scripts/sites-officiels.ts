/**
 * LES SITES OFFICIELS DES COURSES À SOURCE FERMÉE (jogging-plus) — recherche web + lecture
 * polie + contrôles (lib/races/sitesOfficiels). À BLANC par défaut : rapport seulement.
 *
 *   npx tsx scripts/sites-officiels.ts <rapport.json> [--max 40] [--ecrire] [--jumeaux-seulement]
 *
 * Étape 1, gratuite : le site connu d'un JUMEAU relu (même nom canonique, même ville).
 * Étape 2 : la recherche web (quota du modèle) pour le reste — sautée avec --jumeaux-seulement.
 *
 * Le même moteur tourne sur le serveur (/api/cron/sites-officiels), par petits lots.
 */
import { writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { idEditeur } from "../src/lib/compta/enregistrer";
import { traiterLot, appliquerJumeaux } from "../src/lib/races/sitesOfficiels";
import { seuil } from "./garde-fous";

const ECRIRE = process.argv.includes("--ecrire");
const MAX = seuil(process.argv, "--max", 40);
const [rapport] = process.argv.slice(2).filter((a, i, t) => !a.startsWith("--") && !t[i - 1]?.startsWith("--"));

async function main() {
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const j = await appliquerJumeaux(createAdminClient(), ECRIRE);
  console.log(`[jumeaux] ${j.trouves} fiche(s) reçoivent le site de leur jumeau · ${j.ecrits} écrite(s) · ${j.erreurs} erreur(s)`);
  j.exemples.forEach((x) => console.log(`   ${x}`));
  if (j.erreurs) process.exitCode = 1;
  // Le mardi (GitHub) ne fait QUE cette étape : ni clé du modèle, ni compte d'administration requis.
  if (process.argv.includes("--jumeaux-seulement")) return;
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
