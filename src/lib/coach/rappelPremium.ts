// ─────────────────────────────────────────────────────────────────────────────
//  « PREMIUM AURAIT CHANGÉ TON PLAN » — ce que la lecture complète change au plan Starter.
//
//  Starter lit l'essentiel : ni la VFC, ni la dérive cardiaque, ni la foulée
//  (`lectureDuCoach`). Pour lui, le coach bâtit AUSSI le plan complet, avec le même moteur
//  déterministe, et ce module compare les deux. L'athlète ne lit l'écart que s'il existe,
//  sur son calendrier, avec SES séances et SES chiffres.
//
//  ⚠️ RIEN D'INVENTÉ. C'est la stratégie choisie par Cyprien le 30/10/2026 : montrer
//  honnêtement, au moment où ça compte, ce que Premium aurait changé à SON plan. Aucun jour
//  qui ne diffère pas vraiment, aucun motif qui ne sorte pas du moteur (`reasonsAll`), aucun
//  chiffre qui ne soit pas le sien, aucune urgence. Aucune différence : aucun rappel.
//
//  Module PUR, sans base ni réseau : le calcul et l'écriture vivent dans
//  `lib/ai/rappelPremiumServeur`, l'affichage dans le bandeau « pourquoi ce plan ».
// ─────────────────────────────────────────────────────────────────────────────
import type { AthleteContext } from "@/lib/ai/coachContext";
import type { PlanDay } from "@/lib/ai/autoPlan";
import { PLAN_T } from "@/lib/ai/planI18n";
import { estQualitePrescrite } from "@/lib/coach/qualiteRecente";
import { formatDateCivile } from "@/lib/time/fuseau";
import { tr, nRaw, type I18nText } from "@/lib/i18n/multi";
import { TEXTES_RAPPEL } from "@/lib/coach/rappelPremiumI18n";

/** Une ligne par athlète dans `notifications` — aucune migration. */
export const TYPE_RAPPEL_PREMIUM = "rappel_premium";
/** À monter dès que la comparaison ou les textes changent : une ligne d'une version
 *  antérieure n'est plus affichée, et son empreinte ne vaut plus. */
export const VERSION_RAPPEL = 1;
/** Au-delà de deux motifs, la phrase devient une liste qu'on ne lit plus. */
const MOTIFS_MAX = 2;

type Niveau = AthleteContext["readiness"]["level"];
export type SensEcart = "allege" | "intensifie" | "ajuste";

export type JourEcart = {
  date: string;
  sens: SensEcart;
  /** `km` : la distance du corps de séance telle que le moteur l'écrit, `null` sans distance. */
  starter: { types: string[]; titre: I18nText; km: number | null };
  premium: { types: string[]; titre: I18nText; km: number | null };
};

export type EcartPremium = {
  /** Les jours qui diffèrent vraiment, dans l'ordre du calendrier. */
  jours: JourEcart[];
  /** Le verdict du jour, quand les deux lectures ne le rendent pas pareil. */
  verdict: { starter: Niveau; premium: Niveau } | null;
  /** Les motifs que le moteur n'a produits QU'EN lisant ce que Starter ne lit pas. */
  motifs: I18nText[];
};

/** Ce que le coach range dans `notifications.data`. */
export type DonneesRappel = {
  v: number;
  /** Jour civil du calcul : le calendrier ne montre que le rappel du jour. */
  jour: string;
  at: string;
  empreinte: string;
  ecart: EcartPremium | null;
  phrase: I18nText | null;
  detail: I18nText | null;
};

export type RappelAffiche = { phrase: I18nText; detail: I18nText | null };

/** Les séances d'une date, matin avant soir. */
const seances = (semaine: readonly PlanDay[], date: string) =>
  semaine.filter((d) => d.date === date).sort((a, b) => (a.moment ?? "").localeCompare(b.moment ?? ""));

/** Ce que l'athlète LIT d'une journée : type, titre et détail. Le « pourquoi » n'en est pas :
 *  il cite les motifs du verdict, et changerait sans que la séance change. */
const lu = (s: readonly PlanDay[]) => s.map((d) => `${d.moment ?? ""}|${d.type}|${d.title}|${d.detail}`).join("\n");

