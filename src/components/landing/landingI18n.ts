import type { Lang } from "@/lib/i18n/translations";

// Dictionnaire de la landing publique (5 langues). Même pattern que les dicts par composant
// (races/trail). Les visuels (images, dégradés, prix, icônes) restent dans page.tsx ;
// ici uniquement les chaînes traduisibles.

export type LandingDict = {
  nav: { programs: string; features: string; pricing: string; blog: string; reviews: string; login: string; trial: string };
  hero: { badge: string; titleA: string; titleB: string; accent: string; subtitle: string; ctaPrimary: string; ctaSecondary: string; sync: string };
  stats: { runners: string; rating: string; satisfaction: string; races: string };
  programs: { eyebrow: string; title: string; subtitle: string; viewAll: string; cats: Record<string, string>; items: Record<string, { title: string; subtitle: string }> };
  features: { eyebrow: string; title: string; subtitle: string; items: { title: string; desc: string; badge: string }[] };
  coaching: { badge: string; title: string; subtitle: string; cta: string; pills: { t: string; d: string }[] };
  pricing: { eyebrow: string; title: string; subtitle: string; plans: { name: string; period: string; badge?: string; cta: string; features: string[] }[] };
  cta: { title: string; subtitle: string; primary: string; secondary: string; note: string };
};

export const PROGRAM_KEYS = ["km10", "semi", "marathon", "trail", "beginner", "speed", "endurance", "injury"] as const;
export const CATEGORY_CODES = ["ALL", "10KM", "SEMI", "MARATHON", "TRAIL", "BEGINNER", "SPEED", "ENDURANCE", "INJURY"] as const;

