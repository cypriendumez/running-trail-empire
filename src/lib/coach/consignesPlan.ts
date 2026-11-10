// ─────────────────────────────────────────────────────────────────────────────
//  LES CONSIGNES DU KINÉSITHÉRAPEUTE, APPLIQUÉES AU PLAN FINI — un seul point de contrôle.
//
//  Relecture du directeur scientifique (10/11/2026) : brancher les consignes sur les chemins
//  principaux (budget de qualité, sortie longue, plafond des footings) en laissait passer
//  d'autres qui produisent aussi des séances — le plancher de 25 min des footings, la
//  marche-course, la semaine de course (lignes droites, course C « à l'effort d'un seuil »),
//  les footings doublés, les variantes (lignes droites, finish progressif), le renfo avec
//  sauts — et le nombre de sorties n'était compté que sur les 7 jours À VENIR.
//
//  Ce module s'applique donc à la liste FINALE des séances, quel que soit le chemin qui les a
//  produites (`buildWeekPlan` l'appelle en dernier) :
//   · durée maximale : chaque sortie de course devient un footing très facile EN MINUTES
//     (échauffement 5 + corps + retour au calme 5 ≤ la durée), jamais plus long que la séance
//     qu'il remplace ; aucune allure n'est nécessaire (le cas « allure inconnue » est couvert) ;
//   · pas d'intensité : toute séance qui contient de la vitesse (qualité, lignes droites,
//     finish progressif, veille de course) devient ce même footing ; le renfo perd ses sauts ;
//   · nombre de sorties : compté sur 7 jours GLISSANTS, sorties déjà courues comprises ; au-delà,
//     repos ;
//   · une course A ou B n'est jamais retirée (c'est l'objectif de l'athlète) mais son « pourquoi »
//     dit de demander l'accord du kinésithérapeute ; une course C devient un footing.
//  Le texte français reste canonique : le footing réutilise `recupDetail`, que la montre lit déjà.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";
import { PLAN_T } from "@/lib/ai/planI18n";
import type { PlanDay, PlanDayText } from "@/lib/ai/autoPlan";
import type { ConsignesKine } from "@/lib/health/consignesKine";

const LANGUES: Lang[] = ["fr", "en", "de", "es", "pt"];
const AUTRES: Lang[] = ["en", "de", "es", "pt"];

/** Ce qui n'est pas une sortie de course. */
const PAS_COURSE = new Set(["Repos", "Renfo", "Vélo", "Natation", "Croisé", "Mobilité"]);
/** Les types qui portent de l'intensité par nature. */
const TYPES_INTENSES = new Set(["VMA", "Seuil", "Spécifique", "Côtes", "Tempo", "Fartlek", "Qualité"]);