/** La charge d'une séance, pour dire dans quel sens Premium l'aurait changée. */
function charge(d: PlanDay): number {
  if (estQualitePrescrite({ sessionType: d.type, tags: d.tags })) return 3;
  if (/repos/i.test(d.type)) return 0;
  if (/r[ée]cup|renfo|v[ée]lo/i.test(d.type)) return 1;
  return 2;
}
const chargeDuJour = (s: readonly PlanDay[]) => Math.max(0, ...s.map(charge));
/** La marque que le moteur pose lui-même sur une séance raccourcie (titre français canonique). */
const allegee = (s: readonly PlanDay[]) => s.some((d) => d.title.endsWith(PLAN_T.fr.suffixeAllegee));

/**
 * Les kilomètres de la journée, lus là où le moteur les écrit (« Corps : ~6 km », titre et
 * détail français canoniques) — `null` quand aucune séance n'annonce de distance.
 */
function kmDuJour(s: readonly PlanDay[]): number | null {
  const km = s.flatMap((d) => [...d.detail.matchAll(/~(\d+(?:[.,]\d+)?) km/g)].map((m) => Number(m[1].replace(",", "."))));
  return km.length ? km.reduce((a, b) => a + b, 0) : null;
}

/** Dans quel sens Premium aurait changé la journée : sa charge, puis la marque « allégée »,
 *  puis la distance. Rien de tout ça ne bouge : la séance est seulement « ajustée ». */
function sensDuJour(s: readonly PlanDay[], p: readonly PlanDay[]): SensEcart {
  const cs = chargeDuJour(s), cp = chargeDuJour(p);
  if (cp !== cs) return cp < cs ? "allege" : "intensifie";
  if (allegee(p) !== allegee(s)) return allegee(p) ? "allege" : "intensifie";
  const ks = kmDuJour(s), kp = kmDuJour(p);
  if (ks != null && kp != null && ks !== kp) return kp < ks ? "allege" : "intensifie";
  return "ajuste";
}

/** Le titre de la journée dans chaque langue — le français est le titre canonique. */
const titres = (s: readonly PlanDay[]): I18nText =>
  tr((l) => s.map((d) => (l === "fr" ? d.title : d.i18n?.[l]?.title ?? d.title)).join(" + "));

/**
 * L'écart entre le plan Starter et le plan complet — `null` s'il n'y en a aucun.
 *
 * Les deux semaines doivent sortir du MÊME moteur au MÊME instant (`buildWeekPlan(…, même
 * date)`) et sur la même météo : sinon on comparerait deux jours ou deux bulletins.
 */
export function ecartPremium(o: {
  starter: { ctx: Pick<AthleteContext, "readiness">; semaine: readonly PlanDay[] };
  premium: { ctx: Pick<AthleteContext, "readiness">; semaine: readonly PlanDay[] };
  /** Premier jour encore modifiable (le `from` du coach) : un jour déjà couru ne se regrette pas. */
  depuis: string;
  /** La semaine que le calendrier AFFICHE (après les ajustements appliqués par l'athlète). Un
   *  jour qu'il voit autrement que le moteur ne se compare pas : on parlerait d'une séance
   *  qui n'est pas la sienne. */
  affichee?: readonly PlanDay[];
}): EcartPremium | null {
  const dates = [...new Set([...o.starter.semaine, ...o.premium.semaine].map((d) => d.date))]
    .filter((d) => d >= o.depuis)
    .sort();
  const jours: JourEcart[] = [];
  for (const date of dates) {
    const s = seances(o.starter.semaine, date);
    const p = seances(o.premium.semaine, date);
    if (lu(s) === lu(p)) continue;
    if (o.affichee && lu(seances(o.affichee, date)) !== lu(s)) continue;
    jours.push({
      date,
      sens: sensDuJour(s, p),
      starter: { types: s.map((d) => d.type), titre: titres(s), km: kmDuJour(s) },
      premium: { types: p.map((d) => d.type), titre: titres(p), km: kmDuJour(p) },
    });
  }
  const ns = o.starter.ctx.readiness.level, np = o.premium.ctx.readiness.level;
  const verdict = ns !== np ? { starter: ns, premium: np } : null;
  if (!jours.length && !verdict) return null;
  const vus = new Set((o.starter.ctx.readiness.reasonsAll ?? []).map((r) => r.fr));
  return { jours, verdict, motifs: (o.premium.ctx.readiness.reasonsAll ?? []).filter((r) => !vus.has(r.fr)) };
}

