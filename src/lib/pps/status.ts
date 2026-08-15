// ─────────────────────────────────────────────────────────────────────────────
//  PPS — PASS PRÉVENTION SANTÉ (Fédération Française d'Athlétisme).
//
//  Depuis le 1er septembre 2024, un majeur NON LICENCIÉ ne peut plus s'inscrire à une
//  compétition de course à pied chronométrée en France avec un certificat médical : il
//  lui faut un PPS. Depuis janvier 2026 c'est un « Pass Prévention Santé » payant —
//  5 €, VALABLE UN AN — obtenu sur https://pps.athle.fr.
//
//  POURQUOI CE MODULE EXISTE, ALORS QU'UN LIEN SUFFIRAIT EN APPARENCE.
//  Un lien vers pps.athle.fr n'apporte rien : un moteur de recherche le donne en deux
//  secondes. Ce que NOUS savons et que le site de la fédération ignore, c'est LA DATE
//  DE LA COURSE de l'athlète. Or le pass dure un an et une préparation marathon en dure
//  six : un pass pris aujourd'hui peut très bien être périmé le jour J. C'est
//  exactement le genre d'échéance qu'on découvre la veille, quand il est trop tard pour
//  la rattraper sereinement.
//
//  ⚠️ CE QUE CE MODULE NE FAIT PAS, ET NE DOIT JAMAIS FAIRE.
//  Il ne déclare personne « apte ». Il ne vérifie rien auprès de la fédération : il
//  n'existe aucune API publique pour cela. Il raisonne UNIQUEMENT sur une date que
//  l'athlète a saisie lui-même, et il le dit. L'autorité, c'est l'organisateur de la
//  course et la FFA — jamais nous.
//
//  Sources (vérifiées le 15/08/2026) : pps.athle.fr (plateforme officielle),
//  athle.fr (annonce du dispositif), marathondenantes.com (évolution 2026).
// ─────────────────────────────────────────────────────────────────────────────

/** Adresse officielle. Codée UNE fois : dix copies dans des composants divergent. */
export const PPS_URL = "https://pps.athle.fr";

/** Tarif annuel du Pass Prévention Santé, en euros (depuis janvier 2026). */
export const PPS_PRIX_EUR = 5;

/** Durée de validité, en mois, à compter de la délivrance. */
export const PPS_VALIDITE_MOIS = 12;

/**
 * Ce que l'athlète a déclaré. Stocké dans `notifications` (type `pps_status`), comme
 * `user_settings` ou `race_objective` : aucune migration, et le champ reste optionnel
 * pour les comptes qui n'ont jamais ouvert le sujet.
 */
export type PpsStatus = {
  /**
   * Date d'EXPIRATION, AAAA-MM-JJ — celle qui est IMPRIMÉE sur le pass (« EXPIRE LE
   * 24/03/2027 »). C'est la source de vérité quand elle est renseignée.
   *
   * Pourquoi elle et pas la date d'obtention : le pass n'affiche que l'expiration. Le
   * premier écran demandait la délivrance, donc obligeait l'athlète à retrancher douze
   * mois de tête pour saisir une donnée que la fédération lui donne déjà toute faite.
   * Une friction inutile sur le seul geste que l'app lui demande.
   */
  expiresAt?: string | null;
  /** Date de délivrance, AAAA-MM-JJ. Repli historique : l'expiration s'en déduit. */
  obtainedAt: string | null;
  /** Numéro de pass, si l'athlète a voulu le garder sous la main. Jamais obligatoire. */
  number?: string | null;
  /** Licencié FFA : la licence tient lieu de PPS, il n'a rien à faire. */
  licensed?: boolean;
};

export type PpsVerdict =
  /** Licencié : dispensé. */
  | { kind: "licencie" }
  /** Rien de déclaré : on ne sait pas, et on ne le devine pas. */
  | { kind: "inconnu" }
  /** Valable aujourd'hui — et, si une date de course est fournie, ce jour-là aussi. */
  | { kind: "valide"; expiresAt: string; joursRestants: number }
  /** Valable aujourd'hui mais PLUS le jour de la course : le cas qui coûte cher. */
  | { kind: "expireAvantCourse"; expiresAt: string; raceDate: string }
  /** Déjà périmé. */
  | { kind: "expire"; expiresAt: string };

const jour = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Date valide au format AAAA-MM-JJ, ou `null`. On ne devine jamais une date bancale. */
export function parseJour(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Date d'expiration : délivrance + 12 mois.
 *
 * On passe par `setMonth`, pas par « +365 jours » : une année bissextile décalerait
 * l'échéance d'un jour, et c'est précisément un jour d'écart qui fait basculer un
 * verdict à la veille d'une course.
 */
export function ppsExpiration(obtainedAt: string | null | undefined): string | null {
  const d = parseJour(obtainedAt);
  if (!d) return null;
  const e = new Date(d);
  e.setMonth(e.getMonth() + PPS_VALIDITE_MOIS);
  return iso(e);
}

/**
 * Le verdict, pour aujourd'hui et — si on la connaît — POUR LE JOUR DE LA COURSE.
 *
 * `raceDate` est ce qui rend l'information utile : « valide » tout court ne dit rien à
 * quelqu'un qui court dans sept mois.
 */
export function ppsVerdict(
  status: PpsStatus | null | undefined,
  raceDate?: string | null,
  today: Date = new Date(),
): PpsVerdict {
  if (status?.licensed) return { kind: "licencie" };
  // L'expiration IMPRIMÉE sur le pass prime : elle est exacte, alors que la déduction
  // « délivrance + 12 mois » suppose que la règle n'a pas changé entre-temps.
  const expiresAt = parseJour(status?.expiresAt) ? status!.expiresAt! : ppsExpiration(status?.obtainedAt);
  if (!expiresAt) return { kind: "inconnu" };

  const now = new Date(iso(today) + "T12:00:00").getTime();
  const fin = new Date(expiresAt + "T12:00:00").getTime();
  if (fin < now) return { kind: "expire", expiresAt };

  const course = parseJour(raceDate ?? null);
  // Une course PASSÉE ne pose plus de question : on ne va pas alarmer quelqu'un sur une
  // échéance qu'il a déjà franchie.
  if (course && course.getTime() >= now && course.getTime() > fin) {
    return { kind: "expireAvantCourse", expiresAt, raceDate: raceDate! };
  }
  return { kind: "valide", expiresAt, joursRestants: Math.max(0, Math.round((fin - now) / jour)) };
}

/** Le verdict demande-t-il une action ? Sert à décider d'afficher, ou non, une alerte. */
export const ppsDemandeAction = (v: PpsVerdict): boolean =>
  v.kind === "inconnu" || v.kind === "expire" || v.kind === "expireAvantCourse";
