/**
 * IMPORT D'UN FLUX D'AFFILIATION — la commande à lancer le jour où le programme accepte.
 *
 *   npm run gear:flux -- "<url du flux>" "i-Run" --essai   (analyse, n'écrit rien)
 *   npm run gear:flux -- "<url du flux>" "i-Run"            (importe)
 *
 * ⚠️ C'EST CETTE COMMANDE QUI ALLUME LES PHOTOS. Le contrat d'éditeur affilié accorde le
 * droit d'utiliser les visuels du flux ; `product_offers.image_url` est la seule source
 * d'image admise par la boutique (cf. `PhotoMarchand`). Tant que ce script n'a pas tourné,
 * la colonne est vide et c'est le dessin aux cotes qui s'affiche — ce qui est le
 * comportement voulu, pas une panne.
 *
 * Le flux peut être en CSV ou en XML : `parseFeed` reconnaît les deux et `normalizeFeed`
 * accepte les noms de colonnes usuels des grandes plateformes (Awin, Kwanko, Effiliation).
 *
 * ⚠️ ON N'ÉCRIT QUE CE QUI POURRA S'AFFICHER. Une offre sans code-barres est orpheline :
 * la fiche retrouve ses prix par `ean`, donc une ligne sans lui s'écrirait en base et ne
 * paraîtrait nulle part. Et un lot ne peut pas contenir deux fois la même clé
 * (marchand, code-barres) — PostgREST refuse le lot ENTIER, pas la ligne fautive.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseFeed, normalizeFeed } from "../src/lib/shop/affiliateFeed";
import catalogue from "../src/data/gear/chaussures.json";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type LigneFlux = {
  external_id: string; retailer: string; product_name: string; brand: string | null;
  category: string | null; ean: string; price: number; currency: string;
  url: string; image_url: string | null; in_stock: boolean; updated_at: string;
};

/** Les seules lignes qui pourront réellement s'afficher, dédoublonnées par code-barres. */
export function lignesUtilisables(
  offres: ReturnType<typeof normalizeFeed>, marchand: string, maintenant: string,
): LigneFlux[] {
  const parEan = new Map<string, LigneFlux>();
  for (const o of offres) {
    // ⚠️ ON NE REVÉRIFIE PAS LE PRIX NI LE LIEN : `normalizeFeed` écarte déjà toute ligne
    //    sans nom, sans lien ou sans prix positif. Vérifié par mutation — les rajouter ici
    //    ne change AUCUN résultat, et un garde qu'aucune mutation ne fait tomber laisse
    //    croire qu'un cas est traité deux fois alors qu'il ne l'est qu'une.
    //    Ce qui relève de cette fonction, c'est le code-barres et l'unicité de la clé.
    if (!o.ean) continue;
    const ligne: LigneFlux = {
      external_id: o.ean, retailer: o.retailer || marchand, product_name: o.productName,
      brand: o.brand, category: o.category, ean: o.ean, price: o.price,
      currency: o.currency || "EUR", url: o.url, image_url: o.imageUrl ?? null,
      in_stock: o.inStock, updated_at: maintenant,
    };
    const ancien = parEan.get(o.ean);
    // À code-barres égal on garde le prix le plus bas : c'est celui que la page annonce.
    if (!ancien || ligne.price < ancien.price) parEan.set(o.ean, ligne);
  }
  return [...parEan.values()];
}

/** Les codes-barres que la boutique sait afficher : la fiche retrouve ses prix par `ean`. */
export function eansDuCatalogue(): Set<string> {
  return new Set(Object.values(catalogue as Record<string, { ean?: string }>)
    .map((m) => m.ean).filter((e): e is string => Boolean(e)));
}

/**
 * Sépare les drapeaux des deux arguments attendus.
 *
 * ⚠️ SANS CELA, `--essai` PLACÉ EN PREMIER DEVIENT L'ADRESSE DU FLUX : le script part
 * télécharger « --essai », échoue, et rien n'indique que c'est la place du drapeau qui
 * était en cause. Pire s'il est placé au milieu : l'URL serait juste, le nom du marchand
 * deviendrait « --essai », et les offres s'écriraient sous un marchand inexistant.
 */
