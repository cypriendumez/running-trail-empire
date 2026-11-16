/**
 * RÉSERVE DE PHOTOS DÉJÀ AUDITÉES POUR LE BLOG.
 *
 * ⚠️ POURQUOI ELLE EXISTE. La routine bimensuelle qui écrit un article doit illustrer sa
 * carte, et une photo publique n'entre dans `POSTS` qu'après avoir été REGARDÉE (aucun
 * visage, aucune marque, aucun dossard — `tests/photos.test.ts`, constante `AUDITEES`).
 * Or le premier passage de la routine (21/09/2026) a montré que l'environnement cloud
 * refuse les connexions vers `images.unsplash.com` : elle ne pouvait donc ni télécharger
 * ni regarder quoi que ce soit. Cette réserve est la réponse : des photos regardées une
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
  { id: "photo-1762858741992-a254724623bd", motif: "chaînes de montagnes dans la brume, soleil voilé — ni personne ni marque", themes: ["montagne", "altitude", "seuil"] },  // Regarnie le 16/11/2026 (condition de @Mercator sur l'article du sommeil : la réserve
  // était vide). Cinq photos trouvées sur Unsplash depuis le Mac, téléchargées au format
  // servi (600×450) et regardées une par une ce jour-là. ⚠️ Elles tirent toutes vers la
  // nuit et le repos : pour un sujet de plein jour, auditer une photo neuve depuis le Mac.
  { id: "photo-1632168704789-8d4c9443efc0", motif: "pleine lune au-dessus d'un lac entre des collines, reflet doré sur l'eau, nuit — ni personne ni marque", themes: ["nuit", "calme", "récupération"] },
  { id: "photo-1639162147469-a02dee15e1d9", motif: "croissant de lune au-dessus d'une forêt de sapins enneigée, brume au sol, crépuscule — ni personne ni marque", themes: ["hiver", "froid", "nuit"] },
  { id: "photo-1548342700-0824df116ec3", motif: "lune sous des nuages sombres, crête en silhouette, ciel violet — ni personne ni marque", themes: ["nuit", "fatigue", "récupération"] },
  { id: "photo-1550955676-be18abcc851c", motif: "pleine lune qui se lève derrière des montagnes arides, ciel rose — ni personne ni marque", themes: ["montagne", "soir", "ultra"] },
  { id: "photo-1429117237875-aa29229d99f0", motif: "lit défait, deux oreillers gris, store vénitien au-dessus, pénombre — ni personne ni marque", themes: ["sommeil", "repos", "récupération"] },
];
