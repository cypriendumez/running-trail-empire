// ─────────────────────────────────────────────────────────────────────────────
//  ÂGE ET DISTANCE — l'avertissement qu'on doit à un jeune athlète.
//
//  Un coureur de 18 ans qui se fixe un marathon ne doit pas être bloqué : c'est SON
//  objectif, et un plan lui est construit comme à tout le monde. Mais il doit savoir
//  deux choses qu'il ignore probablement.
//
//  1. UN FAIT VÉRIFIABLE, pas une opinion : la Fédération française d'athlétisme fixe
//     des distances maximales par catégorie d'âge. À 18-19 ans (Junior/U20), la limite
//     est de 25 km — le semi-marathon passe, le marathon NON. Le marathon n'ouvre qu'à
//     partir d'Espoir/U23, c'est-à-dire 20 ans. Autrement dit, il ne pourra tout
//     simplement PAS s'inscrire à un marathon officiel en France. C'est l'information
//     la plus utile qu'on puisse lui donner, et de loin la plus actionnable.
//
//  2. UN CONSEIL, annoncé comme tel : construire par paliers (10 km, puis semi, puis
//     marathon). Ce n'est pas une règle médicale et on ne le présente pas comme telle.
//
//  ⚠️ CE QU'ON NE DIT PAS. « Le marathon, c'est mieux après 25 ans » circule beaucoup,
//  mais aucune source médicale consultée ne l'établit comme un seuil. La règle
//  vérifiable est celle de la fédération : 20 ans. Inventer un seuil médical pour
//  appuyer un conseil, même bien intentionné, serait exactement le genre d'affirmation
//  fausse que cette application refuse — et sur un sujet de santé, en plus.
//
//  Sources : règlement des manifestations running FFA (catégories d'âge et distances
//  maximales hors stade et trail). Le « km effort » y ajoute 1 km par tranche de 100 m
//  de dénivelé positif : une course de trail compte donc pour PLUS que sa distance,
//  ce qui est le sens physiologique — grimper coûte, ça n'allège pas.
// ─────────────────────────────────────────────────────────────────────────────

export type CategorieFfa = {
  /** Nom de la catégorie, tel qu'il figure au règlement. */
  nom: string;
  ageMin: number;
  /** Distance maximale autorisée, en km effort. `null` = aucune limite. */
  maxKm: number | null;
};

/**
 * Catégories FFA, de la plus âgée à la plus jeune (l'ordre sert à la recherche).
 * On s'arrête aux catégories qui courent des distances routières : en deçà de 14 ans,
 * l'application ne s'adresse de toute façon pas à l'athlète directement.
 */
const CATEGORIES: CategorieFfa[] = [
  { nom: "Espoir / U23 et au-delà", ageMin: 20, maxKm: null },
  { nom: "Junior / U20", ageMin: 18, maxKm: 25 },
  { nom: "Cadet / U18", ageMin: 16, maxKm: 15 },
  { nom: "Minime / U16", ageMin: 14, maxKm: 5 },
  { nom: "Benjamin / U14", ageMin: 12, maxKm: 3 },
];

/** Catégorie d'un athlète d'après son âge. `null` si l'âge est inconnu ou aberrant :
 *  on ne devine pas une catégorie pour avertir quelqu'un sur la base d'une supposition. */
export function categorieFfa(age: number | null | undefined): CategorieFfa | null {
  if (age == null || !Number.isFinite(age) || age < 12 || age > 120) return null;
  return CATEGORIES.find((c) => age >= c.ageMin) ?? null;
}

/**
 * Distance « km effort » : le dénivelé positif ajoute 1 km par tranche de 100 m.
 *
 * C'est la mesure qu'emploie la fédération pour le trail, et c'est le seul sens qui
 * tienne physiologiquement : 20 km avec 1 000 m de D+ demandent bien plus que 20 km
 * de plat. Sans dénivelé connu, on renvoie la distance brute — on ne majore pas une
 * course en inventant son profil.
 */
export function kmEffort(distanceKm: number, denivelePositifM?: number | null): number {
  const d = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const dplus = denivelePositifM != null && Number.isFinite(denivelePositifM) ? Math.max(0, denivelePositifM) : 0;
  return Math.round((d + dplus / 100) * 10) / 10;
}

export type AvertissementAge = {
  /** `reglement` : la distance dépasse la limite de sa catégorie — inscription
   *  impossible sur une épreuve officielle. `progression` : autorisé, mais on
   *  recommande d'y venir par paliers. */
  niveau: "reglement" | "progression";
  categorie: string;
  /** Texte prêt à afficher, en français, sans jargon. */
  texte: string;
};

/** Distances de référence, pour nommer l'étape suivante plutôt que de dire « plus court ». */
const PALIERS = [
  { km: 10, nom: "10 km" },
  { km: 21.1, nom: "semi-marathon" },
  { km: 42.2, nom: "marathon" },
];

