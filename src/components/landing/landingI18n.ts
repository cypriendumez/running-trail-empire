import type { Lang } from "@/lib/i18n/translations";

// Dictionnaire de la landing publique (5 langues). Même pattern que les dicts par composant
// (races/trail). Les visuels (images, dégradés, prix, icônes) restent dans page.tsx ;
// ici uniquement les chaînes traduisibles.

export type LandingDict = {
  nav: { programs: string; features: string; pricing: string; blog: string; reviews: string; story: string; login: string; trial: string };
  // `badge` (« Nouveau · Ghost Runner vocal ») et `ctaSecondary` (« Voir la démo »,
  // qui menait à /login et non à une démo) ont été retirés du hero : une clé sans
  // rendu se traduit dans cinq langues et ne s'affiche nulle part.
  // ⚠️ LE TITRE EST UNE LIGNE DE MARQUE, IDENTIQUE DANS LES CINQ LANGUES : « Pace Your
  // Evolution ». Ce n'est pas un oubli de traduction — c'est le nom du produit déplié
  // (PAC·EVO), et le traduire le briserait. Seul le sous-titre change de langue. Effet de
  // bord heureux : le titre ne dépend plus de la longueur d'une langue, la contrainte de
  // mise en page qui imposait 64 px disparaît.
  // ⚠️ Le nom se découpe PAC·EVO (« Pace » + « Evo(lution) », qui partagent le E) — pas
  // « Pace + VO₂max », contresens d'une version antérieure de ce fichier.
  hero: { titleA: string; titleB: string; accent: string; subtitle: string; subtitleShort: string; ctaPrimary: string };
  // `sync` a quitté le hero, où ce n'était qu'un mot pâle (« Synchro ») suivi de cinq
  // marques sous le bouton. Devenue une bande à part entière, la synchronisation mérite
  // un titre ET une note : six logos sans explication posent plus de questions qu'ils
  // n'en règlent (« Pacevo a-t-il mon mot de passe Garmin ? » — non, et on le dit).
  // `read` / `readValue` / `push` disent les DEUX SENS de la synchronisation. Sept logos
  // sous un titre unique laissaient croire que chacun fait la même chose : or Strava est un
  // journal, il n'y a rien à lui envoyer.
  //
  // ⚠️ POLAR A QUITTÉ LA VITRINE LE 23/08/2026, sur décision de Cyprien, et la note ne parle
  // donc plus de lui. Ce n'est PAS parce qu'il ne marche pas : il lit parfaitement, et un
  // porteur de Polar a toujours ses sorties, sa VMA, sa charge et son plan. Ce qu'il n'a
  // pas, c'est la séance au poignet — l'API la plus récente de Polar (AccessLink Dynamic
  // v4) étant intégralement en lecture seule. Cyprien a choisi de n'exposer que les montres
  // qui vont jusqu'au poignet, en connaissant le coût : un porteur de Polar peut conclure
  // que Pacevo ne lui sert à rien. Ne pas remettre Polar ici sans lui en reparler.
  //
  // `pushBridge` couvre le cas Apple : reçoit la séance, mais via une application tierce.
  // La liste des marques qui REÇOIVENT est dérivée du code, pas traduite.
  sync: { title: string; read: string; readValue: string; push: string; pushBridge: string; pushBridgeValue: string; pushApp: string; note: string };
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
  // « Annuel » n'est pas une formule mais une PÉRIODICITÉ. En faire une troisième carte
  // obligeait à lui inventer des exclusivités pour la remplir — c'est de là que venaient
  // « Posture Lab » et « Accès API développeur », qui n'existent pas. Deux formules, un
  // sélecteur, et l'essai annoncé au-dessus plutôt que déguisé en offre.
  pricing: {
    eyebrow: string; title: string; subtitle: string;
    mois: string; an: string; economie: string; parMois: string; essai: string;
    /** Libellé du bouton d'une formule payante, ADAPTÉ aux jours réellement accordés.
     *  `ctaEssai` quand il reste des jours, `ctaAbo` quand l'essai est terminé : un
     *  « Essayer 7 jours » figé mentirait dès le lendemain de l'inscription. */
    ctaEssai: string; ctaAbo: string;
    gratuitNote: string;
    plans: { cle: "gratuit" | "starter" | "premium"; name: string; pitch: string; badge?: string; cta: string; features: string[] }[];
    apres: string;
  };
  cta: { title: string; subtitle: string; primary: string; secondary: string; note: string };
};

export const PROGRAM_KEYS = ["km10", "endurance", "semi", "marathon", "trail", "beginner", "speed", "injury", "weightloss"] as const;
export const CATEGORY_CODES = ["ALL", "10KM", "ENDURANCE", "SEMI", "MARATHON", "TRAIL", "BEGINNER", "SPEED", "INJURY", "WEIGHT"] as const;

