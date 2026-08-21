import type { Lang } from "@/lib/i18n/translations";

export const BLOG_CATS = ["ALL", "AI", "TRAINING", "NUTRITION", "HEALTH", "RACES", "GEAR"] as const;
export const POST_KEYS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"] as const;

export type BlogDict = {
  heroEyebrow: string; heroTitleA: string; heroAccent: string; heroSubtitle: string;
  cats: Record<string, string>;
  readArticle: string; bientot: string;
  manifesto: { label: string; humanLabel: string; aiLabel: string; human: string[]; ai: string[] };
  posts: Record<string, { title: string; excerpt: string }>;
};

const fr: BlogDict = {
  heroEyebrow: "Le blog", heroTitleA: "Comprends, apprends, ", heroAccent: "progresse", heroSubtitle: "Ce que la science du sport et l'intelligence artificielle peuvent faire pour ton running.",
  cats: { ALL: "Tout", AI: "IA & Performance", TRAINING: "Entraînement", NUTRITION: "Nutrition", HEALTH: "Santé du coureur", RACES: "Les courses", GEAR: "Équipement" },
  readArticle: "Créer mon compte", bientot: "Sujet à venir",
  manifesto: { label: "IA + coach = la combinaison parfaite", humanLabel: "Coach humain", aiLabel: "IA Pacevo", human: ["Vision long terme", "Motivation", "Expérience terrain", "Ajustement tactique"], ai: ["Analyse 24h/24", "VFC + sommeil + charge", "Prédiction de fatigue", "Plan temps réel"] },
  posts: {
    p1: { title: "Pourquoi l'IA sera ton meilleur coach (et ce qu'un humain ne peut pas faire)", excerpt: "L'IA analyse ta VFC, ton sommeil, ta charge en temps réel. Un coach humain te voit une fois par semaine. Voici pourquoi l'avenir, c'est les deux." },
    p2: { title: "VFC et charge : voir la fatigue arriver avant de la sentir", excerpt: "Ce que disent vraiment les trois courbes du modèle de Banister — CTL, ATL, TSB — quand on les croise avec ta VFC du matin, et ce que Pacevo en fait." },
    p3: { title: "Semi en moins d'1h45 : comment le plan se construit", excerpt: "Allure seuil, fractions, sortie longue, affûtage : d'où sort chaque séance, et pourquoi elle change quand ta fraîcheur change." },
    p4: { title: "Body Battery à 20 % le matin : faut-il courir quand même ?", excerpt: "La réponse varie selon ton TSB, ta phase de prépa et le type de séance. L'IA tranche pour toi — voici comment elle décide." },
    p5: { title: "UTMB 2026 : les trails français à ne pas manquer cette saison", excerpt: "De l'UTMB au Grand Raid de La Réunion : notre sélection des 20 trails incontournables, profils altimétriques et barrières horaires." },
    p6: { title: "Ghost Runner : courir avec un coach vocal IA, ça change quoi ?", excerpt: "Allure cible, écart au plan et chrono projeté annoncés à chaque kilomètre : ce que ça change de ne plus avoir à regarder sa montre." },
    p7: { title: "Ravitaillement marathon : quoi manger, quand et combien", excerpt: "Notre calculateur IA tient compte de ta sudation, ta corpulence et ton allure pour un plan glucidique sur mesure." },
    p8: { title: "Chaussures de trail 2026 : le comparatif IA selon ta foulée", excerpt: "L'IA analyse ta cadence, ton oscillation verticale et ton temps de contact au sol pour identifier la chaussure parfaite parmi 200+ modèles." },
  },
};

const en: BlogDict = {
  heroEyebrow: "The blog", heroTitleA: "Understand, learn, ", heroAccent: "improve", heroSubtitle: "What sports science and artificial intelligence can do for your running.",
  cats: { ALL: "All", AI: "AI & Performance", TRAINING: "Training", NUTRITION: "Nutrition", HEALTH: "Runner's health", RACES: "Races", GEAR: "Gear" },
  readArticle: "Create my account", bientot: "Coming soon",
  manifesto: { label: "AI + coach = the perfect combination", humanLabel: "Human coach", aiLabel: "Pacevo AI", human: ["Long-term vision", "Motivation", "Field experience", "Tactical adjustment"], ai: ["24/7 analysis", "HRV + sleep + load", "Fatigue prediction", "Real-time plan"] },
  posts: {
    p1: { title: "Why AI will be your best coach (and what a human can't do)", excerpt: "AI analyses your HRV, sleep and load in real time. A human coach sees you once a week. Here's why the future is both." },
    p2: { title: "HRV and load: seeing fatigue coming before you feel it", excerpt: "What the three Banister curves — CTL, ATL, TSB — actually say when crossed with your morning HRV, and what Pacevo does about it." },
    p3: { title: "Sub-1h45 half marathon: how the plan is built", excerpt: "Threshold pace, intervals, long run, taper: where each session comes from, and why it changes when your freshness does." },
    p4: { title: "Body Battery at 20% in the morning: should you still run?", excerpt: "The answer depends on your TSB, your prep phase and the session type. The AI decides for you — here's how." },
    p5: { title: "UTMB 2026: the French trails not to miss this season", excerpt: "From UTMB to the Grand Raid de La Réunion: our pick of the 20 must-do trails, elevation profiles and cut-off times." },
    p6: { title: "Ghost Runner: what does running with a voice AI coach change?", excerpt: "Target pace, gap to plan and projected finish announced every kilometre: what changes when you stop looking at your watch." },
    p7: { title: "Marathon fueling: what to eat, when and how much", excerpt: "Our AI calculator factors in your sweat rate, build and pace for a tailored carbohydrate plan." },
    p8: { title: "Trail shoes 2026: the AI comparison for your stride", excerpt: "The AI analyses your cadence, vertical oscillation and ground contact time to find the perfect shoe among 200+ models." },
  },
};