/**
 * L'objectif visé mérite-t-il un avertissement lié à l'âge ?
 *
 * Ne BLOQUE jamais rien : le plan est construit dans tous les cas. Renvoie `null` quand
 * il n'y a rien à signaler — un bandeau permanent redevient un décor qu'on ne lit plus.
 */
export function avertissementAge(input: {
  age: number | null | undefined;
  distanceKm: number;
  /** Dénivelé positif de l'épreuve, s'il est connu (trail). */
  deniveleM?: number | null;
  /** L'épreuve est-elle un trail ? Change le vocabulaire, pas la règle. */
  trail?: boolean;
}): AvertissementAge | null {
  const cat = categorieFfa(input.age);
  if (!cat || !Number.isFinite(input.distanceKm) || input.distanceKm <= 0) return null;

  const effort = kmEffort(input.distanceKm, input.deniveleM);
  const brut = Math.round(input.distanceKm * 10) / 10;
  // Nombres à la française : ce texte est lu par l'athlète. « 42.2 km » au milieu d'une
  // phrase française trahit une chaîne de débogage, et abîme la confiance dans le reste.
  const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const mentionEffort = effort > brut
    ? ` (${fr(effort)} km effort : le dénivelé ajoute 1 km par tranche de 100 m de D+)`
    : "";

  // ── 1. LA RÈGLE : la distance dépasse-t-elle la limite de sa catégorie ? ──────
  if (cat.maxKm != null && effort > cat.maxKm) {
    // On nomme le palier atteignable AUJOURD'HUI plutôt que de dire « plus court » :
    // un conseil qu'on ne peut pas suivre n'est pas un conseil.
    const possible = [...PALIERS].reverse().find((p) => p.km <= cat.maxKm!);
    const suite = possible ? ` Le ${possible.nom} t'est ouvert dès maintenant` : " Des distances plus courtes te sont ouvertes";
    const ouverture = cat.ageMin === 18
      ? ", et le marathon s'ouvrira à tes 20 ans."
      : cat.ageMin === 16
      ? ", le semi à 18 ans et le marathon à 20 ans."
      : ".";
    return {
      niveau: "reglement",
      categorie: cat.nom,
      texte: `⚠️ DISTANCE NON AUTORISÉE À TON ÂGE : en catégorie ${cat.nom}, la Fédération française d'athlétisme limite les épreuves à ${cat.maxKm} km${input.trail ? " en km effort" : ""}, et ton objectif fait ${fr(brut)} km${mentionEffort}. Tu ne pourras pas t'inscrire à une épreuve officielle en France, et ces limites existent pour protéger un squelette encore en croissance.${suite}${ouverture} Ton plan est construit quand même — mais parles-en à un médecin du sport avant de viser cette distance.`,
    };
  }

  // ── 2. LE CONSEIL : autorisé, mais très exigeant pour un jeune athlète ────────
  // Seuil à 23 ans (fin de la catégorie Espoir) et distances de semi et au-delà.
  // C'est un CONSEIL de progression, pas une règle : formulé comme tel.
  if (input.age != null && input.age < 23 && effort >= 21) {
    // Le texte s'ADAPTE à la distance. Une première version parlait du marathon même
    // pour un semi — « l'effort le plus exigeant de la course à pied » à propos de
    // 21 km, et l'âge du pic marathon en réponse à un objectif de semi. Un conseil qui
    // ne correspond pas à ce qu'on a demandé se lit comme un message automatique, et
    // c'est exactement ce qu'il ne faut pas être.
    const marathonEtPlus = effort >= 42;
    const quoi = marathonEtPlus ? (input.trail ? "Un ultra" : "Un marathon")
      : input.trail ? "Un trail long" : "Un semi-marathon";
    const pourquoi = marathonEtPlus
      ? "c'est l'effort le plus exigeant de la course à pied, et rien ne presse : la plupart des coureurs atteignent leur meilleur niveau sur cette distance entre 28 et 35 ans"
      : "c'est un vrai palier d'endurance, et il se prépare mieux qu'il ne s'improvise";
    const paliers = marathonEtPlus
      ? "un 10 km solide, puis un semi, puis la distance visée"
      : "un 10 km solide avant de doubler la distance";
    return {
      niveau: "progression",
      categorie: cat.nom,
      texte: `💡 ${quoi} à ${input.age} ans, c'est autorisé (catégorie ${cat.nom}) et parfaitement faisable — mais ${pourquoi}. Le chemin le plus sûr passe par des paliers : ${paliers}. Ton plan est construit pour l'objectif que tu as choisi ; si tu n'as jamais couru la moitié de cette distance, envisage un palier intermédiaire d'abord.`,
    };
  }

  return null;
}
