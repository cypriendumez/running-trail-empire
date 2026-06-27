import type { Lang } from "@/lib/i18n/translations";

export const BLOG_CATS = ["ALL", "AI", "TRAINING", "NUTRITION", "HEALTH", "RACES", "GEAR"] as const;
export const POST_KEYS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"] as const;

export type BlogDict = {
  heroEyebrow: string; heroTitleA: string; heroAccent: string; heroSubtitle: string;
  cats: Record<string, string>;
  readArticle: string; author: string;
  manifesto: { label: string; humanLabel: string; aiLabel: string; human: string[]; ai: string[] };
  posts: Record<string, { title: string; excerpt: string }>;
};

const fr: BlogDict = {
  heroEyebrow: "Le blog", heroTitleA: "Comprends, apprends, ", heroAccent: "progresse", heroSubtitle: "Ce que la science du sport et l'intelligence artificielle peuvent faire pour ton running.",
  cats: { ALL: "Tout", AI: "IA & Performance", TRAINING: "Entraînement", NUTRITION: "Nutrition", HEALTH: "Santé du coureur", RACES: "Les courses", GEAR: "Équipement" },
  readArticle: "Lire l'article", author: "Équipe Pacevo",
  manifesto: { label: "IA + coach = la combinaison parfaite", humanLabel: "Coach humain", aiLabel: "IA Pacevo", human: ["Vision long terme", "Motivation", "Expérience terrain", "Ajustement tactique"], ai: ["Analyse 24h/24", "VFC + sommeil + charge", "Prédiction de fatigue", "Plan temps réel"] },
  posts: {
    p1: { title: "Pourquoi l'IA sera ton meilleur coach (et ce qu'un humain ne peut pas faire)", excerpt: "L'IA analyse ta VFC, ton sommeil, ta charge en temps réel. Un coach humain te voit une fois par semaine. Voici pourquoi l'avenir, c'est les deux." },
    p2: { title: "HRV + IA : prédire ta fatigue 48 h avant que tu la ressentes", excerpt: "Le modèle de Banister CTL/ATL/TSB combiné à l'analyse HRV prédit les jours de sur-entraînement avec une précision de 94 %." },
    p3: { title: "Semi en moins d'1h45 : le plan IA qui a marché pour 2 300 coureurs", excerpt: "Allure, fractions, récupération — tout est calculé selon ta VMA et ta VFC du matin. Résultat : −8 min en moyenne sur le chrono." },
    p4: { title: "Body Battery à 20 % le matin : faut-il courir quand même ?", excerpt: "La réponse varie selon ton TSB, ta phase de prépa et le type de séance. L'IA tranche pour toi — voici comment elle décide." },
    p5: { title: "UTMB 2026 : les trails français à ne pas manquer cette saison", excerpt: "De l'UTMB au Grand Raid de La Réunion : notre sélection des 20 trails incontournables, profils altimétriques et barrières horaires." },
    p6: { title: "Ghost Runner : courir avec un coach vocal IA, ça change quoi ?", excerpt: "On a testé le coaching vocal IA sur 6 semaines avec 80 coureurs. Les résultats sur l'allure, la régularité et la motivation sont sans appel." },
    p7: { title: "Ravitaillement marathon : quoi manger, quand et combien", excerpt: "Notre calculateur IA tient compte de ta sudation, ta corpulence et ton allure pour un plan glucidique sur mesure." },
    p8: { title: "Chaussures de trail 2026 : le comparatif IA selon ta foulée", excerpt: "L'IA analyse ta cadence, ton oscillation verticale et ton temps de contact au sol pour identifier la chaussure parfaite parmi 200+ modèles." },
  },
};

const en: BlogDict = {
  heroEyebrow: "The blog", heroTitleA: "Understand, learn, ", heroAccent: "improve", heroSubtitle: "What sports science and artificial intelligence can do for your running.",
  cats: { ALL: "All", AI: "AI & Performance", TRAINING: "Training", NUTRITION: "Nutrition", HEALTH: "Runner's health", RACES: "Races", GEAR: "Gear" },
  readArticle: "Read article", author: "Pacevo Team",
  manifesto: { label: "AI + coach = the perfect combination", humanLabel: "Human coach", aiLabel: "Pacevo AI", human: ["Long-term vision", "Motivation", "Field experience", "Tactical adjustment"], ai: ["24/7 analysis", "HRV + sleep + load", "Fatigue prediction", "Real-time plan"] },
  posts: {
    p1: { title: "Why AI will be your best coach (and what a human can't do)", excerpt: "AI analyses your HRV, sleep and load in real time. A human coach sees you once a week. Here's why the future is both." },
    p2: { title: "HRV + AI: predicting your fatigue 48h before you feel it", excerpt: "The Banister CTL/ATL/TSB model combined with HRV analysis predicts overtraining days with 94% accuracy." },
    p3: { title: "Sub-1h45 half: the AI plan that worked for 2,300 runners", excerpt: "Pace, intervals, recovery — all computed from your max aerobic speed and morning HRV. Result: −8 min on average." },
    p4: { title: "Body Battery at 20% in the morning: should you still run?", excerpt: "The answer depends on your TSB, your prep phase and the session type. The AI decides for you — here's how." },
    p5: { title: "UTMB 2026: the French trails not to miss this season", excerpt: "From UTMB to the Grand Raid de La Réunion: our pick of the 20 must-do trails, elevation profiles and cut-off times." },
    p6: { title: "Ghost Runner: what does running with a voice AI coach change?", excerpt: "We tested voice AI coaching over 6 weeks with 80 runners. The results on pace, consistency and motivation are clear-cut." },
    p7: { title: "Marathon fueling: what to eat, when and how much", excerpt: "Our AI calculator factors in your sweat rate, build and pace for a tailored carbohydrate plan." },
    p8: { title: "Trail shoes 2026: the AI comparison for your stride", excerpt: "The AI analyses your cadence, vertical oscillation and ground contact time to find the perfect shoe among 200+ models." },
  },
};

