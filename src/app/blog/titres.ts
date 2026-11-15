import type { Lang } from "@/lib/i18n/translations";

/**
 * LES TITRES DES ARTICLES, SEULS, PAR LANGUE.
 *
 * ⚠️ POURQUOI CETTE TABLE EXISTE (relecture @Maestro, 16/11/2026). Le bloc « Derniers
 * articles » de la page d'accueil importait tout `blogI18n.ts` (titres, extraits et
 * rubriques des 17 articles dans les cinq langues, environ 26 Ko de source) pour afficher
 * TROIS titres : l'accueil est un composant client, tout partait dans son bundle. Cette
 * table ne porte que les titres des articles ÉCRITS.
 *
 * ⚠️ C'EST UNE COPIE, et elle est gardée : `tests/blog-maillage.test.ts` exige que chaque
 * titre soit STRICTEMENT égal à `BLOG[langue].posts[clé].title`, et que la table couvre
 * exactement les articles de `slugs.ts`. Un titre corrigé d'un seul côté, ou un article
 * ajouté sans ses cinq titres ici, fait rougir le test.
 */
export const TITRES_BLOG: Record<Lang, Record<string, string>> = {
  fr: {
    p1: "Pourquoi l'IA sera ton meilleur coach (et ce qu'un humain ne peut pas faire)",
    p2: "VFC et charge : voir la fatigue arriver avant de la sentir",
    p3: "Semi en moins d'1h45 : comment le plan se construit",
    p4: "Body Battery à 20 % le matin : faut-il courir quand même ?",
    p5: "Choisir son premier ultra : ce qui distingue vraiment les épreuves",
    p6: "Ghost Runner : courir avec un coach vocal IA, ça change quoi ?",
    p7: "Ravitaillement marathon : quoi manger, quand et combien",
    p8: "Chaussure de trail : ce qui compte vraiment avant la marque",
    p9: "Manger trop peu : le déficit énergétique relatif chez le coureur",
    p10: "Le renforcement, la séance qui fait courir plus vite sans courir",
    p11: "Cycle menstruel et entraînement : ce que dit vraiment la méta-analyse",
    p12: "Courir par forte chaleur : acclimatation, hydratation, allure",
    p13: "Reprendre après une blessure : ce que la progression doit respecter",
    p14: "GPS en forêt et de nuit : pourquoi ta montre se trompe, et ce qui compte à la place",
    p15: "Plaque carbone en trail : ce qu'elle doit à la route, ce qu'elle ne prouve pas encore",
    p16: "Courir dans le froid et la nuit : voies respiratoires et visibilité",
    p17: "Quelle application de coaching running choisir en 2027 ? Six questions à poser",
  },
  en: {
    p1: "Why AI will be your best coach (and what a human can't do)",
    p2: "HRV and load: seeing fatigue coming before you feel it",
    p3: "Sub-1h45 half marathon: how the plan is built",
    p4: "Body Battery at 20% in the morning: should you still run?",
    p5: "Choosing your first ultra: what really sets races apart",
    p6: "Ghost Runner: what does running with a voice AI coach change?",
    p7: "Marathon fueling: what to eat, when and how much",
    p8: "Trail shoes: what matters before the brand",
    p9: "Eating too little: relative energy deficiency in runners",
    p10: "Strength work: the session that makes you run faster without running",
    p11: "Menstrual cycle and training: what the meta-analysis actually says",
    p12: "Running in serious heat: acclimation, hydration, pacing",
    p13: "Coming back from injury: what a sound progression respects",
    p14: "GPS in forests and at night: why your watch gets it wrong, and what to trust instead",
    p15: "Carbon plates in trail shoes: what they owe to the road, what they haven't yet proven",
    p16: "Running in the cold and the dark: airways and being seen",
    p17: "Which running coaching app to choose in 2027? Six questions to ask",
  },
  de: {
    p1: "Warum KI dein bester Coach wird (und was ein Mensch nicht kann)",
    p2: "HRV und Belastung: Müdigkeit sehen, bevor du sie spürst",
    p3: "Halbmarathon unter 1:45: wie der Plan entsteht",
    p4: "Body Battery morgens bei 20 %: trotzdem laufen?",
    p5: "Deinen ersten Ultra wählen: was Rennen wirklich unterscheidet",
    p6: "Ghost Runner: Was ändert ein KI-Sprachcoach beim Laufen?",
    p7: "Marathon-Verpflegung: was essen, wann und wie viel",
    p8: "Trailschuhe: was vor der Marke wirklich zählt",
    p9: "Zu wenig essen: relatives Energiedefizit bei Läufern",
    p10: "Krafttraining: die Einheit, die schneller macht, ohne zu laufen",
    p11: "Menstruationszyklus und Training: was die Meta-Analyse wirklich sagt",
    p12: "Laufen bei großer Hitze: Akklimatisation, Trinken, Tempo",
    p13: "Nach einer Verletzung zurückkommen: was die Steigerung einhalten muss",
    p14: "GPS im Wald und nachts: warum deine Uhr sich irrt, und worauf du stattdessen vertraust",
    p15: "Carbonplatte im Trailschuh: was sie der Straße verdankt, was sie noch nicht beweist",
    p16: "Laufen bei Kälte und Dunkelheit: Atemwege und Sichtbarkeit",
    p17: "Welche Lauf-Coaching-App 2027 wählen? Sechs Fragen, die du stellen solltest",
  },
  es: {
    p1: "Por qué la IA será tu mejor entrenador (y lo que un humano no puede hacer)",
    p2: "VFC y carga: ver llegar la fatiga antes de sentirla",
    p3: "Media por debajo de 1h45: cómo se construye el plan",
    p4: "Body Battery al 20 % por la mañana: ¿hay que correr igual?",
    p5: "Elegir tu primer ultra: lo que de verdad diferencia las carreras",
    p6: "Ghost Runner: ¿qué cambia correr con un entrenador de voz IA?",
    p7: "Avituallamiento de maratón: qué comer, cuándo y cuánto",
    p8: "Zapatillas de trail: lo que cuenta antes que la marca",
    p9: "Comer demasiado poco: el déficit energético relativo en el corredor",
    p10: "La fuerza: la sesión que te hace correr más rápido sin correr",
    p11: "Ciclo menstrual y entrenamiento: lo que dice de verdad el metaanálisis",
    p12: "Correr con mucho calor: aclimatación, hidratación, ritmo",
    p13: "Volver tras una lesión: lo que la progresión debe respetar",
    p14: "GPS en bosque y de noche: por qué tu reloj se equivoca, y qué fiarse en su lugar",
    p15: "Placa de carbono en trail: lo que debe a la carretera, lo que aún no demuestra",
    p16: "Correr con frío y de noche: vías respiratorias y visibilidad",
    p17: "¿Qué aplicación de entrenamiento de running elegir en 2027? Seis preguntas que hacer",
  },
  pt: {
    p1: "Porque a IA será o teu melhor treinador (e o que um humano não consegue fazer)",
    p2: "VFC e carga: ver a fadiga chegar antes de a sentires",
    p3: "Meia abaixo de 1h45: como se constrói o plano",
    p4: "Body Battery a 20 % de manhã: deves correr na mesma?",
    p5: "Escolher o teu primeiro ultra: o que distingue mesmo as provas",
    p6: "Ghost Runner: o que muda correr com um treinador de voz IA?",
    p7: "Abastecimento de maratona: o que comer, quando e quanto",
    p8: "Sapatilhas de trail: o que conta antes da marca",
    p9: "Comer demasiado pouco: o défice energético relativo no corredor",
    p10: "A força: a sessão que te faz correr mais depressa sem correr",
    p11: "Ciclo menstrual e treino: o que diz mesmo a meta-análise",
    p12: "Correr com muito calor: aclimatação, hidratação, ritmo",
    p13: "Voltar depois de uma lesão: o que a progressão tem de respeitar",
    p14: "GPS na floresta e de noite: porque o teu relógio se engana, e no que confiar em vez disso",
    p15: "Placa de carbono em trail: o que deve à estrada, o que ainda não prova",
    p16: "Correr com frio e à noite: vias respiratórias e visibilidade",
    p17: "Que aplicação de treino de corrida escolher em 2027? Seis perguntas a fazer",
  },
};
