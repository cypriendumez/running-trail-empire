// ─────────────────────────────────────────────────────────────────────────────
//  SOCIAL — logique pure du fil d'actualité.
//
//  Tout ce qui décide QUI VOIT QUOI vit ici, en fonctions pures et testées. Les
//  politiques RLS de PostgreSQL restent la vraie barrière de sécurité ; ces
//  fonctions les DOUBLENT côté application pour que l'erreur soit visible en test
//  plutôt qu'en production. Une fuite de visibilité ne plante pas : elle affiche
//  simplement la séance de quelqu'un à qui ne devait pas la voir.
// ─────────────────────────────────────────────────────────────────────────────

export type Visibility = "public" | "followers" | "private";

export type Post = {
  id: string;
  user_id: string;
  visibility: Visibility;
  body?: string | null;
  created_at: string;
};

/**
 * Le lecteur a-t-il le droit de voir cette publication ?
 *
 * `followingIds` = les athlètes que le LECTEUR suit. On ne se fie jamais à un
 * éventuel drapeau porté par la publication elle-même : c'est la relation qui fait
 * foi, et elle peut avoir été rompue depuis la publication.
 */
export function canSee(post: Post, viewerId: string | null, followingIds: Set<string>): boolean {
  if (post.user_id === viewerId) return true;      // toujours ses propres publications
  if (post.visibility === "private") return false; // « privé » ne souffre aucune exception
  if (post.visibility === "public") return true;
  return followingIds.has(post.user_id);
}

/**
 * Le lecteur a-t-il le droit de COMMENTER cette publication ?
 *
 * Voir et commenter sont deux droits distincts, et les confondre était le défaut :
 * n'importe quel inscrit pouvait commenter n'importe quelle publication visible.
 * Sur un compte PUBLIC c'est voulu — un inconnu peut féliciter une performance, comme
 * sur Strava. Sur un compte PRIVÉ, non : seuls les amis.
 *
 * L'AMITIÉ EST UN SUIVI DANS LES DEUX SENS. C'est la définition que pose déjà la
 * migration 019 (« l'amitié se déduit simplement d'un suivi dans les deux sens ») ;
 * en inventer une autre ici aurait créé deux notions concurrentes d'ami dans la même
 * application. Aucune file de demandes à traiter : suivre en retour suffit.
 *
 * @param auteurPrive  le compte de l'AUTEUR de la publication est-il privé
 * @param relation     `suit` = le lecteur suit l'auteur ; `estSuivi` = l'auteur suit le lecteur
 */
export function canComment(
  post: Post,
  viewerId: string | null,
  auteurPrive: boolean,
  relation: { suit: boolean; estSuivi: boolean },
): boolean {
  if (!viewerId) return false;                 // commenter exige d'être identifié
  if (post.user_id === viewerId) return true;  // toujours chez soi
  // On ne commente jamais ce qu'on n'a pas le droit de voir. Le contraire permettrait
  // de deviner l'existence d'une publication privée par le refus qu'elle renvoie.
  if (post.visibility === "private") return false;
  if (post.visibility === "followers" && !relation.suit) return false;
  // Compte public : n'importe qui peut commenter ce qu'il voit.
  if (!auteurPrive) return true;
  // Compte privé : réservé aux amis, c'est-à-dire au suivi réciproque.
  return relation.suit && relation.estSuivi;
}

/** Longueur maximale d'un commentaire ou d'un texte de publication. */
export const MAX_BODY = 1000;
export const MAX_COMMENT = 500;

/**
 * Nettoie un texte saisi. Renvoie `null` si, une fois nettoyé, il ne reste rien —
 * ce qui évite les publications et commentaires vides faits d'espaces.
 */
export function cleanBody(input: unknown, max = MAX_BODY): string | null {
  if (typeof input !== "string") return null;
  // Les espaces insécables et retours multiples sont normalisés : sans ça, une
  // chaîne d'espaces passait le test « non vide » et créait un commentaire fantôme.
  const text = input.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return null;
  return text.slice(0, max);
}

/** Une publication doit porter quelque chose : un texte, ou une séance. */
export function isPublishable(body: string | null, workoutId: string | null): boolean {
  return !!body || !!workoutId;
}

