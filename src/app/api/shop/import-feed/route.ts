export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFeed, normalizeFeed } from "@/lib/shop/affiliateFeed";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET/POST /api/shop/import-feed?url=<flux>&retailer=<nom>
// Récupère un FLUX D'AFFILIATION OFFICIEL (Awin/Effiliation/…), le normalise et l'upsert
// dans product_offers. Protégé par CRON_SECRET ou ADMIN_SECRET. Ne scrape aucun site.
async function handle(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET && secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const retailer = searchParams.get("retailer") ?? "";
  if (!url) return NextResponse.json({ error: "Param ?url= requis (URL du flux d'affiliation)." }, { status: 400 });

  let text: string;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { "User-Agent": "RunningTrailEmpire-FeedImporter/1.0" } });
    if (!r.ok) return NextResponse.json({ error: `Flux inaccessible (HTTP ${r.status}).` }, { status: 502 });
    text = await r.text();
  } catch (e) {
    return NextResponse.json({ error: "Téléchargement du flux impossible : " + (e as Error).message }, { status: 502 });
  }

  const offers = normalizeFeed(parseFeed(text), retailer);
  if (!offers.length) {
    return NextResponse.json({ ok: false, error: "Aucune offre exploitable (vérifie le format/les colonnes du flux)." }, { status: 200 });
  }

  const rows = offers.slice(0, 5000).map((o) => ({
    external_id: o.externalId, retailer: o.retailer, product_name: o.productName,
    brand: o.brand, category: o.category, ean: o.ean,
    price: Math.min(99999.99, o.price), currency: o.currency,
    url: o.url, image_url: o.imageUrl, in_stock: o.inStock, updated_at: new Date().toISOString(),
  }));

  const admin = createAdminClient();
  const { error } = await admin.from("product_offers").upsert(rows, { onConflict: "retailer,external_id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message, hint: "La table product_offers existe-t-elle ? (SQL à lancer dans Supabase)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, imported: rows.length, retailers: [...new Set(rows.map((r) => r.retailer))] });
}

export const GET = handle;
export const POST = handle;
