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
  | "lecture"  // historique, courses, trophées, séries, carte et parcours — toujours ouvert
  | "plan_objectif" // le plan bâti sur l'OBJECTIF seul : aucune mesure lue, rien sur la montre
  | "plan"     // le plan ADAPTATIF : séances, sommeil, VFC, FC lus ; poussé sur la montre
  | "gpx"      // exporter une trace en GPX (Carte et parcours) — la carte elle-même est ouverte
  | "ia"       // faire parler un modèle (analyse, kiné, coach, assistant)
  | "plan_ia"  // le coach avancé : le modèle relit le PLAN (séances clés, avis sur la semaine)
  | "journal"  // l'analyse du Smart Journal — écran retiré le 30/09/2026, route sans appelant
  | "analyse_longue"; // l'analyse de séance en version développée

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
  // ⚠️ `elite` MANQUAIT, et ce n'était pas un alias décoratif : c'est l'une des TROIS
  // seules valeurs que la colonne accepte réellement en base
  // (`create type subscription_tier as enum ('free', 'pro', 'elite')`). Un compte porté
  // à ce palier — le plus haut du schéma d'origine — retombait donc sur « gratuit » et
  // se voyait refuser son plan, en silence, avec le motif « essai_expire ».
  elite: "premium",
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
 * ses courses et ses trophées, la carte et les parcours. Servir ces pages ne coûte
 * rien, et une coupure sèche fait désinstaller l'app.
 */
/**
 * ⚠️ CE QUI EST PAYANT, C'EST L'ADAPTATION — DÉCISION COMMERCIALE, PAS TECHNIQUE.
 *
 * `autoPlan` et `autoCoach` sont DÉTERMINISTES : republier sept jours ne consomme aucun
 * jeton, quel que soit le palier. Le gratuit reçoit donc un plan, bâti sur son objectif.
 * Ce qui se vend, c'est le coach qui LIT : chaque séance analysée, le sommeil, la VFC,
 * la fréquence cardiaque, la fraîcheur du jour — et la séance envoyée au poignet.
 *
 * `ia` reste la seule capacité dont la dépense grandit avec le nombre d'athlètes, et
 * son volume (PLAFOND_JOUR) sépare les deux formules payantes.
 */
const DROITS: Record<Acces, Capacite[]> = {
  // ⚠️ LE DÉCOUPAGE DU 22/10/2026 (Cyprien) : « dans l'abonnement gratuit, les
  // utilisateurs n'ont accès qu'au plan d'entraînement gratuit, ou alors ils mettent leur
  // prochaine course ou un objectif de temps ou de distance, et l'IA donne les séances
  // selon ces objectifs — mais en aucun cas le coach n'analyse leurs séances, leur
  // sommeil, leurs caractéristiques physiques et physiologiques ».
  //
  // Le gratuit reçoit donc un VRAI plan de sept jours, mais bâti sur l'objectif et sur ce
  // que l'athlète DÉCLARE (disponibilités, VMA du test, douleurs signalées), plus les
  // kilomètres qu'il court — seul garde-fou contre une montée de volume qui blesse. Ce
  // qu'il ne lit pas : sommeil, VFC, fréquence cardiaque, puissance, foulée, ressenti,
  // météo, analyse de chaque séance. Voir `buildAthleteContext(…, { objectifSeul })`.
  // Rien n'est poussé sur la montre et aucun modèle ne parle.
  //
  // La carte, tous les parcours, le Ghost Runner vocal et le comparateur sont ouverts à
  // tous : ils relèvent de `lecture`, qu'aucune route ne refuse.
  gratuit: ["lecture", "plan_objectif"],
  // L'essai montre le niveau Premium : juger le produit sur la formule basse ferait
  // choisir Starter par méconnaissance, ou renoncer.
  essai: ["lecture", "plan_objectif", "plan", "ia", "gpx", "analyse_longue", "plan_ia", "journal"],
  // ⚠️ L'ANALYSE DÉVELOPPÉE ET LE GPX DANS LES DEUX FORMULES PAYANTES (Cyprien, 22/10) :
  // « pour les deux abonnements, il faut que le coach IA soit très puissant en analyse de
  // séance », et l'export GPX vers la montre « dans les abonnements payants ». Le kiné IA
  // y est par `ia`. Ce qui sépare encore Premium : trois fois plus d'appels IA par jour
  // (`PLAFOND_JOUR`) et le coach avancé (`plan_ia`) — le modèle qui relit le PLAN : les
  // séances clés chaque jour, et « Un avis sur ma semaine » à la demande (route
  // `ai/ajustement`, réservée le 23/10/2026 pour que Premium ait une exclusivité RÉELLE).
  starter: ["lecture", "plan_objectif", "plan", "ia", "gpx", "analyse_longue"],
  premium: ["lecture", "plan_objectif", "plan", "ia", "gpx", "analyse_longue", "plan_ia", "journal"],
};

/**
/**
 * COMBIEN DE JOURS D'ESSAI STRIPE ACCORDER À CET ATHLÈTE.
 *
 * ⚠️ PAS `JOURS_ESSAI` EN DUR. L'application offre déjà un essai gratuit, sans carte,
 * qui démarre à l'inscription. Poser `trial_period_days: JOURS_ESSAI` au moment du
 * paiement AJOUTAIT une seconde période à la première : quelqu'un qui s'inscrivait et
 * s'abonnait le jour même obtenait quatorze jours avant le premier euro, sans que
 * personne l'ait décidé. Décision de Cyprien le 23/08/2026 : on ne donne que le RESTE.
 *
 * Les trois cas, et pourquoi chacun rend ce qu'il rend :
 *  · en cours d'essai → le nombre de jours qu'il lui reste, ni plus ni moins. Il ne perd
 *    rien de ce qui lui avait été promis, et n'obtient pas deux fois la même faveur ;
 *  · essai terminé → 0. Le paiement est immédiat, et le bouton doit le DIRE : c'est
 *    l'appelant qui adapte son libellé sur ce zéro (voir /pricing) ;
 *  · déjà abonné → 0. Il passe par le portail Stripe pour changer de formule, où la
 *    proratisation s'applique — lui rouvrir un essai serait lui offrir des jours payés.
 *
 * ⚠️ ZÉRO N'EST PAS UNE DURÉE. Stripe refuse `trial_period_days: 0` ; l'appelant doit
 * OMETTRE le champ, pas le passer à zéro. C'est pour ça que cette fonction rend un
 * nombre et pas un objet : le site d'appel reste responsable de la forme.
 *
 * Fonction PURE : testable sans réseau ni base, comme `accesDe` dont elle dérive.
 */
export function joursEssaiStripe(p: ProfilAcces | null | undefined, maintenant?: number): number {
  const { etat, joursRestants } = accesDe(p, maintenant);
  // `joursRestants === null` signifie « hors période d'essai » : abonné actif.
  if (etat !== "essai" || joursRestants === null) return 0;
  // Borné des deux côtés : une date de création dans le FUTUR (import, fuseau, saisie
  // manuelle) donnerait sinon un essai plus long que celui qu'on annonce.
  return Math.max(0, Math.min(JOURS_ESSAI, joursRestants));
}

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
