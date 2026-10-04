/**
 * LES FICHES D'INDICATEURS — fonctions PURES (04/10/2026).
 *
 * Chaque fiche part des MÊMES fonctions et des MÊMES séances que la carte du tableau de
 * bord (les 40 dernières, comme `app/dashboard/page.tsx`) : la page détaillée ne peut pas
 * annoncer un autre chiffre que la carte qui y mène. L'historique long (`historique`,
 * `vfc`) ne sert qu'aux graphiques. Aucun texte n'est inventé : tout découle des chiffres.
 */
import type { Lang } from "@/lib/i18n/translations";
import type { HRVData, Workout } from "@/types";
import { TEXTES } from "./textes";
import type { CleIndicateur, Composante, Fiche, Point, Ton } from "./types";
import { computeDiscipline, statsVfc, isQualityWorkout } from "@/lib/dashboard/discipline";
import { computeForme, socleDesSeances } from "@/lib/dashboard/forme";
import { computeLoad, type SeanceCharge } from "@/lib/dashboard/charge";
import { computeHrZones } from "@/lib/dashboard/zones";
import { computeWeeklyTrend } from "@/lib/dashboard/semaines";
import { dansFenetre } from "@/lib/dashboard/fenetre";
import { loadRisk, chargesQuotidiennes, predictRaceSec, raceProjection, fmtTime, fmtPaceSec } from "@/lib/running/fitness";
import { vdotDeVma, preparationLongue, facteurSocle } from "@/lib/running/vdot";
import { robustWeeklyKm, demonstratedWeeklyKm } from "@/lib/running/volume";
import { isRun } from "@/lib/intervals/sport";
import { cleanActivityName } from "@/lib/utils/activityName";
import type { SourceVma } from "@/lib/dashboard/vmaAffichee";

export type DonneesFiche = {
  lang: Lang;
  /** Le jour civil de l'athlète, « AAAA-MM-JJ ». */
  aujourdhui: string;
  maintenant?: number;
  /** Les 40 dernières séances — EXACTEMENT celles de la carte. */
  seances: Workout[];
  /** ~4 mois de séances, pour les graphiques seulement. */
  historique: Workout[];
  /** Mesures de VFC, de la plus récente à la plus ancienne. */
  vfc: Pick<HRVData, "date" | "hrv_ms" | "physiological_state">[];
  /** Nuits, de la plus récente à la plus ancienne. */
  sommeil: { date: string; sleep_score: number | null; total_sleep_min: number | null }[];
  charge: SeanceCharge[];
  vma: { vma: number; source: SourceVma | null };
  objectif: { race: string; distanceKm: number; raceDate: string; targetSeconds: number; targetTime: string } | null;
  plan: { start_date?: string | null; created_at?: string | null; race_date?: string | null } | null;
  fcRepos: number | null;
};

const LOC: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };
const nb = (lang: Lang, x: number, d = 0) =>
  (Number.isFinite(x) ? x : 0).toLocaleString(LOC[lang], { minimumFractionDigits: d, maximumFractionDigits: d });
