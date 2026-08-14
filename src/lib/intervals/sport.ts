// ─────────────────────────────────────────────────────────────────────────────
//  SPORT D'UNE ACTIVITÉ — distinct du RÔLE de la séance
//
//  `workouts.type` décrit ce que la séance FAIT dans l'entraînement (easy,
//  interval, long, trail…). Il ne dit pas quel SPORT a été pratiqué, et les deux
//  étaient confondus : la randonnée arrivait en « trail », le vélo en « easy ».
//  Tout comptait alors comme du kilométrage de course.
//
//  Conséquence relevée en production : 101,8 km comptés sur une semaine où
//  35,8 km seulement avaient été courus — d'où une sortie longue de 33 km
//  proposée à un athlète qui n'avait pas dépassé 18 km en quatre semaines.
//
//  La table ne couvrait que 4 sports (course, vélo, rando, marche). Une montre
//  Garmin ou Coros en enregistre une cinquantaine, et intervals.icu les transmet
//  tels quels : natation, rameur, ski de fond, elliptique, renfo, yoga, sports
//  de raquette… Tout ce qui n'était pas listé tombait en « other », donc dans
//  `crossKm7` — et 2 km de natation s'additionnaient à 40 km de vélo comme si
//  c'était comparable. On nomme désormais chaque sport, et surtout on dit CE
//  QU'IL FAIT SUBIR AUX JAMBES : c'est la seule chose qui intéresse un coach de
//  course à pied. Une heure de natation et une heure de randonnée fatiguent
//  toutes les deux, mais une seule des deux abîme les tendons d'Achille.
// ─────────────────────────────────────────────────────────────────────────────

export type Sport =
  | "run"       // course à pied — la seule qui compte dans le volume et la VMA
  | "bike"      // vélo sous toutes ses formes (route, VTT, home-trainer, VAE)
  | "swim"      // natation bassin et eau libre
  | "row"       // rameur, aviron, kayak, paddle — haut du corps + cardio
  | "ski"       // ski de fond, rando, alpin, raquettes, patins, roller
  | "hike"      // randonnée — jambes chargées, souvent beaucoup de D+
  | "walk"      // marche
  | "strength"  // renforcement, musculation, crossfit, HIIT en salle
  | "cardio"    // elliptique, stepper, machines cardio sans impact
  | "mobility"  // yoga, pilates, étirements — charge quasi nulle
  | "ballsport" // foot, tennis, padel, basket… : appuis violents, changements d'appui
  | "other";    // inconnu — exclu du volume de course par prudence

/**
 * Types d'activité intervals.icu (nomenclature Strava, alimentée par Garmin, Coros,
 * Suunto, Polar et Wahoo). Ce qui n'y figure pas retombe sur « other » : la table
 * n'a pas à être exhaustive pour rester juste, elle a à ne jamais mentir.
 */
const SPORTS: Record<string, Sport> = {
  // ── Course à pied ──
  Run: "run", TrailRun: "run", VirtualRun: "run", Treadmill: "run", TrackRun: "run",
  // ── Vélo ──
  Ride: "bike", VirtualRide: "bike", GravelRide: "bike", MountainBikeRide: "bike",
  EMountainBikeRide: "bike", EBikeRide: "bike", Handcycle: "bike", Velomobile: "bike",
  // ── Natation ──
  Swim: "swim", OpenWaterSwim: "swim",
  // ── Rame et pagaie ──
  Rowing: "row", VirtualRow: "row", Kayaking: "row", Canoeing: "row",
  StandUpPaddling: "row", Surfing: "row", Kitesurf: "row", Windsurf: "row", Sail: "row",
  // ── Glisse et neige ──
  NordicSki: "ski", BackcountrySki: "ski", AlpineSki: "ski", RollerSki: "ski",
  Snowboard: "ski", Snowshoe: "ski", IceSkate: "ski", InlineSkate: "ski", Skateboard: "ski",
  // ── Marche et randonnée ──
  Hike: "hike", Walk: "walk", Wheelchair: "walk",
  // ── Renforcement ──
  WeightTraining: "strength", Crossfit: "strength", HighIntensityIntervalTraining: "strength",
  RockClimbing: "strength", Climbing: "strength",
  // « Workout » est le fourre-tout que Garmin envoie pour une séance de salle ou une
  // activité sans sport déclaré. Il était rangé en COURSE À PIED : une séance de renfo
  // entrait donc dans le volume hebdomadaire de course, et dans l'estimation de VMA.
  Workout: "strength",
  // ── Machines cardio sans impact ──
  Elliptical: "cardio", StairStepper: "cardio", Stairmaster: "cardio",
  // ── Mobilité ──
  Yoga: "mobility", Pilates: "mobility", Stretching: "mobility", Meditation: "mobility",
  // ── Sports de ballon et de raquette ──
  Soccer: "ballsport", Football: "ballsport", Basketball: "ballsport", Tennis: "ballsport",
  Padel: "ballsport", Pickleball: "ballsport", Badminton: "ballsport", Squash: "ballsport",
  Racquetball: "ballsport", TableTennis: "ballsport", Golf: "ballsport",
};

