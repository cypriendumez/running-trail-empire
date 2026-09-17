import type { Lang } from "@/lib/i18n/translations";
import type { CleProgramme } from "@/lib/plans/catalogue";

/**
 * Libellés de la page « Plans d'entraînement ».
 *
 * Les NOMS des programmes reprennent, mot pour mot, les cartes de la landing : ce que le
 * visiteur a cliqué dehors doit porter le même nom dedans. `tests/plans.test.ts` vérifie
 * que les neuf cartes ont bien un programme derrière.
 */
export type PlansDict = {
  titre: string; sousTitre: string;
  niveau: string; niveaux: Record<"debutant" | "intermediaire" | "confirme" | "elite", string>;
  volumeActuel: string; parSemaine: string; duree: string; semaines: string;
  choisir: string; retour: string;
  groupeCourse: string; groupeSansCourse: string;
  colSemaine: string; colPhase: string; colVolume: string; colLongue: string; colQualite: string; colSansImpact: string;
  phases: Record<"Reprise" | "Base" | "Développement" | "Spécifique" | "Affûtage", string>;
  decharge: string; marcheCourse: string; sansImpact: string; aucuneQualite: string;
  total: string; avertissement: string; complement: string;
  noms: Record<CleProgramme, string>;
  pitchs: Record<CleProgramme, string>;
};

const NOMS_FR: Record<CleProgramme, string> = {
  km5: "5 kilomètres", km10: "10 kilomètres", semi: "Semi-marathon", marathon: "Marathon",
  trail: "Trail running", debutant: "Débuter en course", vitesse: "Améliorer sa vitesse",
  blessure: "Reprendre après blessure", poids: "Courir pour perdre du poids",
};

