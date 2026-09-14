/**
 * DE LA LISTE DES VISITES AUX CHIFFRES DE L'ESPACE COACH — pur, testable.
 *
 * Deux règles de comptage, à ne pas mélanger :
 *  · « visiteurs » = empreintes DISTINCTES d'un jour (voir `empreinte.ts` : l'empreinte
 *    change chaque jour, donc un total sur une période est un CUMUL de visiteurs
 *    quotidiens, pas des personnes uniques — et l'écran doit le dire) ;
 *  · « comptes actifs » = pseudonymes STABLES distincts sur la période : là, c'est bien
 *    un nombre de clients différents, parce que le pseudonyme ne change pas.
 */

export type LigneVisite = {
  jour: string;
  chemin: string;
  espace: "site" | "app";
  visiteur: string;
  compte?: string | null;
  connecte?: boolean | null;
  appareil?: string | null;
  langue?: string | null;
  pays?: string | null;
  referent?: string | null;
};

export type Jour = {
  jour: string;
  vues: number;
  visiteurs: number;
  vuesSite: number;
  vuesApp: number;
  visiteursSite: number;
  visiteursApp: number;
  /** Comptes connectés distincts ce jour-là. */
  comptes: number;
};

export type Classement = { cle: string; vues: number; visiteurs: number }[];

export type Agregat = {
  du: string;
  au: string;
  jours: Jour[];
  total: {
    vues: number;
    /** CUMUL des visiteurs quotidiens — pas des personnes uniques. */
    visiteursJours: number;
    vuesSite: number;
    vuesApp: number;
    /** Comptes distincts sur toute la période (pseudonyme stable). */
    comptesActifs: number;
    comptesActifs7j: number;
  };
  pages: Classement;
  referents: Classement;
  appareils: Classement;
  pays: Classement;
  langues: Classement;
};

const ajouterJours = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Tous les jours de `du` à `au` inclus, dans l'ordre. */
export function joursEntre(du: string, au: string): string[] {
  const out: string[] = [];
  for (let j = du; j <= au && out.length < 800; j = ajouterJours(j, 1)) out.push(j);
  return out;
}

function classer(lignes: LigneVisite[], cle: (l: LigneVisite) => string | null | undefined, max: number): Classement {
  const m = new Map<string, { vues: number; visiteurs: Set<string> }>();
  for (const l of lignes) {
    const k = cle(l);
    if (!k) continue;
    const e = m.get(k) ?? { vues: 0, visiteurs: new Set<string>() };
    e.vues++;
    e.visiteurs.add(`${l.jour}|${l.visiteur}`);
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([k, e]) => ({ cle: k, vues: e.vues, visiteurs: e.visiteurs.size }))
    .sort((a, b) => b.vues - a.vues || a.cle.localeCompare(b.cle))
    .slice(0, max);
}

export function agregerVisites(lignes: LigneVisite[], periode: { du: string; au: string }): Agregat {
  const { du, au } = periode;
  const dansPeriode = lignes.filter((l) => l.jour >= du && l.jour <= au);

  const parJour = new Map<string, LigneVisite[]>();
  for (const l of dansPeriode) parJour.set(l.jour, [...(parJour.get(l.jour) ?? []), l]);

  const jours: Jour[] = joursEntre(du, au).map((jour) => {
    const ls = parJour.get(jour) ?? [];
    const distinct = (f: (l: LigneVisite) => boolean, cle: (l: LigneVisite) => string | null | undefined = (l) => l.visiteur) =>
      new Set(ls.filter(f).map(cle).filter(Boolean)).size;
    return {
      jour,
      vues: ls.length,
      visiteurs: distinct(() => true),
      vuesSite: ls.filter((l) => l.espace === "site").length,
      vuesApp: ls.filter((l) => l.espace === "app").length,
      visiteursSite: distinct((l) => l.espace === "site"),
      visiteursApp: distinct((l) => l.espace === "app"),
      comptes: distinct((l) => !!l.compte, (l) => l.compte),
    };
  });

  const comptes = (depuis: string) => new Set(dansPeriode.filter((l) => l.compte && l.jour >= depuis).map((l) => l.compte)).size;

  return {
    du, au, jours,
    total: {
      vues: dansPeriode.length,
      visiteursJours: jours.reduce((s, j) => s + j.visiteurs, 0),
      vuesSite: jours.reduce((s, j) => s + j.vuesSite, 0),
      vuesApp: jours.reduce((s, j) => s + j.vuesApp, 0),
      comptesActifs: comptes(du),
      comptesActifs7j: comptes(ajouterJours(au, -6)),
    },
    pages: classer(dansPeriode, (l) => l.chemin, 15),
    referents: classer(dansPeriode, (l) => l.referent, 10),
    appareils: classer(dansPeriode, (l) => l.appareil, 3),
    pays: classer(dansPeriode, (l) => l.pays, 8),
    langues: classer(dansPeriode, (l) => l.langue, 5),
  };
}
