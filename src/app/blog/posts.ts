/**
 * LES CARTES DU BLOG ET LEURS PHOTOS — une seule copie, lisible par le serveur.
 *
 * Elles vivaient dans `page.tsx`, un composant CLIENT : la page d'article (serveur) ne
 * pouvait donc pas les lire, et un article partagé sur WhatsApp, LinkedIn ou X partait
 * SANS IMAGE (constaté le 08/11/2026 dans le HTML servi), alors que chacun a une photo
 * auditée sur sa carte. Le contenu est inchangé ; il est seulement lisible des deux côtés.
 *
 * ⚠️ Une photo ajoutée ici doit être regardée et inscrite dans `AUDITEES`
 * (`tests/photos.test.ts`, qui scanne ce fichier), comme avant.
 */
// Données visuelles (non traduisibles). Titres/extraits/catégories viennent de BLOG[lang].
//
// ── AUDIT DES VISUELS, 20/08/2026 ────────────────────────────────────────────
// Le blog est PUBLIC. Ses huit images n'avaient jamais été passées au crible ;
// quatre l'ont été et sont remplacées :
//
//  · p3 « Entraînement » : portrait STUDIO, visage de face entièrement identifiable,
//    et sans rapport avec la course. → jambes sur piste, aucun visage.
//  · p4 « Santé » : femme en BLOUSE BLANCHE, visage identifiable. Double défaut —
//    le droit à l'image, et une autorité MÉDICALE implicite au-dessus d'un article
//    de santé, alors que l'app s'interdit partout ailleurs de dire « apte ».
//    → silhouette d'étirement, aucun trait discernable.
//  · p6 « IA » : c'était la photo aux TROIS BANDES ADIDAS, la même que la carte
//    « 10 km » de la landing. La retirer d'un seul des deux emplacements ne servait
//    à rien. → motif abstrait, ni personne ni marque.
//  · p8 « Matériel » : photo PRODUIT Nike sur fond rouge, logotype ET swoosh nets,
//    plein cadre. Le pire cas du projet : ce n'est plus un logo incident, ça se lit
//    comme une publicité Nike. → gros plan de chaussure dans l'herbe. ⚠️ Elle porte
//    un petit drapeau britannique de marque au talon (~30 px à l'affichage) : sous
//    le seuil de proéminence retenu, mais ce n'est PAS « aucune marque ». Écrit ici
//    parce qu'un commentaire qui embellit vaut moins que pas de commentaire.
//
//  · p2 « IA » : c'était une photo de SKIEUR, sur le blog d'une app de course. Défaut
//    de PERTINENCE, pas de droit — mais un visuel hors sujet sur une page publique
//    coûte au moment de vendre. → motif d'onde abstrait, dans la même famille que p6
//    sans en être le doublon.
//
//  · p5 « Les courses » : l'article s'intitule « UTMB 2026 : les trails français à ne
//    pas manquer » et était illustré par une PISTE D'ATHLÉTISME vue de haut — la photo
//    du hero, réutilisée telle quelle. Aucun rapport avec l'ultra-trail en montagne.
//    → arêtes alpines, sentier et silhouettes lointaines, aucun visage ni marque.
//
// Conservées après vérification : p1 (robot Pepper — produit de marque mais discret),
// p7 (assiette, rien à signaler).
//
// Les huit URL demandaient une largeur SANS hauteur, alors que les tuiles sont en
// `aspect-[4/3]` : Unsplash renvoyait le recadrage de son choix (400, 900 puis 316 px
// de haut pour la même tuile), que le navigateur étirait ensuite. C'est le défaut de
// flou déjà corrigé sur la landing, jamais reporté ici. Hauteur désormais IMPOSÉE.
export const POSTS = [
  { id: 1, key: "p1", cat: "AI", img: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=450&fit=crop&q=80", featured: true },
  { id: 2, key: "p2", cat: "AI", img: "https://images.unsplash.com/photo-1762281429414-5ee5f2dbb243?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 3, key: "p3", cat: "TRAINING", img: "https://images.unsplash.com/photo-1526676537331-7747bf8278fc?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 4, key: "p4", cat: "HEALTH", img: "https://images.unsplash.com/photo-1560233026-ad254fa8da38?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 5, key: "p5", cat: "RACES", img: "https://images.unsplash.com/photo-1761027436967-63584b301a77?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 6, key: "p6", cat: "AI", img: "https://images.unsplash.com/photo-1761078739194-75cccb8e3195?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 7, key: "p7", cat: "NUTRITION", img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 8, key: "p8", cat: "GEAR", img: "https://images.unsplash.com/photo-1555972635-8a10402b49b2?w=600&h=450&fit=crop&q=80", featured: false },
  // Ajoutés le 21/08/2026. Chacun documente une fonctionnalité RÉELLE mais invisible :
  // le plancher à IMC 21 du mode perte de poids, le guide de renforcement, et le suivi
  // de cycle (`is_female_cycle_sync`, vérifié en base). Photos auditées, sans visage
  // ni marque : conteneurs repas, haltères, vagues abstraites.
  { id: 9, key: "p9", cat: "HEALTH", img: "https://images.unsplash.com/photo-1543352632-5a4b24e4d2a6?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 10, key: "p10", cat: "TRAINING", img: "https://images.unsplash.com/photo-1603077492579-39ff927823db?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 11, key: "p11", cat: "HEALTH", img: "https://images.unsplash.com/photo-1774460261319-cdd3b2363143?w=600&h=450&fit=crop&q=80", featured: false },
  // Ajouté le 21/09/2026 par la routine bimensuelle. Photo prise dans la RÉSERVE
  // (`src/app/blog/reservePhotos.ts`, première entrée libre, thèmes « chaleur/route ») :
  // le CDN d'images d'Unsplash répondait, mais son API de recherche non — impossible donc
  // de découvrir puis d'auditer un identifiant inédit. Celui-ci a malgré tout été
  // retéléchargé au format servi et regardé avant d'être écrit ici.
  { id: 12, key: "p12", cat: "HEALTH", img: "https://images.unsplash.com/photo-1690644932424-63fdff67172d?w=600&h=450&fit=crop&q=80", featured: false },
  // Ajouté le 01/10/2026 par la routine bimensuelle. Photo prise dans la RÉSERVE
  // (`src/app/blog/reservePhotos.ts`, thèmes « trail/forêt/récupération ») : le CDN
  // d'images d'Unsplash répond, mais son API de recherche reste injoignable depuis le
  // conteneur — impossible donc de découvrir puis d'auditer un identifiant inédit.
  // Celui-ci a été retéléchargé au format servi et regardé avant d'être écrit ici.
  { id: 13, key: "p13", cat: "HEALTH", img: "https://images.unsplash.com/photo-1592859600972-1b0834d83747?w=600&h=450&fit=crop&q=80", featured: false },
  // Ajoutés le 09/11/2026 par la routine de veille. Photos prises dans la RÉSERVE
  // (`src/app/blog/reservePhotos.ts`), déjà auditées — regardées à nouveau au format
  // servi avant cet ajout pour confirmer leur motif.
  { id: 14, key: "p14", cat: "GEAR", img: "https://images.unsplash.com/photo-1700745286959-8658de43a15c?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 15, key: "p15", cat: "GEAR", img: "https://images.unsplash.com/photo-1761660227670-28922e2a69dc?w=600&h=450&fit=crop&q=80", featured: false },
  // Ajouté le 09/11/2026 par la routine bimensuelle, SUJET DE SAISON (froid et nuit).
  // Photo prise dans la RÉSERVE (`src/app/blog/reservePhotos.ts`, thème « nuit ») :
  // l'API de recherche d'Unsplash reste injoignable depuis le conteneur, impossible
  // donc de DÉCOUVRIR un identifiant inédit à auditer. Celle-ci — voie lactée au-dessus
  // de sommets enneigés — a été retéléchargée au format servi et regardée avant d'être
  // écrite ici ; elle figure déjà dans AUDITEES.
  { id: 16, key: "p16", cat: "HEALTH", img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=450&fit=crop&q=80", featured: false },
];

/** Largeur servie aux moteurs et aux réseaux ; 1200 px est le minimum conseillé par Google. */
const LARGEUR_PARTAGE = 1200;

/**
 * La photo d'un article, au format de partage. ⚠️ MÊME RAPPORT 4:3 que la carte : c'est
 * ce cadrage-là qui a été regardé. Un autre rapport (16:9, carré) recadrerait l'original
 * ailleurs et pourrait faire entrer dans le champ un visage ou une marque jamais vus.
 */
export function photoPartage(cle: string): { url: string; width: number; height: number } | null {
  const id = POSTS.find((p) => p.key === cle)?.img.match(/photo-\d{10,}-[0-9a-z]+/)?.[0];
  if (!id) return null;
  const height = (LARGEUR_PARTAGE * 3) / 4;
  return { url: `https://images.unsplash.com/${id}?w=${LARGEUR_PARTAGE}&h=${height}&fit=crop&q=80`, width: LARGEUR_PARTAGE, height };
}
