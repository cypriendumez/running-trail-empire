// ─────────────────────────────────────────────────────────────────────────────
//  LA SÉRIE — la boucle quotidienne, alignée sur la santé de l'athlète.
//
//  LE PROBLÈME. Une « flamme » à la Duolingo compte les jours de pratique. Chez
//  Duolingo, pratiquer tous les jours est inoffensif. Courir tous les jours ne
//  l'est pas : cette application PRESCRIT du repos, refuse l'intensité quand la
//  charge est au rouge et raccourcit la sortie longue quand le ratio aigu:chronique
//  monte. Une série qui casse un jour de repos ferait courir l'athlète CONTRE son
//  propre coach — l'app deviendrait la cause des blessures qu'elle prévient.
//
//  LA RÈGLE, EN UNE PHRASE. La série ne compte pas « avoir couru » mais
//  « avoir fait ce que le coach a demandé ». Un jour de repos PRESCRIT et
//  RESPECTÉ entretient la série exactement comme une séance réalisée.
//
//  CALCULÉE À LA LECTURE, JAMAIS STOCKÉE — et ce n'est pas un détail
//  d'implémentation, c'est la réponse au défaut le plus grave de ce type de
//  mécanique. Les séances arrivent d'intervals.icu par balayage, souvent avec un
//  jour de retard, parfois cinq (mesuré sur le compte de production : séance du
//  02/08 enregistrée le 07/08). Un compteur PERSISTÉ devrait être décrémenté à
//  minuit par un cron ; quand la séance arriverait enfin, la casse serait déjà
//  écrite et personne ne saurait la défaire. Ici il n'y a rien à défaire : la
//  série est recalculée depuis les faits bruts à chaque affichage, donc une séance
//  synchronisée deux jours plus tard RÉPARE la série au lieu de la casser.
//
//  AUCUNE TABLE, AUCUNE MIGRATION. Tout se déduit de ce que le tableau de bord
//  charge déjà : les séances (`workouts`), les prescriptions (`notifications`
//  type `coach_session`) et les ressentis (`session_feedback`).
// ─────────────────────────────────────────────────────────────────────────────