const de: BlogDict = {
  heroEyebrow: "Der Blog", heroTitleA: "Verstehen, lernen, ", heroAccent: "verbessern", heroSubtitle: "Was Sportwissenschaft und künstliche Intelligenz für dein Laufen tun können.",
  cats: { ALL: "Alle", AI: "KI & Leistung", TRAINING: "Training", NUTRITION: "Ernährung", HEALTH: "Läufergesundheit", RACES: "Rennen", GEAR: "Ausrüstung" },
  readArticle: "Konto erstellen", bientot: "Demnächst",
  manifesto: { label: "KI + Coach = die perfekte Kombination", humanLabel: "Menschlicher Coach", aiLabel: "Pacevo-KI", human: ["Langfristige Vision", "Motivation", "Praxiserfahrung", "Taktische Anpassung"], ai: ["Analyse rund um die Uhr", "HRV + Schlaf + Belastung", "Müdigkeitsprognose", "Echtzeit-Plan"] },
  posts: {
    p1: { title: "Warum KI dein bester Coach wird (und was ein Mensch nicht kann)", excerpt: "Die KI analysiert HRV, Schlaf und Belastung in Echtzeit. Ein menschlicher Coach sieht dich einmal pro Woche. Darum ist die Zukunft beides." },
    p2: { title: "HRV und Belastung: Müdigkeit sehen, bevor du sie spürst", excerpt: "Was die drei Banister-Kurven — CTL, ATL, TSB — wirklich aussagen, wenn man sie mit deiner Morgen-HRV kreuzt, und was Pacevo daraus macht." },
    p3: { title: "Halbmarathon unter 1:45: wie der Plan entsteht", excerpt: "Schwellentempo, Intervalle, langer Lauf, Tapering: woher jede Einheit kommt und warum sie sich ändert, wenn deine Frische es tut." },
    p4: { title: "Body Battery morgens bei 20 %: trotzdem laufen?", excerpt: "Die Antwort hängt von deinem TSB, deiner Phase und der Einheit ab. Die KI entscheidet für dich — so geht's." },
    p5: { title: "UTMB 2026: die französischen Trails, die du diese Saison nicht verpassen darfst", excerpt: "Vom UTMB bis zum Grand Raid de La Réunion: unsere Auswahl der 20 Must-do-Trails, Höhenprofile und Cut-off-Zeiten." },
    p6: { title: "Ghost Runner: Was ändert ein KI-Sprachcoach beim Laufen?", excerpt: "Zieltempo, Abweichung vom Plan und Hochrechnung — jeden Kilometer angesagt: was sich ändert, wenn du nicht mehr auf die Uhr schaust." },
    p7: { title: "Marathon-Verpflegung: was essen, wann und wie viel", excerpt: "Unser KI-Rechner berücksichtigt Schweißrate, Statur und Tempo für einen maßgeschneiderten Kohlenhydratplan." },
    p8: { title: "Trailschuhe 2026: der KI-Vergleich für deinen Schritt", excerpt: "Die KI analysiert Kadenz, vertikale Oszillation und Bodenkontaktzeit, um aus 200+ Modellen den perfekten Schuh zu finden." },
  },
};

