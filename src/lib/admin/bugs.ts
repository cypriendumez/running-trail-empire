/**
 * LE JOURNAL D'ERREURS, LU COMME UN COACH LIT SES ALERTES — regroupé, daté, compté.
 *
 * `error_logs` existait depuis juin, mais personne ne l'ouvrait : il fallait le tableau
 * de bord Supabase et une requête SQL. Le 14/09/2026 il contenait 129 lignes, dont 50 de
 * bruit de développement (« preview », localhost) et 21 erreurs d'hydratation réelles en
 * production que personne n'avait regardées.
 *
 * ⚠️ REGROUPER SUR LE MESSAGE BRUT NE REGROUPE RIEN : un identifiant, une adresse ou un
 * numéro de ligne changent à chaque occurrence. On normalise avant de compter — mais on
 * garde un EXEMPLE brut par groupe, parce que c'est lui qu'on lit pour comprendre.
 */

export type LigneErreur = {
  id: string;
  created_at: string;
  user_id: string | null;
  source: string | null;
  message: string | null;
  stack?: string | null;
  url: string | null;
  user_agent?: string | null;
  meta?: unknown;
};

export type GroupeErreur = {
  cle: string;
  message: string;
  occurrences: number;
  premier: string;
  dernier: string;
  comptes: number;
  anonymes: number;
  sources: string[];
  pages: { url: string; n: number }[];
  exemple: { stack: string | null; meta: unknown; user_agent: string | null; url: string | null };
};

const ROBOT_UA = /bot|crawl|spider|slurp|headless|curl\/|wget\/|python-requests|go-http-client|java\/|okhttp|axios|node-fetch|monitor|uptime/i;

/**
 * CE QUI N'EST NI UN BUG NI ACTIONNABLE — masqué par défaut, jamais effacé (filtre à
 * l'AFFICHAGE, le journal reste complet). Quatre familles, toutes constatées le
 * 14/09/2026 en confrontant l'onglet aux vraies lignes :
 *
 *  1. DÉVELOPPEMENT : localhost, pages `/preview-*`, le mot « preview ».
 *  2. DÉPLOIEMENTS *.vercel.app : l'ancien domaine et les prévisualisations. La
 *     production est pacevo.fr ; une erreur datée d'avant la bascule n'a plus de site
 *     où être reproduite.
 *  3. SCANS : un `curl` a posté « x » à `/api/log-error` (url « u », agent curl). Ce
 *     n'est pas un athlète, c'est du bruit d'attaque.
 *  4. « Script error. » OPAQUE : le navigateur masque les erreurs venues d'un script
 *     tiers (extension, injection) derrière ce message unique, sans fichier ni ligne
 *     (`file:""`). Rien dans notre code ne peut la reproduire ni la corriger.
 */
export function estBruitDeDev(l: Pick<LigneErreur, "url" | "message" | "user_agent" | "meta">): boolean {
  const url = String(l.url ?? "");
  const message = String(l.message ?? "").trim();
  // 1. Développement local et bancs d'essai.
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url)) return true;
  if (/^https?:\/\/[^/]+\/preview-/i.test(url)) return true;
  if (message.toLowerCase() === "preview") return true;
  // 2. Anciens déploiements et prévisualisations Vercel (la prod est pacevo.fr).
  try { if (/\.vercel\.app$/i.test(new URL(url).hostname)) return true; } catch { /* url non standard : voir plus bas */ }
  // 3. Scans : agent robot/curl, ou une url qui n'est même pas une adresse http.
  if (ROBOT_UA.test(String(l.user_agent ?? ""))) return true;
  if (url && !/^https?:\/\//i.test(url)) return true;
  // 4. « Script error. » cross-origin, sans fichier : non diagnosticable.
  const fichier = (l.meta as { file?: unknown } | null)?.file;
  if (message.toLowerCase() === "script error." && !fichier) return true;
  return false;
}

/** Le message débarrassé de ce qui varie d'une occurrence à l'autre. */
export function normaliserMessage(message: string | null | undefined): string {
  return String(message ?? "(sans message)")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b\d{3,}\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/** Une adresse sans son paramétrage ni son hôte : `/dashboard/races`, pas le lien complet. */
export function pageDe(url: string | null | undefined): string {
  try {
    const u = new URL(String(url ?? ""));
    return u.pathname || "/";
  } catch { return String(url ?? "").split(/[?#]/)[0] || "(inconnue)"; }
}

export function regrouperErreurs(lignes: LigneErreur[], opts: { masquerBruit?: boolean } = {}): GroupeErreur[] {
  const masquer = opts.masquerBruit ?? true;
  const groupes = new Map<string, {
    message: string; occurrences: number; premier: string; dernier: string;
    comptes: Set<string>; anonymes: number; sources: Set<string>; pages: Map<string, number>;
    exemple: GroupeErreur["exemple"];
  }>();

  for (const l of lignes) {
    if (masquer && estBruitDeDev(l)) continue;
    const message = normaliserMessage(l.message);
    const cle = `${l.source ?? "?"}|${message}`;
    const g = groupes.get(cle) ?? {
      message, occurrences: 0, premier: l.created_at, dernier: l.created_at,
      comptes: new Set<string>(), anonymes: 0, sources: new Set<string>(), pages: new Map<string, number>(),
      exemple: { stack: l.stack ?? null, meta: l.meta ?? null, user_agent: l.user_agent ?? null, url: l.url },
    };
    g.occurrences++;
    if (l.created_at < g.premier) g.premier = l.created_at;
    if (l.created_at > g.dernier) {
      g.dernier = l.created_at;
      // L'exemple montré est le plus RÉCENT : c'est l'état actuel du défaut.
      g.exemple = { stack: l.stack ?? null, meta: l.meta ?? null, user_agent: l.user_agent ?? null, url: l.url };
    }
    if (l.user_id) g.comptes.add(l.user_id); else g.anonymes++;
    g.sources.add(String(l.source ?? "?"));
    const p = pageDe(l.url);
    g.pages.set(p, (g.pages.get(p) ?? 0) + 1);
    groupes.set(cle, g);
  }

  return [...groupes.entries()]
    .map(([cle, g]) => ({
      cle, message: g.message, occurrences: g.occurrences, premier: g.premier, dernier: g.dernier,
      comptes: g.comptes.size, anonymes: g.anonymes, sources: [...g.sources].sort(),
      pages: [...g.pages.entries()].map(([url, n]) => ({ url, n })).sort((a, b) => b.n - a.n).slice(0, 5),
      exemple: g.exemple,
    }))
    // Le plus récent d'abord : un bug d'hier passe avant un bug de juin, quel que soit son volume.
    .sort((a, b) => b.dernier.localeCompare(a.dernier));
}
