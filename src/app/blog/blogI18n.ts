import type { Lang } from "@/lib/i18n/translations";

export const BLOG_CATS = ["ALL", "AI", "TRAINING", "NUTRITION", "HEALTH", "RACES", "GEAR"] as const;
export const POST_KEYS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"] as const;

export type BlogDict = {
  heroEyebrow: string; heroTitleA: string; heroAccent: string; heroSubtitle: string;
  cats: Record<string, string>;
  readArticle: string; lireArticle: string; bientot: string;
  manifesto: { label: string; humanLabel: string; aiLabel: string; human: string[]; ai: string[] };
  posts: Record<string, { title: string; excerpt: string }>;
};

const fr: BlogDict = {
  heroEyebrow: "Le blog", heroTitleA: "Comprends, apprends, ", heroAccent: "progresse", heroSubtitle: "Ce que la science du sport et l'intelligence artificielle peuvent faire pour ton running.",
  cats: { ALL: "Tout", AI: "IA & Performance", TRAINING: "Entraînement", NUTRITION: "Nutrition", HEALTH: "Santé du coureur", RACES: "Les courses", GEAR: "Équipement" },
  readArticle: "Créer mon compte", lireArticle: "Lire l'article", bientot: "Sujet à venir",
  manifesto: { label: "IA + coach = la combinaison parfaite", humanLabel: "Coach humain", aiLabel: "IA Pacevo", human: ["Vision long terme", "Motivation", "Expérience terrain", "Ajustement tactique"], ai: ["Analyse 24h/24", "VFC + sommeil + charge", "Prédiction de fatigue", "Plan temps réel"] },
  posts: {
    p1: { title: "Pourquoi l'IA sera ton meilleur coach (et ce qu'un humain ne peut pas faire)", excerpt: "L'IA analyse ta VFC, ton sommeil, ta charge en temps réel. Un coach humain te voit une fois par semaine. Voici pourquoi l'avenir, c'est les deux." },
    p2: { title: "VFC et charge : voir la fatigue arriver avant de la sentir", excerpt: "Ce que disent vraiment les trois courbes du modèle de Banister — CTL, ATL, TSB — quand on les croise avec ta VFC du matin, et ce que Pacevo en fait." },
    p3: { title: "Semi en moins d'1h45 : comment le plan se construit", excerpt: "Allure seuil, fractions, sortie longue, affûtage : d'où sort chaque séance, et pourquoi elle change quand ta fraîcheur change." },
    p4: { title: "Body Battery à 20 % le matin : faut-il courir quand même ?", excerpt: "La réponse varie selon ton TSB, ta phase de prépa et le type de séance. L'IA tranche pour toi — voici comment elle décide." },
    p5: { title: "Choisir son premier ultra : ce qui distingue vraiment les épreuves", excerpt: "Dénivelé, barrières horaires, nuit, autonomie, qualifications : les critères qui décident si une course te conviendra — et qui, eux, ne périment pas." },
    p6: { title: "Ghost Runner : courir avec un coach vocal IA, ça change quoi ?", excerpt: "Allure cible, écart au plan et chrono projeté annoncés à chaque kilomètre : ce que ça change de ne plus avoir à regarder sa montre." },
    p7: { title: "Ravitaillement marathon : quoi manger, quand et combien", excerpt: "Notre calculateur IA tient compte de ta sudation, ta corpulence et ton allure pour un plan glucidique sur mesure." },
    p8: { title: "Chaussure de trail : ce qui compte vraiment avant la marque", excerpt: "Masse, drop, crampons, chaussant : les quatre paramètres qui décident, et ce que la littérature dit de chacun — y compris là où elle ne dit rien." },
    p9: { title: "Manger trop peu : le déficit énergétique relatif chez le coureur", excerpt: "Ce que le consensus du CIO appelle les REDs : quand l'apport ne couvre plus l'entraînement, ce que ça abîme, et les signes qui doivent alerter." },
    p10: { title: "Le renforcement, la séance qui fait courir plus vite sans courir", excerpt: "Un des liens les mieux établis de la littérature — et la séance que presque tout le monde saute. Ce qu'elle change, et à quoi elle ressemble." },
    p11: { title: "Cycle menstruel et entraînement : ce que dit vraiment la méta-analyse", excerpt: "Un effet réel mais faible et très variable d'une femme à l'autre. Pourquoi une périodisation rigide passe à côté, et ce qui marche mieux." },
  },
};