const fr: LandingDict = {
  nav: { programs: "Programmes", features: "Fonctionnalités", pricing: "Tarifs", blog: "Blog", reviews: "Avis", story: "Notre histoire", login: "Connexion", trial: "Essai gratuit" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Ta montre mesure déjà tout : VFC, sommeil, charge, allures. Pacevo en fait une séance — durée, intensité, récupération — recalculée à chaque synchronisation.", subtitleShort: "Ta séance du jour, recalculée à chaque synchro.", ctaPrimary: "Commencer gratuitement" },
  sync: { title: "Synchronisation avec", read: "Lecture de tes données :", readValue: "les {n} plateformes.", push: "Envoi de la séance sur ta montre :", pushBridge: "Envoi sur {marque} :", pushBridgeValue: "via l'application iOS {app}.", pushApp: "Envoi vers une application d'entraînement :", note: "Tout passe par intervals.icu, qui gère les connexions officielles de chaque constructeur. Pacevo n'accède jamais directement à tes comptes. * Apple Watch n'a aucune connexion officielle — une application iOS tierce (Intervals Companion) fait les deux sens : elle envoie tes séances vers intervals.icu et convertit le plan pour ta montre." },
  stats: { races: "Courses à venir", routes: "Parcours cartographiés", plan: "De plan glissant", replan: "Chaussures comparées" },
  programs: {
    eyebrow: "Entraînement", title: "Des programmes pour chaque objectif", subtitle: "Du premier 5 km à l'ultra-trail — chaque plan s'adapte ensuite à tes données réelles.", viewAll: "Voir tout",
    cats: { ALL: "Tout voir", "10KM": "5 km", SEMI: "Semi", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Débutant", SPEED: "Vitesse", ENDURANCE: "10 km", INJURY: "Blessure", WEIGHT: "Perte de poids" },
    items: {
      km10: { title: "5 KILOMÈTRES", subtitle: "De 6 semaines à 4 mois" },
      semi: { title: "SEMI-MARATHON", subtitle: "De 8 semaines à 12 mois" },
      marathon: { title: "MARATHON", subtitle: "De 8 semaines à 12 mois" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semaines à 12 mois" },
      beginner: { title: "DÉBUTER EN COURSE", subtitle: "De 4 semaines à 3 mois" },
      speed: { title: "AMÉLIORER SA VITESSE", subtitle: "De 4 à 12 semaines" },
      endurance: { title: "10 KILOMÈTRES", subtitle: "De 6 semaines à 4 mois" },
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
      { title: "Sync Garmin, COROS, Suunto", desc: "Tes sorties et ta récupération remontent seules via intervals.icu, et tes séances repartent vers ta montre." },
      { title: "Santé et Kiné IA", desc: "Un kiné IA qui regarde tes photos et suit tes douleurs, la nutrition de ta course, une perte de poids plafonnée." },
      { title: "Carte et parcours", desc: "Tous les parcours certifiés autour de toi, la vue relief 3D, et tes propres boucles tracées sur les sentiers." },
      { title: "10 000 courses à venir", desc: "Dates, distances et lien d'inscription — et ta préparation se cale sur la date que tu choisis." },
      { title: "Plans d'entraînement", desc: "Du premier 5 km au marathon, débuter ou revenir de blessure : des plans tout construits, calés sur ton volume réel." },
      { title: "Mes activités", desc: "Toutes tes sorties, ta vitrine de trophées et tes segments chronométrés, détectés automatiquement." },
      { title: "Cours de course à pied", desc: "Des chapitres courts — l'objectif, les erreurs, quoi faire — chacun appuyé sur ses études scientifiques." },
      { title: "Comparateur de chaussures", desc: "Poids, drop, épaisseur et plaque carbone côte à côte, et ce qui convient à ton kilométrage et à ton terrain." },
      { title: "Ligues, série et amis", desc: "Ajoute tes amis et grimpe de Bronze à Élite chaque semaine, sur ta régularité et non sur ton volume." },
    ],
  },
  pricing: {
    eyebrow: "Tarifs", title: "Ton plan est gratuit. Le coach qui l'adapte s'abonne.",
    subtitle: "Fixe ton objectif — une course, un chrono, une distance — et reçois tes séances sans payer. Le coach qui lit tes séances, ton sommeil et ta physiologie pour adapter chaque jour, lui, est dans les formules.",
    mois: "Mensuel", an: "Annuel", economie: "2 mois offerts", parMois: "/mois",
    essai: "{n} jours d'essai du coach IA, sans engagement",
    ctaEssai: "Essayer {n} jours", ctaAbo: "S'abonner",
    gratuitNote: "Aucune carte bancaire pour le palier gratuit.",
    plans: [
      { cle: "gratuit", name: "Gratuit", pitch: "Tes séances vers ton objectif, sans analyse de tes données.", cta: "Créer mon compte",
        features: ["Séances vers ton objectif : course, chrono ou distance", "Plans d'entraînement tout construits", "Carte et accès à tous les parcours", "Ghost Runner : ton allure annoncée à l'oreille", "Comparateur de chaussures", "Sync montre, historique, 10 000 courses à venir", "Série, ligues et trophées"] },
      { cle: "starter", name: "Starter", pitch: "Le coach qui lit tout et adapte ton plan après chaque sortie.", cta: "Essayer 7 jours",
        features: ["Tout le gratuit", "Plan adapté à tes séances, ton sommeil, ta VFC et ta FC", "Analyse IA complète de chaque séance", "Séances poussées sur la montre", "Kiné IA, avec photo", "Export GPX de tes tracés et des parcours", "10 échanges avec l'IA par jour"] },
      { cle: "premium", name: "Premium", pitch: "Le coach IA au maximum, pour préparer une grande échéance.", badge: "Le plus demandé", cta: "Essayer 7 jours",
        features: ["Tout le Starter", "30 échanges avec l'IA par jour", "Coach IA avancé : séances clés relues par l'IA"] },
    ],
    apres: "À la fin de l'essai, rien n'est effacé : ton compte passe au palier gratuit. Tes activités continuent d'être synchronisées et ton plan continue, bâti sur ton objectif. Ce qui s'arrête : l'adaptation à tes données, l'analyse de tes séances, l'envoi sur la montre et les échanges avec l'IA.",
  },
  cta: { title: "Prêt à performer ?", subtitle: "Rejoins les coureurs qui s'entraînent plus intelligemment avec Pacevo.", primary: "Créer un compte gratuit", secondary: "Se connecter", note: "Gratuit · Sans carte bancaire · Annulable à tout moment" },
};

const en: LandingDict = {
  nav: { programs: "Programs", features: "Features", pricing: "Pricing", blog: "Blog", reviews: "Reviews", story: "Our story", login: "Log in", trial: "Free trial" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Your watch already measures everything: HRV, sleep, load, paces. Pacevo turns it into a session — duration, intensity, recovery — recalculated on every sync.", subtitleShort: "Your session of the day, recalculated on every sync.", ctaPrimary: "Start for free" },
  sync: { title: "Syncs with", read: "Reading your data:", readValue: "all {n} platforms.", push: "Sending the session to your watch:", pushBridge: "Sending to {marque}:", pushBridgeValue: "through the {app} iOS app.", pushApp: "Sending to a training app:", note: "Everything goes through intervals.icu, which handles each manufacturer's official connection. Pacevo never accesses your accounts directly. * Apple Watch has no official connection — a third-party iOS app (Intervals Companion) covers both directions: it sends your workouts to intervals.icu and converts the plan for your watch." },
  stats: { races: "Upcoming races", routes: "Mapped routes", plan: "Rolling plan", replan: "Shoes compared" },
  programs: {
    eyebrow: "Training", title: "A program for every goal", subtitle: "From your first 5K to ultra-trail — each plan then adapts to your real data.", viewAll: "View all",
    cats: { ALL: "View all", "10KM": "5K", SEMI: "Half", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Beginner", SPEED: "Speed", ENDURANCE: "10K", INJURY: "Injury", WEIGHT: "Weight loss" },
    items: {
      km10: { title: "5 KILOMETRES", subtitle: "From 6 weeks to 4 months" },
      semi: { title: "HALF MARATHON", subtitle: "From 8 weeks to 12 months" },
      marathon: { title: "MARATHON", subtitle: "From 8 weeks to 12 months" },
      trail: { title: "TRAIL RUNNING", subtitle: "From 6 weeks to 12 months" },
      beginner: { title: "START RUNNING", subtitle: "From 4 weeks to 3 months" },
      speed: { title: "IMPROVE YOUR SPEED", subtitle: "From 4 to 12 weeks" },
      endurance: { title: "10 KILOMETRES", subtitle: "From 6 weeks to 4 months" },
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
      { title: "Garmin, COROS, Suunto sync", desc: "Your runs and your recovery flow in on their own through intervals.icu, and your sessions head back to your watch." },
      { title: "Health and AI physio", desc: "An AI physio that looks at your photos and tracks your pains, race-day nutrition, and capped weight loss." },
      { title: "Map and routes", desc: "Every certified route around you, the 3D relief view, and your own loops drawn on real trails." },
      { title: "10,000 upcoming races", desc: "Dates, distances and the sign-up link — and your build lines up with the date you pick." },
      { title: "Training plans", desc: "From your first 5K to the marathon, starting out or coming back from injury: ready-made plans, sized to your real volume." },
      { title: "My activities", desc: "All your runs, your trophy wall and your timed segments, detected automatically." },
      { title: "Running lessons", desc: "Short chapters — the goal, the mistakes, what to do — each backed by its scientific studies." },
      { title: "Shoe comparison", desc: "Weight, drop, stack and carbon plate side by side, and what suits your mileage and your terrain." },
      { title: "Leagues, streak and friends", desc: "Add your friends and climb from Bronze to Elite every week, on your consistency rather than your mileage." },
    ],
  },
  pricing: {
    eyebrow: "Pricing", title: "Your plan is free. The coach that adapts it is a subscription.",
    subtitle: "Set your goal — a race, a finish time, a distance — and get your sessions without paying. The coach that reads your sessions, your sleep and your physiology to adapt every day lives in the paid tiers.",
    mois: "Monthly", an: "Yearly", economie: "2 months free", parMois: "/month",
    essai: "{n}-day trial of the AI coach, cancel anytime",
    ctaEssai: "Try {n} days", ctaAbo: "Subscribe",
    gratuitNote: "No card needed for the free tier.",
    plans: [
      { cle: "gratuit", name: "Free", pitch: "Your sessions toward your goal, with no analysis of your data.", cta: "Create my account",
        features: ["Sessions toward your goal: race, time or distance", "Ready-made training plans", "Map and access to every route", "Ghost Runner: your pace called out in your ear", "Shoe comparison", "Watch sync, history, 10,000 upcoming races", "Streak, leagues and trophies"] },
      { cle: "starter", name: "Starter", pitch: "The coach that reads everything and adapts your plan after every run.", cta: "Try 7 days",
        features: ["Everything in Free", "Plan adapted to your sessions, sleep, HRV and heart rate", "Full AI analysis of every session", "Sessions pushed to your watch", "AI physio, with photo", "GPX export of your routes and of the trails", "10 AI exchanges per day"] },
      { cle: "premium", name: "Premium", pitch: "The AI coach at full power, to prepare a big goal.", badge: "Most popular", cta: "Try 7 days",
        features: ["Everything in Starter", "30 AI exchanges per day", "Advanced AI coach: key sessions reviewed by AI"] },
    ],
    apres: "When the trial ends nothing is deleted: your account moves to the free tier. Your activities keep syncing and your plan carries on, built on your goal. What stops: adapting to your data, analysing your sessions, sending to your watch and the AI exchanges.",
  },
  cta: { title: "Ready to perform?", subtitle: "Join the runners training smarter with Pacevo.", primary: "Create a free account", secondary: "Log in", note: "Free · No credit card · Cancel anytime" },
};

const de: LandingDict = {
  nav: { programs: "Programme", features: "Funktionen", pricing: "Preise", blog: "Blog", reviews: "Bewertungen", story: "Unsere Geschichte", login: "Anmelden", trial: "Gratis testen" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Deine Uhr misst längst alles: HRV, Schlaf, Belastung, Tempo. Pacevo macht daraus eine Einheit — Dauer, Intensität, Erholung — bei jeder Synchronisation neu berechnet.", subtitleShort: "Deine Einheit des Tages, bei jeder Synchronisation neu berechnet.", ctaPrimary: "Kostenlos starten" },
  sync: { title: "Synchronisiert mit", read: "Deine Daten lesen:", readValue: "alle {n} Plattformen.", push: "Einheit auf deine Uhr senden:", pushBridge: "Senden an {marque}:", pushBridgeValue: "über die iOS-App {app}.", pushApp: "An eine Trainings-App senden:", note: "Alles läuft über intervals.icu, das die offiziellen Verbindungen jedes Herstellers verwaltet. Pacevo greift nie direkt auf deine Konten zu. * Die Apple Watch hat keine offizielle Verbindung — eine iOS-App von Drittanbietern (Intervals Companion) deckt beide Richtungen ab: Sie sendet deine Einheiten an intervals.icu und wandelt den Plan für deine Uhr um." },
  stats: { races: "Kommende Rennen", routes: "Kartierte Strecken", plan: "Rollierender Plan", replan: "Schuhe im Vergleich" },
  programs: {
    eyebrow: "Training", title: "Ein Programm für jedes Ziel", subtitle: "Vom ersten 5-km-Lauf bis zum Ultra-Trail — jeder Plan passt sich dann an deine echten Daten an.", viewAll: "Alle ansehen",
    cats: { ALL: "Alle", "10KM": "5 km", SEMI: "Halb", MARATHON: "Marathon", TRAIL: "Trail", BEGINNER: "Einsteiger", SPEED: "Tempo", ENDURANCE: "10 km", INJURY: "Verletzung", WEIGHT: "Abnehmen" },
    items: {
      km10: { title: "5 KILOMETER", subtitle: "Von 6 Wochen bis 4 Monate" },
      semi: { title: "HALBMARATHON", subtitle: "Von 8 Wochen bis 12 Monate" },
      marathon: { title: "MARATHON", subtitle: "Von 8 Wochen bis 12 Monate" },
      trail: { title: "TRAIL RUNNING", subtitle: "Von 6 Wochen bis 12 Monate" },
      beginner: { title: "LAUFEN STARTEN", subtitle: "Von 4 Wochen bis 3 Monate" },
      speed: { title: "TEMPO VERBESSERN", subtitle: "Von 4 bis 12 Wochen" },
      endurance: { title: "10 KILOMETER", subtitle: "Von 6 Wochen bis 4 Monate" },
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
      { title: "Sync mit Garmin, COROS, Suunto", desc: "Deine Läufe und deine Erholung kommen von selbst über intervals.icu, und deine Einheiten gehen zurück auf die Uhr." },
      { title: "Gesundheit und KI-Physio", desc: "Eine KI-Physio, die deine Fotos ansieht und deine Schmerzen verfolgt, Ernährung für den Wettkampf, Abnehmen mit Obergrenze." },
      { title: "Karte und Strecken", desc: "Alle zertifizierten Strecken in deiner Nähe, die 3D-Reliefansicht und eigene Runden, auf echte Wege gezeichnet." },
      { title: "10 000 kommende Rennen", desc: "Termine, Distanzen und Anmeldelink — und dein Aufbau richtet sich nach dem Datum, das du wählst." },
      { title: "Trainingspläne", desc: "Vom ersten 5-km-Lauf bis zum Marathon, Einstieg oder Comeback nach Verletzung: fertige Pläne, auf deinen echten Umfang abgestimmt." },
      { title: "Meine Aktivitäten", desc: "Alle deine Läufe, deine Trophäenwand und deine gestoppten Segmente, automatisch erkannt." },
      { title: "Laufkurse", desc: "Kurze Kapitel — das Ziel, die Fehler, was zu tun ist — jedes gestützt auf seine wissenschaftlichen Studien." },
      { title: "Schuhvergleich", desc: "Gewicht, Sprengung, Sohlenhöhe und Carbonplatte im Vergleich, und was zu deinem Umfang und Gelände passt." },
      { title: "Ligen, Serie und Freunde", desc: "Füge Freunde hinzu und steig jede Woche von Bronze bis Elite auf — nach deiner Regelmäßigkeit, nicht nach Kilometern." },
    ],
  },
  pricing: {
    eyebrow: "Preise", title: "Dein Plan ist gratis. Der Coach, der ihn anpasst, ist ein Abo.",
    subtitle: "Leg dein Ziel fest — ein Rennen, eine Zielzeit, eine Distanz — und erhalte deine Einheiten, ohne zu zahlen. Der Coach, der deine Einheiten, deinen Schlaf und deine Physiologie liest, um jeden Tag anzupassen, steckt in den Abos.",
    mois: "Monatlich", an: "Jährlich", economie: "2 Monate geschenkt", parMois: "/Monat",
    essai: "{n} Tage KI-Coach testen, jederzeit kündbar",
    ctaEssai: "{n} Tage testen", ctaAbo: "Abonnieren",
    gratuitNote: "Keine Karte nötig für die Gratis-Stufe.",
    plans: [
      { cle: "gratuit", name: "Gratis", pitch: "Deine Einheiten zu deinem Ziel, ohne Analyse deiner Daten.", cta: "Konto erstellen",
        features: ["Einheiten zu deinem Ziel: Rennen, Zeit oder Distanz", "Fertige Trainingspläne", "Karte und Zugang zu allen Strecken", "Ghost Runner: dein Tempo im Ohr", "Schuhvergleich", "Uhr-Sync, Verlauf, 10 000 kommende Rennen", "Serie, Ligen und Trophäen"] },
      { cle: "starter", name: "Starter", pitch: "Der Coach, der alles liest und deinen Plan nach jedem Lauf anpasst.", cta: "7 Tage testen",
        features: ["Alles aus Gratis", "Plan angepasst an Einheiten, Schlaf, HRV und Puls", "Vollständige KI-Analyse jeder Einheit", "Einheiten direkt auf die Uhr", "KI-Physio, mit Foto", "GPX-Export deiner Runden und der Strecken", "10 KI-Dialoge pro Tag"] },
      { cle: "premium", name: "Premium", pitch: "Der KI-Coach mit voller Leistung, für ein großes Ziel.", badge: "Am beliebtesten", cta: "7 Tage testen",
        features: ["Alles aus Starter", "30 KI-Dialoge pro Tag", "Erweiterter KI-Coach: Schlüsseleinheiten von der KI geprüft"] },
    ],
    apres: "Am Ende des Tests wird nichts gelöscht: dein Konto wechselt auf die Gratis-Stufe. Deine Aktivitäten werden weiter synchronisiert und dein Plan läuft weiter, gebaut auf dein Ziel. Es enden: die Anpassung an deine Daten, die Analyse deiner Einheiten, das Senden auf die Uhr und die KI-Dialoge.",
  },
  cta: { title: "Bereit für Leistung?", subtitle: "Schließe dich den Läufern an, die mit Pacevo smarter trainieren.", primary: "Kostenloses Konto erstellen", secondary: "Anmelden", note: "Gratis · Keine Kreditkarte · Jederzeit kündbar" },
};

const es: LandingDict = {
  nav: { programs: "Programas", features: "Funciones", pricing: "Precios", blog: "Blog", reviews: "Opiniones", story: "Nuestra historia", login: "Iniciar sesión", trial: "Prueba gratis" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Tu reloj ya lo mide todo: VFC, sueño, carga, ritmos. Pacevo lo convierte en una sesión — duración, intensidad, recuperación — recalculada en cada sincronización.", subtitleShort: "Tu sesión del día, recalculada en cada sincronización.", ctaPrimary: "Empezar gratis" },
  sync: { title: "Sincroniza con", read: "Lectura de tus datos:", readValue: "las {n} plataformas.", push: "Envío de la sesión a tu reloj:", pushBridge: "Envío al {marque}:", pushBridgeValue: "a través de la app para iOS {app}.", pushApp: "Envío a una app de entrenamiento:", note: "Todo pasa por intervals.icu, que gestiona las conexiones oficiales de cada fabricante. Pacevo nunca accede directamente a tus cuentas. * El Apple Watch no tiene conexión oficial — una app iOS de terceros (Intervals Companion) cubre ambos sentidos: envía tus sesiones a intervals.icu y convierte el plan para tu reloj." },
  stats: { races: "Carreras próximas", routes: "Rutas cartografiadas", plan: "De plan deslizante", replan: "Zapatillas comparadas" },
  programs: {
    eyebrow: "Entrenamiento", title: "Un programa para cada objetivo", subtitle: "Desde tu primer 5K hasta el ultra-trail — cada plan se adapta luego a tus datos reales.", viewAll: "Ver todo",
    cats: { ALL: "Ver todo", "10KM": "5 km", SEMI: "Media", MARATHON: "Maratón", TRAIL: "Trail", BEGINNER: "Principiante", SPEED: "Velocidad", ENDURANCE: "10 km", INJURY: "Lesión", WEIGHT: "Pérdida de peso" },
    items: {
      km10: { title: "5 KILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
      semi: { title: "MEDIA MARATÓN", subtitle: "De 8 semanas a 12 meses" },
      marathon: { title: "MARATÓN", subtitle: "De 8 semanas a 12 meses" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semanas a 12 meses" },
      beginner: { title: "EMPEZAR A CORRER", subtitle: "De 4 semanas a 3 meses" },
      speed: { title: "MEJORAR TU VELOCIDAD", subtitle: "De 4 a 12 semanas" },
      endurance: { title: "10 KILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
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
      { title: "Sync Garmin, COROS, Suunto", desc: "Tus salidas y tu recuperación llegan solas vía intervals.icu, y tus sesiones vuelven a tu reloj." },
      { title: "Salud y Fisio IA", desc: "Un fisio IA que mira tus fotos y sigue tus dolores, la nutrición de tu carrera y una pérdida de peso con tope." },
      { title: "Mapa y rutas", desc: "Todas las rutas certificadas a tu alrededor, la vista de relieve 3D y tus propios circuitos trazados sobre senderos reales." },
      { title: "10 000 carreras próximas", desc: "Fechas, distancias y enlace de inscripción — y tu preparación se ajusta a la fecha que elijas." },
      { title: "Planes de entrenamiento", desc: "Del primer 5K al maratón, empezar o volver de una lesión: planes ya hechos, ajustados a tu volumen real." },
      { title: "Mis actividades", desc: "Todas tus salidas, tu vitrina de trofeos y tus segmentos cronometrados, detectados automáticamente." },
      { title: "Cursos de running", desc: "Capítulos cortos — el objetivo, los errores, qué hacer — cada uno respaldado por sus estudios científicos." },
      { title: "Comparador de zapatillas", desc: "Peso, drop, altura de suela y placa de carbono lado a lado, y lo que encaja con tu kilometraje y tu terreno." },
      { title: "Ligas, racha y amigos", desc: "Añade a tus amigos y sube de Bronce a Élite cada semana, por tu regularidad y no por tu volumen." },
    ],
  },
  pricing: {
    eyebrow: "Precios", title: "Tu plan es gratis. El entrenador que lo adapta se suscribe.",
    subtitle: "Fija tu objetivo — una carrera, un tiempo, una distancia — y recibe tus sesiones sin pagar. El entrenador que lee tus sesiones, tu sueño y tu fisiología para adaptar cada día está en las fórmulas.",
    mois: "Mensual", an: "Anual", economie: "2 meses gratis", parMois: "/mes",
    essai: "{n} días de prueba del coach IA, sin compromiso",
    ctaEssai: "Probar {n} días", ctaAbo: "Suscribirme",
    gratuitNote: "Sin tarjeta para el nivel gratuito.",
    plans: [
      { cle: "gratuit", name: "Gratis", pitch: "Tus sesiones hacia tu objetivo, sin análisis de tus datos.", cta: "Crear mi cuenta",
        features: ["Sesiones hacia tu objetivo: carrera, tiempo o distancia", "Planes de entrenamiento ya hechos", "Mapa y acceso a todas las rutas", "Ghost Runner: tu ritmo anunciado al oído", "Comparador de zapatillas", "Sync del reloj, historial, 10 000 carreras próximas", "Racha, ligas y trofeos"] },
      { cle: "starter", name: "Starter", pitch: "El entrenador que lo lee todo y adapta tu plan tras cada salida.", cta: "Probar 7 días",
        features: ["Todo lo gratuito", "Plan adaptado a tus sesiones, sueño, VFC y FC", "Análisis IA completo de cada sesión", "Sesiones enviadas al reloj", "Fisio IA, con foto", "Exportación GPX de tus trazados y de las rutas", "10 intercambios con la IA al día"] },
      { cle: "premium", name: "Premium", pitch: "El coach IA a máxima potencia, para preparar un gran objetivo.", badge: "El más elegido", cta: "Probar 7 días",
        features: ["Todo lo de Starter", "30 intercambios con la IA al día", "Coach IA avanzado: sesiones clave revisadas por la IA"] },
    ],
    apres: "Al terminar la prueba no se borra nada: tu cuenta pasa al nivel gratuito. Tus actividades se siguen sincronizando y tu plan continúa, construido sobre tu objetivo. Lo que se detiene: la adaptación a tus datos, el análisis de tus sesiones, el envío al reloj y los intercambios con la IA.",
  },
  cta: { title: "¿Listo para rendir?", subtitle: "Únete a los corredores que entrenan de forma más inteligente con Pacevo.", primary: "Crear cuenta gratis", secondary: "Iniciar sesión", note: "Gratis · Sin tarjeta · Cancela cuando quieras" },
};

const pt: LandingDict = {
  nav: { programs: "Programas", features: "Funcionalidades", pricing: "Preços", blog: "Blog", reviews: "Avaliações", story: "A nossa história", login: "Entrar", trial: "Teste grátis" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "O teu relógio já mede tudo: VFC, sono, carga, ritmos. A Pacevo transforma isso num treino — duração, intensidade, recuperação — recalculado a cada sincronização.", subtitleShort: "O teu treino do dia, recalculado a cada sincronização.", ctaPrimary: "Começar grátis" },
  sync: { title: "Sincroniza com", read: "Leitura dos teus dados:", readValue: "as {n} plataformas.", push: "Envio do treino para o teu relógio:", pushBridge: "Envio para o {marque}:", pushBridgeValue: "através da app iOS {app}.", pushApp: "Envio para uma app de treino:", note: "Tudo passa pelo intervals.icu, que gere as ligações oficiais de cada fabricante. A Pacevo nunca acede diretamente às tuas contas. * O Apple Watch não tem ligação oficial — uma app iOS de terceiros (Intervals Companion) cobre ambos os sentidos: envia os teus treinos para o intervals.icu e converte o plano para o teu relógio." },
  stats: { races: "Provas futuras", routes: "Percursos cartografados", plan: "De plano deslizante", replan: "Ténis comparados" },
  programs: {
    eyebrow: "Treino", title: "Um programa para cada objetivo", subtitle: "Do teu primeiro 5K ao ultra-trail — cada plano adapta-se depois aos teus dados reais.", viewAll: "Ver tudo",
    cats: { ALL: "Ver tudo", "10KM": "5 km", SEMI: "Meia", MARATHON: "Maratona", TRAIL: "Trail", BEGINNER: "Iniciante", SPEED: "Velocidade", ENDURANCE: "10 km", INJURY: "Lesão", WEIGHT: "Perda de peso" },
    items: {
      km10: { title: "5 QUILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
      semi: { title: "MEIA MARATONA", subtitle: "De 8 semanas a 12 meses" },
      marathon: { title: "MARATONA", subtitle: "De 8 semanas a 12 meses" },
      trail: { title: "TRAIL RUNNING", subtitle: "De 6 semanas a 12 meses" },
      beginner: { title: "COMEÇAR A CORRER", subtitle: "De 4 semanas a 3 meses" },
      speed: { title: "MELHORAR A VELOCIDADE", subtitle: "De 4 a 12 semanas" },
      endurance: { title: "10 QUILÓMETROS", subtitle: "De 6 semanas a 4 meses" },
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
      { title: "Sync Garmin, COROS, Suunto", desc: "As tuas saídas e a tua recuperação chegam sozinhas via intervals.icu, e os teus treinos voltam para o relógio." },
      { title: "Saúde e Fisio IA", desc: "Um fisio IA que olha para as tuas fotos e acompanha as tuas dores, a nutrição da tua prova e uma perda de peso com limite." },
      { title: "Mapa e percursos", desc: "Todos os percursos certificados à tua volta, a vista de relevo 3D e os teus próprios circuitos traçados em trilhos reais." },
      { title: "10 000 provas futuras", desc: "Datas, distâncias e link de inscrição — e a tua preparação alinha-se pela data que escolheres." },
      { title: "Planos de treino", desc: "Do primeiro 5K à maratona, começar ou regressar de lesão: planos prontos, ajustados ao teu volume real." },
      { title: "As minhas atividades", desc: "Todas as tuas saídas, a tua vitrine de troféus e os teus segmentos cronometrados, detetados automaticamente." },
      { title: "Aulas de corrida", desc: "Capítulos curtos — o objetivo, os erros, o que fazer — cada um apoiado nos seus estudos científicos." },
      { title: "Comparador de ténis", desc: "Peso, drop, altura da sola e placa de carbono lado a lado, e o que serve à tua quilometragem e ao teu terreno." },
      { title: "Ligas, série e amigos", desc: "Adiciona os teus amigos e sobe de Bronze a Elite todas as semanas, pela tua regularidade e não pelo teu volume." },
    ],
  },
  pricing: {
    eyebrow: "Preços", title: "O teu plano é grátis. O treinador que o adapta é uma subscrição.",
    subtitle: "Define o teu objetivo — uma prova, um tempo, uma distância — e recebe os teus treinos sem pagar. O treinador que lê os teus treinos, o teu sono e a tua fisiologia para adaptar cada dia está nas fórmulas.",
    mois: "Mensal", an: "Anual", economie: "2 meses grátis", parMois: "/mês",
    essai: "{n} dias de teste do coach IA, sem compromisso",
    ctaEssai: "Testar {n} dias", ctaAbo: "Subscrever",
    gratuitNote: "Sem cartão para o nível gratuito.",
    plans: [
      { cle: "gratuit", name: "Grátis", pitch: "Os teus treinos rumo ao teu objetivo, sem análise dos teus dados.", cta: "Criar a minha conta",
        features: ["Treinos rumo ao teu objetivo: prova, tempo ou distância", "Planos de treino prontos", "Mapa e acesso a todos os percursos", "Ghost Runner: o teu ritmo anunciado ao ouvido", "Comparador de ténis", "Sync do relógio, histórico, 10 000 provas futuras", "Série, ligas e troféus"] },
      { cle: "starter", name: "Starter", pitch: "O treinador que lê tudo e adapta o teu plano após cada saída.", cta: "Testar 7 dias",
        features: ["Tudo o gratuito", "Plano adaptado aos teus treinos, sono, VFC e FC", "Análise IA completa de cada treino", "Treinos enviados para o relógio", "Fisio IA, com foto", "Exportação GPX dos teus traçados e dos percursos", "10 trocas com a IA por dia"] },
      { cle: "premium", name: "Premium", pitch: "O coach IA no máximo, para preparar um grande objetivo.", badge: "O mais escolhido", cta: "Testar 7 dias",
        features: ["Tudo o do Starter", "30 trocas com a IA por dia", "Coach IA avançado: sessões-chave revistas pela IA"] },
    ],
    apres: "No fim do teste nada é apagado: a tua conta passa ao nível gratuito. As tuas atividades continuam a sincronizar e o teu plano continua, construído sobre o teu objetivo. O que para: a adaptação aos teus dados, a análise dos teus treinos, o envio para o relógio e as trocas com a IA.",
  },
  cta: { title: "Pronto para performar?", subtitle: "Junta-te aos corredores que treinam de forma mais inteligente com a Pacevo.", primary: "Criar conta grátis", secondary: "Entrar", note: "Grátis · Sem cartão · Cancela quando quiseres" },
};

export const LANDING: Record<Lang, LandingDict> = { fr, en, de, es, pt };
