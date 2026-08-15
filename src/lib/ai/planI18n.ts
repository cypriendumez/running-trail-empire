// ─────────────────────────────────────────────────────────────────────────────
//  LES TEXTES DU PLAN — les 5 langues.
//
//  `autoPlan` écrivait chaque titre, chaque corps de séance et chaque « pourquoi »
//  en français, en dur. Un athlète allemand recevait une interface allemande… et un
//  plan d'entraînement français, c'est-à-dire la seule chose qu'il vient lire.
//
//  ⚠️ CE QUI EST CANONIQUE ET CE QUI NE L'EST PAS — la distinction qui tient tout.
//
//  `lib/watch/intervals.ts` fabrique la séance Garmin en ANALYSANT LA PROSE : il y
//  cherche « corps : » pour délimiter le corps de séance, « récup » pour la durée de
//  récupération, « seuil »/« vma »/« côte » pour la zone d'allure, « repos » pour ne
//  rien pousser, et le motif « N×DISTANCE à ALLURE ». Traduire ce texte-là casserait
//  la poussée montre EN SILENCE — `buildWorkoutDescription` renverrait null ou des
//  étapes fausses, sans la moindre erreur.
//
//  Le français produit par CE fichier reste donc la version canonique : c'est elle
//  qu'`autoPlan` met dans `detail`/`title`/`tags`, elle qui part sur la montre, elle
//  qui sert aux analyses. Les quatre autres langues sont matérialisées à côté, dans
//  `PlanDay.i18n`, et ne servent QU'À L'AFFICHAGE.
//
//  Corollaire : le français ne peut pas dériver des autres langues, puisque les cinq
//  sortent du même gabarit appelé avec les mêmes nombres.
//
//  ⚠️ VOCABULAIRE IMPOSÉ. `CalendarView.extractBody()` isole l'échauffement et le
//  retour au calme par expression régulière, dans les 5 langues :
//      échauffement → /échauff|warm[- ]?up|aufwärm|calent|aquec/
//      retour au calme → /retour au calme|cool[- ]?down|auslauf|vuelta a la calma|retorno/
//      libellé du corps → /corps|main set|hauptteil|parte principal/
//  Les traductions ci-dessous emploient EXACTEMENT ces mots : en changer un ferait
//  réapparaître l'échauffement au milieu du corps de séance affiché.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesPlan = {
  // ── Fragments réutilisés ────────────────────────────────────────────────────
  /** « ~12 km (environ 1h02) » — la durée est absente quand l'allure est inconnue. */
  kmEtTemps: (km: string, duree: string | null) => string;
  /** Terrain vallonné : l'allure s'entend en allure ajustée au dénivelé. */
  noteGAP: string;
  noteAffutage: string;
  noteAllegee: string;
  /** « (dont 34 % venant d'un autre sport : 3 × vélo…) » */
  noteCross: (pct: number, label: string) => string;
  /** Repli quand aucun motif de fatigue précis n'est disponible. */
  motifDefaut: string;

  // ── Jour de course ──────────────────────────────────────────────────────────
  courseTitre: (course: string | null) => string;
  courseDetail: (allure: string | null) => string;
  courseWhy: (chrono: string | null) => string;
  veilleTitre: string;
  veilleDetail: string;
  veilleWhy: string;
  avantVeilleTitre: string;
  avantVeilleDetail: string;
  avantVeilleWhy: string;
  reposCourseTitre: string;
  reposCourseDetail: string;
  reposCourseWhy: string;
  recupCourseTitre: string;
  recupCourseDetail: string;
  recupCourseWhy: string;

  // ── Repos ───────────────────────────────────────────────────────────────────
  reposTitre: string;
  reposJourRateDetail: string;
  reposJourRateWhy: string;
  reposIndispoDetail: string;
  reposIndispoWhy: string;
  reposCompletTitre: string;
  reposCompletDetail: string;
  reposCompletWhy: string;
  reposFinalDetail: string;
  reposFinalWhy: string;

  // ── Sortie longue ───────────────────────────────────────────────────────────
  veloLongTitre: string;
  veloLongDetail: (echauff: number, duree: string, notes: string) => string;
  veloLongWhy: string;
  longSpecTitre: string;
  longSpecDetail: (echauff: number, corps: string, allureFacile: string, specKm: string, allure: string, calme: number, notes: string) => string;
  longSpecWhy: string;
  longProgTitre: string;
  longProgDetail: (echauff: number, corps: string, allureFacile: string, tiers: string, plusVite: string | null, calme: number, notes: string) => string;
  longProgWhy: string;
  longTitre: string;
  longDetail: (echauff: number, corps: string, allureFacile: string, calme: number, notes: string) => string;
  longWhyRaccourcie: (km: string, prevu: string, motif: string) => string;
  longWhy: (km: string) => string;

  // ── Qualité ─────────────────────────────────────────────────────────────────
  qualiteTitreVMA: string;
  qualiteTitreSeuil: string;
  qualiteTitreSpecifique: string;
  /** Suffixe « (allégée) » — appliqué au titre, jamais deux fois. */
  suffixeAllegee: string;
  qualiteDetail: (echauff: number, corps: string, calme: number, affutage: boolean, allegee: boolean) => string;
  qualiteWhySauvee: (origineCross: string) => string;
  qualiteWhy: string;

  // ── Endurance ───────────────────────────────────────────────────────────────
  enduranceTitre: string;
  enduranceDetail: (echauff: number, corps: string, allure: string, calme: number, gap: string, scinder: boolean, cycle: string) => string;
  enduranceWhyTropIntense: (pct: string) => string;
  enduranceWhy: (cible: string) => string;

  // ── Renforcement ────────────────────────────────────────────────────────────
  renfoTitre: string;
  renfoAffutage: string;
  renfoBase: (series: number) => string;
  renfoSpecifique: (series: number) => string;
  renfoDeveloppement: (series: number, enPlus: boolean) => string;
  renfoWhy: string;

  // ── Verdict de fraîcheur du jour ────────────────────────────────────────────
  recupTitre: string;
  recupDetail: (echauff: number, calme: number) => string;
  recupWhyDejaDur: string;
  recupWhyRouge: (motifs: string) => string;
  allegeeDetailSuffixe: string;
  allegeeWhy: (motifs: string) => string;

  // ── Doubles séances ─────────────────────────────────────────────────────────
  suffixeSoir: string;
  whySoir: string;
  matinTitre: string;
  matinWhy: string;

  // ── Étiquettes (les puces affichées sous chaque séance) ─────────────────────
  tags: Record<
    "Course" | "Objectif" | "Récup" | "Veille de course" | "Affûtage" | "Repos" | "Z1" | "Z2"
    | "Vélo" | "Long" | "Spécifique" | "Progressif" | "Qualité" | "Allégée" | "Endurance"
    | "Renfo" | "Prévention" | "VMA" | "Seuil" | "Soir" | "Matin", string>;
  /** « 21 km » — l'unité suit la langue, le nombre reste celui du plan. */
  tagKm: (km: string) => string;
};

