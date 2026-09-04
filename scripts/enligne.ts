/**
 * QU'Y A-T-IL RÉELLEMENT EN LIGNE ?
 *
 *   npm run enligne
 *
 * Interroge la PRODUCTION (pas un fichier local, pas un commentaire) et dit quels
 * commits sont écrits mais pas déployés. Voir `scripts/version.ts` pour le défaut
 * qui a rendu ce script nécessaire.
 *
 * Sort en code 1 quand la production est en retard, pour pouvoir servir de garde.
 */
import { execSync } from "node:child_process";

const HOTE = process.env.NEXT_PUBLIC_APP_URL || "https://running-trail-empire-woad.vercel.app";

async function main() {
  let deploye: string | null = null;
  let dateDeploi = "";
  try {
    const r = await fetch(`${HOTE.replace(/\/+$/, "")}/version.json`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { commit?: string; date?: string };
      if (typeof j.commit === "string" && /^[0-9a-f]{7,40}$/.test(j.commit)) {
        deploye = j.commit;
        dateDeploi = String(j.date ?? "");
      }
    } else if (r.status === 404) {
      console.log("⚠️  La production ne publie pas de version.json.");
      console.log("   Soit le déploiement est antérieur à ce tampon, soit il a échoué.");
      process.exit(1);
    }
  } catch (e) {
    console.log("⚠️  Production injoignable :", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  if (!deploye) {
    console.log("⚠️  version.json illisible en production : impossible de conclure.");
    process.exit(1);
  }

  const local = execSync("git rev-parse --short HEAD").toString().trim();
  if (deploye === local) {
    console.log(`✓ En ligne : ${deploye} — identique à HEAD (${dateDeploi.slice(0, 10)}).`);
    return;
  }

  let retard: string[] = [];
  try {
    retard = execSync(`git log --format="%h %s" ${deploye}..HEAD`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    console.log(`⚠️  En ligne : ${deploye}, local : ${local} — commit inconnu du dépôt local.`);
    process.exit(1);
  }

  console.log(`❌ La production est en retard.\n   en ligne : ${deploye}\n   local    : ${local}`);
  console.log(`   ${retard.length} commit(s) écrit(s) mais PAS déployé(s) :`);
  for (const l of retard.slice(0, 20)) console.log(`     ${l}`);
  console.log(`\n   Pour les mettre en ligne : npx --yes vercel@54.14.0 deploy --prod --yes`);
  process.exit(1);
}

main();