const fr: LandingDict = {
  nav: { programs: "Programmes", features: "Fonctionnalités", pricing: "Tarifs", blog: "Blog", reviews: "Avis", login: "Connexion", trial: "Essai gratuit" },
  hero: { badge: "Nouveau · Ghost Runner vocal", titleA: "Cours plus loin,", titleB: "récupère ", accent: "plus vite", subtitle: "Un plan d'entraînement qui s'ajuste chaque jour à ta VFC, ton sommeil et ta charge réelle. Le coach intelligent du coureur exigeant.", ctaPrimary: "Commencer gratuitement", ctaSecondary: "Voir la démo", sync: "Synchro" },
  stats: { runners: "Coureurs actifs", rating: "Note moyenne", satisfaction: "Satisfaction", races: "Courses référencées" },
  programs: {
    eyebrow: "Entraînement", title: "Des programmes pour chaque objectif", subtitle: "Du premier 5 km à l'ultra-trail — chaque plan s'adapte ensuite à tes données réelles.", viewAll: "Voir tout",
    cats: { ALL: "Tout voir", "10KM": "10 km", SEMI: "Semi", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Débutant", SPEED: "Vitesse", ENDURANCE: "Endurance", INJURY: "Blessure" },
    items: {
      km10: { title: "10 KILOMÈTRES", subtitle: "De 6 semaines à 4 mois" },
      semi: { title: "SEMI-MARATHON", subtitle: "De 8 semaines à 12 mois" },
      marathon: { title: "MARATHON", subtitle: "De 8 semaines à 12 mois" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semaines à 12 mois" },
      beginner: { title: "DÉBUTER EN COURSE", subtitle: "De 4 semaines à 3 mois" },
      speed: { title: "AMÉLIORER SA VITESSE", subtitle: "De 4 à 12 semaines" },
      endurance: { title: "ENDURANCE DE BASE", subtitle: "De 6 semaines à 6 mois" },
      injury: { title: "REPRENDRE APRÈS BLESSURE", subtitle: "De 4 à 16 semaines" },
    },
  },
  features: {
    eyebrow: "Plateforme complète", title: "Tout ce dont un coureur a besoin", subtitle: "Une suite d'outils pensés pour la performance — de l'analyse physiologique au coaching vocal en temps réel.",
    items: [
      { title: "Coaching IA", desc: "Un plan recalculé chaque semaine selon ta VFC, ton sommeil et ta charge réelle.", badge: "Essentiel" },
      { title: "Analyse VFC & HRV", desc: "HRV quotidien, Body Battery, score de récupération. Sync Garmin & Coros.", badge: "Santé" },
      { title: "Ghost Runner vocal", desc: "Coach audio en temps réel : allure cible, écart au plan, chrono live km/km.", badge: "Exclusif" },
      { title: "Trail Builder SIG", desc: "Carte IGN, tracé snap-to-path, dénivelé auto, export GPX Garmin/Coros.", badge: "Trail" },
      { title: "Affûtage Banister", desc: "CTL/ATL/TSB en temps réel. TSB optimal le jour de course, automatiquement.", badge: "Élite" },
      { title: "Suivi du sommeil", desc: "Deep / REM / Light, Body Battery au réveil. L'IA décide si tu peux pousser.", badge: "Récup" },
      { title: "Sync Garmin & Coros", desc: "Activités, puissance, zones cardio et wellness synchronisés en continu.", badge: "Connecté" },
      { title: "Météo & performance", desc: "Impact chaleur, humidité et vent. Objectifs de séance ajustés en direct.", badge: "Intelligent" },
      { title: "Smart Journal vocal", desc: "Raconte ta séance, l'IA détecte ta fatigue mentale et adapte ton plan.", badge: "Mental" },
      { title: "Ligues & badges", desc: "Compétition hebdo, classement Bronze → Élite, score de discipline.", badge: "Social" },
      { title: "Shopping Hub", desc: "Comparateur i-Run, Alltricks, Lepape. La chaussure idéale pour ta foulée.", badge: "Équipement" },
      { title: "Guardian Mode", desc: "Détection de chute, alerte des contacts d'urgence avec ta position GPS.", badge: "Sécurité" },
    ],
  },
  coaching: {
    badge: "Coaching IA", title: "L'intelligence au cœur de ta préparation.", subtitle: "Pacevo analyse ta VFC, ton sommeil et ta charge d'entraînement pour adapter ton plan en temps réel — plus réactif qu'un coach humain.", cta: "Commencer gratuitement",
    pills: [
      { t: "Analyse VFC quotidienne", d: "HRV, Body Battery et score de récupération synchronisés Garmin & Coros." },
      { t: "Plan adaptatif", d: "Ajustement automatique de la charge selon ton état physiologique du jour." },
      { t: "Ghost Runner vocal", d: "Coaching audio temps réel avec prédiction de chrono kilomètre par kilomètre." },
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
  hero: { badge: "New · Voice Ghost Runner", titleA: "Run farther,", titleB: "recover ", accent: "faster", subtitle: "A training plan that adapts every day to your HRV, sleep and real load. The smart coach for serious runners.", ctaPrimary: "Start for free", ctaSecondary: "Watch demo", sync: "Syncs with" },
  stats: { runners: "Active runners", rating: "Average rating", satisfaction: "Satisfaction", races: "Races listed" },
  programs: {
    eyebrow: "Training", title: "A program for every goal", subtitle: "From your first 5K to ultra-trail — each plan then adapts to your real data.", viewAll: "View all",
    cats: { ALL: "View all", "10KM": "10K", SEMI: "Half", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Beginner", SPEED: "Speed", ENDURANCE: "Endurance", INJURY: "Injury" },
    items: {
      km10: { title: "10 KILOMETRES", subtitle: "From 6 weeks to 4 months" },
      semi: { title: "HALF MARATHON", subtitle: "From 8 weeks to 12 months" },
      marathon: { title: "MARATHON", subtitle: "From 8 weeks to 12 months" },
      trail: { title: "TRAIL RUNNING", subtitle: "From 6 weeks to 12 months" },
      beginner: { title: "START RUNNING", subtitle: "From 4 weeks to 3 months" },
      speed: { title: "IMPROVE YOUR SPEED", subtitle: "From 4 to 12 weeks" },
      endurance: { title: "BASE ENDURANCE", subtitle: "From 6 weeks to 6 months" },
      injury: { title: "RETURN FROM INJURY", subtitle: "From 4 to 16 weeks" },
    },
  },
  features: {
    eyebrow: "Complete platform", title: "Everything a runner needs", subtitle: "A suite of tools built for performance — from physiological analysis to real-time voice coaching.",
    items: [
      { title: "AI Coaching", desc: "A plan recomputed every week from your HRV, sleep and real training load.", badge: "Essential" },
      { title: "HRV & Recovery", desc: "Daily HRV, Body Battery, recovery score. Syncs with Garmin & Coros.", badge: "Health" },
      { title: "Voice Ghost Runner", desc: "Real-time audio coach: target pace, gap to plan, live splits km by km.", badge: "Exclusive" },
      { title: "GIS Trail Builder", desc: "Topo map, snap-to-path routing, auto elevation, GPX export to Garmin/Coros.", badge: "Trail" },
      { title: "Banister Tapering", desc: "Real-time CTL/ATL/TSB. Optimal TSB on race day, automatically.", badge: "Elite" },
      { title: "Sleep tracking", desc: "Deep / REM / Light, Body Battery on waking. The AI decides if you can push.", badge: "Recovery" },
      { title: "Garmin & Coros sync", desc: "Activities, power, heart-rate zones and wellness synced continuously.", badge: "Connected" },
      { title: "Weather & performance", desc: "Heat, humidity and wind impact. Session targets adjusted live.", badge: "Smart" },
      { title: "Voice Smart Journal", desc: "Talk through your session; the AI detects mental fatigue and adapts your plan.", badge: "Mental" },
      { title: "Leagues & badges", desc: "Weekly competition, Bronze → Elite ranking, discipline score.", badge: "Social" },
      { title: "Shopping Hub", desc: "Compare i-Run, Alltricks, Lepape. The right shoe for your stride.", badge: "Gear" },
      { title: "Guardian Mode", desc: "Fall detection, alerts your emergency contacts with your GPS location.", badge: "Safety" },
    ],
  },
  coaching: {
    badge: "AI Coaching", title: "Intelligence at the heart of your prep.", subtitle: "Pacevo analyses your HRV, sleep and training load to adapt your plan in real time — more responsive than a human coach.", cta: "Start for free",
    pills: [
      { t: "Daily HRV analysis", d: "HRV, Body Battery and recovery score synced from Garmin & Coros." },
      { t: "Adaptive plan", d: "Load automatically adjusted to your physiological state of the day." },
      { t: "Voice Ghost Runner", d: "Real-time audio coaching with finish-time prediction, km by km." },
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
  hero: { badge: "Neu · Voice Ghost Runner", titleA: "Lauf weiter,", titleB: "erhol dich ", accent: "schneller", subtitle: "Ein Trainingsplan, der sich täglich an deine HRV, deinen Schlaf und deine echte Belastung anpasst. Der smarte Coach für ambitionierte Läufer.", ctaPrimary: "Kostenlos starten", ctaSecondary: "Demo ansehen", sync: "Synchron mit" },
  stats: { runners: "Aktive Läufer", rating: "Ø-Bewertung", satisfaction: "Zufriedenheit", races: "Gelistete Rennen" },
  programs: {
    eyebrow: "Training", title: "Ein Programm für jedes Ziel", subtitle: "Vom ersten 5-km-Lauf bis zum Ultra-Trail — jeder Plan passt sich dann an deine echten Daten an.", viewAll: "Alle ansehen",
    cats: { ALL: "Alle", "10KM": "10 km", SEMI: "Halb", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Einsteiger", SPEED: "Tempo", ENDURANCE: "Ausdauer", INJURY: "Verletzung" },
    items: {
      km10: { title: "10 KILOMETER", subtitle: "Von 6 Wochen bis 4 Monate" },
      semi: { title: "HALBMARATHON", subtitle: "Von 8 Wochen bis 12 Monate" },
      marathon: { title: "MARATHON", subtitle: "Von 8 Wochen bis 12 Monate" },
      trail: { title: "TRAIL RUNNING", subtitle: "Von 6 Wochen bis 12 Monate" },
      beginner: { title: "LAUFEN STARTEN", subtitle: "Von 4 Wochen bis 3 Monate" },
      speed: { title: "TEMPO VERBESSERN", subtitle: "Von 4 bis 12 Wochen" },
      endurance: { title: "GRUNDLAGENAUSDAUER", subtitle: "Von 6 Wochen bis 6 Monate" },
      injury: { title: "COMEBACK NACH VERLETZUNG", subtitle: "Von 4 bis 16 Wochen" },
    },
  },
  features: {
    eyebrow: "Komplette Plattform", title: "Alles, was ein Läufer braucht", subtitle: "Ein Werkzeugkasten für Leistung — von der physiologischen Analyse bis zum Echtzeit-Sprachcoaching.",
    items: [
      { title: "KI-Coaching", desc: "Ein Plan, der wöchentlich aus HRV, Schlaf und echter Belastung neu berechnet wird.", badge: "Essenziell" },
      { title: "HRV & Erholung", desc: "Tägliche HRV, Body Battery, Erholungs-Score. Sync mit Garmin & Coros.", badge: "Gesundheit" },
      { title: "Voice Ghost Runner", desc: "Echtzeit-Audiocoach: Zieltempo, Abweichung, Live-Splits km für km.", badge: "Exklusiv" },
      { title: "GIS Trail Builder", desc: "Topo-Karte, Snap-to-Path, Auto-Höhenmeter, GPX-Export zu Garmin/Coros.", badge: "Trail" },
      { title: "Banister-Tapering", desc: "CTL/ATL/TSB in Echtzeit. Optimaler TSB am Wettkampftag, automatisch.", badge: "Elite" },
      { title: "Schlaf-Tracking", desc: "Tief / REM / Leicht, Body Battery beim Aufwachen. Die KI entscheidet, ob du pushen kannst.", badge: "Erholung" },
      { title: "Garmin- & Coros-Sync", desc: "Aktivitäten, Leistung, Herzfrequenzzonen und Wellness laufend synchronisiert.", badge: "Verbunden" },
      { title: "Wetter & Leistung", desc: "Hitze, Feuchtigkeit und Wind. Trainingsziele live angepasst.", badge: "Smart" },
      { title: "Voice Smart Journal", desc: "Erzähl von deinem Training; die KI erkennt mentale Müdigkeit und passt den Plan an.", badge: "Mental" },
      { title: "Ligen & Abzeichen", desc: "Wöchentlicher Wettbewerb, Rang Bronze → Elite, Disziplin-Score.", badge: "Sozial" },
      { title: "Shopping Hub", desc: "Vergleich i-Run, Alltricks, Lepape. Der richtige Schuh für deinen Schritt.", badge: "Ausrüstung" },
      { title: "Guardian Mode", desc: "Sturzerkennung, alarmiert deine Notfallkontakte mit deiner GPS-Position.", badge: "Sicherheit" },
    ],
  },
  coaching: {
    badge: "KI-Coaching", title: "Intelligenz im Kern deiner Vorbereitung.", subtitle: "Pacevo analysiert HRV, Schlaf und Trainingsbelastung und passt deinen Plan in Echtzeit an — reaktiver als ein menschlicher Coach.", cta: "Kostenlos starten",
    pills: [
      { t: "Tägliche HRV-Analyse", d: "HRV, Body Battery und Erholungs-Score von Garmin & Coros synchronisiert." },
      { t: "Adaptiver Plan", d: "Belastung automatisch an deinen physiologischen Tageszustand angepasst." },
      { t: "Voice Ghost Runner", d: "Echtzeit-Audiocoaching mit Zielzeit-Prognose, km für km." },
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
  hero: { badge: "Nuevo · Ghost Runner por voz", titleA: "Corre más lejos,", titleB: "recupérate ", accent: "más rápido", subtitle: "Un plan de entrenamiento que se ajusta cada día a tu VFC, tu sueño y tu carga real. El entrenador inteligente del corredor exigente.", ctaPrimary: "Empezar gratis", ctaSecondary: "Ver demo", sync: "Sincroniza con" },
  stats: { runners: "Corredores activos", rating: "Nota media", satisfaction: "Satisfacción", races: "Carreras listadas" },
  programs: {
    eyebrow: "Entrenamiento", title: "Un programa para cada objetivo", subtitle: "Desde tu primer 5K hasta el ultra-trail — cada plan se adapta luego a tus datos reales.", viewAll: "Ver todo",
    cats: { ALL: "Ver todo", "10KM": "10 km", SEMI: "Media", MARATHON: "Maratón", TRAIL: "Trail", BEGINNER: "Principiante", SPEED: "Velocidad", ENDURANCE: "Resistencia", INJURY: "Lesión" },
    items: {
      km10: { title: "10 KILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
      semi: { title: "MEDIA MARATÓN", subtitle: "De 8 semanas a 12 meses" },
      marathon: { title: "MARATÓN", subtitle: "De 8 semanas a 12 meses" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semanas a 12 meses" },
      beginner: { title: "EMPEZAR A CORRER", subtitle: "De 4 semanas a 3 meses" },
      speed: { title: "MEJORAR TU VELOCIDAD", subtitle: "De 4 a 12 semanas" },
      endurance: { title: "RESISTENCIA DE BASE", subtitle: "De 6 semanas a 6 meses" },
      injury: { title: "VOLVER TRAS UNA LESIÓN", subtitle: "De 4 a 16 semanas" },
    },
  },
  features: {
    eyebrow: "Plataforma completa", title: "Todo lo que un corredor necesita", subtitle: "Un conjunto de herramientas pensadas para el rendimiento — del análisis fisiológico al coaching por voz en tiempo real.",
    items: [
      { title: "Coaching con IA", desc: "Un plan recalculado cada semana según tu VFC, tu sueño y tu carga real.", badge: "Esencial" },
      { title: "VFC y recuperación", desc: "VFC diaria, Body Battery, puntuación de recuperación. Sincroniza Garmin y Coros.", badge: "Salud" },
      { title: "Ghost Runner por voz", desc: "Entrenador de audio en tiempo real: ritmo objetivo, desvío, parciales km a km.", badge: "Exclusivo" },
      { title: "Trail Builder SIG", desc: "Mapa topográfico, trazado snap-to-path, desnivel automático, exporta GPX a Garmin/Coros.", badge: "Trail" },
      { title: "Afinamiento Banister", desc: "CTL/ATL/TSB en tiempo real. TSB óptimo el día de la carrera, automáticamente.", badge: "Élite" },
      { title: "Seguimiento del sueño", desc: "Profundo / REM / Ligero, Body Battery al despertar. La IA decide si puedes apretar.", badge: "Recuperación" },
      { title: "Sync Garmin y Coros", desc: "Actividades, potencia, zonas de FC y bienestar sincronizados en continuo.", badge: "Conectado" },
      { title: "Clima y rendimiento", desc: "Impacto de calor, humedad y viento. Objetivos de sesión ajustados en directo.", badge: "Inteligente" },
      { title: "Smart Journal por voz", desc: "Cuenta tu sesión; la IA detecta tu fatiga mental y adapta tu plan.", badge: "Mental" },
      { title: "Ligas e insignias", desc: "Competición semanal, ranking Bronce → Élite, puntuación de disciplina.", badge: "Social" },
      { title: "Shopping Hub", desc: "Compara i-Run, Alltricks, Lepape. La zapatilla ideal para tu pisada.", badge: "Equipo" },
      { title: "Guardian Mode", desc: "Detección de caídas, avisa a tus contactos de emergencia con tu ubicación GPS.", badge: "Seguridad" },
    ],
  },
  coaching: {
    badge: "Coaching con IA", title: "La inteligencia en el centro de tu preparación.", subtitle: "Pacevo analiza tu VFC, tu sueño y tu carga de entrenamiento para adaptar tu plan en tiempo real — más reactivo que un entrenador humano.", cta: "Empezar gratis",
    pills: [
      { t: "Análisis VFC diario", d: "VFC, Body Battery y puntuación de recuperación sincronizados de Garmin y Coros." },
      { t: "Plan adaptativo", d: "Carga ajustada automáticamente a tu estado fisiológico del día." },
      { t: "Ghost Runner por voz", d: "Coaching de audio en tiempo real con predicción de tiempo, km a km." },
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
  hero: { badge: "Novo · Ghost Runner por voz", titleA: "Corre mais longe,", titleB: "recupera ", accent: "mais rápido", subtitle: "Um plano de treino que se ajusta todos os dias à tua VFC, ao teu sono e à tua carga real. O treinador inteligente do corredor exigente.", ctaPrimary: "Começar grátis", ctaSecondary: "Ver demo", sync: "Sincroniza com" },
  stats: { runners: "Corredores ativos", rating: "Nota média", satisfaction: "Satisfação", races: "Provas listadas" },
  programs: {
    eyebrow: "Treino", title: "Um programa para cada objetivo", subtitle: "Do teu primeiro 5K ao ultra-trail — cada plano adapta-se depois aos teus dados reais.", viewAll: "Ver tudo",
    cats: { ALL: "Ver tudo", "10KM": "10 km", SEMI: "Meia", MARATHON: "Maratona", TRAIL: "Trail", BEGINNER: "Iniciante", SPEED: "Velocidade", ENDURANCE: "Resistência", INJURY: "Lesão" },
    items: {
      km10: { title: "10 QUILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
      semi: { title: "MEIA MARATONA", subtitle: "De 8 semanas a 12 meses" },
      marathon: { title: "MARATONA", subtitle: "De 8 semanas a 12 meses" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semanas a 12 meses" },
      beginner: { title: "COMEÇAR A CORRER", subtitle: "De 4 semanas a 3 meses" },
      speed: { title: "MELHORAR A VELOCIDADE", subtitle: "De 4 a 12 semanas" },
      endurance: { title: "RESISTÊNCIA DE BASE", subtitle: "De 6 semanas a 6 meses" },
      injury: { title: "REGRESSAR DE LESÃO", subtitle: "De 4 a 16 semanas" },
    },
  },
  features: {
    eyebrow: "Plataforma completa", title: "Tudo o que um corredor precisa", subtitle: "Um conjunto de ferramentas pensadas para o desempenho — da análise fisiológica ao coaching por voz em tempo real.",
    items: [
      { title: "Coaching com IA", desc: "Um plano recalculado todas as semanas com base na tua VFC, sono e carga real.", badge: "Essencial" },
      { title: "VFC e recuperação", desc: "VFC diária, Body Battery, pontuação de recuperação. Sincroniza Garmin e Coros.", badge: "Saúde" },
      { title: "Ghost Runner por voz", desc: "Treinador de áudio em tempo real: ritmo-alvo, desvio, parciais km a km.", badge: "Exclusivo" },
      { title: "Trail Builder SIG", desc: "Mapa topográfico, traçado snap-to-path, desnível automático, exporta GPX para Garmin/Coros.", badge: "Trail" },
      { title: "Afinamento Banister", desc: "CTL/ATL/TSB em tempo real. TSB ótimo no dia da prova, automaticamente.", badge: "Elite" },
      { title: "Monitorização do sono", desc: "Profundo / REM / Leve, Body Battery ao acordar. A IA decide se podes forçar.", badge: "Recuperação" },
      { title: "Sync Garmin e Coros", desc: "Atividades, potência, zonas de FC e bem-estar sincronizados em contínuo.", badge: "Ligado" },
      { title: "Clima e desempenho", desc: "Impacto de calor, humidade e vento. Objetivos da sessão ajustados ao vivo.", badge: "Inteligente" },
      { title: "Smart Journal por voz", desc: "Conta a tua sessão; a IA deteta a fadiga mental e adapta o teu plano.", badge: "Mental" },
      { title: "Ligas e medalhas", desc: "Competição semanal, ranking Bronze → Elite, pontuação de disciplina.", badge: "Social" },
      { title: "Shopping Hub", desc: "Compara i-Run, Alltricks, Lepape. O ténis ideal para a tua passada.", badge: "Equipamento" },
      { title: "Guardian Mode", desc: "Deteção de quedas, alerta os teus contactos de emergência com a tua posição GPS.", badge: "Segurança" },
    ],
  },
  coaching: {
    badge: "Coaching com IA", title: "A inteligência no centro da tua preparação.", subtitle: "A Pacevo analisa a tua VFC, o teu sono e a tua carga de treino para adaptar o plano em tempo real — mais reativa do que um treinador humano.", cta: "Começar grátis",
    pills: [
      { t: "Análise VFC diária", d: "VFC, Body Battery e pontuação de recuperação sincronizados da Garmin e Coros." },
      { t: "Plano adaptativo", d: "Carga ajustada automaticamente ao teu estado fisiológico do dia." },
      { t: "Ghost Runner por voz", d: "Coaching de áudio em tempo real com previsão de tempo, km a km." },
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
