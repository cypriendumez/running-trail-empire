import Link from "next/link";
import { Activity, Gauge, Zap, Target, Dumbbell, Moon, Footprints, Timer, ArrowLeft, Library, Award } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bibliothèque d'entraînements · Coach" };

type Workout = { name: string; tag: string; objective: string; structure: string; zone: string; profil: string };
type Cat = { title: string; icon: typeof Activity; from: string; to: string; intro: string; workouts: Workout[] };

const CATALOG: Cat[] = [
  {
    title: "Endurance — la base (70-80 % du volume)", icon: Activity, from: "#059669", to: "#16a34a",
    intro: "Le socle aérobie. L'essentiel du volume, à intensité faible : c'est ce qui rend endurant sans fatiguer.",
    workouts: [
      { name: "Endurance fondamentale (footing)", tag: "Z2 · 65-75 % VMA", objective: "Développer le moteur aérobie : mitochondries, capillaires, lipolyse.", structure: "40-75 min à allure de conversation.", zone: "Z2", profil: "Tous · quotidien" },
      { name: "Récupération active", tag: "Z1 · < 65 % VMA", objective: "Accélérer la récup après une séance dure, sans stress.", structure: "20-40 min très lent, on finit frais.", zone: "Z1", profil: "Tous · lendemain de séance dure" },
      { name: "Sortie longue (SL)", tag: "Z2 · 1h15-2h30", objective: "Endurance, économie, mental, tenir la distance.", structure: "Footing prolongé Z2, ravito si > 1h30.", zone: "Z2", profil: "Semi · marathon · trail" },
      { name: "SL à finish progressif", tag: "Z2 → Z3", objective: "Apprendre à courir vite en état de fatigue.", structure: "SL dont les 20-30 dernières min en Z3 (allure marathon).", zone: "Z2-Z3", profil: "Marathon · trail" },
      { name: "SL avec blocs allure spécifique", tag: "Z2 + Z3", objective: "Spécificité marathon dans la durée.", structure: "1h45-2h dont 2-3 × 15-20 min à allure marathon.", zone: "Z2-Z3", profil: "Marathon confirmé" },
      { name: "Footing à jeun", tag: "Z1-Z2 · < 60 min", objective: "Améliorer l'utilisation des graisses, épargner le glycogène.", structure: "Footing lent le matin avant petit-déj.", zone: "Z1-Z2", profil: "Confirmé · prépa marathon/ultra" },
      { name: "Bi-quotidien (double run)", tag: "2 footings/jour", objective: "Augmenter le volume sans une séance unique trop longue.", structure: "2 footings faciles dans la journée (matin/soir).", zone: "Z1-Z2", profil: "Confirmé/élite · haut volume" },
      { name: "Sortie longue trail (rando-course)", tag: "Z1-Z2 + D+", objective: "Temps debout, gestion du dénivelé et de la nutrition.", structure: "2-5 h en nature, marche en côte raide assumée.", zone: "Z1-Z2", profil: "Trail · ultra" },
      { name: "Footing sur sol souple", tag: "Z2", objective: "Soulager les articulations, renforcer le pied.", structure: "Footing sur chemin, herbe, sentier souple.", zone: "Z2", profil: "Tous · prévention" },
      { name: "Reprise progressive", tag: "Z1-Z2 court", objective: "Réathlétisation après blessure ou coupure.", structure: "Alternance course/marche, durées croissantes (+10 %/sem).", zone: "Z1-Z2", profil: "Reprise · débutant" },
      { name: "Footing avec accélérations", tag: "Z2 + relances", objective: "Réveiller la vitesse sans faire une vraie séance dure.", structure: "Footing Z2 avec 5-6 accélérations de 20-30 s disséminées.", zone: "Z2", profil: "Tous" },
      { name: "Sortie vallonnée", tag: "Z2 + D+", objective: "Endurance avec relief, préparer le dénivelé en douceur.", structure: "1h-1h30 sur parcours vallonné, allure régulée à la FC (pas au chrono).", zone: "Z2", profil: "Trail · préparation relief" },
      { name: "Endurance active (steady state)", tag: "Z2-Z3", objective: "Soutenir une allure plus engagée que le footing, sans atteindre le seuil.", structure: "30-50 min à allure « steady », un cran sous le tempo.", zone: "Z2-Z3", profil: "Intermédiaire +" },
      { name: "Sortie longue avec surges", tag: "Z2 + relances", objective: "Travailler les relances en état de fatigue, casser la monotonie.", structure: "SL Z2 avec 6-8 × 1 min un peu plus vif, espacés d'environ 10 min.", zone: "Z2-Z3", profil: "Semi · marathon · trail" },
    ],
  },
  {
    title: "Seuil — l'allure tenable ~1 h", icon: Gauge, from: "#ea580c", to: "#d97706",
    intro: "La zone reine pour courir vite plus longtemps : on repousse le seuil lactique.",
    workouts: [
      { name: "Seuil continu (tempo)", tag: "Z3-Z4 · 84-88 % VMA", objective: "Résistance à l'effort soutenu.", structure: "20-30 min en continu à allure semi (« confortablement dur »).", zone: "Z3-Z4", profil: "10k · semi" },
      { name: "Seuil fractionné", tag: "Z4 · ~88 % VMA", objective: "Accumuler du temps au seuil à haute qualité.", structure: "2-3 × 10-15 min Z4, récup 2-3 min trottinée.", zone: "Z4", profil: "10k · semi · marathon" },
      { name: "Cruise intervals", tag: "Z4", objective: "Tenue du seuil, contrôle fin de l'allure.", structure: "4-6 × 5-8 min au seuil, récup 1-1,5 min.", zone: "Z4", profil: "Intermédiaire +" },
      { name: "Tempo progressif", tag: "Z3 → Z4", objective: "Gestion d'allure, montée en intensité maîtrisée.", structure: "30-40 min en accélérant doucement vers le seuil.", zone: "Z3-Z4", profil: "Tous" },
      { name: "Seuil long", tag: "Z3-Z4 · 40-60 min", objective: "Endurance au seuil pour le marathon.", structure: "40-60 min continu ou 2 × 25 min.", zone: "Z3-Z4", profil: "Marathon confirmé" },
      { name: "Over-under (sous/sur seuil)", tag: "Z3 ↔ Z4", objective: "Tolérance et recyclage du lactate.", structure: "3-4 × (2 min sous seuil + 1 min au-dessus).", zone: "Z3-Z4", profil: "Confirmé · 10k/semi" },
      { name: "Seuil en côte", tag: "Z4 · montée", objective: "Force + seuil, spécifique relief.", structure: "3-4 × 6-8 min en faux-plat montant au seuil.", zone: "Z4", profil: "Trail" },
      { name: "Threshold ladder", tag: "Z4", objective: "Varier les durées au seuil.", structure: "5-8-10-8-5 min Z4, récup 2 min.", zone: "Z4", profil: "Confirmé" },
      { name: "Seuil par blocs courts", tag: "Z4", objective: "Densité au seuil avec récupération minimale.", structure: "8-10 × 3 min Z4, récup 1 min trottinée.", zone: "Z4", profil: "Confirmé" },
      { name: "Tempo negative split", tag: "Z3 → Z4", objective: "Apprendre à accélérer quand la fatigue monte.", structure: "10 min Z3 + 10 min Z4 enchaînés sans pause.", zone: "Z3-Z4", profil: "Tous" },
    ],
  },
  {
    title: "VMA / VO2max — le plafond", icon: Zap, from: "#dc2626", to: "#e11d48",
    intro: "Le travail le plus intense : il relève ta cylindrée maximale. À doser (≈ 1×/sem).",
    workouts: [
      { name: "15/15", tag: "Z5", objective: "Introduction au fractionné, VO2max accessible.", structure: "2 × (8-10 × 15 s vite / 15 s lent).", zone: "Z5", profil: "Débutant fractionné" },
      { name: "30/30", tag: "Z5 · 100-105 % VMA", objective: "VO2max avec gros volume d'effort, peu de fatigue.", structure: "2 séries de 8-10 × (30 s / 30 s).", zone: "Z5", profil: "Tous · intro VMA" },
      { name: "30/15", tag: "Z5 · 105 %", objective: "VO2max plus dense (récup raccourcie).", structure: "2 × (6-8 × 30 s vite / 15 s lent).", zone: "Z5", profil: "Confirmé" },
      { name: "VMA 200 m", tag: "Z5 · 105-110 %", objective: "Vitesse + VO2max.", structure: "10-12 × 200 m, récup = temps d'effort.", zone: "Z5", profil: "5k · 10k" },
      { name: "VMA 400 m", tag: "Z5 · 100-105 %", objective: "VO2max classique.", structure: "8-12 × 400 m, récup = temps d'effort trottiné.", zone: "Z5", profil: "Tous intermédiaire +" },
      { name: "VMA 600 m", tag: "Z5", objective: "VO2max + début de tenue.", structure: "6-8 × 600 m, récup 1,5-2 min.", zone: "Z5", profil: "10k" },
      { name: "VMA 1000 m", tag: "Z4-Z5 · 95-100 %", objective: "VO2max ET capacité à la tenir.", structure: "5-6 × 1000 m, récup 2-3 min trottinée.", zone: "Z4-Z5", profil: "10k · semi" },
      { name: "VMA 1200 m", tag: "Z4-Z5", objective: "Tenue VO2max, spécifique 10k.", structure: "4-5 × 1200 m, récup 3 min.", zone: "Z4-Z5", profil: "10k/semi confirmé" },
      { name: "Pyramide", tag: "Z5", objective: "Varier les durées, casser la monotonie.", structure: "200-400-600-800-600-400-200 m, récup proportionnelle.", zone: "Z5", profil: "Tous intermédiaire +" },
      { name: "Fractionné descendant", tag: "Z5", objective: "Finir vite, gérer la fatigue.", structure: "1000-800-600-400-200 m de + en + vite.", zone: "Z5", profil: "Confirmé" },
      { name: "Côtes courtes (VMA en côte)", tag: "Force + VO2max", objective: "VO2max + puissance, moins traumatisant.", structure: "8-10 × 30-45 s en montée vive, récup descente.", zone: "Z5", profil: "Tous · trail" },
      { name: "Séance Billat", tag: "Z5 · 100 % VMA", objective: "Référence VO2max (temps limite à VMA).", structure: "Ex : 5 × (3 min à VMA / 3 min récup).", zone: "Z5", profil: "Confirmé" },
      { name: "VMA 300 m", tag: "Z5 · 105 %", objective: "Pont entre vitesse pure et VO2max.", structure: "12-14 × 300 m, récup 45 s-1 min trottinée.", zone: "Z5", profil: "5k · 10k" },
      { name: "Fractionné mixte", tag: "Z4-Z5", objective: "Combiner VO2max et tenue dans une même séance.", structure: "Ex : 6 × 400 m (récup 1 min) puis 3 × 1000 m (récup 2 min).", zone: "Z4-Z5", profil: "Confirmé" },
    ],
  },
  {
    title: "Spécifique course & allure", icon: Target, from: "#2563eb", to: "#4f46e5",
    intro: "On automatise l'allure exacte de l'objectif et on travaille les changements de rythme.",
    workouts: [
      { name: "Allure 5 km", tag: "Z4-Z5", objective: "Spécifique 5 km.", structure: "5-6 × 1000 m à allure 5k, récup 1-2 min.", zone: "Z4-Z5", profil: "5k" },
      { name: "Allure 10 km", tag: "Z4", objective: "Spécifique 10 km.", structure: "3-5 × 2 km à allure 10k, récup 2-3 min.", zone: "Z4", profil: "10k" },
      { name: "Allure spécifique semi (ASS)", tag: "Z3-Z4", objective: "Automatiser l'allure semi.", structure: "Blocs de 10-20 min à allure semi.", zone: "Z3-Z4", profil: "Semi" },
      { name: "Allure spécifique marathon (ASM)", tag: "Z3", objective: "Mémoriser et économiser l'allure marathon.", structure: "Blocs de 20-40 min (jusqu'à 2 × 6 km) à allure marathon.", zone: "Z3", profil: "Marathon" },
      { name: "Séance combinée (seuil + spécifique)", tag: "Z4 + Z3", objective: "Courir à l'allure cible en préfatigue.", structure: "Ex : 20 min seuil + 30 min allure marathon.", zone: "Z3-Z4", profil: "Marathon/semi confirmé" },
      { name: "Fartlek structuré", tag: "variable", objective: "Relances, changements de rythme.", structure: "1-2-3-2-1 min vif / récup égale.", zone: "Z3-Z5", profil: "Tous" },
      { name: "Fartlek libre (suédois)", tag: "variable · ludique", objective: "Travailler au ressenti, sans montre.", structure: "Accélérations libres (jusqu'au prochain arbre…).", zone: "Z3-Z5", profil: "Tous · plaisir" },
      { name: "Sortie progressive (negative split)", tag: "Z2 → Z4", objective: "Gestion de l'effort, finir plus vite.", structure: "Accélération continue jusqu'au seuil.", zone: "Z2-Z4", profil: "Tous" },
      { name: "Simulation de course", tag: "allure cible", objective: "Répéter les conditions de course (ravito, gestion).", structure: "Portion à allure objectif avec matériel de course.", zone: "Z3-Z4", profil: "Avant objectif" },
      { name: "Séance sandwich", tag: "facile-dur-facile", objective: "Encaisser un bloc dur entre deux portions faciles (gestion mentale).", structure: "20 min Z2 + 20 min seuil + 15 min Z2.", zone: "Z2-Z4", profil: "Confirmé" },
      { name: "Allure course en préfatigue", tag: "Z2 + Z3", objective: "Tenir l'allure cible avec les jambes lourdes (clé marathon).", structure: "Sortie 1h30 dont les 20 dernières min à allure objectif.", zone: "Z2-Z3", profil: "Marathon · semi" },
      { name: "Sortie longue à allure marathon", tag: "Z3", objective: "Spécificité marathon : tenir l'allure cible sur une longue durée.", structure: "1h30-2h dont 60-90 min à allure marathon (progressif).", zone: "Z3", profil: "Marathon confirmé" },
    ],
  },
  {
    title: "Vitesse & technique", icon: Footprints, from: "#0d9488", to: "#0891b2",
    intro: "Améliore l'économie de course, le recrutement musculaire et la qualité de foulée.",
    workouts: [
      { name: "Lignes droites (strides)", tag: "accélérations", objective: "Économie, recrutement, réveil neuromusculaire.", structure: "4-6 × 80-100 m progressifs, récup complète. Après footing.", zone: "Z4-Z5", profil: "Tous · 2-3×/sem" },
      { name: "Éducatifs / gammes", tag: "technique", objective: "Améliorer la gestuelle (montées de genoux, talons-fesses, foulées bondissantes).", structure: "2-3 × 20-30 m de chaque, à l'échauffement.", zone: "—", profil: "Tous" },
      { name: "Sprints courts", tag: "neuromusculaire", objective: "Vitesse pure, puissance.", structure: "6-8 × 60-100 m, récup complète (2-3 min).", zone: "Z5+", profil: "Confirmé · 5k" },
      { name: "Travail de cadence", tag: "175-180 spm", objective: "Améliorer l'économie via une cadence plus élevée.", structure: "Sur footing : blocs de 1 min à cadence cible (métronome).", zone: "Z2", profil: "Tous · technique" },
      { name: "Foulées bondissantes (skipping)", tag: "pliométrie tech.", objective: "Raideur élastique, propulsion.", structure: "Séries courtes de bondissements contrôlés.", zone: "—", profil: "Confirmé" },
      { name: "Diagonales / accélérations (build-up)", tag: "progressif", objective: "Monter progressivement jusqu'à la vitesse maximale contrôlée.", structure: "6-8 × 100 m en accélérant graduellement, récup marche complète.", zone: "Z4-Z5", profil: "Tous" },
    ],
  },
  {
    title: "Force & trail", icon: Dumbbell, from: "#7c3aed", to: "#9333ea",
    intro: "Prévention des blessures, puissance, économie de course et spécificité trail.",
    workouts: [
      { name: "Côtes longues", tag: "Z4 · puissance", objective: "Force spécifique + seuil, sans impact à plat.", structure: "4-6 × 2-3 min en côte à 85-90 % FC max, récup descente.", zone: "Z4", profil: "Tous · trail" },
      { name: "Côtes moyennes", tag: "Z5 · 1-2 min", objective: "VO2max + force.", structure: "6-8 × 1-2 min en montée soutenue.", zone: "Z5", profil: "Trail · 10k" },
      { name: "Côtes sprint (force max)", tag: "explosif", objective: "Force maximale, puissance.", structure: "8-10 × 10-15 s en montée raide à fond, récup complète.", zone: "Z5+", profil: "Confirmé" },
      { name: "Renforcement musculaire (Renfo)", tag: "force · 2×/sem", objective: "Prévenir les blessures, stabiliser le bassin, gagner en puissance.", structure: "Gainage, fentes, squats, ponts fessiers, mollets, proprio (20-30 min).", zone: "—", profil: "Tous · indispensable" },
      { name: "Pliométrie", tag: "raideur élastique", objective: "Économie de course, réactivité.", structure: "Sauts, bondissements, montées de marche dynamiques.", zone: "—", profil: "Intermédiaire +" },
      { name: "PPG / circuit training", tag: "force générale", objective: "Préparation physique générale du coureur.", structure: "Circuit gainage + bas du corps + mobilité enchaîné.", zone: "—", profil: "Tous" },
      { name: "Travail de descente (trail)", tag: "excentrique", objective: "Renforcer les quadriceps, encaisser les descentes.", structure: "Répétitions de descente technique à allure contrôlée.", zone: "Z2-Z3", profil: "Trail · ultra" },
      { name: "Marche active en forte pente", tag: "technique ultra", objective: "Économiser l'énergie en montée raide (avec bâtons).", structure: "Répétitions de montée > 15-20 % en marche soutenue.", zone: "Z2-Z3", profil: "Ultra · trail montagne" },
      { name: "Escaliers / dénivelé répété", tag: "force D+", objective: "Force spécifique au dénivelé.", structure: "Répétitions de montée d'escaliers / côte courte raide.", zone: "Z4", profil: "Trail" },
      { name: "Descentes chronométrées", tag: "trail · excentrique", objective: "Vitesse + technique en descente, renforcer les quadriceps.", structure: "5-8 × descente technique de 1-2 min, remontée en récup.", zone: "Z3-Z4", profil: "Trail" },
      { name: "Montées en bâtons", tag: "trail montagne", objective: "Technique de poussée aux bâtons, économie en forte pente.", structure: "Répétitions de montée raide avec bâtons, gainage du tronc.", zone: "Z3", profil: "Ultra · montagne" },
      { name: "Squat sauté lesté", tag: "force-vitesse", objective: "Puissance et explosivité des jambes.", structure: "4 × 6 squats sautés avec charge légère (gilet/haltères), récup complète.", zone: "—", profil: "Confirmé" },
    ],
  },
  {
    title: "Récupération & repos", icon: Moon, from: "#0284c7", to: "#0891b2",
    intro: "C'est là qu'on progresse réellement : le corps assimile. Sacré, jamais négligé.",
    workouts: [
      { name: "Repos complet", tag: "0 course", objective: "Assimilation, surcompensation, prévention surentraînement.", structure: "Pas de course. Sommeil, mobilité douce.", zone: "—", profil: "Tous · ≥ 1×/sem" },
      { name: "Décrassage", tag: "Z1", objective: "Évacuer la fatigue après une course ou grosse séance.", structure: "20-30 min footing très lent.", zone: "Z1", profil: "Tous" },
      { name: "Cross-training", tag: "sans impact", objective: "Maintenir l'aérobie sans traumatisme (récup ou blessé).", structure: "Vélo, natation, elliptique 30-60 min en aisance.", zone: "Z1-Z2", profil: "Récup · reprise" },
      { name: "Marche / randonnée douce", tag: "actif léger", objective: "Bouger sans charge, oxygéner.", structure: "Marche en nature 30-90 min.", zone: "—", profil: "Tous · jour off" },
      { name: "Mobilité / étirements / yoga", tag: "souplesse", objective: "Amplitude, détente, prévention.", structure: "15-30 min mobilité ciblée (hanches, chevilles, ischios).", zone: "—", profil: "Tous" },
      { name: "Récupération passive", tag: "passif", objective: "Optimiser la récup (sommeil, froid, compression).", structure: "Sauna, bain froid, chaussettes de compression, massage.", zone: "—", profil: "Après grosse charge/course" },
      { name: "Aquajogging", tag: "sans impact", objective: "Maintenir l'aérobie sans aucun impact (idéal blessé ou en récup).", structure: "20-40 min de course en eau profonde avec ceinture de flottaison.", zone: "Z1-Z2", profil: "Récup · reprise blessure" },
    ],
  },
  {
    title: "Séances signature (les classiques mondiales)", icon: Award, from: "#d97706", to: "#b45309",
    intro: "Les séances mythiques des meilleurs entraîneurs et athlètes — éprouvées au plus haut niveau.",
    workouts: [
      { name: "Yasso 800", tag: "prédicteur marathon", objective: "Travailler la VO2max tout en jaugeant son potentiel marathon.", structure: "10 × 800 m, récup = même durée trottinée. Le temps moyen (min:s) ≈ ton temps marathon visé (h:min).", zone: "Z4-Z5", profil: "Marathon confirmé" },
      { name: "Mona Fartlek", tag: "fartlek 20 min", objective: "Séance complète de densité et de relances en 20 min.", structure: "2×90 s / 4×60 s / 4×30 s / 4×15 s vifs, chaque effort suivi d'une récup trottinée de durée égale.", zone: "Z3-Z5", profil: "Intermédiaire +" },
      { name: "Michigan", tag: "alternance piste/tempo", objective: "Énorme stimulation en alternant rapide et tempo.", structure: "1600 m vite + 1600 m tempo + 1200 + tempo + 800 + tempo + 400, en continu.", zone: "Z4-Z5", profil: "Confirmé" },
      { name: "Double seuil (méthode norvégienne)", tag: "2× seuil/jour", objective: "Gros volume au seuil en contrôlant le lactate (méthode Ingebrigtsen).", structure: "2 séances de seuil dans la journée, allure « sous-seuil » contrôlée (jamais à fond).", zone: "Z3-Z4", profil: "Élite / très entraîné" },
      { name: "Critical Velocity (CV)", tag: "entre seuil et VMA", objective: "Travailler juste au-dessus du seuil (allure tenable ~30 min).", structure: "5-6 × 3 min à allure CV, récup 1 min.", zone: "Z4-Z5", profil: "10k · confirmé" },
      { name: "Progression kényane", tag: "3 phases", objective: "Finir nettement plus vite qu'on commence, maîtrise de l'effort.", structure: "Sortie en 3 tiers : facile (Z2) → modéré (Z3) → rapide (Z4) sur la fin.", zone: "Z2-Z4", profil: "Tous" },
    ],
  },
  {
    title: "Tests & évaluations", icon: Timer, from: "#475569", to: "#334155",
    intro: "Mesurer pour mieux calibrer : VMA, FC max et seuil servent à régler toutes les allures.",
    workouts: [
      { name: "Test VMA (demi-Cooper)", tag: "6 min max", objective: "Estimer la VMA (distance en 6 min → VMA).", structure: "Échauffement complet + 6 min à fond sur piste/plat.", zone: "Z5", profil: "Tous · tous les 6-8 sem" },
      { name: "VAMEVAL (paliers)", tag: "test progressif", objective: "VMA précise par paliers de vitesse.", structure: "Paliers de 30 s à vitesse croissante jusqu'à l'abandon.", zone: "Z3→Z5", profil: "Club · précis" },
      { name: "Test FC max", tag: "calibrage zones", objective: "Connaître la vraie FC max pour régler les zones.", structure: "Côte longue répétée en finissant à fond, ou fin de VMA.", zone: "Z5", profil: "Tous · 1-2×/an" },
      { name: "Contre-la-montre 3-5 km", tag: "évaluation forme", objective: "Mesurer la forme et la progression.", structure: "Échauffement + 3 à 5 km à fond, chrono.", zone: "Z4-Z5", profil: "Avant un cycle" },
      { name: "Test seuil terrain (30 min CLM)", tag: "FC seuil", objective: "Estimer la FC et l'allure de seuil (LTHR).", structure: "30 min à fond régulier ; FC moy des 20 dernières min ≈ LTHR.", zone: "Z4", profil: "Confirmé" },
    ],
  },
];