export const PLANS_I18N: Record<Lang, PlansDict> = {
  fr: {
    titre: "Plans d'entraînement", sousTitre: "Des plans complets, construits sur TON volume actuel et ton niveau. Ils complètent le coach : lui décide de ta séance de demain, ceux-ci montrent la trajectoire des prochains mois.",
    niveau: "Ton niveau", niveaux: { debutant: "Débutant", intermediaire: "Intermédiaire", confirme: "Confirmé", elite: "Élite" },
    volumeActuel: "Ton volume actuel", parSemaine: "km/sem", duree: "Durée", semaines: "semaines",
    choisir: "Voir le plan", retour: "Tous les plans",
    groupeCourse: "Préparer une course", groupeSansCourse: "Sans course à préparer",
    colSemaine: "Sem.", colPhase: "Phase", colVolume: "Volume", colLongue: "Sortie longue", colQualite: "Qualité", colSansImpact: "Sans impact",
    phases: { "Reprise": "Reprise", "Base": "Base", "Développement": "Développement", "Spécifique": "Spécifique", "Affûtage": "Affûtage" },
    decharge: "décharge", marcheCourse: "Marche/course", sansImpact: "Volume sans impact", aucuneQualite: "—",
    total: "Volume total", avertissement: "Ce plan part du volume que tu cours DÉJÀ. Si tu reprends après une coupure, repars plus bas que ce qu'il indique.",
    complement: "En complément du coach",
    noms: NOMS_FR,
    pitchs: {
      km5: "Court, mais tout sauf facile : de la VMA, du seuil et de l'allure spécifique.",
      km10: "La distance qui demande à la fois de la vitesse et de l'endurance.",
      semi: "Le seuil devient la séance reine, et la sortie longue s'allonge vraiment.",
      marathon: "Le volume et l'allure marathon priment. Le plan le plus long, et le plus exigeant.",
      trail: "Côtes, dénivelé et travail spécifique — la durée compte plus que les kilomètres.",
      debutant: "Marche et course en alternance, aucune séance dure, et une progression très prudente.",
      vitesse: "Un bloc court et dense pour gagner en vitesse, sans course à préparer.",
      blessure: "Retour progressif : moitié du volume sans impact, marche/course, zéro fractionné au début.",
      poids: "Volume régulier, articulations ménagées, et jamais de déficit cumulé à un bloc dur.",
    },
  },
  en: {
    titre: "Training plans", sousTitre: "Complete plans built on YOUR current volume and level. They complement the coach: it decides tomorrow's session, these show the months ahead.",
    niveau: "Your level", niveaux: { debutant: "Beginner", intermediaire: "Intermediate", confirme: "Advanced", elite: "Elite" },
    volumeActuel: "Your current volume", parSemaine: "km/wk", duree: "Length", semaines: "weeks",
    choisir: "View plan", retour: "All plans",
    groupeCourse: "Training for a race", groupeSansCourse: "No race to prepare",
    colSemaine: "Wk", colPhase: "Phase", colVolume: "Volume", colLongue: "Long run", colQualite: "Quality", colSansImpact: "Impact-free",
    phases: { "Reprise": "Return", "Base": "Base", "Développement": "Build", "Spécifique": "Specific", "Affûtage": "Taper" },
    decharge: "deload", marcheCourse: "Walk/run", sansImpact: "Impact-free volume", aucuneQualite: "—",
    total: "Total volume", avertissement: "This plan starts from the volume you ALREADY run. If you are coming back from a break, start lower than it says.",
    complement: "Alongside the coach",
    noms: { km5: "5 kilometres", km10: "10 kilometres", semi: "Half marathon", marathon: "Marathon", trail: "Trail running", debutant: "Start running", vitesse: "Improve your speed", blessure: "Return after injury", poids: "Running for weight loss" },
    pitchs: {
      km5: "Short, but anything but easy: vVO2max, threshold and race-specific pace.",
      km10: "The distance that demands speed and endurance at once.",
      semi: "Threshold becomes the key session, and the long run really grows.",
      marathon: "Volume and marathon pace rule. The longest and most demanding plan.",
      trail: "Hills, elevation and specific work — time on feet matters more than kilometres.",
      debutant: "Walking and running alternated, no hard sessions, and a very careful progression.",
      vitesse: "A short, dense block to get faster, with no race to prepare.",
      blessure: "Progressive return: half the volume impact-free, walk/run, no intervals early on.",
      poids: "Steady volume, joints protected, and never a deficit stacked on a hard block.",
    },
  },
  de: {
    titre: "Trainingspläne", sousTitre: "Vollständige Pläne, gebaut auf DEINEM aktuellen Umfang und Niveau. Sie ergänzen den Coach: er entscheidet über morgen, diese zeigen die nächsten Monate.",
    niveau: "Dein Niveau", niveaux: { debutant: "Anfänger", intermediaire: "Fortgeschritten", confirme: "Erfahren", elite: "Elite" },
    volumeActuel: "Dein aktueller Umfang", parSemaine: "km/Wo", duree: "Dauer", semaines: "Wochen",
    choisir: "Plan ansehen", retour: "Alle Pläne",
    groupeCourse: "Auf einen Wettkampf hin", groupeSansCourse: "Ohne Wettkampf",
    colSemaine: "Wo", colPhase: "Phase", colVolume: "Umfang", colLongue: "Langer Lauf", colQualite: "Qualität", colSansImpact: "Ohne Stoß",
    phases: { "Reprise": "Wiedereinstieg", "Base": "Grundlage", "Développement": "Aufbau", "Spécifique": "Spezifisch", "Affûtage": "Tapering" },
    decharge: "Entlastung", marcheCourse: "Geh/Lauf", sansImpact: "Umfang ohne Stoßbelastung", aucuneQualite: "—",
    total: "Gesamtumfang", avertissement: "Dieser Plan geht von dem Umfang aus, den du BEREITS läufst. Nach einer Pause starte niedriger als angegeben.",
    complement: "Ergänzend zum Coach",
    noms: { km5: "5 Kilometer", km10: "10 Kilometer", semi: "Halbmarathon", marathon: "Marathon", trail: "Trailrunning", debutant: "Mit dem Laufen beginnen", vitesse: "Schneller werden", blessure: "Rückkehr nach Verletzung", poids: "Laufen zum Abnehmen" },
    pitchs: {
      km5: "Kurz, aber alles andere als leicht: vVO2max, Schwelle und Renntempo.",
      km10: "Die Distanz, die Tempo und Ausdauer zugleich verlangt.",
      semi: "Die Schwelle wird zur Schlüsseleinheit, der lange Lauf wächst deutlich.",
      marathon: "Umfang und Marathontempo bestimmen alles. Der längste und härteste Plan.",
      trail: "Berge, Höhenmeter und spezifische Arbeit — die Zeit zählt mehr als Kilometer.",
      debutant: "Gehen und Laufen im Wechsel, keine harten Einheiten, sehr vorsichtiger Aufbau.",
      vitesse: "Ein kurzer, dichter Block für mehr Tempo, ohne Wettkampf im Plan.",
      blessure: "Schrittweise Rückkehr: halber Umfang ohne Stoß, Geh/Lauf, anfangs keine Intervalle.",
      poids: "Gleichmäßiger Umfang, geschonte Gelenke, nie ein Defizit auf einem harten Block.",
    },
  },
  es: {
    titre: "Planes de entrenamiento", sousTitre: "Planes completos construidos sobre TU volumen actual y tu nivel. Complementan al entrenador: él decide la sesión de mañana, estos muestran los próximos meses.",
    niveau: "Tu nivel", niveaux: { debutant: "Principiante", intermediaire: "Intermedio", confirme: "Avanzado", elite: "Élite" },
    volumeActuel: "Tu volumen actual", parSemaine: "km/sem", duree: "Duración", semaines: "semanas",
    choisir: "Ver el plan", retour: "Todos los planes",
    groupeCourse: "Preparar una carrera", groupeSansCourse: "Sin carrera que preparar",
    colSemaine: "Sem.", colPhase: "Fase", colVolume: "Volumen", colLongue: "Tirada larga", colQualite: "Calidad", colSansImpact: "Sin impacto",
    phases: { "Reprise": "Retorno", "Base": "Base", "Développement": "Desarrollo", "Spécifique": "Específico", "Affûtage": "Afinamiento" },
    decharge: "descarga", marcheCourse: "Caminar/correr", sansImpact: "Volumen sin impacto", aucuneQualite: "—",
    total: "Volumen total", avertissement: "Este plan parte del volumen que YA corres. Si vuelves de un parón, empieza más abajo de lo que indica.",
    complement: "Junto al entrenador",
    noms: { km5: "5 kilómetros", km10: "10 kilómetros", semi: "Media maratón", marathon: "Maratón", trail: "Trail running", debutant: "Empezar a correr", vitesse: "Mejorar tu velocidad", blessure: "Volver tras una lesión", poids: "Correr para perder peso" },
    pitchs: {
      km5: "Corta, pero de fácil no tiene nada: VAM, umbral y ritmo específico.",
      km10: "La distancia que exige velocidad y resistencia a la vez.",
      semi: "El umbral se vuelve la sesión reina y la tirada larga crece de verdad.",
      marathon: "Mandan el volumen y el ritmo de maratón. El plan más largo y exigente.",
      trail: "Cuestas, desnivel y trabajo específico — el tiempo cuenta más que los kilómetros.",
      debutant: "Caminar y correr alternados, ninguna sesión dura y una progresión muy prudente.",
      vitesse: "Un bloque corto y denso para ganar velocidad, sin carrera que preparar.",
      blessure: "Vuelta progresiva: mitad del volumen sin impacto, caminar/correr, sin series al principio.",
      poids: "Volumen regular, articulaciones cuidadas y nunca un déficit sumado a un bloque duro.",
    },
  },
  pt: {
    titre: "Planos de treino", sousTitre: "Planos completos construídos sobre O TEU volume atual e o teu nível. Complementam o treinador: ele decide a sessão de amanhã, estes mostram os próximos meses.",
    niveau: "O teu nível", niveaux: { debutant: "Iniciante", intermediaire: "Intermédio", confirme: "Avançado", elite: "Elite" },
    volumeActuel: "O teu volume atual", parSemaine: "km/sem", duree: "Duração", semaines: "semanas",
    choisir: "Ver o plano", retour: "Todos os planos",
    groupeCourse: "Preparar uma prova", groupeSansCourse: "Sem prova para preparar",
    colSemaine: "Sem.", colPhase: "Fase", colVolume: "Volume", colLongue: "Longão", colQualite: "Qualidade", colSansImpact: "Sem impacto",
    phases: { "Reprise": "Retorno", "Base": "Base", "Développement": "Desenvolvimento", "Spécifique": "Específico", "Affûtage": "Afinamento" },
    decharge: "descarga", marcheCourse: "Caminhar/correr", sansImpact: "Volume sem impacto", aucuneQualite: "—",
    total: "Volume total", avertissement: "Este plano parte do volume que JÁ corres. Se voltas de uma paragem, começa abaixo do que indica.",
    complement: "A par do treinador",
    noms: { km5: "5 quilómetros", km10: "10 quilómetros", semi: "Meia maratona", marathon: "Maratona", trail: "Trail running", debutant: "Começar a correr", vitesse: "Melhorar a velocidade", blessure: "Voltar após lesão", poids: "Correr para perder peso" },
    pitchs: {
      km5: "Curta, mas tudo menos fácil: VAM, limiar e ritmo específico.",
      km10: "A distância que exige velocidade e resistência ao mesmo tempo.",
      semi: "O limiar torna-se a sessão rainha e o longão cresce a sério.",
      marathon: "Mandam o volume e o ritmo de maratona. O plano mais longo e exigente.",
      trail: "Subidas, desnível e trabalho específico — o tempo conta mais do que os quilómetros.",
      debutant: "Caminhada e corrida alternadas, nenhuma sessão dura e progressão muito prudente.",
      vitesse: "Um bloco curto e denso para ganhar velocidade, sem prova para preparar.",
      blessure: "Regresso progressivo: metade do volume sem impacto, caminhar/correr, sem séries no início.",
      poids: "Volume regular, articulações poupadas e nunca um défice somado a um bloco duro.",
    },
  },
};
