/**
 * LA QUALITÉ DES SEPT DERNIERS JOURS — ce que le plan doit se rappeler chaque matin.
 *
 * ⚠️ LA MÊME SÉANCE AU SEUIL, QUATRE MATINS DE SUITE. Relevé sur le compte de Cyprien du
 * 21 au 24/09/2026, à cinq semaines du marathon de Lille : « Séance au seuil » le lundi,
 * le mardi, le mercredi et le jeudi. Le plan est une fenêtre GLISSANTE de sept jours,
 * reconstruite chaque matin à partir d'aujourd'hui ; du passé, il ne connaissait que la
 * dernière séance dure EFFECTUÉE. Une séance prescrite et non faite ne laissait aucune
 * trace : le lendemain, le budget de la semaine était intact, le premier jour libre était
 * aujourd'hui, et la même séance y retombait. Les jours écoulés, eux, gardent leur
 * prescription figée — d'où quatre seuils identiques alignés dans le calendrier.
 *
 * ⚠️ L'ATHLÈTE QUI SUIVAIT LE PLAN N'ÉTAIT PAS MIEUX SERVI. Le budget (« une qualité cette
 * semaine ») s'appliquait à chaque fenêtre repartant d'aujourd'hui, jamais aux séances
 * déjà courues : une qualité faite avant-hier n'interdisait qu'un placement à moins de
 * 48 h. Budget d'une séance par semaine, séance réalisée → une nouvelle deux jours plus
 * tard. Vérifié en simulation sur le même compte le 28/09/2026.
 *
 * La règle devient celle d'une vraie semaine : sur N'IMPORTE QUELS sept jours consécutifs,
 * pas plus de séances de qualité que le budget. Et une séance manquée ne se rattrape pas —
 * elle compte comme posée. Rattraper, c'est empiler l'intensité sur les jours suivants ;
 * c'est aussi prescrire indéfiniment une séance que l'athlète, visiblement, ne fait pas.
 */

/** Longueur de la fenêtre sur laquelle le budget de qualité s'applique. */
export const FENETRE_JOURS = 7;

/**
 * Une séance dure courue à deux jours ou moins de sa date prescrite EST la séance
 * prescrite, simplement déplacée. Sans cette tolérance, une séance faite le mardi au lieu
 * du lundi compterait deux fois — la prescription manquée ET la séance courue — et
 * retirerait à tort la qualité suivante.
 */
export const DECALAGE_TOLERE_JOURS = 2;

/** Une ligne `coach_session` telle qu'elle est stockée (`data`). */
export type Prescription = { date?: string | null; sessionType?: string | null; tags?: readonly unknown[] | null };

// Ce qui n'est JAMAIS une séance de qualité, même tagué « Spécifique » : une sortie longue
// avec un bloc à allure marathon reste la sortie longue de la semaine, elle a son propre
// créneau et ne consomme pas le budget de qualité (voir `autoPlan`, étape 2).
const PAS_QUALITE = /long|repos|rest|r[ée]cup|footing|endurance|renfo|muscu|v[ée]lo|natation|marche/i;
// Les types écrits par le plan automatique (`VMA`, `Seuil`, `Spécifique`) et ceux que les
// autres écrivains de `coach_session` emploient (séance attribuée, plan rédigé par l'IA).
const QUALITE = /vma|seuil|sp[ée]cifique|tempo|fractionn|interval|c[ôo]tes?\b|threshold|fartlek/i;

/** La prescription était-elle une séance de qualité ? */
export function estQualitePrescrite(p: Prescription | null | undefined): boolean {
  const type = String(p?.sessionType ?? "");
  if (PAS_QUALITE.test(type)) return false;
  if (QUALITE.test(type)) return true;
  // Le tag canonique est en français (`PLAN_T.fr.tags.Qualité`) : c'est lui qui est stocké.
  return Array.isArray(p?.tags) && p.tags.some((t) => /^qualit[ée]$/i.test(String(t ?? "").trim()));
}