const de: BlogDict = {
  heroEyebrow: "Der Blog", heroTitleA: "Verstehen, lernen, ", heroAccent: "verbessern", heroSubtitle: "Was Sportwissenschaft und künstliche Intelligenz für dein Laufen tun können.",
  cats: { ALL: "Alle", AI: "KI & Leistung", TRAINING: "Training", NUTRITION: "Ernährung", HEALTH: "Läufergesundheit", RACES: "Rennen", GEAR: "Ausrüstung" },
  readArticle: "Artikel lesen", author: "Pacevo-Team",
  manifesto: { label: "KI + Coach = die perfekte Kombination", humanLabel: "Menschlicher Coach", aiLabel: "Pacevo-KI", human: ["Langfristige Vision", "Motivation", "Praxiserfahrung", "Taktische Anpassung"], ai: ["Analyse rund um die Uhr", "HRV + Schlaf + Belastung", "Müdigkeitsprognose", "Echtzeit-Plan"] },
  posts: {
    p1: { title: "Warum KI dein bester Coach wird (und was ein Mensch nicht kann)", excerpt: "Die KI analysiert HRV, Schlaf und Belastung in Echtzeit. Ein menschlicher Coach sieht dich einmal pro Woche. Darum ist die Zukunft beides." },
    p2: { title: "HRV + KI: deine Müdigkeit 48 h vorher vorhersagen", excerpt: "Das Banister-Modell CTL/ATL/TSB kombiniert mit HRV-Analyse sagt Übertrainingstage mit 94 % Genauigkeit voraus." },
    p3: { title: "Halb unter 1:45: der KI-Plan, der bei 2.300 Läufern funktionierte", excerpt: "Tempo, Intervalle, Erholung — alles aus deiner maximalen aeroben Geschwindigkeit und der Morgen-HRV berechnet. Ergebnis: −8 Min. im Schnitt." },
    p4: { title: "Body Battery morgens bei 20 %: trotzdem laufen?", excerpt: "Die Antwort hängt von deinem TSB, deiner Phase und der Einheit ab. Die KI entscheidet für dich — so geht's." },
    p5: { title: "UTMB 2026: die französischen Trails, die du diese Saison nicht verpassen darfst", excerpt: "Vom UTMB bis zum Grand Raid de La Réunion: unsere Auswahl der 20 Must-do-Trails, Höhenprofile und Cut-off-Zeiten." },
    p6: { title: "Ghost Runner: Was ändert ein KI-Sprachcoach beim Laufen?", excerpt: "Wir haben KI-Sprachcoaching 6 Wochen mit 80 Läufern getestet. Die Ergebnisse bei Tempo, Konstanz und Motivation sind eindeutig." },
    p7: { title: "Marathon-Verpflegung: was essen, wann und wie viel", excerpt: "Unser KI-Rechner berücksichtigt Schweißrate, Statur und Tempo für einen maßgeschneiderten Kohlenhydratplan." },
    p8: { title: "Trailschuhe 2026: der KI-Vergleich für deinen Schritt", excerpt: "Die KI analysiert Kadenz, vertikale Oszillation und Bodenkontaktzeit, um aus 200+ Modellen den perfekten Schuh zu finden." },
  },
};

