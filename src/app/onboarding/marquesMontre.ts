/**
 * LES MARQUES PROPOSÉES À L'ÉTAPE MONTRE DU QUESTIONNAIRE (12/10/2026).
 *
 * Demande de Cyprien : « propose les différentes marques de montre […] car pour Apple il faut
 * télécharger une autre application ». Avant, tout le monde lisait les mêmes quatre étapes,
 * avec un encadré Apple glissé au milieu de celles d'une Garmin. Désormais on choisit sa
 * marque d'abord, et on ne lit que SES gestes.
 *
 * Deux chemins seulement :
 *  · `connexion` — la marque se relie dans la page Connexions d'intervals.icu (Garmin, COROS,
 *    Suunto, Polar, et les marques servies mais tues de la vitrine : Wahoo, Amazfit, Huawei) ;
 *  · `companion` — l'Apple Watch, qui n'a AUCUNE carte chez intervals.icu : l'app iPhone
 *    tierce « Intervals.icu Companion » fait le lien dans les deux sens.
 *
 * Ce n'est pas la vitrine (voir `SYNC` dans src/app/page.tsx et la mémoire « montres
 * annoncées ≠ servies ») : ici, la personne a DÉJÀ sa montre. Polar y figure donc, avec la
 * vérité — ses sorties arrivent, mais aucune séance ne part vers la montre.
 */
export type MarqueId = "garmin" | "apple" | "coros" | "suunto" | "polar" | "autre" | "aucune";

export type Marque = {
  id: MarqueId;
  /** Nom propre, jamais traduit. `null` : le libellé vient du dictionnaire. */
  nom: string | null;
  /** Mot-symbole dans public/brands/, s'il existe. */
  logo?: string;
  chemin: "connexion" | "companion" | "aucun";
  /** La séance planifiée arrive-t-elle au poignet ? (champs `*_upload_workouts`) */
  recoit: boolean;
};

export const MARQUES: readonly Marque[] = [
  { id: "garmin", nom: "Garmin", logo: "/brands/garmin.svg", chemin: "connexion", recoit: true },
  { id: "apple", nom: "Apple Watch", logo: "/brands/apple-watch.svg", chemin: "companion", recoit: true },
  { id: "coros", nom: "COROS", logo: "/brands/coros.png", chemin: "connexion", recoit: true },
  { id: "suunto", nom: "Suunto", logo: "/brands/suunto.svg", chemin: "connexion", recoit: true },
  // Polar LIT sans jamais recevoir : son API n'accepte pas les séances planifiées.
  { id: "polar", nom: "Polar", chemin: "connexion", recoit: false },
  // Wahoo, Amazfit (`zepp_*`), Huawei : reliées comme les autres, séance reçue.
  { id: "autre", nom: null, chemin: "connexion", recoit: true },
  { id: "aucune", nom: null, chemin: "aucun", recoit: false },
];

/** L'app iPhone qui relie l'Apple Watch à intervals.icu (McEwen Labs). */
export const APP_STORE_COMPANION = "https://apps.apple.com/app/id6739638454";

export const marqueDe = (id: MarqueId | null): Marque | null => MARQUES.find((m) => m.id === id) ?? null;
