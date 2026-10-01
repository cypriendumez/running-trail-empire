/**
 * LA VEILLE À LA CONSULTATION — quand un coureur ouvre une fiche (01/10/2026).
 *
 * Le robot quotidien passe une fois par jour ; un classement publié à 18 h serait vu le
 * lendemain. Ici, l'ouverture d'une fiche relance la lecture de SA page officielle, en
 * arrière-plan (`after()` dans `/api/races/detail` : la fiche s'affiche sans attendre) —
 * le lien est en base pour la visite suivante, et pour tous les autres coureurs.
 *
 * ⚠️ AU PLUS UNE LECTURE PAR FENÊTRE (`veille_at`, migration 034) : 6 h pour une course qui
 * vient d'avoir lieu ou approche, 3 jours sinon. Sans la colonne, rien ne se lance — une
 * fiche très consultée relirait sinon le site de l'organisateur à chaque visite.
 * Même politesse que les robots : robots.txt respecté, délai court, une panne ne décide rien.
 * Serveur uniquement (client de service).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { pageOfficielle, lirePage, deciderVeille, type CourseVeillee } from "./veille";
import { robotsAutorise } from "./resultatsSite";
import { reponseIncertaine } from "./editionsResultats";
import { jourFrance } from "./jourFrance";

const UA = "Mozilla/5.0 (compatible; PacevoBot/1.0; +https://pacevo.fr/contact)";
const HEURE = 3600_000;

/** Combien de temps une lecture reste fraîche : 6 h autour de la course (J-60 à J+12), 3 jours sinon. */
export function fraicheurVeille(date: string | null | undefined, aujourdhui: string): number {
  const jour = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour.startsWith("2099")) return 72 * HEURE;
  const ecart = (Date.parse(`${jour}T12:00:00Z`) - Date.parse(`${aujourdhui}T12:00:00Z`)) / 864e5;
  return ecart >= -12 && ecart <= 60 ? 6 * HEURE : 72 * HEURE;
}

/** Faut-il relire ? Jamais vue, ou vue depuis plus longtemps que sa fraîcheur. */
export function aRelire(veilleAt: string | null | undefined, date: string | null | undefined, maintenant: number, aujourdhui: string): boolean {
  const t = veilleAt ? Date.parse(veilleAt) : NaN;
  return !Number.isFinite(t) || maintenant - t > fraicheurVeille(date, aujourdhui);
}

export async function veillerCourse(id: string): Promise<Record<string, unknown> | null> {
  const sb = createAdminClient();
  const { data, error } = await sb.from("races")
    .select("id, name, city, date, date_confirmee, distance_km, site_officiel, registration_url, inscription_url, resultats_url, resultats_annee, parcours_url, veille_at")
    .eq("id", id).single();
  if (error || !data) return null;   // 42703 : migration 034 absente — pas de veille à la consultation
  const aujourdhui = jourFrance();
  if (!aRelire(data.veille_at as string | null, data.date as string | null, Date.now(), aujourdhui)) return null;
  const url = pageOfficielle(data);
  const marquer = async (patch: Record<string, unknown>) => {
    const { error: e } = await sb.from("races").update({ ...patch, veille_at: new Date().toISOString() }).eq("id", id);
    if (e) console.error("[veille] écriture impossible :", id, e.message);
  };
  if (!url) { await marquer({}); return {}; }
  let u: URL; try { u = new URL(url); } catch { await marquer({}); return {}; }
  let rb: string | null | "inconnu" = "inconnu";
  try {
    const r = await fetch(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
    rb = r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu";
  } catch { rb = "inconnu"; }
  if (rb === "inconnu") return null;   // robots.txt illisible : on réessaiera
  if (!robotsAutorise(rb, u.pathname + u.search)) { await marquer({}); return {}; }
  let code = 0, html = "";
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    code = r.status;
    if (r.ok && /html/i.test(r.headers.get("content-type") ?? "")) html = (await r.text()).slice(0, 1_500_000); else { try { await r.body?.cancel(); } catch { /* */ } }
  } catch { code = 0; }
  if (reponseIncertaine(code)) return null;   // une panne ne décide rien, et ne compte pas comme une lecture
  const patch = html ? deciderVeille(data as CourseVeillee, lirePage(html, url, aujourdhui), aujourdhui, { confirmee: true, parcours: true }) : {};
  await marquer(patch);
  return patch;
}
