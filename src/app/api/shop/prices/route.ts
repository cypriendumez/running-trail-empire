export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PriceEntry {
  retailer: string;
  retailer_name: string;
  price: number;
  url: string;
  in_stock: boolean;
  last_updated: string;
  simulated?: boolean;
}

// ── Baseline prices database ───────────────────────────────────────────────────
// Curated baseline prices per product (shown when API is unavailable)
const BASELINE_PRICES: Record<string, PriceEntry[]> = {
  // ── Nike Route ────────────────────────────────────────────────────────────────
  r1: [
    { retailer: "i-run",     retailer_name: "i-Run",     price: 249.99, url: "https://www.i-run.fr/chaussures-de-running/nike-vaporfly-3/", in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 244.99, url: "https://www.alltricks.fr/search?q=nike+vaporfly+3",          in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 249.99, url: "https://www.lepape.com/search?q=nike+vaporfly+3",            in_stock: false, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 239.99, url: "https://www.ekosport.fr/search?q=nike+vaporfly+3",          in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 259.99, url: "https://www.decathlon.fr/search?Ntt=nike+vaporfly+3",        in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  r2: [
    { retailer: "i-run",     retailer_name: "i-Run",     price: 319.99, url: "https://www.i-run.fr/chaussures-de-running/nike-alphafly-3/", in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 309.99, url: "https://www.alltricks.fr/search?q=nike+alphafly+3",           in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 319.99, url: "https://www.lepape.com/search?q=nike+alphafly+3",             in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 315.00, url: "https://www.ekosport.fr/search?q=nike+alphafly+3",           in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  r3: [
    { retailer: "decathlon", retailer_name: "Décathlon", price: 229.99, url: "https://www.decathlon.fr/search?Ntt=adizero+adios+pro+3",    in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 219.99, url: "https://www.i-run.fr/search?q=adizero+adios+pro+3",          in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 224.99, url: "https://www.alltricks.fr/search?q=adizero+adios+pro+3",      in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 214.99, url: "https://www.ekosport.fr/search?q=adizero+adios+pro+3",      in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
  ],
  r4: [
    { retailer: "lepape",    retailer_name: "Lepape",    price: 249.99, url: "https://www.lepape.com/search?q=hoka+rocket+x+2",            in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 244.99, url: "https://www.i-run.fr/search?q=hoka+rocket+x+2",             in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 239.99, url: "https://www.alltricks.fr/search?q=hoka+rocket+x+2",         in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 249.99, url: "https://www.ekosport.fr/search?q=hoka+rocket+x+2",          in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  r5: [
    { retailer: "i-run",     retailer_name: "i-Run",     price: 299.99, url: "https://www.i-run.fr/search?q=asics+metaspeed+sky+paris",    in_stock: false, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 279.99, url: "https://www.ekosport.fr/search?q=asics+metaspeed+sky+paris", in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 289.99, url: "https://www.lepape.com/search?q=asics+metaspeed+sky+paris",  in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
  ],
  r6: [
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 219.99, url: "https://www.ekosport.fr/search?q=saucony+endorphin+pro+3",  in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 214.99, url: "https://www.i-run.fr/search?q=saucony+endorphin+pro+3",     in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 209.99, url: "https://www.alltricks.fr/search?q=saucony+endorphin+pro+3", in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 224.99, url: "https://www.lepape.com/search?q=saucony+endorphin+pro+3",   in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  r7: [
    { retailer: "alltricks", retailer_name: "Alltricks", price: 259.99, url: "https://www.alltricks.fr/search?q=new+balance+fuelcell+supercomp+elite+v4", in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 249.99, url: "https://www.i-run.fr/search?q=fuelcell+supercomp+elite+v4",                  in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 254.99, url: "https://www.lepape.com/search?q=new+balance+fuelcell+supercomp+elite+v4",    in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 244.99, url: "https://www.ekosport.fr/search?q=new+balance+fuelcell+supercomp+elite+v4",  in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  r8: [
    { retailer: "lepape",    retailer_name: "Lepape",    price: 179.99, url: "https://www.lepape.com/search?q=hoka+mach+x+2",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 174.99, url: "https://www.i-run.fr/search?q=hoka+mach+x+2",      in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 169.99, url: "https://www.alltricks.fr/search?q=hoka+mach+x+2",  in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 184.99, url: "https://www.decathlon.fr/search?Ntt=hoka+mach+x+2", in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  r9: [
    { retailer: "i-run",     retailer_name: "i-Run",     price: 139.99, url: "https://www.i-run.fr/search?q=brooks+ghost+16",     in_stock: false, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 134.99, url: "https://www.alltricks.fr/search?q=brooks+ghost+16", in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 139.99, url: "https://www.lepape.com/search?q=brooks+ghost+16",   in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 129.99, url: "https://www.decathlon.fr/search?Ntt=brooks+ghost+16", in_stock: true, last_updated: new Date().toISOString(), simulated: true },
  ],
  // ── Trail ─────────────────────────────────────────────────────────────────────
  t1: [
    { retailer: "i-run",     retailer_name: "i-Run",     price: 249.99, url: "https://www.i-run.fr/search?q=salomon+slab+ultra+3",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 239.99, url: "https://www.ekosport.fr/search?q=salomon+slab+ultra+3",  in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 244.99, url: "https://www.alltricks.fr/search?q=salomon+slab+ultra+3", in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 249.99, url: "https://www.lepape.com/search?q=salomon+slab+ultra+3",   in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  t2: [
    { retailer: "alltricks", retailer_name: "Alltricks", price: 169.99, url: "https://www.alltricks.fr/search?q=hoka+speedgoat+6",  in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 164.99, url: "https://www.i-run.fr/search?q=hoka+speedgoat+6",     in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 179.99, url: "https://www.decathlon.fr/search?Ntt=hoka+speedgoat+6", in_stock: false, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 174.99, url: "https://www.lepape.com/search?q=hoka+speedgoat+6",   in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
  ],
  t3: [
    { retailer: "lepape",    retailer_name: "Lepape",    price: 169.99, url: "https://www.lepape.com/search?q=inov8+trailfly+g+270+v2",   in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 164.99, url: "https://www.ekosport.fr/search?q=inov8+trailfly+g+270+v2",  in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 169.99, url: "https://www.i-run.fr/search?q=inov8+trailfly+g+270+v2",    in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  t4: [
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 149.99, url: "https://www.ekosport.fr/search?q=salomon+ultra+glide+2",   in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 144.99, url: "https://www.i-run.fr/search?q=salomon+ultra+glide+2",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 139.99, url: "https://www.alltricks.fr/search?q=salomon+ultra+glide+2", in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 154.99, url: "https://www.decathlon.fr/search?Ntt=salomon+ultra+glide+2", in_stock: true, last_updated: new Date().toISOString(), simulated: true },
  ],
  // ── Watches ───────────────────────────────────────────────────────────────────
  w1: [
    { retailer: "i-run",     retailer_name: "i-Run",     price: 849.99, url: "https://www.i-run.fr/search?q=garmin+fenix+7+pro+solar",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 829.99, url: "https://www.alltricks.fr/search?q=garmin+fenix+7+pro+solar", in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 849.99, url: "https://www.lepape.com/search?q=garmin+fenix+7+pro+solar",   in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 869.99, url: "https://www.decathlon.fr/search?Ntt=garmin+fenix+7+pro",     in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  w2: [
    { retailer: "alltricks", retailer_name: "Alltricks", price: 699.99, url: "https://www.alltricks.fr/search?q=coros+vertix+2s",  in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 689.99, url: "https://www.i-run.fr/search?q=coros+vertix+2s",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "ekosport",  retailer_name: "Ekosport",  price: 679.99, url: "https://www.ekosport.fr/search?q=coros+vertix+2s",  in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "lepape",    retailer_name: "Lepape",    price: 699.99, url: "https://www.lepape.com/search?q=coros+vertix+2s",   in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
  w3: [
    { retailer: "lepape",    retailer_name: "Lepape",    price: 599.99, url: "https://www.lepape.com/search?q=garmin+forerunner+965",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "alltricks", retailer_name: "Alltricks", price: 579.99, url: "https://www.alltricks.fr/search?q=garmin+forerunner+965", in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "i-run",     retailer_name: "i-Run",     price: 589.99, url: "https://www.i-run.fr/search?q=garmin+forerunner+965",     in_stock: true, last_updated: new Date().toISOString(), simulated: true },
    { retailer: "decathlon", retailer_name: "Décathlon", price: 619.99, url: "https://www.decathlon.fr/search?Ntt=garmin+forerunner+965", in_stock: false, last_updated: new Date().toISOString(), simulated: true },
  ],
};

// ── Fallback generator for products not in baseline ────────────────────────────
function generateFallbackPrices(productId: string, basePrice: number): PriceEntry[] {
  const retailers = [
    { retailer: "i-run",     retailer_name: "i-Run",     multiplier: 1.00 },
    { retailer: "alltricks", retailer_name: "Alltricks", multiplier: 0.97 },
    { retailer: "lepape",    retailer_name: "Lepape",    multiplier: 1.02 },
    { retailer: "ekosport",  retailer_name: "Ekosport",  multiplier: 0.98 },
    { retailer: "decathlon", retailer_name: "Décathlon", multiplier: 1.05 },
  ];

  // Use productId hash to deterministically select 3–4 retailers
  const hash = productId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = 3 + (hash % 2); // 3 or 4
  const selected = retailers.slice(0, count);

  return selected.map((r, idx) => ({
    retailer: r.retailer,
    retailer_name: r.retailer_name,
    price: Math.round(basePrice * r.multiplier * 100) / 100,
    url: `https://www.${r.retailer === "i-run" ? "i-run.fr" : r.retailer === "alltricks" ? "alltricks.fr" : r.retailer === "lepape" ? "lepape.com" : r.retailer === "ekosport" ? "ekosport.fr" : "decathlon.fr"}/search?q=${productId}`,
    in_stock: idx !== 2, // third option out of stock
    last_updated: new Date().toISOString(),
    simulated: true,
  }));
}

// ── Attempt real price fetch from Decathlon ────────────────────────────────────
async function tryDecathlonPrices(query: string): Promise<PriceEntry[]> {
  try {
    const url = `https://www.decathlon.fr/catalog/api/search?query=${encodeURIComponent(query)}&limit=3`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    // Decathlon API returns products array
    const products = json?.products ?? json?.hits ?? [];
    if (!Array.isArray(products) || products.length === 0) return [];

    return [{
      retailer: "decathlon",
      retailer_name: "Décathlon",
      price: products[0]?.price ?? products[0]?.price_text ?? 0,
      url: `https://www.decathlon.fr/search?Ntt=${encodeURIComponent(query)}`,
      in_stock: products[0]?.available ?? true,
      last_updated: new Date().toISOString(),
      simulated: false,
    }];
  } catch {
    return [];
  }
}

// ── Main GET handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("product_id");
  const query     = searchParams.get("q");

  if (!productId && !query) {
    return NextResponse.json({ error: "product_id or q required" }, { status: 400 });
  }

  // 1. Check if we have baseline data for this product
  if (productId && BASELINE_PRICES[productId]) {
    const prices = BASELINE_PRICES[productId].sort((a, b) => a.price - b.price);
    return NextResponse.json({
      product_id: productId,
      prices,
      source: "baseline",
      cached: false,
    });
  }

  // 2. Try real retailer fetch if query provided
  if (query) {
    const [decathlonPrices] = await Promise.allSettled([
      tryDecathlonPrices(query),
    ]);

    const realPrices: PriceEntry[] = [
      ...(decathlonPrices.status === "fulfilled" ? decathlonPrices.value : []),
    ];

    if (realPrices.length > 0) {
      // Supplement with simulated entries for other retailers
      const existingRetailers = new Set(realPrices.map(p => p.retailer));
      const basePrice = realPrices[0].price;

      const supplemental: PriceEntry[] = [
        { retailer: "i-run",     retailer_name: "i-Run",     price: Math.round(basePrice * 0.98 * 100) / 100, url: `https://www.i-run.fr/search?q=${encodeURIComponent(query)}`,     in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
        { retailer: "alltricks", retailer_name: "Alltricks", price: Math.round(basePrice * 0.96 * 100) / 100, url: `https://www.alltricks.fr/search?q=${encodeURIComponent(query)}`, in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
        { retailer: "lepape",    retailer_name: "Lepape",    price: Math.round(basePrice * 1.01 * 100) / 100, url: `https://www.lepape.com/search?q=${encodeURIComponent(query)}`,   in_stock: false, last_updated: new Date().toISOString(), simulated: true },
        { retailer: "ekosport",  retailer_name: "Ekosport",  price: Math.round(basePrice * 0.97 * 100) / 100, url: `https://www.ekosport.fr/search?q=${encodeURIComponent(query)}`,  in_stock: true,  last_updated: new Date().toISOString(), simulated: true },
      ].filter(p => !existingRetailers.has(p.retailer));

      const allPrices = [...realPrices, ...supplemental].sort((a, b) => a.price - b.price);

      return NextResponse.json({
        product_id: productId,
        prices: allPrices,
        source: "mixed",
        cached: false,
      });
    }
  }

  // 3. Fallback: generate baseline prices from product ID
  if (productId) {
    // Parse a base price from the product id pattern (we don't have it here — use 150 as safe default)
    const prices = generateFallbackPrices(productId, 150).sort((a, b) => a.price - b.price);
    return NextResponse.json({
      product_id: productId,
      prices,
      source: "simulated",
      cached: false,
    });
  }

  return NextResponse.json({ error: "Could not fetch prices", prices: [] }, { status: 500 });
}
