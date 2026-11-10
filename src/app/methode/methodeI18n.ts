// ─────────────────────────────────────────────────────────────────────────────
//  « COMMENT PACEVO CALCULE » — la méthode, dite telle qu'elle est codée (10/11/2026).
//
//  Pourquoi cette page : Apple (règle 1.4.1) demande aux applications qui touchent à la santé
//  de dire leurs données et leur méthode ; et un coureur qui confie son entraînement doit
//  pouvoir vérifier d'où vient chaque chiffre.
//
//  RÈGLE D'ÉCRITURE (deux relectures l'ont imposée) : chaque phrase de MÉCANISME est ancrée à la
//  ligne de code qui la calcule — pas seulement ses chiffres. Exemples corrigés : le ratio de
//  charge est fatigue (7 j) / forme (42 j) en moyennes exponentielles, pas « 7 jours contre
//  4 semaines » ; les allures d'entraînement ne viennent PAS de Daniels (seules les prédictions) ;
//  la FC max est la PLUS HAUTE entre déclarée et mesurée, pas un ordre de priorité. Un changement
//  du moteur se reporte ICI ; tests/methode relit le code pour les chiffres ET les définitions.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type Rubrique = { id: string; titre: string; paras: string[]; points?: string[] };
export type PageMethode = {
  metaTitle: string; metaDesc: string; surtitre: string; titre: string; chapo: string;
  rubriques: Rubrique[]; sourcesTitre: string; sourcesAide: string; maj: string; avertissement: string; cta: string;
};

/** Les travaux sur lesquels reposent les calculs, et ceux qui en discutent les limites (titres d'origine). */
export const SOURCES: string[] = [
  "Daniels J., Gilbert J. (1979). Oxygen Power: Performance Tables for Distance Runners.",
  "Vickers A. J., Vertosick E. A. (2016). An empirical study of race times in recreational endurance runners. BMC Sports Science, Medicine and Rehabilitation.",
  "Banister E. W. et al. (1975). A systems model of training for athletic performance. Australian Journal of Sports Medicine.",
  "Allen H., Coggan A. (2006). Training and Racing with a Power Meter.",
  "Karvonen M. J., Kentala E., Mustala O. (1957). The effects of training on heart rate: a longitudinal study. Annales Medicinae Experimentalis et Biologiae Fenniae.",
  "Gabbett T. J. (2016). The training–injury prevention paradox: should athletes be training smarter and harder? British Journal of Sports Medicine.",
  "Impellizzeri F. M. et al. (2020). Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. International Journal of Sports Physiology and Performance.",
  "Hooper S. L., Mackinnon L. T. (1995). Monitoring overtraining in athletes. Recommendations. Sports Medicine.",
  "McLean B. D. et al. (2010). Neuromuscular, endocrine, and perceptual fatigue responses during different length between-match microcycles in professional rugby league players. International Journal of Sports Physiology and Performance.",
];

