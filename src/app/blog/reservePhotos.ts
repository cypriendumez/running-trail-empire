/**
 * RÉSERVE DE PHOTOS DÉJÀ AUDITÉES POUR LE BLOG.
 *
 * ⚠️ POURQUOI ELLE EXISTE. La routine bimensuelle qui écrit un article doit illustrer sa
 * carte, et une photo publique n'entre dans `POSTS` qu'après avoir été REGARDÉE (aucun
 * visage, aucune marque, aucun dossard — `tests/photos.test.ts`, constante `AUDITEES`).
 * Or le premier passage de la routine (21/09/2026) a montré que l'environnement cloud
 * refuse les connexions vers `images.unsplash.com` : elle ne pouvait donc ni télécharger
 * ni regarder quoi que ce soit. Cette réserve est la réponse : sept photos regardées une
 * par une par Claude en session locale, au format servi (600×450), et inscrites dans
 * `AUDITEES` avec leur motif. La routine y pioche la première entrée non encore utilisée
 * dans `POSTS` quand elle ne peut pas en auditer une nouvelle.
 *
 * ⚠️ N'AJOUTE RIEN ICI SANS AVOIR OUVERT L'IMAGE. Une entrée de cette liste vaut
 * « quelqu'un l'a vue » — c'est tout ce qui la sépare d'une photo au hasard. Et chaque
 * identifiant doit AUSSI figurer dans `AUDITEES` : un test vérifie la correspondance.
 */
export type PhotoReserve = { id: string; motif: string; themes: string[] };

export const RESERVE_PHOTOS: PhotoReserve[] = [
  { id: "photo-1690644932424-63fdff67172d", motif: "route désertique droite sous un ciel bleu, ligne jaune — ni personne ni marque", themes: ["chaleur", "route", "endurance"] },
  { id: "photo-1544034287-c9c09e0341a1", motif: "piste de sable dans un désert, rocher au loin, soleil haut — ni personne ni marque", themes: ["chaleur", "soleil", "ultra"] },
  { id: "photo-1592859600972-1b0834d83747", motif: "sentier dans une pinède claire, sous-bois vert — ni personne ni marque", themes: ["trail", "forêt", "récupération"] },
  { id: "photo-1700745286959-8658de43a15c", motif: "sentier de montagne en forêt de mélèzes — ni personne ni marque", themes: ["trail", "côte", "bâtons"] },
  { id: "photo-1519681393784-d120267933ba", motif: "voie lactée au-dessus de sommets enneigés, nuit — ni personne ni marque", themes: ["sommeil", "nuit", "récupération"] },
  { id: "photo-1761660227670-28922e2a69dc", motif: "crête au lever du soleil au-dessus d'une mer de nuages — ni personne ni marque", themes: ["montagne", "matin", "jeûne"] },
  { id: "photo-1762858741992-a254724623bd", motif: "chaînes de montagnes dans la brume, soleil voilé — ni personne ni marque", themes: ["montagne", "altitude", "seuil"] },
];
