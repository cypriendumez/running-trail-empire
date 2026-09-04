/**
 * TAMPON DE VERSION — quel commit tourne RÉELLEMENT en production.
 *
 *   npm run build     → écrit public/version.json (appelé tout seul, via « prebuild »)
 *   npm run enligne   → compare la production à HEAD
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. Le 04/09/2026, le correctif de sécurité du journal
 * d'erreurs (commit 2016650) était écrit, testé, commité ET poussé sur GitHub — et
 * absent de la production. `git push` ne déploie rien ici : la mise en ligne se fait
 * à la main par `vercel deploy --prod`. Rien ne signalait l'écart. Le trou est resté
 * ouvert jusqu'à ce qu'un sondage du COMPORTEMENT de la route le révèle par hasard :
 * un corps de 20 Ko, censé être refusé, était accepté et stocké entier.
 *
 * ⚠️ POURQUOI ON N'ÉCRASE PAS QUAND GIT MANQUE. Vercel reconstruit le projet sur SA
 * machine, à partir du disque téléversé, où il n'y a pas de dépôt git. Si ce script
 * écrivait « inconnu » dans ce cas, la production s'auto-déclarerait sans version et
 * la comparaison ne pourrait plus jamais échouer — un garde-fou qui ne peut pas
 * rougir n'est pas un garde-fou. On préserve donc le fichier tamponné en local.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const CIBLE = path.join(process.cwd(), "public", "version.json");

/** Le commit courant, ou null si ce n'est pas un dépôt git (machine de build Vercel). */
export function commitLocal(): { commit: string; date: string } | null {
  try {
    const commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const date = execSync("git log -1 --format=%cI", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return /^[0-9a-f]{7,40}$/.test(commit) ? { commit, date } : null;
  } catch {
    return null;
  }
}

/** Écrit le tampon. Ne touche à rien quand git est absent : voir l'en-tête. */
export function tamponner(
  cible: string = CIBLE,
  v: { commit: string; date: string } | null = commitLocal(),
): "ecrit" | "preserve" {
  if (!v) return "preserve";
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, JSON.stringify({ commit: v.commit, date: v.date }, null, 2) + "\n");
  return "ecrit";
}

if (process.argv[1] && process.argv[1].endsWith("version.ts")) {
  const r = tamponner();
  const v = commitLocal();
  console.log(r === "ecrit" ? `[version] ${v!.commit} (${v!.date.slice(0, 10)})` : "[version] pas de dépôt git : tampon existant préservé");
}
