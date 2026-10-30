// ─────────────────────────────────────────────────────────────────────────────
//  L'AJUSTEMENT APPLIQUÉ EN UN GESTE (Premium) — l'IA propose, l'athlète décide,
//  le MOTEUR applique.
//
//  Cyprien, 30/10/2026 : « l'avis sur la semaine applique sa proposition en un geste ; la
//  séance est réellement modifiée, puis envoyée à la montre, toujours dans les limites de
//  sécurité du moteur ». Jusqu'ici l'avis n'était qu'un texte : la séance ne changeait pas.
//
//  ⚠️ LE PLAN EST RECONSTRUIT À CHAQUE PASSAGE DU COACH (jusqu'à toutes les dix minutes),
//  ET IL EFFACE TOUT LE FUTUR. Modifier une séance en base ne tiendrait donc pas jusqu'au
//  passage suivant. L'ajustement est ENREGISTRÉ à part (`TYPE_AJUSTEMENTS`), et le coach le
//  réapplique à chaque reconstruction, ici — avec ses garde-fous, à chaque fois.
//
//  ⚠️ AUCUN TEXTE NOUVEAU. « Décaler » et « échanger » intervertissent deux journées DÉJÀ
//  construites par le moteur ; « alléger » pose la récupération du moteur (25 min en Z1).
//  La montre analyse la prose française (`lib/watch/intervals`) : elle ne reçoit que des
//  séances qu'elle sait déjà lire.
//
//  ⚠️ UN AJUSTEMENT QUI NE VAUT PLUS TOMBE. Il retient le type des jours qu'il visait :
//  si le moteur a changé ces jours depuis (fatigue, nouvel objectif, séance manquée),
//  il n'est plus appliqué — on n'impose pas un déplacement pensé pour un autre plan.
// ─────────────────────────────────────────────────────────────────────────────
import type { PlanDay, PlanDayText } from "@/lib/ai/autoPlan";
import { PLAN_T } from "@/lib/ai/planI18n";
import { EST_QUALITE } from "@/lib/ai/ajustement";
import type { Lang } from "@/lib/i18n/translations";

/** Type de la ligne `notifications` qui garde les ajustements appliqués de l'athlète. */
export const TYPE_AJUSTEMENTS = "ajustements_appliques";

export type AjustementApplique = {
  /** Le jour visé, AAAA-MM-JJ. */
  date: string;
  action: "decaler" | "alleger" | "echanger";
  /** Pour « decaler » et « echanger » : l'autre jour, AAAA-MM-JJ. */
  vers?: string;
  /** Le type de chaque jour concerné au moment où l'athlète a appliqué. */
  types: Record<string, string>;
  /** Quand l'athlète a appliqué (ISO). */
  appliqueLe: string;
};

const AUTRES_LANGUES: Lang[] = ["en", "de", "es", "pt"];

/** La mention ajoutée au « pourquoi » d'une séance ajustée : l'athlète doit savoir d'où vient le changement. */
const NOTE: Record<Lang, { deplacee: string; allegee: string }> = {
  fr: { deplacee: "Jour changé à ta demande, sur proposition de ton coach IA.",
    allegee: "Allégée à ta demande, sur proposition de ton coach IA : une récupération au lieu de la séance prévue." },
  en: { deplacee: "Day changed at your request, on your AI coach's suggestion.",
    allegee: "Lightened at your request, on your AI coach's suggestion: a recovery run instead of the planned session." },
  de: { deplacee: "Tag auf deinen Wunsch geändert, auf Vorschlag deines KI-Coachs.",
    allegee: "Auf deinen Wunsch erleichtert, auf Vorschlag deines KI-Coachs: ein Regenerationslauf statt der geplanten Einheit." },
  es: { deplacee: "Día cambiado a petición tuya, por sugerencia de tu coach IA.",
    allegee: "Aligerada a petición tuya, por sugerencia de tu coach IA: un rodaje de recuperación en lugar de la sesión prevista." },
  pt: { deplacee: "Dia alterado a teu pedido, por sugestão do teu coach IA.",
    allegee: "Aliviada a teu pedido, por sugestão do teu coach IA: uma corrida de recuperação em vez da sessão prevista." },
};

/** Un jour de repos (le seul où l'on peut DÉCALER une séance). */
export const EST_REPOS = /^repos/i;
/** Ce qui ne s'allège pas : déjà du repos, déjà de la récupération, du renfo ou du vélo. */
const NON_ALLEGEABLE = /^(repos|r[ée]cup|renfo|v[ée]lo)/i;
/** Les jours durs : deux d'affilée sont ce que le moteur s'interdit, l'ajustement aussi. */
const EST_DUR = (type: string) => EST_QUALITE.test(type) || /sortie longue|^course$/i.test(type);

const texteDe = (d: PlanDay, l: Lang): PlanDayText =>
  l === "fr" ? { title: d.title, detail: d.detail, why: d.why, tags: d.tags } : d.i18n?.[l] ?? { title: d.title, detail: d.detail, why: d.why, tags: d.tags };

/** Récrit une journée dans les cinq langues (le français reste canonique, voir `PlanDay`). */
function reecrire(d: PlanDay, type: string, f: (l: Lang, avant: PlanDayText) => PlanDayText): PlanDay {
  return {
    ...d, type, ...f("fr", texteDe(d, "fr")),
    i18n: Object.fromEntries(AUTRES_LANGUES.map((l) => [l, f(l, texteDe(d, l))])) as Partial<Record<Lang, PlanDayText>>,
  };
}

