// ─────────────────────────────────────────────────────────────────────────────
//  MODE PERTE DE POIDS — noyau de calcul (pur, sans I/O, donc testable).
//
//  POURQUOI CE MODULE EST ÉCRIT AUSSI DÉFENSIVEMENT
//  Tout ce qu'il produit ressemble à une mesure — « 2 140 kcal/jour », « −0,4 kg/sem »
//  — alors que la moitié est une ESTIMATION issue d'une équation de population. C'est
//  exactement le profil des 38 défauts silencieux de l'audit : un chiffre plausible à
//  l'écran, aucune erreur levée, et personne ne se demande d'où il sort. Un utilisateur
//  qui suit une cible calorique fausse ne le découvre qu'après des semaines sans résultat.
//
//  Trois règles tenues partout ici :
//   1. Une donnée manquante renvoie `null`, JAMAIS une valeur par défaut. Pas d'âge →
//      pas de métabolisme de base, et on le dit.
//   2. Toute hypothèse non mesurée est renvoyée dans `assumptions[]` pour être AFFICHÉE.
//      Le facteur d'activité quotidienne hors sport ne se mesure pas : il est supposé,
//      donc il s'annonce.
//   3. Ce qui est MESURÉ (la courbe de poids) prime sur ce qui est CALCULÉ (la dépense).
//      Quand les deux se contredisent, on montre l'écart au lieu de choisir.
// ─────────────────────────────────────────────────────────────────────────────

/** 1 kg de masse grasse ≈ 7 700 kcal (valeur classique, utilisée pour convertir un déficit en kg). */
export const KCAL_PER_KG_FAT = 7700;

export type BodyInputs = {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: string | null;
};

export type WeightLog = { date: string; weight_kg: number };