const es: BlogDict = {
  heroEyebrow: "El blog", heroTitleA: "Entiende, aprende, ", heroAccent: "progresa", heroSubtitle: "Lo que la ciencia del deporte y la inteligencia artificial pueden hacer por tu running.",
  cats: { ALL: "Todo", AI: "IA y Rendimiento", TRAINING: "Entrenamiento", NUTRITION: "Nutrición", HEALTH: "Salud del corredor", RACES: "Las carreras", GEAR: "Equipo" },
  readArticle: "Leer el artículo", author: "Equipo Pacevo",
  manifesto: { label: "IA + entrenador = la combinación perfecta", humanLabel: "Entrenador humano", aiLabel: "IA Pacevo", human: ["Visión a largo plazo", "Motivación", "Experiencia de campo", "Ajuste táctico"], ai: ["Análisis 24/7", "VFC + sueño + carga", "Predicción de fatiga", "Plan en tiempo real"] },
  posts: {
    p1: { title: "Por qué la IA será tu mejor entrenador (y lo que un humano no puede hacer)", excerpt: "La IA analiza tu VFC, tu sueño y tu carga en tiempo real. Un entrenador humano te ve una vez por semana. Por eso el futuro son los dos." },
    p2: { title: "VFC + IA: predecir tu fatiga 48 h antes de sentirla", excerpt: "El modelo de Banister CTL/ATL/TSB combinado con el análisis VFC predice los días de sobreentrenamiento con un 94 % de precisión." },
    p3: { title: "Media por debajo de 1h45: el plan IA que funcionó para 2.300 corredores", excerpt: "Ritmo, series, recuperación — todo calculado según tu velocidad aeróbica máxima y tu VFC matinal. Resultado: −8 min de media." },
    p4: { title: "Body Battery al 20 % por la mañana: ¿hay que correr igual?", excerpt: "La respuesta depende de tu TSB, tu fase de preparación y el tipo de sesión. La IA decide por ti — así lo hace." },
    p5: { title: "UTMB 2026: los trails franceses que no te puedes perder esta temporada", excerpt: "Del UTMB al Grand Raid de La Réunion: nuestra selección de los 20 trails imprescindibles, perfiles altimétricos y barreras horarias." },
    p6: { title: "Ghost Runner: ¿qué cambia correr con un entrenador de voz IA?", excerpt: "Probamos el coaching de voz IA durante 6 semanas con 80 corredores. Los resultados en ritmo, regularidad y motivación son rotundos." },
    p7: { title: "Avituallamiento de maratón: qué comer, cuándo y cuánto", excerpt: "Nuestra calculadora IA tiene en cuenta tu sudoración, tu complexión y tu ritmo para un plan de hidratos a medida." },
    p8: { title: "Zapatillas de trail 2026: la comparativa IA según tu pisada", excerpt: "La IA analiza tu cadencia, tu oscilación vertical y tu tiempo de contacto con el suelo para encontrar la zapatilla perfecta entre más de 200 modelos." },
  },
};

const pt: BlogDict = {
  heroEyebrow: "O blog", heroTitleA: "Compreende, aprende, ", heroAccent: "evolui", heroSubtitle: "O que a ciência do desporto e a inteligência artificial podem fazer pela tua corrida.",
  cats: { ALL: "Tudo", AI: "IA & Desempenho", TRAINING: "Treino", NUTRITION: "Nutrição", HEALTH: "Saúde do corredor", RACES: "As provas", GEAR: "Equipamento" },
  readArticle: "Ler o artigo", author: "Equipa Pacevo",
  manifesto: { label: "IA + treinador = a combinação perfeita", humanLabel: "Treinador humano", aiLabel: "IA Pacevo", human: ["Visão a longo prazo", "Motivação", "Experiência no terreno", "Ajuste tático"], ai: ["Análise 24h/24", "VFC + sono + carga", "Previsão de fadiga", "Plano em tempo real"] },
  posts: {
    p1: { title: "Porque a IA será o teu melhor treinador (e o que um humano não consegue fazer)", excerpt: "A IA analisa a tua VFC, o teu sono e a tua carga em tempo real. Um treinador humano vê-te uma vez por semana. Por isso o futuro são os dois." },
    p2: { title: "VFC + IA: prever a tua fadiga 48 h antes de a sentires", excerpt: "O modelo de Banister CTL/ATL/TSB combinado com a análise VFC prevê os dias de sobretreino com 94 % de precisão." },
    p3: { title: "Meia abaixo de 1h45: o plano IA que resultou para 2.300 corredores", excerpt: "Ritmo, séries, recuperação — tudo calculado com base na tua velocidade aeróbia máxima e na VFC da manhã. Resultado: −8 min em média." },
    p4: { title: "Body Battery a 20 % de manhã: deves correr na mesma?", excerpt: "A resposta depende do teu TSB, da fase de preparação e do tipo de sessão. A IA decide por ti — eis como." },
    p5: { title: "UTMB 2026: os trails franceses a não perder esta temporada", excerpt: "Do UTMB ao Grand Raid de La Réunion: a nossa seleção dos 20 trails imperdíveis, perfis altimétricos e barreiras horárias." },
    p6: { title: "Ghost Runner: o que muda correr com um treinador de voz IA?", excerpt: "Testámos o coaching de voz IA durante 6 semanas com 80 corredores. Os resultados em ritmo, regularidade e motivação são claros." },
    p7: { title: "Abastecimento de maratona: o que comer, quando e quanto", excerpt: "A nossa calculadora IA tem em conta a tua sudação, a tua constituição e o teu ritmo para um plano de hidratos à medida." },
    p8: { title: "Sapatilhas de trail 2026: a comparação IA segundo a tua passada", excerpt: "A IA analisa a tua cadência, a tua oscilação vertical e o teu tempo de contacto com o solo para encontrar a sapatilha perfeita entre mais de 200 modelos." },
  },
};

export const BLOG: Record<Lang, BlogDict> = { fr, en, de, es, pt };
