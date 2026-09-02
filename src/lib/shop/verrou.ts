/**
 * UN SEUL COLLECTEUR À LA FOIS SUR LE CATALOGUE.
 *
 * ⚠️ DEUX SCRIPTS ONT ÉCRIT `chaussures.json` EN MÊME TEMPS, DEUX FOIS. Chacun charge le
 * fichier au démarrage, le garde en mémoire et le réécrit en entier à chaque modèle : le
 * dernier à écrire efface tout ce que l'autre a trouvé, sans erreur, sans trace. La
 * première fois, la collecte de spécifications a effacé des codes-barres ; la seconde,
 * un relevé de prix a annulé une déduplication de onze doublons.
 *
 * Le verrou est un simple fichier portant le nom du script et son PID. On refuse de
 * démarrer s'il en existe un vivant, et on l'efface en sortant — y compris sur Ctrl-C,
 * sans quoi le verrou survivrait à son propriétaire et bloquerait tout.
 */
import fs from "node:fs";
import path from "node:path";

const FICHIER = path.join(process.cwd(), ".scratch/collecte.lock");

function vivant(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function prendreVerrou(nom: string): void {
  fs.mkdirSync(path.dirname(FICHIER), { recursive: true });
  if (fs.existsSync(FICHIER)) {
    try {
      const { nom: autre, pid } = JSON.parse(fs.readFileSync(FICHIER, "utf8")) as { nom: string; pid: number };
      if (vivant(pid)) {
        console.error(`⛔ « ${autre} » (PID ${pid}) écrit déjà le catalogue. Deux collectes en parallèle s'effacent l'une l'autre.`);
        process.exit(1);
      }
      // Verrou orphelin — le propriétaire est mort sans le rendre.
    } catch { /* fichier illisible : on le remplace */ }
  }
  fs.writeFileSync(FICHIER, JSON.stringify({ nom, pid: process.pid }));
  const rendre = () => { try { fs.unlinkSync(FICHIER); } catch { /* déjà rendu */ } };
  process.on("exit", rendre);
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { rendre(); process.exit(130); });
}
