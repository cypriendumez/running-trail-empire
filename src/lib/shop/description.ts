/**
 * LA DESCRIPTION D'UN MODÈLE — écrite à partir des chiffres, jamais autour.
 *
 * ⚠️ POURQUOI DÉTERMINISTE, ET PAS RÉDIGÉE PAR UN MODÈLE DE LANGAGE. Une prose générée
 * affirme ce qu'elle ne sait pas : elle parlera d'« excellent maintien » ou de « semelle
 * accrocheuse » sur une chaussure dont on n'a que le poids et le drop. Ici chaque phrase
 * se déduit d'une valeur relevée ; s'il n'y a pas de valeur, il n'y a pas de phrase. Le
 * texte est donc plus court quand la fiche est pauvre — et c'est exactement ce qu'il faut
 * que l'athlète voie.
 *
 * ⚠️ ON REND DES CLÉS, PAS DES PHRASES. Rendre du français condamnait l'athlète
 * germanophone ou hispanophone à lire une fiche française sans que rien ne le signale :
 * le contrôle d'i18n n'inspecte que les fichiers `.tsx`. Les textes vivent dans
 * `components/shop/shopI18n.ts`, dans les cinq langues, et un test vérifie que toute clé
 * produite ici y existe.
 *
 * Les seuils viennent de la pratique, pas d'un barème inventé : ils sont commentés un par
 * un pour être discutables.
 */
import type { Modele } from "./modele";
import type { Bout } from "@/components/shop/shopI18n";

/** Épaisseur de semelle au talon. Les bornes séparent des sensations réellement différentes. */
export function familleAmorti(stackMm?: number): "fin" | "modere" | "genereux" | "maximal" | null {
  if (stackMm == null) return null;
  if (stackMm < 25) return "fin";       // on sent le sol, typique des chaussures de piste et minimalistes
  if (stackMm < 33) return "modere";    // le standard d'une chaussure de séance
  if (stackMm < 40) return "genereux";  // le standard actuel d'une chaussure d'entraînement
  return "maximal";                     // au-delà de 40 mm, la limite World Athletics sur route
}

/** Le poids qui sépare une chaussure de séance d'une chaussure d'entraînement. */
export function familleMasse(poidsG?: number): "plume" | "legere" | "standard" | "lourde" | null {
  if (poidsG == null) return null;
  if (poidsG < 200) return "plume";
  if (poidsG < 250) return "legere";
  if (poidsG < 300) return "standard";
  return "lourde";
}

/** Ce que le drop change vraiment : la répartition de la contrainte entre mollet et genou. */
export function familleDrop(dropMm: number): "bas" | "intermediaire" | "courant" | "haut" {
  if (dropMm <= 4) return "bas";
  if (dropMm <= 6) return "intermediaire";
  if (dropMm <= 9) return "courant";
  return "haut";
}

/**
 * Le texte complet, en clés. Chaque bout est absent quand la donnée l'est — c'est la
 * règle de l'app : quand la donnée manque, on le dit, on ne la fabrique pas.
 */
export function decrire(m: Modele): { bouts: Bout[]; manquantes: string[] } {
  const bouts: Bout[] = [
    { cle: "shop.d.identite", params: { marque: m.marque, nom: m.nom, famille: `shop.d.f.${m.terrain}` } },
    { cle: `shop.d.terrain.${m.terrain}` },
  ];

  const amorti = familleAmorti(m.stackTalonMm?.valeur);
  // ⚠️ LE CHIFFRE ACCOMPAGNE LA FAMILLE « MAXIMAL ». Sans lui, la phrase disait que la
  // semelle « atteint la limite autorisée » — or à 42 mm la Clifton 10 la DÉPASSE. Une
  // approximation qui laisse croire qu'une chaussure est homologuée en compétition alors
  // qu'elle ne l'est pas.
  if (amorti) bouts.push({ cle: `shop.d.amorti.${amorti}`, params: amorti === "maximal" ? { stack: m.stackTalonMm!.valeur } : undefined });
  const masse = familleMasse(m.poidsG?.valeur);
  if (masse) bouts.push({ cle: `shop.d.masse.${masse}`, params: { poids: m.poidsG!.valeur } });
  if (m.dropMm) bouts.push({ cle: `shop.d.drop.${familleDrop(m.dropMm.valeur)}`, params: { drop: m.dropMm.valeur } });
  if (m.plaqueCarbone) bouts.push({ cle: m.plaqueCarbone.valeur ? "shop.d.plaque.avec" : "shop.d.plaque.sans" });
  if (m.dureeVieKm) bouts.push({ cle: "shop.d.duree", params: { km: m.dureeVieKm.valeur } });

  const manquantes: string[] = [];
  if (!m.poidsG) manquantes.push("shop.spec.poids");
  if (!m.dropMm) manquantes.push("shop.spec.drop");
  if (!m.stackTalonMm) manquantes.push("shop.spec.stack");
  if (!m.plaqueCarbone) manquantes.push("shop.spec.plaque");
  if (!m.prixConseilleEur) manquantes.push("shop.spec.prix");
  return { bouts, manquantes };
}
