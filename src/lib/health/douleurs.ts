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

/* ────────────────────────────────────────────────────────────────────────────
 * L'ÉTAT D'UNE DOULEUR — déclaré par l'athlète, et comment on en sort.
 *
 * ⚠️ UNE DOULEUR DÉCLARÉE NE POUVAIT PAS ÊTRE RETIRÉE. Elle s'écrivait depuis le kiné IA
 * (schéma corporel, niveau ≥ 4) et ne s'éteignait QUE par péremption. Entre-temps elle
 * retirait de l'intensité à chaque replanification (`qualityBudget` : `if (i.pains.length)
 * qBudget -= 1`) et le kiné la ressortait à chaque consultation.
 *
 * Cyprien, 23/09/2026 : « hier j'ai dit que j'avais mal au bras, ce qui est faux, c'était
 * pour tester — trouve un moyen pour que le client puisse dire que tout va mieux, ou que
 * ça s'empire ». Une déclaration de santé qu'on ne peut pas corriger est pire qu'une
 * absence de déclaration : elle est fausse ET elle agit.
 *
 * ⚠️ CECI N'EST PAS `tendance` CI-DESSUS. `tendance` est MESURÉE en comparant des niveaux
 * successifs (7/10 → 4/10) ; l'état est DÉCLARÉ par l'athlète. Les deux disent des choses
 * différentes et doivent coexister : on peut aller mieux sans avoir redéclaré un niveau.
 * ──────────────────────────────────────────────────────────────────────────── */

export type EtatDouleur = "actif" | "mieux" | "pire" | "resolu";

export const ETATS: readonly EtatDouleur[] = ["actif", "mieux", "pire", "resolu"] as const;

/** Une ligne `pain_report` telle qu'elle est stockée. */
export type Douleur = {
  id?: string;
  zone?: string | null;
  slot?: string | null;
  level?: number | null;
  date?: string | null;
  etat?: string | null;
  /** Jour de la dernière mise à jour d'état, déclarée par l'athlète. */
  majA?: string | null;
};

/** L'état d'une ligne, quoi qu'elle contienne. Tout ce qui n'est pas connu vaut `actif`. */
export function etatDe(d: Douleur | null | undefined): EtatDouleur {
  const e = String(d?.etat ?? "").trim().toLowerCase();
  return (ETATS as readonly string[]).includes(e) ? (e as EtatDouleur) : "actif";
}

/**
 * Une douleur pèse sur l'entraînement tant qu'elle n'est pas déclarée passée.
 *
 * ⚠️ « MIEUX » N'EST PAS « RÉSOLU ». Une gêne qui s'améliore reste une gêne : la retirer
 * du budget de qualité rendrait la séance dure le jour même où l'athlète dit « ça va un
 * peu mieux ». C'est exactement comme ça qu'on rechute.
 */
export function pese(d: Douleur | null | undefined): boolean {
  return etatDe(d) !== "resolu";
}

/**
 * ⚠️ LA PÉREMPTION RESTE, EN PLUS DE L'ÉTAT. Elle protège contre l'oubli — une gêne
 * signalée il y a un mois et jamais redéclarée ne doit pas brider indéfiniment. L'état,
 * lui, protège contre l'erreur. Aucun des deux ne couvre le cas de l'autre.
 */
export const PEREMPTION_JOURS = 14;

/** Les douleurs encore valables : ni périmées, ni déclarées passées. */
export function actives(liste: Douleur[], aujourdhui: string, peremptionJours = PEREMPTION_JOURS): Douleur[] {
  const t0 = Date.parse(`${aujourdhui}T12:00:00`);
  return liste.filter((d) => {
    if (!d?.zone || !d?.date) return false;
    if (!pese(d)) return false;
    const t = Date.parse(`${String(d.date).slice(0, 10)}T12:00:00`);
    if (!Number.isFinite(t) || !Number.isFinite(t0)) return false;
    return t0 - t <= peremptionJours * 86400000;
  });
}

/**
 * Le libellé lu par le coach et par le kiné : la zone, le niveau, et la tendance DÉCLARÉE.
 *
 * ⚠️ ELLE FAIT PARTIE DU FAIT. « Mollet gauche (6/10) » et « Mollet gauche (6/10), en
 * aggravation » n'appellent pas la même séance ; taire l'évolution, c'est demander au
 * coach de décider sur une photo au lieu d'un film.
 */
export function libelleEtat(d: Douleur, mots: { mieux: string; pire: string }): string {
  const base = `${d.zone ?? ""}${d.level ? ` (${d.level}/10)` : ""}`;
  const e = etatDe(d);
  if (e === "mieux") return `${base}, ${mots.mieux}`;
  if (e === "pire") return `${base}, ${mots.pire}`;
  return base;
}

/** Les libellés des douleurs actives, prêts pour le contexte du coach. */
export function libellesActifs(liste: Douleur[], aujourdhui: string, mots: { mieux: string; pire: string }): string[] {
  return [...new Set(actives(liste, aujourdhui).map((d) => libelleEtat(d, mots)))];
}

/** Un état reçu d'un client : accepté seulement s'il est connu. */
export function etatValide(brut: unknown): EtatDouleur | null {
  const e = String(brut ?? "").trim().toLowerCase();
  return (ETATS as readonly string[]).includes(e) ? (e as EtatDouleur) : null;
}
