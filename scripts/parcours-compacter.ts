/**
 * COMPACTE LE CATALOGUE DE PARCOURS POUR LA PRODUCTION.
 *
 *   npx tsx scripts/parcours-compacter.ts
 *
 * Pourquoi (22/09/2026) : `data/parcours_certifies.json` pèse 20 Mo, dont 12 Mo de
 * profils altimétriques (`profil`) que l'API ne rend JAMAIS (voir `mapCertified` dans
 * app/api/parcours/route.ts). Le traceur de fichiers de Next embarquait le dossier
 * `data/` entier (36 Mo) dans la fonction serveur — la SEULE fonction, celle qui sert
 * toutes les pages — et chaque démarrage à froid la téléchargeait : 7,4 s mesurées sur
 * la première visite d'une page en production.
 *
 * Ce script ne garde que les champs lus par `mapCertified` et compresse le résultat en
 * gzip : ≈ 1,5 Mo au lieu de 20. La route lit ce fichier en premier ; le JSON complet
 * reste dans le dépôt pour les outils et les tests, mais n'est plus tracé (voir
 * `outputFileTracingExcludes` dans next.config.ts).
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const CHAMPS = [
  "osm_id", "osm_type", "nom", "sport", "difficulte", "type_parcours", "distance_km", "denivele_positif_m",
  "denivele_negatif_m", "temps_estime", "calories_kcal", "pente_max_pct", "altitude_min_m", "altitude_max_m",
  "lat", "lng", "region", "departements", "depart", "arrivee",
] as const;

const SOURCE = "data/parcours_certifies.json";
const CIBLE = "data/parcours_certifies.min.json.gz";

const brut = JSON.parse(readFileSync(SOURCE, "utf8")) as Record<string, unknown>[];
const slim = brut.map((p) => Object.fromEntries(CHAMPS.filter((c) => p[c] !== undefined && p[c] !== null && p[c] !== "None").map((c) => [c, p[c]])));
const json = JSON.stringify(slim);
writeFileSync(CIBLE, gzipSync(Buffer.from(json), { level: 9 }));
console.log(`${brut.length} parcours · ${Math.round(statSync(SOURCE).size / 1e6)} Mo → ${(json.length / 1e6).toFixed(1)} Mo allégé → ${(statSync(CIBLE).size / 1e6).toFixed(2)} Mo gzip (${CIBLE})`);
