/**
 * RESTAURATION D'UNE ARCHIVE.
 *
 *   npm run restaurer                     → SIMULATION : dit ce qui changerait, n'écrit rien
 *   npm run restaurer -- --ecrire races   → écrit vraiment, une table à la fois
 *
 * ⚠️ LA SIMULATION EST LE DÉFAUT, ET L'ÉCRITURE DEMANDE LE NOM DE LA TABLE. Restaurer
 * écrase des données en production : le geste doit être délibéré, pas le résultat d'une
 * flèche haut dans l'historique du terminal. On n'écrit jamais toutes les tables d'un
 * coup pour la même raison.
 *
 * ⚠️ UNE SAUVEGARDE QU'ON NE SAIT PAS RESTAURER N'EST PAS UNE SAUVEGARDE. Ce script
 * existe pour que la simulation puisse être lancée n'importe quand, sans risque, et
 * prouve que l'archive est exploitable — pas seulement présente.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SAUVEGARDABLES, estSauvegardable, fichierDe } from "../src/lib/sauvegarde/tables";

// ⚠️ `.env.local` N'EXISTE PAS DANS UN EXÉCUTEUR GITHUB. Le lire sans condition faisait
// tomber le script avant la première requête — une sauvegarde qui ne s'exécute jamais.
if (fs.existsSync(".env.local")) {
  for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Identifiants Supabase absents (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}
const DOSSIER = process.env.SAUVEGARDE_DIR ?? ".sauvegardes";
const PAS = 500;

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const iEcrire = args.indexOf("--ecrire");
  const cible = iEcrire >= 0 ? args[iEcrire + 1] : "";
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (iEcrire >= 0 && !estSauvegardable(cible)) {
    console.log(`REFUSÉ : « ${cible ?? ""} » n'est pas une table restaurable.`);
    console.log(`Tables possibles : ${SAUVEGARDABLES.map((t) => t.nom).join(", ")}`);
    process.exitCode = 1; return;
  }

  for (const t of SAUVEGARDABLES) {
    const f = path.join(DOSSIER, fichierDe(t.nom));
    if (!fs.existsSync(f)) { console.log(`  ${t.nom} : archive absente`); process.exitCode = 1; continue; }
    let lignes: Record<string, unknown>[];
    try { lignes = JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, unknown>[]; }
    catch { console.log(`  ${t.nom} : archive illisible`); process.exitCode = 1; continue; }
    if (!Array.isArray(lignes) || lignes.length === 0) { console.log(`  ${t.nom} : archive vide`); process.exitCode = 1; continue; }

    const { count } = await sb.from(t.nom).select("*", { count: "exact", head: true });
    const enBase = count ?? 0;
    const ecrit = iEcrire >= 0 && cible === t.nom;

    if (!ecrit) {
      // ⚠️ ON DIT CE QUI CHANGERAIT, PAS « tout va bien ». Une restauration qui
      // RÉDUIRAIT le nombre de lignes est le cas le plus dangereux : l'archive est plus
      // vieille que la base, et écrire ferait perdre ce qui a été ajouté depuis.
      const sens = lignes.length > enBase ? `+${lignes.length - enBase}`
        : lignes.length < enBase ? `⚠️ ${lignes.length - enBase} — l'archive est PLUS PAUVRE que la base`
        : "identique";
      console.log(`  ${t.nom.padEnd(16)} archive ${String(lignes.length).padStart(6)} · base ${String(enBase).padStart(6)} → ${sens}`);
      // Les colonnes de l'archive existent-elles encore ? Un schéma qui a changé depuis
      // rendrait la restauration impossible au pire moment.
      const { data: echantillon } = await sb.from(t.nom).select("*").limit(1);
      const colonnesBase = new Set(Object.keys(echantillon?.[0] ?? {}));
      const inconnues = Object.keys(lignes[0] ?? {}).filter((c) => colonnesBase.size > 0 && !colonnesBase.has(c));
      if (inconnues.length) console.log(`    ⚠️ colonnes absentes de la base : ${inconnues.join(", ")}`);
      continue;
    }

    console.log(`  ${t.nom} : écriture de ${lignes.length} ligne(s)…`);
    for (let i = 0; i < lignes.length; i += PAS) {
      const { error } = await sb.from(t.nom).upsert(lignes.slice(i, i + PAS), { onConflict: "id" });
      if (error) { console.log(`  ÉCHEC au lot ${i / PAS + 1} : ${error.message}`); process.exitCode = 1; return; }
    }
    const { count: apres } = await sb.from(t.nom).select("*", { count: "exact", head: true });
    console.log(`  ${t.nom} : ${apres} ligne(s) en base après restauration`);
  }

  if (iEcrire < 0) console.log("\nSIMULATION — rien n'a été écrit. Ajoute « --ecrire <table> » pour restaurer.");
}

void principal();