const en: BlogDict = {
  heroEyebrow: "The blog", heroTitleA: "Understand, learn, ", heroAccent: "improve", heroSubtitle: "What sports science and artificial intelligence can do for your running.",
  cats: { ALL: "All", AI: "AI & Performance", TRAINING: "Training", NUTRITION: "Nutrition", HEALTH: "Runner's health", RACES: "Races", GEAR: "Gear" },
  readArticle: "Create my account", lireArticle: "Read the article", bientot: "Coming soon",
  manifesto: { label: "AI + coach = the perfect combination", humanLabel: "Human coach", aiLabel: "Pacevo AI", human: ["Long-term vision", "Motivation", "Field experience", "Tactical adjustment"], ai: ["24/7 analysis", "HRV + sleep + load", "Fatigue prediction", "Real-time plan"] },
  posts: {
    p1: { title: "Why AI will be your best coach (and what a human can't do)", excerpt: "AI analyses your HRV, sleep and load in real time. A human coach sees you once a week. Here's why the future is both." },
    p2: { title: "HRV and load: seeing fatigue coming before you feel it", excerpt: "What the three Banister curves — CTL, ATL, TSB — actually say when crossed with your morning HRV, and what Pacevo does about it." },
    p3: { title: "Sub-1h45 half marathon: how the plan is built", excerpt: "Threshold pace, intervals, long run, taper: where each session comes from, and why it changes when your freshness does." },
    p4: { title: "Body Battery at 20% in the morning: should you still run?", excerpt: "The answer depends on your TSB, your prep phase and the session type. The AI decides for you — here's how." },
    p5: { title: "Choosing your first ultra: what really sets races apart", excerpt: "Elevation, cut-offs, night sections, self-sufficiency, qualification: the criteria that decide whether a race suits you — and that don't go stale." },
    p6: { title: "Ghost Runner: what does running with a voice AI coach change?", excerpt: "Target pace, gap to plan and projected finish announced every kilometre: what changes when you stop looking at your watch." },
    p7: { title: "Marathon fueling: what to eat, when and how much", excerpt: "Our AI calculator factors in your sweat rate, build and pace for a tailored carbohydrate plan." },
    p8: { title: "Trail shoes: what matters before the brand", excerpt: "Mass, drop, lugs, fit: the four parameters that decide, and what the literature says about each — including where it says nothing." },
    p9: { title: "Eating too little: relative energy deficiency in runners", excerpt: "What the IOC consensus calls REDs: when intake no longer covers training, what it damages, and the signs that should alert you." },
    p10: { title: "Strength work: the session that makes you run faster without running", excerpt: "One of the best-established links in the literature — and the session almost everyone skips. What it changes, and what it looks like." },
    p11: { title: "Menstrual cycle and training: what the meta-analysis actually says", excerpt: "A real effect, but small and highly variable between women. Why rigid periodisation misses the point, and what works better." },
  },
};

const de: BlogDict = {
  heroEyebrow: "Der Blog", heroTitleA: "Verstehen, lernen, ", heroAccent: "verbessern", heroSubtitle: "Was Sportwissenschaft und künstliche Intelligenz für dein Laufen tun können.",
  cats: { ALL: "Alle", AI: "KI & Leistung", TRAINING: "Training", NUTRITION: "Ernährung", HEALTH: "Läufergesundheit", RACES: "Rennen", GEAR: "Ausrüstung" },
  readArticle: "Konto erstellen", lireArticle: "Artikel lesen", bientot: "Demnächst",
  manifesto: { label: "KI + Coach = die perfekte Kombination", humanLabel: "Menschlicher Coach", aiLabel: "Pacevo-KI", human: ["Langfristige Vision", "Motivation", "Praxiserfahrung", "Taktische Anpassung"], ai: ["Analyse rund um die Uhr", "HRV + Schlaf + Belastung", "Müdigkeitsprognose", "Echtzeit-Plan"] },
  posts: {
    p1: { title: "Warum KI dein bester Coach wird (und was ein Mensch nicht kann)", excerpt: "Die KI analysiert HRV, Schlaf und Belastung in Echtzeit. Ein menschlicher Coach sieht dich einmal pro Woche. Darum ist die Zukunft beides." },
    p2: { title: "HRV und Belastung: Müdigkeit sehen, bevor du sie spürst", excerpt: "Was die drei Banister-Kurven — CTL, ATL, TSB — wirklich aussagen, wenn man sie mit deiner Morgen-HRV kreuzt, und was Pacevo daraus macht." },
    p3: { title: "Halbmarathon unter 1:45: wie der Plan entsteht", excerpt: "Schwellentempo, Intervalle, langer Lauf, Tapering: woher jede Einheit kommt und warum sie sich ändert, wenn deine Frische es tut." },
    p4: { title: "Body Battery morgens bei 20 %: trotzdem laufen?", excerpt: "Die Antwort hängt von deinem TSB, deiner Phase und der Einheit ab. Die KI entscheidet für dich — so geht's." },
    p5: { title: "Deinen ersten Ultra wählen: was Rennen wirklich unterscheidet", excerpt: "Höhenmeter, Cut-offs, Nachtabschnitte, Selbstversorgung, Qualifikation: die Kriterien, die entscheiden, ob ein Rennen zu dir passt — und die nicht veralten." },
    p6: { title: "Ghost Runner: Was ändert ein KI-Sprachcoach beim Laufen?", excerpt: "Zieltempo, Abweichung vom Plan und Hochrechnung — jeden Kilometer angesagt: was sich ändert, wenn du nicht mehr auf die Uhr schaust." },
    p7: { title: "Marathon-Verpflegung: was essen, wann und wie viel", excerpt: "Unser KI-Rechner berücksichtigt Schweißrate, Statur und Tempo für einen maßgeschneiderten Kohlenhydratplan." },
    p8: { title: "Trailschuhe: was vor der Marke wirklich zählt", excerpt: "Gewicht, Sprengung, Stollen, Passform: die vier Parameter, die entscheiden, und was die Literatur dazu sagt — auch dort, wo sie schweigt." },
    p9: { title: "Zu wenig essen: relatives Energiedefizit bei Läufern", excerpt: "Was der IOC-Konsens REDs nennt: wenn die Zufuhr das Training nicht mehr deckt, was das schädigt und welche Zeichen alarmieren sollten." },
    p10: { title: "Krafttraining: die Einheit, die schneller macht, ohne zu laufen", excerpt: "Einer der am besten belegten Zusammenhänge der Literatur — und die Einheit, die fast alle auslassen. Was sie verändert und wie sie aussieht." },
    p11: { title: "Menstruationszyklus und Training: was die Meta-Analyse wirklich sagt", excerpt: "Ein realer, aber kleiner und von Frau zu Frau stark schwankender Effekt. Warum starre Periodisierung daran vorbeigeht und was besser wirkt." },
  },
};

