/**
 * LA RECHERCHE DES SITES OFFICIELS — le moteur, partagé par le script et la tâche serveur
 * (03/10/2026). Les décisions vivent dans `siteOfficielWeb` (pur, testé) ; ici on cherche,
 * on lit poliment, on écrit — en LISANT chaque erreur (Supabase ne lève pas).
 *
 * Une épreuve = toutes les distances qui partagent la même fiche source. Une recherche par
 * épreuve, pas par distance. Une épreuve sans résultat n'est re-cherchée qu'après
 * `REESSAI_JOURS` : l'état vit dans `notifications` (type `ETAT_SITES_OFFICIELS`, au nom de
 * l'éditeur), comme celui du contrôle des liens.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateContent } from "@/lib/ai/gemini";
import { lirePoliment } from "./lecturePolie";
import { lirePage, deciderVeille, type CourseVeillee, type PageLue } from "./veille";
import { promptSiteOfficiel, candidatsSite, verdictSite, siteCandidatAcceptable, type EpreuveARechercher } from "./siteOfficielWeb";
import { nomCanonique } from "./groupes";
import { domaineDe } from "./destination";

export const ETAT_SITES_OFFICIELS = "sites_officiels";
export const REESSAI_JOURS = 45;
/** Les fiches dont la source ne peut pas être relue — le seul périmètre de cette recherche. */
export const MOTIF_SOURCE_FERMEE = "%jogging-plus.com%";

export type LigneCourse = CourseVeillee & { department?: string | null; registration_url: string | null; site_officiel?: string | null };
export type Epreuve = EpreuveARechercher & { cle: string; lignes: LigneCourse[] };

// ── 1. LES JUMEAUX : gratuit, sans recherche ───────────────────────────────────
//
// Mesuré le 03/10/2026 : 485 courses reprises de jogging-plus existent AUSSI chez une source
// relue (finishers), sous le même nom canonique et dans la même ville — et cette source
// connaît leur site officiel. Le rapprochement est celui que l'application utilise déjà
// pour ses doublons (`nomCanonique` + ville), jamais une ressemblance floue.

type AvecSite = { name: string; city?: string | null; site_officiel?: string | null };
const villeNorm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cleJumeau = (r: { name: string; city?: string | null }) => `${nomCanonique(r.name)}::${villeNorm(r.city)}`;

/**
 * Le site officiel que les jumeaux d'une fiche fermée s'accordent à donner — ou rien.
 * Deux jumeaux qui donnent deux sites différents (domaines distincts) : ambigu, rien.
 * Un « site » qui est un calendrier, une plateforme ou un média : rien.
 */
export function sitesDesJumeaux(fermees: readonly LigneCourse[], relues: readonly AvecSite[]): Map<string, string> {
  const parCle = new Map<string, Set<string>>();
  const exemple = new Map<string, string>();
  for (const r of relues) {
    if (!r.site_officiel || !siteCandidatAcceptable(r.site_officiel) || !villeNorm(r.city)) continue;
    const k = cleJumeau(r);
    (parCle.get(k) ?? parCle.set(k, new Set()).get(k)!).add(domaineDe(r.site_officiel));
    if (!exemple.has(k)) exemple.set(k, r.site_officiel);
  }
  const out = new Map<string, string>();
  for (const f of fermees) {
    const k = cleJumeau(f);
    const domaines = parCle.get(k);
    if (domaines?.size === 1 && villeNorm(f.city)) out.set(f.id, exemple.get(k)!);
  }
  return out;
}

/** Applique les jumeaux : `site_officiel` seulement — la veille relira la page ensuite. */
export async function appliquerJumeaux(sb: SupabaseClient, ecrire: boolean): Promise<{ trouves: number; ecrits: number; erreurs: number; exemples: string[] }> {
  const fermees: LigneCourse[] = [];
  const relues: (AvecSite & { registration_url?: string | null })[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("races").select("id, name, city, date, distance_km, registration_url, site_officiel").order("id").range(de, de + 999);
    if (error) throw new Error(`courses illisibles : ${error.message}`);
    for (const r of (data ?? []) as LigneCourse[]) {
      const fermee = /jogging-plus\.com/i.test(String(r.registration_url ?? ""));
      if (fermee && !r.site_officiel) fermees.push(r);
      else if (!fermee && r.site_officiel) relues.push(r);
    }
    if (!data || data.length < 1000) break;
  }
  const sites = sitesDesJumeaux(fermees, relues);
  const bilan = { trouves: sites.size, ecrits: 0, erreurs: 0, exemples: [] as string[] };
  for (const f of fermees) {
    const site = sites.get(f.id);
    if (!site) continue;
    if (bilan.exemples.length < 10) bilan.exemples.push(`${f.name} (${f.city ?? "?"}) → ${site}`);
    if (!ecrire) continue;
    const { error } = await sb.from("races").update({ site_officiel: site }).eq("id", f.id);
    if (error) { bilan.erreurs++; console.error("[jumeaux] écriture impossible :", f.id, error.message); } else bilan.ecrits++;
  }
  return bilan;
}