/** Séance telle que stockée en base — tous les champs sont optionnels côté import montre. */
export type EnergyWorkout = {
  date: string;
  sport?: string | null;
  type?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  elevation_gain_m?: number | null;
  avg_power_watts?: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

// Les phrases produites ici sont AFFICHÉES telles quelles. Sans mise en forme française,
// on lisait « -0.4 kg/semaine » et « 2770 kcal » au milieu d'un texte en français : le
// genre de détail qui fait passer un calcul soigné pour une sortie de débogage.
// `Intl` rend le signe négatif avec un trait d'union ASCII ; on le remplace par le vrai
// signe moins typographique, sinon « -0,4 » jure au milieu d'une phrase soignée.
const fr1 = (n: number) => r1(n).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace("-", "−");
const frInt = (n: number) => Math.round(n).toLocaleString("fr-FR");

// ── IMC ──────────────────────────────────────────────────────────────────────

/** IMC — `null` si taille ou poids manquent ou sont hors bornes physiologiques. */
export function bmiOf(weightKg: number | null, heightCm: number | null): number | null {
  const w = num(weightKg), h = num(heightCm);
  if (w == null || h == null) return null;
  if (w < 30 || w > 300 || h < 100 || h > 250) return null; // mêmes bornes que les contraintes SQL
  return r1(w / ((h / 100) ** 2));
}

export type BmiBand = "insuffisant" | "normal" | "surpoids" | "obesite_1" | "obesite_2" | "obesite_3";

export function bmiBand(bmi: number): BmiBand {
  if (bmi < 18.5) return "insuffisant";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "surpoids";
  if (bmi < 35) return "obesite_1";
  if (bmi < 40) return "obesite_2";
  return "obesite_3";
}

// ── Métabolisme de base (Mifflin-St Jeor) ────────────────────────────────────

/**
 * Métabolisme de base — équation de Mifflin-St Jeor, la plus fiable en population
 * générale (erreur type ~10 %, soit ±150 kcal ; c'est peu face aux ±400 kcal d'une
 * estimation « à la louche », mais ce n'est PAS une mesure : seule une calorimétrie
 * indirecte en est une).
 *
 * Renvoie `null` si une seule entrée manque. Tentation écartée : combler l'âge par une
 * valeur moyenne. Un âge supposé à 40 ans pour quelqu'un qui en a 62 décale la cible de
 * ~110 kcal/jour, soit près de 6 kg d'erreur cumulée sur un an — invisible à l'écran.
 */
export function bmrMifflin(b: BodyInputs): { kcal: number; assumptions: string[] } | null {
  const w = num(b.weightKg), h = num(b.heightCm), a = num(b.age);
  if (w == null || h == null || a == null) return null;
  if (w < 30 || w > 300 || h < 100 || h > 250 || a < 10 || a > 110) return null;

  const core = 10 * w + 6.25 * h - 5 * a;
  const assumptions: string[] = [];
  let offset: number;
  if (b.gender === "male") offset = 5;
  else if (b.gender === "female") offset = -161;
  else {
    // Sexe non renseigné : les deux équations diffèrent de 166 kcal. On prend le milieu
    // ET on l'annonce — masquer cet écart de ±83 kcal reviendrait à présenter comme
    // certain un chiffre qui ne l'est pas.
    offset = (5 + -161) / 2;
    assumptions.push("Sexe non précisé : moyenne des deux équations (±83 kcal). Renseigne-le dans ton profil pour affiner.");
  }
  return { kcal: r0(core + offset), assumptions };
}

// ── Dépense d'une séance ─────────────────────────────────────────────────────

/** Sports d'endurance sans impact reconnus par l'import montre. */
const BIKE = /bike|cycl|velo|vélo|ride|vtt|home ?trainer|spin/i;
const WALK = /walk|hike|marche|rando/i;
const SWIM = /swim|natation/i;
const STRENGTH = /strength|muscu|renfo|gainage|ppg|weight/i;

/**
 * Énergie dépensée sur UNE séance, en kcal — `null` quand on ne peut pas savoir.
 *
 * Sources par ordre de fiabilité décroissante :
 *   1. puissance mesurée (vélo) — physique pure, la meilleure ;
 *   2. distance × poids (course/marche) — le coût de la course est remarquablement
 *      stable, ~1 kcal par kg et par km, quasi indépendant de l'allure ;
 *   3. durée × MET — le repli le plus grossier, réservé aux sports sans distance.
 *
 * Le dénivelé est ajouté par la physique : monter 1 m coûte 9,81 J/kg, et le rendement
 * musculaire humain tourne autour de 25 % → ~0,0094 kcal/kg/m. Sans ce terme, une sortie
 * trail de 1 200 m D+ était comptée comme une sortie plate : ~1 100 kcal ignorées.
 */
export function workoutKcal(w: EnergyWorkout, weightKg: number | null): number | null {
  const kg = num(weightKg);
  if (kg == null || kg < 30 || kg > 300) return null;

  const km = num(w.distance_km) ?? 0;
  const sec = num(w.duration_seconds) ?? 0;
  const dplus = num(w.elevation_gain_m) ?? 0;
  const tag = `${w.sport ?? ""} ${w.type ?? ""}`;

  // Séance sans durée NI distance : rien de mesurable, on ne devine pas.
  if (sec <= 0 && km <= 0) return null;
  // Garde-fou anti-aberration (une séance de 18 h vient d'une montre restée en marche).
  const hours = Math.min(sec / 3600, 18);

  const climb = dplus > 0 ? 0.0094 * kg * dplus : 0;

  // 1) Vélo avec puissance : kJ ≈ kcal (le rendement de ~24 % annule le facteur 4,184).
  const watts = num(w.avg_power_watts);
  if (BIKE.test(tag) && watts != null && watts > 0 && sec > 0) return r0((watts * sec) / 1000);

  // 2) Course / marche : coût au km proportionnel au poids.
  if (km > 0 && !BIKE.test(tag) && !SWIM.test(tag)) {
    // ~1,0 kcal/kg/km en course ; la marche coûte environ moitié moins par km.
    const perKgKm = WALK.test(tag) ? 0.55 : 1.0;
    return r0(perKgKm * kg * km + climb);
  }

  // 3) Repli MET × poids × heures — le moins fiable, mais mieux que d'ignorer la séance.
  if (hours <= 0) return null;
  const met = BIKE.test(tag) ? 7.5 : SWIM.test(tag) ? 7 : STRENGTH.test(tag) ? 4 : WALK.test(tag) ? 4 : 8;
  return r0(met * kg * hours + climb);
}

export type TrainingEnergy = {
  /** Moyenne quotidienne sur la fenêtre, en kcal. */
  kcalPerDay: number;
  /** Nombre de séances effectivement chiffrées. */
  counted: number;
  /** Séances écartées faute de durée ET de distance — affiché, pas masqué. */
  skipped: number;
  windowDays: number;
};

/**
 * Dépense d'entraînement moyenne par jour, calculée sur les séances RÉELLES.
 *
 * C'est le seul terme de la dépense totale qui repose sur des données mesurées ; c'est
 * aussi celui qui distingue cette app d'un calculateur de calories générique. On lisse
 * sur 28 jours : sur 7 jours, une semaine de coupure ferait chuter la cible calorique
 * de 400 kcal du jour au lendemain.
 */
export function dailyTrainingKcal(workouts: EnergyWorkout[], weightKg: number | null, windowDays = 28, now = Date.now()): TrainingEnergy {
  let total = 0, counted = 0, skipped = 0;
  for (const w of workouts) {
    const t = new Date(w.date).getTime();
    if (!Number.isFinite(t)) { skipped++; continue; }
    const ageDays = (now - t) / 86400000;
    if (ageDays < 0 || ageDays > windowDays) continue;
    const kcal = workoutKcal(w, weightKg);
    if (kcal == null) { skipped++; continue; }
    total += kcal; counted++;
  }
  return { kcalPerDay: r0(total / windowDays), counted, skipped, windowDays };
}

// ── Tendance de poids ────────────────────────────────────────────────────────

export type WeightTrend = {
  /** Poids lissé actuel (moyenne des pesées des 7 derniers jours disponibles). */
  smoothedKg: number;
  /** Vitesse mesurée en kg/semaine (négatif = perte). */
  ratePerWeek: number;
  /** Étendue réelle des pesées utilisées, en jours. */
  spanDays: number;
  points: number;
};

/**
 * Tendance de poids par régression linéaire sur les pesées récentes.
 *
 * POURQUOI PAS LA DIFFÉRENCE ENTRE DEUX PESÉES : le poids d'un jour varie de ±1 à 2 kg
 * selon l'hydratation, le glycogène et le contenu digestif. Afficher « −1,3 kg depuis
 * hier » ou « +0,8 kg cette semaine » à partir de deux points, c'est afficher du bruit
 * et le faire passer pour un résultat — décourageant, et faux.
 *
 * Renvoie `null` tant qu'il n'y a pas assez de matière (≥ 4 pesées sur ≥ 14 jours).
 * L'appelant doit alors dire « pas encore assez de pesées », surtout pas « 0 kg/sem ».
 */
export function weightTrend(logs: WeightLog[], windowDays = 42, now = Date.now()): WeightTrend | null {
  const pts = logs
    .map((l) => ({ t: new Date(l.date).getTime(), kg: num(l.weight_kg) }))
    .filter((p): p is { t: number; kg: number } => Number.isFinite(p.t) && p.kg != null && p.kg >= 30 && p.kg <= 300)
    .filter((p) => (now - p.t) / 86400000 <= windowDays && p.t <= now + 86400000)
    .sort((a, b) => a.t - b.t);

  if (pts.length < 4) return null;
  const spanDays = (pts[pts.length - 1].t - pts[0].t) / 86400000;
  if (spanDays < 14) return null;
  // La dernière pesée doit être RÉCENTE. Sans cette condition, quelqu'un qui s'est pesé
  // assidûment puis a arrêté il y a cinq semaines voyait toujours « −0,5 kg/semaine » :
  // une tendance morte affichée au présent, et un poids courant périmé qui pilotait en
  // plus sa cible calorique. Vingt et un jours tolèrent des vacances, pas un abandon.
  if ((now - pts[pts.length - 1].t) / 86400000 > 21) return null;

  // Régression des moindres carrés : kg en fonction du temps (en jours).
  const n = pts.length;
  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / 86400000);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = pts.reduce((a, p) => a + p.kg, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (pts[i].kg - my); sxx += (xs[i] - mx) ** 2; }
  if (sxx === 0) return null;
  const slopePerDay = sxy / sxx;

  // Poids lissé : moyenne des pesées de la dernière semaine disponible.
  const lastT = pts[pts.length - 1].t;
  const recent = pts.filter((p) => (lastT - p.t) / 86400000 <= 7);
  const smoothedKg = recent.reduce((a, p) => a + p.kg, 0) / recent.length;

  return { smoothedKg: r1(smoothedKg), ratePerWeek: r1(slopePerDay * 7), spanDays: Math.round(spanDays), points: n };
}

