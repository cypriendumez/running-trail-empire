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
 *  · modèles  → `src/data/gear/chaussures.json` compte ~309 chaussures, toutes avec
 *               leur code-barres. ⚠️ Ce chiffre a REMPLACÉ « 10 min de replanification »,
 *               qui annonçait la cadence DEMANDÉE au planificateur GitHub et non celle
 *               obtenue : mesuré le 02/09/2026 sur leur API, un passage toutes les
 *               ~100 minutes. Un fichier de planification n'est pas une preuve
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
  /**
   * ⚠️ CE CHIFFRE ÉTAIT « 10 min » ET IL ÉTAIT FAUX DEUX FOIS. Il annonçait la cadence
   * DEMANDÉE au planificateur GitHub, jamais celle obtenue : mesuré le 02/09/2026, un
   * passage toutes les ~100 minutes. Et depuis que la demande est passée à deux par
   * heure, même la valeur affichée ne correspondait plus au fichier.
   *
   * Ce qui est vrai et se vérifie, c'est le CATALOGUE du comparateur d'équipement :
   * `src/data/gear/chaussures.json` contient ~309 modèles, tous avec leur code-barres.
   * On annonce donc un chiffre recomptable, arrondi vers le bas.
   *
   * (La réactivité réelle du coach ne se mesure pas en minutes de cron : elle vient du
   * webhook de synchronisation instantanée, qui replanifie dès qu'une séance arrive.)
   */
  modeles: "300+",
} as const;

/** Ordre d'affichage du bandeau de la page d'accueil (4 chiffres). */
export const CHIFFRES_LANDING = [
  CHIFFRES.courses,
  CHIFFRES.parcours,
  CHIFFRES.plan,
  CHIFFRES.modeles,
] as const;

/** Les 3 chiffres du panneau de marque des pages d'auth. */
export const CHIFFRES_AUTH = [
  CHIFFRES.courses,
  CHIFFRES.parcours,
  CHIFFRES.modeles,
] as const;