const signe = (lang: Lang, x: number, d = 0) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${nb(lang, Math.abs(x), d)}`;
const midi = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
const dateLongue = (lang: Lang, iso: string) => new Intl.DateTimeFormat(LOC[lang], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(midi(iso));
const dateCourte = (lang: Lang, iso: string) => new Intl.DateTimeFormat(LOC[lang], { day: "numeric", month: "long", timeZone: "UTC" }).format(midi(iso));
const dateMini = (lang: Lang, iso: string) => new Intl.DateTimeFormat(LOC[lang], { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(midi(iso));
const decale = (iso: string, n: number) => { const d = midi(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const joursEntre = (de: string, a: string) => Math.round((midi(a).getTime() - midi(de).getTime()) / 864e5);
/** Un écart de temps lisible : « 22 s », « 1 min », « 1 min 05 », au-delà le format des chronos. */
export const ecartTemps = (sec: number) => {
  const s = Math.round(Math.abs(Number.isFinite(sec) ? sec : 0));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, "0")}` : ""}` : fmtTime(s);
};
const tonScore = (n: number): Ton => (n >= 80 ? "excellent" : n >= 60 ? "bon" : n >= 40 ? "moyen" : "alerte");
const dansPlage = (v: number, de: number, a: number) => v >= de && v <= a;

/** Ce que la carte calcule, rassemblé une fois : sommeil frais, discipline, forme, VFC. */
function contexte(d: DonneesFiche) {
  const maintenant = d.maintenant ?? Date.now();
  const s0 = d.sommeil[0];
  // Même règle que la carte : une nuit de plus de deux jours ne décrit plus la forme du jour.
  const sommeilFrais = s0 && s0.date && maintenant - new Date(`${s0.date}T00:00:00`).getTime() <= 2 * 86400000 && s0.sleep_score != null
    ? { sleep_score: Number(s0.sleep_score), total_sleep_min: Number(s0.total_sleep_min) || 0 } : null;
  const etat = d.vfc[0]?.physiological_state ?? "optimal";
  const disc = computeDiscipline(d.seances, d.vfc.slice(0, 14) as HRVData[], sommeilFrais, etat);
  const forme = computeForme(d.seances, d.vma.vma, disc.recovery, disc.consistency,
    d.objectif ? { distanceKm: d.objectif.distanceKm ?? null, targetSeconds: d.objectif.targetSeconds ?? null } : null);
  const vfc = statsVfc(d.vfc, maintenant);
  return { maintenant, sommeilFrais, disc, forme, vfc };
}

function reperesActifs(lignes: [string, string][], tons: Ton[], actif: number) {
  return lignes.map(([libelle, plage], i) => ({ libelle, plage, ton: tons[i], actif: i === actif }));
}

// ── 1. SCORE DE FORME ────────────────────────────────────────────────────────────
function forme(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.forme, L = d.lang;
  const { forme: f, disc } = contexte(d);
  const base: Fiche = { cle: "forme", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi };
  if (!f.hasData) return { ...base, vide: T.commun.vide };
  const x = f.details;
  const comps = [
    { cle: "endurance", libelle: t.endurance, val: f.endurance, detail: t.dEndurance(nb(L, x.plusLongueKm, 1), nb(L, x.refLongueKm), nb(L, x.volumeMoyenKm, 1), nb(L, x.refVolumeKm)) },
    { cle: "vitesse", libelle: t.vitesse, val: f.speed, detail: x.modeVitesse === "objectif" && x.chronoPreditSec && d.objectif
      ? t.dVitesseObjectif(fmtTime(x.chronoPreditSec), d.objectif.targetTime) : t.dVitesseVma(nb(L, d.vma.vma, 1)) },
    { cle: "recuperation", libelle: t.recuperation, val: f.recovery, detail: t.dRecup(disc.details.sommeil != null ? nb(L, disc.details.sommeil) : null, disc.details.signalVfc != null ? nb(L, disc.details.signalVfc) : null) },
    { cle: "regularite", libelle: t.regularite, val: f.regularity, detail: t.dRegularite(disc.details.seances, disc.details.cibleSeances) },
  ];
  const tries = [...comps].sort((a, b) => b.val - a.val);
  const fort = tries[0], faible = tries[tries.length - 1];
  const plat = fort.val - faible.val < 5;
  const rate = T.rate(f.total);
  const jours = d.objectif ? joursEntre(d.aujourdhui, d.objectif.raceDate) : null;
  const conseils: string[] = [];
  // Le conseil vise TOUJOURS le point faible que le verdict désigne (sinon la page dirait
  // « à travailler : endurance » puis « profil équilibré »), puis le suivant s'il est sous 80.
  const aTravailler = tries.slice().reverse().filter((c, i) => i === 0 || c.val < 80).slice(0, 2);
  if (plat) conseils.push(t.conseilEquilibre);
  else for (const c of aTravailler) {
    if (c.cle === "endurance") conseils.push(jours != null && jours >= 0 && jours <= 21 ? t.conseilEnduranceAffutage : t.conseilEndurance(nb(L, x.refLongueKm)));
    if (c.cle === "vitesse") conseils.push(t.conseilVitesse);
    if (c.cle === "recuperation") conseils.push(t.conseilRecuperation);
    if (c.cle === "regularite") conseils.push(t.conseilRegularite);
  }
  if (!conseils.length) conseils.push(t.conseilEquilibre);
  const nRuns = d.seances.filter((w) => isRun(w.sport) && dansFenetre(w.date, 42)).length;
  return {
    ...base,
    valeur: String(f.total), unite: "/100",
    statut: { libelle: rate, ton: tonScore(f.total) },
    verdict: t.verdict(String(f.total), rate, `${fort.libelle} (${fort.val} %)`, plat ? null : `${faible.libelle} (${faible.val} %)`),
    base: T.commun.seances(nRuns, 42),
    composantes: comps.map((c): Composante => ({ libelle: c.libelle, valeur: String(c.val), unite: "%", part: c.val, ton: tonScore(c.val), detail: c.detail })),
    calcul: [
      t.cTotal(String(f.endurance), String(f.speed), String(f.recovery), String(f.regularity), String(f.total)),
      t.cEndurance(nb(L, x.plusLongueKm, 1), nb(L, x.refLongueKm), nb(L, x.volumeMoyenKm, 1), nb(L, x.refVolumeKm), String(f.endurance)),
      x.modeVitesse === "objectif" && x.chronoPreditSec && d.objectif
        ? t.cVitesseObjectif(d.objectif.targetTime, fmtTime(x.chronoPreditSec), String(f.speed))
        : t.cVitesseVma(nb(L, d.vma.vma, 1), String(f.speed)),
      t.cRecup(String(f.recovery)),
      t.cRegularite(disc.details.seances, disc.details.cibleSeances, String(f.regularity)),
    ],
    reperes: { titre: T.commun.reperes, lignes: reperesActifs(t.reperes, ["excellent", "bon", "moyen", "alerte"], f.total >= 80 ? 0 : f.total >= 60 ? 1 : f.total >= 40 ? 2 : 3) },
    conseils,
    liens: [{ libelle: T.commun.voirPlan, href: "/dashboard/calendrier" }, { libelle: T.commun.voirCours, href: "/dashboard/cours" }],
  };
}

// ── 2. VFC ───────────────────────────────────────────────────────────────────────
function vfc(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.vfc, L = d.lang;
  const { vfc: s, sommeilFrais } = contexte(d);
  const base: Fiche = { cle: "vfc", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi,
    sources: ["Plews D. J. et al. — Training adaptation and heart rate variability in elite endurance athletes, Sports Medicine, 2013.", "Kiviniemi A. M. et al. — Endurance training guided individually by daily heart rate variability, Eur J Appl Physiol, 2007."] };
  if (s.dernier == null || s.base == null) return { ...base, vide: T.commun.vide };
  const ecart = s.ecart ?? 0, pct = (ecart / s.base) * 100, seuil = s.base * 0.94;
  const etat: "ancienne" | "auDessus" | "normale" | "sous" = !s.fraiche ? "ancienne" : ecart >= 0 ? "auDessus" : pct >= -6 ? "normale" : "sous";
  const statut = { ancienne: { libelle: t.ancienne, ton: "neutre" as Ton }, auDessus: { libelle: t.auDessus, ton: "excellent" as Ton }, normale: { libelle: t.normale, ton: "bon" as Ton }, sous: { libelle: t.sous, ton: "alerte" as Ton } }[etat];
  const v = nb(L, s.dernier), b = nb(L, s.base), e = nb(L, Math.abs(ecart));
  const verdict = etat === "ancienne" ? t.verdictAncienne(v, s.jours ?? 0)
    : etat === "auDessus" ? t.verdictAuDessus(v, e, b) : etat === "normale" ? t.verdictNormale(v, e, b) : t.verdictSous(v, e, b);
  // Le graphe : jusqu'à 60 mesures, et la moyenne glissante de 7 mesures.
  const mesures = d.vfc.slice(0, 60).filter((h) => h.hrv_ms != null).reverse();
  const points: Point[] = mesures.map((h) => ({ date: dateMini(L, h.date), valeur: Number(h.hrv_ms) }));
  const moyenne: Point[] = points.map((p, i) => {
    const fen = points.slice(Math.max(0, i - 6), i + 1);
    return { date: p.date, valeur: Math.round((fen.reduce((a, x) => a + x.valeur, 0) / fen.length) * 10) / 10 };
  });
  const composantes: Composante[] = [
    { libelle: t.base, valeur: b, unite: "ms", ton: "neutre", detail: t.dBase(s.n) },
    { libelle: t.ecart, valeur: signe(L, ecart), unite: "ms", ton: statut.ton, detail: t.dEcart(signe(L, pct, 1)) },
  ];
  if (d.fcRepos && d.fcRepos > 0) composantes.push({ libelle: t.fcRepos, valeur: nb(L, d.fcRepos), unite: "bpm", ton: "neutre", detail: t.dFcRepos });
  if (sommeilFrais) {
    const h = `${Math.floor(sommeilFrais.total_sleep_min / 60)} h ${String(sommeilFrais.total_sleep_min % 60).padStart(2, "0")}`;
    composantes.push({ libelle: t.sommeil, valeur: nb(L, sommeilFrais.sleep_score), unite: "/100", ton: tonScore(sommeilFrais.sleep_score), detail: t.dSommeil(h, nb(L, sommeilFrais.sleep_score)) });
  }
  return {
    ...base,
    valeur: v, unite: "ms", statut, verdict,
    composantes,
    graphe: {
      titre: t.graphe, unite: "ms",
      lignes: [{ libelle: t.ligneMesure, couleur: "#059669", points, aire: true }, { libelle: t.ligneMoyenne, couleur: "#27272a", points: moyenne }],
      bande: { bas: Math.round(seuil * 10) / 10, haut: Math.round(s.base * 1.06 * 10) / 10, libelle: t.bande },
      repere: { valeur: s.base, libelle: t.base },
    },
    calcul: [t.cBase(s.n, b), t.cEcart(v, b, signe(L, ecart), signe(L, pct, 1)), t.cSeuil(nb(L, seuil))],
    reperes: { titre: T.commun.reperes, lignes: reperesActifs(t.reperes(b, nb(L, seuil)), ["excellent", "bon", "alerte"], etat === "auDessus" ? 0 : etat === "normale" ? 1 : etat === "sous" ? 2 : -1) },
    conseils: [etat === "ancienne" ? t.conseilAncienne : etat === "auDessus" ? t.conseilAuDessus : etat === "normale" ? t.conseilNormale : t.conseilSous, t.conseilGeneral],
    liens: [{ libelle: T.commun.voirSante, href: "/dashboard/health" }],
  };
}

// ── 3. VITESSE & PRÉDICTIONS ─────────────────────────────────────────────────────
const DISTANCES = [{ l: "3 km", km: 3 }, { l: "5 km", km: 5 }, { l: "10 km", km: 10 }, { l: "15 km", km: 15 }, { l: "Semi", km: 21.0975 }, { l: "Marathon", km: 42.195 }];

function vitesse(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.vitesse, L = d.lang;
  const vma = d.vma.vma;
  const base: Fiche = { cle: "vitesse", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi,
    sources: ["Daniels J. & Gilbert J. — Oxygen Power: Performance Tables for Distance Runners, 1979.", "Daniels J. — Daniels' Running Formula, Human Kinetics.", "Vickers A. J. & Vertosick E. A. — An empirical study of race times in recreational endurance runners, BMC Sports Sci Med Rehabil, 2016."] };
  if (!(vma > 0)) return { ...base, vide: T.commun.vide };
  const src = d.vma.source;
  const libelleSource = src?.type === "seances" && src.date ? t.srcSeances(dateCourte(L, src.date), nb(L, src.km ?? 0, 1))
    : src?.type === "test" && src.date ? t.srcTest(dateCourte(L, src.date))
    : src?.type === "courbe" ? t.srcCourbe : src?.type === "vo2max" ? t.srcVo2 : t.srcAucune;
  const vdot = vdotDeVma(vma) ?? 0;
  const socle = socleDesSeances(d.seances);
  const pret = Math.round(preparationLongue(socle) * 100);
  const penalite = (facteurSocle(42.195, socle) - 1) * 100;
  const lignesPred = DISTANCES.map(({ l, km }) => {
    const sec = predictRaceSec(vma, km, socle);
    const kmh = km / (sec / 3600);
    return { cellules: [l === "Semi" && L !== "fr" ? (L === "en" ? "Half" : L === "de" ? "Halbmarathon" : L === "es" ? "Medio" : "Meia") : l, fmtTime(sec), `${fmtPaceSec(sec / km)}/km`, `${nb(L, (kmh / vma) * 100)} %`] };
  });
  const allure = (pct: number) => fmtPaceSec(3600 / (vma * pct));
  const marathonSec = predictRaceSec(vma, 42.195, socle);
  return {
    ...base,
    valeur: nb(L, vma, 1), unite: "km/h",
    statut: { libelle: libelleSource, ton: src?.type === "test" ? "excellent" : "neutre" },
    // En milieu de phrase, la source perd sa majuscule — sauf un sigle (« MAS-Test »).
    verdict: t.verdict(nb(L, vma, 1), /^[A-ZÀ-Ý](?![A-ZÀ-Ý])/.test(libelleSource) ? libelleSource[0].toLowerCase() + libelleSource.slice(1) : libelleSource, nb(L, vdot, 1)),
    composantes: [
      { libelle: "VDOT", valeur: nb(L, vdot, 1), ton: "neutre", detail: t.cVdot(nb(L, vdot, 1)) },
      { libelle: t.allureMarathon, valeur: fmtPaceSec(marathonSec / 42.195), unite: "/km", ton: "neutre", detail: fmtTime(marathonSec) },
    ],
    tableaux: [
      { titre: t.tPredictions, colonnes: [t.cDistance, t.cChrono, t.cAllure, t.cPctVma], lignes: lignesPred, note: t.notePredictions(String(pret)) },
      {
        titre: t.tAllures, colonnes: [t.cSeance, t.cPctVma, t.cAllure],
        lignes: [
          ...t.allures.map(([nom, bas, haut]) => ({ cellules: [nom, `${Math.round(bas * 100)} – ${Math.round(haut * 100)} %`, `${allure(bas)} – ${allure(haut)}/km`] })),
          { cellules: [t.allureMarathon, `${nb(L, (42.195 / (marathonSec / 3600) / vma) * 100)} %`, `${fmtPaceSec(marathonSec / 42.195)}/km`], actif: true },
        ],
      },
    ],
    calcul: [
      t.cVma,
      t.cVdot(nb(L, vdot, 1)),
      socle.sortieLongueKm || socle.volumeHebdoKm
        ? t.cSocle(nb(L, socle.sortieLongueKm ?? 0, 1), nb(L, socle.volumeHebdoKm ?? 0), String(pret), `+${nb(L, penalite, 1)} %`)
        : t.cSocleInconnu,
    ],
    conseils: [...(src?.type !== "test" ? [t.conseilTest] : []), t.conseilProgres, ...(pret < 100 ? [t.conseilLong] : [])],
    liens: [{ libelle: T.commun.voirPlan, href: "/dashboard/calendrier" }, { libelle: T.commun.voirCours, href: "/dashboard/cours" }],
  };
}

// ── 4. SCORE DISCIPLINE ──────────────────────────────────────────────────────────
function discipline(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.discipline, L = d.lang;
  const { disc, maintenant } = contexte(d);
  const base: Fiche = { cle: "discipline", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi,
    sources: ["Seiler S. — What is best practice for training intensity and duration distribution in endurance athletes? IJSPP, 2010."] };
  if (!disc.hasData) return { ...base, vide: T.commun.vide };
  const x = disc.details;
  const comps = [
    { cle: "precision", libelle: t.precision, poids: 40, val: disc.precision, detail: t.dPrecision(x.faciles, x.seances, nb(L, x.seances ? (x.faciles / x.seances) * 100 : 0)) },
    { cle: "assiduite", libelle: t.assiduite, poids: 40, val: disc.consistency, detail: t.dAssiduite(x.seances, x.cibleSeances) },
    { cle: "recuperation", libelle: t.recuperation, poids: 20, val: disc.recovery, detail: t.dRecup(x.sommeil != null ? nb(L, x.sommeil) : null, x.signalVfc != null ? nb(L, x.signalVfc) : null) },
  ];
  const faible = [...comps].sort((a, b) => a.val - b.val)[0];
  // Les séances de la fenêtre, telles que le score les a classées — même filtre que lui.
  const recentes = d.seances.filter((w) => maintenant - new Date(w.date).getTime() <= 14 * 86400000);
  const conseils: string[] = [];
  for (const c of [...comps].sort((a, b) => a.val - b.val).filter((c) => c.val < 80)) {
    if (c.cle === "precision") conseils.push(x.seances && x.faciles / x.seances < 0.8 ? t.conseilPrecisionDur : t.conseilPrecisionFacile);
    if (c.cle === "assiduite") conseils.push(t.conseilAssiduite);
    if (c.cle === "recuperation") conseils.push(t.conseilRecup);
  }
  return {
    ...base,
    valeur: String(disc.total), unite: "%",
    statut: { libelle: t.reperes[disc.total >= 80 ? 0 : disc.total >= 60 ? 1 : 2][0], ton: tonScore(disc.total) },
    verdict: disc.total >= 80 && faible.val >= 80 ? t.verdictTop(String(disc.total)) : t.verdict(String(disc.total), `${faible.libelle.toLowerCase()} (${faible.val} %)`),
    base: T.commun.seances(x.seances, 14),
    composantes: comps.map((c): Composante => ({ libelle: `${c.libelle} · ${t.poids(c.poids)}`, valeur: String(c.val), unite: "%", part: c.val, ton: tonScore(c.val), detail: c.detail })),
    tableaux: recentes.length ? [{
      titre: t.tSeances, colonnes: [t.cDate, t.cSeance, t.cType],
      lignes: recentes.map((w) => ({ cellules: [dateMini(L, w.date), `${cleanActivityName(w.title) || "—"}${w.distance_km ? ` · ${nb(L, Number(w.distance_km), 1)} km` : ""}`, isQualityWorkout(w) ? t.qualite : t.facile], actif: isQualityWorkout(w) })),
    }] : undefined,
    calcul: [t.cTotal(String(disc.precision), String(disc.consistency), String(disc.recovery), String(disc.total)), t.cPrecision, t.cAssiduite(x.cibleSeances)],
    reperes: { titre: T.commun.reperes, lignes: reperesActifs(t.reperes, ["excellent", "bon", "alerte"], disc.total >= 80 ? 0 : disc.total >= 60 ? 1 : 2) },
    conseils: conseils.length ? conseils : [TEXTES[d.lang].forme.conseilEquilibre],
    liens: [{ libelle: T.commun.voirPlan, href: "/dashboard/calendrier" }],
  };
}

// ── 5. OBJECTIF PRINCIPAL ────────────────────────────────────────────────────────
function objectif(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.objectif, L = d.lang;
  const base: Fiche = { cle: "objectif", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi };
  const o = d.objectif;
  const jours = o ? joursEntre(d.aujourdhui, o.raceDate) : null;
  if (!o || jours == null || jours < 0) return { ...base, vide: t.vide, liens: [{ libelle: T.commun.definirObjectif, href: "/dashboard" }] };
  const vma = d.vma.vma;
  const socle = socleDesSeances(d.seances);
  const p = vma > 0 ? raceProjection(vma, o.distanceKm, o.targetSeconds, jours / 7, null, socle) : null;
  const statut = p ? { acquis: { libelle: t.acquis, ton: "excellent" as Ton }, atteignable: { libelle: t.atteignable, ton: "bon" as Ton }, ambitieux: { libelle: t.ambitieux, ton: "moyen" as Ton }, irrealiste: { libelle: t.irrealiste, ton: "alerte" as Ton } }[p.verdict] : undefined;
  const phase = jours <= 21 ? t.phaseAffutage : jours <= 56 ? t.phaseSpecifique : t.phaseFoncier;
  // Début de préparation : même règle que la carte (plan, sinon 16 semaines avant la course).
  const debut = d.plan?.start_date ? String(d.plan.start_date).slice(0, 10)
    : d.plan?.created_at ? String(d.plan.created_at).slice(0, 10) : decale(o.raceDate, -112);
  const total = joursEntre(debut, o.raceDate), faits = joursEntre(debut, d.aujourdhui);
  const progression = total > 0 ? Math.max(0, Math.min(100, Math.round((faits / total) * 100))) : 0;
  const composantes: Composante[] = [
    { libelle: t.vise, valeur: o.targetTime, ton: "neutre", detail: t.dVise(fmtPaceSec(o.targetSeconds / o.distanceKm)) },
  ];
  if (p) {
    const ecart = o.targetSeconds - p.nowSec;
    // L'écart d'ALLURE, au dixième sous 10 s/km : 22 s sur un marathon font 0,5 s/km, pas « 1 s ».
    const parKm = Math.abs(ecart / o.distanceKm);
    composantes.push(
      { libelle: t.predit, valeur: fmtTime(p.nowSec), ton: statut?.ton ?? "neutre", detail: t.dPredit(fmtPaceSec(p.nowSec / o.distanceKm)) },
      { libelle: t.jourJ, valeur: fmtTime(p.projectedSec), ton: "neutre", detail: t.dJourJ(nb(L, (1 - p.projectedSec / p.nowSec) * 100, 1)) },
      { libelle: t.allure, valeur: fmtPaceSec(o.targetSeconds / o.distanceKm), unite: "/km", ton: ecart < 0 ? "moyen" : "bon", detail: t.dAllure((ecart < 0 ? t.ecartPlus : t.ecartMoins)(parKm < 10 ? `${nb(L, parKm, 1)} s` : ecartTemps(parKm), ecartTemps(ecart))) },
    );
  }
  composantes.push({ libelle: t.preparation, valeur: String(progression), unite: "%", part: progression, ton: "neutre", detail: `${phase} · ${t.dPreparation(dateCourte(L, debut))}` });
  const conseils = [jours <= 21 ? t.conseilAffutage : jours <= 56 ? t.conseilSpecifique : t.conseilFoncier];
  if (p && (p.verdict === "ambitieux" || p.verdict === "irrealiste")) conseils.push(t.conseilAmbitieux);
  if (jours <= 42) conseils.push(t.conseilNutrition);
  return {
    ...base,
    valeur: `J-${jours}`,
    statut,
    verdict: t.verdict(o.race, dateLongue(L, o.raceDate), jours, o.targetTime, p ? fmtTime(p.nowSec) : "—"),
    composantes,
    calcul: [t.cPrediction, t.cProjection, t.cVerdict],
    conseils,
    liens: [{ libelle: T.commun.voirPlan, href: "/dashboard/calendrier" }, { libelle: T.commun.voirNutrition, href: "/dashboard/health?onglet=nutrition" }, { libelle: T.commun.voirPps, href: "/dashboard/pps" }],
  };
}

// ── 6. CHARGE & AFFÛTAGE (CTL / ATL / TSB) ───────────────────────────────────────
function charge(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.charge, L = d.lang;
  const base: Fiche = { cle: "charge", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi,
    sources: ["Banister E. W. et al. — A systems model of training for athletic performance, Aust J Sports Med, 1975.", "Allen H. & Coggan A. — Training and Racing with a Power Meter (CTL / ATL / TSB)."] };
  if (!d.charge.length) return { ...base, vide: T.commun.vide };
  const { ctl, atl, tsb, history, estimees } = computeLoad(d.charge, d.aujourdhui);
  // Mêmes seuils que la carte (TaperingWidget).
  const statut = tsb >= 10 ? { libelle: t.optimal, ton: "excellent" as Ton } : tsb >= 0 ? { libelle: t.montee, ton: "bon" as Ton }
    : tsb >= -10 ? { libelle: t.equilibre, ton: "moyen" as Ton } : { libelle: t.surcharge, ton: "alerte" as Ton };
  const course = d.objectif?.raceDate ?? d.plan?.race_date ?? null;
  const jours = course ? joursEntre(d.aujourdhui, course) : null;
  const dates = history.map((_, i) => dateMini(L, decale(d.aujourdhui, -(history.length - 1 - i))));
  const conseils: string[] = [tsb < -10 ? t.conseilSurcharge : tsb < 0 ? t.conseilConstruction : t.conseilFrais];
  if (jours != null && jours > 0 && jours <= 21) conseils.push(t.conseilCourse);
  return {
    ...base,
    valeur: signe(L, Math.round(tsb)), statut,
    verdict: t.verdict(signe(L, Math.round(tsb)), statut.libelle) + (jours != null && jours > 0 && jours <= 21 ? t.verdictCourse(jours, "+10 / +25") : ""),
    composantes: [
      { libelle: t.ctl, valeur: nb(L, Math.round(ctl)), ton: "neutre", detail: t.dCtl },
      { libelle: t.atl, valeur: nb(L, Math.round(atl)), ton: "neutre", detail: t.dAtl },
      { libelle: t.tsb, valeur: signe(L, Math.round(tsb)), ton: statut.ton, detail: t.dTsb },
    ],
    graphe: {
      titre: t.graphe, unite: "TSS",
      lignes: [
        { libelle: t.ctl, couleur: "#2563eb", points: history.map((h, i) => ({ date: dates[i], valeur: Math.round(h.ctl * 10) / 10 })), aire: true },
        { libelle: t.atl, couleur: "#ea580c", points: history.map((h, i) => ({ date: dates[i], valeur: Math.round(h.atl * 10) / 10 })) },
      ],
    },
    calcul: [t.cEwma, t.cTsb(nb(L, Math.round(ctl)), nb(L, Math.round(atl)), signe(L, Math.round(tsb))), ...(estimees ? [t.cEstimees(estimees)] : [])],
    reperes: { titre: T.commun.reperes, lignes: reperesActifs(t.reperes, ["excellent", "bon", "moyen", "alerte"], tsb >= 10 ? 0 : tsb >= 0 ? 1 : tsb >= -10 ? 2 : 3) },
    conseils,
    liens: [{ libelle: T.commun.voirPlan, href: "/dashboard/calendrier" }],
  };
}

// ── 7. CHARGE AIGUË / CHRONIQUE ──────────────────────────────────────────────────
function acwr(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.acwr, L = d.lang;
  const base: Fiche = { cle: "acwr", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi,
    sources: ["Gabbett T. J. — The training–injury prevention paradox, Br J Sports Med, 2016.", "Foster C. — Monitoring training in athletes with reference to overtraining syndrome, Med Sci Sports Exerc, 1998."] };
  const r = loadRisk(d.seances);
  if (!(r.acwr > 0)) return { ...base, vide: T.commun.vide };
  const q = chargesQuotidiennes(d.seances, 28, d.aujourdhui);
  const sept = q.slice(0, 7).reduce((a, b) => a + b, 0), moyenne = q.reduce((a, b) => a + b, 0) / 4;
  const z = r.acwr < 0.8 ? 0 : r.acwr <= 1.3 ? 1 : r.acwr <= 1.5 ? 2 : 3;
  const zones = [{ l: t.sous, ton: "moyen" as Ton }, { l: t.optimal, ton: "excellent" as Ton }, { l: t.vigilance, ton: "moyen" as Ton }, { l: t.risque, ton: "alerte" as Ton }];
  return {
    ...base,
    valeur: nb(L, r.acwr, 2), statut: { libelle: zones[z].l, ton: zones[z].ton },
    verdict: t.verdict(nb(L, r.acwr, 2), zones[z].l, nb(L, r.acwr * 100)),
    composantes: [
      { libelle: t.sept, valeur: nb(L, Math.round(sept)), unite: "TSS", ton: "neutre", detail: t.dSept },
      { libelle: t.moyenne, valeur: nb(L, Math.round(moyenne)), unite: "TSS", ton: "neutre", detail: t.dMoyenne },
      { libelle: t.monotonie, valeur: nb(L, r.monotony, 1), ton: r.monotony > 2 ? "moyen" : "neutre", detail: t.dMonotonie(nb(L, r.monotony, 1)) },
    ],
    graphe: { titre: t.graphe, unite: "TSS", barres: true, lignes: [{ libelle: "TSS", couleur: "#059669", points: q.slice().reverse().map((v, i) => ({ date: dateMini(L, decale(d.aujourdhui, -(27 - i))), valeur: Math.round(v) })) }] },
    calcul: [t.cRatio(nb(L, Math.round(sept)), nb(L, Math.round(moyenne)), nb(L, r.acwr, 2)), t.cTss],
    reperes: { titre: T.commun.reperes, lignes: reperesActifs(t.reperes, ["moyen", "excellent", "moyen", "alerte"], z) },
    conseils: [[t.conseilSous, t.conseilOptimal, t.conseilVigilance, t.conseilRisque][z]],
  };
}

// ── 8. VOLUME HEBDOMADAIRE ───────────────────────────────────────────────────────
function volume(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.volume, L = d.lang;
  const base: Fiche = { cle: "volume", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi };
  const runs = d.seances.filter((w) => isRun(w.sport));
  if (!runs.length) return { ...base, vide: T.commun.vide };
  const maintenant = d.maintenant ?? Date.now();
  // Mêmes définitions que la carte : semaine de calendrier, médiane 8 semaines, volume démontré.
  const semaine = runs.filter((w) => dansFenetre(w.date, 7));
  const km = semaine.reduce((s, w) => s + (w.distance_km ?? 0), 0);
  const ref = robustWeeklyKm(runs, maintenant - 7 * 86400000, 8);
  const demontre = demonstratedWeeklyKm(runs.map((w) => ({ date: w.date, distance_km: w.distance_km ?? 0 })));
  const tendance = computeWeeklyTrend(d.historique.length ? d.historique : d.seances, 12);
  const diff = ref ? km - ref.km : null;
  const conseils = [t.conseilRampe, ...(ref && km > ref.km * 1.2 ? [t.conseilHausse] : [])];
  return {
    ...base,
    valeur: nb(L, km, 1), unite: "km",
    statut: diff != null ? { libelle: `${signe(L, diff, 1)} km`, ton: ref && km > ref.km * 1.2 ? "moyen" : "bon" } : undefined,
    verdict: ref && diff != null ? t.verdict(nb(L, km, 1), nb(L, ref.km, 1), `${signe(L, diff, 1)} km`) : t.verdictSansRef(nb(L, km, 1)),
    composantes: [
      { libelle: t.semaine, valeur: nb(L, km, 1), unite: "km", ton: "neutre", detail: t.dSemaine },
      ...(ref ? [{ libelle: t.mediane, valeur: nb(L, ref.km, 1), unite: "km", ton: "neutre" as Ton, detail: t.dMediane }] : []),
      ...(demontre != null ? [{ libelle: t.demontre, valeur: nb(L, demontre), unite: "km", ton: "neutre" as Ton, detail: t.dDemontre }] : []),
      { libelle: t.seances, valeur: String(semaine.length), ton: "neutre", detail: t.dSeances },
    ],
    graphe: {
      titre: t.graphe, unite: "km", barres: true,
      lignes: [{ libelle: "km", couleur: "#059669", points: tendance.map((s, i) => ({ date: dateMini(L, decale(d.aujourdhui, -7 * (tendance.length - 1 - i))), valeur: Math.round(s.km * 10) / 10 })) }],
      repere: ref ? { valeur: ref.km, libelle: t.mediane } : undefined,
    },
    calcul: [t.cMediane, t.cCourse],
    conseils,
    liens: [{ libelle: T.commun.voirPlan, href: "/dashboard/calendrier" }],
  };
}

// ── 9. INTENSITÉ (ZONES FC) ──────────────────────────────────────────────────────
function zones(d: DonneesFiche): Fiche {
  const T = TEXTES[d.lang], t = T.zones, L = d.lang;
  const base: Fiche = { cle: "zones", titre: t.titre, mesure: t.mesure, valeur: "—", verdict: "", calcul: [], conseils: [], pourquoi: t.pourquoi,
    sources: ["Seiler S. — What is best practice for training intensity and duration distribution in endurance athletes? IJSPP, 2010.", "Stöggl T. & Sperlich B. — Polarized training has greater impact on key endurance variables, Frontiers in Physiology, 2014."] };
  const z = computeHrZones(d.seances);
  if (!(z.total > 0)) return { ...base, vide: T.commun.vide };
  const part = (s: number) => (s / z.total) * 100;
  const facile = Math.round(part(z.secs[0] + z.secs[1]));
  const etat = facile < 75 ? 0 : facile <= 90 ? 1 : 2;
  const statut = [{ libelle: t.tropDur, ton: "alerte" as Ton }, { libelle: t.polarise, ton: "excellent" as Ton }, { libelle: t.tropFacile, ton: "moyen" as Ton }][etat];
  const min = (s: number) => `${nb(L, Math.round(s / 60))} min`;
  return {
    ...base,
    valeur: String(facile), unite: "%", statut,
    verdict: t.verdict(String(facile)),
    base: t.cMesure(z.seances, z.ecartees),
    composantes: [
      { libelle: t.facile, valeur: String(facile), unite: "%", part: facile, ton: etat === 1 ? "excellent" : "moyen", detail: t.dFacile },
      { libelle: t.modere, valeur: nb(L, part(z.secs[2])), unite: "%", part: part(z.secs[2]), ton: "neutre", detail: t.dModere },
      { libelle: t.dur, valeur: nb(L, part(z.secs[3] + z.secs[4])), unite: "%", part: part(z.secs[3] + z.secs[4]), ton: "neutre", detail: t.dDur },
    ],
    tableaux: [{ titre: t.tZones, colonnes: [t.cZone, t.cTemps, t.cPart], lignes: z.secs.map((s, i) => ({ cellules: [t.noms[i], min(s), `${nb(L, part(s))} %`], actif: i <= 1 })) }],
    calcul: [t.cMesure(z.seances, z.ecartees), t.cRegle],
    reperes: { titre: T.commun.reperes, lignes: reperesActifs(t.reperes, ["alerte", "excellent", "moyen"], etat) },
    conseils: [[t.conseilDur, t.conseilBien, t.conseilFacile][etat]],
    liens: [{ libelle: T.commun.voirCours, href: "/dashboard/cours" }],
  };
}

const CONSTRUCTEURS: Record<CleIndicateur, (d: DonneesFiche) => Fiche> = { forme, vfc, vitesse, discipline, objectif, charge, acwr, volume, zones };

/** La fiche d'un indicateur, à partir des données de l'athlète. */
export function ficheIndicateur(cle: CleIndicateur, d: DonneesFiche): Fiche {
  return CONSTRUCTEURS[cle](d);
}

/** Les titres des neuf fiches, pour la navigation entre elles. */
export function titresIndicateurs(lang: Lang): Record<CleIndicateur, string> {
  const T = TEXTES[lang];
  return { forme: T.forme.titre, vfc: T.vfc.titre, vitesse: T.vitesse.titre, discipline: T.discipline.titre, objectif: T.objectif.titre, charge: T.charge.titre, acwr: T.acwr.titre, volume: T.volume.titre, zones: T.zones.titre };
}
