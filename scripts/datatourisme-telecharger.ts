/**
 * TÉLÉCHARGER LE FICHIER DES MANIFESTATIONS DATATOURISME (Licence Ouverte 2.0).
 *
 * L'adresse du fichier CHANGE CHAQUE JOUR (« …/20260929-024520/datatourisme-fma.csv ») :
 * on la demande à l'API de data.gouv.fr, par le TITRE de la ressource. Puis on vérifie ce
 * qu'on a reçu avant de le passer aux scripts d'écriture : une page d'erreur de 2 ko ou un
 * fichier dont les colonnes ont changé de nom ne doit jamais être « importé ».
 *
 *   npx tsx scripts/datatourisme-telecharger.ts <sortie.csv>
 */
import { writeFileSync } from "node:fs";

const JEU = "https://www.data.gouv.fr/api/1/datasets/datatourisme-la-plateforme-nationale-des-donnees-touristiques/";
const TITRE = "datatourisme-fma.csv";
/** Les colonnes que lit `lib/races/datatourisme` — une seule renommée et tout serait vide. */
export const COLONNES = ["Nom_du_POI", "Categories_de_POI", "Latitude", "Longitude", "Code_postal_et_commune",
  "Periodes_regroupees", "Contacts_du_POI", "Description", "URI_ID_du_POI"];
/** Mesuré le 29/09/2026 : 58 Mo. Moins de 10 Mo = fichier tronqué ou page d'erreur. */
export const TAILLE_MIN = 10_000_000;

type Ressource = { title?: string; url?: string; format?: string };

/** L'adresse du jour du fichier des manifestations, d'après la réponse de l'API. */
export function adresseFma(jeu: unknown): string | null {
  const rs = (jeu as { resources?: Ressource[] } | null)?.resources;
  if (!Array.isArray(rs)) return null;
  const r = rs.find((x) => x?.title === TITRE && /^https:\/\//.test(String(x.url ?? "")));
  return r?.url ?? null;
}

/** Ce qui ne va pas dans le fichier reçu, ou `null` s'il est exploitable. */
export function defautFichier(octets: number, premiereLigne: string): string | null {
  if (octets < TAILLE_MIN) return `fichier trop petit (${octets} octets)`;
  // `trim()` retire aussi l'indicateur d'ordre des octets (U+FEFF) d'un CSV exporté d'Excel.
  const tete = premiereLigne.split(",").map((c) => c.trim());
  const manquantes = COLONNES.filter((c) => !tete.includes(c));
  return manquantes.length ? `colonnes absentes : ${manquantes.join(", ")}` : null;
}

async function main() {
  const [sortie] = process.argv.slice(2);
  if (!sortie) throw new Error("usage : datatourisme-telecharger.ts <sortie.csv>");
  const j = await fetch(JEU, { signal: AbortSignal.timeout(30000) });
  if (!j.ok) throw new Error(`API data.gouv : ${j.status}`);
  const url = adresseFma(await j.json());
  if (!url) throw new Error(`ressource « ${TITRE} » introuvable dans le jeu de données`);
  const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error(`téléchargement : ${r.status}`);
  const brut = Buffer.from(await r.arrayBuffer());
  const defaut = defautFichier(brut.length, brut.subarray(0, 2000).toString("utf8").split("\n")[0]);
  if (defaut) throw new Error(`fichier refusé — ${defaut}`);
  writeFileSync(sortie, brut);
  console.log(JSON.stringify({ url, octets: brut.length }));
}

if (process.argv[1]?.endsWith("datatourisme-telecharger.ts")) main().catch((e) => { console.error(e); process.exit(1); });