// Le barème de charge est IMPORTÉ, jamais recopié : la série doit lire exactement
// la même charge que le tableau de bord et que le coach.
import { jourCivil, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

import { estimateTSS } from "@/lib/running/fitness";

/** Séance réellement enregistrée (montre → intervals.icu → `workouts`). */
export type StreakWorkout = {
  date: string;
  sport?: string | null;
  type?: string | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  tss?: number | null;
  training_effect?: number | null;
};

/** Ce que le coach a prescrit ce jour-là (`notifications.data` du type `coach_session`). */
export type StreakPrescription = {
  date?: unknown;
  sessionType?: unknown;
  /** Créneau (« matin »/« soir ») — une journée doublée reste UNE journée. */
  moment?: unknown;
};

/** Ressenti post-séance : la seule source de douleur déclarée qui existe en base
 *  (la table `pain_report` n'existe pas — vérifié sur la base de production). */
export type StreakFeedback = { date?: unknown; pain?: unknown };

/** Ce qui est arrivé à une journée. Cinq états, et un seul casse la série. */
export type DayVerdict =
  | "tenu"      // le contrat du jour est rempli (séance faite, ou repos respecté)
  | "attente"   // trop récent pour être jugé : la synchro peut encore arriver
  | "protege"   // manqué, mais pour une raison que le coach approuve (charge, douleur)
  | "hors"      // hors contrat : rien n'était prescrit, ou l'athlète a fait autre chose
  | "rompu";    // séance prescrite, jamais arrivée, aucune excuse : la série s'arrête là

/** Motif du verdict — clé stable, traduite à l'affichage (jamais de texte ici). */
export type DayReason =
  | "seance-faite"      // prescrit : courir → couru
  | "repos-respecte"    // prescrit : repos → aucune charge ce jour-là
  | "renfo"             // prescrit : renfo → invérifiable, on l'accorde
  | "attente-synchro"   // la séance peut encore arriver
  | "protege-charge"    // surcharge : ne pas courir était le bon choix
  | "protege-douleur"   // douleur déclarée : ne pas courir était le bon choix
  | "sans-plan"         // aucune prescription ce jour-là
  | "repos-charge"      // gros effort un jour de repos : ni récompensé, ni puni
  | "manquee";          // séance prescrite et non faite

export type StreakDay = {
  date: string;
  verdict: DayVerdict;
  reason: DayReason;
  /** Type prescrit, en français canonique (« Repos », « Seuil »…). Null si rien. */
  prescribed: string | null;
  /** Une activité a-t-elle été enregistrée ce jour-là ? */
  trained: boolean;
};

export type StreakResult = {
  /** Jours tenus d'affilée jusqu'à aujourd'hui. */
  current: number;
  /** Record sur la fenêtre réellement observable. */
  best: number;
  /** Les journées, de la plus ancienne à aujourd'hui. */
  days: StreakDay[];
  /** La journée en cours. */
  today: StreakDay | null;
  /** Jours récents encore en attente de synchronisation (affichés comme tels). */
  pending: number;
  /**
   * La prochaine journée susceptible de rompre la série, et la date à laquelle
   * elle sera jugée. C'est ce qui permet de DIRE ce qui casserait la série sans
   * inventer un compte à rebours anxiogène.
   */
  threat: { date: string; judgedOn: string } | null;
  /** Première date réellement observable — la série ne prétend rien avant. */
  since: string | null;
};

// ── Réglages, tous justifiés par une mesure ──────────────────────────────────

/**
 * Âge (en jours) en deçà duquel une journée n'est JAMAIS jugée manquée.
 *
 * Mesuré sur le compte de production, en régime normal (hors import initial), le
 * retard entre la date d'une séance et son enregistrement va de 0 à 3 jours. La
 * fenêtre couvre donc le pire retard observé, et un jour de marge se rajoute du
 * fait que le jugement porte sur les jours STRICTEMENT plus vieux que la fenêtre.
 */
export const FENETRE_SYNCHRO_JOURS = 3;

/**
 * Une semaine entière sans un seul jour tenu n'est plus une série, même si aucun
 * jour n'a été formellement « rompu ». Sans ce garde-fou, le compte réel afficherait
 * une série de plus de deux mois en traversant les sept semaines de juin-juillet où
 * AUCUN plan n'avait été publié : des jours « hors contrat » enchaînés, donc jamais
 * rompus. Une série qu'aucun comportement ne peut interrompre ne veut plus rien dire.
 */
export const ABANDON_JOURS = 7;

/** En deçà, ce n'est pas une séance mais un artefact GPS. */
export const ACTIVITE_MIN_MINUTES = 15;

/** Une douleur déclarée couvre le jour même et les deux suivants. */
export const PROTECTION_DOULEUR_JOURS = 2;

/**
 * Seuil de surcharge — RIGOUREUSEMENT celui de `loadRisk().deload`
 * (`src/lib/running/fitness.ts`). La série ne peut donc pas reprocher un jour de
 * repos à un athlète à qui le tableau de bord affiche, le même jour, « Déload
 * recommandé ». Deux seuils auraient fini par diverger, et l'app se serait
 * contredite d'une carte à l'autre.
 */
export const SEUIL_SURCHARGE_ACWR = 1.5;

/** Au-delà, la journée de repos n'a plus rien d'un repos. */
export const REPOS_CONTREDIT_MINUTES = 60;

/**
 * Nombre minimal de journées actives dans la fenêtre chronique pour qu'un ratio
 * aigu:chronique veuille dire quelque chose.
 *
 * Défaut CONSTATÉ sur le compte réel : après sept semaines sans données, la fenêtre
 * chronique ne contenait plus que trois journées ; le ratio affichait 4,00 et la
 * série se serait déclarée « protégée par la surcharge » sur toute la reprise —
 * autrement dit une série que plus rien n'aurait pu interrompre, pour cause de
 * division par presque rien.
 */
export const MIN_JOURS_CHARGE = 8;

// ── Dates : une seule conversion, à la frontière ─────────────────────────────

/**
 * Date du jour de l'ATHLÈTE au format `AAAA-MM-JJ` — MÊME convention que `iso()` dans
 * autoPlan, qui produit les dates des prescriptions.
 *
 * ⚠️ CE N'EST PLUS « LE JOUR DU MOTEUR ». La version précédente lisait `getFullYear()`,
 * `getMonth()`, `getDate()` — donc le fuseau de la machine qui exécute le code. Sur un
 * rendu SERVEUR, cette machine est à iad1 (États-Unis) : de minuit à 6 h du matin heure
 * de Paris, elle répondait la VEILLE. La série, le volume et la forme demandaient tous
 * « quel jour est-on ? » et recevaient le jour de Washington.
 *
 * Le fuseau par défaut est `Europe/Paris` et non celui du moteur, pour deux raisons :
 * il est juste pour la quasi-totalité des athlètes, et surtout il est IDENTIQUE côté
 * serveur et côté navigateur — sans quoi les deux rendus divergent et React remplace la
 * page (erreur #418, 23 occurrences mesurées). Là où le fuseau réel de l'athlète est
 * disponible (cookie `pacevo_tz`), on le passe explicitement.
 */
export const jourLocal = (d: Date = new Date(), tz: string = FUSEAU_DEFAUT): string => jourCivil(d, tz);

/**
 * Décalage en jours d'une date `AAAA-MM-JJ`, ancré à MIDI UTC.
 *
 * Ancré à midi et non à minuit : `Date.parse("2026-03-29T00:00:00Z") + 86400000`
 * reste juste, mais toute reconstruction passant par les accesseurs locaux
 * sauterait ou répéterait un jour aux changements d'heure. À midi, aucun décalage
 * horaire de la planète ne fait changer la date de jour.
 */
export function decaleJour(iso: string, n: number): string {
  // ⚠️ LA FORME EST VÉRIFIÉE AVANT L'ANALYSE. `Date.parse("0000T12:00:00Z")` réussit et
  // produisait « 0-01-02 » : une date absurde là où la documentation ci-dessus promet de
  // rendre l'entrée telle quelle quand elle est illisible. Le contrat était donc violé
  // en silence. Trouvé en écrivant les tests du module `lib/time`.
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso ?? ""))) return iso;
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t + n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Nombre de jours entre deux dates `AAAA-MM-JJ` (b − a). */
export function ecartJours(a: string, b: string): number {
  const ta = Date.parse(`${a}T12:00:00Z`), tb = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return Math.round((tb - ta) / 86400000);
}

