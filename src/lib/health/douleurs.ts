/**
 * SUIVI DES DOULEURS DÉCLARÉES — la mémoire du kiné IA.
 *
 * ⚠️ LE KINÉ ÉTAIT AMNÉSIQUE D'UN JOUR SUR L'AUTRE. La route écrivait bien un
 * `pain_report` par zone et par jour, et le COACH les relisait (`coachContext`) — mais
 * le kiné, lui, ne relisait que ceux du JOUR COURANT, et uniquement pour éviter un
 * doublon d'écriture. Conséquence concrète : un athlète signalait un genou à 7/10 lundi,
 * revenait jeudi à 4/10, et recevait une première consultation repartant de zéro, sans
 * jamais lui dire que ça allait mieux. C'est précisément ce qu'un kiné fait : comparer.
 *
 * ⚠️ UNE SEULE DÉCLARATION NE FAIT PAS UNE TENDANCE. Avec un seul point, la tendance est
 * « inconnue » — pas « stable ». Annoncer « stable » sur un point unique inventerait une
 * comparaison qui n'a jamais eu lieu, et le modèle la répéterait à l'athlète.
 */

/**
 * ⚠️ `cle` EST L'IDENTIFIANT STABLE DE LA ZONE, `zone` N'EST QUE SON LIBELLÉ. Le libellé
 * est enregistré dans la langue d'affichage du moment (« Genou droit », « Right knee »,
 * « Rechtes Knie ») : regrouper dessus voulait dire qu'un athlète passant en anglais
 * perdait tout son historique et repartait à zéro. Le regroupement se fait donc sur la
 * clé du schéma corporel quand elle existe, et retombe sur le libellé pour les lignes
 * écrites avant qu'elle soit enregistrée.
 */
export type Signalement = { zone: string; cle?: string | null; level: number; date: string };

export type Tendance = "amelioration" | "stable" | "aggravation" | "inconnue";

export type SuiviZone = {
  /** Libellé affichable, repris de la déclaration la plus récente. */
  zone: string;
  /** Clé stable du schéma corporel, pour surligner la silhouette. */
  cle: string;
  dernier: number;
  premier: number;
  signalements: number;
  /** Jours écoulés depuis la PREMIÈRE déclaration : l'ancienneté d'une douleur oriente le diagnostic. */
  depuisJours: number;
  /** Jours écoulés depuis la DERNIÈRE : une douleur non redéclarée depuis 3 semaines n'est pas d'actualité. */
  derniereIlYaJours: number;
  tendance: Tendance;
};

/** Écart en points au-delà duquel on parle d'évolution plutôt que de bruit de mesure. */
export const ECART_SIGNIFICATIF = 2;

const jour = 86400000;
const enJours = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / jour);

/** Regroupe les déclarations par zone et décrit l'évolution de chacune. */
export function suiviParZone(rows: Signalement[], aujourdhui: string): SuiviZone[] {
  const par = new Map<string, Signalement[]>();
  for (const r of rows) {
    // ⚠️ ON N'ACCEPTE QUE CE QUI EST EXPLOITABLE. Une ligne sans zone ou sans niveau
    // produirait « douleur 0/10 » dans l'invite, que le modèle lirait comme une donnée —
    // et « ta douleur est à 0 » est un constat, pas un blanc.
    // ⚠️ `Number.isFinite` NE SUFFIT PAS : `Number(null)` vaut 0, qui est fini. Le
    // barème va de 1 à 10, et la route n'enregistre qu'à partir de 4 : hors de ces
    // bornes, la ligne n'est pas une déclaration de douleur.
    if (!r?.zone || typeof r.level !== "number" || !(r.level >= 1 && r.level <= 10)) continue;
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(r.date ?? ""))) continue;
    const cle = String(r.cle || r.zone);
    par.set(cle, [...(par.get(cle) ?? []), r]);
  }
  const out: SuiviZone[] = [];
  for (const [, liste] of par) {
    const tri = [...liste].sort((a, b) => a.date.localeCompare(b.date));
    const premier = tri[0]!, dernier = tri[tri.length - 1]!;
    // Le libellé affiché est celui de la déclaration la PLUS RÉCENTE : c'est la langue
    // dans laquelle l'athlète utilise l'application aujourd'hui.
    const zone = dernier.zone;
    const ecart = dernier.level - premier.level;
    out.push({
      zone,
      cle: String(dernier.cle || dernier.zone),
      dernier: dernier.level,
      premier: premier.level,
      signalements: tri.length,
      depuisJours: enJours(premier.date, aujourdhui),
      derniereIlYaJours: enJours(dernier.date, aujourdhui),
      tendance: tri.length < 2 ? "inconnue"
        : ecart <= -ECART_SIGNIFICATIF ? "amelioration"
        : ecart >= ECART_SIGNIFICATIF ? "aggravation" : "stable",
    });
  }
  // La zone la plus récemment douloureuse d'abord : c'est celle dont on vient parler.
  return out.sort((a, b) => a.derniereIlYaJours - b.derniereIlYaJours || b.dernier - a.dernier);
}

const MOT: Record<Tendance, string> = {
  amelioration: "en amélioration",
  aggravation: "EN AGGRAVATION",
  stable: "stable",
  inconnue: "une seule déclaration, pas d'évolution mesurable",
};

/**
 * Les lignes reprises dans l'invite. Chaîne VIDE quand il n'y a rien : la route écrit
 * alors explicitement qu'aucun antécédent n'est enregistré, plutôt que de laisser un
 * blanc que le modèle comblerait tout seul.
 */
export function resumeDouleurs(suivi: SuiviZone[]): string {
  return suivi.map((s) => {
    const anciennete = s.depuisJours <= 0 ? "déclarée aujourd'hui" : `signalée depuis ${s.depuisJours} j`;
    const recence = s.derniereIlYaJours <= 0 ? "aujourd'hui" : `il y a ${s.derniereIlYaJours} j`;
    const evolution = s.signalements < 2 ? MOT.inconnue : `${s.premier}/10 → ${s.dernier}/10, ${MOT[s.tendance]}`;
    return `${s.zone} : ${evolution} (${s.signalements} déclaration${s.signalements > 1 ? "s" : ""}, ${anciennete}, dernière ${recence})`;
  }).join("\n");
}
