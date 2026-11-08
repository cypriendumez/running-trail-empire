/**
 * LES ALERTES D'intervals.icu — webhooks de l'application OAuth « Pacevo » (n° 1331).
 *
 * Plutôt que Pacevo demande « du nouveau ? » toutes les deux minutes (AutoSync, onglet
 * ouvert) ou toutes les ~100 minutes (GitHub, qui étrangle sa planification), intervals.icu
 * PRÉVIENT dès qu'une séance arrive. Format, d'après le guide d'intégration de son auteur
 * (forum.intervals.icu, sujet 80090) :
 *
 *   POST { "secret": "…",
 *          "events": [{ "athlete_id": "i564686", "type": "ACTIVITY_UPLOADED",
 *                       "timestamp": "2024-12-06T06:40:47.011+00:00", "activity": { … } }] }
 *
 * ⚠️ LE SECRET VOYAGE DANS LE CORPS, ni dans l'adresse ni dans un en-tête : c'est le champ
 * « Webhook Secret » de la page Manage App, comparé ici à INTERVALS_WEBHOOK_SECRET.
 * L'ancienne route l'attendait dans `?secret=`, lisait `athlete_id` à la racine du corps et
 * n'aurait donc jamais accepté une seule alerte réelle.
 *
 * ⚠️ UNE ALERTE SANS RÉPONSE 2xx EST RENVOYÉE, pendant un temps, à intervalles croissants
 * (l'auteur d'intervals.icu, même sujet, message 20 ; vérifié par un développeur qui a
 * bloqué l'adresse d'intervals.icu le 17/07/2026). C'est une chance : un incident passager
 * se rattrape seul. Et un piège : refuser une alerte qu'on ne saura jamais traiter la ferait
 * revenir pour rien. D'où `statutHttp` : on ne répond une erreur QUE si réessayer peut réussir.
 *
 * ⚠️ PAS D'ALERTE pour une séance venue de Strava (même guide), ni pour un athlète relié par
 * une clé API : seules les autorisations OAuth de l'application en déclenchent. Le sondage et
 * le balayage restent donc en place ; l'alerte les devance, elle ne les remplace pas.
 *
 * Tout ce qui se teste est ici, sans Next ni Supabase : la route ne fait que l'assembler.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { estErreurTransitoire } from "@/lib/cron/transitoire";

/**
 * Les alertes qui font synchroniser. Toutes passent par la même chaîne, qui ne republie le
 * plan que pour une séance INÉDITE (`replanIfFresh`) : la deuxième alerte d'une même séance
 * met sa ligne à jour sans republier.
 *  · ACTIVITY_UPLOADED : une séance arrive ;
 *  · ACTIVITY_ANALYZED : la même, une minute plus tard, charge et zones calculées (intervals.icu
 *    regroupe les analyses successives d'une séance en une alerte, après 60 s) ;
 *  · ACTIVITY_UPDATED  : l'athlète a corrigé un nom, un type, un ressenti ;
 *  · WELLNESS_UPDATED  : VFC, sommeil, FC de repos de la nuit.
 */
export const TYPES_SYNCHRO: ReadonlySet<string> = new Set([
  "ACTIVITY_UPLOADED", "ACTIVITY_ANALYZED", "ACTIVITY_UPDATED", "WELLNESS_UPDATED",
]);

/**
 * Acquittées sans rien faire, et pourquoi. Un type absent d'ici et de `TYPES_SYNCHRO` est
 * acquitté de même : intervals.icu en ajoute, et une alerte inconnue refusée reviendrait en boucle.
 */
export const RAISONS_IGNOREES: Readonly<Record<string, string>> = {
  // ⚠️ BOUCLE. Chaque envoi de séances vers la montre ÉCRIT le calendrier d'intervals.icu,
  // qui émet alors CALENDAR_UPDATED : y répondre en replanifiant réécrirait le calendrier,
  // qui réémettrait l'alerte. Seul le garde-fou des 10 minutes arrêterait la ronde.
  CALENDAR_UPDATED: "le calendrier est écrit par Pacevo lui-même",
  // Notre copie de la séance n'est pas effacée en silence : une suppression emporte aussi le
  // ressenti saisi, la trace, les segments. Elle mérite sa propre conception.
  ACTIVITY_DELETED: "une suppression n'est pas répercutée automatiquement",
};

export type Alerte = {
  athleteId: string;
  type: string;
  /** Jour LOCAL de la séance concernée, quand l'alerte en porte une. */
  jour: string | null;
};

/** « i » + chiffres, ou des chiffres seuls pour les comptes les plus anciens (ex. « 2049151 »). */
const ID_ATHLETE = /^i?\d{1,12}$/;
/** Au-delà, le reste d'une livraison démesurée est compté, pas lu. */
const MAX_ALERTES = 500;

/** Le jour local `AAAA-MM-JJ` d'un `start_date_local`, ou `null`. */
function jourLocal(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(v.trim());
  return m && !Number.isNaN(Date.parse(`${m[1]}T00:00:00Z`)) ? m[1] : null;
}

export type Livraison = { secret: unknown; alertes: Alerte[]; rejetees: number };

/**
 * Le corps d'une livraison, vérifié champ par champ ; `null` s'il n'a pas la forme d'une
 * livraison d'intervals.icu. Une alerte illisible (identifiant d'athlète invalide, type
 * absent) est écartée et comptée : elle n'empêche pas les autres de passer.
 *
 * ⚠️ L'identifiant sert ensuite à retrouver l'athlète en base et à appeler l'API : il doit
 * avoir la forme d'un identifiant intervals.icu, comme dans `lireReponseJeton` (oauth.ts).
 */
