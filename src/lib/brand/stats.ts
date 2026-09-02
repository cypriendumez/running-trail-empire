/**
 * LES CHIFFRES QUE L'APP A LE DROIT D'AFFICHER.
 *
 * Source UNIQUE, et c'est le point. Trois chiffres inventés — « 10k+ coureurs »,
 * « 4,9 ★ de note moyenne », « 98 % de satisfaction » — avaient été retirés de la page
 * d'accueil parce que la base compte UN profil et qu'il n'existe ni note ni enquête.
 * Ils sont restés affichés sur les pages de connexion et d'inscription, qui portaient
 * leur propre copie : corrigé d'un côté, intact de l'autre. Même défaut que les photos.
 *
 * Chaque entrée ci-dessous est RECOMPTABLE. Relevé du 20/08/2026 :
 *  · courses  → 14 430 lignes de `races` portent une date à venir (17 027 au total) ;
 *  · parcours → `data/parcours_certifies.json` contient 15 708 entrées ;
 *  · plan     → `buildWeekPlan` pose 7 jours de plan glissant ;
 *  · synchro  → `.github/workflows/sync-coach.yml` DEMANDE deux passages par heure.
 *               ⚠️ « demande » et non « tourne » : mesuré le 02/09/2026 sur l'API GitHub,
 *               le fichier réclamait alors six passages par heure et n'en obtenait qu'un
 *               toutes les ~100 minutes. Un fichier de planification n'est pas une preuve
 *               d'exécution — c'est `total_count` des runs qui l'est.
 *
 * ⚠️ N'ajouter ici QUE ce qui se recompte par une requête ou une lecture de fichier.
 * Une note moyenne, un nombre d'utilisateurs ou un taux de satisfaction n'y ont leur
 * place que le jour où quelque chose les mesure vraiment.
 */
export const CHIFFRES = {
  /** Courses à venir dans la base (arrondi PRUDENT vers le bas : 14 430 mesurées). */
  courses: "14 000+",
  /** Parcours certifiés par le crawl (15 708 mesurés, arrondi vers le bas). */
  parcours: "15 700",
  /** Horizon du plan glissant produit par `buildWeekPlan`. */
  plan: "7 j",
  /** Cadence réelle de la replanification (workflow GitHub Actions). */
  synchro: "10 min",
} as const;

/** Ordre d'affichage du bandeau de la page d'accueil (4 chiffres). */
export const CHIFFRES_LANDING = [
  CHIFFRES.courses,
  CHIFFRES.parcours,
  CHIFFRES.plan,
  CHIFFRES.synchro,
] as const;

/** Les 3 chiffres du panneau de marque des pages d'auth. */
export const CHIFFRES_AUTH = [
  CHIFFRES.courses,
  CHIFFRES.parcours,
  CHIFFRES.synchro,
] as const;
