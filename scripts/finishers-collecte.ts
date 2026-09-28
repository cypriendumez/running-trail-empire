/**
 * COLLECTE DES FICHES finishers.com — étape 1 (lente, polie, reprenable).
 *
 * Pourquoi : le catalogue n'importait plus RIEN depuis le 10/06/2026 (jogging-plus est
 * derrière un défi anti-robot). Mesuré le 28/09/2026 : 7 002 événements du plan du site
 * finishers absents de la base, 7 994 formats en « Date à venir », 6 897 trails sans
 * dénivelé et 510 à « 0 m ». Les fiches finishers portent tout cela, format par format.
 *
 * Ce que dit leur robots.txt : `/course/*` n'est PAS interdit (seuls `/account*`,
 * `/book*`, `/docs*` et des filtres de recherche le sont) ; le plan du site est public.
 * On s'identifie, on espace les requêtes, on recule quand le serveur le demande.
 *
 * Étape 1 = LIRE et mettre en cache (JSONL, une ligne par événement), rien d'autre.
 * L'écriture en base est une étape séparée (`finishers-appliquer.ts`), relisible avant.
 *
 *   npx tsx scripts/finishers-collecte.ts <fichier-slugs> <sortie.jsonl>
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";

const UA = "Mozilla/5.0 (compatible; PacevoBot/1.0; +https://pacevo.fr/contact)";
const PAUSE_MS = 1200;

type Format = { id: string; titre: string | null; discipline: string | null; distanceM: number | null; dplus: number | null; date: string | null; heure: string | null; inscription: string | null; statut: string | null };
export type FicheFinishers = {
  slug: string; ok: boolean; http?: number;
  pays?: string | null; nom?: string; ville?: string | null; departement?: string | null; region?: string | null;
  lat?: number | null; lon?: number | null;
  derniere?: { annee: number; debut: string | null; statut: string | null } | null;
  prochaine?: { annee: number; debut: string | null; statut: string | null } | null;
  formats?: Format[];
  siteOfficiel?: string | null; inscription?: string | null;
  resultats?: { page: string | null; classement: string | null } | null;
  lueLe: string;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `/external?url=…` → l'adresse réelle ; une adresse directe reste telle quelle. */
function lienReel(brut: unknown): string | null {
  const s = typeof brut === "string" ? brut : null;
  if (!s) return null;
  if (s.startsWith("/external")) {
    const u = new URL(`https://www.finishers.com${s}`).searchParams.get("url");
    return u && /^https?:\/\//.test(u) ? u : null;
  }
  return /^https?:\/\//.test(s) ? s : null;
}