export function lireArguments(args: string[]): { url?: string; marchand?: string; essai: boolean } {
  const [url, marchand] = args.filter((a) => !a.startsWith("--"));
  return { url, marchand, essai: args.includes("--essai") };
}

export type RapportFlux = { lignes: number; avecVisuel: number; rattachees: number; modeles: number };

/**
 * Ce qu'un flux donnera VRAIMENT une fois en base.
 *
 * ⚠️ UN FLUX PARFAIT PEUT NE RIEN AFFICHER. La boutique rattache une offre à un modèle
 * PAR SON CODE-BARRES : un flux de 40 000 références de textile et de vélo s'importe sans
 * la moindre erreur, remplit la table, et ne change pas un pixel de la page. Sans ce
 * décompte, l'échec ressemble trait pour trait à une réussite — on aurait cherché la
 * panne dans l'affichage pendant que le problème était que rien ne correspondait.
 */
export function rapportFlux(lignes: LigneFlux[], eans: Set<string>): RapportFlux {
  const rattachees = lignes.filter((l) => eans.has(l.ean));
  return {
    lignes: lignes.length,
    avecVisuel: lignes.filter((l) => l.image_url).length,
    rattachees: rattachees.length,
    modeles: new Set(rattachees.map((l) => l.ean)).size,
  };
}

async function principal(): Promise<void> {
  // ⚠️ LES DRAPEAUX SONT RETIRÉS AVANT DE LIRE L'URL. Sans cela, `--essai` placé en
  // premier deviendrait l'adresse du flux et le script partirait télécharger « --essai ».
  const { url, marchand, essai } = lireArguments(process.argv.slice(2));
  if (!url || !marchand) {
    console.log('usage : npm run gear:flux -- "<url du flux>" "<nom du marchand>" [--essai]');
    console.log("  --essai : analyse le flux et n'écrit RIEN en base.");
    process.exitCode = 1; return;
  }
  console.log(`téléchargement du flux ${marchand}…`);
  const r = await fetch(url, { headers: { "User-Agent": "Pacevo/1.0 (+https://pacevo.fr)" }, signal: AbortSignal.timeout(120000) })
    .catch((e) => { console.log("flux injoignable :", String(e).slice(0, 90)); return null; });
  if (!r?.ok) { console.log(`flux inaccessible (HTTP ${r?.status ?? "?"})`); process.exitCode = 1; return; }

  const lignes = lignesUtilisables(normalizeFeed(parseFeed(await r.text()), marchand), marchand, new Date().toISOString());
  if (!lignes.length) { console.log("aucune offre exploitable — vérifie le format et les colonnes du flux"); process.exitCode = 1; return; }
  const rap = rapportFlux(lignes, eansDuCatalogue());
  console.log(`${rap.lignes} offre(s) exploitable(s) · ${rap.avecVisuel} avec un visuel`);
  console.log(`${rap.rattachees} rattachée(s) au catalogue · ${rap.modeles} modèle(s) concerné(s)`);
  if (!rap.rattachees) {
    // Écrire quand même remplirait la table sans rien changer à la page, et la prochaine
    // personne chercherait la panne dans l'affichage.
    console.log("→ AUCUNE offre ne correspond à un modèle du catalogue : la boutique ne changerait pas.");
    console.log("  Ce flux ne contient sans doute pas de chaussures, ou pas leurs codes-barres.");
    process.exitCode = 1; return;
  }
  if (essai) {
    console.log("→ essai : RIEN n'a été écrit en base. Relance sans --essai pour importer.");
    return;
  }

  // Par paquets : un flux d'affiliation compte souvent plusieurs milliers de lignes.
  for (let i = 0; i < lignes.length; i += 500) {
    const { error } = await sb.from("product_offers").upsert(lignes.slice(i, i + 500), { onConflict: "retailer,external_id" });
    if (error) { console.log("ÉCHEC :", error.message); process.exitCode = 1; return; }
  }
  const { count } = await sb.from("product_offers").select("*", { count: "exact", head: true });
  console.log(`import terminé · ${count} ligne(s) dans product_offers`);
  console.log(rap.avecVisuel ? "→ les photos s'afficheront dès le prochain chargement de la boutique."
                        : "→ ce flux ne fournit pas de visuels : le dessin aux cotes reste affiché.");
}

if (require.main === module) void principal();
