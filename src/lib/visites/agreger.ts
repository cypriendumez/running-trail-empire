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
  /** Instant précis, pour l'affluence horaire. Absent des vieilles lignes : ignoré alors. */
  created_at?: string | null;
};

/** L'heure (0-23) DANS LE FUSEAU DE L'ÉDITEUR — jamais celle du serveur (iad1, USA). */
function heureLocale(iso: string, tz: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(d);
  const n = Number(h === "24" ? "0" : h);
  return Number.isFinite(n) ? n : null;
}

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
  /** Affluence par heure (0-23) dans le fuseau de l'éditeur — quand les gens viennent. */
  heures: { h: number; vues: number; visiteurs: number }[];
  /** La MÊME mesure sur la période précédente de même longueur, pour la tendance. */
  precedent: { vues: number; visiteursJours: number; comptesActifs: number; vuesSite: number; vuesApp: number };
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

/** Le sous-total brut d'une tranche de lignes — sert à la période précédente. */
function sousTotal(lignes: LigneVisite[]) {
  const parJour = new Map<string, Set<string>>();
  let vues = 0, vuesSite = 0, vuesApp = 0;
  const comptes = new Set<string>();
  for (const l of lignes) {
    vues++;
    if (l.espace === "site") vuesSite++; else vuesApp++;
    const s = parJour.get(l.jour) ?? new Set<string>();
    s.add(l.visiteur); parJour.set(l.jour, s);
    if (l.compte) comptes.add(l.compte);
  }
  const visiteursJours = [...parJour.values()].reduce((n, s) => n + s.size, 0);
  return { vues, visiteursJours, comptesActifs: comptes.size, vuesSite, vuesApp };
}

export function agregerVisites(
  lignes: LigneVisite[],
  periode: { du: string; au: string; tz?: string },
): Agregat {
  const { du, au, tz = "Europe/Paris" } = periode;
  const dansPeriode = lignes.filter((l) => l.jour >= du && l.jour <= au);

  // Période précédente de MÊME longueur, juste avant `du`, pour la tendance.
  const jours = joursEntre(du, au);
  const duPrecedent = ajouterJours(du, -jours.length);
  const auPrecedent = ajouterJours(du, -1);
  const precedent = sousTotal(lignes.filter((l) => l.jour >= duPrecedent && l.jour <= auPrecedent));

  // Affluence horaire (dans le fuseau de l'éditeur).
  const heuresVues = new Array(24).fill(0);
  const heuresVis: Set<string>[] = Array.from({ length: 24 }, () => new Set<string>());
  for (const l of dansPeriode) {
    if (!l.created_at) continue;
    const h = heureLocale(l.created_at, tz);
    if (h === null) continue;
    heuresVues[h]++;
    heuresVis[h].add(`${l.jour}|${l.visiteur}`);
  }
  const heures = heuresVues.map((vues, h) => ({ h, vues, visiteurs: heuresVis[h].size }));

  const parJour = new Map<string, LigneVisite[]>();
  for (const l of dansPeriode) parJour.set(l.jour, [...(parJour.get(l.jour) ?? []), l]);

  const joursAgreges: Jour[] = jours.map((jour) => {
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
    du, au, jours: joursAgreges, heures, precedent,
    total: {
      vues: dansPeriode.length,
      visiteursJours: joursAgreges.reduce((s, j) => s + j.visiteurs, 0),
      vuesSite: joursAgreges.reduce((s, j) => s + j.vuesSite, 0),
      vuesApp: joursAgreges.reduce((s, j) => s + j.vuesApp, 0),
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
