// ─────────────────────────────────────────────────────────────────────────────
//  « COMMENT PACEVO CALCULE » — la méthode, dite telle qu'elle est codée (10/11/2026).
//
//  Pourquoi cette page : Apple (règle 1.4.1) demande aux applications qui touchent à la santé
//  de dire leurs données et leur méthode ; et un coureur qui confie son entraînement doit
//  pouvoir vérifier d'où vient chaque chiffre. RÈGLE D'ÉCRITURE : chaque phrase décrit ce que
//  fait le code AUJOURD'HUI (les chiffres sont ceux de src/lib : 42 et 7 jours pour la charge,
//  1,5 et 1,8 pour le ratio, 48 à 96 h entre deux séances dures, −20 % une semaine sur quatre,
//  +10 % par semaine au plus…). Un changement du moteur se reporte ICI ; tests/methode le
//  surveille pour les chiffres clés.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type Rubrique = { id: string; titre: string; paras: string[]; points?: string[] };
export type PageMethode = {
  metaTitle: string; metaDesc: string; surtitre: string; titre: string; chapo: string;
  rubriques: Rubrique[]; sourcesTitre: string; sourcesAide: string; maj: string; avertissement: string; cta: string;
};

/** Les travaux sur lesquels reposent les calculs (titres d'origine, non traduits). */
export const SOURCES: string[] = [
  "Daniels J., Gilbert J. (1979). Oxygen Power: Performance Tables for Distance Runners.",
  "Banister E. W. et al. (1975). A systems model of training for athletic performance. Australian Journal of Sports Medicine.",
  "Karvonen M. J., Kentala E., Mustala O. (1957). The effects of training on heart rate: a longitudinal study. Annales Medicinae Experimentalis et Biologiae Fenniae.",
  "Gabbett T. J. (2016). The training–injury prevention paradox: should athletes be training smarter and harder? British Journal of Sports Medicine.",
  "Hooper S. L., Mackinnon L. T. (1995). Monitoring overtraining in athletes. Sports Medicine.",
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
        "Ton plan des 7 prochains jours est construit par un moteur de règles, sans intelligence artificielle. Les mêmes données donnent toujours le même plan, et chaque séance porte son « pourquoi ».",
        "Il est recalculé après chaque séance synchronisée depuis ta montre (par intervals.icu) et chaque nuit, pour tenir compte de ton sommeil, de ta récupération et de ce que tu as vraiment couru.",
      ] },
      { id: "vma", titre: "Ta VMA", paras: [
        "La VMA (vitesse maximale aérobie) cale toutes tes allures. La seule valeur mesurée est celle du test de 6 minutes : courir le plus loin possible en 6 minutes. Elle a toujours la priorité.",
        "Sans test, Pacevo l'estime à partir de tes meilleures performances courues et de la VO2max donnée par ta montre, et retient la plus haute des deux : un effort qui n'était pas maximal ne peut que sous-estimer ta VMA. Ta première séance est donc le test, sauf en programme de marche-course ou si ton questionnaire d'aptitude attend l'avis d'un médecin.",
      ] },
      { id: "allures", titre: "Tes allures et tes prédictions de course", paras: [
        "Les allures d'entraînement et les temps prédits sur 5 km, 10 km, semi-marathon et marathon viennent du modèle de Daniels et Gilbert : le coût en oxygène de chaque vitesse, et la part de ta VMA que tu peux tenir selon la durée de l'effort.",
        "Au-delà du semi-marathon, la prédiction est rendue plus prudente si ta plus longue sortie récente ou ton volume de la semaine sont encore justes pour la distance.",
      ] },
      { id: "fc", titre: "Tes zones cardiaques", paras: [
        "Ta fréquence cardiaque maximale vient, dans cet ordre : de ce que tu as déclaré, de la plus haute valeur mesurée par ta montre (une valeur sous 150 battements est écartée, c'est un capteur qui décroche), de ton seuil mesuré, et seulement en dernier recours de ton âge.",
        "Sous le seuil, les zones utilisent ta réserve cardiaque (méthode de Karvonen, avec ta fréquence cardiaque de repos). Au seuil et au-dessus, c'est ton seuil mesuré qui sert. Sans aucune référence, Pacevo ne te donne pas de cible cardiaque plutôt que d'en inventer une.",
      ] },
      { id: "charge", titre: "Ta charge et ta fraîcheur", paras: [
        "Chaque séance a une charge. Ta forme est la moyenne de ta charge sur 42 jours, ta fatigue sur 7 jours, et ta fraîcheur l'écart entre les deux (modèle de Banister).",
        "Le ratio entre ta charge des 7 derniers jours et celle des 4 dernières semaines signale une montée trop rapide : au-dessus de 1,5 il colore le feu en orange, au-dessus de 1,8 en rouge.",
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
          "ton volume de référence est la médiane de tes semaines réellement courues sur 8 semaines, pas une moyenne qu'une coupure écraserait ;",
          "le volume monte de 10 % par semaine au plus, moins si ta charge monte déjà vite ;",
          "une semaine sur quatre est allégée de 20 %, et l'affûtage avant une course dépend de sa distance ;",
          "la sortie longue est déduite de la distance que tu prépares, monte de 2 km par semaine au plus depuis ta plus longue sortie réelle, et ne dépasse pas la moitié de ton volume ;",
          "1, 2 ou 3 séances de qualité selon le nombre de sorties par semaine, séparées de 48 à 96 heures selon ton âge, y compris par rapport à ta dernière séance dure déjà courue.",
        ] },
      { id: "sante", titre: "Ta santé passe avant ton objectif", paras: ["Pacevo ne pose aucun diagnostic et ne propose aucun soin. Il ajuste ta charge d'entraînement à ce que tu déclares :"],
        points: [
          "une douleur à 4 sur 10 ou plus retire l'intensité le temps qu'elle passe, et l'écran te dit de consulter si elle dure ou s'aggrave ;",
          "les consignes de ton kinésithérapeute (durée maximale, nombre de sorties, pas d'intensité) sont appliquées à chaque séance jusqu'à la date indiquée ;",
          "le questionnaire d'aptitude : si tu signales une situation à faire voir à un médecin, ton plan ne contient plus aucune course jusqu'à ce que tu déclares son avis.",
        ] },
      { id: "ia", titre: "Ce que fait l'IA, et ce qu'elle ne fait pas", paras: [
        "Un modèle de langage (Gemini, de Google) n'intervient que pour écrire : l'analyse de tes séances, le bilan de la semaine et les conseils des séances clés pour les abonnés Premium, des propositions d'ajustement que tu acceptes ou non, et l'assistant d'aide.",
        "Il ne décide jamais de ton plan, de tes allures ni de tes zones, et une proposition d'ajustement est vérifiée par les mêmes règles que le plan avant de t'être montrée.",
      ] },
      { id: "limites", titre: "Ce que Pacevo ne sait pas", paras: [
        "Quand une donnée manque, Pacevo le dit au lieu de la remplacer par un chiffre plausible : pas de VMA, de fréquence cardiaque maximale ni de sommeil inventés. Un trou dans tes séances (blessure, coupure, montre oubliée) est signalé, pas lu comme « zéro entraînement ».",
        "Toutes tes données de montre passent par intervals.icu : ce que ta montre n'y envoie pas, Pacevo ne le voit pas.",
      ] },
    ],
    sourcesTitre: "Sur quoi reposent ces calculs",
    sourcesAide: "Les travaux d'origine, cités tels qu'ils ont été publiés.",
    maj: "Page tenue à jour avec le moteur du coach.",
    avertissement: "Pacevo est un outil d'entraînement, pas un dispositif médical : il ne diagnostique, ne traite ni ne prévient aucune maladie. Avant de commencer ou en cas de doute sur ta santé, consulte un médecin. Urgence : 15 ou 112.",
    cta: "Essayer Pacevo",
  },
  en: {
    metaTitle: "How Pacevo builds your plan · Pacevo",
    metaDesc: "VO2max speed, paces, heart-rate zones, load, freshness, health: where every figure in your plan comes from, and what AI does or doesn't do.",
    surtitre: "Method",
    titre: "How Pacevo builds your plan",
    chapo: "Every session in your plan comes from written, checkable rules applied to your own data. Here they are, with nothing hidden.",
    rubriques: [
      { id: "principe", titre: "The principle: rules, not a black box", paras: [
        "Your plan for the next 7 days is built by a rules engine, without artificial intelligence. The same data always gives the same plan, and every session carries its \"why\".",
        "It is recalculated after every session synced from your watch (through intervals.icu) and every night, to take your sleep, your recovery and what you actually ran into account.",
      ] },
      { id: "vma", titre: "Your maximal aerobic speed (MAS)", paras: [
        "Your MAS sets all your paces. The only measured value comes from the 6-minute test: run as far as you can in 6 minutes. It always takes priority.",
        "Without a test, Pacevo estimates it from your best actual runs and the VO2max given by your watch, and keeps the higher of the two: an effort that was not maximal can only underestimate your MAS. Your first session is therefore the test, except in the walk-run programme or if your fitness questionnaire is waiting for a doctor's opinion.",
      ] },
      { id: "allures", titre: "Your paces and race predictions", paras: [
        "Training paces and predicted times for 5 km, 10 km, half marathon and marathon come from the Daniels and Gilbert model: the oxygen cost of each speed, and the share of your MAS you can hold depending on how long the effort lasts.",
        "Beyond the half marathon, the prediction is made more cautious if your longest recent run or your weekly volume are still short for the distance.",
      ] },
      { id: "fc", titre: "Your heart-rate zones", paras: [
        "Your maximum heart rate comes, in this order: from what you declared, from the highest value measured by your watch (a value under 150 bpm is discarded, it is a sensor dropping out), from your measured threshold, and only as a last resort from your age.",
        "Below threshold, zones use your heart-rate reserve (Karvonen method, with your resting heart rate). At threshold and above, your measured threshold is used. With no reference at all, Pacevo gives you no heart-rate target rather than invent one.",
      ] },
      { id: "charge", titre: "Your load and freshness", paras: [
        "Every session has a load. Your fitness is your average load over 42 days, your fatigue over 7 days, and your freshness the gap between the two (Banister model).",
        "The ratio between your load over the last 7 days and over the last 4 weeks flags a ramp-up that is too fast: above 1.5 it turns the light orange, above 1.8 red.",
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
          "your reference volume is the median of the weeks you actually ran over 8 weeks, not an average that a break would crush;",
          "volume rises by 10% a week at most, less if your load is already rising fast;",
          "one week in four is lightened by 20%, and the taper before a race depends on its distance;",
          "the long run is derived from the distance you are preparing, grows by 2 km a week at most from your longest real run, and never exceeds half your volume;",
          "1, 2 or 3 quality sessions depending on how many runs you do a week, 48 to 96 hours apart depending on your age, including from your last hard session already run.",
        ] },
      { id: "sante", titre: "Your health comes before your goal", paras: ["Pacevo makes no diagnosis and offers no treatment. It adjusts your training load to what you report:"],
        points: [
          "a pain at 4 out of 10 or more removes intensity while it lasts, and the screen tells you to see someone if it lasts or gets worse;",
          "your physiotherapist's instructions (maximum duration, number of runs, no intensity) are applied to every session until the date you set;",
          "the fitness questionnaire: if you report something a doctor should look at, your plan has no running at all until you declare their opinion.",
        ] },
      { id: "ia", titre: "What AI does, and what it doesn't", paras: [
        "A language model (Google's Gemini) is only used to write: the analysis of your sessions, the weekly review and the key-session advice for Premium members, adjustment suggestions that you accept or not, and the help assistant.",
        "It never decides your plan, your paces or your zones, and an adjustment suggestion is checked against the same rules as the plan before it is shown to you.",
      ] },
      { id: "limites", titre: "What Pacevo doesn't know", paras: [
        "When data is missing, Pacevo says so instead of replacing it with a plausible figure: no invented MAS, maximum heart rate or sleep. A gap in your sessions (injury, break, forgotten watch) is flagged, not read as \"zero training\".",
        "All your watch data goes through intervals.icu: what your watch does not send there, Pacevo cannot see.",
      ] },
    ],
    sourcesTitre: "What these calculations rest on",
    sourcesAide: "The original work, cited as published.",
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
        "Dein Plan für die nächsten 7 Tage wird von einer Regel-Engine erstellt, ohne künstliche Intelligenz. Dieselben Daten ergeben immer denselben Plan, und jede Einheit nennt ihr „Warum“.",
        "Er wird nach jeder von deiner Uhr synchronisierten Einheit (über intervals.icu) und jede Nacht neu berechnet, um deinen Schlaf, deine Erholung und das tatsächlich Gelaufene zu berücksichtigen.",
      ] },
      { id: "vma", titre: "Deine maximale aerobe Geschwindigkeit (VMA)", paras: [
        "Die VMA bestimmt alle deine Tempi. Der einzige gemessene Wert stammt aus dem 6-Minuten-Test: so weit wie möglich in 6 Minuten laufen. Er hat immer Vorrang.",
        "Ohne Test schätzt Pacevo sie aus deinen besten tatsächlich gelaufenen Leistungen und der VO2max deiner Uhr und nimmt den höheren Wert: Eine nicht maximale Anstrengung kann deine VMA nur unterschätzen. Deine erste Einheit ist daher der Test, außer im Geh-Lauf-Programm oder wenn dein Fitness-Fragebogen auf eine ärztliche Einschätzung wartet.",
      ] },
      { id: "allures", titre: "Deine Tempi und Wettkampfprognosen", paras: [
        "Trainingstempi und prognostizierte Zeiten über 5 km, 10 km, Halbmarathon und Marathon stammen aus dem Modell von Daniels und Gilbert: der Sauerstoffbedarf jeder Geschwindigkeit und der Anteil deiner VMA, den du je nach Dauer halten kannst.",
        "Jenseits des Halbmarathons wird die Prognose vorsichtiger, wenn dein längster Lauf oder dein Wochenumfang für die Distanz noch knapp sind.",
      ] },
      { id: "fc", titre: "Deine Herzfrequenzzonen", paras: [
        "Deine maximale Herzfrequenz kommt in dieser Reihenfolge: aus deiner Angabe, aus dem höchsten von deiner Uhr gemessenen Wert (ein Wert unter 150 Schlägen wird verworfen, das ist ein aussetzender Sensor), aus deiner gemessenen Schwelle und erst zuletzt aus deinem Alter.",
        "Unterhalb der Schwelle nutzen die Zonen deine Herzfrequenzreserve (Karvonen-Methode, mit deinem Ruhepuls). An und über der Schwelle gilt deine gemessene Schwelle. Ohne jede Referenz gibt Pacevo dir lieber kein Herzfrequenzziel, als eines zu erfinden.",
      ] },
      { id: "charge", titre: "Deine Belastung und Frische", paras: [
        "Jede Einheit hat eine Belastung. Deine Form ist deine durchschnittliche Belastung über 42 Tage, deine Ermüdung über 7 Tage und deine Frische der Unterschied zwischen beiden (Banister-Modell).",
        "Das Verhältnis zwischen deiner Belastung der letzten 7 Tage und der letzten 4 Wochen zeigt einen zu schnellen Anstieg: über 1,5 färbt es die Ampel orange, über 1,8 rot.",
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
          "dein Referenzumfang ist der Median deiner tatsächlich gelaufenen Wochen über 8 Wochen, kein Durchschnitt, den eine Pause zerdrückt;",
          "der Umfang steigt höchstens um 10 % pro Woche, weniger, wenn deine Belastung schon schnell steigt;",
          "jede vierte Woche wird um 20 % erleichtert, und das Tapering vor einem Wettkampf hängt von dessen Distanz ab;",
          "der lange Lauf leitet sich aus deiner Zieldistanz ab, wächst höchstens um 2 km pro Woche ab deinem längsten echten Lauf und übersteigt nie die Hälfte deines Umfangs;",
          "1, 2 oder 3 Qualitätseinheiten je nach Anzahl deiner Läufe pro Woche, je nach Alter 48 bis 96 Stunden auseinander, auch zur letzten bereits gelaufenen harten Einheit.",
        ] },
      { id: "sante", titre: "Deine Gesundheit geht vor deinem Ziel", paras: ["Pacevo stellt keine Diagnose und bietet keine Behandlung an. Es passt deine Trainingsbelastung an deine Angaben an:"],
        points: [
          "ein Schmerz ab 4 von 10 nimmt die Intensität heraus, solange er anhält, und der Bildschirm rät dir zum Arzt, wenn er bleibt oder schlimmer wird;",
          "die Vorgaben deiner Physiotherapie (maximale Dauer, Anzahl der Läufe, keine Intensität) gelten für jede Einheit bis zum gewählten Datum;",
          "der Fitness-Fragebogen: Meldest du etwas, das ärztlich abgeklärt werden sollte, enthält dein Plan kein Laufen mehr, bis du die ärztliche Einschätzung angibst.",
        ] },
      { id: "ia", titre: "Was die KI tut und was nicht", paras: [
        "Ein Sprachmodell (Gemini von Google) wird nur zum Schreiben eingesetzt: die Analyse deiner Einheiten, der Wochenrückblick und die Tipps zu Schlüsseleinheiten für Premium-Mitglieder, Anpassungsvorschläge, die du annimmst oder nicht, und der Hilfe-Assistent.",
        "Es entscheidet nie über deinen Plan, deine Tempi oder Zonen, und ein Anpassungsvorschlag wird mit denselben Regeln wie der Plan geprüft, bevor du ihn siehst.",
      ] },
      { id: "limites", titre: "Was Pacevo nicht weiß", paras: [
        "Fehlen Daten, sagt Pacevo es, statt sie durch eine plausible Zahl zu ersetzen: keine erfundene VMA, maximale Herzfrequenz oder Schlafdauer. Eine Lücke in deinen Einheiten (Verletzung, Pause, vergessene Uhr) wird gemeldet, nicht als „null Training“ gelesen.",
        "Alle Daten deiner Uhr laufen über intervals.icu: Was deine Uhr dort nicht hinschickt, sieht Pacevo nicht.",
      ] },
    ],
    sourcesTitre: "Worauf diese Berechnungen beruhen",
    sourcesAide: "Die Originalarbeiten, so zitiert, wie sie veröffentlicht wurden.",
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
        "Tu plan de los próximos 7 días lo construye un motor de reglas, sin inteligencia artificial. Los mismos datos dan siempre el mismo plan, y cada sesión lleva su «porqué».",
        "Se recalcula tras cada sesión sincronizada desde tu reloj (a través de intervals.icu) y cada noche, para tener en cuenta tu sueño, tu recuperación y lo que realmente has corrido.",
      ] },
      { id: "vma", titre: "Tu VAM (velocidad aeróbica máxima)", paras: [
        "La VAM fija todos tus ritmos. El único valor medido es el del test de 6 minutos: correr lo más lejos posible en 6 minutos. Siempre tiene prioridad.",
        "Sin test, Pacevo la estima a partir de tus mejores marcas reales y del VO2máx de tu reloj, y se queda con la más alta de las dos: un esfuerzo que no fue máximo solo puede subestimar tu VAM. Por eso tu primera sesión es el test, salvo en el programa de andar-correr o si tu cuestionario de aptitud espera la opinión de un médico.",
      ] },
      { id: "allures", titre: "Tus ritmos y tus predicciones de carrera", paras: [
        "Los ritmos de entrenamiento y los tiempos previstos en 5 km, 10 km, media maratón y maratón vienen del modelo de Daniels y Gilbert: el coste en oxígeno de cada velocidad y la parte de tu VAM que puedes mantener según la duración del esfuerzo.",
        "Más allá de la media maratón, la predicción se vuelve más prudente si tu salida más larga reciente o tu volumen semanal aún son justos para la distancia.",
      ] },
      { id: "fc", titre: "Tus zonas cardíacas", paras: [
        "Tu frecuencia cardíaca máxima viene, en este orden: de lo que declaraste, del valor más alto medido por tu reloj (un valor por debajo de 150 latidos se descarta, es un sensor que falla), de tu umbral medido y, solo en último recurso, de tu edad.",
        "Por debajo del umbral, las zonas usan tu reserva cardíaca (método de Karvonen, con tu frecuencia cardíaca en reposo). En el umbral y por encima, se usa tu umbral medido. Sin ninguna referencia, Pacevo prefiere no darte objetivo cardíaco antes que inventarlo.",
      ] },
      { id: "charge", titre: "Tu carga y tu frescura", paras: [
        "Cada sesión tiene una carga. Tu forma es tu carga media en 42 días, tu fatiga en 7 días y tu frescura la diferencia entre ambas (modelo de Banister).",
        "La relación entre tu carga de los últimos 7 días y la de las últimas 4 semanas señala una subida demasiado rápida: por encima de 1,5 pone el semáforo en naranja, por encima de 1,8 en rojo.",
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
          "tu volumen de referencia es la mediana de las semanas que realmente corriste en 8 semanas, no una media que un parón aplastaría;",
          "el volumen sube un 10 % por semana como máximo, menos si tu carga ya sube rápido;",
          "una semana de cada cuatro se aligera un 20 %, y la puesta a punto antes de una carrera depende de su distancia;",
          "la tirada larga se deduce de la distancia que preparas, sube 2 km por semana como máximo desde tu tirada real más larga y nunca supera la mitad de tu volumen;",
          "1, 2 o 3 sesiones de calidad según tus salidas por semana, separadas de 48 a 96 horas según tu edad, también respecto a tu última sesión dura ya corrida.",
        ] },
      { id: "sante", titre: "Tu salud va antes que tu objetivo", paras: ["Pacevo no hace ningún diagnóstico ni propone ningún tratamiento. Ajusta tu carga de entrenamiento a lo que declaras:"],
        points: [
          "un dolor de 4 sobre 10 o más quita la intensidad mientras dure, y la pantalla te dice que consultes si persiste o empeora;",
          "las indicaciones de tu fisioterapeuta (duración máxima, número de salidas, sin intensidad) se aplican a cada sesión hasta la fecha indicada;",
          "el cuestionario de aptitud: si señalas algo que debe ver un médico, tu plan ya no tiene carrera hasta que declares su opinión.",
        ] },
      { id: "ia", titre: "Lo que hace la IA, y lo que no hace", paras: [
        "Un modelo de lenguaje (Gemini, de Google) solo interviene para escribir: el análisis de tus sesiones, el balance de la semana y los consejos de las sesiones clave para los suscriptores Premium, propuestas de ajuste que aceptas o no, y el asistente de ayuda.",
        "Nunca decide tu plan, tus ritmos ni tus zonas, y una propuesta de ajuste se comprueba con las mismas reglas que el plan antes de mostrártela.",
      ] },
      { id: "limites", titre: "Lo que Pacevo no sabe", paras: [
        "Cuando falta un dato, Pacevo lo dice en lugar de sustituirlo por una cifra verosímil: ni VAM, ni frecuencia cardíaca máxima, ni sueño inventados. Un hueco en tus sesiones (lesión, parón, reloj olvidado) se señala, no se lee como «cero entrenamiento».",
        "Todos los datos de tu reloj pasan por intervals.icu: lo que tu reloj no envía allí, Pacevo no lo ve.",
      ] },
    ],
    sourcesTitre: "En qué se basan estos cálculos",
    sourcesAide: "Los trabajos originales, citados tal como se publicaron.",
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
        "O teu plano dos próximos 7 dias é construído por um motor de regras, sem inteligência artificial. Os mesmos dados dão sempre o mesmo plano, e cada treino traz o seu «porquê».",
        "É recalculado após cada treino sincronizado do teu relógio (através do intervals.icu) e todas as noites, para ter em conta o teu sono, a tua recuperação e o que realmente correste.",
      ] },
      { id: "vma", titre: "A tua VAM (velocidade aeróbia máxima)", paras: [
        "A VAM define todos os teus ritmos. O único valor medido é o do teste de 6 minutos: correr o mais longe possível em 6 minutos. Tem sempre prioridade.",
        "Sem teste, o Pacevo estima-a a partir das tuas melhores marcas reais e do VO2máx do teu relógio, e fica com a mais alta das duas: um esforço que não foi máximo só pode subestimar a tua VAM. Por isso o teu primeiro treino é o teste, exceto no programa de caminhada-corrida ou se o teu questionário de aptidão estiver à espera da opinião de um médico.",
      ] },
      { id: "allures", titre: "Os teus ritmos e previsões de prova", paras: [
        "Os ritmos de treino e os tempos previstos em 5 km, 10 km, meia maratona e maratona vêm do modelo de Daniels e Gilbert: o custo em oxigénio de cada velocidade e a parte da tua VAM que consegues manter conforme a duração do esforço.",
        "Para lá da meia maratona, a previsão torna-se mais prudente se o teu treino mais longo recente ou o teu volume semanal ainda forem curtos para a distância.",
      ] },
      { id: "fc", titre: "As tuas zonas cardíacas", paras: [
        "A tua frequência cardíaca máxima vem, por esta ordem: do que declaraste, do valor mais alto medido pelo teu relógio (um valor abaixo de 150 batimentos é descartado, é um sensor que falha), do teu limiar medido e, só em último recurso, da tua idade.",
        "Abaixo do limiar, as zonas usam a tua reserva cardíaca (método de Karvonen, com a tua frequência cardíaca em repouso). No limiar e acima, usa-se o teu limiar medido. Sem nenhuma referência, o Pacevo prefere não te dar alvo cardíaco a inventar um.",
      ] },
      { id: "charge", titre: "A tua carga e a tua frescura", paras: [
        "Cada treino tem uma carga. A tua forma é a tua carga média em 42 dias, o teu cansaço em 7 dias e a tua frescura a diferença entre os dois (modelo de Banister).",
        "A relação entre a tua carga dos últimos 7 dias e a das últimas 4 semanas assinala uma subida demasiado rápida: acima de 1,5 põe o semáforo em laranja, acima de 1,8 em vermelho.",
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
          "o teu volume de referência é a mediana das semanas que realmente correste em 8 semanas, não uma média que uma paragem esmagaria;",
          "o volume sobe no máximo 10 % por semana, menos se a tua carga já estiver a subir depressa;",
          "uma semana em cada quatro é aliviada em 20 %, e o afinamento antes de uma prova depende da distância;",
          "o treino longo deduz-se da distância que preparas, sobe no máximo 2 km por semana a partir do teu treino real mais longo e nunca passa de metade do teu volume;",
          "1, 2 ou 3 treinos de qualidade conforme as corridas por semana, separados de 48 a 96 horas conforme a idade, também em relação ao teu último treino duro já corrido.",
        ] },
      { id: "sante", titre: "A tua saúde vem antes do teu objetivo", paras: ["O Pacevo não faz nenhum diagnóstico nem propõe nenhum tratamento. Ajusta a tua carga de treino ao que declaras:"],
        points: [
          "uma dor de 4 em 10 ou mais retira a intensidade enquanto durar, e o ecrã diz-te para consultares se persistir ou piorar;",
          "as indicações do teu fisioterapeuta (duração máxima, número de corridas, sem intensidade) aplicam-se a cada treino até à data indicada;",
          "o questionário de aptidão: se assinalares algo que um médico deve ver, o teu plano deixa de ter corrida até declarares a opinião dele.",
        ] },
      { id: "ia", titre: "O que a IA faz, e o que não faz", paras: [
        "Um modelo de linguagem (Gemini, da Google) só serve para escrever: a análise dos teus treinos, o balanço da semana e os conselhos dos treinos-chave para os assinantes Premium, propostas de ajuste que aceitas ou não, e o assistente de ajuda.",
        "Nunca decide o teu plano, os teus ritmos nem as tuas zonas, e uma proposta de ajuste é verificada pelas mesmas regras do plano antes de ta mostrarmos.",
      ] },
      { id: "limites", titre: "O que o Pacevo não sabe", paras: [
        "Quando falta um dado, o Pacevo di-lo em vez de o substituir por um número plausível: nem VAM, nem frequência cardíaca máxima, nem sono inventados. Um buraco nos teus treinos (lesão, paragem, relógio esquecido) é assinalado, não lido como «zero treino».",
        "Todos os dados do teu relógio passam pelo intervals.icu: o que o teu relógio não envia para lá, o Pacevo não vê.",
      ] },
    ],
    sourcesTitre: "Em que assentam estes cálculos",
    sourcesAide: "Os trabalhos originais, citados tal como foram publicados.",
    maj: "Página mantida em dia com o motor do treinador.",
    avertissement: "O Pacevo é uma ferramenta de treino, não um dispositivo médico: não diagnostica, trata, cura nem previne nenhuma doença. Antes de começar, ou se tiveres dúvidas sobre a tua saúde, consulta um médico. Emergência: 112.",
    cta: "Experimentar o Pacevo",
  },
};
