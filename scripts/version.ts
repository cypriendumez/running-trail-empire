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
 * ⚠️ POURQUOI ON N'ÉCRASE PAS QUAND RIEN N'EST CONNU. Si ce script écrivait « inconnu »
 * faute de source, la production s'auto-déclarerait sans version et la comparaison ne
 * pourrait plus jamais échouer — un garde-fou qui ne peut pas rougir n'est pas un
 * garde-fou. On préserve donc le tampon déjà présent.
 *
 * ⚠️ ET POURQUOI LE DÉPÔT GIT NE SUFFIT PAS. Première version de ce script : le tampon
 * n'était écrit que par `prebuild`, en local. Constaté dans l'heure : construire à
 * 12 h 12, COMMITER ensuite, puis déployer sans reconstruire téléverse un disque qui
 * porte encore l'ancien tampon. Vercel rebâtit sur sa machine, sans dépôt git, donc le
 * préserve — et `npm run enligne` a annoncé « la production est en retard » alors que
 * le code déployé était le bon (vérifié dans les fragments servis). Un outil de
 * vérification qui rend un faux positif est pire qu'aucun outil : il apprend à ignorer
 * son alerte.
 *
 * D'où l'ordre des sources : la machine qui CONSTRUIT l'artefact a le dernier mot.
 * Vercel expose `VERCEL_GIT_COMMIT_SHA` — la CLI lit le dépôt local au moment du
 * `deploy` et transmet le commit — donc ce chiffre-là décrit ce qui part vraiment.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const CIBLE = path.join(process.cwd(), "public", "version.json");

export type Tampon = { commit: string; date: string; source: "vercel" | "git" };

/** Le commit tel que l'annonce la machine de build de l'hébergeur, s'il y en a une. */
export function commitHebergeur(env: Record<string, string | undefined> = process.env): Tampon | null {
  const sha = String(env.VERCEL_GIT_COMMIT_SHA ?? "").trim();
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return null;
  // Pas de date de commit exposée par l'hébergeur : on date la CONSTRUCTION, et on le
  // dit par `source` plutôt que de faire passer l'une pour l'autre.
  return { commit: sha.slice(0, 7), date: new Date().toISOString(), source: "vercel" };
}

/** Le commit courant, ou null si ce n'est pas un dépôt git (machine de build Vercel). */
export function commitLocal(): Tampon | null {
  try {
    const commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const date = execSync("git log -1 --format=%cI", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return /^[0-9a-f]{7,40}$/.test(commit) ? { commit, date, source: "git" } : null;
  } catch {
    return null;
  }
}

/** Écrit le tampon. Ne touche à rien quand git est absent : voir l'en-tête. */
export function tamponner(
  cible: string = CIBLE,
  v: Tampon | null = commitHebergeur() ?? commitLocal(),
): "ecrit" | "preserve" {
  if (!v) return "preserve";
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, JSON.stringify({ commit: v.commit, date: v.date, source: v.source }, null, 2) + "\n");
  return "ecrit";
}

if (process.argv[1] && process.argv[1].endsWith("version.ts")) {
  const v = commitHebergeur() ?? commitLocal();
  const r = tamponner(CIBLE, v);
  console.log(r === "ecrit"
    ? `[version] ${v!.commit} (${v!.source}, ${v!.date.slice(0, 10)})`
    : "[version] ni hébergeur ni dépôt git : tampon existant préservé");
}