// ── 2. LA RECHERCHE WEB : pour ce que les jumeaux ne couvrent pas ──────────────

/** Regroupe les distances d'une même épreuve (même fiche source). */
export function epreuvesDepuisLignes(lignes: readonly LigneCourse[]): Epreuve[] {
  const parCle = new Map<string, LigneCourse[]>();
  for (const l of lignes) {
    const cle = String(l.registration_url ?? "").split(/[?#]/)[0] || `id:${l.id}`;
    (parCle.get(cle) ?? parCle.set(cle, []).get(cle)!).push(l);
  }
  return [...parCle].map(([cle, ls]) => {
    const noms = new Map<string, number>();
    for (const l of ls) noms.set(l.name, (noms.get(l.name) ?? 0) + 1);
    const nom = [...noms].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    const datees = ls.map((l) => String(l.date ?? "")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !d.startsWith("2099")).sort();
    return {
      cle, lignes: ls, nom,
      ville: ls[0].city ?? null,
      departement: ls[0].department ?? null,
      date: datees[0] ?? null,
      distances: ls.map((l) => Number(l.distance_km) || 0).filter((x) => x > 0),
    };
  });
}

/** Les épreuves à chercher maintenant : datées d'abord (la plus proche), puis les « à venir » ; jamais une essayée récemment. */
export function epreuvesAChercher(eps: readonly Epreuve[], essais: Record<string, string>, aujourdhui: string, lot: number): Epreuve[] {
  const recent = (cle: string) => {
    const j = essais[cle];
    return !!j && (Date.parse(`${aujourdhui}T12:00:00Z`) - Date.parse(`${j}T12:00:00Z`)) / 864e5 < REESSAI_JOURS;
  };
  return eps
    .filter((e) => !recent(e.cle) && !(e.date && e.date < aujourdhui))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.cle.localeCompare(b.cle))
    .slice(0, Math.max(0, lot));
}

export type Recherche = {
  url: string | null; force?: string; motif: string; indisponible?: boolean;
  candidats: { url: string; motif: string }[]; page?: PageLue;
};

type Dependances = {
  generer?: typeof generateContent;
  lire?: (url: string, init?: RequestInit) => Promise<Response | null>;
};

/** Cherche, LIT et juge les candidats ; rend le premier qui passe tous les contrôles. */
export async function chercherSiteOfficiel(e: EpreuveARechercher, aujourdhui: string, deps: Dependances = {}): Promise<Recherche> {
  const generer = deps.generer ?? generateContent;
  const lire = deps.lire ?? lirePoliment;
  const rech = await generer(
    [{ role: "user", parts: [{ text: promptSiteOfficiel(e) }] }],
    { temperature: 0, maxOutputTokens: 1500 },
    { tools: [{ google_search: {} }] },
  );
  if (!rech.ok) return { url: null, motif: "modèle indisponible", indisponible: true, candidats: [] };
  const candidats: Recherche["candidats"] = [];
  for (const url of candidatsSite(rech.text, rech.sources ?? [])) {
    let r: Response | null = null;
    try { r = await lire(url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "Accept-Language": "fr-FR" } }); }
    catch { r = null; }
    if (!r) { candidats.push({ url, motif: "illisible, ou refusé par robots.txt" }); continue; }
    if (!r.ok || !/html/i.test(r.headers.get("content-type") ?? "")) {
      candidats.push({ url, motif: `réponse ${r.status}` });
      try { await r.body?.cancel(); } catch { /* */ }
      continue;
    }
    // Une adresse qui REDIRIGE vers un calendrier ou une plateforme n'est pas l'organisateur.
    const finale = r.url || url;
    if (!siteCandidatAcceptable(finale)) { candidats.push({ url, motif: `redirige vers ${finale}` }); continue; }
    const page = lirePage((await r.text()).slice(0, 1_500_000), finale, aujourdhui);
    const v = verdictSite(e, page);
    if (v.ok) return { url: finale, force: v.force, motif: "trouvé", candidats: [...candidats, { url: finale, motif: `retenu (${v.force})` }], page };
    candidats.push({ url: finale, motif: v.motif });
  }
  return { url: null, motif: candidats.length ? "aucun candidat ne passe les contrôles" : "aucun site proposé", candidats };
}

