/**
 * QU'Y A-T-IL RÉELLEMENT EN LIGNE ?
 *
 *   npm run enligne
 *
 * Interroge la PRODUCTION (pas un fichier local, pas un commentaire) et dit quels
 * commits sont écrits mais pas déployés. Voir `scripts/version.ts` pour le défaut
 * qui a rendu ce script nécessaire.
 *
 * Sort en code 1 dès que la production et HEAD diffèrent, pour pouvoir servir de garde.
 *
 * ⚠️ LA PRODUCTION PEUT ÊTRE EN AVANCE. Le 15/10/2026, pacevo.fr servait 1dd3aa0 (une
 * branche déployée par une session) pendant que le `main` local du dépôt principal était
 * resté à b63685c, l'un de ses ancêtres. `git log 1dd3aa0..HEAD` y était vide : le script
 * annonçait « la production est en retard / 0 commit » et proposait de déployer, ce qui
 * aurait RETIRÉ du site le correctif en ligne, puisque Vercel téléverse le disque. On
 * compare donc dans les DEUX sens, et seul un vrai retard propose de déployer.
 */
import { execFileSync, execSync } from "node:child_process";

const HOTE = process.env.NEXT_PUBLIC_APP_URL || "https://pacevo.fr";

/** Le commit servi, comparé à HEAD. */
export type Etat =
  | { etat: "identique" }
  | { etat: "inconnu" }
  | { etat: "en-retard"; aDeployer: string[] }
  /** `absents` : en ligne mais pas ici. `aDeployer` non vide en plus = les deux ont divergé. */
  | { etat: "en-avance"; absents: string[]; aDeployer: string[] };

/**
 * Compare le commit servi à HEAD, dans les deux sens. `cwd` désigne le dépôt (les tests en
 * fabriquent un). Le commit vient de version.json, une donnée du réseau : il doit avoir la
 * forme d'un commit, et git est appelé sans shell (arguments en tableau).
 */
export function comparer(deploye: string, cwd?: string): Etat {
  if (!/^[0-9a-f]{7,40}$/.test(deploye)) return { etat: "inconnu" };
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  let servi: string;
  try {
    servi = git("rev-parse", "--verify", "--quiet", `${deploye}^{commit}`);
  } catch {
    return { etat: "inconnu" };
  }
  if (!servi) return { etat: "inconnu" };
  if (servi === git("rev-parse", "HEAD")) return { etat: "identique" };
  const liste = (plage: string) => git("log", "--format=%h %s", plage).split("\n").filter(Boolean);
  const absents = liste(`HEAD..${servi}`);
  const aDeployer = liste(`${servi}..HEAD`);
  if (absents.length) return { etat: "en-avance", absents, aDeployer };
  return { etat: "en-retard", aDeployer };
}

/** Ce que le script affiche, et son code de sortie. Seul un vrai retard propose de déployer. */
export function bilan(e: Etat, deploye: string, local: string, dateDeploi: string): { lignes: string[]; code: 0 | 1 } {
  switch (e.etat) {
    case "identique":
      return { lignes: [`✓ En ligne : ${deploye} — identique à HEAD (${dateDeploi.slice(0, 10)}).`], code: 0 };
    case "inconnu":
      return {
        lignes: [
          `⚠️  En ligne : ${deploye}, local : ${local} — commit inconnu du dépôt local.`,
          "   Faire `git fetch` : la production a peut-être été déployée depuis une autre copie.",
        ],
        code: 1,
      };
    case "en-avance":
      return {
        lignes: [
          `⛔ La production contient ${e.absents.length} commit(s) ABSENT(S) d'ici.`,
          `   en ligne : ${deploye}`,
          `   local    : ${local}`,
          ...e.absents.slice(0, 20).map((l) => `     ${l}`),
          ...(e.aDeployer.length ? [`   Et ${e.aDeployer.length} commit(s) d'ici ne sont pas en ligne : les deux ont divergé.`] : []),
          "",
          "   NE PAS déployer depuis cet arbre : Vercel téléverse le disque, ces commits disparaîtraient du site.",
          "   D'abord `git fetch`, fusionner la branche en ligne (souvent `git merge origin/main`), puis revérifier.",
        ],
        code: 1,
      };
    case "en-retard":
      return {
        lignes: [
          "❌ La production est en retard.",
          `   en ligne : ${deploye}`,
          `   local    : ${local}`,
          `   ${e.aDeployer.length} commit(s) écrit(s) mais PAS déployé(s) :`,
          ...e.aDeployer.slice(0, 20).map((l) => `     ${l}`),
          "",
          "   Pour les mettre en ligne : npx --yes vercel@54.14.0 deploy --prod --yes",
        ],
        code: 1,
      };
  }
}

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
  const { lignes, code } = bilan(comparer(deploye), deploye, local, dateDeploi);
  for (const l of lignes) console.log(l);
  if (code) process.exit(code);
}

// Lancé directement (npm run enligne) : on interroge la production. Importé par un test : rien.
if (process.argv[1] && process.argv[1].endsWith("enligne.ts")) main();