export function lireLivraison(corps: unknown): Livraison | null {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return null;
  const c = corps as { secret?: unknown; events?: unknown };
  if (!Array.isArray(c.events)) return null;
  const alertes: Alerte[] = [];
  let rejetees = Math.max(0, c.events.length - MAX_ALERTES);
  for (const e of c.events.slice(0, MAX_ALERTES)) {
    const ev = (e && typeof e === "object" ? e : {}) as { athlete_id?: unknown; type?: unknown; activity?: unknown };
    const brut = ev.athlete_id;
    const athleteId = (typeof brut === "string" || typeof brut === "number" ? String(brut) : "").trim().toLowerCase();
    const type = typeof ev.type === "string" ? ev.type.trim().toUpperCase() : "";
    if (!ID_ATHLETE.test(athleteId) || !/^[A-Z_]{1,64}$/.test(type)) { rejetees++; continue; }
    const activite = ev.activity && typeof ev.activity === "object" ? ev.activity as { start_date_local?: unknown } : null;
    alertes.push({ athleteId, type, jour: jourLocal(activite?.start_date_local) });
  }
  return { secret: c.secret, alertes, rejetees };
}

/** Le secret attendu, ou `null` tant qu'il n'est pas configuré : alors rien ne s'authentifie. */
export function secretAttendu(env: Record<string, string | undefined> = process.env): string | null {
  const s = (env.INTERVALS_WEBHOOK_SECRET ?? "").trim();
  return s || null;
}

/**
 * Comparaison à temps constant, longueur comprise : on compare les EMPREINTES des deux
 * valeurs, de même taille quelle que soit l'entrée. Un `===` laisserait mesurer, caractère
 * après caractère, quelle part du secret on a devinée.
 */
export function secretValide(recu: unknown, attendu: string): boolean {
  if (typeof recu !== "string" || !recu.trim() || !attendu) return false;
  const a = createHash("sha256").update(recu.trim()).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

/** Fenêtre de synchronisation par défaut, en jours : la nuit, la veille, aujourd'hui. */
export const JOURS_DEFAUT = 3;
/** Une alerte sur une séance ancienne ne rapatrie pas plus d'un mois à chaque fois. */
export const JOURS_MAX = 30;

/**
 * Les jours à couvrir pour que la séance du `jour` (LOCAL) entre dans la synchronisation.
 * `syncIntervalsForUser` en tire sa borne basse : le jour UTC de « maintenant − jours ». En
 * comptant les jours depuis `jour` à 0 h UTC, arrondis au SUPÉRIEUR, cette borne ne tombe
 * jamais après `jour`, à toute heure (rejoué par le test, minuit compris).
 */
export function fenetre(jour: string | null, maintenant: number = Date.now()): number {
  const t = jour ? Date.parse(`${jour}T00:00:00Z`) : NaN;
  if (Number.isNaN(t)) return JOURS_DEFAUT;
  const jours = Math.ceil((maintenant - t) / 86_400_000);
  return Math.min(JOURS_MAX, Math.max(JOURS_DEFAUT, jours));
}

export type Lot = { athleteId: string; types: string[]; jours: number };

/**
 * Une synchronisation par ATHLÈTE, pas par alerte : une livraison qui annonce trois séances
 * du même athlète déclenche une seule synchro, dont la fenêtre couvre la plus ancienne.
 * Deux synchros parallèles du même compte se disputeraient les mêmes lignes.
 */
export function lotsATraiter(alertes: Alerte[], maintenant: number = Date.now()): { lots: Lot[]; ignorees: Record<string, number> } {
  const parAthlete = new Map<string, { types: Set<string>; plusAncien: string | null }>();
  const ignorees: Record<string, number> = {};
  for (const a of alertes) {
    if (!TYPES_SYNCHRO.has(a.type)) { ignorees[a.type] = (ignorees[a.type] ?? 0) + 1; continue; }
    const g = parAthlete.get(a.athleteId) ?? { types: new Set<string>(), plusAncien: null };
    g.types.add(a.type);
    if (a.jour && (!g.plusAncien || a.jour < g.plusAncien)) g.plusAncien = a.jour;
    parAthlete.set(a.athleteId, g);
  }
  const lots = [...parAthlete].map(([athleteId, g]) => ({
    athleteId, types: [...g.types].sort(), jours: fenetre(g.plusAncien, maintenant),
  }));
  return { lots, ignorees };
}

/**
 * Ce qu'est devenue la synchro d'un athlète :
 *  · `passager`    → intervals.icu doit renvoyer l'alerte (délai, 429, passerelle, réseau),
 *                    y compris quand seules quelques écritures ont échoué en passant ;
 *  · `refusé`      → réessayer ne changerait rien (autorisation retirée, accès refusé) : on
 *                    acquitte et on journalise ;
 *  · `inconnu`     → aucun profil Pacevo relié à cet athlète (ou sans identifiants) ;
 *  · `synchronisé` → tout est passé.
 */
export type Issue = "synchronisé" | "passager" | "refusé" | "inconnu";

export function issueDe(s: { error?: string; status?: number | null; passagers: number }): Issue {
  if (s.error) return estErreurTransitoire(s.error, s.status) ? "passager" : "refusé";
  return s.passagers > 0 ? "passager" : "synchronisé";
}

/** 503 si au moins une synchro peut réussir en réessayant ; 200 sinon, « inconnu » et « refusé » compris. */
export function statutHttp(issues: Issue[]): 200 | 503 {
  return issues.includes("passager") ? 503 : 200;
}
