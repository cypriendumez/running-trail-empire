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
export type RapportCsp = { directive: string; bloque: string; page: string };

/** Un rapport CSP : `{ "csp-report": {…} }` (ancien format) ou `[{ body: {…} }]` (Reporting API). */
export function lireRapportCsp(brut: string): RapportCsp {
  let r: Record<string, unknown> = {};
  try {
    const j = JSON.parse(brut || "{}");
    r = (j["csp-report"] ?? (Array.isArray(j) ? (j[0]?.body ?? j[0]) : j) ?? {}) as Record<string, unknown>;
  } catch { /* corps illisible : on garde des champs vides */ }
  return {
    directive: String(r["violated-directive"] ?? r["effectiveDirective"] ?? r["effective-directive"] ?? "?").slice(0, 200),
    bloque: String(r["blocked-uri"] ?? r["blockedURL"] ?? "?").slice(0, 500),
    page: String(r["document-uri"] ?? r["documentURL"] ?? "").slice(0, 500),
  };
}

/** La page (ou, à défaut, l'hôte qui reçoit le rapport) est-elle un poste de développement ? */
export function rapportLocal(page: string, hoteRequete: string | null): boolean {
  const local = (h: string) => /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(h) || /\.localhost$/i.test(h);
  try { if (page && local(new URL(page).hostname)) return true; } catch { /* page illisible */ }
  return local(String(hoteRequete ?? "").replace(/:\d+$/, ""));
}