const T: Record<Lang, {
  titre: string; why: (d: string) => string; repos: (n: number, d: string) => string;
  mc: (d: string) => string; course: (d: string) => string; renfo: string;
}> = {
  fr: {
    titre: "Footing encadré par ton kiné",
    why: (d) => `Consignes de ton kinésithérapeute jusqu'au ${d} : une sortie courte et très facile, sans intensité.`,
    repos: (n, d) => `Consignes de ton kinésithérapeute jusqu'au ${d} : ${n} sortie${n > 1 ? "s" : ""} de course par semaine au maximum.`,
    mc: (d) => `Cette séance de marche-course dépasse la durée fixée par ton kinésithérapeute (jusqu'au ${d}) : demande-lui comment l'adapter.`,
    course: (d) => ` ⚠️ Cette course tombe pendant les consignes de ton kinésithérapeute (jusqu'au ${d}) : demande-lui son accord avant de la courir.`,
    renfo: " Consigne de ton kiné : aucun saut ni bondissement.",
  },
  en: {
    titre: "Run within your physio's limits",
    why: (d) => `Your physiotherapist's instructions until ${d}: a short, very easy run, with no intensity.`,
    repos: (n, d) => `Your physiotherapist's instructions until ${d}: ${n} run${n > 1 ? "s" : ""} per week at most.`,
    mc: (d) => `This walk-run session goes beyond the duration set by your physiotherapist (until ${d}): ask them how to adapt it.`,
    course: (d) => ` ⚠️ This race falls within your physiotherapist's instructions (until ${d}): ask for their go-ahead before running it.`,
    renfo: " Your physio's instruction: no jumps or bounds.",
  },
  de: {
    titre: "Lauf im Rahmen deiner Physiotherapie",
    why: (d) => `Vorgaben deiner Physiotherapie bis ${d}: ein kurzer, sehr lockerer Lauf ohne Intensität.`,
    repos: (n, d) => `Vorgaben deiner Physiotherapie bis ${d}: höchstens ${n} Lauf${n > 1 ? "e" : ""} pro Woche.`,
    mc: (d) => `Diese Geh-Lauf-Einheit überschreitet die von deiner Physiotherapie festgelegte Dauer (bis ${d}): Frag nach, wie sie angepasst werden soll.`,
    course: (d) => ` ⚠️ Dieser Wettkampf fällt in die Vorgaben deiner Physiotherapie (bis ${d}): Hol dir vorher ihr Einverständnis.`,
    renfo: " Vorgabe deiner Physiotherapie: keine Sprünge.",
  },
  es: {
    titre: "Rodaje dentro de las indicaciones de tu fisio",
    why: (d) => `Indicaciones de tu fisioterapeuta hasta el ${d}: una salida corta y muy suave, sin intensidad.`,
    repos: (n, d) => `Indicaciones de tu fisioterapeuta hasta el ${d}: ${n} salida${n > 1 ? "s" : ""} de carrera por semana como máximo.`,
    mc: (d) => `Esta sesión de andar-correr supera la duración fijada por tu fisioterapeuta (hasta el ${d}): pregúntale cómo adaptarla.`,
    course: (d) => ` ⚠️ Esta carrera cae dentro de las indicaciones de tu fisioterapeuta (hasta el ${d}): pídele su visto bueno antes de correrla.`,
    renfo: " Indicación de tu fisio: ningún salto ni bote.",
  },
  pt: {
    titre: "Corrida dentro das indicações do teu fisio",
    why: (d) => `Indicações do teu fisioterapeuta até ${d}: uma saída curta e muito fácil, sem intensidade.`,
    repos: (n, d) => `Indicações do teu fisioterapeuta até ${d}: ${n} corrida${n > 1 ? "s" : ""} por semana no máximo.`,
    mc: (d) => `Esta sessão de caminhada-corrida ultrapassa a duração fixada pelo teu fisioterapeuta (até ${d}): pergunta-lhe como adaptá-la.`,
    course: (d) => ` ⚠️ Esta prova cai dentro das indicações do teu fisioterapeuta (até ${d}): pede-lhe autorização antes de a correres.`,
    renfo: " Indicação do teu fisio: nenhum salto.",
  },
};

export type ContexteConsignes = {
  consignes: ConsignesKine;
  /** Allure facile (« 4'53 »), pour estimer la durée de la séance remplacée ; `null` si inconnue. */
  allureFacile: string | null;
  /** Dates (AAAA-MM-JJ) des sorties de course déjà courues ces 6 derniers jours, une par sortie. */
  sortiesRecentes: string[];
  /** Date d'une course C de la semaine (AAAA-MM-JJ), à transformer en footing ; `null` sinon. */
  courseC: string | null;
};