// `timeAgo` vivait ici, en français seulement, alors que `lib/utils/time.ts` en tenait
// déjà une version traduite dans les 5 langues. Deux implémentations de la même notion,
// dont une seule traduite : le fil du Club affichait « il y a 3 j » à un lecteur
// allemand. La copie est supprimée, tout passe par `lib/utils/time`.
export { timeAgo } from "@/lib/utils/time";

/** Libellés des chiffres d'une séance publiée. */
const STAT_T: Record<string, { distance: string; time: string; pace: string; elev: string; like: string; likes: string }> = {
  fr: { distance: "Distance", time: "Temps", pace: "Allure", elev: "D+", like: "J'aime", likes: "{n} j'aime" },
  en: { distance: "Distance", time: "Time", pace: "Pace", elev: "Elev.", like: "Like", likes: "{n} likes" },
  de: { distance: "Distanz", time: "Zeit", pace: "Tempo", elev: "Höhenm.", like: "Gefällt mir", likes: "{n}× gefällt mir" },
  es: { distance: "Distancia", time: "Tiempo", pace: "Ritmo", elev: "Desnivel", like: "Me gusta", likes: "{n} me gusta" },
  pt: { distance: "Distância", time: "Tempo", pace: "Ritmo", elev: "Desnível", like: "Gosto", likes: "{n} gostos" },
};

/** Format d'allure à partir d'une durée et d'une distance — jamais inventé. */
export function paceOf(durationSeconds?: number | null, distanceKm?: number | null): string | null {
  if (!durationSeconds || !distanceKm || distanceKm <= 0) return null;
  const secPerKm = durationSeconds / distanceKm;
  if (!Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}'00"` : `${m}'${String(s).padStart(2, "0")}"`;
}

export type WorkoutSummary = {
  distance_km?: number | null;
  duration_seconds?: number | null;
  elevation_gain_m?: number | null;
};

/**
 * Les 3 chiffres d'une séance publiée. On n'affiche QUE ce qui existe : une carte
 * qui montrerait « 0,0 km » pour une séance sans distance mentirait sur la sortie.
 */
export function statLine(w: WorkoutSummary, lang = "fr"): { label: string; value: string }[] {
  const T = STAT_T[lang] ?? STAT_T.fr;
  const out: { label: string; value: string }[] = [];
  if (w.distance_km && w.distance_km > 0) {
    out.push({ label: T.distance, value: `${w.distance_km.toFixed(1).replace(".", ",")} km` });
  }
  if (w.duration_seconds && w.duration_seconds > 0) {
    const h = Math.floor(w.duration_seconds / 3600);
    const m = Math.round((w.duration_seconds % 3600) / 60);
    out.push({ label: T.time, value: h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min` });
  }
  const pace = paceOf(w.duration_seconds, w.distance_km);
  if (pace) out.push({ label: T.pace, value: `${pace}/km` });
  else if (w.elevation_gain_m && w.elevation_gain_m > 0) {
    out.push({ label: T.elev, value: `${Math.round(w.elevation_gain_m)} m` });
  }
  return out;
}

/**
 * Libellé du bouton « j'aime », au pluriel correct.
 *
 * Le mot « kudos » reste le nom des COLONNES en base (`post_kudos`, `kudos_count`) :
 * les renommer imposerait une migration pour un gain nul côté athlète, qui ne voit
 * que ce libellé. On sépare donc le vocabulaire de l'écran de celui du schéma.
 */
export function likesLabel(n: number, lang = "fr"): string {
  const T = STAT_T[lang] ?? STAT_T.fr;
  return n <= 0 ? T.like : T.likes.replace("{n}", String(n));
}

/**
 * Suggestions d'athlètes à suivre : on écarte soi-même et ceux qu'on suit déjà.
 * Sans ce filtre, le premier écran proposait de suivre des gens déjà suivis — et
 * l'utilisateur croyait le bouton cassé.
 */
export function suggestable<T extends { id: string }>(
  candidates: T[], viewerId: string, followingIds: Set<string>,
): T[] {
  return candidates.filter((c) => c.id !== viewerId && !followingIds.has(c.id));
}