// ── Éligibilité — le mode se refuse à certains profils ───────────────────────

export type EligibilityReason = "donnees_manquantes" | "imc_bas" | "mineur" | "grossesse";
export type Eligibility =
  | { ok: true }
  | { ok: false; reason: EligibilityReason; detail: string; params?: Record<string, string | number> };

/**
 * Le mode perte de poids n'est PAS proposé à tout le monde.
 *
 * Un outil qui calcule un déficit calorique est dangereux pour trois publics :
 * les personnes déjà minces (risque de conduite alimentaire à restriction), les mineurs
 * en croissance, et les femmes enceintes. Refuser explicitement, avec un message clair,
 * vaut infiniment mieux qu'un écran vide ou qu'une cible calculée quand même.
 */
export function weightModeEligibility(b: BodyInputs, healthConditions: unknown): Eligibility {
  const conds = new Set(Array.isArray(healthConditions) ? healthConditions.map(String) : []);
  if (conds.has("grossesse")) {
    return { ok: false, reason: "grossesse", detail: "Tu as déclaré une grossesse ou un post-partum. Aucune restriction calorique ne doit être entreprise sans l'avis de ton médecin ou de ta sage-femme : le mode reste désactivé." };
  }
  const age = num(b.age);
  if (age != null && age < 18) {
    return { ok: false, reason: "mineur", detail: "Le mode est réservé aux plus de 18 ans. Avant la fin de la croissance, toute restriction calorique relève d'un suivi médical, jamais d'une application." };
  }
  const bmi = bmiOf(b.weightKg, b.heightCm);
  if (bmi == null) {
    return { ok: false, reason: "donnees_manquantes", detail: "Il manque ta taille, ton poids ou ton âge. Sans eux, aucun calcul de dépense n'est possible — et on ne va pas les inventer. Complète ton profil." };
  }
  if (bmi < 20) {
    return { ok: false, reason: "imc_bas", params: { bmi }, detail: `Ton IMC est de ${fr1(bmi)}. En dessous de 20, perdre du poids dégrade la performance et la santé osseuse au lieu de les améliorer. Si tu veux changer ta composition corporelle, c'est le renforcement musculaire et l'apport en protéines qu'il faut travailler — pas les calories en moins.` };
  }
  return { ok: true };
}