const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const decale = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const kmDeTags = (tags: readonly string[]) => {
  for (const t of tags) { const m = /^(\d+(?:,\d+)?) km$/.exec(String(t)); if (m) return Number(m[1].replace(",", ".")); }
  return null;
};
const minDeTags = (tags: readonly string[]) => {
  for (const t of tags) { const m = /^(\d+) min$/.exec(String(t)); if (m) return Number(m[1]); }
  return null;
};
const secParKm = (allure: string | null) => {
  const m = String(allure ?? "").match(/(\d+)['’:](\d{1,2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Le corps (min) d'un footing qui tient dans la durée maximale et ne dépasse pas la séance remplacée. */
export function corpsFooting(dureeMaxMin: number | null, jour: PlanDay, allureFacile: string | null): number {
  const plafond = dureeMaxMin != null ? dureeMaxMin - 10 : 40;
  const km = kmDeTags(jour.tags ?? []), sec = secParKm(allureFacile);
  const avant = km != null && sec != null ? Math.round((km * sec) / 60) - 10 : null;
  return Math.max(5, Math.min(plafond, avant ?? 40));
}

/** Le jour réécrit dans les 5 langues. */
function reecrire(jour: PlanDay, type: string, texte: (l: Lang) => PlanDayText): PlanDay {
  return {
    ...jour, type, ...texte("fr"),
    i18n: Object.fromEntries(AUTRES.map((l) => [l, texte(l)])) as Partial<Record<Lang, PlanDayText>>,
  };
}
const texteDe = (jour: PlanDay, l: Lang): PlanDayText =>
  l === "fr" ? { title: jour.title, detail: jour.detail, why: jour.why, tags: jour.tags } : (jour.i18n?.[l] ?? { title: jour.title, detail: jour.detail, why: jour.why, tags: jour.tags });

/** Applique les consignes du kinésithérapeute à la liste FINALE des séances. */
export function appliquerConsignes(plan: readonly PlanDay[], c: ContexteConsignes): PlanDay[] {
  const { consignes } = c;
  const fin = jjmm(consignes.jusquAu);
  const footing = (jour: PlanDay) => {
    const corps = corpsFooting(consignes.dureeMaxMin, jour, c.allureFacile);
    return reecrire(jour, "Récup", (l) => ({
      title: T[l].titre, detail: PLAN_T[l].recupDetail(5, 5, corps), why: T[l].why(fin),
      tags: [PLAN_T[l].tags["Récup"], PLAN_T[l].tags["Z1"], `${corps + 10} min`],
    }));
  };
  const repos = (jour: PlanDay, why: (l: Lang) => string) => reecrire(jour, "Repos", (l) => ({
    title: PLAN_T[l].reposTitre, detail: PLAN_T[l].reposFinalDetail, why: why(l), tags: [PLAN_T[l].tags["Repos"]],
  }));
  const intense = (jour: PlanDay) =>
    TYPES_INTENSES.has(jour.type)
    || (jour.tags ?? []).some((t) => /^(Qualité|Progressif|Spécifique)$/.test(String(t)))
    || jour.title === PLAN_T.fr.enduranceTitreLignes || jour.title === PLAN_T.fr.enduranceTitreProg
    || jour.title === PLAN_T.fr.veilleTitre || jour.title === PLAN_T.fr.avantVeilleTitre;

  const apres: PlanDay[] = [];
  for (const jour of plan) {
    const course = !PAS_COURSE.has(jour.type);
    if (!course) {
      // Le renfo perd ses sauts quand l'intensité est interdite.
      apres.push(jour.type === "Renfo" && consignes.sansIntensite
        ? reecrire(jour, "Renfo", (l) => { const t = texteDe(jour, l); return { ...t, detail: t.detail + T[l].renfo }; })
        : jour);
      continue;
    }
    if (jour.type === "Course" && jour.date !== c.courseC) {
      // Course A ou B : l'objectif de l'athlète, jamais retiré ; on dit de demander l'accord.
      apres.push(reecrire(jour, "Course", (l) => { const t = texteDe(jour, l); return { ...t, why: t.why + T[l].course(fin) }; }));
      continue;
    }
    if (jour.type === "Marche/course") {
      const total = minDeTags(jour.tags ?? []);
      apres.push(consignes.dureeMaxMin != null && (total == null || total > consignes.dureeMaxMin)
        ? repos(jour, (l) => T[l].mc(fin)) : jour);
      continue;
    }
    apres.push(consignes.dureeMaxMin != null || jour.type === "Course" || (consignes.sansIntensite && intense(jour)) ? footing(jour) : jour);
  }

  // Nombre de sorties : 7 jours GLISSANTS, sorties déjà courues comprises. Une course A ou B
  // compte mais n'est jamais retirée.
  if (consignes.seancesMaxSemaine == null) return apres;
  const max = consignes.seancesMaxSemaine;
  const gardees: string[] = [...c.sortiesRecentes];
  return apres.map((jour) => {
    if (PAS_COURSE.has(jour.type)) return jour;
    const depuis = decale(jour.date, -6);
    const dansFenetre = gardees.filter((d) => d >= depuis && d <= jour.date).length;
    if (jour.type === "Course" || dansFenetre < max) { gardees.push(jour.date); return jour; }
    return repos(jour, (l) => T[l].repos(max, fin));
  });
}

/** Pour les tests : les langues couvertes. */
export const LANGUES_CONSIGNES = LANGUES;
