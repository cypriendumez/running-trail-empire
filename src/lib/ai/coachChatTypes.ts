/**
 * Ce que l'écran du coach partage avec le serveur — et RIEN d'autre.
 *
 * ⚠️ UN COMPOSANT `use client` EMBARQUE TOUT SON ARBRE D'IMPORTS (voir la fuite des 106 gros
 * mots dans le JavaScript public). Importer `lib/ai/coachChat` depuis l'écran y aurait
 * glissé l'invite complète du coach, consignes comprises. Ce module ne contient que des
 * types et une borne.
 */
export type Role = "user" | "model";
export type MessageCoach = { role: Role; text: string; at?: string };

/** Ce que chaque formule donne au coach. `complet` = Premium, et l'essai (qui montre Premium). */
export type Niveau = "essentiel" | "complet";

/** Une question plus longue est coupée avant d'atteindre le modèle. */
export const LONGUEUR_QUESTION = 1200;
