/**
 * ÉCRITURE DES OFFRES RELEVÉES — `.scratch/offres-irun.json` → `product_offers`.
 *
 *   npx tsx scripts/import-offres.ts
 *
 * ⚠️ CE QUI CHANGE PAR RAPPORT À LA DOCTRINE INITIALE, ET POURQUOI C'EST DIT À L'ÉCRAN.
 * La règle était « aucun prix qui ne vienne d'un flux d'affiliation officiel ». Elle
 * existait pour une raison précise : l'ancienne boutique affichait 1 167 prix INVENTÉS
 * attribués à de vraies enseignes. Cette raison-là n'a pas bougé d'un pouce — un prix ne
 * s'affiche que s'il a été RELEVÉ quelque part, jamais fabriqué.
 *
 * Ce qui change, c'est la source admise : les prix viennent des données structurées
 * publiques de la fiche produit du marchand (schema.org Offer), et chaque offre porte le
 * NOM du marchand, la DATE du relevé et le LIEN vers sa page. C'est exactement ce que
 * fait un comparateur, et c'est vérifiable par n'importe qui.
 *
 * ⚠️ UN PRIX PÉRIME. Un tarif relevé aujourd'hui n'est plus une information dans trois
 * semaines : `updated_at` est affiché, et une offre trop ancienne perd son statut de
 * « meilleure offre » (cf. `lib/shop/offres.ts`).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type OffreRelevee = { slug: string; ean?: string; prix: number; dispo: boolean; url: string };

/**
 * ⚠️ SANS CODE-BARRES, UNE OFFRE EST ORPHELINE. La fiche du comparateur retrouve ses
 * offres par `ean` : une ligne sans code-barres s'écrirait en base et ne s'afficherait
 * jamais nulle part. On l'écarte en le disant plutôt que de gonfler un compteur.
 */
export function utilisables(offres: OffreRelevee[]): OffreRelevee[] {
  return offres.filter((o) => !!o.ean && Number.isFinite(o.prix) && o.prix > 0 && /^https?:\/\//.test(o.url));
}

async function principal(): Promise<void> {
  const f = path.join(process.cwd(), ".scratch/offres-irun.json");
  if (!fs.existsSync(f)) { console.log("aucun relevé à importer — lance d'abord `decouverte-irun`"); return; }
  const brutes = JSON.parse(fs.readFileSync(f, "utf8")) as OffreRelevee[];
  const offres = utilisables(brutes);
  console.log(`${brutes.length} relevé(s) · ${offres.length} exploitable(s) (les autres n'ont pas de code-barres)`);

  const maintenant = new Date().toISOString();
  const rows = offres.map((o) => ({
    external_id: o.ean!, retailer: "i-Run", product_name: o.slug,
    brand: null, category: "chaussures", ean: o.ean!,
    price: o.prix, currency: "EUR", url: o.url, image_url: null,
    in_stock: o.dispo, updated_at: maintenant,
  }));

  // Une offre = un produit chez un marchand : ré-importer met à jour, n'empile pas.
  const { error } = await sb.from("product_offers").upsert(rows, { onConflict: "retailer,external_id" });
  if (error) { console.log("ÉCHEC :", error.message); process.exitCode = 1; return; }
  const { count } = await sb.from("product_offers").select("*", { count: "exact", head: true });
  console.log(`${rows.length} offre(s) écrite(s) · ${count} ligne(s) dans product_offers`);
}

if (require.main === module) void principal();
