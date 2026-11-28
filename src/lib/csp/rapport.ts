/**
 * LECTURE D'UN RAPPORT CSP (`/api/csp-report`) — séparée de la route pour être testée.
 *
 * ⚠️ LES POSTES DE DÉVELOPPEMENT ÉCRIVAIENT DANS LA BASE DE PRODUCTION. Un `next dev` local
 * utilise le `.env.local` du dépôt, donc la base de production : chaque page ouverte en
 * local envoyait ses violations CSP à SA route, qui les insérait dans `error_logs`. Trouvé le
 * 05/11/2026 : 27 lignes « http://localhost:3000/ » du 17 au 29/10, mêlées aux vraies
 * violations, et qui mangeaient le plafond de 60 rapports par minute. Même règle que la
 * balise d'audience (`components/Visite`) : le poste de développement ne compte pas.
 */
import { urlJournalisable } from "@/lib/journal/urlJournal";

export type RapportCsp = { directive: string; bloque: string; page: string };

/**
 * ⚠️ LA POSITION EXACTE D'UN COUREUR DANS LES JOURNAUX (28/11/2026). Un rapport CSP porte
 * l'adresse COMPLÈTE de la ressource bloquée : la météo y avait mis `?latitude=49.44…&longitude=
 * 1.10…`, enregistré tel quel dans `error_logs` (message et extrait du corps). Une adresse
 * journalisée garde son origine et son chemin, jamais sa requête ni son fragment (positions,
 * jetons, adresses e-mail) ; les mots-clés de la CSP (« inline », « eval », « data »…) restent.
 */
export function adresseSure(v: unknown): string {
  const s = String(v ?? "");
  if (/^https?:\/\//i.test(s)) return urlJournalisable(s) ?? s.split(/[?#]/)[0];
  return s.split(/[?#]/)[0];
}

const CHAMPS_ADRESSE = ["document-uri", "documentURL", "blocked-uri", "blockedURL", "source-file", "sourceFile", "referrer"];
/**
 * Les SEULS champs gardés (liste blanche) : de quoi diagnostiquer, rien de plus. Écartés notamment
 * `script-sample`/`sample` (texte de la page) et `original-policy` (la politique entière, inutile).
 */
const CHAMPS_GARDES = new Set([...CHAMPS_ADRESSE, "violated-directive", "effective-directive", "effectiveDirective",
  "line-number", "lineNumber", "column-number", "columnNumber", "disposition", "status-code", "statusCode"]);

/** Le corps du rapport à garder pour le diagnostic : champs de la liste blanche, adresses passées par `adresseSure`. */
export function extraitSur(brut: string): string {
  try {
    const j = JSON.parse(brut || "{}");
    const nettoie = (r: unknown) => {
      if (!r || typeof r !== "object") return r;
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r as Record<string, unknown>)) if (CHAMPS_GARDES.has(k)) o[k] = CHAMPS_ADRESSE.includes(k) ? adresseSure(v) : v;
      return o;
    };
    const propre = j["csp-report"] ? { "csp-report": nettoie(j["csp-report"]) }
      : Array.isArray(j) ? j.map((e) => (e && typeof e === "object" && "body" in e ? { type: e.type, url: adresseSure(e.url), body: nettoie(e.body) } : nettoie(e)))
      : nettoie(j);
    return JSON.stringify(propre).slice(0, 2000);
  } catch {
    return ""; // illisible : rien plutôt qu'un corps brut qui pourrait porter une position
  }
}

/** Un rapport CSP : `{ "csp-report": {…} }` (ancien format) ou `[{ body: {…} }]` (Reporting API). */
export function lireRapportCsp(brut: string): RapportCsp {
  let r: Record<string, unknown> = {};
  try {
    const j = JSON.parse(brut || "{}");
    r = (j["csp-report"] ?? (Array.isArray(j) ? (j[0]?.body ?? j[0]) : j) ?? {}) as Record<string, unknown>;
  } catch { /* corps illisible : on garde des champs vides */ }
  // « ? » = rapport sans ressource lisible : le repère reste, il ne passe pas par `adresseSure`
  // (qui couperait au « ? » et le rendrait vide).
  const b = r["blocked-uri"] ?? r["blockedURL"];
  return {
    directive: String(r["violated-directive"] ?? r["effectiveDirective"] ?? r["effective-directive"] ?? "?").slice(0, 200),
    bloque: (b == null ? "?" : adresseSure(b) || "?").slice(0, 500),
    page: adresseSure(r["document-uri"] ?? r["documentURL"] ?? "").slice(0, 500),
  };
}

/** La page (ou, à défaut, l'hôte qui reçoit le rapport) est-elle un poste de développement ? */
export function rapportLocal(page: string, hoteRequete: string | null): boolean {
  const local = (h: string) => /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(h) || /\.localhost$/i.test(h);
  try { if (page && local(new URL(page).hostname)) return true; } catch { /* page illisible */ }
  return local(String(hoteRequete ?? "").replace(/:\d+$/, ""));
}

/**
 * ⚠️ LES EXTENSIONS DES VISITEURS ÉCRIVAIENT DANS « BUGS » (07/11/2026). Sur 30 jours, 36
 * rapports venaient d'extensions de navigateur (Joko, une extension Firebase, scite…) : leur
 * script, injecté dans NOS pages, chargeait SES images et SES polices, et la CSP le signalait
 * comme si Pacevo le faisait. Rien à corriger chez nous, mais l'onglet Bugs comptait ces lignes
 * comme des « défauts distincts » et noyait les vrais.
 *
 * Est étranger : un rapport dont le script source, ou la ressource bloquée, est une extension
 * (`chrome-extension://`, `moz-extension://`, `safari-web-extension://`…), ou dont la page
 * n'est pas une page web (`about:blank`, « about » : un cadre créé par une extension).
 */
export function rapportEtranger(brut: string): boolean {
  let r: Record<string, unknown> = {};
  try {
    const j = JSON.parse(brut || "{}");
    r = (j["csp-report"] ?? (Array.isArray(j) ? (j[0]?.body ?? j[0]) : j) ?? {}) as Record<string, unknown>;
  } catch { return false; }
  const extension = (v: unknown) => /^[a-z-]*extension:\/\//i.test(String(v ?? ""));
  if (extension(r["source-file"]) || extension(r["sourceFile"]) || extension(r["blocked-uri"]) || extension(r["blockedURL"])) return true;
  const page = String(r["document-uri"] ?? r["documentURL"] ?? "");
  return page !== "" && !/^https?:\/\//i.test(page);
}