/** Ce qu'il faut écrire sur chaque ligne de l'épreuve : le site, et ce que la veille en tire déjà. */
export function patchsPourEpreuve(ep: Epreuve, url: string, page: PageLue, aujourdhui: string): { id: string; patch: Record<string, unknown> }[] {
  return ep.lignes.map((l) => ({
    id: l.id,
    patch: { site_officiel: url, ...deciderVeille(l, page, aujourdhui, { confirmee: true, parcours: true }), veille_at: new Date().toISOString() },
  }));
}

export type BilanLot = {
  cherchees: number; trouvees: number; lignesMisesAJour: number; erreursEcriture: number; indisponible: boolean;
  details: { nom: string; ville: string | null; date: string | null; url: string | null; force?: string; motif: string; candidats: Recherche["candidats"]; patchs?: Record<string, unknown>[] }[];
};

/**
 * Un lot complet : lire les fiches à source fermée sans site officiel, chercher, écrire.
 * `ecrire: false` = à blanc (rien en base, ni l'état). S'arrête dès que le modèle est
 * indisponible (quota) : chercher sans lui n'a pas de sens, et l'état n'est pas consommé.
 */
export async function traiterLot(sb: SupabaseClient, o: { proprietaire: string; aujourdhui: string; lot: number; ecrire: boolean; deps?: Dependances }): Promise<BilanLot> {
  const lignes: LigneCourse[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("races")
      .select("id, name, city, department, date, date_confirmee, distance_km, registration_url, site_officiel, inscription_url, resultats_url, resultats_annee, parcours_url")
      .like("registration_url", MOTIF_SOURCE_FERMEE).is("site_officiel", null).order("id").range(de, de + 999);
    if (error) throw new Error(`courses illisibles : ${error.message}`);
    lignes.push(...((data ?? []) as LigneCourse[]));
    if (!data || data.length < 1000) break;
  }
  const { data: etatLigne, error: eEtat } = await sb.from("notifications").select("id, data")
    .eq("user_id", o.proprietaire).eq("type", ETAT_SITES_OFFICIELS).maybeSingle();
  if (eEtat) throw new Error(`état illisible : ${eEtat.message}`);
  const essais: Record<string, string> = { ...(((etatLigne?.data ?? {}) as { essais?: Record<string, string> }).essais ?? {}) };

  const bilan: BilanLot = { cherchees: 0, trouvees: 0, lignesMisesAJour: 0, erreursEcriture: 0, indisponible: false, details: [] };
  for (const ep of epreuvesAChercher(epreuvesDepuisLignes(lignes), essais, o.aujourdhui, o.lot)) {
    const r = await chercherSiteOfficiel(ep, o.aujourdhui, o.deps);
    if (r.indisponible) { bilan.indisponible = true; break; }
    bilan.cherchees++;
    essais[ep.cle] = o.aujourdhui;
    const patchs = r.url && r.page ? patchsPourEpreuve(ep, r.url, r.page, o.aujourdhui) : [];
    if (r.url) bilan.trouvees++;
    bilan.details.push({ nom: ep.nom, ville: ep.ville, date: ep.date, url: r.url, force: r.force, motif: r.motif, candidats: r.candidats, patchs: patchs.map((p) => p.patch) });
    if (!o.ecrire) continue;
    for (const { id, patch } of patchs) {
      const { error } = await sb.from("races").update(patch).eq("id", id);
      if (error) { bilan.erreursEcriture++; console.error("[sites officiels] écriture impossible :", id, error.message); }
      else bilan.lignesMisesAJour++;
    }
  }
  if (o.ecrire && bilan.cherchees > 0) {
    const data = { essais };
    const { error } = etatLigne
      ? await sb.from("notifications").update({ data }).eq("id", etatLigne.id)
      : await sb.from("notifications").insert({ user_id: o.proprietaire, type: ETAT_SITES_OFFICIELS, title: "État — sites officiels", body: "", data, read: true });
    if (error) console.error("[sites officiels] état non enregistré :", error.message);
  }
  return bilan;
}
