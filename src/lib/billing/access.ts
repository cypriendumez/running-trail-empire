// ─────────────────────────────────────────────────────────────────────────────
//  QUI A DROIT À QUOI — la seule source de vérité de l'accès.
//
//  AVANT CE MODULE, IL N'Y AVAIT AUCUN VERROU. `subscription_tier` n'était lu que
//  pour AFFICHER un badge dans la barre latérale et les réglages, et écrit par le
//  webhook Stripe. Aucune route, aucune fonctionnalité n'était protégée : la page
//  de tarifs vendait des formules que rien n'appliquait, et « 5 plans IA / mois »
//  du palier gratuit n'était compté nulle part.
//
//  LE DÉCOUPAGE SUIT LE COÛT RÉEL, pas une envie de remplir des cartes.
//  `autoPlan` et `autoCoach` sont DÉTERMINISTES : reconstruire le plan de sept
//  jours ne consomme aucun jeton, donc ne coûte quasiment rien par athlète. Ce qui
//  coûte, c'est l'IA qui PARLE — analyse de séance, kiné, journal, assistant. D'où
//  deux formules dont l'écart correspond à une dépense réelle, et non à un argument.
//
//  AUCUNE MIGRATION. L'essai se déduit de `profiles.created_at`, qui existe déjà ;
//  la formule de `profiles.subscription_tier`, qui existe aussi. Ajouter une
//  colonne `trial_ends_at` aurait été une migration de plus à ne jamais oublier
//  d'appliquer — et une date de fin stockée diverge du jour où on la recalcule.
// ─────────────────────────────────────────────────────────────────────────────

/** Les seules colonnes nécessaires pour trancher. Aucune autre n'est lue : une requête
 *  large ici ferait transiter `intervals_api_key` pour rien. Déclarée dans ce module
 *  PUR pour que la chaîne du coach n'ait pas à charger `NextResponse` afin de lire
 *  deux noms de colonnes. */
export const COLONNES_ACCES = "created_at, subscription_tier";

/** Ce à quoi un compte a droit, à un instant donné. */
export type Acces =
  | "gratuit"    // permanent, sans carte : ses données, son historique, les courses
  | "essai"      // 7 jours d'IA au niveau Premium, pour juger le module payant
  | "starter"    // + 10 appels IA par jour
  | "premium";   // + 30 appels IA par jour

/** Ce qu'on cherche à faire. */
export type Capacite =
  | "lecture"  // historique, courses, trophées, séries — toujours ouvert
  | "plan"     // produire ou replanifier un entraînement
  | "ia";      // faire parler un modèle (analyse, kiné, journal, assistant)

/**
 * Durée de l'essai du module IA, en jours.
 *
 * SEPT, et c'est cohérent PARCE QU'IL EXISTE UN PALIER GRATUIT PERMANENT.
 *
 * L'argument qui imposait trente jours tenait tant que l'essai devait démontrer le
 * COACH : `computeLoad` travaille sur au moins 42 jours, le ratio aigu:chronique sur
 * 28, la protection de charge de la série exige 8 journées actives — un athlète sans
 * historique ne peut pas juger un plan adaptatif en une semaine.
 *
 * Mais le coach n'est plus derrière l'essai : il est GRATUIT, pour toujours, parce
 * qu'il ne coûte rien à servir (`autoPlan` et `autoCoach` sont déterministes, aucun
 * appel de modèle). L'essai ne démontre donc plus que le module IA — et sept jours
 * suffisent largement à poser vingt questions à un assistant et à se faire un avis.
 *
 * L'athlète a tout le temps du monde pour juger le plan : il ne paie pas pour lui.
 */
export const JOURS_ESSAI = 7;

/** Ce que le webhook Stripe a pu écrire, plus ce que l'historique a laissé. */
const TIERS_PAYANTS: Record<string, Extract<Acces, "starter" | "premium">> = {
  starter: "starter",
  premium: "premium",
  // Les paliers historiques donnaient tout : ils atterrissent sur le plus généreux.
  // Les supprimer ferait rétrograder en silence des comptes déjà payants.
  pro: "premium",
  complet: "premium",
  essentiel: "starter",
};

export type ProfilAcces = {
  created_at?: string | null;
  subscription_tier?: string | null;
};

export type EtatAcces = {
  etat: Acces;
  /** Jours d'essai restants (0 le dernier jour), `null` hors période d'essai. */
  joursRestants: number | null;
  /** Vrai quand l'essai vient de se terminer sans abonnement : c'est CE cas qui
   *  doit déclencher une invitation, jamais une coupure sèche. */
  essaiExpire: boolean;
};

