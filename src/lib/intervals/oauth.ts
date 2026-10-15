/**
 * LA CONNEXION intervals.icu EN UN CLIC (OAuth) — application « Pacevo », n° 1331, approuvée
 * par intervals.icu le 12/10/2026.
 *
 * Le protocole est celui que décrit son auteur (forum.intervals.icu, sujet 2759) :
 *  1. on envoie l'athlète sur `intervals.icu/oauth/authorize` avec nos portées et un `state` ;
 *  2. il revient sur notre adresse de retour avec `?code=…&state=…`, ou `?error=access_denied` ;
 *  3. on échange le code en MOINS DE 2 MINUTES contre un jeton (`POST /api/oauth/token`, en
 *     formulaire) ; la réponse donne aussi l'identifiant et le nom de l'athlète ;
 *  4. on appelle l'API avec `Authorization: Bearer <jeton>`.
 * Aucun jeton de rafraîchissement : un jeton vaut jusqu'à sa révocation, et une nouvelle
 * autorisation remplace l'ancienne. À la déconnexion, `DELETE /api/v1/disconnect-app`.
 *
 * ⚠️ L'ATHLÈTE PEUT DÉCOCHER DES PORTÉES sur l'écran d'intervals.icu. On lit donc celles qui
 * ont été ACCORDÉES, et on dit ce qui ne marchera pas, au lieu de découvrir un 403 au premier
 * envoi de séance.
 *
 * Tout ce qui se teste est ici, sans Next ni Supabase : les routes ne font que l'assembler.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";

export const URL_AUTORISATION = "https://intervals.icu/oauth/authorize";
export const URL_JETON = "https://intervals.icu/api/oauth/token";
export const URL_DECONNEXION = "https://intervals.icu/api/v1/disconnect-app";

/**
 * Les portées, relevées dans le code le 11/10/2026 (et présentées à David dans la demande) :
 * activités, flux et courbes (ACTIVITY) ; VFC, sommeil, FC de repos (WELLNESS) ; écriture et
 * suppression des séances planifiées (CALENDAR:WRITE) ; allure seuil réglée si elle est vide,
 * pour que les cibles d'allure partent vers la montre (SETTINGS:WRITE). WRITE implique READ.
 */
export const PORTEES = ["ACTIVITY:READ", "WELLNESS:READ", "CALENDAR:WRITE", "SETTINGS:WRITE"] as const;
export type Portee = (typeof PORTEES)[number];

/** Le cookie qui porte le `state` entre le départ et le retour (10 minutes, httpOnly). */
export const COOKIE_ETAT = "pacevo_oauth_intervals";
export const CHEMIN_COOKIE = "/api/intervals/oauth";
export const DUREE_COOKIE_S = 600;

/** D'où l'athlète est parti : on ne revient JAMAIS vers une adresse lue dans l'URL. */
export type Retour = "sync" | "inscription";
export const PAGE_RETOUR = "/dashboard/sync";

export type Configuration = { clientId: string; clientSecret: string };

/**
 * L'identifiant et le secret de l'application, ou `null` tant qu'ils ne sont pas dans
 * l'environnement. Sans eux, le bouton n'apparaît nulle part (`/api/intervals/status`
 * renvoie `oauth: false`) : on ne propose pas un chemin qui mène à une erreur.
 */
