import { unstable_cache } from "next/cache";
import { TACHES, constater, type Constat, type Execution } from "./supervision";

/**
 * Ce que GitHub a RÉELLEMENT lancé, tâche par tâche.
 *
 * ⚠️ SANS JETON. Le dépôt est public (vérifié : l'API répond 200 sans authentification),
 * et l'API anonyme est plafonnée à 60 requêtes par heure et par adresse. Six tâches font
 * six requêtes : sans cache, deux visites de l'écran d'administration dans la même heure
 * suffiraient à s'en approcher. D'où dix minutes de cache — l'information n'a de toute
 * façon pas besoin d'être à la seconde.
 */
const DEPOT = process.env.GITHUB_REPO ?? "cypriendumez/running-trail-empire";

async function lireRuns(fichier: string): Promise<Execution[] | null> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${DEPOT}/actions/workflows/${fichier}.yml/runs?per_page=100`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "Pacevo-supervision" },
        signal: AbortSignal.timeout(12000) },
    );
    if (!r.ok) return null;
    const d = await r.json() as { workflow_runs?: Execution[] };
    return d.workflow_runs ?? [];
  } catch {
    // ⚠️ `null` VEUT DIRE « ON N'A PAS PU SAVOIR », PAS « ZÉRO EXÉCUTION ». Confondre les
    // deux afficherait « jamais lancée » sur toutes les tâches le jour où GitHub est
    // injoignable — un faux diagnostic bien pire qu'un aveu d'ignorance.
    return null;
  }
}

export type Supervision = { constats: Constat[]; inconnues: string[] };

export const superviser = unstable_cache(
  async (): Promise<Supervision> => {
    const maintenant = new Date();
    const constats: Constat[] = [];
    const inconnues: string[] = [];
    for (const tache of TACHES) {
      const runs = await lireRuns(tache.fichier);
      if (runs === null) { inconnues.push(tache.fichier); continue; }
      constats.push(constater(tache, runs, maintenant));
    }
    return { constats, inconnues };
  },
  ["supervision-taches"],
  { revalidate: 600, tags: ["supervision"] },
);