export const PLAN_T: Record<Lang, TextesPlan> = {
  fr: {
    kmEtTemps: (km, d) => (d ? `~${km} km (environ ${d})` : `~${km} km`),
    noteGAP: " ⛰️ Sur terrain vallonné, cette allure s'entend en GAP (allure ajustée au dénivelé) : en montée tu seras plus lent au chrono pour le même effort — fie-toi à la FC et au ressenti, pas au cadran.",
    noteAffutage: " ⚠️ Semaine d'AFFÛTAGE : on réduit le volume, pas l'intensité.",
    noteAllegee: " ⚠️ Semaine ALLÉGÉE : c'est maintenant que le corps assimile le travail des 3 semaines précédentes.",
    noteCross: (p, l) => ` (dont ${p} % venant d'un autre sport : ${l})`,
    motifDefaut: "signaux de fatigue",

    courseTitre: (c) => (c ? `🏁 ${c}` : "🏁 Jour de course"),
    courseDetail: (a) => `Échauffement 15 à 20 min progressif + 3 à 4 lignes droites, terminé 10 min avant le départ.${a ? ` Pars à ${a}/km — surtout PAS plus vite sur les 2 premiers kilomètres, c'est l'erreur qui coûte le plus cher.` : ""} Retour au calme 10 min en trottinant.`,
    courseWhy: (t) => (t ? `C'est le jour. Tout le bloc a été construit pour ce chrono de ${t}. Fais confiance à ta préparation et tiens ton allure.` : "C'est le jour. Fais confiance à ta préparation."),
    veilleTitre: "Déblocage — veille de course",
    veilleDetail: "20 min de footing très facile FC Z1 + 3 lignes droites de 80 m à l'allure de course. Rien de plus : on réveille les jambes, on ne les fatigue pas.",
    veilleWhy: "La forme se construit avant, pas la veille. Une séance de plus ne t'apportera rien et peut te coûter la course.",
    avantVeilleTitre: "Avant-veille de course",
    avantVeilleDetail: "30 min de footing facile FC Z1-Z2, éventuellement 4×30 s à l'allure de course pour rester tonique.",
    avantVeilleWhy: "On garde le contact avec l'allure sans entamer la fraîcheur.",
    reposCourseTitre: "Repos post-course",
    reposCourseDetail: "Repos complet. Marche, étirements doux, hydratation et alimentation soignées.",
    reposCourseWhy: "Une course, c'est un effort maximal : le corps a besoin de plusieurs jours pour réparer.",
    recupCourseTitre: "Récupération post-course",
    recupCourseDetail: "20 à 30 min de footing très facile FC Z1, ou repos si les jambes sont encore lourdes.",
    recupCourseWhy: "Reprise en douceur : compte environ un jour de récupération par tranche de 3 km courus en course.",

    reposTitre: "Repos",
    reposJourRateDetail: "Repos. Ce jour de la semaine ne te convient visiblement pas pour courir — on ne s'obstine pas, le volume est reporté ailleurs.",
    reposJourRateWhy: "Tu n'as pas couru ce jour-là les dernières fois qu'il était prévu. Un plan qu'on ne suit pas ne sert à rien : on l'adapte à ta vraie vie.",
    reposIndispoDetail: "Repos — tu as indiqué ne pas pouvoir t'entraîner ce jour-là.",
    reposIndispoWhy: "Ton plan est calé sur tes vraies disponibilités : c'est ce qui le rend tenable dans la durée.",
    reposCompletTitre: "Repos complet",
    reposCompletDetail: "Repos complet. Marche, étirements doux ou mobilité si tu en ressens le besoin, rien de plus.",
    reposCompletWhy: "C'est pendant le repos que l'adaptation se fait, pas pendant l'effort.",
    reposFinalDetail: "Repos. C'est le moment où le corps transforme le travail en progrès.",
    reposFinalWhy: "Ton plan tient compte du nombre de séances que tu peux réellement assurer.",

    veloLongTitre: "Sortie longue à vélo",
    veloLongDetail: (e, d, n) => `Échauffement ${e} min très facile → ${d} à 2h en FC Z2, allure conversationnelle, cadence souple → 10 min de retour au calme. Pas d'allure cible : c'est du volume aérobie sans impact.${n}`,
    veloLongWhy: "Le volume aérobie de la semaine, sans les contraintes d'impact de la course.",
    longSpecTitre: "Sortie longue avec bloc spécifique",
    longSpecDetail: (e, c, a, s, p, k, n) => `Échauffement ${e} min progressif FC Z1→Z2 → Corps : ${c} en Z2${a}, puis ${s} km à ${p}/km SUR JAMBES FATIGUÉES → Retour au calme ${k} min FC Z1.${n}`,
    longSpecWhy: "Le bloc à allure course arrive en FIN de sortie, quand les jambes sont déjà lourdes — c'est exactement l'état dans lequel tu seras au dernier tiers de ta course. Aucune séance ne prépare mieux le jour J.",
    longProgTitre: "Sortie longue progressive",
    longProgDetail: (e, c, a, t, f, k, n) => `Échauffement ${e} min progressif FC Z1→Z2 → Corps : ${c} en Z2${a}, dont les ${t} DERNIERS kilomètres accélérés${f ? ` à ~${f}/km` : " d'un cran"} → Retour au calme ${k} min FC Z1.${n}`,
    longProgWhy: "Finir plus vite qu'on a commencé : ça t'apprend à terminer fort au lieu de subir, et ça fabrique la confiance qui décide d'une fin de course. La progression doit rester CONFORTABLE — si tu forces, c'est raté.",
    longTitre: "Sortie longue",
    longDetail: (e, c, a, k, n) => `Échauffement ${e} min progressif FC Z1→Z2 → Corps : ${c} en Z2${a}, allure conversationnelle du début à la fin → Retour au calme ${k} min FC Z1.${n}`,
    longWhyRaccourcie: (km, prev, m) => `Sortie longue RACCOURCIE à ${km} km (${prev} km prévus) : ${m}. Ce n'est pas un recul — c'est ce qui permet d'enchaîner la suite du bloc. On remonte dès que la charge redescend.`,
    longWhy: (km) => `C'est la séance qui construit ton endurance de fond — ${km} km, calés sur ton volume actuel. Elle doit rester facile : si tu finis cassé, elle était trop rapide.`,

    qualiteTitreVMA: "Séance VMA",
    qualiteTitreSeuil: "Séance au seuil",
    qualiteTitreSpecifique: "Allure spécifique objectif",
    suffixeAllegee: " (allégée)",
    qualiteDetail: (e, c, k, taper, all) => `Échauffement ${e} min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : ${c} → Retour au calme ${k} min FC Z1.${taper ? " ⚠️ Affûtage : garde l'intensité mais coupe le nombre de répétitions d'un tiers." : ""}${all ? " ⚠️ Version allégée : coupe le nombre de répétitions d'un tiers et garde l'allure. On préserve le stimulus, pas le volume." : ""}`,
    qualiteWhySauvee: (o) => `Ta charge récente est très au-dessus de ta charge de fond${o} — mais ton échéance approche et une semaine sans la moindre allure spécifique se paie le jour J. Donc : UNE séance, raccourcie, plutôt que zéro. Si les sensations ne viennent pas à l'échauffement, transforme-la en footing sans culpabiliser.`,
    qualiteWhy: "La séance de qualité de ton bloc, calée sur ta VMA et ton objectif. C'est elle qui te fait progresser.",

    enduranceTitre: "Footing en endurance",
    enduranceDetail: (e, c, a, k, g, s, cy) => `Échauffement ${e} min progressif FC Z1→Z2 → Corps : ${c} en Z2${a}, tu dois pouvoir tenir une conversation → Retour au calme ${k} min FC Z1.${g}${s ? " 💡 À ton volume, scinde en DEUX sorties dans la journée (matin + soir) plutôt qu'un seul footing interminable." : ""}${cy}`,
    enduranceWhyTropIntense: (p) => `⚠️ Tu passes ${p} % de ton temps de course en zone 3 et plus, alors que la cible est 20 %. Tes footings sont courus trop vite — c'est le frein n°1 à la progression. Ralentis jusqu'à pouvoir tenir une conversation complète : c'est censé paraître TROP facile.`,
    enduranceWhy: (c) => `Le socle aérobie. Avec les autres séances, tu es sur ~${c} km cette semaine — c'est le volume facile qui construit la forme de fond, pas les séances dures.`,

    renfoTitre: "Renforcement musculaire",
    renfoAffutage: `20 à 25 min, ENTRETIEN seulement : gainage 3×45 s, montées de mollets 2×15, proprioception 2×30 s par jambe, quelques bondissements courts. AUCUNE charge lourde ni série longue à l'approche de la course — on préserve la fraîcheur, la force est déjà acquise.`,
    renfoBase: (s) => `35 à 45 min, FONDATIONS : gainage complet (planche, latéral, dos) ${s}×45 s, squats ${s}×12, fentes ${s}×10 par jambe, montées de mollets ${s}×15, ischios nordic curls ${s}×6, proprioception sur une jambe ${s}×30 s. Amplitude et contrôle avant tout — c'est la phase où l'on construit le tendon.`,
    renfoSpecifique: (s) => `30 à 35 min, FORCE UTILE À LA COURSE : squats bulgares ${s}×8 par jambe, fentes sautées ${s}×8, montées de mollets sur une jambe ${s}×12, nordic curls ${s}×6, gainage dynamique ${s}×40 s, bondissements ${s}×10. Explosif et court : on transfère la force vers la foulée, on ne cherche plus le volume.`,
    renfoDeveloppement: (s, plus) => `30 à 40 min, DÉVELOPPEMENT : gainage (planche, latéral) ${s}×45 s, squats ${s}×12, fentes ${s}×10 par jambe, montées de mollets ${s}×15, ischios nordic curls ${s}×6, proprioception sur une jambe ${s}×30 s. ${plus ? "Série supplémentaire par rapport à la semaine dernière — la surcharge vaut aussi pour le renfo." : "Charge maintenue cette semaine (assimilation)."}`,
    renfoWhy: "La prévention de blessure n°1, et un gain direct d'économie de foulée. Elle se périodise comme la course : fondations, puis force utile, puis simple entretien à l'approche du jour J.",

    recupTitre: "Récupération",
    recupDetail: (e, k) => `Échauffement ${e} min très doux FC Z1 → Corps : 25 min en Z1 très facile, piloté à la FRÉQUENCE CARDIAQUE (aucune allure à tenir) → Retour au calme ${k} min FC Z1. Ou repos complet si tu le sens mieux.`,
    recupWhyDejaDur: "Tu as déjà fait une séance exigeante aujourd'hui : on ne double pas. La progression se joue à la récupération.",
    recupWhyRouge: (m) => `Aujourd'hui ton corps demande de la récupération : ${m}. Reporter une séance dure de 24 h ne coûte rien ; la forcer coûte des semaines.`,
    allegeeDetailSuffixe: "\n\n⚠️ Version ALLÉGÉE aujourd'hui : réduis le corps de séance d'environ un tiers.",
    allegeeWhy: (m) => `Séance maintenue mais raccourcie : ${m}.`,

    suffixeSoir: " (soir)",
    whySoir: " Journée doublée : la sortie principale reste le soir.",
    matinTitre: "Footing du matin",
    matinWhy: "Deuxième sortie de la journée : le même volume qu'en une fois, mieux absorbé. C'est du volume gratuit sur le plan de la fatigue, à condition de le courir vraiment lentement.",

    tags: {
      "Course": "Course", "Objectif": "Objectif", "Récup": "Récup", "Veille de course": "Veille de course",
      "Affûtage": "Affûtage", "Repos": "Repos", "Z1": "Z1", "Z2": "Z2", "Vélo": "Vélo", "Long": "Long",
      "Spécifique": "Spécifique", "Progressif": "Progressif", "Qualité": "Qualité", "Allégée": "Allégée",
      "Endurance": "Endurance", "Renfo": "Renfo", "Prévention": "Prévention", "VMA": "VMA", "Seuil": "Seuil",
      "Soir": "Soir", "Matin": "Matin",
    },
    tagKm: (km) => `${km} km`,
  },

  en: {
    kmEtTemps: (km, d) => (d ? `~${km} km (about ${d})` : `~${km} km`),
    noteGAP: " ⛰️ On hilly terrain this pace means GAP (grade-adjusted pace): uphill you will be slower on the clock for the same effort — trust heart rate and feel, not the display.",
    noteAffutage: " ⚠️ TAPER week: we cut the volume, not the intensity.",
    noteAllegee: " ⚠️ EASED week: this is when the body absorbs the work of the previous 3 weeks.",
    noteCross: (p, l) => ` (${p} % of it coming from another sport: ${l})`,
    motifDefaut: "signs of fatigue",

    courseTitre: (c) => (c ? `🏁 ${c}` : "🏁 Race day"),
    courseDetail: (a) => `Warm-up 15 to 20 min building + 3 to 4 strides, finished 10 min before the gun.${a ? ` Go out at ${a}/km — definitely NOT faster over the first 2 kilometres, that is the mistake that costs the most.` : ""} Cool-down 10 min of easy jogging.`,
    courseWhy: (t) => (t ? `This is the day. The whole block was built for that ${t}. Trust your preparation and hold your pace.` : "This is the day. Trust your preparation."),
    veilleTitre: "Shakeout — day before the race",
    veilleDetail: "20 min of very easy running at HR Z1 + 3 strides of 80 m at race pace. Nothing more: we wake the legs up, we do not tire them.",
    veilleWhy: "Fitness is built beforehand, not the day before. One more session will bring you nothing and can cost you the race.",
    avantVeilleTitre: "Two days before the race",
    avantVeilleDetail: "30 min of easy running at HR Z1-Z2, optionally 4×30 s at race pace to stay sharp.",
    avantVeilleWhy: "We keep in touch with the pace without eating into your freshness.",
    reposCourseTitre: "Rest after the race",
    reposCourseDetail: "Complete rest. Walking, gentle stretching, careful hydration and nutrition.",
    reposCourseWhy: "A race is a maximal effort: the body needs several days to repair.",
    recupCourseTitre: "Recovery after the race",
    recupCourseDetail: "20 to 30 min of very easy running at HR Z1, or rest if the legs are still heavy.",
    recupCourseWhy: "Gentle return: count roughly one recovery day per 3 km raced.",

    reposTitre: "Rest",
    reposJourRateDetail: "Rest. This day of the week clearly does not suit you for running — no point insisting, the volume is moved elsewhere.",
    reposJourRateWhy: "You did not run on that day the last times it was planned. A plan you do not follow is worth nothing: we fit it to your real life.",
    reposIndispoDetail: "Rest — you said you cannot train on that day.",
    reposIndispoWhy: "Your plan is built on your real availability: that is what makes it sustainable.",
    reposCompletTitre: "Complete rest",
    reposCompletDetail: "Complete rest. Walking, gentle stretching or mobility if you feel the need, nothing more.",
    reposCompletWhy: "Adaptation happens during rest, not during the effort.",
    reposFinalDetail: "Rest. This is when the body turns the work into progress.",
    reposFinalWhy: "Your plan takes into account the number of sessions you can genuinely commit to.",

    veloLongTitre: "Long ride",
    veloLongDetail: (e, d, n) => `Warm-up ${e} min very easy → ${d} to 2h at HR Z2, conversational, smooth cadence → 10 min of cool-down. No target pace: this is aerobic volume without impact.${n}`,
    veloLongWhy: "The aerobic volume of the week, without the impact load of running.",
    longSpecTitre: "Long run with a race-pace block",
    longSpecDetail: (e, c, a, s, p, k, n) => `Warm-up ${e} min building HR Z1→Z2 → Main set: ${c} at Z2${a}, then ${s} km at ${p}/km ON TIRED LEGS → Cool-down ${k} min HR Z1.${n}`,
    longSpecWhy: "The race-pace block comes at the END of the run, when the legs are already heavy — exactly the state you will be in over the last third of your race. No session prepares race day better.",
    longProgTitre: "Progressive long run",
    longProgDetail: (e, c, a, t, f, k, n) => `Warm-up ${e} min building HR Z1→Z2 → Main set: ${c} at Z2${a}, with the LAST ${t} kilometres accelerated${f ? ` to ~${f}/km` : " by one notch"} → Cool-down ${k} min HR Z1.${n}`,
    longProgWhy: "Finishing faster than you started teaches you to close strong instead of enduring, and it builds the confidence that decides the end of a race. The progression must stay COMFORTABLE — if you force it, it is wasted.",
    longTitre: "Long run",
    longDetail: (e, c, a, k, n) => `Warm-up ${e} min building HR Z1→Z2 → Main set: ${c} at Z2${a}, conversational from start to finish → Cool-down ${k} min HR Z1.${n}`,
    longWhyRaccourcie: (km, prev, m) => `Long run SHORTENED to ${km} km (${prev} km planned): ${m}. This is not a step back — it is what lets you string the rest of the block together. We go back up as soon as the load comes down.`,
    longWhy: (km) => `This is the session that builds your aerobic base — ${km} km, sized on your current volume. It has to stay easy: if you finish wrecked, it was too fast.`,

    qualiteTitreVMA: "VO2max session",
    qualiteTitreSeuil: "Threshold session",
    qualiteTitreSpecifique: "Goal race pace",
    suffixeAllegee: " (eased)",
    qualiteDetail: (e, c, k, taper, all) => `Warm-up ${e} min building HR Z1→Z2 + 3 to 5 strides of 80 m → Main set: ${c} → Cool-down ${k} min HR Z1.${taper ? " ⚠️ Taper: keep the intensity but cut the number of reps by a third." : ""}${all ? " ⚠️ Eased version: cut the number of reps by a third and keep the pace. We preserve the stimulus, not the volume." : ""}`,
    qualiteWhySauvee: (o) => `Your recent load is well above your chronic load${o} — but your race is coming and a week without any race-specific pace is paid for on the day. So: ONE session, shortened, rather than none. If the sensations do not come during the warm-up, turn it into an easy run without guilt.`,
    qualiteWhy: "The quality session of your block, set on your MAS and your goal. This is the one that makes you progress.",

    enduranceTitre: "Easy run",
    enduranceDetail: (e, c, a, k, g, s, cy) => `Warm-up ${e} min building HR Z1→Z2 → Main set: ${c} at Z2${a}, you must be able to hold a conversation → Cool-down ${k} min HR Z1.${g}${s ? " 💡 At your volume, split it into TWO runs in the day (morning + evening) rather than one endless jog." : ""}${cy}`,
    enduranceWhyTropIntense: (p) => `⚠️ You spend ${p} % of your running time in zone 3 and above, when the target is 20 %. Your easy runs are run too fast — that is the number 1 brake on progress. Slow down until you can hold a full conversation: it is supposed to feel TOO easy.`,
    enduranceWhy: (c) => `The aerobic base. With the other sessions you are on ~${c} km this week — it is the easy volume that builds deep fitness, not the hard sessions.`,

    renfoTitre: "Strength work",
    renfoAffutage: `20 to 25 min, MAINTENANCE only: core 3×45 s, calf raises 2×15, proprioception 2×30 s per leg, a few short bounds. NO heavy load and no long sets close to the race — we protect freshness, the strength is already banked.`,
    renfoBase: (s) => `35 to 45 min, FOUNDATIONS: full core (plank, side, back) ${s}×45 s, squats ${s}×12, lunges ${s}×10 per leg, calf raises ${s}×15, nordic hamstring curls ${s}×6, single-leg proprioception ${s}×30 s. Range and control above all — this is the phase where the tendon is built.`,
    renfoSpecifique: (s) => `30 to 35 min, STRENGTH THAT TRANSFERS TO RUNNING: Bulgarian split squats ${s}×8 per leg, jump lunges ${s}×8, single-leg calf raises ${s}×12, nordic curls ${s}×6, dynamic core ${s}×40 s, bounds ${s}×10. Explosive and short: we transfer strength into the stride, we no longer chase volume.`,
    renfoDeveloppement: (s, plus) => `30 to 40 min, DEVELOPMENT: core (plank, side) ${s}×45 s, squats ${s}×12, lunges ${s}×10 per leg, calf raises ${s}×15, nordic hamstring curls ${s}×6, single-leg proprioception ${s}×30 s. ${plus ? "One set more than last week — progressive overload applies to strength work too." : "Load held this week (assimilation)."}`,
    renfoWhy: "The number 1 injury prevention, and a direct gain in running economy. It is periodised like the running: foundations, then transferable strength, then simple maintenance as race day approaches.",

    recupTitre: "Recovery",
    recupDetail: (e, k) => `Warm-up ${e} min very gentle HR Z1 → Main set: 25 min at Z1 very easy, driven by HEART RATE (no pace to hold) → Cool-down ${k} min HR Z1. Or complete rest if that feels better.`,
    recupWhyDejaDur: "You have already done a demanding session today: we do not double up. Progress is made in recovery.",
    recupWhyRouge: (m) => `Today your body is asking for recovery: ${m}. Postponing a hard session by 24 h costs nothing; forcing it costs weeks.`,
    allegeeDetailSuffixe: "\n\n⚠️ EASED version today: cut the main set by about a third.",
    allegeeWhy: (m) => `Session kept but shortened: ${m}.`,

    suffixeSoir: " (evening)",
    whySoir: " Doubled day: the main run stays in the evening.",
    matinTitre: "Morning run",
    matinWhy: "Second run of the day: the same volume as in one go, better absorbed. It is free volume in terms of fatigue, provided you really run it slowly.",

    tags: {
      "Course": "Race", "Objectif": "Goal", "Récup": "Recovery", "Veille de course": "Day before the race",
      "Affûtage": "Taper", "Repos": "Rest", "Z1": "Z1", "Z2": "Z2", "Vélo": "Bike", "Long": "Long",
      "Spécifique": "Race pace", "Progressif": "Progressive", "Qualité": "Quality", "Allégée": "Eased",
      "Endurance": "Endurance", "Renfo": "Strength", "Prévention": "Prevention", "VMA": "VO2max", "Seuil": "Threshold",
      "Soir": "Evening", "Matin": "Morning",
    },
    tagKm: (km) => `${km} km`,
  },

  de: {
    kmEtTemps: (km, d) => (d ? `~${km} km (etwa ${d})` : `~${km} km`),
    noteGAP: " ⛰️ Im welligen Gelände ist dieses Tempo als GAP zu verstehen (steigungsangepasstes Tempo): bergauf bist du bei gleicher Belastung langsamer auf der Uhr — verlass dich auf Herzfrequenz und Gefühl, nicht auf das Display.",
    noteAffutage: " ⚠️ TAPERING-Woche: Wir kürzen den Umfang, nicht die Intensität.",
    noteAllegee: " ⚠️ ENTLASTUNGS-Woche: Jetzt verarbeitet der Körper die Arbeit der letzten 3 Wochen.",
    noteCross: (p, l) => ` (davon ${p} % aus einer anderen Sportart: ${l})`,
    motifDefaut: "Ermüdungszeichen",

    courseTitre: (c) => (c ? `🏁 ${c}` : "🏁 Wettkampftag"),
    courseDetail: (a) => `Aufwärmen 15 bis 20 min ansteigend + 3 bis 4 Steigerungen, 10 min vor dem Start beendet.${a ? ` Geh mit ${a}/km los — auf den ersten 2 Kilometern auf keinen Fall schneller, das ist der teuerste Fehler überhaupt.` : ""} Auslaufen 10 min locker traben.`,
    courseWhy: (t) => (t ? `Heute ist der Tag. Der ganze Block wurde für diese ${t} gebaut. Vertraue deiner Vorbereitung und halte dein Tempo.` : "Heute ist der Tag. Vertraue deiner Vorbereitung."),
    veilleTitre: "Lockermachen — Tag vor dem Wettkampf",
    veilleDetail: "20 min sehr lockerer Dauerlauf HF Z1 + 3 Steigerungen über 80 m im Wettkampftempo. Mehr nicht: Wir wecken die Beine, wir ermüden sie nicht.",
    veilleWhy: "Form baut man vorher auf, nicht am Vortag. Eine Einheit mehr bringt dir nichts und kann dich den Wettkampf kosten.",
    avantVeilleTitre: "Zwei Tage vor dem Wettkampf",
    avantVeilleDetail: "30 min lockerer Dauerlauf HF Z1-Z2, optional 4×30 s im Wettkampftempo, um spritzig zu bleiben.",
    avantVeilleWhy: "Wir halten den Kontakt zum Tempo, ohne die Frische anzugreifen.",
    reposCourseTitre: "Ruhe nach dem Wettkampf",
    reposCourseDetail: "Vollständige Ruhe. Gehen, sanftes Dehnen, sorgfältig trinken und essen.",
    reposCourseWhy: "Ein Wettkampf ist eine maximale Belastung: Der Körper braucht mehrere Tage zur Reparatur.",
    recupCourseTitre: "Erholung nach dem Wettkampf",
    recupCourseDetail: "20 bis 30 min sehr lockerer Dauerlauf HF Z1, oder Ruhe, wenn die Beine noch schwer sind.",
    recupCourseWhy: "Sanfter Wiedereinstieg: Rechne mit etwa einem Erholungstag je 3 gelaufene Wettkampfkilometer.",

    reposTitre: "Ruhe",
    reposJourRateDetail: "Ruhe. Dieser Wochentag passt dir zum Laufen offensichtlich nicht — wir bestehen nicht darauf, der Umfang wandert woanders hin.",
    reposJourRateWhy: "Du bist an diesem Tag die letzten Male, an denen er geplant war, nicht gelaufen. Ein Plan, den man nicht befolgt, nützt nichts: Wir passen ihn deinem echten Leben an.",
    reposIndispoDetail: "Ruhe — du hast angegeben, an diesem Tag nicht trainieren zu können.",
    reposIndispoWhy: "Dein Plan richtet sich nach deiner echten Verfügbarkeit: Genau das macht ihn auf Dauer durchhaltbar.",
    reposCompletTitre: "Vollständige Ruhe",
    reposCompletDetail: "Vollständige Ruhe. Gehen, sanftes Dehnen oder Mobilität, wenn du das Bedürfnis hast, mehr nicht.",
    reposCompletWhy: "Die Anpassung passiert in der Ruhe, nicht in der Belastung.",
    reposFinalDetail: "Ruhe. Jetzt verwandelt der Körper die Arbeit in Fortschritt.",
    reposFinalWhy: "Dein Plan berücksichtigt die Anzahl Einheiten, die du wirklich schaffen kannst.",

    veloLongTitre: "Lange Radausfahrt",
    veloLongDetail: (e, d, n) => `Aufwärmen ${e} min sehr locker → ${d} bis 2h bei HF Z2, Unterhaltungstempo, runde Trittfrequenz → 10 min Auslaufen. Kein Zieltempo: Das ist aerober Umfang ohne Belastungsspitzen.${n}`,
    veloLongWhy: "Der aerobe Umfang der Woche, ohne die Aufprallbelastung des Laufens.",
    longSpecTitre: "Langer Lauf mit Wettkampftempo-Block",
    longSpecDetail: (e, c, a, s, p, k, n) => `Aufwärmen ${e} min ansteigend HF Z1→Z2 → Hauptteil: ${c} in Z2${a}, dann ${s} km zu ${p}/km AUF MÜDEN BEINEN → Auslaufen ${k} min HF Z1.${n}`,
    longSpecWhy: "Der Wettkampftempo-Block kommt am ENDE des Laufs, wenn die Beine schon schwer sind — genau der Zustand, in dem du im letzten Drittel deines Wettkampfs sein wirst. Keine Einheit bereitet besser auf den Tag X vor.",
    longProgTitre: "Progressiver langer Lauf",
    longProgDetail: (e, c, a, t, f, k, n) => `Aufwärmen ${e} min ansteigend HF Z1→Z2 → Hauptteil: ${c} in Z2${a}, davon die LETZTEN ${t} Kilometer beschleunigt${f ? ` auf ~${f}/km` : " um eine Stufe"} → Auslaufen ${k} min HF Z1.${n}`,
    longProgWhy: "Schneller aufhören als anfangen: Das lehrt dich, stark zu Ende zu laufen statt nur zu überstehen, und es baut das Selbstvertrauen auf, das über ein Rennende entscheidet. Die Steigerung muss KOMFORTABEL bleiben — wenn du presst, ist sie vergeudet.",
    longTitre: "Langer Lauf",
    longDetail: (e, c, a, k, n) => `Aufwärmen ${e} min ansteigend HF Z1→Z2 → Hauptteil: ${c} in Z2${a}, von Anfang bis Ende im Unterhaltungstempo → Auslaufen ${k} min HF Z1.${n}`,
    longWhyRaccourcie: (km, prev, m) => `Langer Lauf VERKÜRZT auf ${km} km (${prev} km geplant): ${m}. Das ist kein Rückschritt — es ist das, was den Rest des Blocks möglich macht. Wir gehen wieder hoch, sobald die Belastung sinkt.`,
    longWhy: (km) => `Das ist die Einheit, die deine Grundlagenausdauer baut — ${km} km, auf deinen aktuellen Umfang abgestimmt. Sie muss locker bleiben: Wenn du zerstört ankommst, war sie zu schnell.`,

    qualiteTitreVMA: "VO2max-Einheit",
    qualiteTitreSeuil: "Schwelleneinheit",
    qualiteTitreSpecifique: "Wettkampftempo des Ziels",
    suffixeAllegee: " (reduziert)",
    qualiteDetail: (e, c, k, taper, all) => `Aufwärmen ${e} min ansteigend HF Z1→Z2 + 3 bis 5 Steigerungen über 80 m → Hauptteil: ${c} → Auslaufen ${k} min HF Z1.${taper ? " ⚠️ Tapering: Intensität halten, aber die Anzahl der Wiederholungen um ein Drittel kürzen." : ""}${all ? " ⚠️ Reduzierte Fassung: Anzahl der Wiederholungen um ein Drittel kürzen, Tempo beibehalten. Wir erhalten den Reiz, nicht den Umfang." : ""}`,
    qualiteWhySauvee: (o) => `Deine jüngste Belastung liegt deutlich über deiner Grundbelastung${o} — aber dein Termin rückt näher, und eine Woche ganz ohne wettkampfspezifisches Tempo zahlst du am Tag X. Also: EINE Einheit, verkürzt, statt keiner. Wenn beim Aufwärmen die Sensationen ausbleiben, mach ohne schlechtes Gewissen einen lockeren Dauerlauf daraus.`,
    qualiteWhy: "Die Qualitätseinheit deines Blocks, abgestimmt auf deine maximale aerobe Geschwindigkeit und dein Ziel. Sie ist es, die dich weiterbringt.",

    enduranceTitre: "Lockerer Dauerlauf",
    enduranceDetail: (e, c, a, k, g, s, cy) => `Aufwärmen ${e} min ansteigend HF Z1→Z2 → Hauptteil: ${c} in Z2${a}, du musst dich unterhalten können → Auslaufen ${k} min HF Z1.${g}${s ? " 💡 Bei deinem Umfang teile ihn auf ZWEI Läufe am Tag auf (morgens + abends) statt eines endlosen Dauerlaufs." : ""}${cy}`,
    enduranceWhyTropIntense: (p) => `⚠️ Du verbringst ${p} % deiner Laufzeit in Zone 3 und höher, Ziel sind 20 %. Deine lockeren Läufe sind zu schnell — das ist die Bremse Nummer 1 für den Fortschritt. Werde so langsam, dass du dich vollständig unterhalten kannst: Es soll sich ZU leicht anfühlen.`,
    enduranceWhy: (c) => `Die aerobe Basis. Mit den übrigen Einheiten liegst du diese Woche bei ~${c} km — es ist der lockere Umfang, der die Grundform baut, nicht die harten Einheiten.`,

    renfoTitre: "Kräftigung",
    renfoAffutage: `20 bis 25 min, nur ERHALTUNG: Rumpf 3×45 s, Wadenheben 2×15, Propriozeption 2×30 s pro Bein, ein paar kurze Sprünge. KEINE schweren Lasten und keine langen Sätze kurz vor dem Wettkampf — wir schützen die Frische, die Kraft ist längst da.`,
    renfoBase: (s) => `35 bis 45 min, FUNDAMENT: kompletter Rumpf (Unterarmstütz, seitlich, Rücken) ${s}×45 s, Kniebeugen ${s}×12, Ausfallschritte ${s}×10 pro Bein, Wadenheben ${s}×15, Nordic Curls ${s}×6, Propriozeption auf einem Bein ${s}×30 s. Bewegungsumfang und Kontrolle vor allem — das ist die Phase, in der die Sehne gebaut wird.`,
    renfoSpecifique: (s) => `30 bis 35 min, LAUFSPEZIFISCHE KRAFT: bulgarische Kniebeugen ${s}×8 pro Bein, Sprungausfallschritte ${s}×8, einbeiniges Wadenheben ${s}×12, Nordic Curls ${s}×6, dynamischer Rumpf ${s}×40 s, Sprünge ${s}×10. Explosiv und kurz: Wir übertragen die Kraft in den Laufschritt, Umfang ist nicht mehr das Ziel.`,
    renfoDeveloppement: (s, plus) => `30 bis 40 min, ENTWICKLUNG: Rumpf (Unterarmstütz, seitlich) ${s}×45 s, Kniebeugen ${s}×12, Ausfallschritte ${s}×10 pro Bein, Wadenheben ${s}×15, Nordic Curls ${s}×6, Propriozeption auf einem Bein ${s}×30 s. ${plus ? "Ein Satz mehr als letzte Woche — progressive Überlastung gilt auch für die Kräftigung." : "Belastung diese Woche gehalten (Verarbeitung)."}`,
    renfoWhy: "Die Verletzungsprävention Nummer 1 und ein direkter Gewinn an Laufökonomie. Sie wird periodisiert wie das Laufen: Fundament, dann laufspezifische Kraft, dann nur noch Erhaltung, wenn der Tag X näher rückt.",

    recupTitre: "Erholung",
    recupDetail: (e, k) => `Aufwärmen ${e} min sehr sanft HF Z1 → Hauptteil: 25 min in Z1 sehr locker, über die HERZFREQUENZ gesteuert (kein Tempo zu halten) → Auslaufen ${k} min HF Z1. Oder vollständige Ruhe, wenn sich das besser anfühlt.`,
    recupWhyDejaDur: "Du hast heute schon eine fordernde Einheit gemacht: Wir verdoppeln nicht. Der Fortschritt entsteht in der Erholung.",
    recupWhyRouge: (m) => `Heute verlangt dein Körper Erholung: ${m}. Eine harte Einheit um 24 h zu verschieben kostet nichts; sie zu erzwingen kostet Wochen.`,
    allegeeDetailSuffixe: "\n\n⚠️ Heute REDUZIERTE Fassung: Kürze den Hauptteil um etwa ein Drittel.",
    allegeeWhy: (m) => `Einheit bleibt, aber verkürzt: ${m}.`,

    suffixeSoir: " (abends)",
    whySoir: " Doppeltag: Der Hauptlauf bleibt am Abend.",
    matinTitre: "Morgenlauf",
    matinWhy: "Zweiter Lauf des Tages: derselbe Umfang wie am Stück, nur besser verarbeitet. Ermüdungstechnisch ist das geschenkter Umfang — vorausgesetzt, du läufst ihn wirklich langsam.",

    tags: {
      "Course": "Wettkampf", "Objectif": "Ziel", "Récup": "Erholung", "Veille de course": "Tag vor dem Wettkampf",
      "Affûtage": "Tapering", "Repos": "Ruhe", "Z1": "Z1", "Z2": "Z2", "Vélo": "Rad", "Long": "Lang",
      "Spécifique": "Wettkampftempo", "Progressif": "Progressiv", "Qualité": "Qualität", "Allégée": "Reduziert",
      "Endurance": "Grundlage", "Renfo": "Kraft", "Prévention": "Prävention", "VMA": "VO2max", "Seuil": "Schwelle",
      "Soir": "Abends", "Matin": "Morgens",
    },
    tagKm: (km) => `${km} km`,
  },

  es: {
    kmEtTemps: (km, d) => (d ? `~${km} km (unos ${d})` : `~${km} km`),
    noteGAP: " ⛰️ En terreno ondulado este ritmo se entiende como GAP (ritmo ajustado al desnivel): en subida serás más lento en el crono para el mismo esfuerzo — fíate de la FC y de las sensaciones, no de la pantalla.",
    noteAffutage: " ⚠️ Semana de AFINAMIENTO: reducimos el volumen, no la intensidad.",
    noteAllegee: " ⚠️ Semana ALIGERADA: es ahora cuando el cuerpo asimila el trabajo de las 3 semanas anteriores.",
    noteCross: (p, l) => ` (de los cuales un ${p} % viene de otro deporte: ${l})`,
    motifDefaut: "señales de fatiga",

    courseTitre: (c) => (c ? `🏁 ${c}` : "🏁 Día de carrera"),
    courseDetail: (a) => `Calentamiento 15 a 20 min progresivo + 3 o 4 progresiones, terminado 10 min antes de la salida.${a ? ` Sal a ${a}/km — sobre todo NO más rápido en los 2 primeros kilómetros, es el error que más caro se paga.` : ""} Vuelta a la calma 10 min trotando.`,
    courseWhy: (t) => (t ? `Es el día. Todo el bloque se ha construido para ese ${t}. Confía en tu preparación y sostén tu ritmo.` : "Es el día. Confía en tu preparación."),
    veilleTitre: "Soltura — víspera de carrera",
    veilleDetail: "20 min de rodaje muy suave FC Z1 + 3 progresiones de 80 m a ritmo de carrera. Nada más: despertamos las piernas, no las cansamos.",
    veilleWhy: "La forma se construye antes, no la víspera. Una sesión más no te aportará nada y puede costarte la carrera.",
    avantVeilleTitre: "Dos días antes de la carrera",
    avantVeilleDetail: "30 min de rodaje suave FC Z1-Z2, y si acaso 4×30 s a ritmo de carrera para mantenerte tónico.",
    avantVeilleWhy: "Mantenemos el contacto con el ritmo sin tocar la frescura.",
    reposCourseTitre: "Descanso post-carrera",
    reposCourseDetail: "Descanso completo. Caminar, estiramientos suaves, hidratación y alimentación cuidadas.",
    reposCourseWhy: "Una carrera es un esfuerzo máximo: el cuerpo necesita varios días para reparar.",
    recupCourseTitre: "Recuperación post-carrera",
    recupCourseDetail: "20 a 30 min de rodaje muy suave FC Z1, o descanso si las piernas siguen pesadas.",
    recupCourseWhy: "Vuelta suave: cuenta más o menos un día de recuperación por cada 3 km corridos en carrera.",

    reposTitre: "Descanso",
    reposJourRateDetail: "Descanso. Este día de la semana claramente no te va para correr — no insistimos, el volumen se traslada a otro día.",
    reposJourRateWhy: "No corriste ese día las últimas veces que estaba previsto. Un plan que no se sigue no sirve de nada: lo adaptamos a tu vida real.",
    reposIndispoDetail: "Descanso — indicaste que no puedes entrenar ese día.",
    reposIndispoWhy: "Tu plan está ajustado a tu disponibilidad real: eso es lo que lo hace sostenible.",
    reposCompletTitre: "Descanso completo",
    reposCompletDetail: "Descanso completo. Caminar, estiramientos suaves o movilidad si lo necesitas, nada más.",
    reposCompletWhy: "La adaptación se produce durante el descanso, no durante el esfuerzo.",
    reposFinalDetail: "Descanso. Es el momento en que el cuerpo convierte el trabajo en progreso.",
    reposFinalWhy: "Tu plan tiene en cuenta el número de sesiones que puedes asumir de verdad.",

    veloLongTitre: "Salida larga en bici",
    veloLongDetail: (e, d, n) => `Calentamiento ${e} min muy suave → ${d} a 2h en FC Z2, ritmo conversacional, cadencia ágil → 10 min de vuelta a la calma. Sin ritmo objetivo: es volumen aeróbico sin impacto.${n}`,
    veloLongWhy: "El volumen aeróbico de la semana, sin las exigencias de impacto de la carrera.",
    longSpecTitre: "Tirada larga con bloque a ritmo",
    longSpecDetail: (e, c, a, s, p, k, n) => `Calentamiento ${e} min progresivo FC Z1→Z2 → Parte principal: ${c} en Z2${a}, luego ${s} km a ${p}/km CON LAS PIERNAS CANSADAS → Vuelta a la calma ${k} min FC Z1.${n}`,
    longSpecWhy: "El bloque a ritmo de carrera llega al FINAL de la tirada, cuando las piernas ya pesan — exactamente el estado en el que estarás en el último tercio de tu carrera. Ninguna sesión prepara mejor el día D.",
    longProgTitre: "Tirada larga progresiva",
    longProgDetail: (e, c, a, t, f, k, n) => `Calentamiento ${e} min progresivo FC Z1→Z2 → Parte principal: ${c} en Z2${a}, con los ${t} ÚLTIMOS kilómetros acelerados${f ? ` a ~${f}/km` : " un punto"} → Vuelta a la calma ${k} min FC Z1.${n}`,
    longProgWhy: "Acabar más rápido de lo que se empieza te enseña a terminar fuerte en vez de sobrevivir, y fabrica la confianza que decide un final de carrera. La progresión debe seguir siendo CÓMODA — si fuerzas, está desperdiciada.",
    longTitre: "Tirada larga",
    longDetail: (e, c, a, k, n) => `Calentamiento ${e} min progresivo FC Z1→Z2 → Parte principal: ${c} en Z2${a}, ritmo conversacional de principio a fin → Vuelta a la calma ${k} min FC Z1.${n}`,
    longWhyRaccourcie: (km, prev, m) => `Tirada larga ACORTADA a ${km} km (${prev} km previstos): ${m}. No es un retroceso — es lo que permite encadenar el resto del bloque. Volvemos a subir en cuanto baje la carga.`,
    longWhy: (km) => `Es la sesión que construye tu resistencia de fondo — ${km} km, ajustados a tu volumen actual. Debe seguir siendo fácil: si acabas roto, iba demasiado rápida.`,

    qualiteTitreVMA: "Sesión de VAM",
    qualiteTitreSeuil: "Sesión de umbral",
    qualiteTitreSpecifique: "Ritmo específico del objetivo",
    suffixeAllegee: " (aligerada)",
    qualiteDetail: (e, c, k, taper, all) => `Calentamiento ${e} min progresivo FC Z1→Z2 + 3 a 5 progresiones de 80 m → Parte principal: ${c} → Vuelta a la calma ${k} min FC Z1.${taper ? " ⚠️ Afinamiento: mantén la intensidad pero recorta un tercio las repeticiones." : ""}${all ? " ⚠️ Versión aligerada: recorta un tercio las repeticiones y mantén el ritmo. Preservamos el estímulo, no el volumen." : ""}`,
    qualiteWhySauvee: (o) => `Tu carga reciente está muy por encima de tu carga de fondo${o} — pero tu cita se acerca y una semana sin nada de ritmo específico se paga el día D. Así que: UNA sesión, acortada, mejor que ninguna. Si las sensaciones no llegan en el calentamiento, conviértela en rodaje sin culpa.`,
    qualiteWhy: "La sesión de calidad de tu bloque, ajustada a tu VAM y a tu objetivo. Es la que te hace progresar.",

    enduranceTitre: "Rodaje en resistencia",
    enduranceDetail: (e, c, a, k, g, s, cy) => `Calentamiento ${e} min progresivo FC Z1→Z2 → Parte principal: ${c} en Z2${a}, tienes que poder mantener una conversación → Vuelta a la calma ${k} min FC Z1.${g}${s ? " 💡 Con tu volumen, divídelo en DOS salidas en el día (mañana + tarde) en vez de un rodaje interminable." : ""}${cy}`,
    enduranceWhyTropIntense: (p) => `⚠️ Pasas el ${p} % de tu tiempo de carrera en zona 3 o más, cuando el objetivo es el 20 %. Tus rodajes van demasiado rápidos — es el freno n.º 1 al progreso. Baja hasta poder mantener una conversación completa: tiene que parecer DEMASIADO fácil.`,
    enduranceWhy: (c) => `La base aeróbica. Con las demás sesiones estás en ~${c} km esta semana — es el volumen fácil el que construye la forma de fondo, no las sesiones duras.`,

    renfoTitre: "Trabajo de fuerza",
    renfoAffutage: `20 a 25 min, solo MANTENIMIENTO: core 3×45 s, elevaciones de gemelos 2×15, propiocepción 2×30 s por pierna, algunos saltos cortos. NINGUNA carga pesada ni serie larga cerca de la carrera — preservamos la frescura, la fuerza ya está adquirida.`,
    renfoBase: (s) => `35 a 45 min, CIMIENTOS: core completo (plancha, lateral, espalda) ${s}×45 s, sentadillas ${s}×12, zancadas ${s}×10 por pierna, elevaciones de gemelos ${s}×15, nordic curls de isquios ${s}×6, propiocepción a una pierna ${s}×30 s. Amplitud y control ante todo — es la fase en la que se construye el tendón.`,
    renfoSpecifique: (s) => `30 a 35 min, FUERZA ÚTIL PARA CORRER: sentadillas búlgaras ${s}×8 por pierna, zancadas saltadas ${s}×8, elevaciones de gemelos a una pierna ${s}×12, nordic curls ${s}×6, core dinámico ${s}×40 s, saltos ${s}×10. Explosivo y corto: transferimos la fuerza a la zancada, ya no buscamos volumen.`,
    renfoDeveloppement: (s, plus) => `30 a 40 min, DESARROLLO: core (plancha, lateral) ${s}×45 s, sentadillas ${s}×12, zancadas ${s}×10 por pierna, elevaciones de gemelos ${s}×15, nordic curls de isquios ${s}×6, propiocepción a una pierna ${s}×30 s. ${plus ? "Una serie más que la semana pasada — la sobrecarga progresiva vale también para la fuerza." : "Carga mantenida esta semana (asimilación)."}`,
    renfoWhy: "La prevención de lesiones n.º 1, y una ganancia directa de economía de zancada. Se periodiza como la carrera: cimientos, luego fuerza útil, y solo mantenimiento al acercarse el día D.",

    recupTitre: "Recuperación",
    recupDetail: (e, k) => `Calentamiento ${e} min muy suave FC Z1 → Parte principal: 25 min en Z1 muy fácil, pilotado por FRECUENCIA CARDÍACA (sin ritmo que mantener) → Vuelta a la calma ${k} min FC Z1. O descanso completo si lo sientes mejor.`,
    recupWhyDejaDur: "Ya has hecho una sesión exigente hoy: no doblamos. El progreso se juega en la recuperación.",
    recupWhyRouge: (m) => `Hoy tu cuerpo pide recuperación: ${m}. Aplazar una sesión dura 24 h no cuesta nada; forzarla cuesta semanas.`,
    allegeeDetailSuffixe: "\n\n⚠️ Versión ALIGERADA hoy: reduce la parte principal en torno a un tercio.",
    allegeeWhy: (m) => `Sesión mantenida pero acortada: ${m}.`,

    suffixeSoir: " (tarde)",
    whySoir: " Día doblado: la salida principal se queda por la tarde.",
    matinTitre: "Rodaje de la mañana",
    matinWhy: "Segunda salida del día: el mismo volumen que de una vez, mejor absorbido. Es volumen gratis en términos de fatiga, siempre que lo corras de verdad despacio.",

    tags: {
      "Course": "Carrera", "Objectif": "Objetivo", "Récup": "Recuperación", "Veille de course": "Víspera de carrera",
      "Affûtage": "Afinamiento", "Repos": "Descanso", "Z1": "Z1", "Z2": "Z2", "Vélo": "Bici", "Long": "Largo",
      "Spécifique": "Ritmo específico", "Progressif": "Progresivo", "Qualité": "Calidad", "Allégée": "Aligerada",
      "Endurance": "Resistencia", "Renfo": "Fuerza", "Prévention": "Prevención", "VMA": "VAM", "Seuil": "Umbral",
      "Soir": "Tarde", "Matin": "Mañana",
    },
    tagKm: (km) => `${km} km`,
  },

  pt: {
    kmEtTemps: (km, d) => (d ? `~${km} km (cerca de ${d})` : `~${km} km`),
    noteGAP: " ⛰️ Em terreno ondulado este ritmo entende-se como GAP (ritmo ajustado ao desnível): a subir vais estar mais lento no cronómetro para o mesmo esforço — guia-te pela FC e pelas sensações, não pelo mostrador.",
    noteAffutage: " ⚠️ Semana de AFINAMENTO: reduzimos o volume, não a intensidade.",
    noteAllegee: " ⚠️ Semana ALIVIADA: é agora que o corpo assimila o trabalho das 3 semanas anteriores.",
    noteCross: (p, l) => ` (dos quais ${p} % vêm de outro desporto: ${l})`,
    motifDefaut: "sinais de fadiga",

    courseTitre: (c) => (c ? `🏁 ${c}` : "🏁 Dia de prova"),
    courseDetail: (a) => `Aquecimento 15 a 20 min progressivo + 3 a 4 progressões, terminado 10 min antes da partida.${a ? ` Sai a ${a}/km — sobretudo NÃO mais rápido nos 2 primeiros quilómetros, é o erro que sai mais caro.` : ""} Retorno à calma 10 min a trote.`,
    courseWhy: (t) => (t ? `É o dia. Todo o bloco foi construído para esse ${t}. Confia na tua preparação e segura o teu ritmo.` : "É o dia. Confia na tua preparação."),
    veilleTitre: "Soltura — véspera de prova",
    veilleDetail: "20 min de corrida muito fácil FC Z1 + 3 progressões de 80 m a ritmo de prova. Nada mais: acordamos as pernas, não as cansamos.",
    veilleWhy: "A forma constrói-se antes, não na véspera. Uma sessão a mais não te vai dar nada e pode custar-te a prova.",
    avantVeilleTitre: "Dois dias antes da prova",
    avantVeilleDetail: "30 min de corrida fácil FC Z1-Z2, eventualmente 4×30 s a ritmo de prova para te manteres tónico.",
    avantVeilleWhy: "Mantemos o contacto com o ritmo sem mexer na frescura.",
    reposCourseTitre: "Descanso pós-prova",
    reposCourseDetail: "Descanso completo. Caminhar, alongamentos suaves, hidratação e alimentação cuidadas.",
    reposCourseWhy: "Uma prova é um esforço máximo: o corpo precisa de vários dias para reparar.",
    recupCourseTitre: "Recuperação pós-prova",
    recupCourseDetail: "20 a 30 min de corrida muito fácil FC Z1, ou descanso se as pernas ainda estiverem pesadas.",
    recupCourseWhy: "Regresso suave: conta cerca de um dia de recuperação por cada 3 km corridos em prova.",

    reposTitre: "Descanso",
    reposJourRateDetail: "Descanso. Este dia da semana claramente não te serve para correr — não insistimos, o volume passa para outro dia.",
    reposJourRateWhy: "Não correste nesse dia das últimas vezes em que estava previsto. Um plano que não se cumpre não serve de nada: adaptamo-lo à tua vida real.",
    reposIndispoDetail: "Descanso — indicaste que não podes treinar nesse dia.",
    reposIndispoWhy: "O teu plano está calibrado pela tua disponibilidade real: é isso que o torna sustentável.",
    reposCompletTitre: "Descanso completo",
    reposCompletDetail: "Descanso completo. Caminhar, alongamentos suaves ou mobilidade se sentires necessidade, nada mais.",
    reposCompletWhy: "É durante o descanso que a adaptação acontece, não durante o esforço.",
    reposFinalDetail: "Descanso. É o momento em que o corpo transforma o trabalho em progresso.",
    reposFinalWhy: "O teu plano tem em conta o número de sessões que consegues mesmo assegurar.",

    veloLongTitre: "Saída longa de bicicleta",
    veloLongDetail: (e, d, n) => `Aquecimento ${e} min muito fácil → ${d} a 2h em FC Z2, ritmo conversacional, cadência solta → 10 min de retorno à calma. Sem ritmo alvo: é volume aeróbio sem impacto.${n}`,
    veloLongWhy: "O volume aeróbio da semana, sem as exigências de impacto da corrida.",
    longSpecTitre: "Longo com bloco a ritmo de prova",
    longSpecDetail: (e, c, a, s, p, k, n) => `Aquecimento ${e} min progressivo FC Z1→Z2 → Parte principal: ${c} em Z2${a}, depois ${s} km a ${p}/km COM AS PERNAS CANSADAS → Retorno à calma ${k} min FC Z1.${n}`,
    longSpecWhy: "O bloco a ritmo de prova chega no FIM do longo, quando as pernas já estão pesadas — exatamente o estado em que vais estar no último terço da tua prova. Nenhuma sessão prepara melhor o dia D.",
    longProgTitre: "Longo progressivo",
    longProgDetail: (e, c, a, t, f, k, n) => `Aquecimento ${e} min progressivo FC Z1→Z2 → Parte principal: ${c} em Z2${a}, com os ${t} ÚLTIMOS quilómetros acelerados${f ? ` a ~${f}/km` : " um patamar"} → Retorno à calma ${k} min FC Z1.${n}`,
    longProgWhy: "Acabar mais rápido do que se começou ensina-te a terminar forte em vez de sobreviver, e constrói a confiança que decide um fim de prova. A progressão tem de continuar CONFORTÁVEL — se forçares, está estragada.",
    longTitre: "Longo",
    longDetail: (e, c, a, k, n) => `Aquecimento ${e} min progressivo FC Z1→Z2 → Parte principal: ${c} em Z2${a}, ritmo conversacional do início ao fim → Retorno à calma ${k} min FC Z1.${n}`,
    longWhyRaccourcie: (km, prev, m) => `Longo ENCURTADO para ${km} km (${prev} km previstos): ${m}. Não é um recuo — é o que permite encadear o resto do bloco. Voltamos a subir assim que a carga baixar.`,
    longWhy: (km) => `É a sessão que constrói a tua resistência de fundo — ${km} km, ajustados ao teu volume atual. Tem de continuar fácil: se acabares destruído, foi demasiado rápida.`,

    qualiteTitreVMA: "Sessão de VAM",
    qualiteTitreSeuil: "Sessão de limiar",
    qualiteTitreSpecifique: "Ritmo específico do objetivo",
    suffixeAllegee: " (aliviada)",
    qualiteDetail: (e, c, k, taper, all) => `Aquecimento ${e} min progressivo FC Z1→Z2 + 3 a 5 progressões de 80 m → Parte principal: ${c} → Retorno à calma ${k} min FC Z1.${taper ? " ⚠️ Afinamento: mantém a intensidade mas corta um terço das repetições." : ""}${all ? " ⚠️ Versão aliviada: corta um terço das repetições e mantém o ritmo. Preservamos o estímulo, não o volume." : ""}`,
    qualiteWhySauvee: (o) => `A tua carga recente está muito acima da tua carga de fundo${o} — mas a tua prova aproxima-se e uma semana sem qualquer ritmo específico paga-se no dia D. Portanto: UMA sessão, encurtada, em vez de nenhuma. Se as sensações não aparecerem no aquecimento, transforma-a em corrida fácil sem culpa.`,
    qualiteWhy: "A sessão de qualidade do teu bloco, ajustada à tua VAM e ao teu objetivo. É ela que te faz progredir.",

    enduranceTitre: "Corrida em resistência",
    enduranceDetail: (e, c, a, k, g, s, cy) => `Aquecimento ${e} min progressivo FC Z1→Z2 → Parte principal: ${c} em Z2${a}, tens de conseguir manter uma conversa → Retorno à calma ${k} min FC Z1.${g}${s ? " 💡 Com o teu volume, divide em DUAS saídas no dia (manhã + tarde) em vez de uma corrida interminável." : ""}${cy}`,
    enduranceWhyTropIntense: (p) => `⚠️ Passas ${p} % do teu tempo de corrida em zona 3 ou acima, quando o alvo são 20 %. As tuas corridas fáceis vão depressa demais — é o travão n.º 1 ao progresso. Abranda até conseguires manter uma conversa completa: é suposto parecer DEMASIADO fácil.`,
    enduranceWhy: (c) => `A base aeróbia. Com as outras sessões estás em ~${c} km esta semana — é o volume fácil que constrói a forma de fundo, não as sessões duras.`,

    renfoTitre: "Reforço muscular",
    renfoAffutage: `20 a 25 min, só MANUTENÇÃO: core 3×45 s, elevações de gémeos 2×15, propriocepção 2×30 s por perna, alguns saltos curtos. NENHUMA carga pesada nem série longa perto da prova — preservamos a frescura, a força já está adquirida.`,
    renfoBase: (s) => `35 a 45 min, FUNDAÇÕES: core completo (prancha, lateral, costas) ${s}×45 s, agachamentos ${s}×12, afundos ${s}×10 por perna, elevações de gémeos ${s}×15, nordic curls de isquiotibiais ${s}×6, propriocepção a uma perna ${s}×30 s. Amplitude e controlo acima de tudo — é a fase em que se constrói o tendão.`,
    renfoSpecifique: (s) => `30 a 35 min, FORÇA ÚTIL À CORRIDA: agachamentos búlgaros ${s}×8 por perna, afundos saltados ${s}×8, elevações de gémeos a uma perna ${s}×12, nordic curls ${s}×6, core dinâmico ${s}×40 s, saltos ${s}×10. Explosivo e curto: transferimos a força para a passada, já não procuramos volume.`,
    renfoDeveloppement: (s, plus) => `30 a 40 min, DESENVOLVIMENTO: core (prancha, lateral) ${s}×45 s, agachamentos ${s}×12, afundos ${s}×10 por perna, elevações de gémeos ${s}×15, nordic curls de isquiotibiais ${s}×6, propriocepção a uma perna ${s}×30 s. ${plus ? "Uma série a mais do que na semana passada — a sobrecarga progressiva vale também para o reforço." : "Carga mantida esta semana (assimilação)."}`,
    renfoWhy: "A prevenção de lesões n.º 1, e um ganho direto de economia de passada. Periodiza-se como a corrida: fundações, depois força útil, e simples manutenção à medida que o dia D se aproxima.",

    recupTitre: "Recuperação",
    recupDetail: (e, k) => `Aquecimento ${e} min muito suave FC Z1 → Parte principal: 25 min em Z1 muito fácil, guiado pela FREQUÊNCIA CARDÍACA (sem ritmo a cumprir) → Retorno à calma ${k} min FC Z1. Ou descanso completo se te souber melhor.`,
    recupWhyDejaDur: "Já fizeste hoje uma sessão exigente: não duplicamos. O progresso joga-se na recuperação.",
    recupWhyRouge: (m) => `Hoje o teu corpo pede recuperação: ${m}. Adiar uma sessão dura 24 h não custa nada; forçá-la custa semanas.`,
    allegeeDetailSuffixe: "\n\n⚠️ Versão ALIVIADA hoje: reduz a parte principal em cerca de um terço.",
    allegeeWhy: (m) => `Sessão mantida mas encurtada: ${m}.`,

    suffixeSoir: " (tarde)",
    whySoir: " Dia duplicado: a saída principal fica ao fim do dia.",
    matinTitre: "Corrida da manhã",
    matinWhy: "Segunda saída do dia: o mesmo volume que de uma só vez, melhor absorvido. Em termos de fadiga é volume grátis, desde que a corras mesmo devagar.",

    tags: {
      "Course": "Prova", "Objectif": "Objetivo", "Récup": "Recuperação", "Veille de course": "Véspera de prova",
      "Affûtage": "Afinamento", "Repos": "Descanso", "Z1": "Z1", "Z2": "Z2", "Vélo": "Bicicleta", "Long": "Longo",
      "Spécifique": "Ritmo específico", "Progressif": "Progressivo", "Qualité": "Qualidade", "Allégée": "Aliviada",
      "Endurance": "Resistência", "Renfo": "Reforço", "Prévention": "Prevenção", "VMA": "VAM", "Seuil": "Limiar",
      "Soir": "Tarde", "Matin": "Manhã",
    },
    tagKm: (km) => `${km} km`,
  },
};