const es: BlogDict = {
  heroEyebrow: "El blog", heroTitleA: "Entiende, aprende, ", heroAccent: "progresa", heroSubtitle: "Lo que la ciencia del deporte y la inteligencia artificial pueden hacer por tu running.",
  cats: { ALL: "Todo", AI: "IA y Rendimiento", TRAINING: "Entrenamiento", NUTRITION: "Nutrición", HEALTH: "Salud del corredor", RACES: "Las carreras", GEAR: "Equipo" },
  readArticle: "Crear mi cuenta", bientot: "Próximamente",
  manifesto: { label: "IA + entrenador = la combinación perfecta", humanLabel: "Entrenador humano", aiLabel: "IA Pacevo", human: ["Visión a largo plazo", "Motivación", "Experiencia de campo", "Ajuste táctico"], ai: ["Análisis 24/7", "VFC + sueño + carga", "Predicción de fatiga", "Plan en tiempo real"] },
  posts: {
    p1: { title: "Por qué la IA será tu mejor entrenador (y lo que un humano no puede hacer)", excerpt: "La IA analiza tu VFC, tu sueño y tu carga en tiempo real. Un entrenador humano te ve una vez por semana. Por eso el futuro son los dos." },
    p2: { title: "VFC y carga: ver llegar la fatiga antes de sentirla", excerpt: "Lo que dicen de verdad las tres curvas del modelo de Banister — CTL, ATL, TSB — cruzadas con tu VFC matinal, y qué hace Pacevo con ello." },
    p3: { title: "Media por debajo de 1h45: cómo se construye el plan", excerpt: "Ritmo umbral, series, tirada larga, afinamiento: de dónde sale cada sesión y por qué cambia cuando cambia tu frescura." },
    p4: { title: "Body Battery al 20 % por la mañana: ¿hay que correr igual?", excerpt: "La respuesta depende de tu TSB, tu fase de preparación y el tipo de sesión. La IA decide por ti — así lo hace." },
    p5: { title: "UTMB 2026: los trails franceses que no te puedes perder esta temporada", excerpt: "Del UTMB al Grand Raid de La Réunion: nuestra selección de los 20 trails imprescindibles, perfiles altimétricos y barreras horarias." },
    p6: { title: "Ghost Runner: ¿qué cambia correr con un entrenador de voz IA?", excerpt: "Ritmo objetivo, desvío respecto al plan y crono previsto anunciados cada kilómetro: lo que cambia cuando dejas de mirar el reloj." },
    p7: { title: "Avituallamiento de maratón: qué comer, cuándo y cuánto", excerpt: "Nuestra calculadora IA tiene en cuenta tu sudoración, tu complexión y tu ritmo para un plan de hidratos a medida." },
    p8: { title: "Zapatillas de trail 2026: la comparativa IA según tu pisada", excerpt: "La IA analiza tu cadencia, tu oscilación vertical y tu tiempo de contacto con el suelo para encontrar la zapatilla perfecta entre más de 200 modelos." },
  },
};

const pt: BlogDict = {
  heroEyebrow: "O blog", heroTitleA: "Compreende, aprende, ", heroAccent: "evolui", heroSubtitle: "O que a ciência do desporto e a inteligência artificial podem fazer pela tua corrida.",
  cats: { ALL: "Tudo", AI: "IA & Desempenho", TRAINING: "Treino", NUTRITION: "Nutrição", HEALTH: "Saúde do corredor", RACES: "As provas", GEAR: "Equipamento" },
  readArticle: "Criar a minha conta", bientot: "Em breve",
  manifesto: { label: "IA + treinador = a combinação perfeita", humanLabel: "Treinador humano", aiLabel: "IA Pacevo", human: ["Visão a longo prazo", "Motivação", "Experiência no terreno", "Ajuste tático"], ai: ["Análise 24h/24", "VFC + sono + carga", "Previsão de fadiga", "Plano em tempo real"] },
  posts: {
    p1: { title: "Porque a IA será o teu melhor treinador (e o que um humano não consegue fazer)", excerpt: "A IA analisa a tua VFC, o teu sono e a tua carga em tempo real. Um treinador humano vê-te uma vez por semana. Por isso o futuro são os dois." },
    p2: { title: "VFC e carga: ver a fadiga chegar antes de a sentires", excerpt: "O que dizem realmente as três curvas do modelo de Banister — CTL, ATL, TSB — cruzadas com a tua VFC da manhã, e o que Pacevo faz com isso." },
    p3: { title: "Meia abaixo de 1h45: como se constrói o plano", excerpt: "Ritmo de limiar, séries, tirada longa, afinamento: de onde vem cada sessão e porque muda quando a tua frescura muda." },
    p4: { title: "Body Battery a 20 % de manhã: deves correr na mesma?", excerpt: "A resposta depende do teu TSB, da fase de preparação e do tipo de sessão. A IA decide por ti — eis como." },
    p5: { title: "UTMB 2026: os trails franceses a não perder esta temporada", excerpt: "Do UTMB ao Grand Raid de La Réunion: a nossa seleção dos 20 trails imperdíveis, perfis altimétricos e barreiras horárias." },
    p6: { title: "Ghost Runner: o que muda correr com um treinador de voz IA?", excerpt: "Ritmo alvo, desvio ao plano e tempo previsto anunciados a cada quilómetro: o que muda quando deixas de olhar para o relógio." },
    p7: { title: "Abastecimento de maratona: o que comer, quando e quanto", excerpt: "A nossa calculadora IA tem em conta a tua sudação, a tua constituição e o teu ritmo para um plano de hidratos à medida." },
    p8: { title: "Sapatilhas de trail 2026: a comparação IA segundo a tua passada", excerpt: "A IA analisa a tua cadência, a tua oscilação vertical e o teu tempo de contacto com o solo para encontrar a sapatilha perfeita entre mais de 200 modelos." },
  },
};

export const BLOG: Record<Lang, BlogDict> = { fr, en, de, es, pt };
