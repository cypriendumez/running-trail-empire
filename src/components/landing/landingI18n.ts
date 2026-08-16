import type { Lang } from "@/lib/i18n/translations";

// Dictionnaire de la landing publique (5 langues). Même pattern que les dicts par composant
// (races/trail). Les visuels (images, dégradés, prix, icônes) restent dans page.tsx ;
// ici uniquement les chaînes traduisibles.

export type LandingDict = {
  nav: { programs: string; features: string; pricing: string; blog: string; reviews: string; login: string; trial: string };
  // `badge` (« Nouveau · Ghost Runner vocal ») et `ctaSecondary` (« Voir la démo »,
  // qui menait à /login et non à une démo) ont été retirés du hero : une clé sans
  // rendu se traduit dans cinq langues et ne s'affiche nulle part.
  hero: { titleA: string; titleB: string; accent: string; subtitle: string; ctaPrimary: string; sync: string };
  // Un libellé par chiffre VÉRIFIABLE. `runners`, `rating` et `satisfaction`
  // n'existent plus : ils n'avaient aucune source.
  stats: { races: string; routes: string; plan: string; replan: string };
  programs: { eyebrow: string; title: string; subtitle: string; viewAll: string; cats: Record<string, string>; items: Record<string, { title: string; subtitle: string }> };
  // `badge` a disparu : douze pastilles d'un mot, chacune employée UNE fois, ne forment
  // pas une taxonomie — c'était de la décoration. Les fonctionnalités se répartissent
  // désormais entre trois PILIERS (ce qui distingue le produit) et des lignes.
  features: {
    eyebrow: string; title: string; subtitle: string;
    pillars: { title: string; desc: string; metric: string; metricLabel: string }[];
    items: { title: string; desc: string }[];
  };
  pricing: { eyebrow: string; title: string; subtitle: string; plans: { name: string; period: string; badge?: string; cta: string; features: string[] }[] };
  cta: { title: string; subtitle: string; primary: string; secondary: string; note: string };
};

export const PROGRAM_KEYS = ["km10", "semi", "marathon", "trail", "beginner", "speed", "endurance", "injury", "weightloss"] as const;
export const CATEGORY_CODES = ["ALL", "10KM", "SEMI", "MARATHON", "TRAIL", "BEGINNER", "SPEED", "ENDURANCE", "INJURY", "WEIGHT"] as const;

