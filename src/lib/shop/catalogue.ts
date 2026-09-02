/**
 * LECTURE DU CATALOGUE — filtres, tri, recherche.
 *
 * Aucun appel réseau, aucune base : le catalogue est un fichier. Tout ce module est donc
 * testable sans montage, ce qui est le but — c'est lui qui décide ce que l'athlète voit.
 */
import fiches from "@/data/gear/chaussures.json";
import { type Modele, type Terrain, type Usage } from "./modele";

export const CATALOGUE: Modele[] = Object.values(fiches as Record<string, Modele>);

export type Filtres = {
  q?: string;
  marques?: string[];
  terrains?: Terrain[];
  usages?: Usage[];
  /** Bornes incluses. `null` = pas de borne de ce côté. */
  dropMax?: number | null;
  poidsMax?: number | null;
  prixMax?: number | null;
  plaqueCarbone?: boolean | null;
};

export type Tri = "pertinence" | "poids" | "drop" | "prix" | "nouveaute" | "nom";

/** Normalisation pour la recherche : sans accents, sans casse. */
export function normalise(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * ⚠️ UN FILTRE NE DOIT JAMAIS ÉCARTER UNE FICHE POUR CAUSE DE DONNÉE MANQUANTE.
 * « Moins de 250 g » ne veut pas dire « et tant pis pour celles dont le poids n'est pas
 * publié » : l'athlète croirait que la chaussure absente pèse plus lourd. Une valeur
 * inconnue laisse passer, et la fiche affiche « non communiqué ». Le filtre restreint ce
 * qu'on sait, il n'invente pas ce qu'on ignore.
 */
function passeBorne(v: number | undefined, max: number | null | undefined): boolean {
  if (max == null) return true;
  if (v == null) return true;
  return v <= max;
}

export function filtrer(liste: Modele[], f: Filtres): Modele[] {
  const q = normalise(f.q);
  const mots = q ? q.split(/\s+/).filter(Boolean) : [];
  return liste.filter((m) => {
    if (mots.length) {
      const cible = normalise(`${m.marque} ${m.nom}`);
      if (!mots.every((x) => cible.includes(x))) return false;
    }
    if (f.marques?.length && !f.marques.includes(m.marque)) return false;
    if (f.terrains?.length && !f.terrains.includes(m.terrain)) return false;
    if (f.usages?.length && !f.usages.includes(m.usage)) return false;
    if (!passeBorne(m.dropMm?.valeur, f.dropMax)) return false;
    if (!passeBorne(m.poidsG?.valeur, f.poidsMax)) return false;
    if (!passeBorne(m.prixConseilleEur?.valeur, f.prixMax)) return false;
    if (f.plaqueCarbone != null) {
      // Ici en revanche l'inconnu ne passe pas : « avec plaque carbone » est une demande
      // explicite, et proposer une chaussure dont on ignore si elle en a une n'y répond
      // pas. Le filtre le dit dans son libellé.
      if (m.plaqueCarbone?.valeur !== f.plaqueCarbone) return false;
    }
    return true;
  });
}

/**
 * Tri. Les fiches dont la valeur de tri manque partent EN DERNIER, quel que soit le sens :
 * une donnée absente n'est ni la plus légère ni la plus lourde, elle est inconnue, et la
 * placer en tête ferait passer une ignorance pour un record.
 */
export function trier(liste: Modele[], tri: Tri, pertinence?: Map<string, number>): Modele[] {
  const clef = (m: Modele): number | undefined =>
    tri === "poids" ? m.poidsG?.valeur
      : tri === "drop" ? m.dropMm?.valeur
      : tri === "prix" ? m.prixConseilleEur?.valeur
      : tri === "nouveaute" ? -m.annee
      : tri === "pertinence" ? -(pertinence?.get(m.slug) ?? Number.NaN)
      : undefined;
  const copie = [...liste];
  if (tri === "nom") return copie.sort((a, b) => `${a.marque} ${a.nom}`.localeCompare(`${b.marque} ${b.nom}`, "fr"));
  return copie.sort((a, b) => {
    const x = clef(a), y = clef(b);
    const xManque = x == null || !Number.isFinite(x), yManque = y == null || !Number.isFinite(y);
    if (xManque && yManque) return `${a.marque} ${a.nom}`.localeCompare(`${b.marque} ${b.nom}`, "fr");
    if (xManque) return 1;
    if (yManque) return -1;
    return x! - y!;
  });
}

export function parSlug(slug: string): Modele | undefined {
  return CATALOGUE.find((m) => m.slug === slug);
}

export function marques(liste: Modele[] = CATALOGUE): string[] {
  return [...new Set(liste.map((m) => m.marque))].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Libellés d'usage, côté athlète. Le marketing dit « versatile », le coureur dit à quoi ça sert. */
export const LIBELLE_USAGE: Record<Usage, string> = {
  quotidien: "Footing quotidien",
  polyvalent: "Polyvalente",
  tempo: "Séances et allure soutenue",
  competition: "Compétition",
  trail_court: "Trail court",
  trail_long: "Ultra et trail long",
  amorti_max: "Amorti maximal",
};

export const LIBELLE_TERRAIN: Record<Terrain, string> = { route: "Route", trail: "Trail", piste: "Piste" };

/**
 * Les modèles les plus proches d'un modèle donné.
 *
 * ⚠️ « PROCHE » NE VEUT RIEN DIRE SANS DONNÉES. Deux fiches dépourvues de poids et de
 * drop obtiendraient une distance nulle et se retrouveraient en tête des alternatives,
 * alors qu'on ignore tout d'elles. On n'accepte donc comme alternative qu'un modèle dont
 * au moins une cote est comparable à celle du modèle de départ.
 */
export function alternatives(m: Modele, liste: Modele[] = CATALOGUE, n = 3): Modele[] {
  const ecart = (a?: number, b?: number, echelle = 1) =>
    a == null || b == null ? null : Math.abs(a - b) / echelle;
  const notes = liste
    .filter((x) => x.slug !== m.slug && x.terrain === m.terrain)
    .map((x) => {
      const parts = [
        ecart(x.poidsG?.valeur, m.poidsG?.valeur, 40),
        ecart(x.dropMm?.valeur, m.dropMm?.valeur, 3),
        ecart(x.stackTalonMm?.valeur, m.stackTalonMm?.valeur, 8),
      ].filter((v): v is number => v != null);
      if (!parts.length) return null;
      const base = parts.reduce((a, b) => a + b, 0) / parts.length;
      // Même usage : c'est le critère qui compte le plus pour un coureur.
      return { modele: x, distance: base + (x.usage === m.usage ? 0 : 1.2) };
    })
    .filter((v): v is { modele: Modele; distance: number } => v != null)
    .sort((a, b) => a.distance - b.distance);
  return notes.slice(0, n).map((x) => x.modele);
}