// ── Plan complet ─────────────────────────────────────────────────────────────

export type WeightPlan = {
  bmi: number;
  band: BmiBand;
  /** Poids retenu pour les calculs : lissé si les pesées le permettent, sinon profil. */
  currentKg: number;
  currentSource: "pesees" | "profil";
  goalKg: number | null;
  toLoseKg: number | null;
  bmr: number;
  /** Dépense quotidienne totale estimée = base + vie courante (supposée) + sport (mesuré). */
  tdee: number;
  training: TrainingEnergy;
  /** Cible calorique quotidienne, déficit déjà plafonné. */
  targetKcal: number;
  deficitKcal: number;
  /** Vitesse de perte THÉORIQUE induite par ce déficit (pas une mesure). */
  plannedRatePerWeek: number;
  /** Vitesse RÉELLEMENT mesurée sur les pesées — `null` tant qu'il n'y en a pas assez. */
  measured: WeightTrend | null;
  proteinG: number;
  /** Semaines pour atteindre l'objectif — d'abord sur le mesuré, sinon sur le théorique. */
  weeksToGoal: number | null;
  weeksToGoalBasis: "mesure" | "theorique" | null;
  /** Plafonds déclenchés : ils expliquent pourquoi la cible n'est pas plus basse. */
  caps: string[];
  /** Hypothèses non mesurées, à AFFICHER telles quelles. */
  assumptions: string[];
  /**
   * MÊMES informations que `caps` / `assumptions`, mais en codes + paramètres.
   *
   * Les chaînes françaises ci-dessus partent dans le prompt du coach IA, qui raisonne en
   * français. L'INTERFACE, elle, est traduite en cinq langues : lui servir la même prose
   * afficherait du français à un utilisateur allemand au milieu d'un écran traduit. Les
   * deux formes sont produites au même endroit pour qu'elles ne puissent pas diverger.
   */
  capCodes: { code: string; params?: Record<string, string | number> }[];
  assumptionCodes: { code: string; params?: Record<string, string | number> }[];
};