export function lireFiche(slug: string, html: string): FicheFinishers {
  const lueLe = new Date().toISOString();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { slug, ok: false, lueLe };
  const pp = JSON.parse(m[1])?.props?.pageProps ?? {};
  const ev = pp.event ?? {};
  const fil = Array.isArray(ev.breadcrumb) ? ev.breadcrumb : [];
  const ville = fil.find((b: { type?: string }) => b.type === "city")?.label ?? null;
  // `coordinates` (point exact) quand il existe, sinon le centre de la ville ({ lat, lng }).
  const pt = (c: unknown): [number | null, number | null] => {
    const o = c as { lat?: unknown; lng?: unknown; coordinates?: unknown } | null;
    if (o && typeof o.lat === "number" && typeof o.lng === "number") return [o.lat, o.lng];
    if (o && Array.isArray(o.coordinates) && typeof o.coordinates[1] === "number") return [o.coordinates[1] as number, o.coordinates[0] as number];
    return [null, null];
  };
  const [lat, lon] = pt(ev.coordinates)[0] != null ? pt(ev.coordinates) : pt(ev.cityCoordinates);
  const niveau = (t: string) => fil.find((b: { type?: string }) => b.type === t)?.label ?? null;
  const edition = (e: unknown) => {
    const x = e as { year?: number; status?: string; dateRange?: { start?: string } } | null;
    return x && x.year ? { annee: x.year, debut: x.dateRange?.start ?? null, statut: x.status ?? null } : null;
  };
  const formats: Format[] = (Array.isArray(pp.races) ? pp.races : []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? r.raceId ?? ""),
    titre: (r.formattedTitle as string) ?? (r.name as string) ?? null,
    discipline: (r.discipline as string) ?? null,
    distanceM: typeof r.distance === "number" ? (r.distanceUnit === "miles" ? Math.round((r.distance as number) * 1609.344) : r.distance as number) : null,
    dplus: typeof r.elevationGain === "number" ? (r.elevationGain as number) : null,
    date: (r.date as string) ?? null,
    heure: typeof r.time === "string" ? (r.time as string).slice(0, 5) : null,
    inscription: lienReel(r.registrationUrl),
    statut: (r.status as string) ?? null,
  }));
  // Page « résultats » éditoriale, et le lien de classement complet (chronométreur) qu'elle cite.
  const sous = (Array.isArray(pp.customSubPages) ? pp.customSubPages : []).find((c: { slug?: string; name?: string }) =>
    /r[ée]sultat|classement/i.test(`${c.slug ?? ""} ${c.name ?? ""}`));
  const page = sous?.href ? `https://www.finishers.com${sous.href}` : null;
  const texte = String(sous?.longDescription ?? "");
  const classement = (texte.match(/href=\\?"(https?:\/\/[^"\\]+)/g) ?? [])
    .map((h) => h.replace(/^href=\\?"/, ""))
    .find((u) => !/finishers\.com|kavval:/.test(u)) ?? null;
  return {
    slug, ok: true,
    pays: ev.countryName?.code ?? null,
    nom: ev.name, ville, departement: niveau("level2AdminArea"), region: niveau("level1AdminArea"),
    lat: typeof lat === "number" ? lat : null, lon: typeof lon === "number" ? lon : null,
    derniere: edition(pp.lastEdition), prochaine: edition(pp.nextEdition),
    formats,
    siteOfficiel: lienReel(ev.links?.website), inscription: lienReel(ev.links?.registration),
    resultats: page || classement ? { page, classement } : null,
    lueLe,
  };
}

async function main() {
  const [fSlugs, sortie] = process.argv.slice(2);
  const slugs = readFileSync(fSlugs, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  const faits = new Set<string>();
  if (existsSync(sortie)) for (const l of readFileSync(sortie, "utf8").split("\n")) { try { const o = JSON.parse(l); if (o?.slug) faits.add(o.slug); } catch { /* ligne tronquée */ } }
  const reste = slugs.filter((s) => !faits.has(s));
  console.log(`[collecte] ${slugs.length} slugs, ${faits.size} déjà lus, ${reste.length} à lire`);
  let recul = 60_000, n = 0;
  for (const slug of reste) {
    let essai = 0;
    for (;;) {
      let r: Response | null = null;
      try { r = await fetch(`https://www.finishers.com/course/${encodeURIComponent(slug)}`, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, signal: AbortSignal.timeout(20000) }); } catch { r = null; }
      if (r && r.ok) {
        const fiche = lireFiche(slug, await r.text());
        appendFileSync(sortie, JSON.stringify(fiche) + "\n");
        recul = 60_000; break;
      }
      const code = r?.status ?? 0;
      if (code === 404 || code === 410) { appendFileSync(sortie, JSON.stringify({ slug, ok: false, http: code, lueLe: new Date().toISOString() }) + "\n"); break; }
      // 403 / 429 / 5xx / réseau : le serveur demande de ralentir — on recule, sans insister.
      essai++;
      if (essai > 4) { appendFileSync(sortie, JSON.stringify({ slug, ok: false, http: code, lueLe: new Date().toISOString() }) + "\n"); break; }
      console.log(`[collecte] ${slug} → ${code}, pause ${Math.round(recul / 1000)} s`);
      await dormir(recul); recul = Math.min(recul * 2, 15 * 60_000);
    }
    n++;
    if (n % 100 === 0) console.log(`[collecte] ${n}/${reste.length} (${new Date().toLocaleTimeString("fr-FR")})`);
    await dormir(PAUSE_MS + Math.random() * 400);
  }
  console.log("[collecte] terminé");
}

if (process.argv[1]?.endsWith("finishers-collecte.ts")) main().catch((e) => { console.error(e); process.exit(1); });
