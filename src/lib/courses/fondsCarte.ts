/**
 * LES FONDS DE LA CARTE « ENREGISTRER » — plan et satellite, ou plan seul.
 *
 * Cyprien, 22/09/2026 : « fais comme sur Strava ». Strava donne un sélecteur de fond
 * au-dessus de la carte ; ici il y en a deux, et ce fichier décide lesquels EXISTENT.
 *
 * ⚠️ LE SATELLITE N'EXISTE QUE SI LA CLÉ MAPTILER EXISTE. Sans elle, l'URL répond 403
 * et Leaflet n'émet aucune erreur : la carte reste grise, quadrillée, et l'athlète croit
 * avoir perdu le réseau. On ne propose donc pas le bouton plutôt que de le proposer cassé.
 *
 * ⚠️ 512 PX CHEZ MAPTILER, 256 AILLEURS — et `zoomOffset` doit suivre (−1 contre 0).
 * Se tromper ne lève rien non plus : la carte est simplement décalée d'un facteur deux,
 * et on croit à un GPS imprécis (déjà vu sur les vignettes du fil d'activités).
 *
 * L'URL et l'attribution du satellite viennent du catalogue de `lib/trail/couches`, où
 * chaque source a été interrogée pour de vrai : une seule copie de l'adresse.
 */
import { FONDS, avecCle } from "@/lib/trail/couches";

export type IdFond = "plan" | "satellite";

export type FondDirect = {
  id: IdFond;
  /** Clé de traduction du nom — ce module ne rend jamais un mot d'une langue. */
  cle: string;
  url: string;
  /** Obligatoire par licence (OpenStreetMap, MapTiler). Jamais vide. */
  attribution: string;
  taille: 256 | 512;
  zoomOffset: 0 | -1;
  zoomMax: number;
};

/** `zoomOffset` se DÉDUIT de la taille de tuile : c'est la seule combinaison correcte. */
export function offsetDe(taille: 256 | 512): 0 | -1 {
  return taille === 512 ? -1 : 0;
}

/**
 * Les fonds utilisables ici et maintenant, dans l'ordre du sélecteur.
 * Toujours au moins un : sans clé MapTiler, OpenStreetMap reste ouvert à tous.
 */
export function fondsCarteDirecte(cleMapTiler?: string): FondDirect[] {
  const plan: FondDirect = cleMapTiler
    ? {
        id: "plan", cle: "map.plan",
        url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${cleMapTiler}`,
        attribution: "© MapTiler © OpenStreetMap contributors",
        taille: 512, zoomOffset: offsetDe(512), zoomMax: 19,
      }
    : {
        id: "plan", cle: "map.plan",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "© OpenStreetMap contributors",
        taille: 256, zoomOffset: offsetDe(256), zoomMax: 19,
      };

  const source = FONDS.find((f) => f.id === "satellite");
  const urlSat = source ? avecCle(source.url, cleMapTiler) : null;
  if (!source || !urlSat) return [plan];

  return [
    plan,
    {
      id: "satellite", cle: "map.satellite",
      url: urlSat,
      attribution: source.attribution,
      taille: source.taille,
      zoomOffset: offsetDe(source.taille),
      zoomMax: source.zoomMax,
    },
  ];
}
