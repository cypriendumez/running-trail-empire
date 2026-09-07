// ─────────────────────────────────────────────────────────────────────────────
//  LES FICHES D'ÉQUIPEMENT PUBLIQUES.
//
//  Le comparateur était derrière la connexion. Il ne coûte pourtant RIEN — aucun appel
//  au modèle, un fichier JSON et quelques comparaisons — et il répond à des questions
//  que des milliers de gens tapent dans un moteur de recherche : « drop de la Clifton
//  10 », « quelle chaussure pour un marathon ». Il ne rapportait donc aucune visite,
//  alors que les 10 539 fiches de courses, elles, sont publiques et indexées.
//
//  ⚠️ LA PORTE SE DÉPLACE, ELLE NE DISPARAÎT PAS. La page publique montre les
//  CARACTÉRISTIQUES relevées et sourcées. Ce qui reste derrière le compte, c'est le
//  VERDICT PERSONNEL — la confrontation du modèle à l'entraînement réel de l'athlète,
//  qui est la seule chose que ce produit sait faire et qu'un site de test ne fait pas.
//
//  ⚠️ ET AUCUNE VALEUR N'EST INVENTÉE. Une cote absente s'affiche « non communiqué »,
//  jamais une moyenne ni un ordre de grandeur. C'est la règle qui a fait geler l'ancienne
//  boutique et ses 1 167 prix fabriqués ; elle vaut aussi pour une page publique, où le
//  lecteur n'a même pas de compte pour nous corriger.
// ─────────────────────────────────────────────────────────────────────────────
import { CATALOGUE } from "@/lib/shop/catalogue";
import type { Modele } from "@/lib/shop/modele";

/** Une caractéristique telle qu'on l'affiche : la valeur, ou l'aveu qu'on ne l'a pas. */
export type Caracteristique = {
  cle: string;
  /** Clé de traduction du libellé (`spec.poidsG`…). La page le traduit, ce module non :
   *  un libellé français en dur ici ressortirait tel quel sur la page allemande. */
  labelCle: string;
  /** `null` = non communiqué. On l'écrit, on ne le comble pas. */
  valeur: string | null;
  /** Vrai quand la valeur est un booléen, que la page traduit en Oui / Non. */
  booleen?: boolean;
  /** Date à laquelle la valeur a été relevée chez la source. */
  vu?: string;
};

const UNITE: Record<string, string> = {
  poidsG: " g", dropMm: " mm", stackTalonMm: " mm", dureeVieKm: " km", prixConseilleEur: " €",
};

/**
 * Les caractéristiques publiables d'un modèle, dans l'ordre où un coureur les cherche.
 * Toutes les entrées sont rendues, y compris celles qu'on ne connaît pas : une grille à
 * trous dit la vérité, une grille amputée laisse croire que tout est renseigné.
 */
export function caracteristiques(m: Modele): Caracteristique[] {
  const out: Caracteristique[] = [];
  const mesure = (cle: keyof Modele) => {
    const v = m[cle] as { valeur?: unknown; vu?: string } | undefined;
    const brut = v?.valeur;
    // Un booléen ressort « oui »/« non » — clés que la page traduit. Écrire « Oui » ici
    // le ferait apparaître en français sur les quatre autres langues.
    const texte = typeof brut === "boolean" ? (brut ? "oui" : "non")
      : typeof brut === "number" && Number.isFinite(brut) ? `${brut}${UNITE[cle as string] ?? ""}`
      : null;
    out.push({ cle: cle as string, labelCle: `spec.${cle as string}`, valeur: texte, booleen: typeof brut === "boolean", vu: v?.vu });
  };
  out.push({ cle: "terrain", labelCle: "spec.terrain", valeur: m.terrain ?? null });
  for (const c of ["poidsG", "dropMm", "stackTalonMm", "plaqueCarbone", "dureeVieKm", "prixConseilleEur"] as const) mesure(c);
  out.push({ cle: "foulee", labelCle: "spec.foulee", valeur: m.foulee ?? null });
  out.push({ cle: "annee", labelCle: "spec.annee", valeur: m.annee ? String(m.annee) : null });
  return out;
}

/** Combien de caractéristiques sont réellement connues. Sert à ne pas se vanter. */
export function connues(m: Modele): number {
  return caracteristiques(m).filter((c) => c.valeur != null).length;
}

export function nomComplet(m: Modele): string {
  return `${m.marque} ${m.nom}`.trim();
}

const SUITE_TITRE: Record<string, string> = {
  fr: "poids, drop et caractéristiques", en: "weight, drop and specifications",
  de: "Gewicht, Sprengung und technische Daten", es: "peso, drop y características",
  pt: "peso, drop e características",
};

export function titrePage(m: Modele, lang = "fr"): string {
  // Le millésime n'entre dans le titre que s'il est connu : « Clifton 10 undefined »
  // est exactement le genre de titre qu'une page indexée garde des années.
  return `${nomComplet(m)}${m.annee ? ` (${m.annee})` : ""} — ${SUITE_TITRE[lang] ?? SUITE_TITRE.fr}`;
}

const DESC: Record<string, (n: string, c: string, t: number) => string> = {
  fr: (n, c, t) => `${n} : caractéristiques relevées et sourcées, sans prix marchand inventé.${c} Compare-la aux ${t} modèles du catalogue Pacevo.`,
  en: (n, c, t) => `${n}: specs recorded and sourced, with no made-up retail price.${c} Compare it against the ${t} models in the Pacevo catalogue.`,
  de: (n, c, t) => `${n}: erhobene und belegte Daten, ohne erfundenen Händlerpreis.${c} Vergleiche ihn mit den ${t} Modellen im Pacevo-Katalog.`,
  es: (n, c, t) => `${n}: características recogidas y con fuentes, sin precio de venta inventado.${c} Compárala con los ${t} modelos del catálogo Pacevo.`,
  pt: (n, c, t) => `${n}: características recolhidas e com fontes, sem preço de venda inventado.${c} Compara-a com os ${t} modelos do catálogo Pacevo.`,
};

export function descriptionPage(m: Modele, lang = "fr"): string {
  const bouts: string[] = [];
  const p = m.poidsG?.valeur, d = m.dropMm?.valeur, s = m.stackTalonMm?.valeur;
  if (typeof p === "number") bouts.push(`${p} g`);
  if (typeof d === "number") bouts.push(`drop ${d} mm`);
  if (typeof s === "number") bouts.push(`semelle ${s} mm au talon`);
  const chiffres = bouts.length ? ` ${bouts.join(", ")}.` : "";
  return (DESC[lang] ?? DESC.fr)(nomComplet(m), chiffres, CATALOGUE.length);
}

/** Modèles proches, pour que la page mène ailleurs qu'à une impasse. */
export function voisins(m: Modele, n = 6): Modele[] {
  const poids = (x: Modele) => x.poidsG?.valeur ?? null;
  const p = poids(m);
  return CATALOGUE
    .filter((x) => x.slug !== m.slug && x.terrain === m.terrain)
    .sort((a, b) => {
      // À terrain égal, on rapproche par le poids quand il est connu des deux côtés ;
      // sinon on garde l'ordre du catalogue plutôt que d'inventer une distance.
      const pa = poids(a), pb = poids(b);
      if (p == null || pa == null || pb == null) return 0;
      return Math.abs(pa - p) - Math.abs(pb - p);
    })
    .slice(0, n);
}
