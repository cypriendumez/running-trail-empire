// ─────────────────────────────────────────────────────────────────────────────
//  Importateur de flux d'AFFILIATION (Awin / Effiliation / Kwanko / Rakuten…).
//  Légal : on ingère le FLUX OFFICIEL fourni par le réseau (prix + lien tracké +
//  image sous licence). On NE SCRAPE PAS les sites marchands.
//  Réseau-agnostique : on mappe les colonnes par alias (CSV ou XML).
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedOffer {
  externalId: string;
  productName: string;
  brand: string | null;
  retailer: string;
  price: number;
  currency: string;
  url: string;
  imageUrl: string | null;
  inStock: boolean;
  category: string | null;
  ean: string | null;
}

// Alias de colonnes par champ (minuscule). Couvre les noms standard Awin/Effiliation/Kwanko.
const ALIASES: Record<keyof FeedOffer, string[]> = {
  externalId: ["aw_product_id", "merchant_product_id", "product_id", "productid", "sku", "id", "ean", "gtin"],
  productName: ["product_name", "name", "title", "product_title", "nom", "designation", "libelle"],
  brand: ["brand_name", "brand", "marque", "manufacturer"],
  retailer: ["merchant_name", "merchant", "retailer", "advertiser", "programme", "marchand", "boutique", "shop_name"],
  price: ["search_price", "price", "store_price", "display_price", "prix", "prix_ttc", "sale_price"],
  currency: ["currency", "devise", "currency_code"],
  url: ["aw_deep_link", "deep_link", "deeplink", "merchant_deep_link", "tracked_url", "product_url", "url", "lien", "lien_tracke"],
  imageUrl: ["aw_image_url", "merchant_image_url", "large_image", "image_url", "image_large", "image", "image_grande", "picture"],
  inStock: ["in_stock", "is_in_stock", "stock", "availability", "disponibilite", "stock_status"],
  category: ["merchant_category", "category_name", "category", "categorie", "rayon"],
  ean: ["ean", "gtin", "barcode", "code_barre"],
};

const pick = (row: Record<string, string>, aliases: string[]): string => {
  for (const a of aliases) { const v = row[a]; if (v != null && String(v).trim() !== "") return String(v).trim(); }
  return "";
};

// "249,99 €" / "1.249,99" / "249.99" → nombre
function toNumber(s: string): number {
  let x = String(s).replace(/[^\d.,-]/g, "");
  if (x.includes(",") && x.includes(".")) x = x.replace(/\./g, "").replace(",", "."); // 1.249,99 → 1249.99
  else if (x.includes(",")) x = x.replace(",", "."); // 249,99 → 249.99
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

const toBool = (s: string): boolean =>
  /^(1|true|y|yes|oui|in[ _-]?stock|en[ _-]?stock|available|disponible|instock)$/i.test(String(s).trim());

// ── CSV (détecte , ; ou tab ; gère les guillemets et retours ligne échappés) ──
export function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, "");
  const nl = text.indexOf("\n");
  const head = nl >= 0 ? text.slice(0, nl) : text;
  const delim = [",", ";", "\t"].map((d) => ({ d, n: head.split(d).length })).sort((a, b) => b.n - a.n)[0];
  const sep = delim.n > 1 ? delim.d : ",";
  const rows: string[][] = [];
  let field = "", row: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

// ── XML (blocs <product>/<item>/<offer>) ──
export function parseXml(text: string): Record<string, string>[] {
  const itemRe = /<(product|item|offer|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const out: Record<string, string>[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(text))) {
    const block = m[2]; const o: Record<string, string> = {};
    const tagRe = /<([a-z0-9_:-]+)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(block))) {
      const key = t[1].toLowerCase().replace(/^[^:]*:/, "");
      const val = t[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      if (!(key in o)) o[key] = val;
    }
    out.push(o);
  }
  return out;
}

export function parseFeed(text: string): Record<string, string>[] {
  return text.trimStart().startsWith("<") ? parseXml(text) : parseCsv(text);
}

// Lignes brutes → offres normalisées (on jette les lignes inexploitables).
export function normalizeFeed(rows: Record<string, string>[], defaultRetailer = ""): FeedOffer[] {
  return rows.map((row) => {
    const stockRaw = pick(row, ALIASES.inStock);
    const name = pick(row, ALIASES.productName);
    return {
      externalId: pick(row, ALIASES.externalId) || pick(row, ALIASES.ean) || name,
      productName: name,
      brand: pick(row, ALIASES.brand) || null,
      retailer: pick(row, ALIASES.retailer) || defaultRetailer || "inconnu",
      price: toNumber(pick(row, ALIASES.price)),
      currency: pick(row, ALIASES.currency) || "EUR",
      url: pick(row, ALIASES.url),
      imageUrl: pick(row, ALIASES.imageUrl) || null,
      inStock: stockRaw ? toBool(stockRaw) : true,
      category: pick(row, ALIASES.category) || null,
      ean: pick(row, ALIASES.ean) || null,
    };
  }).filter((o) => o.productName && o.url && o.price > 0);
}