// ── Lecture des prescriptions ────────────────────────────────────────────────

const txt = (v: unknown) => String(v ?? "");

/** Journée de repos prescrite. Les types du plan sont en français canonique. */
export const estRepos = (type?: string | null): boolean => /repos|\brest\b/i.test(txt(type));

/**
 * Renforcement musculaire. Invérifiable : une séance de gainage au salon n'arrive
 * dans `workouts` par aucun chemin. La juger reviendrait à fabriquer un jour manqué
 * chaque semaine, pour tout le monde — exactement le faux négatif que `coachContext`
 * évite déjà en excluant Renfo de son calcul d'adhérence.
 */
export const estRenfo = (type?: string | null): boolean =>
  /renfo|muscu|gainage|ppg|strength/i.test(txt(type));

/** Une séance dure, au sens du tableau de bord (même famille de mots-clés). */
const estSeanceDure = (w: StreakWorkout): boolean => {
  const t = txt(w.type).toLowerCase();
  if (/easy|recovery|long|trail|endurance|footing|récup|fond|marche/.test(t)) return false;
  if (/interval|vma|tempo|seuil|race|hill|fractionn|côte|cote|sprint|vif|fartlek|threshold/.test(t)) return true;
  return (w.training_effect ?? 0) >= 4;
};

// ── Charge reconstruite À UNE DATE DONNÉE ────────────────────────────────────

/**
 * Ratio aigu:chronique tel qu'il était CE JOUR-LÀ.
 *
 * `loadRisk()` ne sait le calculer qu'à l'instant présent : impossible de savoir a
 * posteriori si un jour manqué il y a dix jours l'avait été en pleine surcharge.
 * On refait donc le même calcul, ancré sur la date voulue — mêmes fenêtres (7 j
 * aigu, 28 j chronique), même formule, même seuil.
 */
export function acwrAu(date: string, tssParJour: Map<string, number>): number {
  let aigu = 0, chronique = 0, joursActifs = 0;
  for (let i = 0; i < 28; i++) {
    const v = tssParJour.get(decaleJour(date, -i)) ?? 0;
    chronique += v;
    if (v > 0) joursActifs++;
    if (i < 7) aigu += v;
  }
  // Base chronique trop maigre → le ratio n'est pas une surcharge, c'est un artefact
  // de division. On renvoie 0 : « pas de surcharge démontrable », jamais une excuse
  // fabriquée. Voir MIN_JOURS_CHARGE.
  if (chronique <= 0 || joursActifs < MIN_JOURS_CHARGE) return 0;
  return Math.round((aigu / (chronique / 4)) * 100) / 100;
}

// ── Le moteur ────────────────────────────────────────────────────────────────