export const METHODE: Record<Lang, PageMethode> = {
  fr: {
    metaTitle: "Comment Pacevo calcule ton plan · Pacevo",
    metaDesc: "VMA, allures, zones cardiaques, charge, fraîcheur, santé : d'où vient chaque chiffre de ton plan, et ce que l'IA fait ou ne fait pas.",
    surtitre: "Méthode",
    titre: "Comment Pacevo calcule ton plan",
    chapo: "Chaque séance de ton plan vient de règles écrites et vérifiables, appliquées à tes propres données. Voici lesquelles, sans rien cacher.",
    rubriques: [
      { id: "principe", titre: "Le principe : des règles, pas une boîte noire", paras: [
        "Ton plan des 7 prochains jours est construit par un moteur de règles, sans intelligence artificielle : mêmes données, mêmes règles, et chaque séance porte son « pourquoi ». La météo prévue fait partie des données.",
        "Il est recalculé quand une nouvelle séance arrive de ta montre (par intervals.icu, au plus toutes les 10 minutes) et chaque nuit, pour tenir compte de ton sommeil, de ta récupération et de ce que tu as vraiment couru.",
      ] },
      { id: "vma", titre: "Ta VMA", paras: [
        "La VMA (vitesse maximale aérobie) sert de base à tes allures. La seule valeur mesurée est celle du test de 6 minutes : courir le plus loin possible en 6 minutes. Elle a toujours la priorité.",
        "Sans test, Pacevo l'estime à partir de tes meilleurs efforts, de tes séances et de la VO2max donnée par ta montre, et retient la plus haute de ces estimations : un effort couru sans être maximal ne peut que sous-estimer ta VMA. La VO2max de la montre est elle-même une estimation, d'où la priorité au test. Ta première séance est donc le test, sauf en programme de marche-course ou si ton questionnaire d'aptitude attend l'avis d'un médecin.",
      ] },
      { id: "allures", titre: "Tes allures et tes prédictions de course", paras: [
        "Les temps prédits sur 5 km, 10 km, semi-marathon et marathon viennent du modèle de Daniels et Gilbert : le coût en oxygène de chaque vitesse, et la part de ta VO2max que tu peux tenir selon la durée de l'effort. Au-delà du semi-marathon, la prédiction devient plus prudente si ta plus longue sortie récente ou ton volume de la semaine sont encore justes pour la distance.",
        "Les allures d'entraînement viennent d'ailleurs : l'allure seuil d'un test de lactate si tu en as fait un, sinon de ta vitesse critique calculée sur tes efforts, sinon d'un pourcentage de ta VMA ; les séances de qualité, d'un pourcentage de ta VMA ; le footing, de l'allure à laquelle tu cours vraiment en endurance, mesurée par ta fréquence cardiaque quand ta montre la donne.",
      ] },
      { id: "fc", titre: "Tes zones cardiaques", paras: [
        "Ta fréquence cardiaque maximale est la plus haute entre ce que tu as déclaré et ce que ta montre a mesuré (une valeur sous 150 battements est écartée : c'est un capteur qui décroche). Sans l'une ni l'autre, elle se déduit de ton seuil mesuré, et seulement en dernier recours de ton âge.",
        "Sous le seuil, avec ta fréquence cardiaque de repos, les zones utilisent ta réserve cardiaque (méthode de Karvonen) ; sans fréquence de repos, un pourcentage de ta FC max. Au seuil et au-dessus, c'est ton seuil mesuré qui sert. Sans aucune référence, Pacevo ne te donne pas de cible cardiaque.",
      ] },
      { id: "charge", titre: "Ta charge et ta fraîcheur", paras: [
        "Chaque séance a une charge. Ta forme est une moyenne de ta charge qui pèse davantage les jours récents, sur une constante de 42 jours ; ta fatigue, la même sur 7 jours ; ta fraîcheur, l'écart entre les deux. C'est l'adaptation courante du modèle de Banister.",
        "Le rapport entre ta fatigue (7 jours) et ta forme (42 jours) signale une montée de charge trop rapide : au-dessus de 1,5 il colore le feu en orange, au-dessus de 1,8 en rouge (orange seulement si ta VFC, ton sommeil et l'absence de douleur disent que tu es frais). C'est un repère de progressivité, pas un prédicteur de blessure : sa valeur prédictive est discutée dans la littérature.",
      ] },
      { id: "feu", titre: "Le feu du jour", paras: ["Chaque matin, un feu (vert, jaune, orange, rouge) résume ce qui pèse sur ta séance. Il s'appuie sur :"],
        points: [
          "une douleur que tu as déclarée (rouge) ;",
          "une chute de ta variabilité cardiaque (VFC) par rapport à TA zone habituelle, et une dette de sommeil mesurée par rapport à TA médiane, pas à une norme de 8 heures ;",
          "une montée de charge trop rapide, une semaine trop monotone, un ressenti très élevé à tes dernières séances ;",
          "ton bilan du matin, s'il est franc (fatigue ou jambes à 4 ou 5 sur 5) : la séance dure du jour devient facile, le reste de la semaine ne bouge pas.",
        ] },
      { id: "semaine", titre: "Comment ta semaine est construite", paras: ["Le moteur pose d'abord ta course s'il y en a une, puis la sortie longue, les jours de repos, les séances de qualité, les footings et le renforcement. Ses règles :"],
        points: [
          "ton volume de référence est la médiane de tes semaines réellement courues (fenêtres de 7 jours sur 8 semaines, dès 3 semaines courues), pas une moyenne qu'une coupure écraserait ;",
          "le volume monte de 10 % par semaine au plus (5 % la première année de course ou après une fracture de fatigue), moins si ta charge monte déjà vite ;",
          "une semaine sur quatre est allégée de 20 %, et l'affûtage avant une course dépend de sa distance ;",
          "avec un objectif de course, la sortie longue se déduit de la distance visée et monte de 2 km par semaine au plus depuis ta plus longue sortie réelle ; elle ne dépasse pas la moitié de ton volume, sauf si tu cours déjà plus long ;",
          "jusqu'à 1, 2 ou 3 séances de qualité selon le nombre de sorties par semaine (moins si la fatigue, le volume ou l'affûtage l'imposent), séparées de 48 à 96 heures selon ton âge, y compris par rapport à ta dernière séance dure déjà courue.",
        ] },
      { id: "sante", titre: "Ta santé passe avant ton objectif", paras: ["Pacevo ne pose aucun diagnostic et ne propose aucun soin. Il ajuste ta charge d'entraînement à ce que tu déclares :"],
        points: [
          "une douleur à 4 sur 10 ou plus retire une séance de qualité de ta semaine et rend facile la séance dure du jour, le temps qu'elle passe ; l'écran te dit de consulter si elle dure ou s'aggrave ;",
          "les consignes de ton kinésithérapeute (durée maximale, nombre de sorties, pas d'intensité) sont appliquées à chaque séance jusqu'à la date indiquée ;",
          "le questionnaire d'aptitude : si tu signales une situation à faire voir à un médecin, ton plan ne contient plus aucune sortie de course à pied jusqu'à ce que tu déclares son avis.",
        ] },
      { id: "ia", titre: "Ce que fait l'IA, et ce qu'elle ne fait pas", paras: [
        "Un modèle de langage (Gemini, de Google) n'intervient que pour écrire ou répondre : l'analyse de tes séances ; pour les abonnés Premium, le bilan de la semaine et les conseils des séances clés ; des propositions d'ajustement que tu acceptes ou non ; les réponses à tes questions dans les cours ; l'assistant d'aide.",
        "Il ne décide jamais de ton plan, de tes allures ni de tes zones. Une proposition d'ajustement passe des garde-fous avant de t'être montrée (le jour existe dans ton plan, pas deux séances dures d'affilée, aucune intensité ajoutée quand ta fatigue l'interdit).",
        "Seule exception, quand ton plan n'a encore aucune séance pour aujourd'hui : le tableau de bord te propose une séance indicative, rédigée par l'IA ou calculée, qui n'entre pas dans ton plan. Pendant l'attente de l'avis d'un médecin (questionnaire d'aptitude), l'IA ne propose aucun entraînement.",
      ] },
      { id: "limites", titre: "Ce que Pacevo ne sait pas", paras: [
        "Quand une référence manque, Pacevo ne la remplace pas par un chiffre affiché comme une mesure : sans fréquence cardiaque de référence, pas de cible cardiaque. Une semaine où tu n'as presque pas couru (moins de 2 km) n'abaisse pas ton volume de référence.",
        "Toutes tes données de montre passent par intervals.icu : ce que ta montre n'y envoie pas, Pacevo ne le voit pas.",
      ] },
    ],
    sourcesTitre: "Sur quoi reposent ces calculs",
    sourcesAide: "Les travaux d'origine et ceux qui en discutent les limites, cités tels qu'ils ont été publiés.",
    maj: "Page tenue à jour avec le moteur du coach.",
    avertissement: "Pacevo est un outil d'entraînement, pas un dispositif médical : il ne diagnostique, ne traite ni ne prévient aucune maladie. Avant de commencer ou en cas de doute sur ta santé, consulte un médecin. Urgence : 15 ou 112.",
    cta: "Essayer Pacevo",
  },
  en: {
    metaTitle: "How Pacevo builds your plan · Pacevo",
    metaDesc: "Maximal aerobic speed, paces, heart-rate zones, load, freshness, health: where every figure in your plan comes from, and what AI does or doesn't do.",
    surtitre: "Method",
    titre: "How Pacevo builds your plan",
    chapo: "Every session in your plan comes from written, checkable rules applied to your own data. Here they are, with nothing hidden.",
    rubriques: [
      { id: "principe", titre: "The principle: rules, not a black box", paras: [
        "Your plan for the next 7 days is built by a rules engine, without artificial intelligence: same data, same rules, and every session carries its \"why\". The weather forecast is part of the data.",
        "It is recalculated when a new session arrives from your watch (through intervals.icu, at most every 10 minutes) and every night, to take your sleep, your recovery and what you actually ran into account.",
      ] },
      { id: "vma", titre: "Your maximal aerobic speed (MAS)", paras: [
        "Your MAS is the basis of your paces. The only measured value comes from the 6-minute test: run as far as you can in 6 minutes. It always takes priority.",
        "Without a test, Pacevo estimates it from your best efforts, your sessions and the VO2max given by your watch, and keeps the highest of these estimates: an effort that was not maximal can only underestimate your MAS. The watch's VO2max is itself an estimate, hence the priority given to the test. Your first session is therefore the test, except in the walk-run programme or if your fitness questionnaire is waiting for a doctor's opinion.",
      ] },
      { id: "allures", titre: "Your paces and race predictions", paras: [
        "Predicted times for 5 km, 10 km, half marathon and marathon come from the Daniels and Gilbert model: the oxygen cost of each speed, and the share of your VO2max you can hold depending on how long the effort lasts. Beyond the half marathon, the prediction becomes more cautious if your longest recent run or your weekly volume are still short for the distance.",
        "Training paces come from elsewhere: threshold pace from a lactate test if you have done one, otherwise from your critical speed calculated on your efforts, otherwise from a percentage of your MAS; quality sessions from a percentage of your MAS; easy runs from the pace you actually run at in your endurance zone, measured by your heart rate when your watch provides it.",
      ] },
      { id: "fc", titre: "Your heart-rate zones", paras: [
        "Your maximum heart rate is the higher of what you declared and what your watch measured (a value under 150 bpm is discarded: it is a sensor dropping out). Without either, it is derived from your measured threshold, and only as a last resort from your age.",
        "Below threshold, with your resting heart rate, zones use your heart-rate reserve (Karvonen method); without a resting heart rate, a percentage of your maximum. At threshold and above, your measured threshold is used. With no reference at all, Pacevo gives you no heart-rate target.",
      ] },
      { id: "charge", titre: "Your load and freshness", paras: [
        "Every session has a load. Your fitness is an average of your load that weighs recent days more, with a 42-day constant; your fatigue, the same over 7 days; your freshness, the gap between the two. This is the common adaptation of the Banister model.",
        "The ratio between your fatigue (7 days) and your fitness (42 days) flags a load that is rising too fast: above 1.5 it turns the light orange, above 1.8 red (only orange if your HRV, your sleep and the absence of pain say you are fresh). It is a guide to gradual progression, not an injury predictor: its predictive value is debated in the literature.",
      ] },
      { id: "feu", titre: "Today's light", paras: ["Every morning, a light (green, yellow, orange, red) sums up what weighs on your session. It relies on:"],
        points: [
          "a pain you have reported (red);",
          "a drop in your heart-rate variability (HRV) compared with YOUR usual range, and a sleep debt measured against YOUR median, not an 8-hour norm;",
          "a load that rises too fast, a week that is too monotonous, a very high perceived effort in your last sessions;",
          "your morning check-in, when it is clear-cut (fatigue or legs at 4 or 5 out of 5): today's hard session becomes easy, the rest of the week does not change.",
        ] },
      { id: "semaine", titre: "How your week is built", paras: ["The engine first places your race if there is one, then the long run, rest days, quality sessions, easy runs and strength work. Its rules:"],
        points: [
          "your reference volume is the median of the weeks you actually ran (7-day windows over 8 weeks, from 3 weeks run), not an average that a break would crush;",
          "volume rises by 10% a week at most (5% in your first year of running or after a stress fracture), less if your load is already rising fast;",
          "one week in four is lightened by 20%, and the taper before a race depends on its distance;",
          "with a race goal, the long run is derived from the target distance and grows by 2 km a week at most from your longest real run; it does not exceed half your volume, unless you already run longer;",
          "up to 1, 2 or 3 quality sessions depending on how many runs you do a week (fewer if fatigue, volume or the taper require it), 48 to 96 hours apart depending on your age, including from your last hard session already run.",
        ] },
      { id: "sante", titre: "Your health comes before your goal", paras: ["Pacevo makes no diagnosis and offers no treatment. It adjusts your training load to what you report:"],
        points: [
          "a pain at 4 out of 10 or more removes one quality session from your week and makes today's hard session easy, while it lasts; the screen tells you to see someone if it lasts or gets worse;",
          "your physiotherapist's instructions (maximum duration, number of runs, no intensity) are applied to every session until the date you set;",
          "the fitness questionnaire: if you report something a doctor should look at, your plan has no running at all until you declare their opinion.",
        ] },
      { id: "ia", titre: "What AI does, and what it doesn't", paras: [
        "A language model (Google's Gemini) is only used to write or answer: the analysis of your sessions; for Premium members, the weekly review and the key-session advice; adjustment suggestions that you accept or not; answers to your questions in the lessons; the help assistant.",
        "It never decides your plan, your paces or your zones. An adjustment suggestion goes through safeguards before it is shown to you (the day exists in your plan, no two hard sessions in a row, no intensity added when your fatigue rules it out).",
        "One exception, when your plan has no session for today yet: the dashboard suggests an indicative session, written by the AI or calculated, which does not enter your plan. While a doctor's opinion is pending (fitness questionnaire), the AI suggests no training.",
      ] },
      { id: "limites", titre: "What Pacevo doesn't know", paras: [
        "When a reference is missing, Pacevo does not replace it with a figure shown as a measurement: without a heart-rate reference, no heart-rate target. A week in which you barely ran (under 2 km) does not lower your reference volume.",
        "All your watch data goes through intervals.icu: what your watch does not send there, Pacevo cannot see.",
      ] },
    ],
    sourcesTitre: "What these calculations rest on",
    sourcesAide: "The original work and the work that discusses its limits, cited as published.",
    maj: "This page is kept up to date with the coach engine.",
    avertissement: "Pacevo is a training tool, not a medical device: it does not diagnose, treat, cure or prevent any medical condition. Before starting, or if you have any doubt about your health, see a doctor. Emergency: 112.",
    cta: "Try Pacevo",
  },
  de: {
    metaTitle: "Wie Pacevo deinen Plan berechnet · Pacevo",
    metaDesc: "Maximale aerobe Geschwindigkeit, Tempi, Herzfrequenzzonen, Belastung, Frische, Gesundheit: woher jede Zahl in deinem Plan kommt und was die KI tut oder nicht tut.",
    surtitre: "Methode",
    titre: "Wie Pacevo deinen Plan berechnet",
    chapo: "Jede Einheit deines Plans entsteht aus festgeschriebenen, überprüfbaren Regeln, angewendet auf deine eigenen Daten. Hier sind sie, ohne Geheimnisse.",
    rubriques: [
      { id: "principe", titre: "Das Prinzip: Regeln statt Blackbox", paras: [
        "Dein Plan für die nächsten 7 Tage wird von einer Regel-Engine erstellt, ohne künstliche Intelligenz: gleiche Daten, gleiche Regeln, und jede Einheit nennt ihr „Warum“. Die Wettervorhersage gehört zu den Daten.",
        "Er wird neu berechnet, wenn eine neue Einheit von deiner Uhr ankommt (über intervals.icu, höchstens alle 10 Minuten), und jede Nacht, um deinen Schlaf, deine Erholung und das tatsächlich Gelaufene zu berücksichtigen.",
      ] },
      { id: "vma", titre: "Deine maximale aerobe Geschwindigkeit (VMA)", paras: [
        "Die VMA ist die Grundlage deiner Tempi. Der einzige gemessene Wert stammt aus dem 6-Minuten-Test: so weit wie möglich in 6 Minuten laufen. Er hat immer Vorrang.",
        "Ohne Test schätzt Pacevo sie aus deinen besten Leistungen, deinen Einheiten und der VO2max deiner Uhr und nimmt die höchste dieser Schätzungen: Eine nicht maximale Anstrengung kann deine VMA nur unterschätzen. Die VO2max der Uhr ist selbst eine Schätzung, daher der Vorrang des Tests. Deine erste Einheit ist daher der Test, außer im Geh-Lauf-Programm oder wenn dein Fitness-Fragebogen auf eine ärztliche Einschätzung wartet.",
      ] },
      { id: "allures", titre: "Deine Tempi und Wettkampfprognosen", paras: [
        "Die prognostizierten Zeiten über 5 km, 10 km, Halbmarathon und Marathon stammen aus dem Modell von Daniels und Gilbert: der Sauerstoffbedarf jeder Geschwindigkeit und der Anteil deiner VO2max, den du je nach Dauer halten kannst. Jenseits des Halbmarathons wird die Prognose vorsichtiger, wenn dein längster Lauf oder dein Wochenumfang für die Distanz noch knapp sind.",
        "Die Trainingstempi kommen von anderswo: das Schwellentempo aus einem Laktattest, falls du einen gemacht hast, sonst aus deiner kritischen Geschwindigkeit, berechnet aus deinen Leistungen, sonst aus einem Prozentsatz deiner VMA; Qualitätseinheiten aus einem Prozentsatz deiner VMA; lockere Läufe aus dem Tempo, das du im Ausdauerbereich tatsächlich läufst, gemessen an deiner Herzfrequenz, wenn deine Uhr sie liefert.",
      ] },
      { id: "fc", titre: "Deine Herzfrequenzzonen", paras: [
        "Deine maximale Herzfrequenz ist der höhere Wert aus deiner Angabe und der Messung deiner Uhr (ein Wert unter 150 Schlägen wird verworfen: Das ist ein aussetzender Sensor). Ohne beides wird sie aus deiner gemessenen Schwelle abgeleitet und erst zuletzt aus deinem Alter.",
        "Unterhalb der Schwelle nutzen die Zonen mit deinem Ruhepuls deine Herzfrequenzreserve (Karvonen-Methode); ohne Ruhepuls einen Prozentsatz deines Maximums. An und über der Schwelle gilt deine gemessene Schwelle. Ohne jede Referenz gibt Pacevo dir kein Herzfrequenzziel.",
      ] },
      { id: "charge", titre: "Deine Belastung und Frische", paras: [
        "Jede Einheit hat eine Belastung. Deine Form ist ein Mittelwert deiner Belastung, der die letzten Tage stärker gewichtet, mit einer Konstante von 42 Tagen; deine Ermüdung dasselbe über 7 Tage; deine Frische der Unterschied zwischen beiden. Das ist die gängige Anpassung des Banister-Modells.",
        "Das Verhältnis zwischen deiner Ermüdung (7 Tage) und deiner Form (42 Tage) zeigt einen zu schnellen Belastungsanstieg: über 1,5 färbt es die Ampel orange, über 1,8 rot (nur orange, wenn HRV, Schlaf und Schmerzfreiheit sagen, dass du frisch bist). Es ist ein Richtwert für schrittweise Steigerung, kein Verletzungsprädiktor: Sein Vorhersagewert ist in der Literatur umstritten.",
      ] },
      { id: "feu", titre: "Die Ampel des Tages", paras: ["Jeden Morgen fasst eine Ampel (grün, gelb, orange, rot) zusammen, was auf deiner Einheit lastet. Sie stützt sich auf:"],
        points: [
          "einen gemeldeten Schmerz (rot);",
          "einen Abfall deiner Herzfrequenzvariabilität (HRV) gegenüber DEINEM üblichen Bereich und ein Schlafdefizit gemessen an DEINEM Median, nicht an einer 8-Stunden-Norm;",
          "einen zu schnellen Belastungsanstieg, eine zu monotone Woche, ein sehr hohes Belastungsempfinden in den letzten Einheiten;",
          "deinen Morgen-Check, wenn er eindeutig ist (Müdigkeit oder Beine bei 4 oder 5 von 5): Die harte Einheit des Tages wird locker, der Rest der Woche bleibt.",
        ] },
      { id: "semaine", titre: "So wird deine Woche aufgebaut", paras: ["Die Engine setzt zuerst deinen Wettkampf, falls es einen gibt, dann den langen Lauf, Ruhetage, Qualitätseinheiten, lockere Läufe und Krafttraining. Ihre Regeln:"],
        points: [
          "dein Referenzumfang ist der Median deiner tatsächlich gelaufenen Wochen (7-Tage-Fenster über 8 Wochen, ab 3 gelaufenen Wochen), kein Durchschnitt, den eine Pause zerdrückt;",
          "der Umfang steigt höchstens um 10 % pro Woche (5 % im ersten Laufjahr oder nach einer Ermüdungsfraktur), weniger, wenn deine Belastung schon schnell steigt;",
          "jede vierte Woche wird um 20 % erleichtert, und das Tapering vor einem Wettkampf hängt von dessen Distanz ab;",
          "mit einem Wettkampfziel leitet sich der lange Lauf aus der Zieldistanz ab und wächst höchstens um 2 km pro Woche ab deinem längsten echten Lauf; er übersteigt nicht die Hälfte deines Umfangs, außer du läufst schon länger;",
          "bis zu 1, 2 oder 3 Qualitätseinheiten je nach Anzahl deiner Läufe pro Woche (weniger, wenn Ermüdung, Umfang oder Tapering es verlangen), je nach Alter 48 bis 96 Stunden auseinander, auch zur letzten bereits gelaufenen harten Einheit.",
        ] },
      { id: "sante", titre: "Deine Gesundheit geht vor deinem Ziel", paras: ["Pacevo stellt keine Diagnose und bietet keine Behandlung an. Es passt deine Trainingsbelastung an deine Angaben an:"],
        points: [
          "ein Schmerz ab 4 von 10 streicht eine Qualitätseinheit aus deiner Woche und macht die harte Einheit des Tages locker, solange er anhält; der Bildschirm rät dir zum Arzt, wenn er bleibt oder schlimmer wird;",
          "die Vorgaben deiner Physiotherapie (maximale Dauer, Anzahl der Läufe, keine Intensität) gelten für jede Einheit bis zum gewählten Datum;",
          "der Fitness-Fragebogen: Meldest du etwas, das ärztlich abgeklärt werden sollte, enthält dein Plan kein Laufen mehr, bis du die ärztliche Einschätzung angibst.",
        ] },
      { id: "ia", titre: "Was die KI tut und was nicht", paras: [
        "Ein Sprachmodell (Gemini von Google) wird nur zum Schreiben oder Antworten eingesetzt: die Analyse deiner Einheiten; für Premium-Mitglieder der Wochenrückblick und die Tipps zu Schlüsseleinheiten; Anpassungsvorschläge, die du annimmst oder nicht; Antworten auf deine Fragen in den Kursen; der Hilfe-Assistent.",
        "Es entscheidet nie über deinen Plan, deine Tempi oder Zonen. Ein Anpassungsvorschlag durchläuft Schutzregeln, bevor du ihn siehst (der Tag existiert in deinem Plan, keine zwei harten Einheiten hintereinander, keine zusätzliche Intensität, wenn deine Ermüdung sie ausschließt).",
        "Einzige Ausnahme, wenn dein Plan für heute noch keine Einheit hat: Das Dashboard schlägt eine unverbindliche Einheit vor, von der KI geschrieben oder berechnet, die nicht in deinen Plan eingeht. Solange eine ärztliche Einschätzung aussteht (Fitness-Fragebogen), schlägt die KI kein Training vor.",
      ] },
      { id: "limites", titre: "Was Pacevo nicht weiß", paras: [
        "Fehlt eine Referenz, ersetzt Pacevo sie nicht durch eine Zahl, die wie eine Messung aussieht: ohne Herzfrequenzreferenz kein Herzfrequenzziel. Eine Woche, in der du kaum gelaufen bist (unter 2 km), senkt deinen Referenzumfang nicht.",
        "Alle Daten deiner Uhr laufen über intervals.icu: Was deine Uhr dort nicht hinschickt, sieht Pacevo nicht.",
      ] },
    ],
    sourcesTitre: "Worauf diese Berechnungen beruhen",
    sourcesAide: "Die Originalarbeiten und Arbeiten, die ihre Grenzen diskutieren, so zitiert, wie sie veröffentlicht wurden.",
    maj: "Diese Seite wird mit der Coach-Engine aktuell gehalten.",
    avertissement: "Pacevo ist ein Trainingswerkzeug, kein Medizinprodukt: Es diagnostiziert, behandelt, heilt oder verhindert keine Krankheit. Vor dem Start oder bei Zweifeln an deiner Gesundheit: zum Arzt. Notfall: 112.",
    cta: "Pacevo testen",
  },
  es: {
    metaTitle: "Cómo calcula Pacevo tu plan · Pacevo",
    metaDesc: "VAM, ritmos, zonas cardíacas, carga, frescura, salud: de dónde sale cada cifra de tu plan y qué hace o no hace la IA.",
    surtitre: "Método",
    titre: "Cómo calcula Pacevo tu plan",
    chapo: "Cada sesión de tu plan sale de reglas escritas y verificables, aplicadas a tus propios datos. Aquí están, sin ocultar nada.",
    rubriques: [
      { id: "principe", titre: "El principio: reglas, no una caja negra", paras: [
        "Tu plan de los próximos 7 días lo construye un motor de reglas, sin inteligencia artificial: mismos datos, mismas reglas, y cada sesión lleva su «porqué». La previsión del tiempo forma parte de los datos.",
        "Se recalcula cuando llega una sesión nueva de tu reloj (a través de intervals.icu, como mucho cada 10 minutos) y cada noche, para tener en cuenta tu sueño, tu recuperación y lo que realmente has corrido.",
      ] },
      { id: "vma", titre: "Tu VAM (velocidad aeróbica máxima)", paras: [
        "La VAM es la base de tus ritmos. El único valor medido es el del test de 6 minutos: correr lo más lejos posible en 6 minutos. Siempre tiene prioridad.",
        "Sin test, Pacevo la estima a partir de tus mejores esfuerzos, tus sesiones y el VO2máx de tu reloj, y se queda con la más alta de estas estimaciones: un esfuerzo que no fue máximo solo puede subestimar tu VAM. El VO2máx del reloj es a su vez una estimación, de ahí la prioridad del test. Por eso tu primera sesión es el test, salvo en el programa de andar-correr o si tu cuestionario de aptitud espera la opinión de un médico.",
      ] },
      { id: "allures", titre: "Tus ritmos y tus predicciones de carrera", paras: [
        "Los tiempos previstos en 5 km, 10 km, media maratón y maratón vienen del modelo de Daniels y Gilbert: el coste en oxígeno de cada velocidad y la parte de tu VO2máx que puedes mantener según la duración del esfuerzo. Más allá de la media maratón, la predicción se vuelve más prudente si tu salida más larga reciente o tu volumen semanal aún son justos para la distancia.",
        "Los ritmos de entrenamiento vienen de otro sitio: el ritmo umbral de un test de lactato si lo has hecho, si no de tu velocidad crítica calculada con tus esfuerzos, si no de un porcentaje de tu VAM; las sesiones de calidad, de un porcentaje de tu VAM; el rodaje, del ritmo al que realmente corres en resistencia, medido por tu frecuencia cardíaca cuando tu reloj la da.",
      ] },
      { id: "fc", titre: "Tus zonas cardíacas", paras: [
        "Tu frecuencia cardíaca máxima es la más alta entre lo que declaraste y lo que midió tu reloj (un valor por debajo de 150 latidos se descarta: es un sensor que falla). Sin ninguno de los dos, se deduce de tu umbral medido y, solo en último recurso, de tu edad.",
        "Por debajo del umbral, con tu frecuencia cardíaca en reposo, las zonas usan tu reserva cardíaca (método de Karvonen); sin frecuencia en reposo, un porcentaje de tu máxima. En el umbral y por encima, se usa tu umbral medido. Sin ninguna referencia, Pacevo no te da objetivo cardíaco.",
      ] },
      { id: "charge", titre: "Tu carga y tu frescura", paras: [
        "Cada sesión tiene una carga. Tu forma es una media de tu carga que pesa más los días recientes, con una constante de 42 días; tu fatiga, lo mismo en 7 días; tu frescura, la diferencia entre ambas. Es la adaptación habitual del modelo de Banister.",
        "La relación entre tu fatiga (7 días) y tu forma (42 días) señala una subida de carga demasiado rápida: por encima de 1,5 pone el semáforo en naranja, por encima de 1,8 en rojo (solo naranja si tu VFC, tu sueño y la ausencia de dolor dicen que estás fresco). Es una referencia de progresión, no un predictor de lesiones: su valor predictivo se discute en la literatura.",
      ] },
      { id: "feu", titre: "El semáforo del día", paras: ["Cada mañana, un semáforo (verde, amarillo, naranja, rojo) resume lo que pesa sobre tu sesión. Se basa en:"],
        points: [
          "un dolor que hayas declarado (rojo);",
          "una caída de tu variabilidad cardíaca (VFC) respecto a TU zona habitual, y una deuda de sueño medida respecto a TU mediana, no a una norma de 8 horas;",
          "una subida de carga demasiado rápida, una semana demasiado monótona, una sensación de esfuerzo muy alta en tus últimas sesiones;",
          "tu chequeo matinal, si es claro (cansancio o piernas en 4 o 5 sobre 5): la sesión dura del día pasa a ser suave, el resto de la semana no cambia.",
        ] },
      { id: "semaine", titre: "Cómo se construye tu semana", paras: ["El motor coloca primero tu carrera si la hay, luego la tirada larga, los días de descanso, las sesiones de calidad, los rodajes y la fuerza. Sus reglas:"],
        points: [
          "tu volumen de referencia es la mediana de las semanas que realmente corriste (ventanas de 7 días en 8 semanas, desde 3 semanas corridas), no una media que un parón aplastaría;",
          "el volumen sube un 10 % por semana como máximo (5 % el primer año de carrera o tras una fractura por estrés), menos si tu carga ya sube rápido;",
          "una semana de cada cuatro se aligera un 20 %, y la puesta a punto antes de una carrera depende de su distancia;",
          "con un objetivo de carrera, la tirada larga se deduce de la distancia objetivo y sube 2 km por semana como máximo desde tu tirada real más larga; no supera la mitad de tu volumen, salvo si ya corres más largo;",
          "hasta 1, 2 o 3 sesiones de calidad según tus salidas por semana (menos si la fatiga, el volumen o la puesta a punto lo imponen), separadas de 48 a 96 horas según tu edad, también respecto a tu última sesión dura ya corrida.",
        ] },
      { id: "sante", titre: "Tu salud va antes que tu objetivo", paras: ["Pacevo no hace ningún diagnóstico ni propone ningún tratamiento. Ajusta tu carga de entrenamiento a lo que declaras:"],
        points: [
          "un dolor de 4 sobre 10 o más quita una sesión de calidad de tu semana y hace suave la sesión dura del día, mientras dure; la pantalla te dice que consultes si persiste o empeora;",
          "las indicaciones de tu fisioterapeuta (duración máxima, número de salidas, sin intensidad) se aplican a cada sesión hasta la fecha indicada;",
          "el cuestionario de aptitud: si señalas algo que debe ver un médico, tu plan ya no tiene ninguna salida de carrera hasta que declares su opinión.",
        ] },
      { id: "ia", titre: "Lo que hace la IA, y lo que no hace", paras: [
        "Un modelo de lenguaje (Gemini, de Google) solo interviene para escribir o responder: el análisis de tus sesiones; para los suscriptores Premium, el balance de la semana y los consejos de las sesiones clave; propuestas de ajuste que aceptas o no; las respuestas a tus preguntas en los cursos; el asistente de ayuda.",
        "Nunca decide tu plan, tus ritmos ni tus zonas. Una propuesta de ajuste pasa unos controles antes de mostrártela (el día existe en tu plan, no dos sesiones duras seguidas, ninguna intensidad añadida cuando tu fatiga la impide).",
        "Única excepción, cuando tu plan aún no tiene sesión para hoy: el panel te propone una sesión orientativa, redactada por la IA o calculada, que no entra en tu plan. Mientras se espera la opinión de un médico (cuestionario de aptitud), la IA no propone ningún entrenamiento.",
      ] },
      { id: "limites", titre: "Lo que Pacevo no sabe", paras: [
        "Cuando falta una referencia, Pacevo no la sustituye por una cifra presentada como una medida: sin referencia cardíaca, no hay objetivo cardíaco. Una semana en la que casi no corriste (menos de 2 km) no baja tu volumen de referencia.",
        "Todos los datos de tu reloj pasan por intervals.icu: lo que tu reloj no envía allí, Pacevo no lo ve.",
      ] },
    ],
    sourcesTitre: "En qué se basan estos cálculos",
    sourcesAide: "Los trabajos originales y los que discuten sus límites, citados tal como se publicaron.",
    maj: "Página mantenida al día con el motor del entrenador.",
    avertissement: "Pacevo es una herramienta de entrenamiento, no un producto sanitario: no diagnostica, trata, cura ni previene ninguna enfermedad. Antes de empezar, o si dudas sobre tu salud, consulta a un médico. Urgencias: 112.",
    cta: "Probar Pacevo",
  },
  pt: {
    metaTitle: "Como o Pacevo calcula o teu plano · Pacevo",
    metaDesc: "VAM, ritmos, zonas cardíacas, carga, frescura, saúde: de onde vem cada número do teu plano e o que a IA faz ou não faz.",
    surtitre: "Método",
    titre: "Como o Pacevo calcula o teu plano",
    chapo: "Cada treino do teu plano vem de regras escritas e verificáveis, aplicadas aos teus próprios dados. Aqui estão, sem esconder nada.",
    rubriques: [
      { id: "principe", titre: "O princípio: regras, não uma caixa negra", paras: [
        "O teu plano dos próximos 7 dias é construído por um motor de regras, sem inteligência artificial: mesmos dados, mesmas regras, e cada treino traz o seu «porquê». A previsão meteorológica faz parte dos dados.",
        "É recalculado quando chega um treino novo do teu relógio (através do intervals.icu, no máximo a cada 10 minutos) e todas as noites, para ter em conta o teu sono, a tua recuperação e o que realmente correste.",
      ] },
      { id: "vma", titre: "A tua VAM (velocidade aeróbia máxima)", paras: [
        "A VAM é a base dos teus ritmos. O único valor medido é o do teste de 6 minutos: correr o mais longe possível em 6 minutos. Tem sempre prioridade.",
        "Sem teste, o Pacevo estima-a a partir dos teus melhores esforços, dos teus treinos e do VO2máx do teu relógio, e fica com a mais alta destas estimativas: um esforço que não foi máximo só pode subestimar a tua VAM. O VO2máx do relógio é ele próprio uma estimativa, daí a prioridade ao teste. Por isso o teu primeiro treino é o teste, exceto no programa de caminhada-corrida ou se o teu questionário de aptidão estiver à espera da opinião de um médico.",
      ] },
      { id: "allures", titre: "Os teus ritmos e previsões de prova", paras: [
        "Os tempos previstos em 5 km, 10 km, meia maratona e maratona vêm do modelo de Daniels e Gilbert: o custo em oxigénio de cada velocidade e a parte do teu VO2máx que consegues manter conforme a duração do esforço. Para lá da meia maratona, a previsão torna-se mais prudente se o teu treino mais longo recente ou o teu volume semanal ainda forem curtos para a distância.",
        "Os ritmos de treino vêm de outro lado: o ritmo de limiar de um teste de lactato se o fizeste, senão da tua velocidade crítica calculada nos teus esforços, senão de uma percentagem da tua VAM; os treinos de qualidade, de uma percentagem da tua VAM; a corrida fácil, do ritmo a que realmente corres em resistência, medido pela tua frequência cardíaca quando o relógio a fornece.",
      ] },
      { id: "fc", titre: "As tuas zonas cardíacas", paras: [
        "A tua frequência cardíaca máxima é a mais alta entre o que declaraste e o que o teu relógio mediu (um valor abaixo de 150 batimentos é descartado: é um sensor que falha). Sem nenhum dos dois, deduz-se do teu limiar medido e, só em último recurso, da tua idade.",
        "Abaixo do limiar, com a tua frequência cardíaca em repouso, as zonas usam a tua reserva cardíaca (método de Karvonen); sem frequência em repouso, uma percentagem da tua máxima. No limiar e acima, usa-se o teu limiar medido. Sem nenhuma referência, o Pacevo não te dá alvo cardíaco.",
      ] },
      { id: "charge", titre: "A tua carga e a tua frescura", paras: [
        "Cada treino tem uma carga. A tua forma é uma média da tua carga que pesa mais os dias recentes, com uma constante de 42 dias; o teu cansaço, o mesmo em 7 dias; a tua frescura, a diferença entre os dois. É a adaptação habitual do modelo de Banister.",
        "A relação entre o teu cansaço (7 dias) e a tua forma (42 dias) assinala uma subida de carga demasiado rápida: acima de 1,5 põe o semáforo em laranja, acima de 1,8 em vermelho (só laranja se a tua VFC, o teu sono e a ausência de dor disserem que estás fresco). É uma referência de progressão, não um preditor de lesões: o seu valor preditivo é discutido na literatura.",
      ] },
      { id: "feu", titre: "O semáforo do dia", paras: ["Todas as manhãs, um semáforo (verde, amarelo, laranja, vermelho) resume o que pesa no teu treino. Baseia-se em:"],
        points: [
          "uma dor que declaraste (vermelho);",
          "uma queda da tua variabilidade cardíaca (VFC) face à TUA zona habitual, e uma dívida de sono medida face à TUA mediana, não a uma norma de 8 horas;",
          "uma subida de carga demasiado rápida, uma semana demasiado monótona, uma sensação de esforço muito alta nos últimos treinos;",
          "o teu check-in da manhã, se for claro (cansaço ou pernas a 4 ou 5 em 5): o treino duro do dia passa a fácil, o resto da semana não muda.",
        ] },
      { id: "semaine", titre: "Como a tua semana é construída", paras: ["O motor coloca primeiro a tua prova, se houver, depois o treino longo, os dias de descanso, os treinos de qualidade, as corridas fáceis e o reforço. As suas regras:"],
        points: [
          "o teu volume de referência é a mediana das semanas que realmente correste (janelas de 7 dias em 8 semanas, a partir de 3 semanas corridas), não uma média que uma paragem esmagaria;",
          "o volume sobe no máximo 10 % por semana (5 % no primeiro ano de corrida ou após uma fratura de stress), menos se a tua carga já estiver a subir depressa;",
          "uma semana em cada quatro é aliviada em 20 %, e o afinamento antes de uma prova depende da distância;",
          "com um objetivo de prova, o treino longo deduz-se da distância visada e sobe no máximo 2 km por semana a partir do teu treino real mais longo; não passa de metade do teu volume, a não ser que já corras mais longo;",
          "até 1, 2 ou 3 treinos de qualidade conforme as corridas por semana (menos se o cansaço, o volume ou o afinamento o impuserem), separados de 48 a 96 horas conforme a idade, também em relação ao teu último treino duro já corrido.",
        ] },
      { id: "sante", titre: "A tua saúde vem antes do teu objetivo", paras: ["O Pacevo não faz nenhum diagnóstico nem propõe nenhum tratamento. Ajusta a tua carga de treino ao que declaras:"],
        points: [
          "uma dor de 4 em 10 ou mais retira um treino de qualidade da tua semana e torna fácil o treino duro do dia, enquanto durar; o ecrã diz-te para consultares se persistir ou piorar;",
          "as indicações do teu fisioterapeuta (duração máxima, número de corridas, sem intensidade) aplicam-se a cada treino até à data indicada;",
          "o questionário de aptidão: se assinalares algo que um médico deve ver, o teu plano deixa de ter qualquer corrida até declarares a opinião dele.",
        ] },
      { id: "ia", titre: "O que a IA faz, e o que não faz", paras: [
        "Um modelo de linguagem (Gemini, da Google) só serve para escrever ou responder: a análise dos teus treinos; para os assinantes Premium, o balanço da semana e os conselhos dos treinos-chave; propostas de ajuste que aceitas ou não; as respostas às tuas perguntas nos cursos; o assistente de ajuda.",
        "Nunca decide o teu plano, os teus ritmos nem as tuas zonas. Uma proposta de ajuste passa por salvaguardas antes de ta mostrarmos (o dia existe no teu plano, não há dois treinos duros seguidos, nenhuma intensidade acrescentada quando o teu cansaço a impede).",
        "Única exceção, quando o teu plano ainda não tem treino para hoje: o painel propõe-te um treino indicativo, escrito pela IA ou calculado, que não entra no teu plano. Enquanto se espera a opinião de um médico (questionário de aptidão), a IA não propõe nenhum treino.",
      ] },
      { id: "limites", titre: "O que o Pacevo não sabe", paras: [
        "Quando falta uma referência, o Pacevo não a substitui por um número apresentado como uma medida: sem referência cardíaca, não há alvo cardíaco. Uma semana em que quase não correste (menos de 2 km) não baixa o teu volume de referência.",
        "Todos os dados do teu relógio passam pelo intervals.icu: o que o teu relógio não envia para lá, o Pacevo não vê.",
      ] },
    ],
    sourcesTitre: "Em que assentam estes cálculos",
    sourcesAide: "Os trabalhos originais e os que discutem os seus limites, citados tal como foram publicados.",
    maj: "Página mantida em dia com o motor do treinador.",
    avertissement: "O Pacevo é uma ferramenta de treino, não um dispositivo médico: não diagnostica, trata, cura nem previne nenhuma doença. Antes de começar, ou se tiveres dúvidas sobre a tua saúde, consulta um médico. Emergência: 112.",
    cta: "Experimentar o Pacevo",
  },
};
