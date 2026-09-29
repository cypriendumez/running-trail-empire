/**
 * UNE ÉPREUVE QUI N'EST PAS DE LA COURSE À PIED, RECONNUE À SON NOM (29/09/2026).
 *
 * Les fiches finishers disent la discipline ; jogging-plus (source fermée depuis juin) ne
 * dit rien, et 129 de ses lignes étaient des triathlons, des sorties VTT, des randonnées
 * ou de la marche nordique, rangées parmi les courses. On ne retire que ce que le NOM dit
 * sans ambiguïté : « Trail et rando des Caps » ou « Course nature et marche nordique »
 * gardent leur place — la course y existe.
 */
const forme = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
// « gravelman » et « swimrun\w* » : les noms de marque collent le mot (« GravelMan Series »,
// « SwimRunMan ») et `\b` ne le voyait plus (29/09/2026). PAS « gravel\w* » : Gravelines
// est une ville (« Frappadingues Gravelines », une course à obstacles).
const AUTRE_SPORT = /\b(triathlon|duathlon|aquathlon|swimrun\w*|swim run|cyclo|cyclosportive|cyclotour|vtt|gravel|gravelman|gravels|velo|marche nordique|randonnee|rando|bike and run|bike run|run bike|run and bike|canicross|natation|kayak|raid multisport|multisport)\b/g;
const COURSE = /\b(trail|course|courses|run|running|foulee|foulees|corrida|semi|marathon|km|cross|ekiden|ultra)\b/;

export function pasCourseAPiedParNom(nom: unknown): boolean {
  const n = forme(nom);
  if (!new RegExp(AUTRE_SPORT.source).test(n)) return false;
  // « Run & Bike » contient « run » : on juge ce qui RESTE une fois l'autre sport retiré.
  return !COURSE.test(n.replace(AUTRE_SPORT, " "));
}

/**
 * UN FORMAT qui n'est pas de la course à pied, reconnu à son TITRE — même quand la source
 * l'étiquette « road » ou « trail » (29/09/2026) : « Rando cyclo 56 km » (L'Alsacienne
 * Cyclo), « Vélo de route 93 km », « Marche solidaire », « Ski de randonnée », « Run &
 * Bike ». Plus strict que pour un nom d'épreuve : « marche » seule suffit, et « km » ne
 * prouve rien (« Marche 5 km »). Un titre MIXTE garde sa place : « Course ou marche
 * relax », « Trail ou Rando à 2 », « VTT, Gravel, Trail ou Rando ».
 */
const AUTRE_FORMAT = /\b(triathlon|duathlon|aquathlon|swimrun|swim run|cyclo|cyclosportive|cyclotour|vtt|gravel|velo|marche nordique|marche|randonnee|rando|canicross|natation|kayak|paddle|ski|raid multisport|multisport)\b/g;
const COURSE_FORMAT = /\b(trail|course|courses|courir|run|running|foulee|foulees|corrida|semi|marathon|cross|ekiden|ultra|relais)\b/;
// Les enchaînements vélo-course ou pagaie-course : jamais de la course à pied seule, même
// quand le titre dit aussi « marathon » (« Run & Bike Marathon »).
const COMBINE = /\b(bike and run|bike run|run bike|run and bike|bike et run|run et bike|run paddle|swim and run)\b/;

export function formatPasCourseAPied(titre: unknown): boolean {
  const n = forme(titre);
  if (COMBINE.test(n)) return true;
  if (!new RegExp(AUTRE_FORMAT.source).test(n)) return false;
  return !COURSE_FORMAT.test(n.replace(AUTRE_FORMAT, " "));
}