export type StreakInput = {
  workouts: StreakWorkout[];
  prescriptions: StreakPrescription[];
  feedbacks?: StreakFeedback[];
  /** Aujourd'hui, `AAAA-MM-JJ`. Toujours fourni par l'appelant → fonction pure. */
  today: string;
  /** Profondeur d'observation, en jours. */
  windowDays?: number;
};

export function computeStreak(input: StreakInput): StreakResult {
  const { today, windowDays = 120 } = input;
  const workouts = (input.workouts ?? []).filter((w) => w?.date);
  const prescriptions = (input.prescriptions ?? []).filter((p) => txt(p?.date).length >= 10);

  // ── Agrégats par JOURNÉE. Deux séances le même jour font UNE journée : sans
  //    cette agrégation, un jour doublé (matin + soir) compterait deux fois ici et
  //    une seule sur le calendrier, qui déduplique par `date#moment`.
  const activiteParJour = new Map<string, { minutes: number; dure: boolean }>();
  const tssParJour = new Map<string, number>();
  for (const w of workouts) {
    const d = txt(w.date).slice(0, 10);
    if (d.length < 10) continue;
    const min = (w.duration_seconds ?? 0) / 60;
    const prev = activiteParJour.get(d) ?? { minutes: 0, dure: false };
    activiteParJour.set(d, { minutes: prev.minutes + min, dure: prev.dure || estSeanceDure(w) });
    tssParJour.set(d, (tssParJour.get(d) ?? 0) + estimateTSS(w));
  }

  // Prescriptions par journée. Une journée est « de repos » seulement si TOUS ses
  // créneaux le sont : un jour qui porte « Repos (matin) + Endurance (soir) » est
  // un jour d'entraînement, pas un jour de repos.
  const planParJour = new Map<string, string[]>();
  for (const p of prescriptions) {
    const d = txt(p.date).slice(0, 10);
    const t = txt(p.sessionType) || "?";
    const l = planParJour.get(d) ?? [];
    // Un même créneau republié plusieurs fois ne doit pas peser deux fois.
    if (!l.includes(t)) l.push(t);
    planParJour.set(d, l);
  }

  // Douleurs déclarées : « Aucune douleur » n'est pas une douleur.
  const douleurs = new Set<string>();
  for (const f of input.feedbacks ?? []) {
    const d = txt(f?.date).slice(0, 10);
    if (d.length < 10) continue;
    const zones = Array.isArray(f?.pain) ? (f.pain as unknown[]).map(txt) : [];
    if (zones.some((z) => z.trim() && !/aucune douleur|no pain|keine schmerzen|sin dolor|sem dor/i.test(z))) {
      douleurs.add(d);
    }
  }
  const douleurProche = (d: string): boolean => {
    for (let i = 0; i <= PROTECTION_DOULEUR_JOURS; i++) if (douleurs.has(decaleJour(d, -i))) return true;
    return false;
  };

  /**
   * Le coach approuve-t-il de ne PAS s'être entraîné ce jour-là ?
   *
   * Isolé du jugement lui-même parce qu'il sert deux fois : pour trancher les jours
   * anciens, et pour savoir si une journée encore en attente de synchronisation
   * MENACE réellement la série. Sans cette seconde lecture, la carte annonçait
   * « le 12/08 sera jugé le 16/08 » pour une journée qui, ce jour-là, sortait à un
   * ratio aigu:chronique de 1,82 : elle allait être protégée, pas rompue. On
   * annonçait une casse qui n'aurait jamais eu lieu.
   */
  const protectionDe = (d: string): DayReason | null =>
    douleurProche(d) ? "protege-douleur"
      : acwrAu(d, tssParJour) >= SEUIL_SURCHARGE_ACWR ? "protege-charge"
      : null;

  // ── Fenêtre observable : on ne prétend rien avant la première trace réelle.
  const datesConnues = [...activiteParJour.keys(), ...planParJour.keys()].filter((d) => d <= today);
  if (!datesConnues.length) {
    return { current: 0, best: 0, days: [], today: null, pending: 0, threat: null, since: null };
  }
  const plusAncienne = datesConnues.reduce((a, b) => (a < b ? a : b));
  const borne = decaleJour(today, -(windowDays - 1));
  const debut = plusAncienne > borne ? plusAncienne : borne;

  // ── Verdict, jour par jour.
  const days: StreakDay[] = [];
  for (let d = debut; d <= today; d = decaleJour(d, 1)) {
    const types = planParJour.get(d) ?? [];
    const act = activiteParJour.get(d);
    const entraine = !!act && act.minutes >= ACTIVITE_MIN_MINUTES;
    const prescribed = types.length ? types.join(" + ") : null;
    const age = ecartJours(d, today);

    // 1. Rien de prescrit → rien à tenir. Ne casse rien, ne compte pas.
    //    Indispensable : sur le compte réel, sept semaines n'ont reçu aucun plan.
    if (!types.length) {
      days.push({ date: d, verdict: "hors", reason: "sans-plan", prescribed, trained: entraine });
      continue;
    }

    // 2. Repos prescrit — LE cœur du modèle. Ne rien faire TIENT la série.
    if (types.every((t) => estRepos(t))) {
      // Sortie conséquente ou séance dure un jour de repos : on ne la récompense
      // pas (ce serait payer l'athlète pour désobéir au coach) et on ne la punit
      // pas non plus (aucune mécanique ne doit sanctionner le fait de courir).
      const contredit = !!act && (act.dure || act.minutes >= REPOS_CONTREDIT_MINUTES);
      days.push(contredit
        ? { date: d, verdict: "hors", reason: "repos-charge", prescribed, trained: true }
        : { date: d, verdict: "tenu", reason: "repos-respecte", prescribed, trained: entraine });
      continue;
    }

    // 3. Renfo seul : invérifiable → accordé (voir `estRenfo`).
    if (types.every((t) => estRenfo(t))) {
      days.push({ date: d, verdict: "tenu", reason: "renfo", prescribed, trained: entraine });
      continue;
    }

    // 4. Entraînement prescrit et une activité enregistrée → tenu.
    //    Toute activité compte, pas seulement la course : un athlète qui remplace
    //    son footing par 1 h de vélo s'est entraîné. Le CONTENU reste l'affaire du
    //    coach (`adherenceDone` continue, lui, de ne compter que les courses) ;
    //    la série, elle, mesure la présence au rendez-vous.
    if (entraine) {
      days.push({ date: d, verdict: "tenu", reason: "seance-faite", prescribed, trained: true });
      continue;
    }

    // 5. Rien d'enregistré, mais la journée est trop récente pour être jugée :
    //    la synchro peut encore arriver. Ni tenue, ni rompue — en attente.
    if (age <= FENETRE_SYNCHRO_JOURS) {
      days.push({ date: d, verdict: "attente", reason: "attente-synchro", prescribed, trained: false });
      continue;
    }

    // 6. Douleur déclarée, ou surcharge ce jour-là : ne pas courir était la bonne
    //    décision. Le seuil de surcharge est celui qui déclenche « Déload recommandé »
    //    sur le tableau de bord — on ne peut pas afficher « récupère » d'un côté et
    //    casser la série de l'autre pour avoir obéi.
    const excuse = protectionDe(d);
    if (excuse) {
      days.push({ date: d, verdict: "protege", reason: excuse, prescribed, trained: false });
      continue;
    }

    days.push({ date: d, verdict: "rompu", reason: "manquee", prescribed, trained: false });
  }

  // ── Série en cours : on remonte le temps. « attente », « protege » et « hors »
  //    ne comptent pas mais ne coupent pas — jusqu'à une semaine entière sans rien.
  let current = 0, creux = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const v = days[i].verdict;
    if (v === "rompu") break;
    if (v === "tenu") { current++; creux = 0; continue; }
    creux++;
    if (creux >= ABANDON_JOURS) break;
  }

  // ── Record, mêmes règles, dans le sens du temps.
  let best = 0, cour = 0, creux2 = 0;
  for (const d of days) {
    if (d.verdict === "rompu") { cour = 0; creux2 = 0; continue; }
    if (d.verdict === "tenu") { cour++; creux2 = 0; if (cour > best) best = cour; continue; }
    creux2++;
    if (creux2 >= ABANDON_JOURS) { cour = 0; creux2 = 0; }
  }
  if (current > best) best = current;

  // ── Ce qui casserait la série : la plus ancienne journée en attente qui, une fois
  //    jugée, romprait VRAIMENT — celles que la charge ou la douleur protègent déjà
  //    n'en font pas partie. Un fait daté, pas un compte à rebours anxiogène.
  const attente = days.filter((d) => d.verdict === "attente");
  const menace = attente.find((d) => !protectionDe(d.date)) ?? null;

  return {
    current,
    best,
    days,
    today: days[days.length - 1] ?? null,
    pending: attente.length,
    threat: menace ? { date: menace.date, judgedOn: decaleJour(menace.date, FENETRE_SYNCHRO_JOURS + 1) } : null,
    since: days[0]?.date ?? null,
  };
}