const fr: LandingDict = {
  nav: { programs: "Programmes", features: "Fonctionnalités", pricing: "Tarifs", blog: "Blog", reviews: "Avis", login: "Connexion", trial: "Essai gratuit" },
  hero: { titleA: "Cours plus loin,", titleB: "récupère ", accent: "plus vite", subtitle: "Un plan d'entraînement qui s'ajuste chaque jour à ta VFC, ton sommeil et ta charge réelle. Le coach intelligent du coureur exigeant.", ctaPrimary: "Commencer gratuitement", sync: "Synchro" },
  stats: { races: "Courses à venir", routes: "Parcours cartographiés", plan: "De plan glissant", replan: "Entre deux replanifications" },
  programs: {
    eyebrow: "Entraînement", title: "Des programmes pour chaque objectif", subtitle: "Du premier 5 km à l'ultra-trail — chaque plan s'adapte ensuite à tes données réelles.", viewAll: "Voir tout",
    cats: { ALL: "Tout voir", "10KM": "10 km", SEMI: "Semi", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Débutant", SPEED: "Vitesse", ENDURANCE: "Endurance", INJURY: "Blessure", WEIGHT: "Perte de poids" },
    items: {
      km10: { title: "10 KILOMÈTRES", subtitle: "De 6 semaines à 4 mois" },
      semi: { title: "SEMI-MARATHON", subtitle: "De 8 semaines à 12 mois" },
      marathon: { title: "MARATHON", subtitle: "De 8 semaines à 12 mois" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semaines à 12 mois" },
      beginner: { title: "DÉBUTER EN COURSE", subtitle: "De 4 semaines à 3 mois" },
      speed: { title: "AMÉLIORER SA VITESSE", subtitle: "De 4 à 12 semaines" },
      endurance: { title: "ENDURANCE DE BASE", subtitle: "De 6 semaines à 6 mois" },
      injury: { title: "REPRENDRE APRÈS BLESSURE", subtitle: "De 4 à 16 semaines" },
      weightloss: { title: "COURIR POUR PERDRE DU POIDS", subtitle: "Au maximum 0,75 % du poids par semaine" },
    },
  },
  features: {
    eyebrow: "Ce que fait Pacevo", title: "Le plan se refait tout seul. Toi, tu cours.",
    subtitle: "Chaque nuit et après chaque séance synchronisée, Pacevo relit ta charge, ta fraîcheur et ton objectif, puis réécrit les sept jours qui viennent.",
    pillars: [
      { metric: "10 min", metricLabel: "entre deux replanifications", title: "Le plan se replanifie seul",
        desc: "Une séance arrive de ta montre, le calcul repart : charge, fraîcheur, jours de repos, sortie longue. Sept jours glissants, toujours à jour." },
      { metric: "km / km", metricLabel: "coaching audio en direct", title: "Ghost Runner vocal",
        desc: "Une voix dans l'oreille pendant la séance : allure cible, écart au plan et chrono projeté, annoncés à chaque kilomètre." },
      { metric: "CTL · ATL · TSB", metricLabel: "modèle de Banister", title: "Charge et affûtage",
        desc: "Le ratio aigu:chronique déclenche l'allègement AVANT la blessure, et l'affûtage vise une fraîcheur positive le jour de la course." },
    ],
    items: [
      { title: "VFC et sommeil", desc: "VFC au réveil, sommeil profond et paradoxal, Body Battery : la fraîcheur du jour vient de mesures, pas d'un ressenti." },
      { title: "Sync Garmin, Coros, Strava", desc: "Activités, puissance, zones cardio et données de bien-être récupérées en continu via intervals.icu." },
      { title: "Météo réelle à ta position", desc: "Chaleur, humidité, vent et altitude : les allures cibles sont corrigées avant la séance, pas expliquées après." },
      { title: "Trail Builder", desc: "Tracé accroché aux sentiers réels, dénivelé calculé, export GPX vers la montre." },
      { title: "Smart Journal vocal", desc: "Raconte ta séance à voix haute : ce que tu dis pèse sur la prescription du lendemain." },
      { title: "14 000 courses à venir", desc: "Dates, distances et lien d'inscription — et ta préparation se cale sur la date que tu choisis." },
      { title: "Série et régularité", desc: "Un jour de repos prescrit et respecté entretient ta série au même titre qu'une séance faite." },
      { title: "Perte de poids encadrée", desc: "Déficit plafonné à 0,75 % du poids par semaine, et nul en dessous d'un IMC de 21." },
      { title: "Ligues et badges", desc: "Classement hebdomadaire Bronze → Élite, assis sur ta régularité et non sur ton volume." },
    ],
  },
  pricing: {
    eyebrow: "Tarification", title: "Simple et transparent", subtitle: "Commence gratuitement. Passe au Pro quand tu es prêt à performer.",
    plans: [
      { name: "Gratuit", period: "pour toujours", cta: "Commencer", features: ["Dashboard complet", "5 plans IA / mois", "Hub courses France", "Coaching basique"] },
      { name: "Pro", period: "/mois", badge: "Populaire", cta: "Essai 30 jours gratuit", features: ["Plans IA illimités", "Ghost Runner vocal", "Trail Builder SIG", "Sync Garmin / Coros", "Smart Journal", "Affûtage Banister"] },
      { name: "Annuel", period: "/an", badge: "−33%", cta: "Choisir l'annuel", features: ["Tout le Pro inclus", "Posture Lab Vision IA", "Accès API développeur", "Support prioritaire"] },
    ],
  },
  cta: { title: "Prêt à performer ?", subtitle: "Rejoins les coureurs qui s'entraînent plus intelligemment avec Pacevo.", primary: "Créer un compte gratuit", secondary: "Se connecter", note: "Gratuit · Sans carte bancaire · Annulable à tout moment" },
};

const en: LandingDict = {
  nav: { programs: "Programs", features: "Features", pricing: "Pricing", blog: "Blog", reviews: "Reviews", login: "Log in", trial: "Free trial" },
  hero: { titleA: "Run farther,", titleB: "recover ", accent: "faster", subtitle: "A training plan that adapts every day to your HRV, sleep and real load. The smart coach for serious runners.", ctaPrimary: "Start for free", sync: "Syncs with" },
  stats: { races: "Upcoming races", routes: "Mapped routes", plan: "Rolling plan", replan: "Between two replans" },
  programs: {
    eyebrow: "Training", title: "A program for every goal", subtitle: "From your first 5K to ultra-trail — each plan then adapts to your real data.", viewAll: "View all",
    cats: { ALL: "View all", "10KM": "10K", SEMI: "Half", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Beginner", SPEED: "Speed", ENDURANCE: "Endurance", INJURY: "Injury", WEIGHT: "Weight loss" },
    items: {
      km10: { title: "10 KILOMETRES", subtitle: "From 6 weeks to 4 months" },
      semi: { title: "HALF MARATHON", subtitle: "From 8 weeks to 12 months" },
      marathon: { title: "MARATHON", subtitle: "From 8 weeks to 12 months" },
      trail: { title: "TRAIL RUNNING", subtitle: "From 6 weeks to 12 months" },
      beginner: { title: "START RUNNING", subtitle: "From 4 weeks to 3 months" },
      speed: { title: "IMPROVE YOUR SPEED", subtitle: "From 4 to 12 weeks" },
      endurance: { title: "BASE ENDURANCE", subtitle: "From 6 weeks to 6 months" },
      injury: { title: "RETURN FROM INJURY", subtitle: "From 4 to 16 weeks" },
      weightloss: { title: "RUN TO LOSE WEIGHT", subtitle: "At most 0.75% of body weight per week" },
    },
  },
  features: {
    eyebrow: "What Pacevo does", title: "The plan rewrites itself. You just run.",
    subtitle: "Every night and after every synced session, Pacevo re-reads your load, your freshness and your goal, then rewrites the next seven days.",
    pillars: [
      { metric: "10 min", metricLabel: "between two replans", title: "The plan replans itself",
        desc: "A session lands from your watch and the maths restarts: load, freshness, rest days, long run. Seven rolling days, always current." },
      { metric: "km / km", metricLabel: "live audio coaching", title: "Voice Ghost Runner",
        desc: "A voice in your ear during the session: target pace, gap to plan and projected finish, called out every kilometre." },
      { metric: "CTL · ATL · TSB", metricLabel: "Banister model", title: "Load and tapering",
        desc: "The acute:chronic ratio triggers the cutback BEFORE the injury, and the taper aims for positive freshness on race day." },
    ],
    items: [
      { title: "HRV and sleep", desc: "Morning HRV, deep and REM sleep, Body Battery: today's freshness comes from measurements, not from a feeling." },
      { title: "Garmin, Coros, Strava sync", desc: "Activities, power, heart-rate zones and wellness data pulled continuously through intervals.icu." },
      { title: "Real weather at your location", desc: "Heat, humidity, wind and altitude: target paces are corrected before the session, not explained after it." },
      { title: "Trail Builder", desc: "Route snapped to real paths, elevation computed, GPX export straight to your watch." },
      { title: "Voice Smart Journal", desc: "Talk through your session out loud: what you say weighs on tomorrow's prescription." },
      { title: "14,000 upcoming races", desc: "Dates, distances and the sign-up link — and your build lines up with the date you pick." },
      { title: "Streak and consistency", desc: "A prescribed rest day you respect keeps your streak alive exactly like a session done." },
      { title: "Guard-railed weight loss", desc: "Deficit capped at 0.75% of body weight per week, and zero below a BMI of 21." },
      { title: "Leagues and badges", desc: "Weekly Bronze to Elite ranking, built on your consistency rather than your mileage." },
    ],
  },
  pricing: {
    eyebrow: "Pricing", title: "Simple and transparent", subtitle: "Start for free. Go Pro when you're ready to perform.",
    plans: [
      { name: "Free", period: "forever", cta: "Get started", features: ["Full dashboard", "5 AI plans / month", "France race hub", "Basic coaching"] },
      { name: "Pro", period: "/month", badge: "Popular", cta: "30-day free trial", features: ["Unlimited AI plans", "Voice Ghost Runner", "GIS Trail Builder", "Garmin / Coros sync", "Smart Journal", "Banister Tapering"] },
      { name: "Annual", period: "/year", badge: "−33%", cta: "Choose annual", features: ["Everything in Pro", "Posture Lab AI Vision", "Developer API access", "Priority support"] },
    ],
  },
  cta: { title: "Ready to perform?", subtitle: "Join the runners training smarter with Pacevo.", primary: "Create a free account", secondary: "Log in", note: "Free · No credit card · Cancel anytime" },
};

const de: LandingDict = {
  nav: { programs: "Programme", features: "Funktionen", pricing: "Preise", blog: "Blog", reviews: "Bewertungen", login: "Anmelden", trial: "Gratis testen" },
  hero: { titleA: "Lauf weiter,", titleB: "erhol dich ", accent: "schneller", subtitle: "Ein Trainingsplan, der sich täglich an deine HRV, deinen Schlaf und deine echte Belastung anpasst. Der smarte Coach für ambitionierte Läufer.", ctaPrimary: "Kostenlos starten", sync: "Synchron mit" },
  stats: { races: "Kommende Rennen", routes: "Kartierte Strecken", plan: "Rollierender Plan", replan: "Zwischen zwei Neuplanungen" },
  programs: {
    eyebrow: "Training", title: "Ein Programm für jedes Ziel", subtitle: "Vom ersten 5-km-Lauf bis zum Ultra-Trail — jeder Plan passt sich dann an deine echten Daten an.", viewAll: "Alle ansehen",
    cats: { ALL: "Alle", "10KM": "10 km", SEMI: "Halb", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Einsteiger", SPEED: "Tempo", ENDURANCE: "Ausdauer", INJURY: "Verletzung", WEIGHT: "Abnehmen" },
    items: {
      km10: { title: "10 KILOMETER", subtitle: "Von 6 Wochen bis 4 Monate" },
      semi: { title: "HALBMARATHON", subtitle: "Von 8 Wochen bis 12 Monate" },
      marathon: { title: "MARATHON", subtitle: "Von 8 Wochen bis 12 Monate" },
      trail: { title: "TRAIL RUNNING", subtitle: "Von 6 Wochen bis 12 Monate" },
      beginner: { title: "LAUFEN STARTEN", subtitle: "Von 4 Wochen bis 3 Monate" },
      speed: { title: "TEMPO VERBESSERN", subtitle: "Von 4 bis 12 Wochen" },
      endurance: { title: "GRUNDLAGENAUSDAUER", subtitle: "Von 6 Wochen bis 6 Monate" },
      injury: { title: "COMEBACK NACH VERLETZUNG", subtitle: "Von 4 bis 16 Wochen" },
      weightloss: { title: "LAUFEN, UM ABZUNEHMEN", subtitle: "Höchstens 0,75 % des Körpergewichts pro Woche" },
    },
  },
  features: {
    eyebrow: "Was Pacevo tut", title: "Der Plan schreibt sich neu. Du läufst einfach.",
    subtitle: "Jede Nacht und nach jeder synchronisierten Einheit liest Pacevo deine Belastung, deine Frische und dein Ziel neu — und schreibt die nächsten sieben Tage neu.",
    pillars: [
      { metric: "10 Min", metricLabel: "zwischen zwei Neuplanungen", title: "Der Plan plant sich selbst",
        desc: "Eine Einheit trifft von der Uhr ein, die Rechnung startet neu: Belastung, Frische, Ruhetage, langer Lauf. Sieben rollierende Tage, immer aktuell." },
      { metric: "km / km", metricLabel: "Audio-Coaching in Echtzeit", title: "Ghost Runner mit Stimme",
        desc: "Eine Stimme im Ohr während der Einheit: Zieltempo, Abweichung vom Plan und Hochrechnung — bei jedem Kilometer angesagt." },
      { metric: "CTL · ATL · TSB", metricLabel: "Banister-Modell", title: "Belastung und Tapering",
        desc: "Das Akut-zu-chronisch-Verhältnis löst die Entlastung VOR der Verletzung aus, und das Tapering zielt auf positive Frische am Wettkampftag." },
    ],
    items: [
      { title: "HRV und Schlaf", desc: "HRV am Morgen, Tief- und REM-Schlaf, Body Battery: die Frische des Tages kommt aus Messungen, nicht aus einem Gefühl." },
      { title: "Sync mit Garmin, Coros, Strava", desc: "Aktivitäten, Leistung, Herzfrequenzzonen und Wellness-Daten laufend über intervals.icu geholt." },
      { title: "Echtes Wetter an deinem Ort", desc: "Hitze, Feuchte, Wind und Höhe: Zieltempi werden vor der Einheit korrigiert, nicht danach erklärt." },
      { title: "Trail Builder", desc: "Strecke auf echte Wege gerastet, Höhenmeter berechnet, GPX-Export direkt auf die Uhr." },
      { title: "Smart Journal per Stimme", desc: "Erzähl deine Einheit laut: was du sagst, wiegt in der Verordnung von morgen." },
      { title: "14 000 kommende Rennen", desc: "Termine, Distanzen und Anmeldelink — und dein Aufbau richtet sich nach dem Datum, das du wählst." },
      { title: "Serie und Regelmäßigkeit", desc: "Ein verordneter und eingehaltener Ruhetag hält deine Serie genauso am Leben wie eine absolvierte Einheit." },
      { title: "Abnehmen mit Leitplanken", desc: "Defizit gedeckelt auf 0,75 % des Körpergewichts pro Woche, und null unter einem BMI von 21." },
      { title: "Ligen und Abzeichen", desc: "Wöchentliche Wertung Bronze bis Elite, gebaut auf deine Regelmäßigkeit statt auf deine Kilometer." },
    ],
  },
  pricing: {
    eyebrow: "Preise", title: "Einfach und transparent", subtitle: "Starte kostenlos. Wechsle zu Pro, wenn du bereit bist zu performen.",
    plans: [
      { name: "Gratis", period: "für immer", cta: "Loslegen", features: ["Komplettes Dashboard", "5 KI-Pläne / Monat", "Rennen-Hub Frankreich", "Basis-Coaching"] },
      { name: "Pro", period: "/Monat", badge: "Beliebt", cta: "30 Tage gratis testen", features: ["Unbegrenzte KI-Pläne", "Voice Ghost Runner", "GIS Trail Builder", "Garmin- / Coros-Sync", "Smart Journal", "Banister-Tapering"] },
      { name: "Jährlich", period: "/Jahr", badge: "−33%", cta: "Jährlich wählen", features: ["Alles aus Pro", "Posture Lab KI-Vision", "Entwickler-API-Zugang", "Priorisierter Support"] },
    ],
  },
  cta: { title: "Bereit für Leistung?", subtitle: "Schließe dich den Läufern an, die mit Pacevo smarter trainieren.", primary: "Kostenloses Konto erstellen", secondary: "Anmelden", note: "Gratis · Keine Kreditkarte · Jederzeit kündbar" },
};

const es: LandingDict = {
  nav: { programs: "Programas", features: "Funciones", pricing: "Precios", blog: "Blog", reviews: "Opiniones", login: "Iniciar sesión", trial: "Prueba gratis" },
  hero: { titleA: "Corre más lejos,", titleB: "recupérate ", accent: "más rápido", subtitle: "Un plan de entrenamiento que se ajusta cada día a tu VFC, tu sueño y tu carga real. El entrenador inteligente del corredor exigente.", ctaPrimary: "Empezar gratis", sync: "Sincroniza con" },
  stats: { races: "Carreras próximas", routes: "Rutas cartografiadas", plan: "De plan deslizante", replan: "Entre dos replanificaciones" },
  programs: {
    eyebrow: "Entrenamiento", title: "Un programa para cada objetivo", subtitle: "Desde tu primer 5K hasta el ultra-trail — cada plan se adapta luego a tus datos reales.", viewAll: "Ver todo",
    cats: { ALL: "Ver todo", "10KM": "10 km", SEMI: "Media", MARATHON: "Maratón", TRAIL: "Trail", BEGINNER: "Principiante", SPEED: "Velocidad", ENDURANCE: "Resistencia", INJURY: "Lesión", WEIGHT: "Pérdida de peso" },
    items: {
      km10: { title: "10 KILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
      semi: { title: "MEDIA MARATÓN", subtitle: "De 8 semanas a 12 meses" },
      marathon: { title: "MARATÓN", subtitle: "De 8 semanas a 12 meses" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semanas a 12 meses" },
      beginner: { title: "EMPEZAR A CORRER", subtitle: "De 4 semanas a 3 meses" },
      speed: { title: "MEJORAR TU VELOCIDAD", subtitle: "De 4 a 12 semanas" },
      endurance: { title: "RESISTENCIA DE BASE", subtitle: "De 6 semanas a 6 meses" },
      injury: { title: "VOLVER TRAS UNA LESIÓN", subtitle: "De 4 a 16 semanas" },
      weightloss: { title: "CORRER PARA PERDER PESO", subtitle: "Como máximo 0,75 % del peso por semana" },
    },
  },
  features: {
    eyebrow: "Lo que hace Pacevo", title: "El plan se rehace solo. Tú solo corres.",
    subtitle: "Cada noche y tras cada sesión sincronizada, Pacevo relee tu carga, tu frescura y tu objetivo, y reescribe los siete días siguientes.",
    pillars: [
      { metric: "10 min", metricLabel: "entre dos replanificaciones", title: "El plan se replanifica solo",
        desc: "Llega una sesión desde tu reloj y el cálculo vuelve a empezar: carga, frescura, días de descanso, tirada larga. Siete días deslizantes, siempre al día." },
      { metric: "km / km", metricLabel: "coaching de voz en directo", title: "Ghost Runner por voz",
        desc: "Una voz al oído durante la sesión: ritmo objetivo, desvío del plan y crono proyectado, anunciados en cada kilómetro." },
      { metric: "CTL · ATL · TSB", metricLabel: "modelo de Banister", title: "Carga y afinamiento",
        desc: "La ratio agudo:crónico dispara la descarga ANTES de la lesión, y el afinamiento busca frescura positiva el día de la carrera." },
    ],
    items: [
      { title: "VFC y sueño", desc: "VFC al despertar, sueño profundo y REM, Body Battery: la frescura del día sale de medidas, no de una sensación." },
      { title: "Sync Garmin, Coros, Strava", desc: "Actividades, potencia, zonas cardio y datos de bienestar recogidos en continuo vía intervals.icu." },
      { title: "Meteo real en tu posición", desc: "Calor, humedad, viento y altitud: los ritmos objetivo se corrigen antes de la sesión, no se explican después." },
      { title: "Trail Builder", desc: "Trazado pegado a senderos reales, desnivel calculado, exportación GPX directa al reloj." },
      { title: "Smart Journal por voz", desc: "Cuenta tu sesión en voz alta: lo que dices pesa en la prescripción de mañana." },
      { title: "14 000 carreras próximas", desc: "Fechas, distancias y enlace de inscripción — y tu preparación se ajusta a la fecha que elijas." },
      { title: "Racha y regularidad", desc: "Un día de descanso prescrito y respetado mantiene tu racha igual que una sesión hecha." },
      { title: "Pérdida de peso con límites", desc: "Déficit limitado al 0,75 % del peso por semana, y nulo por debajo de un IMC de 21." },
      { title: "Ligas e insignias", desc: "Clasificación semanal Bronce a Élite, basada en tu regularidad y no en tu volumen." },
    ],
  },
  pricing: {
    eyebrow: "Precios", title: "Simple y transparente", subtitle: "Empieza gratis. Pasa a Pro cuando estés listo para rendir.",
    plans: [
      { name: "Gratis", period: "para siempre", cta: "Empezar", features: ["Dashboard completo", "5 planes IA / mes", "Hub de carreras Francia", "Coaching básico"] },
      { name: "Pro", period: "/mes", badge: "Popular", cta: "Prueba 30 días gratis", features: ["Planes IA ilimitados", "Ghost Runner por voz", "Trail Builder SIG", "Sync Garmin / Coros", "Smart Journal", "Afinamiento Banister"] },
      { name: "Anual", period: "/año", badge: "−33%", cta: "Elegir anual", features: ["Todo lo de Pro", "Posture Lab IA Visión", "Acceso API desarrollador", "Soporte prioritario"] },
    ],
  },
  cta: { title: "¿Listo para rendir?", subtitle: "Únete a los corredores que entrenan de forma más inteligente con Pacevo.", primary: "Crear cuenta gratis", secondary: "Iniciar sesión", note: "Gratis · Sin tarjeta · Cancela cuando quieras" },
};

const pt: LandingDict = {
  nav: { programs: "Programas", features: "Funcionalidades", pricing: "Preços", blog: "Blog", reviews: "Avaliações", login: "Entrar", trial: "Teste grátis" },
  hero: { titleA: "Corre mais longe,", titleB: "recupera ", accent: "mais rápido", subtitle: "Um plano de treino que se ajusta todos os dias à tua VFC, ao teu sono e à tua carga real. O treinador inteligente do corredor exigente.", ctaPrimary: "Começar grátis", sync: "Sincroniza com" },
  stats: { races: "Provas futuras", routes: "Percursos cartografados", plan: "De plano deslizante", replan: "Entre duas replanificações" },
  programs: {
    eyebrow: "Treino", title: "Um programa para cada objetivo", subtitle: "Do teu primeiro 5K ao ultra-trail — cada plano adapta-se depois aos teus dados reais.", viewAll: "Ver tudo",
    cats: { ALL: "Ver tudo", "10KM": "10 km", SEMI: "Meia", MARATHON: "Maratona", TRAIL: "Trail", BEGINNER: "Iniciante", SPEED: "Velocidade", ENDURANCE: "Resistência", INJURY: "Lesão", WEIGHT: "Perda de peso" },
    items: {
      km10: { title: "10 QUILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
      semi: { title: "MEIA MARATONA", subtitle: "De 8 semanas a 12 meses" },
      marathon: { title: "MARATONA", subtitle: "De 8 semanas a 12 meses" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semanas a 12 meses" },
      beginner: { title: "COMEÇAR A CORRER", subtitle: "De 4 semanas a 3 meses" },
      speed: { title: "MELHORAR A VELOCIDADE", subtitle: "De 4 a 12 semanas" },
      endurance: { title: "RESISTÊNCIA DE BASE", subtitle: "De 6 semanas a 6 meses" },
      injury: { title: "REGRESSAR DE LESÃO", subtitle: "De 4 a 16 semanas" },
      weightloss: { title: "CORRER PARA PERDER PESO", subtitle: "No máximo 0,75 % do peso por semana" },
    },
  },
  features: {
    eyebrow: "O que o Pacevo faz", title: "O plano refaz-se sozinho. Tu só corres.",
    subtitle: "Todas as noites e após cada sessão sincronizada, o Pacevo relê a tua carga, a tua frescura e o teu objetivo, e reescreve os sete dias seguintes.",
    pillars: [
      { metric: "10 min", metricLabel: "entre duas replanificações", title: "O plano replanifica-se sozinho",
        desc: "Chega uma sessão do teu relógio e o cálculo recomeça: carga, frescura, dias de descanso, tirada longa. Sete dias deslizantes, sempre atuais." },
      { metric: "km / km", metricLabel: "treino por voz em direto", title: "Ghost Runner por voz",
        desc: "Uma voz ao ouvido durante a sessão: ritmo alvo, desvio ao plano e tempo projetado, anunciados a cada quilómetro." },
      { metric: "CTL · ATL · TSB", metricLabel: "modelo de Banister", title: "Carga e afinamento",
        desc: "O rácio agudo:crónico despoleta o alívio ANTES da lesão, e o afinamento procura frescura positiva no dia da prova." },
    ],
    items: [
      { title: "VFC e sono", desc: "VFC ao acordar, sono profundo e REM, Body Battery: a frescura do dia vem de medições, não de uma sensação." },
      { title: "Sync Garmin, Coros, Strava", desc: "Atividades, potência, zonas cardio e dados de bem-estar recolhidos em contínuo via intervals.icu." },
      { title: "Meteorologia real na tua posição", desc: "Calor, humidade, vento e altitude: os ritmos alvo são corrigidos antes da sessão, não explicados depois." },
      { title: "Trail Builder", desc: "Traçado colado a trilhos reais, desnível calculado, exportação GPX direta para o relógio." },
      { title: "Smart Journal por voz", desc: "Conta a tua sessão em voz alta: o que dizes pesa na prescrição de amanhã." },
      { title: "14 000 provas futuras", desc: "Datas, distâncias e link de inscrição — e a tua preparação alinha-se pela data que escolheres." },
      { title: "Série e regularidade", desc: "Um dia de descanso prescrito e cumprido mantém a tua série tal como uma sessão feita." },
      { title: "Perda de peso com limites", desc: "Défice limitado a 0,75 % do peso por semana, e nulo abaixo de um IMC de 21." },
      { title: "Ligas e distintivos", desc: "Classificação semanal Bronze a Elite, assente na tua regularidade e não no teu volume." },
    ],
  },
  pricing: {
    eyebrow: "Preços", title: "Simples e transparente", subtitle: "Começa grátis. Passa para Pro quando estiveres pronto para performar.",
    plans: [
      { name: "Grátis", period: "para sempre", cta: "Começar", features: ["Dashboard completo", "5 planos IA / mês", "Hub de provas França", "Coaching básico"] },
      { name: "Pro", period: "/mês", badge: "Popular", cta: "Teste 30 dias grátis", features: ["Planos IA ilimitados", "Ghost Runner por voz", "Trail Builder SIG", "Sync Garmin / Coros", "Smart Journal", "Afinamento Banister"] },
      { name: "Anual", period: "/ano", badge: "−33%", cta: "Escolher anual", features: ["Tudo do Pro", "Posture Lab IA Visão", "Acesso API programador", "Suporte prioritário"] },
    ],
  },
  cta: { title: "Pronto para performar?", subtitle: "Junta-te aos corredores que treinam de forma mais inteligente com a Pacevo.", primary: "Criar conta grátis", secondary: "Entrar", note: "Grátis · Sem cartão · Cancela quando quiseres" },
};

export const LANDING: Record<Lang, LandingDict> = { fr, en, de, es, pt };
