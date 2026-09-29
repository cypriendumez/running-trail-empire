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
const AUTRE_SPORT = /\b(triathlon|duathlon|aquathlon|swimrun|swim run|cyclo|cyclosportive|cyclotour|vtt|gravel|velo|marche nordique|randonnee|rando|bike and run|bike run|run bike|run and bike|canicross|natation|kayak|raid multisport|multisport)\b/g;
const COURSE = /\b(trail|course|courses|run|running|foulee|foulees|corrida|semi|marathon|km|cross|ekiden|ultra)\b/;

export function pasCourseAPiedParNom(nom: unknown): boolean {
  const n = forme(nom);
  if (!new RegExp(AUTRE_SPORT.source).test(n)) return false;
  // « Run & Bike » contient « run » : on juge ce qui RESTE une fois l'autre sport retiré.
  return !COURSE.test(n.replace(AUTRE_SPORT, " "));
}
