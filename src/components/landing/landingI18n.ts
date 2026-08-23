import type { Lang } from "@/lib/i18n/translations";

// Dictionnaire de la landing publique (5 langues). Même pattern que les dicts par composant
// (races/trail). Les visuels (images, dégradés, prix, icônes) restent dans page.tsx ;
// ici uniquement les chaînes traduisibles.

export type LandingDict = {
  nav: { programs: string; features: string; pricing: string; blog: string; reviews: string; login: string; trial: string };
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
  hero: { titleA: string; titleB: string; accent: string; subtitle: string; ctaPrimary: string };
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

export const PROGRAM_KEYS = ["km10", "semi", "marathon", "trail", "beginner", "speed", "endurance", "injury", "weightloss"] as const;
export const CATEGORY_CODES = ["ALL", "10KM", "SEMI", "MARATHON", "TRAIL", "BEGINNER", "SPEED", "ENDURANCE", "INJURY", "WEIGHT"] as const;

const fr: LandingDict = {
  nav: { programs: "Programmes", features: "Fonctionnalités", pricing: "Tarifs", blog: "Blog", reviews: "Avis", login: "Connexion", trial: "Essai gratuit" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Ta montre mesure déjà tout : VFC, sommeil, charge, allures. Pacevo en fait une séance — durée, intensité, récupération — recalculée à chaque synchronisation.", ctaPrimary: "Commencer gratuitement" },
  sync: { title: "Synchronisation avec", read: "Lecture de tes données :", readValue: "les {n} plateformes.", push: "Envoi de la séance sur ta montre :", pushBridge: "Envoi sur {marque} :", pushBridgeValue: "via l'application iOS {app}.", pushApp: "Envoi vers une application d'entraînement :", note: "Tout passe par intervals.icu, qui gère les connexions officielles de chaque constructeur. Pacevo n'accède jamais directement à tes comptes. * Apple Watch n'a aucune connexion officielle — une application iOS tierce (Intervals Companion) fait les deux sens : elle envoie tes séances vers intervals.icu et convertit le plan pour ta montre." },
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
      { title: "Sync Garmin, COROS, Suunto", desc: "Activités, puissance, zones cardio et données de bien-être récupérées en continu via intervals.icu." },
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
    eyebrow: "Tarifs", title: "Tes données restent gratuites. Le coach s'abonne.",
    subtitle: "Crée ton compte, branche ta montre, garde ton historique et le calendrier des courses sans payer. Le plan qui se replanifie tout seul et les échanges avec l'IA, eux, sont dans les formules.",
    mois: "Mensuel", an: "Annuel", economie: "2 mois offerts", parMois: "/mois",
    essai: "{n} jours d'essai de l'IA, sans engagement",
    ctaEssai: "Essayer {n} jours", ctaAbo: "S'abonner",
    gratuitNote: "Aucune carte bancaire pour le palier gratuit.",
    plans: [
      { cle: "gratuit", name: "Gratuit", pitch: "Tes données, tes courses, et un aperçu de ton plan.", cta: "Créer mon compte",
        features: ["Sync Garmin, COROS, Suunto", "VFC, sommeil et charge d'entraînement", "Historique complet de tes séances", "14 000 courses à venir", "Les 2 prochains jours de ton plan", "Série, ligues et trophées"] },
      { cle: "starter", name: "Starter", pitch: "Le plan complet de 7 jours, replanifié à chaque sortie.", cta: "Essayer 7 jours",
        features: ["Tout le gratuit", "Plan de 7 jours replanifié en continu", "Séances poussées sur la montre", "10 échanges avec l'IA par jour", "Analyse IA de tes séances", "Kiné IA, avec photo"] },
      { cle: "premium", name: "Premium", pitch: "Le coach complet, plus les outils de préparation.", badge: "Le plus demandé", cta: "Essayer 7 jours",
        features: ["Tout le Starter", "30 échanges avec l'IA par jour", "Trail Builder et export GPX", "Plans IA à la demande", "Smart Journal vocal", "Analyses longues et détaillées"] },
    ],
    apres: "À la fin de l'essai, rien n'est effacé : ton compte revient au palier gratuit. Tes activités continuent d'être synchronisées, ton historique et tes courses restent consultables. Ce qui s'arrête, c'est la prescription de nouvelles séances et les échanges avec l'IA.",
  },
  cta: { title: "Prêt à performer ?", subtitle: "Rejoins les coureurs qui s'entraînent plus intelligemment avec Pacevo.", primary: "Créer un compte gratuit", secondary: "Se connecter", note: "Gratuit · Sans carte bancaire · Annulable à tout moment" },
};

const en: LandingDict = {
  nav: { programs: "Programs", features: "Features", pricing: "Pricing", blog: "Blog", reviews: "Reviews", login: "Log in", trial: "Free trial" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Your watch already measures everything: HRV, sleep, load, paces. Pacevo turns it into a session — duration, intensity, recovery — recalculated on every sync.", ctaPrimary: "Start for free" },
  sync: { title: "Syncs with", read: "Reading your data:", readValue: "all {n} platforms.", push: "Sending the session to your watch:", pushBridge: "Sending to {marque}:", pushBridgeValue: "through the {app} iOS app.", pushApp: "Sending to a training app:", note: "Everything goes through intervals.icu, which handles each manufacturer's official connection. Pacevo never accesses your accounts directly. * Apple Watch has no official connection — a third-party iOS app (Intervals Companion) covers both directions: it sends your workouts to intervals.icu and converts the plan for your watch." },
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
      { title: "Garmin, COROS, Suunto sync", desc: "Activities, power, heart-rate zones and wellness data pulled continuously through intervals.icu." },
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
    eyebrow: "Pricing", title: "Your data stays free. The coach is a subscription.",
    subtitle: "Create your account, connect your watch, keep your history and the race calendar without paying. The self-replanning plan and the AI exchanges live in the paid tiers.",
    mois: "Monthly", an: "Yearly", economie: "2 months free", parMois: "/month",
    essai: "{n}-day AI trial, cancel anytime",
    ctaEssai: "Try {n} days", ctaAbo: "Subscribe",
    gratuitNote: "No card needed for the free tier.",
    plans: [
      { cle: "gratuit", name: "Free", pitch: "Your data, your races, and a preview of your plan.", cta: "Create my account",
        features: ["Garmin, COROS, Suunto sync", "HRV, sleep and training load", "Full history of your sessions", "14,000 upcoming races", "The next 2 days of your plan", "Streak, leagues and trophies"] },
      { cle: "starter", name: "Starter", pitch: "The self-replanning coach, plus 10 AI questions a day.", cta: "Try 7 days",
        features: ["Everything in Free", "7-day plan, continuously replanned", "Sessions pushed to your watch", "10 AI exchanges per day", "AI analysis of your sessions", "AI physio, with photo"] },
      { cle: "premium", name: "Premium", pitch: "The same coach, plus 30 AI questions a day.", badge: "Most popular", cta: "Try 7 days",
        features: ["Everything in Starter", "30 AI exchanges per day", "Trail Builder and GPX export", "On-demand AI plans", "Voice Smart Journal", "Long, detailed analyses"] },
    ],
    apres: "When the trial ends nothing is deleted: your account returns to the free tier. Your activities keep syncing, your history and races stay readable. What stops is the prescription of new sessions and the AI exchanges.",
  },
  cta: { title: "Ready to perform?", subtitle: "Join the runners training smarter with Pacevo.", primary: "Create a free account", secondary: "Log in", note: "Free · No credit card · Cancel anytime" },
};

const de: LandingDict = {
  nav: { programs: "Programme", features: "Funktionen", pricing: "Preise", blog: "Blog", reviews: "Bewertungen", login: "Anmelden", trial: "Gratis testen" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Deine Uhr misst längst alles: HRV, Schlaf, Belastung, Tempo. Pacevo macht daraus eine Einheit — Dauer, Intensität, Erholung — bei jeder Synchronisation neu berechnet.", ctaPrimary: "Kostenlos starten" },
  sync: { title: "Synchronisiert mit", read: "Deine Daten lesen:", readValue: "alle {n} Plattformen.", push: "Einheit auf deine Uhr senden:", pushBridge: "Senden an {marque}:", pushBridgeValue: "über die iOS-App {app}.", pushApp: "An eine Trainings-App senden:", note: "Alles läuft über intervals.icu, das die offiziellen Verbindungen jedes Herstellers verwaltet. Pacevo greift nie direkt auf deine Konten zu. * Die Apple Watch hat keine offizielle Verbindung — eine iOS-App von Drittanbietern (Intervals Companion) deckt beide Richtungen ab: Sie sendet deine Einheiten an intervals.icu und wandelt den Plan für deine Uhr um." },
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
      { title: "Sync mit Garmin, COROS, Suunto", desc: "Aktivitäten, Leistung, Herzfrequenzzonen und Wellness-Daten laufend über intervals.icu geholt." },
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
    eyebrow: "Preise", title: "Deine Daten bleiben gratis. Der Coach ist ein Abo.",
    subtitle: "Konto erstellen, Uhr verbinden, Verlauf und Rennkalender behalten — ohne zu zahlen. Der sich selbst neu planende Plan und die KI-Dialoge stecken in den Abos.",
    mois: "Monatlich", an: "Jährlich", economie: "2 Monate geschenkt", parMois: "/Monat",
    essai: "{n} Tage KI testen, jederzeit kündbar",
    ctaEssai: "{n} Tage testen", ctaAbo: "Abonnieren",
    gratuitNote: "Keine Karte nötig für die Gratis-Stufe.",
    plans: [
      { cle: "gratuit", name: "Gratis", pitch: "Deine Daten, deine Rennen und ein Blick auf deinen Plan.", cta: "Konto erstellen",
        features: ["Sync mit Garmin, COROS, Suunto", "HRV, Schlaf und Trainingsbelastung", "Vollständiger Verlauf deiner Einheiten", "14 000 kommende Rennen", "Die nächsten 2 Tage deines Plans", "Serie, Ligen und Trophäen"] },
      { cle: "starter", name: "Starter", pitch: "Der Coach, der sich neu plant, plus 10 KI-Fragen pro Tag.", cta: "7 Tage testen",
        features: ["Alles aus Gratis", "7-Tage-Plan, laufend neu geplant", "Einheiten direkt auf die Uhr", "10 KI-Dialoge pro Tag", "KI-Analyse deiner Einheiten", "KI-Physio, mit Foto"] },
      { cle: "premium", name: "Premium", pitch: "Derselbe Coach, plus 30 KI-Fragen pro Tag.", badge: "Am beliebtesten", cta: "7 Tage testen",
        features: ["Alles aus Starter", "30 KI-Dialoge pro Tag", "Trail Builder und GPX-Export", "KI-Pläne auf Abruf", "Smart Journal per Stimme", "Lange, ausführliche Analysen"] },
    ],
    apres: "Am Ende des Tests wird nichts gelöscht: dein Konto fällt auf die Gratis-Stufe zurück. Deine Aktivitäten werden weiter synchronisiert, Verlauf und Rennen bleiben lesbar. Es enden die Verordnung neuer Einheiten und die KI-Dialoge.",
  },
  cta: { title: "Bereit für Leistung?", subtitle: "Schließe dich den Läufern an, die mit Pacevo smarter trainieren.", primary: "Kostenloses Konto erstellen", secondary: "Anmelden", note: "Gratis · Keine Kreditkarte · Jederzeit kündbar" },
};

const es: LandingDict = {
  nav: { programs: "Programas", features: "Funciones", pricing: "Precios", blog: "Blog", reviews: "Opiniones", login: "Iniciar sesión", trial: "Prueba gratis" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "Tu reloj ya lo mide todo: VFC, sueño, carga, ritmos. Pacevo lo convierte en una sesión — duración, intensidad, recuperación — recalculada en cada sincronización.", ctaPrimary: "Empezar gratis" },
  sync: { title: "Sincroniza con", read: "Lectura de tus datos:", readValue: "las {n} plataformas.", push: "Envío de la sesión a tu reloj:", pushBridge: "Envío al {marque}:", pushBridgeValue: "a través de la app para iOS {app}.", pushApp: "Envío a una app de entrenamiento:", note: "Todo pasa por intervals.icu, que gestiona las conexiones oficiales de cada fabricante. Pacevo nunca accede directamente a tus cuentas. * El Apple Watch no tiene conexión oficial — una app iOS de terceros (Intervals Companion) cubre ambos sentidos: envía tus sesiones a intervals.icu y convierte el plan para tu reloj." },
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
      { title: "Sync Garmin, COROS, Suunto", desc: "Actividades, potencia, zonas cardio y datos de bienestar recogidos en continuo vía intervals.icu." },
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
    eyebrow: "Precios", title: "Tus datos siguen gratis. El entrenador se suscribe.",
    subtitle: "Crea tu cuenta, conecta tu reloj, conserva tu historial y el calendario de carreras sin pagar. El plan que se replanifica solo y los intercambios con la IA están en las fórmulas.",
    mois: "Mensual", an: "Anual", economie: "2 meses gratis", parMois: "/mes",
    essai: "{n} días de prueba de la IA, sin compromiso",
    ctaEssai: "Probar {n} días", ctaAbo: "Suscribirme",
    gratuitNote: "Sin tarjeta para el nivel gratuito.",
    plans: [
      { cle: "gratuit", name: "Gratis", pitch: "Tus datos, tus carreras y un adelanto de tu plan.", cta: "Crear mi cuenta",
        features: ["Sync Garmin, COROS, Suunto", "VFC, sueño y carga de entrenamiento", "Historial completo de tus sesiones", "14 000 carreras próximas", "Los 2 próximos días de tu plan", "Racha, ligas y trofeos"] },
      { cle: "starter", name: "Starter", pitch: "El entrenador que se replanifica, más 10 preguntas a la IA al día.", cta: "Probar 7 días",
        features: ["Todo lo gratuito", "Plan de 7 días replanificado en continuo", "Sesiones enviadas al reloj", "10 intercambios con la IA al día", "Análisis IA de tus sesiones", "Fisio IA, con foto"] },
      { cle: "premium", name: "Premium", pitch: "El mismo entrenador, más 30 preguntas a la IA al día.", badge: "El más elegido", cta: "Probar 7 días",
        features: ["Todo lo de Starter", "30 intercambios con la IA al día", "Trail Builder y exportación GPX", "Planes IA a demanda", "Smart Journal por voz", "Análisis largos y detallados"] },
    ],
    apres: "Al terminar la prueba no se borra nada: tu cuenta vuelve al nivel gratuito. Tus actividades se siguen sincronizando y tu historial y tus carreras siguen consultables. Lo que se detiene es la prescripción de nuevas sesiones y los intercambios con la IA.",
  },
  cta: { title: "¿Listo para rendir?", subtitle: "Únete a los corredores que entrenan de forma más inteligente con Pacevo.", primary: "Crear cuenta gratis", secondary: "Iniciar sesión", note: "Gratis · Sin tarjeta · Cancela cuando quieras" },
};

