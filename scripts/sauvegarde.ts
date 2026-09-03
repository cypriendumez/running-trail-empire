/**
 * SAUVEGARDE DES DONNÉES IRREMPLAÇABLES.
 *
 *   npm run sauvegarde              → écrit l'archive dans .sauvegardes/
 *   npm run sauvegarde -- --verifie → relit l'archive existante et la valide, sans rien écrire
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. Aucune sauvegarde n'existait, et les 17 131 courses ont
 * été bâties par des mois de collecte auprès de sources qui ne sont plus accessibles à
 * cette échelle : jogging-plus refuse les automates (403 mesuré le 03/09/2026), la FFA
 * l'interdit par robots.txt. Perdue, cette table ne se reconstruit pas.
 *
 * ⚠️ SEULES LES TABLES PUBLIQUES SORTENT. Le dépôt est public et l'archive part chez
 * GitHub : voir `src/lib/sauvegarde/tables.ts`. Une table de données personnelles n'y
 * entre pas, et un test rougit si quelqu'un l'ajoutait.
 *
 * ⚠️ ET LE PLAFOND DE POSTGREST. Une réponse s'arrête à 1 000 lignes QUEL QUE SOIT le
 * `limit` demandé, sans erreur : une sauvegarde écrite sans pagination contiendrait
 * 1 000 courses sur 17 131 et paraîtrait réussie. On pagine, et on COMPTE.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SAUVEGARDABLES, estSauvegardable, fichierDe, verifierManifeste, type Manifeste } from "../src/lib/sauvegarde/tables";

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
const PAS = 1000;

const empreinte = (contenu: string) => crypto.createHash("sha256").update(contenu).digest("hex").slice(0, 32);

function empreinteDuFichier(table: string): string | null {
  const f = path.join(DOSSIER, fichierDe(table));
  if (!fs.existsSync(f)) return null;
  return empreinte(fs.readFileSync(f, "utf8"));
}

async function exporter(): Promise<void> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  fs.mkdirSync(DOSSIER, { recursive: true });
  const manifeste: Manifeste = { faite: new Date().toISOString(), lignes: {}, empreintes: {} };

  for (const t of SAUVEGARDABLES) {
    // Ceinture et bretelles : la liste est déjà l'autorisation, mais une modification
    // maladroite de ce fichier ne doit pas suffire à faire sortir une table interdite.
    if (!estSauvegardable(t.nom)) { console.log(`REFUSÉ : ${t.nom} n'est pas sauvegardable.`); process.exitCode = 1; return; }
    const lignes: unknown[] = [];
    for (let debut = 0; debut < 200000; debut += PAS) {
      const { data, error } = await sb.from(t.nom).select("*").order(t.ordre, { ascending: true }).range(debut, debut + PAS - 1);
      if (error) { console.log(`ÉCHEC sur ${t.nom} : ${error.message}`); process.exitCode = 1; return; }
      const lot = data ?? [];
      lignes.push(...lot);
      if (lot.length < PAS) break;
    }
    // ⚠️ ON COMPARE AU COMPTE RÉEL DE LA BASE. Sans cela, une pagination qui s'arrête
    // trop tôt produit une archive qui a l'air complète.
    const { count } = await sb.from(t.nom).select("*", { count: "exact", head: true });
    if (count != null && lignes.length !== count) {
      console.log(`ÉCHEC : ${t.nom} → ${lignes.length} ligne(s) exportée(s) pour ${count} en base.`);
      process.exitCode = 1; return;
    }
    const contenu = JSON.stringify(lignes);
    fs.writeFileSync(path.join(DOSSIER, fichierDe(t.nom)), contenu);
    manifeste.lignes[t.nom] = lignes.length;
    manifeste.empreintes[t.nom] = empreinte(contenu);
    console.log(`  ${t.nom} : ${lignes.length} ligne(s) · ${(contenu.length / 1024 / 1024).toFixed(1)} Mo`);
  }

  fs.writeFileSync(path.join(DOSSIER, "manifeste.json"), JSON.stringify(manifeste, null, 2));
  console.log(`archive écrite dans ${DOSSIER}/`);
  verifier();
}

function verifier(): void {
  const f = path.join(DOSSIER, "manifeste.json");
  const m = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) as Manifeste : null;
  const { ok, problemes } = verifierManifeste(m, empreinteDuFichier);
  if (ok) {
    console.log(`archive VALIDE (${Object.entries(m!.lignes).map(([k, v]) => `${k} ${v}`).join(", ")}) — export du ${m!.faite.slice(0, 16)}`);
  } else {
    console.log("archive INEXPLOITABLE :");
    for (const p of problemes) console.log(`  · ${p}`);
    process.exitCode = 1;
  }
}

if (process.argv.includes("--verifie")) verifier();
else void exporter();