/**
 * Le jour mis en avant : le premier ALLÉGÉ, puis le premier rendu plus soutenu, sinon le
 * premier qui diffère. Une qualité retirée par la VFC déplace souvent un renforcement :
 * mettre en avant ce déplacement, avant le jour réellement protégé, ferait lire
 * « plus soutenue : VFC sous sa base » — vrai, et pourtant à l'envers de la décision.
 */
const jourEnAvant = (jours: readonly JourEcart[]): JourEcart | null =>
  jours.find((j) => j.sens === "allege") ?? jours.find((j) => j.sens === "intensifie") ?? jours[0] ?? null;

/**
 * Les motifs du verdict expliquent-ils CE jour ?
 *
 * La VFC agit sur la fraîcheur : elle retire ou garde une qualité, allège le jour même,
 * raccourcit la sortie longue. Elle ne choisit pas le TYPE d'une qualité (c'est la dérive
 * cardiaque, par le facteur limitant) et ne touche pas au renforcement (c'est la foulée).
 * Accoler « VFC sous sa base » à un renforcement que la cadence a changé, ce serait
 * inventer un motif : le jour est alors nommé sans « parce que ».
 */
function motifsExpliquent(j: JourEcart): boolean {
  if (j.sens !== "ajuste") return true;
  const memesTypes = j.starter.types.join("|") === j.premium.types.join("|");
  return memesTypes && !j.premium.types.some((t) => /renfo/i.test(t));
}

const sansPointFinal = (s: string) => s.trim().replace(/[.\s]+$/, "");
/** Un motif qui porte SES chiffres (« 41 contre 71 ms ») passe avant un constat générique. */
const sansChiffre = (m: I18nText) => (/\d/.test(m.fr) ? 0 : 1);

/** La phrase du rappel et sa ligne de détail, dans les 5 langues. */
export function textesRappel(e: EcartPremium): { phrase: I18nText; detail: I18nText | null } {
  const j = jourEnAvant(e.jours);
  const motifs = !j || motifsExpliquent(j)
    ? [...e.motifs].sort((a, b) => sansChiffre(a) - sansChiffre(b)).slice(0, MOTIFS_MAX)
    : [];
  const phrase = tr((l) => {
    const T = TEXTES_RAPPEL[l];
    const constat = j
      ? T[j.sens](formatDateCivile(j.date, l, { weekday: "long" }))
      : T.verdict(T.niveaux[e.verdict?.premium ?? "vert"], T.niveaux[e.verdict?.starter ?? "vert"]);
    return T.phrase(constat, motifs.map((m) => sansPointFinal(m[l] ?? m.fr)).join(", "));
  });
  if (!j) return { phrase, detail: null };
  const titreChange = j.premium.titre.fr !== j.starter.titre.fr;
  // Même titre, autre distance (la sortie longue raccourcie) : c'est la distance qui se dit.
  const kmP = j.premium.km, kmS = j.starter.km;
  const km = !titreChange && kmP != null && kmS != null && kmP !== kmS ? { p: kmP, s: kmS } : null;
  const autres = e.jours.length - 1;
  if (!titreChange && !km && autres === 0) return { phrase, detail: null };
  const detail = tr((l) => {
    const T = TEXTES_RAPPEL[l];
    return [
      titreChange ? T.auLieuDe(j.premium.titre[l], j.starter.titre[l])
        : km ? T.kmAuLieuDe(j.premium.titre[l], nRaw(km.p, l), nRaw(km.s, l)) : null,
      autres > 0 ? T.autresJours(autres) : null,
    ].filter(Boolean).join(" · ");
  });
  return { phrase, detail };
}

/**
 * Ce que le calendrier affiche — ou rien.
 *
 * Seulement le rappel calculé AUJOURD'HUI : celui de la veille décrit une semaine qui a
 * glissé depuis. Et seulement s'il porte une phrase : une ligne sans écart garde
 * l'empreinte du dernier calcul, elle n'a rien à dire.
 */
export function rappelAffichable(data: unknown, jour: string): RappelAffiche | null {
  const d = (data ?? null) as Partial<DonneesRappel> | null;
  if (!d || d.v !== VERSION_RAPPEL || d.jour !== jour || !d.phrase?.fr) return null;
  return { phrase: d.phrase, detail: d.detail?.fr ? d.detail : null };
}
