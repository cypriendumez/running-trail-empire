/**
 * REMISE À PLAT DU CATALOGUE — noms recalculés, doublons fusionnés.
 *
 *   npx tsx scripts/normaliser-catalogue.ts
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE PLUTÔT QU'UNE SÉRIE DE RUSTINES. Chaque fois que le
 * découpage du nom s'est amélioré — trait d'union du marchand, forme longue de la marque,
 * suffixe « M » de déclinaison — des fiches déjà écrites gardaient l'ancien nom fautif :
 * « Hyper » au lieu de « Cloudmonster Hyper », « One One Mach X 3 » au lieu de « Mach
 * X 3 ». Onze doublons au total, chacun présent sous son vrai nom ET sous un nom tronqué,
 * avec le même code-barres — ce qui faisait mentir tous les compteurs de la page.
 *
 * Corriger cas par cas aurait laissé la prochaine amélioration produire les suivants. Ici
 * on RECALCULE tout depuis `nomExact`, le libellé exact publié par le marchand : le
 * catalogue converge vers ce que dit la fonction du jour, quelle que soit son histoire.
 *
 * ⚠️ EN CAS DE COLLISION, ON GARDE LA FICHE LA PLUS RENSEIGNÉE — pas la plus récente ni
 * la première. « Le nom le plus long » avait paru malin et gardait « One One Mach X 3 »,
 * qui est justement le résidu à supprimer.
 */
import fs from "node:fs";
import path from "node:path";
import { modeleDeNom } from "./decouverte-irun";
import { prendreVerrou } from "../src/lib/shop/verrou";
import type { Modele } from "../src/lib/shop/modele";

const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");

/** Combien de champs relevés porte une fiche : sert à départager deux entrées en collision. */
export function richesse(m: Modele): number {
  return (["poidsG", "dropMm", "stackTalonMm", "prixConseilleEur", "plaqueCarbone", "ean"] as const)
    .filter((c) => m[c]).length;
}

export function slugDe(marque: string, nom: string): string {
  return `${marque}-${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normaliser(entrees: Modele[]): { catalogue: Record<string, Modele>; renommes: number } {
  const out: Record<string, Modele> = {};
  let renommes = 0;
  for (const v of entrees) {
    if (v.nomExact) {
      const n = modeleDeNom(v.nomExact, v.marque);
      if (n && n !== v.nom) { v.nom = n; renommes++; }
    }
    v.slug = slugDe(v.marque, v.nom);
    const ancien = out[v.slug];
    out[v.slug] = !ancien || richesse(v) > richesse(ancien) ? v : ancien;
  }
  return { catalogue: out, renommes };
}

function principal(): void {
  prendreVerrou("normaliser-catalogue");
  const avant = JSON.parse(fs.readFileSync(SORTIE, "utf8")) as Record<string, Modele>;
  const { catalogue, renommes } = normaliser(Object.values(avant));
  fs.writeFileSync(SORTIE, JSON.stringify(catalogue, null, 2));
  console.log(`${Object.keys(avant).length} → ${Object.keys(catalogue).length} modèles · ${renommes} nom(s) recalculé(s)`);
}

if (require.main === module) principal();