export function configurationOAuth(env: Record<string, string | undefined> = process.env): Configuration | null {
  const clientId = (env.INTERVALS_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = (env.INTERVALS_OAUTH_CLIENT_SECRET ?? "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Un `state` imprévisible : 24 octets aléatoires en hexadécimal. */
export function nouvelEtat(): string {
  return randomBytes(24).toString("hex");
}

/** Comparaison à temps constant : la durée de la réponse ne doit rien dire du `state` attendu. */
export function etatsEgaux(recu: string, attendu: string): boolean {
  if (!recu || !attendu) return false;
  const a = Buffer.from(recu), b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function valeurCookie(etat: string, retour: Retour): string {
  return `${etat}.${retour}`;
}

/** Le contenu du cookie, ou `null` s'il est absent, abîmé ou forgé. */
export function lireCookie(valeur: string | undefined | null): { etat: string; retour: Retour } | null {
  const m = /^([0-9a-f]{48})\.(sync|inscription)$/.exec(valeur ?? "");
  return m ? { etat: m[1], retour: m[2] as Retour } : null;
}

/** L'adresse de retour déclarée chez intervals.icu (`https://pacevo.fr/api/intervals/oauth/callback`). */
export function adresseRetour(origine: string): string {
  return `${origine.replace(/\/+$/, "")}/api/intervals/oauth/callback`;
}

export function urlAutorisation(p: { clientId: string; redirectUri: string; etat: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    scope: PORTEES.join(","),
    state: p.etat,
  });
  return `${URL_AUTORISATION}?${q.toString()}`;
}

/**
 * Les portées demandées qui n'ont PAS été accordées. `ACTIVITY:WRITE` couvre `ACTIVITY:READ`.
 * Une réponse sans champ `scope` ne permet pas de conclure : on ne signale alors rien.
 */
export function portesManquantes(scope: unknown): Portee[] {
  if (typeof scope !== "string") return [];
  const accordees = new Set(scope.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
  return PORTEES.filter((p) => {
    const [famille, droit] = p.split(":");
    return !(accordees.has(p) || (droit === "READ" && accordees.has(`${famille}:WRITE`)));
  });
}

/** Les familles manquantes, en minuscules, pour l'adresse de retour (`?manque=calendar,settings`). */
export function codeManquantes(manquantes: readonly Portee[]): string {
  return manquantes.map((p) => p.split(":")[0].toLowerCase()).join(",");
}

export type CodeEchec = "refuse" | "indisponible" | "reponse_invalide";

export type ResultatJeton =
  | { ok: true; jeton: string; athleteId: string; nom: string | null; manquantes: Portee[] }
  | { ok: false; code: CodeEchec; status: number };

/**
 * La réponse de `POST /api/oauth/token`, vérifiée champ par champ.
 * ⚠️ L'identifiant sert ensuite dans CHAQUE adresse de l'API (`/athlete/<id>/…`) : il doit
 * avoir la forme d'un identifiant intervals.icu — « i » + chiffres, ou des chiffres seuls pour
 * les comptes les plus anciens (l'exemple de la documentation est « 2049151 »).
 */
export function lireReponseJeton(corps: unknown): ResultatJeton {
  const c = (corps ?? {}) as { token_type?: unknown; access_token?: unknown; scope?: unknown; athlete?: { id?: unknown; name?: unknown } };
  const invalide: ResultatJeton = { ok: false, code: "reponse_invalide", status: 502 };
  if (typeof c.token_type === "string" && c.token_type.toLowerCase() !== "bearer") return invalide;
  const jeton = typeof c.access_token === "string" ? c.access_token.trim() : "";
  if (!/^[A-Za-z0-9._~-]{16,512}$/.test(jeton)) return invalide;
  const brut = c.athlete?.id;
  const athleteId = (typeof brut === "string" || typeof brut === "number" ? String(brut) : "").trim().toLowerCase();
  if (!/^i?\d{1,12}$/.test(athleteId)) return invalide;
  const nom = typeof c.athlete?.name === "string" && c.athlete.name.trim() ? c.athlete.name.trim().slice(0, 80) : null;
  return { ok: true, jeton, athleteId, nom, manquantes: portesManquantes(c.scope) };
}

/**
 * Échange le code contre un jeton. `f` est injectable pour les tests.
 * Ni le code, ni le secret, ni le jeton ne doivent jamais finir dans un journal : seul le
 * statut HTTP remonte en cas d'échec.
 */
export async function echangerCode(
  p: Configuration & { code: string },
  f: typeof fetch = fetch,
): Promise<ResultatJeton> {
  let res: Response;
  try {
    res = await f(URL_JETON, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: p.clientId, client_secret: p.clientSecret, code: p.code }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, code: "indisponible", status: 503 };
  }
  if (!res.ok) {
    // 5xx, 429 et 408 : intervals.icu est occupé. Le reste (400, 401…) : code expiré, déjà
    // utilisé, ou secret refusé — réessayer ne servirait à rien.
    const occupe = res.status >= 500 || res.status === 429 || res.status === 408;
    return { ok: false, code: occupe ? "indisponible" : "refuse", status: res.status };
  }
  const corps = await res.json().catch(() => null);
  return lireReponseJeton(corps);
}

/**
 * Révoque l'autorisation chez intervals.icu (déconnexion, ou remplacement par une clé API).
 * Au mieux : un échec ne doit jamais empêcher l'effacement de nos propres données.
 */
export async function revoquer(jeton: string, f: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await f(URL_DECONNEXION, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jeton}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