/** Facteur d'activité hors sport. Supposé, jamais mesuré → toujours annoncé. */
const NEAT_FACTOR = 1.3;

/**
 * Assemble le plan. `null` si le métabolisme de base n'est pas calculable : sans lui,
 * tout le reste serait de l'invention.
 */
export function buildWeightPlan(args: {
  body: BodyInputs;
  goalKg: number | null;
  logs: WeightLog[];
  workouts: EnergyWorkout[];
  now?: number;
}): WeightPlan | null {
  const now = args.now ?? Date.now();
  const trend = weightTrend(args.logs, 42, now);

  // Le poids lissé des pesées est plus juste que la valeur du profil, souvent saisie
  // une fois à l'inscription puis jamais mise à jour.
  const currentKg = trend?.smoothedKg ?? num(args.body.weightKg);
  if (currentKg == null) return null;
  const currentSource: "pesees" | "profil" = trend ? "pesees" : "profil";

  const body = { ...args.body, weightKg: currentKg };
  const bmi = bmiOf(currentKg, args.body.heightCm);
  const base = bmrMifflin(body);
  if (bmi == null || base == null) return null;

  const training = dailyTrainingKcal(args.workouts, currentKg, 28, now);
  const tdee = r0(base.kcal * NEAT_FACTOR + training.kcalPerDay);

  const assumptions = [...base.assumptions];
  const assumptionCodes: { code: string; params?: Record<string, string | number> }[] = [];
  if (base.assumptions.length) assumptionCodes.push({ code: "sexe_non_precise" });
  assumptions.push(`Vie courante hors sport estimée à ×${fr1(NEAT_FACTOR)} du métabolisme de base : c'est une hypothèse de population, elle n'est pas mesurable par l'app. Un métier debout ou 12 000 pas quotidiens la sous-estiment.`);
  assumptionCodes.push({ code: "neat", params: { factor: NEAT_FACTOR } });
  if (training.counted === 0) {
    assumptions.push("Aucune séance chiffrable sur les 28 derniers jours : la dépense sportive comptée est nulle. Elle remontera d'elle-même dès que tes séances se synchroniseront.");
    assumptionCodes.push({ code: "aucune_seance" });
  } else {
    assumptions.push(`Dépense sportive calculée sur ${training.counted} séance(s) réelle(s) des 28 derniers jours${training.skipped ? `, ${training.skipped} écartée(s) faute de durée ou de distance` : ""}.`);
    assumptionCodes.push({ code: training.skipped ? "seances_avec_ecart" : "seances", params: { n: training.counted, skipped: training.skipped } });
  }

  // ── Déficit : trois plafonds, chacun pour une raison précise ───────────────
  const caps: string[] = [];
  const capCodes: { code: string; params?: Record<string, string | number> }[] = [];
  // 1. Vitesse : au-delà de ~0,75 %/semaine du poids, la perte se fait massivement sur
  //    le muscle, et chez un coureur ça se paie en blessures et en performance.
  const maxRate = currentKg * 0.0075;
  let deficit = (maxRate * KCAL_PER_KG_FAT) / 7;

  /**
   * PLANCHER DE TRAJECTOIRE — le mode doit savoir s'ARRÊTER.
   *
   * DÉFAUT RÉEL. Le refus d'activation se joue à IMC 20, mais une fois le mode actif plus
   * rien ne bornait la descente : sans poids cible, un déficit était prescrit
   * indéfiniment. Constaté en production sur un coureur de 20 ans, 70 kg pour 1,85 m
   * (IMC 20,5) : mode actif, 440 kcal/jour de déficit, −0,4 kg/semaine — soit un passage
   * sous IMC 19 en sept semaines, très en dessous du seuil qui aurait refusé l'activation.
   * Le garde-fou d'entrée ne servait à rien une fois la porte franchie.
   *
   * Entre 20 et 21, il n'y a rien à perdre sainement pour un coureur : le mode reste
   * consultable (dépense, protéines) mais passe en MAINTIEN, déficit nul.
   */
  if (bmi < 21) {
    deficit = 0;
    caps.push(`IMC de ${fr1(bmi)} : aucun déficit prescrit. À ce niveau il n'y a plus de masse grasse à perdre sans entamer le muscle et l'os — le mode passe en maintien. Pour changer ta composition corporelle, ce sont le renforcement et les protéines qui agissent, pas les calories en moins.`);
    capCodes.push({ code: "maintien_imc_bas", params: { bmi } });
  }
  // Sur un IMC déjà proche de la normale, on ralentit : les derniers kilos se perdent
  // lentement, et un déficit agressif à IMC 26 n'apporte rien.
  else if (bmi < 27) { deficit = Math.min(deficit, (0.4 * KCAL_PER_KG_FAT) / 7); caps.push("IMC proche de la normale : perte volontairement limitée à ~0,4 kg/semaine."); capCodes.push({ code: "imc_proche_normale" }); }

  // 2. Proportion : jamais plus de 25 % de la dépense totale.
  if (deficit > tdee * 0.25) { deficit = tdee * 0.25; caps.push("Déficit plafonné à 25 % de ta dépense totale."); capCodes.push({ code: "pct_tdee" }); }

  // 3. Plancher absolu : ne jamais manger sous son métabolisme de base. En dessous, le
  //    corps rogne sur la masse maigre et la récupération s'effondre — un coureur en
  //    déficit sévère se blesse au lieu de progresser (faible disponibilité énergétique).
  if (tdee - deficit < base.kcal) { deficit = Math.max(0, tdee - base.kcal); caps.push("Cible relevée : on ne descend jamais sous le métabolisme de base."); capCodes.push({ code: "plancher_mb" }); }
  const floor = args.body.gender === "female" ? 1200 : 1500;
  if (tdee - deficit < floor) { deficit = Math.max(0, tdee - floor); caps.push(`Cible relevée au plancher de sécurité de ${floor} kcal.`); capCodes.push({ code: "plancher_absolu", params: { floor } }); }

  const targetKcal = r0(tdee - deficit);
  const deficitKcal = r0(deficit);
  // `-(0 * 7) / 7700` vaut −0 en JavaScript, ce qui s'affiche « −0,0 kg/semaine » :
  // un signe négatif sur une absence de perte. Le cas nul est traité à part.
  const plannedRatePerWeek = deficitKcal === 0 ? 0 : r1(-(deficitKcal * 7) / KCAL_PER_KG_FAT);

  // ── Protéines ─────────────────────────────────────────────────────────────
  // En déficit calorique, l'apport protéique est le principal levier CONTRE la fonte
  // musculaire. On le calcule sur le poids CIBLE (ou un poids de référence à IMC 24) :
  // rapporté au poids actuel d'une personne en obésité, 1,6 g/kg donnerait un chiffre
  // irréaliste — la masse grasse n'a pas besoin d'être nourrie en protéines.
  const heightM = (num(args.body.heightCm) ?? 0) / 100;
  const refKg = args.goalKg ?? (heightM > 0 ? Math.min(currentKg, 24 * heightM ** 2) : currentKg);
  const proteinG = r0(1.6 * refKg);

  // ── Projection ────────────────────────────────────────────────────────────
  const goalKg = num(args.goalKg);
  const toLoseKg = goalKg != null ? r1(currentKg - goalKg) : null;
  let weeksToGoal: number | null = null;
  let weeksToGoalBasis: "mesure" | "theorique" | null = null;
  if (toLoseKg != null && toLoseKg > 0) {
    // On projette d'abord sur ce qui est MESURÉ. La projection théorique suppose que la
    // cible calorique est tenue tous les jours — ce que l'app ne sait pas.
    if (trend && trend.ratePerWeek < -0.05) { weeksToGoal = Math.ceil(toLoseKg / -trend.ratePerWeek); weeksToGoalBasis = "mesure"; }
    else if (plannedRatePerWeek < 0) { weeksToGoal = Math.ceil(toLoseKg / -plannedRatePerWeek); weeksToGoalBasis = "theorique"; }
  }

  return {
    bmi, band: bmiBand(bmi), currentKg: r1(currentKg), currentSource, goalKg, toLoseKg,
    bmr: base.kcal, tdee, training, targetKcal, deficitKcal, plannedRatePerWeek,
    measured: trend, proteinG, weeksToGoal, weeksToGoalBasis, caps, assumptions,
    capCodes, assumptionCodes,
  };
}