const es: BlogDict = {
  heroEyebrow: "El blog", heroTitleA: "Entiende, aprende, ", heroAccent: "progresa", heroSubtitle: "Lo que la ciencia del deporte y la inteligencia artificial pueden hacer por tu running.",
  cats: { ALL: "Todo", AI: "IA y Rendimiento", TRAINING: "Entrenamiento", NUTRITION: "Nutrición", HEALTH: "Salud del corredor", RACES: "Las carreras", GEAR: "Equipo" },
  readArticle: "Crear mi cuenta", lireArticle: "Leer el artículo", bientot: "Próximamente",
  manifesto: { label: "IA + entrenador = la combinación perfecta", humanLabel: "Entrenador humano", aiLabel: "IA Pacevo", human: ["Visión a largo plazo", "Motivación", "Experiencia de campo", "Ajuste táctico"], ai: ["Análisis 24/7", "VFC + sueño + carga", "Predicción de fatiga", "Plan en tiempo real"] },
  posts: {
    p1: { title: "Por qué la IA será tu mejor entrenador (y lo que un humano no puede hacer)", excerpt: "La IA analiza tu VFC, tu sueño y tu carga en tiempo real. Un entrenador humano te ve una vez por semana. Por eso el futuro son los dos." },
    p2: { title: "VFC y carga: ver llegar la fatiga antes de sentirla", excerpt: "Lo que dicen de verdad las tres curvas del modelo de Banister — CTL, ATL, TSB — cruzadas con tu VFC matinal, y qué hace Pacevo con ello." },
    p3: { title: "Media por debajo de 1h45: cómo se construye el plan", excerpt: "Ritmo umbral, series, tirada larga, afinamiento: de dónde sale cada sesión y por qué cambia cuando cambia tu frescura." },
    p4: { title: "Body Battery al 20 % por la mañana: ¿hay que correr igual?", excerpt: "La respuesta depende de tu TSB, tu fase de preparación y el tipo de sesión. La IA decide por ti — así lo hace." },
    p5: { title: "Elegir tu primer ultra: lo que de verdad diferencia las carreras", excerpt: "Desnivel, barreras horarias, noche, autonomía, clasificación: los criterios que deciden si una carrera te conviene — y que no caducan." },
    p6: { title: "Ghost Runner: ¿qué cambia correr con un entrenador de voz IA?", excerpt: "Ritmo objetivo, desvío respecto al plan y crono previsto anunciados cada kilómetro: lo que cambia cuando dejas de mirar el reloj." },
    p7: { title: "Avituallamiento de maratón: qué comer, cuándo y cuánto", excerpt: "Nuestra calculadora IA tiene en cuenta tu sudoración, tu complexión y tu ritmo para un plan de hidratos a medida." },
    p8: { title: "Zapatillas de trail: lo que cuenta antes que la marca", excerpt: "Peso, drop, tacos, horma: los cuatro parámetros que deciden, y lo que dice la literatura de cada uno — incluso donde no dice nada." },
    p9: { title: "Comer demasiado poco: el déficit energético relativo en el corredor", excerpt: "Lo que el consenso del COI llama REDs: cuando el aporte deja de cubrir el entrenamiento, qué daña y qué señales deben alertarte." },
    p10: { title: "La fuerza: la sesión que te hace correr más rápido sin correr", excerpt: "Uno de los vínculos mejor establecidos de la literatura — y la sesión que casi todo el mundo se salta. Qué cambia y cómo es." },
    p11: { title: "Ciclo menstrual y entrenamiento: lo que dice de verdad el metaanálisis", excerpt: "Un efecto real pero pequeño y muy variable entre mujeres. Por qué una periodización rígida se equivoca, y qué funciona mejor." },
  },
};

