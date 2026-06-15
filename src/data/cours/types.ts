// Types du contenu du « Cours du coureur » — un fichier de contenu par langue (fr/en/de/es/pt).
// La STRUCTURE (icônes, couleurs) reste dans la page ; ici uniquement du contenu sérialisable.

export type Concept = {
  term: string;
  short?: string;
  def: string;
  why?: string;
  repere?: string;
};

export type ChapterContent = {
  id: string;           // identifiant stable inter-langues (ancre + jointure avec la structure)
  title: string;        // inclut le numéro : « 1 · … »
  intro: string;
  concepts: Concept[];
};

export type QuizQuestion = {
  q: string;
  options: string[];    // 3 options
  answer: number;       // index de la bonne réponse (identique dans toutes les langues)
  explain: string;
  chapitre: string;     // libellé localisé du chapitre
  anchor: string;       // id de chapitre (stable)
};

// Libellés d'interface de l'onglet (héros, recherche, quiz, flashcards, perso…).
export type CoursUI = {
  heroEyebrow: string; heroTitle: string; heroSub: string;
  chipChapters: string; chipNotions: string; chipCoach: string; // {n} interpolé côté page
  sommaire: string;
  searchPlaceholder: string; searchEmpty: string;
  askCoach: string; askCoachQuestion: string; // {chapter} interpolé
  whyLabel: string; repereLabel: string; persoLabel: string;
  perso: {                 // gabarits des repères personnalisés ({...} interpolés côté page)
    vma: string;           // {vma} {pace}
    seuil: string;         // {lo} {hi}
    zoneBpm: string;       // {zone} {lo} {hi}
    zonePace: string;      // {lo} {hi}
    cadence: string;       // {spm}
  };
  quiz: {
    title: string; sub: string;            // {n} questions
    express: string; expressSub: string;   // {n}
    complet: string; completSub: string;   // {n}
    record: string;                        // {score}/{total}
    exact: string; wrong: string;
    next: string; seeScore: string; askCoach: string;
    newRecord: string; toReview: string; replay: string; changeMode: string;
    verdicts: { coach: string; solid: string; good: string; learn: string };
    badgeUnlocked: string; badgeName: string;
  };
  flash: {
    title: string; sub: string;
    empty: string;
    show: string; knew: string; review: string;
    remaining: string;                     // {n}
    done: string; reset: string;
  };
  resume: string;
  practice: { ghost: string; ghostDesc: string; dash: string; dashDesc: string; sante: string; santeDesc: string };
};
