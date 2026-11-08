// ─────────────────────────────────────────────────────────────────────────────
//  LE BILAN DE LA SEMAINE (Premium) — plusieurs séances lues ENSEMBLE.
//
//  Cyprien, 30/10/2026 : « un bilan hebdomadaire Premium qui lit plusieurs séances à la
//  fois (tendances, dérive cardiaque, état de préparation à l'objectif), alors que Starter
//  n'a que l'analyse séance par séance ». C'est l'écart qui manquait : à 9,99 € comme à
//  14,99 €, l'analyse d'UNE séance est la même ; ce bilan est ce que Premium lit en plus.
//
//  ⚠️ LE MODÈLE RÉDIGE, IL NE CALCULE PAS. Tout chiffre vient d'ici, calculé sur les vraies
//  données ; ce qui manque est LISTÉ comme inconnu (une montre sans capteur cardiaque n'a
//  pas de dérive, et le bilan doit le dire, pas l'inventer). La route rejette une réponse
//  qui contiendrait un chiffre absent de ces faits (`chiffresInconnus`).
//
//  ⚠️ JOURS CIVILS DE L'ATHLÈTE, JAMAIS L'HORLOGE. « La semaine » est faite des sept cases
//  de calendrier qui finissent aujourd'hui, chez lui (voir lib/dashboard/fenetre).
// ─────────────────────────────────────────────────────────────────────────────
import { efficaciteParBloc, tendanceEfficacite, PART_FC_FACILE } from "@/lib/running/progression";
import { formatDateCivile } from "@/lib/time/fuseau";
import { decaleJour, ecartJours } from "@/lib/streak/compute";
import { isRun } from "@/lib/intervals/sport";

export type SeanceBilan = {
  date: string; sport?: string | null; distance_km?: number | null; duration_seconds?: number | null;
  avg_hr?: number | null; elevation_gain_m?: number | null; hr_zone_seconds?: number[] | null; cardiac_decoupling?: number | null;
};

export type EntreeBilan = {
  /** Jour civil de l'athlète, AAAA-MM-JJ. */
  aujourdhui: string;
  /** Au moins les cinq dernières semaines de séances. */
  seances: readonly SeanceBilan[];
  sommeil: readonly { date: string; sleep_score?: number | null }[];
  /** Série de VFC déjà passée par `serieVfc` (une seule mesure). */
  vfc: readonly { date: string; hrv_ms?: number | null }[];
  fcMax: number | null;
  objectif: { nom: string; date: string; distanceKm: number; viseSec: number; predictionSec: number | null } | null;
  /** Récupération après une course courue (lib/coach/apresCourse) : la course, et la reprise de l'intensité. */
  recuperation: { course: string; reprise: string } | null;
  /** Les courses connues (objectif, course précédente) : celle COURUE cette semaine est nommée. */
  courses: readonly { nom: string; date: string; distanceKm: number }[];
};

export type FaitsBilan = {
  debut: string; fin: string;
  seances: number; km: number; minutes: number; dplus: number;
  kmHabitude: number | null;
  intensite: { facile: number; modere: number; dur: number } | null;
  derive: { semaine: number | null; n: number; avant: number | null };
  efficaciteParSemaine: number | null;
  sommeil: { semaine: number | null; avant: number | null };
  vfc: { semaine: number | null; avant: number | null };
  objectif: (NonNullable<EntreeBilan["objectif"]> & { joursRestants: number }) | null;
  recuperation: { course: string; reprise: string } | null;
  /** La course courue cette semaine (une sortie d'au moins la moitié de sa distance ce jour-là). */
  course: { nom: string; date: string; distanceKm: number; couruKm: number } | null;
  inconnus: string[];
};