const pt: BlogDict = {
  heroEyebrow: "O blog", heroTitleA: "Compreende, aprende, ", heroAccent: "evolui", heroSubtitle: "O que a ciência do desporto e a inteligência artificial podem fazer pela tua corrida.",
  cats: { ALL: "Tudo", AI: "IA & Desempenho", TRAINING: "Treino", NUTRITION: "Nutrição", HEALTH: "Saúde do corredor", RACES: "As provas", GEAR: "Equipamento" },
  readArticle: "Criar a minha conta", lireArticle: "Ler o artigo", bientot: "Em breve",
  manifesto: { label: "IA + treinador = a combinação perfeita", humanLabel: "Treinador humano", aiLabel: "IA Pacevo", human: ["Visão a longo prazo", "Motivação", "Experiência no terreno", "Ajuste tático"], ai: ["Análise 24h/24", "VFC + sono + carga", "Previsão de fadiga", "Plano em tempo real"] },
  posts: {
    p1: { title: "Porque a IA será o teu melhor treinador (e o que um humano não consegue fazer)", excerpt: "A IA analisa a tua VFC, o teu sono e a tua carga em tempo real. Um treinador humano vê-te uma vez por semana. Por isso o futuro são os dois." },
    p2: { title: "VFC e carga: ver a fadiga chegar antes de a sentires", excerpt: "O que dizem realmente as três curvas do modelo de Banister — CTL, ATL, TSB — cruzadas com a tua VFC da manhã, e o que Pacevo faz com isso." },
    p3: { title: "Meia abaixo de 1h45: como se constrói o plano", excerpt: "Ritmo de limiar, séries, tirada longa, afinamento: de onde vem cada sessão e porque muda quando a tua frescura muda." },
    p4: { title: "Body Battery a 20 % de manhã: deves correr na mesma?", excerpt: "A resposta depende do teu TSB, da fase de preparação e do tipo de sessão. A IA decide por ti — eis como." },
    p5: { title: "Escolher o teu primeiro ultra: o que distingue mesmo as provas", excerpt: "Desnível, barreiras horárias, noite, autonomia, qualificação: os critérios que decidem se uma prova te serve — e que não ficam desatualizados." },
    p6: { title: "Ghost Runner: o que muda correr com um treinador de voz IA?", excerpt: "Ritmo alvo, desvio ao plano e tempo previsto anunciados a cada quilómetro: o que muda quando deixas de olhar para o relógio." },
    p7: { title: "Abastecimento de maratona: o que comer, quando e quanto", excerpt: "A nossa calculadora IA tem em conta a tua sudação, a tua constituição e o teu ritmo para um plano de hidratos à medida." },
    p8: { title: "Sapatilhas de trail: o que conta antes da marca", excerpt: "Peso, drop, pitons, forma: os quatro parâmetros que decidem, e o que a literatura diz de cada um — incluindo onde nada diz." },
    p9: { title: "Comer demasiado pouco: o défice energético relativo no corredor", excerpt: "O que o consenso do COI chama REDs: quando o aporte deixa de cobrir o treino, o que danifica e que sinais devem alertar-te." },
    p10: { title: "A força: a sessão que te faz correr mais depressa sem correr", excerpt: "Uma das ligações mais bem estabelecidas da literatura — e a sessão que quase toda a gente salta. O que muda e como é." },
    p11: { title: "Ciclo menstrual e treino: o que diz mesmo a meta-análise", excerpt: "Um efeito real mas pequeno e muito variável entre mulheres. Porque uma periodização rígida falha, e o que funciona melhor." },
  },
};

export const BLOG: Record<Lang, BlogDict> = { fr, en, de, es, pt };