const total = CATALOG.reduce((s, c) => s + c.workouts.length, 0);

export default function EntrainementsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="relative overflow-hidden text-white" style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 45%,#0d9488 100%)" }}>
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-5xl px-5 py-8">
          <Link href="/admin/coach" className="inline-flex items-center gap-1.5 text-sm text-white/80 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> Retour au coach</Link>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur-md">
            <Library className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-50">Bibliothèque coach · {total} entraînements</span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-sm">Tous les entraînements</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-white/85">Le répertoire complet dans lequel l'IA pioche pour bâtir des plans <b>personnalisés</b> — selon le profil, l'objectif, l'historique, le sommeil et la forme de chaque coureur. Allures calculées depuis sa VMA. Pour progresser, sans se blesser.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-8 space-y-10">
        {CATALOG.map((cat) => (
          <section key={cat.title}>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: `linear-gradient(135deg,${cat.from},${cat.to})` }}>
                <cat.icon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold leading-tight text-zinc-900">{cat.title} <span className="text-sm font-normal text-zinc-400">· {cat.workouts.length}</span></h2>
                <p className="text-sm text-zinc-500">{cat.intro}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {cat.workouts.map((w) => (
                <div key={w.name} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-zinc-900">{w.name}</h3>
                    <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${cat.from}14`, color: cat.from }}>{w.tag}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600"><b className="text-zinc-700">Objectif :</b> {w.objective}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600"><b className="text-zinc-700">Structure :</b> {w.structure}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {w.zone !== "—" && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">Zone {w.zone}</span>}
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">👤 {w.profil}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-sm leading-relaxed text-emerald-900">
          <b>Comment l'IA personnalise :</b> pour chaque séance, elle choisit dans ce répertoire selon le <b>niveau/VMA</b>, l'<b>objectif</b> (5k → ultra), l'<b>historique</b> et les <b>séances récentes</b>, le <b>sommeil</b> et la <b>VFC/forme du jour</b>. Si le coureur est fatigué, elle allège ; sinon elle progresse (+10 %/sem max), varie les stimuli et respecte le 80/20 (80 % facile, 20 % dur), avec repos et renfo placés intelligemment.
        </div>
      </div>
    </div>
  );
}