/** Le contenu d'une journée (séance et textes) posé sur le créneau d'une autre (date, confirmation, moment). */
function contenuSur(contenu: PlanDay, creneau: PlanDay): PlanDay {
  const note = (l: Lang, avant: PlanDayText): PlanDayText => ({ ...avant, why: `${avant.why} ${NOTE[l].deplacee}`.trim() });
  return reecrire({ ...contenu, date: creneau.date, confirmed: creneau.confirmed, moment: creneau.moment }, contenu.type, note);
}

function joursDursAdjacents(week: readonly PlanDay[]): number {
  let n = 0;
  for (let i = 1; i < week.length; i++) if (EST_DUR(week[i].type) && EST_DUR(week[i - 1].type)) n++;
  return n;
}

const jourDeSemaine = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

export type OptionsAjustement = {
  /** Premier jour modifiable (le jour 0 est gelé quand une séance y est déjà enregistrée). */
  from: string;
  /** Budget qualité de la semaine : à zéro, seul un allègement est recevable. */
  qBudget: number;
  /** Jours de la semaine (0 = dimanche) où l'athlète peut courir ; `null` = inconnu. */
  joursCourables: number[] | null;
  /** Échauffement et retour au calme du moteur, en minutes. */
  warm: number;
  cool: number;
};

/** Applique UN ajustement à la semaine du moteur, ou dit pourquoi il ne vaut plus. */
export function appliquerAjustement(
  week: readonly PlanDay[], a: AjustementApplique, o: OptionsAjustement,
): { ok: true; week: PlanDay[] } | { ok: false; motif: string } {
  const jours = [a.date, ...(a.vers ? [a.vers] : [])];
  if (jours.some((j) => j < o.from)) return { ok: false, motif: "jour passé ou déjà couru" };
  const idx = jours.map((j) => week.findIndex((d) => d.date === j));
  if (idx.some((i) => i < 0)) return { ok: false, motif: "jour hors du plan" };
  if (jours.some((j) => week.filter((d) => d.date === j).length > 1)) return { ok: false, motif: "jour doublé" };
  // Le moteur a-t-il changé ces jours depuis que l'athlète a appliqué ?
  if (jours.some((j, k) => week[idx[k]].type !== a.types[j])) return { ok: false, motif: "le plan a changé depuis" };
  if (o.qBudget === 0 && a.action !== "alleger") return { ok: false, motif: "budget qualité à zéro : seul un allègement est recevable" };

  const out = week.map((d) => ({ ...d }));
  const [i, j] = idx;
  if (a.action === "alleger") {
    if (NON_ALLEGEABLE.test(week[i].type)) return { ok: false, motif: "rien à alléger ce jour-là" };
    out[i] = reecrire(week[i], "Récup", (l) => ({
      title: PLAN_T[l].recupTitre,
      detail: PLAN_T[l].recupDetail(o.warm, o.cool),
      why: NOTE[l].allegee,
      tags: [PLAN_T[l].tags["Récup"], PLAN_T[l].tags["Z1"]],
    }));
    return { ok: true, week: out };
  }

  if (!a.vers || j == null || a.vers === a.date) return { ok: false, motif: "second jour manquant" };
  if (EST_REPOS.test(week[i].type)) return { ok: false, motif: "on ne déplace pas un repos" };
  if (a.action === "decaler" && !EST_REPOS.test(week[j].type)) return { ok: false, motif: "on ne décale que vers un jour de repos" };
  if (a.action === "echanger" && EST_REPOS.test(week[j].type)) return { ok: false, motif: "un échange se fait entre deux séances" };
  // La séance déplacée ne tombe pas un jour où l'athlète ne court pas.
  if (o.joursCourables && !o.joursCourables.includes(jourDeSemaine(a.vers))) {
    return { ok: false, motif: "l'athlète ne court pas ce jour-là" };
  }
  out[i] = contenuSur(week[j], week[i]);
  out[j] = contenuSur(week[i], week[j]);
  // Les deux séances dures d'affilée que le moteur s'interdit, l'ajustement aussi.
  if (joursDursAdjacents(out) > joursDursAdjacents(week)) return { ok: false, motif: "deux séances dures d'affilée" };
  return { ok: true, week: out };
}

/**
 * Applique, dans l'ordre, les ajustements encore valables. Rend la semaine, ceux qui
 * tiennent (à conserver) et ceux qui sont tombés, avec leur motif (pour le journal).
 */
export function appliquerAjustements(
  week: readonly PlanDay[], liste: readonly AjustementApplique[], o: OptionsAjustement,
): { week: PlanDay[]; gardes: AjustementApplique[]; ecartes: { ajustement: AjustementApplique; motif: string }[] } {
  let courante = week.map((d) => ({ ...d }));
  const gardes: AjustementApplique[] = [], ecartes: { ajustement: AjustementApplique; motif: string }[] = [];
  for (const a of liste) {
    // Un ajustement dont tous les jours sont passés a fait son office : il sort sans bruit.
    if ([a.date, a.vers].filter(Boolean).every((d) => String(d) < o.from)) continue;
    const r = appliquerAjustement(courante, a, o);
    if (r.ok) { courante = r.week; gardes.push(a); } else ecartes.push({ ajustement: a, motif: r.motif });
  }
  return { week: courante, gardes, ecartes };
}