const fini = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const arrondi = (x: number | null, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
/** Âge en jours civils (0 = aujourd'hui), `null` si la date est illisible. */
const age = (date: string, aujourdhui: string) => (/^\d{4}-\d{2}-\d{2}/.test(String(date)) ? ecartJours(String(date).slice(0, 10), aujourdhui) : null);
const dans = (date: string, aujourdhui: string, de: number, a: number) => { const n = age(date, aujourdhui); return n != null && n >= de && n <= a; };

export function faitsDuBilan(e: EntreeBilan): FaitsBilan {
  const runs = e.seances.filter((s) => isRun(s.sport));
  const semaine = runs.filter((s) => dans(s.date, e.aujourdhui, 0, 6));
  const avant = runs.filter((s) => dans(s.date, e.aujourdhui, 7, 34));
  const inconnus: string[] = [];

  // Volume habituel : médiane des quatre semaines précédentes RÉELLEMENT courues.
  const parSemaine = [0, 1, 2, 3].map((k) => runs.filter((s) => dans(s.date, e.aujourdhui, 7 + 7 * k, 13 + 7 * k))
    .reduce((t, s) => t + (s.distance_km ?? 0), 0)).filter((km) => km > 0).sort((a, b) => a - b);
  const kmHabitude = parSemaine.length >= 2
    ? (parSemaine.length % 2 ? parSemaine[(parSemaine.length - 1) / 2] : (parSemaine[parSemaine.length / 2 - 1] + parSemaine[parSemaine.length / 2]) / 2)
    : null;
  if (kmHabitude == null) inconnus.push("le volume habituel (moins de deux semaines courues sur les quatre précédentes)");

  // Intensité : le temps passé dans chaque zone de fréquence cardiaque, toutes séances de la semaine.
  const z = [0, 0, 0, 0, 0];
  for (const s of semaine) (s.hr_zone_seconds ?? []).slice(0, 5).forEach((v, i) => { if (fini(v) && v > 0) z[i] += v; });
  const total = z.reduce((a, b) => a + b, 0);
  const intensite = total > 0
    ? { facile: Math.round(((z[0] + z[1]) / total) * 100), modere: Math.round((z[2] / total) * 100), dur: Math.round(((z[3] + z[4]) / total) * 100) }
    : null;
  if (!intensite) inconnus.push("la répartition de l'intensité (aucun temps par zone de fréquence cardiaque cette semaine)");

  // Dérive cardiaque : mesurée sur les sorties continues d'au moins 30 min (lib/intervals/performance),
  // et SEULEMENT les sorties faciles. ⚠️ Constaté sur le vrai compte le 30/10/2026 : la seule dérive
  // de la semaine était celle du MARATHON couru à fond (5,5 %), comparée à des footings (2,6 %) —
  // et le bilan concluait « l'endurance cède ». À effort de course, le cœur monte : ce n'est pas
  // une dérive d'endurance. Même seuil que l'efficacité aérobie (PART_FC_FACILE).
  const facile = (s: SeanceBilan) => e.fcMax == null || !fini(s.avg_hr) || s.avg_hr < e.fcMax * PART_FC_FACILE;
  const deriveSemaine = semaine.filter(facile).map((s) => s.cardiac_decoupling).filter(fini);
  const deriveAvant = avant.filter(facile).map((s) => s.cardiac_decoupling).filter(fini);
  if (!deriveSemaine.length) inconnus.push("la dérive cardiaque de cette semaine (aucune sortie facile et continue d'au moins 30 min mesurée)");

  // Efficacité aérobie : tendance sur des blocs de 4 semaines, retenue seulement si elle ressort du bruit.
  const t = tendanceEfficacite(efficaciteParBloc(runs, e.fcMax, Date.parse(`${e.aujourdhui}T12:00:00Z`)));
  if (!t) inconnus.push("la tendance d'efficacité aérobie (pas assez de sorties faciles, ou rien qui ressorte du bruit)");

  const sommeilSemaine = moyenne(e.sommeil.filter((s) => dans(s.date, e.aujourdhui, 0, 6)).map((s) => s.sleep_score).filter(fini));
  const sommeilAvant = moyenne(e.sommeil.filter((s) => dans(s.date, e.aujourdhui, 7, 27)).map((s) => s.sleep_score).filter(fini));
  if (sommeilSemaine == null) inconnus.push("le sommeil de cette semaine");
  const vfcSemaine = moyenne(e.vfc.filter((s) => dans(s.date, e.aujourdhui, 0, 6)).map((s) => s.hrv_ms).filter(fini));
  const vfcAvant = moyenne(e.vfc.filter((s) => dans(s.date, e.aujourdhui, 7, 34)).map((s) => s.hrv_ms).filter(fini));
  if (vfcSemaine == null) inconnus.push("la VFC de cette semaine");

  // La course de la semaine : courue si une sortie de ce jour-là couvre au moins la moitié de la
  // distance (même règle que la récupération, lib/coach/apresCourse). Sans la nommer, le bilan
  // lisait « 70 % du temps en zone dure » sans dire que c'était un marathon.
  const course = e.courses.map((c) => {
    const couru = Math.max(0, ...semaine.filter((s) => String(s.date).slice(0, 10) === String(c.date).slice(0, 10)).map((s) => s.distance_km ?? 0));
    return { nom: c.nom, date: String(c.date).slice(0, 10), distanceKm: c.distanceKm, couruKm: arrondi(couru, 1) ?? 0 };
  }).find((c) => c.distanceKm > 0 && c.couruKm >= c.distanceKm * 0.5) ?? null;

  const joursRestants = e.objectif ? ecartJours(e.aujourdhui, e.objectif.date) : null;
  const objectif = e.objectif && joursRestants != null && joursRestants >= 0 ? { ...e.objectif, joursRestants } : null;
  if (!objectif) inconnus.push("un objectif à venir");
  else if (objectif.predictionSec == null) inconnus.push("une prédiction de chrono (VMA inconnue)");

  return {
    debut: decaleJour(e.aujourdhui, -6), fin: e.aujourdhui,
    seances: semaine.length,
    km: arrondi(semaine.reduce((s, x) => s + (x.distance_km ?? 0), 0), 1) ?? 0,
    minutes: Math.round(semaine.reduce((s, x) => s + (x.duration_seconds ?? 0), 0) / 60),
    dplus: Math.round(semaine.reduce((s, x) => s + (x.elevation_gain_m ?? 0), 0)),
    kmHabitude: arrondi(kmHabitude, 1),
    intensite,
    derive: { semaine: arrondi(moyenne(deriveSemaine), 1), n: deriveSemaine.length, avant: arrondi(moyenne(deriveAvant), 1) },
    efficaciteParSemaine: t ? t.pctParSemaine : null,
    sommeil: { semaine: arrondi(sommeilSemaine), avant: arrondi(sommeilAvant) },
    vfc: { semaine: arrondi(vfcSemaine), avant: arrondi(vfcAvant) },
    objectif,
    recuperation: e.recuperation && e.recuperation.reprise > e.aujourdhui ? e.recuperation : null,
    course,
    inconnus,
  };
}

/** « 15'59 » sous l'heure, « 2h42 » au-delà. */
export function chrono(sec: number): string {
  const s = Math.round(sec);
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}`;
}
/** Décimale à la française : le modèle RECOPIE ce qu'on lui donne (« 49.9 km » dans un texte français). */
const nf = (x: number) => String(x).replace(".", ",");
const signe = (x: number) => (x > 0 ? `+${nf(x)}` : nf(x));
/** « 21 novembre », pas « 2026-11-21 » : un entraîneur ne parle pas en dates ISO. */
const jourLisible = (iso: string) => formatDateCivile(iso, "fr", { day: "numeric", month: "long" });

/** Les faits, en français, tels que le modèle les reçoit (et tels que la route contrôle sa réponse). */
export function lignesDuBilan(f: FaitsBilan): string {
  const l: string[] = [];
  l.push(`Semaine du ${jourLisible(f.debut)} au ${jourLisible(f.fin)} (7 jours, aujourd'hui compris).`);
  if (f.course) l.push(`Course disputée cette semaine : ${f.course.nom}, ${nf(f.course.couruKm)} km le ${jourLisible(f.course.date)}. Elle compte dans le volume et l'intensité ci-dessous.`);
  l.push(`Course à pied : ${f.seances} séance(s), ${nf(f.km)} km, ${f.minutes} min, D+ ${f.dplus} m.`);
  if (f.kmHabitude != null) l.push(`Volume habituel (médiane des semaines courues parmi les 4 précédentes) : ${nf(f.kmHabitude)} km.`);
  if (f.intensite) l.push(`Intensité (temps par zone de fréquence cardiaque) : facile ${f.intensite.facile} %, modéré ${f.intensite.modere} %, dur ${f.intensite.dur} %.`);
  if (f.derive.semaine != null) {
    l.push(`Dérive cardiaque moyenne (sorties faciles et continues d'au moins 30 min) : ${nf(f.derive.semaine)} % sur ${f.derive.n} sortie(s) cette semaine${f.derive.avant != null ? `, ${nf(f.derive.avant)} % les 4 semaines précédentes` : ""}. Repère : sous 5 %, l'endurance tient ; au-delà, elle cède.`);
  }
  if (f.efficaciteParSemaine != null) l.push(`Efficacité aérobie (vitesse par battement sur les sorties faciles) : ${signe(f.efficaciteParSemaine)} % par semaine, tendance qui ressort du bruit.`);
  if (f.sommeil.semaine != null) l.push(`Sommeil (score moyen sur 100) : ${f.sommeil.semaine} cette semaine${f.sommeil.avant != null ? `, ${f.sommeil.avant} les 3 semaines précédentes` : ""}.`);
  if (f.vfc.semaine != null) l.push(`VFC moyenne : ${f.vfc.semaine} ms cette semaine${f.vfc.avant != null ? `, ${f.vfc.avant} ms les 4 semaines précédentes` : ""}.`);
  if (f.objectif) {
    const o = f.objectif;
    l.push(`Objectif : ${o.nom}, ${nf(o.distanceKm)} km le ${jourLisible(o.date)}, dans ${o.joursRestants} jours, visé en ${chrono(o.viseSec)}.`);
    if (o.predictionSec != null) {
      const ecart = Math.round(o.predictionSec - o.viseSec);
      l.push(`Prédiction actuelle d'après sa VMA et son volume : ${chrono(o.predictionSec)}, soit ${ecart === 0 ? "exactement l'objectif" : `${Math.abs(ecart)} s ${ecart > 0 ? "plus lent" : "plus rapide"} que l'objectif`}.`);
    }
  }
  if (f.recuperation) l.push(`Récupération après ${f.recuperation.course} en cours : footings seulement, pas d'intensité avant le ${jourLisible(f.recuperation.reprise)}.`);
  if (f.inconnus.length) l.push(`CE QU'ON NE SAIT PAS : ${f.inconnus.join(" ; ")}.`);
  return l.join("\n");
}

const LANGUE: Record<string, string> = {
  fr: "en français, en tutoyant", en: "in English, addressing the athlete as “you”",
  de: "auf Deutsch, mit Du-Anrede", es: "en español, tuteando", pt: "em português, tratando o atleta por tu",
};

export function inviteBilan(lignes: string, lang: string): string {
  return [
    "Tu es l'entraîneur de cet athlète. Tu écris son BILAN DE LA SEMAINE : ce que ses séances, lues ENSEMBLE, disent de sa forme et de sa préparation.",
    "",
    "RÈGLES ABSOLUES :",
    "- N'écris AUCUN chiffre qui ne figure pas dans les faits ci-dessous. Aucune estimation, aucun ordre de grandeur.",
    "- Ce qui est listé comme inconnu doit être DIT inconnu, jamais comblé.",
    "- Pas de diagnostic médical, pas de « tu es apte ».",
    "- Ne prescris aucune séance : le plan s'en charge. Tu dis ce qu'il faut surveiller ou privilégier.",
    `- Cinq à sept phrases, ${LANGUE[lang] ?? LANGUE.fr}. Pas de titre, pas de liste, pas de salutation. Chaque mot est facturé.`,
    "",
    "STRUCTURE : la semaine en bref · ce que disent les tendances (intensité, dérive cardiaque, efficacité, sommeil et VFC) · où il en est pour son objectif · UNE priorité pour la semaine qui vient.",
    "",
    "LES FAITS :",
    lignes,
  ].join("\n");
}

/** Empreinte des faits : tant qu'ils ne changent pas, le bilan mémorisé est resservi sans rien dépenser. */
export function empreinteBilan(lignes: string, lang: string): string {
  const s = `${lang}|${lignes}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