/** Sport d'une activité intervals.icu. Inconnu → « other » : au pire on l'exclut du
 *  volume de course, ce qui est le sens prudent (mieux vaut sous-compter que prescrire
 *  un volume calculé sur des kilomètres jamais courus). */
export function sportOf(type: string | null | undefined): Sport {
  return SPORTS[String(type ?? "")] ?? "other";
}

/** La séance compte-t-elle dans le volume de course et l'estimation de VMA ?
 *  Les lignes antérieures à la migration 015 n'ont pas de sport : on les considère
 *  comme de la course (comportement historique) jusqu'à leur prochaine synchronisation.
 *  Insensible à la casse : la base stocke « run », mais le type intervals.icu s'écrit
 *  « Run » — et une comparaison stricte y voyait un sport inconnu, donc pas de la course. */
export const isRun = (sport: string | null | undefined): boolean =>
  sport == null || String(sport).toLowerCase() === "run";

/** Nom français du sport — affiché à l'athlète, jamais une clé technique. */
export const SPORT_LABEL: Record<Sport, string> = {
  run: "course", bike: "vélo", swim: "natation", row: "rame", ski: "ski",
  hike: "randonnée", walk: "marche", strength: "renforcement", cardio: "cardio",
  mobility: "mobilité", ballsport: "sport de ballon", other: "autre sport",
};

/**
 * Impact subi par les jambes. C'est ce qui sépare une fatigue qu'on peut se permettre
 * d'ajouter à un bloc de course d'une fatigue qui s'additionne aux mêmes tissus.
 * Deux heures de vélo et deux heures de randonnée coûtent le même cardio ; seule la
 * seconde partage le compteur d'usure des mollets et des tendons.
 */
export type Impact = "aucun" | "modéré" | "élevé";
const IMPACT: Record<Sport, Impact> = {
  run: "élevé", ballsport: "élevé",
  hike: "modéré", walk: "modéré", ski: "modéré", strength: "modéré",
  bike: "aucun", swim: "aucun", row: "aucun", cardio: "aucun", mobility: "aucun",
  other: "modéré", // inconnu : on suppose des jambes sollicitées, c'est le sens prudent
};

/** Normalise une valeur LUE EN BASE (`workouts.sport`), qui est déjà un `Sport` et ne
 *  doit donc pas repasser par la table de traduction des types intervals.icu.
 *  `null` = ligne antérieure à la migration 015 → course, comme `isRun`. */
export function asSport(sport: string | null | undefined): Sport {
  const s = String(sport ?? "run").toLowerCase();
  return (s in IMPACT ? s : "other") as Sport;
}

export const impactOf = (sport: string | null | undefined): Impact => IMPACT[asSport(sport)];

/**
 * RÔLE de la séance déduit du type intervals.icu (`workouts.type`).
 *
 * Trois copies de cette table vivaient dans trois fichiers de synchronisation
 * (`/api/intervals/sync`, `/api/cron/sync-all`, `syncUser`) et divergeaient déjà.
 * Elle est ici, une fois.
 *
 * Le rôle sert au repli de TSS quand intervals.icu n'en fournit pas, et à repérer les
 * séances DURES. « Workout » y était rangé en `interval` : une séance de renfo en salle
 * était donc lue comme du fractionné, comptait comme une séance dure et bloquait la
 * qualité du lendemain.
 */
export function roleOf(type: string | null | undefined): string {
  const t = String(type ?? "");
  const explicit: Record<string, string> = {
    Run: "easy", VirtualRun: "easy", Treadmill: "easy", TrackRun: "easy",
    TrailRun: "trail", Hike: "trail", Walk: "recovery",
  };
  if (explicit[t]) return explicit[t];
  switch (sportOf(t)) {
    case "strength": return "strength";
    case "mobility": return "recovery";
    // Vélo, natation, rame, ski, cardio, sports de ballon : rôle aérobie. Le SPORT dit
    // déjà que ce n'est pas de la course — le rôle n'a pas à le redire.
    default: return "easy";
  }
}