/**
 * L'état d'accès d'un profil.
 *
 * ⚠️ EN CAS DE DOUTE, ON N'ENFERME PAS. Une date de création absente ou illisible
 * donne l'essai, pas la consultation : un compte importé, une colonne vide ou une
 * chaîne mal formée ne doit jamais fermer la porte à quelqu'un qui paie peut-être
 * déjà. Le pire défaut possible ici n'est pas de laisser passer un fraudeur, c'est
 * de verrouiller un client légitime sans qu'il comprenne pourquoi.
 */
export function accesDe(p: ProfilAcces | null | undefined, maintenant: number = Date.now()): EtatAcces {
  const paye = TIERS_PAYANTS[String(p?.subscription_tier ?? "").toLowerCase().trim()];
  if (paye) return { etat: paye, joursRestants: null, essaiExpire: false };

  const debut = Date.parse(String(p?.created_at ?? ""));
  if (!Number.isFinite(debut)) return { etat: "essai", joursRestants: JOURS_ESSAI, essaiExpire: false };

  // Jours ENTIERS écoulés : un compte créé il y a 29 j et 23 h est encore en essai.
  const ecoules = Math.floor((maintenant - debut) / 86_400_000);
  const restants = JOURS_ESSAI - ecoules;
  if (restants > 0) return { etat: "essai", joursRestants: restants, essaiExpire: false };
  // L'essai fini retombe sur le palier gratuit permanent : rien n'est effacé, les
  // activités continuent d'être synchronisées, l'historique et les courses restent
  // consultables. Ce qui s'arrête, c'est la production de nouvelles prescriptions et
  // les échanges avec l'IA.
  return { etat: "gratuit", joursRestants: 0, essaiExpire: true };
}

/**
 * Le tableau des droits. Une seule table, lue partout — c'est ce qui empêche deux
 * écrans de répondre différemment à la même question.
 *
 * `lecture` est ouvert à TOUS les états, y compris la consultation, et c'est
 * délibéré : à l'expiration on ne coupe pas tout. L'athlète garde son historique,
 * ses courses et ses trophées, il perd seulement la production de nouveaux plans.
 * Servir ces pages ne coûte rien, et une coupure sèche fait désinstaller l'app —
 * alors qu'un compte en consultation revient de lui-même à la préparation suivante.
 */
/**
 * ⚠️ LE PLAN EST PAYANT — DÉCISION COMMERCIALE, PAS TECHNIQUE, ET IL FAUT LE SAVOIR.
 *
 * `autoPlan` et `autoCoach` sont DÉTERMINISTES : republier sept jours ne consomme aucun
 * jeton et ne coûte donc rien à servir. Le mettre derrière l'abonnement ne protège
 * aucune dépense — c'est un choix d'ACQUISITION assumé par Cyprien : le coach adaptatif
 * est ce que le produit a de meilleur, donc c'est lui qui doit décider quelqu'un à
 * payer, pas seulement l'IA conversationnelle.
 *
 * Ce que ça coûte, en revanche : le palier gratuit devient un CONSULTATEUR. Il garde
 * ses activités (la synchronisation intervals.icu tourne indépendamment du verrou,
 * vérifié dans syncAndCoach), son historique, ses courses et ses trophées — mais plus
 * de prescription. Si les inscriptions se tarissent, c'est la première ligne à
 * réexaminer : remettre `plan` ici ne coûterait toujours rien.
 *
 * `ia` reste la seule capacité dont la dépense grandit avec le nombre d'athlètes, et
 * son volume (PLAFOND_JOUR) sépare les deux formules payantes.
 */
const DROITS: Record<Acces, Capacite[]> = {
  gratuit: ["lecture"],
  essai: ["lecture", "plan", "ia"],
  starter: ["lecture", "plan", "ia"],
  premium: ["lecture", "plan", "ia"],
};

export function peut(etat: Acces, quoi: Capacite): boolean {
  return DROITS[etat].includes(quoi);
}

/** Raccourci pour les appelants qui n'ont qu'un profil sous la main. */
export function profilPeut(p: ProfilAcces | null | undefined, quoi: Capacite, maintenant?: number): boolean {
  return peut(accesDe(p, maintenant).etat, quoi);
}

/**
 * Le motif de refus, destiné à être renvoyé tel quel par une route.
 *
 * On ne renvoie JAMAIS un 403 muet : l'athlète doit savoir laquelle des deux
 * situations il vit — son essai est fini, ou sa formule ne couvre pas l'IA — parce
 * que ce ne sont pas les mêmes gestes qui les résolvent.
 */
export function motifRefus(etat: Acces, quoi: Capacite): "essai_expire" | "formule_insuffisante" | null {
  if (peut(etat, quoi)) return null;
  // Un compte gratuit se voit refuser le plan ET l'IA : dans les deux cas le geste qui
  // débloque est le même — prendre une formule.
  return etat === "gratuit" ? "essai_expire" : "formule_insuffisante";
}
