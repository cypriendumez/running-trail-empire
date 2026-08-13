// ─────────────────────────────────────────────────────────────────────────────
//  Mémorisation de la séance-clé IA : UN appel Gemini par athlète et par jour.
//
//  POURQUOI. Le palier gratuit plafonne à 20 requêtes/jour et PAR MODÈLE, et toute
//  l'IA de l'app (coach, kiné, cours, support) partage la même clé : le quota épuisé
//  fait tout tomber ensemble. Or `/api/ai/session` partait à CHAQUE montage du
//  tableau de bord, sans action de l'utilisateur. Trois visites = trois requêtes ;
//  un simple rechargement de page coûtait 5 % de la capacité quotidienne.
//
//  POURQUOI CÔTÉ SERVEUR ET PAS DANS LE NAVIGATEUR. Le même athlète ouvre le
//  tableau de bord sur son téléphone puis sur son ordinateur : un cache local
//  paierait deux fois. L'état vit donc en base, partagé par tous ses appareils.
//
//  POURQUOI PAS LE CACHE MÉMOIRE QUI ÉTAIT ICI. Il avait deux défauts. Sur Vercel
//  chaque instance a sa propre mémoire et meurt en continu : il ne servait presque
//  jamais. Surtout, il était indexé sur `utilisateur:jour` SEULEMENT — une séance
//  importée à 10 h ne le périmait pas, et l'athlète lisait jusqu'au soir une
//  recommandation calculée avant sa sortie. Un défaut silencieux : réponse 200,
//  texte plausible, conseil périmé.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";

/** Type de ligne `notifications` servant de fourre-tout typé (comme `user_settings`). */
export const SESSION_CACHE_TYPE = "ai_session_cache";

export type AiSession = { title: string; subtitle: string; tags: string[]; why: string };

/**
 * Colonnes de profil qui CHANGENT la prescription — liste explicite, pas `select("*")`.
 *
 * Le profil contient aussi des colonnes réécrites à chaque synchronisation
 * (`last_lat`, `last_loc_at`, `pace_curve`, `discipline_score`, `xp_points`…).
 * Les empreindre ferait sauter le cache plusieurs fois par jour sans qu'aucun
 * conseil ne change : on aurait payé la complexité sans économiser une requête.
 * Et `intervals_api_key` n'a évidemment rien à faire dans une empreinte.
 */
export const PROFILE_FINGERPRINT_COLUMNS = [
  "age", "height_cm", "weight_kg", "gender", "chronotype", "mode",
  "running_years", "main_terrain", "main_terrains", "elevation_pref",
  "health_conditions", "injury_zones", "health_notes", "health_declared",
  "days_per_week", "available_days", "long_run_mode", "warmup_min", "cooldown_min",
  "weight_mode_enabled", "weight_goal_kg", "garmin_vo2max",
] as const;

/**
 * Signaux dont dépend RÉELLEMENT la séance du jour.
 *
 * ⚠️ POURQUOI PAS UNE EMPREINTE DU PROMPT COMPLET — ce serait l'idée évidente, et
 * elle ne marche pas : le contexte coach embarque la météo du jour arrondie au degré
 * (`heatAdvice`). La prévision Open-Meteo est réactualisée dans la journée, donc le
 * texte change tout seul plusieurs fois par jour. Une empreinte du prompt ne
 * retomberait jamais deux fois sur la même valeur : le cache n'aurait servi qu'à
 * ajouter du code. On empreinte donc les faits qui changent la PRESCRIPTION.
 */
export type SessionSignals = {
  /** Jour serveur (UTC, aaaa-jj-mm) — identique au « jour » injecté dans le prompt. */
  day: string;
  /** Dernière séance importée + total : une sortie synchronisée change toute la charge. */
  lastWorkoutDate: string | null;
  workoutCount: number;
  /**
   * VFC et sommeil du jour : c'est d'eux que sort le verdict de fraîcheur
   * (« si fatigué → récupération »). La mesure du matin arrive souvent APRÈS la
   * première visite du tableau de bord — sans ça on servirait toute la journée un
   * conseil calculé avant de savoir comment il avait dormi.
   */
  lastHrvDate: string | null;
  lastHrvMs: number | null;
  lastSleepDate: string | null;
  lastSleepScore: number | null;
  /** Objectif de course (ligne `race_objective`) : nouvelle course = nouveau plan. */
  objective: unknown;
  /** Dernier test de VMA enregistré : une VMA neuve change toutes les allures. */
  baselineTestedAt: string | null;
  /** Colonnes de profil ci-dessus (santé, terrain, disponibilités, poids…). */
  profile: Record<string, unknown> | null;
};

/**
 * JSON à clés triées récursivement. Sans ça, deux lectures du MÊME objet jsonb
 * pourraient produire deux chaînes différentes selon l'ordre des clés rendu par
 * PostgREST — donc deux empreintes, donc un cache qui ne sert jamais.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/** Empreinte courte et stable des signaux ci-dessus. */
export function fingerprint(signals: SessionSignals): string {
  const profile = signals.profile ?? {};
  // On ne retient que l'allowlist, même si l'appelant en a lu davantage : une colonne
  // volatile ajoutée un jour à la requête ne doit pas pouvoir périmer le cache en boucle.
  const kept: Record<string, unknown> = {};
  for (const col of PROFILE_FINGERPRINT_COLUMNS) kept[col] = profile[col] ?? null;
  const material = canonical({
    day: signals.day,
    lastWorkoutDate: signals.lastWorkoutDate,
    workoutCount: signals.workoutCount,
    lastHrvDate: signals.lastHrvDate,
    lastHrvMs: signals.lastHrvMs,
    lastSleepDate: signals.lastSleepDate,
    lastSleepScore: signals.lastSleepScore,
    objective: signals.objective ?? null,
    baselineTestedAt: signals.baselineTestedAt,
    profile: kept,
  });
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export type CachedEntry = { day?: string; fp?: string; session?: Partial<AiSession> | null };

/**
 * Le cache n'est réutilisable que si le jour ET l'empreinte correspondent, et si la
 * séance mémorisée est exploitable. Une ligne à moitié écrite doit provoquer un
 * nouvel appel, pas l'affichage d'une carte vide.
 */
export function isCacheUsable(entry: CachedEntry | null | undefined, day: string, fp: string): entry is CachedEntry {
  if (!entry || entry.day !== day || entry.fp !== fp) return false;
  const s = entry.session;
  return !!s && typeof s.title === "string" && s.title.length > 0 && Array.isArray(s.tags);
}

/** Jour serveur utilisé comme clé — même base que le « jour » écrit dans le prompt. */
export const serverDay = (now: Date = new Date()): string => now.toISOString().slice(0, 10);
