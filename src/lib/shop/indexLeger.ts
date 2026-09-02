/**
 * LE CATALOGUE, RÉDUIT À CE QUI SERT AU GARAGE.
 *
 * ⚠️ POURQUOI UNE VERSION RÉDUITE. Le catalogue complet porte ses sources, ses dates de
 * relevé et ses écarts entre sources : utile sur une fiche, inutile dans un menu de
 * saisie, et cela partirait dans le paquet JavaScript de la page Profil pour rien.
 *
 * ⚠️ CE QUE ÇA RÉPARE. Le garage n'enregistrait QUE la marque, le modèle, la durée de vie
 * et la date d'achat : `shoes.drop_mm`, `stack_mm`, `weight_g` et `terrain` étaient
 * nuls pour tout le monde, alors que les colonnes existent depuis la première migration.
 * Conséquence directe : l'avertissement de transition de drop du comparateur — « tu
 * cours en 10 mm, celle-ci est en 4 mm » — ne pouvait JAMAIS se déclencher, faute de
 * connaître le drop des paires en rotation. Personne ne saisit un drop à la main ; le
 * catalogue, lui, le connaît.
 */
import { CATALOGUE } from "./catalogue";

export type ModeleLeger = {
  marque: string;
  nom: string;
  dropMm?: number;
  stackMm?: number;
  poidsG?: number;
  terrain: string;
  dureeVieKm?: number;
};

export function indexLeger(): ModeleLeger[] {
  return CATALOGUE.map((m) => ({
    marque: m.marque,
    nom: m.nom,
    dropMm: m.dropMm?.valeur,
    stackMm: m.stackTalonMm?.valeur,
    poidsG: m.poidsG?.valeur,
    terrain: m.terrain,
    dureeVieKm: m.dureeVieKm?.valeur,
  }));
}

/**
 * Les cotes telles que la table `shoes` peut les recevoir.
 *
 * ⚠️ `drop_mm`, `stack_mm` ET `weight_g` SONT DES ENTIERS (`smallint`). Vérifié en base
 * le 02/09/2026 : insérer 38,5 ne tronque pas, ça ÉCHOUE — « invalid input syntax for
 * type smallint ». Et comme le drop et la hauteur partent dans la même insertion que la
 * paire elle-même, deux modèles du catalogue auraient fait échouer TOUT l'ajout :
 * l'athlète aurait vu « erreur » et perdu sa saisie, sans jamais savoir pourquoi.
 *
 * On arrondit donc, et seulement ici : la fiche du comparateur, elle, garde la valeur
 * exacte relevée. Un millimètre d'arrondi ne change rien à un suivi d'usure ; un ajout
 * qui échoue, si.
 */
export function cotesPourGarage(m: ModeleLeger | undefined): { drop_mm: number | null; stack_mm: number | null; weight_g: number | null } {
  const entier = (v: number | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v));
  return { drop_mm: entier(m?.dropMm), stack_mm: entier(m?.stackMm), weight_g: entier(m?.poidsG) };
}

/** Retrouve un modèle du catalogue à partir de ce que l'athlète a tapé. */
export function trouver(liste: ModeleLeger[], marque: string, nom: string): ModeleLeger | undefined {
  const n = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const [bm, bn] = [n(marque), n(nom)];
  return liste.find((m) => n(m.marque) === bm && n(m.nom) === bn);
}