/**
 * Confronte la perte PRÉVUE à la perte MESURÉE.
 *
 * C'est le cœur honnête du mode. L'app ne sait pas ce que la personne mange : elle ne
 * peut donc PAS dire « tu manges trop ». Elle peut dire « ça ne descend pas au rythme
 * calculé » et énumérer les deux causes possibles sans trancher. Prétendre trancher
 * serait exactement le genre d'invention que ce projet refuse.
 */
export function trendVerdict(plan: WeightPlan): {
  status: "insuffisant" | "conforme" | "plus_lent" | "plus_rapide" | "hausse";
  message: string;
  /** Chiffres bruts du verdict → permet à l'interface de le rendre dans SA langue.
   *  `status` sert de clé de traduction ; la prose française reste pour le prompt IA. */
  params: Record<string, string | number>;
} {
  const m = plan.measured;
  if (!m) {
    return { status: "insuffisant", params: {}, message: "Pas encore assez de pesées pour parler de tendance (il en faut au moins 4 réparties sur 2 semaines). Tant qu'on n'en a pas, aucun chiffre de progression ne serait honnête — un écart entre deux pesées, c'est de l'eau, pas de la graisse." };
  }
  const planned = plan.plannedRatePerWeek; // négatif
  const actual = m.ratePerWeek;
  const params = { actual, planned, spanDays: m.spanDays, points: m.points, tdee: plan.tdee };
  if (actual > 0.1) {
    return { status: "hausse", params, message: `Sur ${m.spanDays} jours (${m.points} pesées), la tendance est à +${fr1(actual)} kg/semaine. Deux explications possibles, et l'app ne peut pas départager : l'apport réel dépasse la cible, ou l'estimation de dépense (${frInt(plan.tdee)} kcal) est trop haute pour toi. Garde la cible 2 semaines de plus en pesant régulièrement : c'est la courbe qui tranchera.` };
  }
  const ratio = planned < 0 ? actual / planned : 0;
  if (ratio >= 0.8 && ratio <= 1.3) {
    return { status: "conforme", params, message: `Mesuré : ${fr1(actual)} kg/semaine sur ${m.spanDays} jours, pour ${fr1(planned)} prévu. L'estimation de dépense est juste pour toi — on ne touche à rien.` };
  }
  if (ratio > 1.3) {
    return { status: "plus_rapide", params, message: `Mesuré : ${fr1(actual)} kg/semaine, soit plus vite que les ${fr1(planned)} prévus. Trop rapide n'est pas mieux : au-delà de ~0,75 %/semaine, la perte se fait sur le muscle et la récupération s'effondre. Remonte l'apport de 150 à 200 kcal/jour.` };
  }
  return { status: "plus_lent", params, message: `Mesuré : ${fr1(actual)} kg/semaine sur ${m.spanDays} jours, contre ${fr1(planned)} prévu. L'app ne sait pas ce que tu manges : soit l'apport dépasse la cible, soit ta dépense réelle est plus basse que les ${frInt(plan.tdee)} kcal estimés. Avant de baisser encore les calories, vérifie le plus probable des deux — l'estimation d'apport se trompe bien plus souvent que le métabolisme.` };
}