const JOUR = /^\d{4}-\d{2}-\d{2}/;
const t12 = (d: string) => Date.parse(`${d.slice(0, 10)}T12:00:00Z`);
/** Jours écoulés de `d` à `aujourdhui` (positif dans le passé). */
const ilYa = (d: string, aujourdhui: string) => Math.round((t12(aujourdhui) - t12(d)) / 86400000);

export type QualiteRecente = {
  /** Jours (AAAA-MM-JJ) où une qualité a eu lieu ou était due, du plus ancien au plus récent. */
  jours: string[];
  /** Parmi eux, les prescriptions qui n'ont PAS été faites — c'est ce qu'on dit à l'athlète. */
  manquees: string[];
};

/**
 * Les jours de qualité à compter dans la fenêtre qui se termine aujourd'hui.
 *
 * ⚠️ AUJOURD'HUI N'EST COMPTÉ QUE S'IL A ÉTÉ COURU. La prescription du jour est justement
 * celle que le plan est en train de réécrire : la compter, ce serait interdire au plan de
 * se republier à l'identique à 7 h après l'avoir fait à 4 h.
 *
 * `aujourdhui` EST FOURNI, jamais lu de l'horloge : le serveur est aux États-Unis, les
 * coureurs en France (voir `lib/time/fuseau`).
 */
export function qualiteRecente(
  prescrites: readonly (Prescription | null | undefined)[],
  dursFaits: readonly (string | null | undefined)[],
  aujourdhui: string,
): QualiteRecente {
  if (!JOUR.test(aujourdhui ?? "")) return { jours: [], manquees: [] };
  const fenetre = FENETRE_JOURS - 1;

  // Les séances dures courues, un jour compté une fois. On regarde un peu AVANT la
  // fenêtre : une séance courue il y a 8 jours peut encore honorer une prescription
  // d'il y a 6 jours — et ne compte pas elle-même, puisqu'elle est sortie de la fenêtre.
  const faits = [...new Set(dursFaits.map((d) => String(d ?? "").slice(0, 10)).filter((d) => JOUR.test(d)))]
    .filter((d) => { const n = ilYa(d, aujourdhui); return n >= 0 && n <= fenetre + DECALAGE_TOLERE_JOURS; })
    .sort();
  const dues = [...new Set(prescrites.filter(estQualitePrescrite)
    .map((p) => String(p?.date ?? "").slice(0, 10)).filter((d) => JOUR.test(d)))]
    .filter((d) => { const n = ilYa(d, aujourdhui); return n >= 1 && n <= fenetre; })
    .sort();

  // Appariement UN POUR UN, au plus proche. Sans le « un pour un », une seule séance
  // courue le mardi honorerait à la fois la prescription du lundi et celle du mercredi,
  // et la seconde pourrait être re-prescrite le lendemain, puis le surlendemain…
  const libres = [...faits];
  const manquees: string[] = [];
  for (const d of dues) {
    let k = -1, meilleur = Infinity;
    for (let j = 0; j < libres.length; j++) {
      const e = Math.abs(ilYa(libres[j], d));
      if (e <= DECALAGE_TOLERE_JOURS && e < meilleur) { meilleur = e; k = j; }
    }
    if (k >= 0) libres.splice(k, 1); else manquees.push(d);
  }
  const dansFenetre = faits.filter((d) => ilYa(d, aujourdhui) <= fenetre);
  return { jours: [...new Set([...dansFenetre, ...manquees])].sort(), manquees };
}

/**
 * Peut-on poser une qualité au jour `i` sans dépasser `plafond` séances sur AUCUNE fenêtre
 * de `FENETRE_JOURS` jours consécutifs ? `occupes` : les jours déjà pris, en indices
 * relatifs au plan (négatifs dans le passé).
 */
export function fenetreRespectee(i: number, occupes: readonly number[], plafond: number, fenetre = FENETRE_JOURS): boolean {
  if (plafond <= 0) return false;
  for (let debut = i - fenetre + 1; debut <= i; debut++) {
    const fin = debut + fenetre - 1;
    const dedans = occupes.filter((p) => p >= debut && p <= fin).length;
    if (dedans + 1 > plafond) return false;
  }
  return true;
}