const pt: LandingDict = {
  nav: { programs: "Programas", features: "Funcionalidades", pricing: "Preços", blog: "Blog", reviews: "Avaliações", login: "Entrar", trial: "Teste grátis" },
  hero: { titleA: "Pace Your", titleB: "", accent: "Evolution", subtitle: "O teu relógio já mede tudo: VFC, sono, carga, ritmos. A Pacevo transforma isso num treino — duração, intensidade, recuperação — recalculado a cada sincronização.", ctaPrimary: "Começar grátis" },
  sync: { title: "Sincroniza com", read: "Leitura dos teus dados:", readValue: "as {n} plataformas.", push: "Envio do treino para o teu relógio:", pushBridge: "Envio para o {marque}:", pushBridgeValue: "através da app iOS {app}.", pushApp: "Envio para uma app de treino:", note: "Tudo passa pelo intervals.icu, que gere as ligações oficiais de cada fabricante. A Pacevo nunca acede diretamente às tuas contas. * O Apple Watch não tem ligação oficial — uma app iOS de terceiros (Intervals Companion) cobre ambos os sentidos: envia os teus treinos para o intervals.icu e converte o plano para o teu relógio." },
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
      { title: "Sync Garmin, COROS, Suunto", desc: "Atividades, potência, zonas cardio e dados de bem-estar recolhidos em contínuo via intervals.icu." },
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
    eyebrow: "Preços", title: "Os teus dados continuam grátis. O treinador é uma subscrição.",
    subtitle: "Cria a tua conta, liga o teu relógio, guarda o teu histórico e o calendário de provas sem pagar. O plano que se replanifica sozinho e as trocas com a IA estão nas fórmulas.",
    mois: "Mensal", an: "Anual", economie: "2 meses grátis", parMois: "/mês",
    essai: "{n} dias de teste da IA, sem compromisso",
    ctaEssai: "Testar {n} dias", ctaAbo: "Subscrever",
    gratuitNote: "Sem cartão para o nível gratuito.",
    plans: [
      { cle: "gratuit", name: "Grátis", pitch: "Os teus dados, as tuas provas e uma amostra do teu plano.", cta: "Criar a minha conta",
        features: ["Sync Garmin, COROS, Suunto", "VFC, sono e carga de treino", "Histórico completo das tuas sessões", "14 000 provas futuras", "Os 2 próximos dias do teu plano", "Série, ligas e troféus"] },
      { cle: "starter", name: "Starter", pitch: "O treinador que se replanifica, mais 10 perguntas à IA por dia.", cta: "Testar 7 dias",
        features: ["Tudo o gratuito", "Plano de 7 dias replanificado em contínuo", "Sessões enviadas para o relógio", "10 trocas com a IA por dia", "Análise IA das tuas sessões", "Fisio IA, com foto"] },
      { cle: "premium", name: "Premium", pitch: "O mesmo treinador, mais 30 perguntas à IA por dia.", badge: "O mais escolhido", cta: "Testar 7 dias",
        features: ["Tudo o do Starter", "30 trocas com a IA por dia", "Trail Builder e exportação GPX", "Planos IA a pedido", "Smart Journal por voz", "Análises longas e detalhadas"] },
    ],
    apres: "No fim do teste nada é apagado: a tua conta volta ao nível gratuito. As tuas atividades continuam a sincronizar e o teu histórico e provas continuam consultáveis. O que para é a prescrição de novas sessões e as trocas com a IA.",
  },
  cta: { title: "Pronto para performar?", subtitle: "Junta-te aos corredores que treinam de forma mais inteligente com a Pacevo.", primary: "Criar conta grátis", secondary: "Entrar", note: "Grátis · Sem cartão · Cancela quando quiseres" },
};

export const LANDING: Record<Lang, LandingDict> = { fr, en, de, es, pt };
