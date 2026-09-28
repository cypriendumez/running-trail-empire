/**
 * PHOTOS DES PROGRAMMES — une seule liste, pour la page d'accueil ET la page « Plans ».
 *
 * Sorties de `app/page.tsx` le 28/09/2026, quand la page Plans du tableau de bord les a
 * reprises (Cyprien : « améliore le design, tu peux remettre ces images »). Deux copies
 * d'une liste de photos auditées finissent par diverger — et une photo retirée d'un
 * endroit restait servie ailleurs (voir la mémoire du projet sur l'audit des photos).
 * Chaque identifiant garde ici le motif de son choix : on ne remplace pas une photo sans
 * relire pourquoi la précédente a été écartée.
 */
// ── PHOTOS DES PROGRAMMES ────────────────────────────────────────────────────
// Chaque programme porte une VRAIE photo (`photo` est obligatoire : le semi et le
// marathon retombaient sur un aplat dégradé, et au milieu de six photographies les deux
// cartes les plus vendeuses ressemblaient à un emplacement vide).
//
// ⚠️ ON NE STOCKE QUE L'IDENTIFIANT, PAS L'URL. Les URL étaient écrites à la main en
// `?w=600&fit=crop`, ce qui demandait à Unsplash une largeur SANS hauteur : le service
// renvoyait alors le recadrage de son choix — 600×275 pour la carte « endurance », soit
// un panoramique de ratio 2,18 pour une tuile en 3/4. Le navigateur en gardait une
// tranche centrale de 206 px de large puis l'étirait sur 699 px en écran Retina : un
// agrandissement de 3,4×, d'où le flou. Le recadrage est donc CENTRALISÉ ci-dessous, au
// format exact de la carte, et décliné en srcset pour qu'un téléphone ne télécharge pas
// l'image du grand écran.
export const PHOTOS_PROGRAMMES = {
  // 10 km : la précédente montrait les TROIS BANDES ADIDAS, nettes, sur les deux
  // chaussures, au centre du cadre. Remplacée par un coureur DE DOS et petit dans
  // l'image, en t-shirt blanc uni : aucune marque, aucun visage, et la route qui file
  // vers l'horizon dit la distance mieux qu'un gros plan de chaussure.
  km10: "photo-1560052767-406e947cc273",
  // 10 km (ex-« endurance de base ») : chemin forestier qui file vers le fond — il dit la
  // DURÉE, à allure facile, mieux qu'un gros plan. Les troncs verticaux tiennent le 3/4.
  endurance: "photo-1646867802148-b3ccd7ebf76d",
  // Semi : la précédente n'était pas qu'un problème de marque. On y lisait le DOSSARD
  // 21221 et le logo TCS du marathon de New York — or les résultats de course sont
  // publics, donc ce numéro remonte à un NOM. C'est une donnée personnelle, pas un
  // détail esthétique. La remplaçante est vue DE DOS : les dossards se portent devant,
  // ils sortent donc du cadre par construction, et aucun visage n'apparaît.
  semi: "photo-1590333748338-d629e4564ad9",
  marathon: "photo-1682367905664-e36b30f15b19",
  trail: "photo-1504025468847-0e438279542c",
  // Débuter : TROISIÈME photo pour cette carte, et cette fois pour une raison juridique,
  // pas esthétique. La précédente montrait DEUX VISAGES de face, nets et parfaitement
  // identifiables (plus une troisième personne au second plan). La licence Unsplash ne
  // couvre que le DROIT D'AUTEUR du photographe : Unsplash écrit noir sur blanc qu'elle
  // ne garantit aucune autorisation de droit à l'image. Sur un site qui vend un
  // abonnement, un visage reconnaissable est un risque que rien ne compense.
  // La remplaçante tient le même message — « c'est accessible, tu n'es pas seul » : un
  // groupe qui court ensemble, tous DE DOS, aucun visage, aucune marque lisible.
  beginner: "photo-1645238426817-8c3e7d1396cf",
  // Vitesse : c'était la pire des quatre. Un swoosh Nike vert vif occupait le centre
  // optique de la carte, et « BROO(KS) » se lisait au second plan — DEUX marques, dont
  // une en point de mire. À cette proéminence, l'image ne se lit plus comme une
  // illustration mais comme une caution commerciale. Remplacée par un coureur à
  // contre-jour sur piste : le visage est une ombre, les chaussures n'ont aucun logo.
  speed: "photo-1744060204728-f68e434a3edf",
  // Blessure : c'était un portrait de médecin en blouse, souriant face objectif. Au
  // milieu de sept photographies de course, une photo de banque d'images posée cassait
  // la grille entière. Remplacée par des mains qui relacent une chaussure — « je repars ».
  injury: "photo-1600712662084-e54770a9668e",
  // NEUVIÈME programme. Deux raisons, et la mise en page n'est que la seconde :
  //  1. le mode perte de poids EXISTE (src/lib/weight, /api/weight,
  //     profiles.weight_mode_enabled) — il était vendu nulle part ;
  //  2. huit cartes sur trois colonnes donnent 3+3+2, donc un trou dans la dernière
  //     rangée sur tout écran large. Neuf la ferment.
  //  Photo reprise : la première montrait un VISAGE DE PROFIL net. Les lunettes de
  //  soleil ne masquent pas un profil, et le flou de filé ne portait que sur le corps.
  //  Même raison que « Débuter » plus haut : la licence Unsplash couvre le droit
  //  d'auteur, jamais le droit à l'image. La remplaçante est une silhouette pleine à
  //  contre-jour — aucun trait discernable, aucune marque.
  weightloss: "photo-1516398810565-0cb4310bb8ea",
} as const;

export type ClePhotoProgramme = keyof typeof PHOTOS_PROGRAMMES;

/**
 * URL Unsplash au format EXACT de la vignette : la hauteur est IMPOSÉE, sinon Unsplash
 * choisit son recadrage (un panoramique pour une tuile en 3/4 — d'où le flou mesuré sur la
 * page d'accueil). `ratio` = hauteur / largeur.
 */
export const photoUnsplash = (id: string, largeur: number, ratio: number) =>
  `https://images.unsplash.com/${id}?w=${largeur}&h=${Math.round(largeur * ratio)}&fit=crop&q=82`;
