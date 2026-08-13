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

/**
 * Temps écoulé, en français courant. On s'arrête à « il y a 7 j » puis on bascule
 * sur la date : « il y a 340 j » n'apprend rien à personne.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d <= 7) return `il y a ${d} j`;
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

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
export function statLine(w: WorkoutSummary): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (w.distance_km && w.distance_km > 0) {
    out.push({ label: "Distance", value: `${w.distance_km.toFixed(1).replace(".", ",")} km` });
  }
  if (w.duration_seconds && w.duration_seconds > 0) {
    const h = Math.floor(w.duration_seconds / 3600);
    const m = Math.round((w.duration_seconds % 3600) / 60);
    out.push({ label: "Temps", value: h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min` });
  }
  const pace = paceOf(w.duration_seconds, w.distance_km);
  if (pace) out.push({ label: "Allure", value: `${pace}/km` });
  else if (w.elevation_gain_m && w.elevation_gain_m > 0) {
    out.push({ label: "D+", value: `${Math.round(w.elevation_gain_m)} m` });
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
export function likesLabel(n: number): string {
  return n <= 0 ? "J'aime" : `${n} j'aime`;
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
