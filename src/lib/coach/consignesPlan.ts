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
  mc: (d: string) => string; course: (d: string) => string; renfo: string; decale: (n: number, d: string) => string;
}> = {
  fr: {
    titre: "Footing encadré par ton kiné",
    why: (d) => `Consignes de ton kinésithérapeute jusqu'au ${d} : une sortie courte et très facile, sans intensité.`,
    repos: (n, d) => `Consignes de ton kinésithérapeute jusqu'au ${d} : ${n} sortie${n > 1 ? "s" : ""} de course par semaine au maximum.`,
    mc: (d) => `Cette séance de marche-course dépasse la durée fixée par ton kinésithérapeute (jusqu'au ${d}) : demande-lui comment l'adapter.`,
    course: (d) => ` ⚠️ Cette course tombe pendant les consignes de ton kinésithérapeute (jusqu'au ${d}) : demande-lui son accord avant de la courir.`,
    renfo: " Consigne de ton kiné : aucun saut ni bondissement.",
    decale: (n, d) => `Consignes de ton kinésithérapeute jusqu'au ${d} : ${n} sortie${n > 1 ? "s" : ""} au plus sur 7 jours. Cette sortie a été décalée ici, en footing très facile, pour tenir cette limite.`,
  },
  en: {
    titre: "Run within your physio's limits",
    why: (d) => `Your physiotherapist's instructions until ${d}: a short, very easy run, with no intensity.`,
    repos: (n, d) => `Your physiotherapist's instructions until ${d}: ${n} run${n > 1 ? "s" : ""} per week at most.`,
    mc: (d) => `This walk-run session goes beyond the duration set by your physiotherapist (until ${d}): ask them how to adapt it.`,
    course: (d) => ` ⚠️ This race falls within your physiotherapist's instructions (until ${d}): ask for their go-ahead before running it.`,
    renfo: " Your physio's instruction: no jumps or bounds.",
    decale: (n, d) => `Your physiotherapist's instructions until ${d}: ${n} run${n > 1 ? "s" : ""} at most over 7 days. This run was moved here, as a very easy run, to stay within that limit.`,
  },
  de: {
    titre: "Lauf im Rahmen deiner Physiotherapie",
    why: (d) => `Vorgaben deiner Physiotherapie bis ${d}: ein kurzer, sehr lockerer Lauf ohne Intensität.`,
    repos: (n, d) => `Vorgaben deiner Physiotherapie bis ${d}: höchstens ${n} Lauf${n > 1 ? "e" : ""} pro Woche.`,
    mc: (d) => `Diese Geh-Lauf-Einheit überschreitet die von deiner Physiotherapie festgelegte Dauer (bis ${d}): Frag nach, wie sie angepasst werden soll.`,
    course: (d) => ` ⚠️ Dieser Wettkampf fällt in die Vorgaben deiner Physiotherapie (bis ${d}): Hol dir vorher ihr Einverständnis.`,
    renfo: " Vorgabe deiner Physiotherapie: keine Sprünge.",
    decale: (n, d) => `Vorgaben deiner Physiotherapie bis ${d}: höchstens ${n} Lauf${n > 1 ? "e" : ""} in 7 Tagen. Dieser Lauf wurde hierher verschoben, als sehr lockerer Lauf, um diese Grenze einzuhalten.`,
  },
  es: {
    titre: "Rodaje dentro de las indicaciones de tu fisio",
    why: (d) => `Indicaciones de tu fisioterapeuta hasta el ${d}: una salida corta y muy suave, sin intensidad.`,
    repos: (n, d) => `Indicaciones de tu fisioterapeuta hasta el ${d}: ${n} salida${n > 1 ? "s" : ""} de carrera por semana como máximo.`,
    mc: (d) => `Esta sesión de andar-correr supera la duración fijada por tu fisioterapeuta (hasta el ${d}): pregúntale cómo adaptarla.`,
    course: (d) => ` ⚠️ Esta carrera cae dentro de las indicaciones de tu fisioterapeuta (hasta el ${d}): pídele su visto bueno antes de correrla.`,
    renfo: " Indicación de tu fisio: ningún salto ni bote.",
    decale: (n, d) => `Indicaciones de tu fisioterapeuta hasta el ${d}: ${n} salida${n > 1 ? "s" : ""} como máximo en 7 días. Esta salida se ha movido aquí, como rodaje muy suave, para respetar ese límite.`,
  },
  pt: {
    titre: "Corrida dentro das indicações do teu fisio",
    why: (d) => `Indicações do teu fisioterapeuta até ${d}: uma saída curta e muito fácil, sem intensidade.`,
    repos: (n, d) => `Indicações do teu fisioterapeuta até ${d}: ${n} corrida${n > 1 ? "s" : ""} por semana no máximo.`,
    mc: (d) => `Esta sessão de caminhada-corrida ultrapassa a duração fixada pelo teu fisioterapeuta (até ${d}): pergunta-lhe como adaptá-la.`,
    course: (d) => ` ⚠️ Esta prova cai dentro das indicações do teu fisioterapeuta (até ${d}): pede-lhe autorização antes de a correres.`,
    renfo: " Indicação do teu fisio: nenhum salto.",
    decale: (n, d) => `Indicações do teu fisioterapeuta até ${d}: ${n} corrida${n > 1 ? "s" : ""} no máximo em 7 dias. Esta corrida foi movida para aqui, como corrida muito fácil, para respeitar esse limite.`,
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
  /** Les jours de la semaine où l'athlète peut courir (0 = dimanche, comme `Date.getDay`) : une sortie
   *  décalée pour tenir le nombre de sorties n'atterrit que sur l'un d'eux. Absent = tous. */
  joursDispo?: number[];
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

/**
 * La durée (min) de la séance remplacée, dans cet ordre : la prose française (échauffement +
 * corps + retour au calme, ce que la montre reçoit), l'étiquette « N min », la distance × l'allure
 * facile. `null` si rien ne la dit.
 * Relecture du 10/11/2026 : sans distance, une récupération de 25 min devenait un footing de
 * 50 min sous une consigne de 120 min — le contrôle RALLONGEAIT la séance d'un coureur blessé.
 */
export function dureeSeance(jour: PlanDay, allureFacile: string | null): number | null {
  const lu = (re: RegExp) => { const m = re.exec(jour.detail ?? ""); return m ? Number(m[1]) : null; };
  const corps = lu(/Corps : (\d+) min/);
  if (corps != null) return (lu(/Échauffement (\d+) min/) ?? 0) + corps + (lu(/Retour au calme (\d+) min/) ?? 0);
  const min = minDeTags(jour.tags ?? []);
  if (min != null) return min;
  const km = kmDeTags(jour.tags ?? []), sec = secParKm(allureFacile);
  if (km != null && sec != null) return Math.round((km * sec) / 60);
  // « 20 min de footing… » (veille), « 20 à 30 min » (récupération d'après-course) → la plus courte.
  return lu(/(\d+)(?:\s*(?:à|-)\s*\d+)?\s*min/);
}

/** Durée totale retenue quand rien ne dit celle de la séance remplacée : courte, jamais 40 min de corps. */
export const REPLI_TOTAL_MIN = 25;

/** Le corps (min) d'un footing qui tient dans la durée maximale et ne dépasse pas la séance remplacée. */
export function corpsFooting(dureeMaxMin: number | null, jour: PlanDay, allureFacile: string | null): number {
  const plafond = dureeMaxMin != null ? dureeMaxMin - 10 : 40;
  const avant = dureeSeance(jour, allureFacile);
  return Math.max(5, Math.min(plafond, (avant ?? REPLI_TOTAL_MIN) - 10));
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

/**
 * Applique les consignes du kinésithérapeute à la liste FINALE des séances. IDEMPOTENT : le coach
 * le réapplique après les ajustements de l'athlète (« décaler », « échanger »), qui réécrivent la
 * semaine après `buildWeekPlan` (relecture du 10/11/2026).
 */
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

  // Les consignes s'arrêtent à leur date de fin : un jour d'après n'est ni bridé ni annoncé.
  const enVigueur = (jour: PlanDay) => jour.date <= consignes.jusquAu;
  const apres: PlanDay[] = [];
  for (const jour of plan) {
    if (!enVigueur(jour)) { apres.push(jour); continue; }
    const course = !PAS_COURSE.has(jour.type);
    if (!course) {
      // Le renfo perd ses sauts quand l'intensité est interdite.
      apres.push(jour.type === "Renfo" && consignes.sansIntensite
        ? reecrire(jour, "Renfo", (l) => { const t = texteDe(jour, l); return { ...t, detail: t.detail.includes(T[l].renfo) ? t.detail : t.detail + T[l].renfo }; })
        : jour);
      continue;
    }
    if (jour.type === "Course" && jour.date !== c.courseC) {
      // Course A ou B : l'objectif de l'athlète, jamais retiré ; on dit de demander l'accord.
      apres.push(reecrire(jour, "Course", (l) => { const t = texteDe(jour, l); return { ...t, why: t.why.includes(T[l].course(fin)) ? t.why : t.why + T[l].course(fin) }; }));
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
  // Les courses A et B, jamais retirées, prennent leur place AVANT les autres sorties : sinon un
  // footing posé plus tôt dans la semaine ferait dépasser la fenêtre qui contient la course.
  const gardees: string[] = [...c.sortiesRecentes,
    ...apres.filter((j) => j.type === "Course" && enVigueur(j) && !c.sortiesRecentes.includes(j.date)).map((j) => j.date)];
  // Une sortie le jour d jouxte 7 fenêtres : celles qui finissent de d à d + 6 (jusqu'à la fin des consignes).
  const tient = (d: string) => [0, 1, 2, 3, 4, 5, 6].map((k) => decale(d, k)).filter((w) => w <= consignes.jusquAu)
    .every((w) => gardees.filter((x) => x >= decale(w, -6) && x <= w).length < max);
  // ⚠️ UNE SORTIE QUI NE TIENT PAS EST DÉCALÉE, PAS SEULEMENT RETIRÉE (12/11/2026). Le moteur pose
  // les sorties sans connaître celles déjà courues : avec 2 sorties au plus et deux sorties ces
  // derniers jours, celles de la semaine tombaient toutes trop tôt et étaient toutes retirées —
  // une semaine entière sans course alors qu'une sortie redevenait possible quelques jours plus
  // tard. EN DEUX PASSES (relecture du directeur scientifique) :
  //   1. les séances du moteur sont validées À LEUR PLACE ; celles qui ne tiennent pas sont retirées ;
  //   2. chaque sortie retirée cherche, plus tard dans la semaine, un jour de repos qui n'est pas un
  //      repos PROTECTEUR (3 jours après une course, lendemain d'une séance dure ou d'une sortie
  //      longue, 48 h avant une course), de préférence sans sortie la veille ni le lendemain, où
  //      l'athlète court et où elle tient. Sinon elle reste retirée : le repos est le choix sûr.
  //   La sortie décalée devient un footing facile, jamais plus long que la séance d'origine.
  const sortie = [...apres];
  const retirees: number[] = [];
  for (let i = 0; i < sortie.length; i++) {
    const jour = sortie[i];
    if (PAS_COURSE.has(jour.type) || !enVigueur(jour) || jour.type === "Course") continue;
    // Déjà courue ce jour-là (le jour 0 est gelé dès qu'une séance est enregistrée) : la sortie
    // est dans `sortiesRecentes`, on ne la compte pas deux fois.
    if (c.sortiesRecentes.includes(jour.date)) continue;
    if (tient(jour.date)) { gardees.push(jour.date); continue; }
    retirees.push(i);
    sortie[i] = repos(jour, (l) => T[l].repos(max, fin));
  }
  const DURS = new Set([...TYPES_INTENSES, "Sortie longue", "Course"]);
  const typesLe = (d: string) => sortie.filter((x) => x.date === d).map((x) => x.type);
  const court = (d: string) => c.sortiesRecentes.includes(d) || typesLe(d).some((t) => !PAS_COURSE.has(t));
  const protecteur = (d: string) =>
    [1, 2, 3].some((k) => typesLe(decale(d, -k)).includes("Course"))   // après une course
    || typesLe(decale(d, -1)).some((t) => DURS.has(t))                 // lendemain d'une séance dure ou longue
    || [1, 2].some((k) => typesLe(decale(d, k)).includes("Course"));   // 48 h avant une course
  const candidat = (j: number, i: number) => j > i && sortie[j].type === "Repos" && enVigueur(sortie[j])
    && typesLe(sortie[j].date).length === 1
    && (!c.joursDispo || c.joursDispo.includes(new Date(`${sortie[j].date}T12:00:00Z`).getUTCDay()))
    && !protecteur(sortie[j].date) && tient(sortie[j].date);
  for (const i of retirees) {
    const origine = apres[i];
    // Une marche-course ne devient jamais un footing continu : un débutant qui ne court pas encore
    // 30 minutes recevrait de la course continue (relecture). Elle reste retirée.
    if (origine.type === "Marche/course") continue;
    const espace = (j: number) => !court(decale(sortie[j].date, -1)) && !court(decale(sortie[j].date, 1));
    let cible = sortie.findIndex((_, j) => candidat(j, i) && espace(j));
    if (cible < 0) cible = sortie.findIndex((_, j) => candidat(j, i));
    if (cible < 0) continue;
    gardees.push(sortie[cible].date);
    const decalee = footing({ ...origine, date: sortie[cible].date, confirmed: sortie[cible].confirmed });
    // Son « pourquoi » dit qu'elle a été décalée pour tenir le nombre de sorties.
    sortie[cible] = reecrire(decalee, decalee.type, (l) => ({ ...texteDe(decalee, l), why: T[l].decale(max, fin) }));
  }
  return sortie;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LE QUESTIONNAIRE D'APTITUDE EN ATTENTE D'AVIS (lot 3, décision de Cyprien du 10/11/2026) :
//  AUCUNE séance d'endurance (course, vélo, natation, sport croisé) jusqu'à l'avis d'un médecin —
//  « sans intensité » ne suffisait pas (relecture du directeur scientifique : une sortie longue
//  facile garde une forte charge cardiovasculaire). Jours de repos, une marche tranquille reste
//  possible ; le renforcement reste, sans saut. La course du jour elle-même est retirée du plan.
// ─────────────────────────────────────────────────────────────────────────────
const SANS_COURSE: Record<Lang, { why: string; course: string; renfo: string }> = {
  fr: {
    why: "Ton questionnaire d'aptitude signale une situation à faire voir à un médecin : en attendant son avis, pas de course. Une marche tranquille reste possible.",
    course: "Course retirée de ton plan : ton questionnaire d'aptitude demande l'avis d'un médecin avant de la courir.",
    renfo: "20 min, renforcement DOUX en attendant l'avis d'un médecin : mobilité des hanches et des chevilles, gainage 3×30 s (planche, latéral), pont fessier 2×12, montées de mollets lentes 2×12, équilibre sur une jambe 2×30 s. Rien d'explosif : reste à un effort où tu peux parler.",
  },
  en: {
    why: "Your fitness questionnaire flags something a doctor should look at: until then, no running. A gentle walk is still fine.",
    course: "Race removed from your plan: your fitness questionnaire calls for a doctor's opinion before running it.",
    renfo: "20 min, GENTLE strength work until a doctor has seen you: hip and ankle mobility, core 3×30 s (plank, side plank), glute bridges 2×12, slow calf raises 2×12, single-leg balance 2×30 s. Nothing explosive: stay at an effort where you can talk.",
  },
  de: {
    why: "Dein Fitness-Fragebogen nennt etwas, das ärztlich abgeklärt werden sollte: Bis dahin kein Laufen. Ein ruhiger Spaziergang ist möglich.",
    course: "Wettkampf aus deinem Plan entfernt: Dein Fitness-Fragebogen verlangt vorher eine ärztliche Einschätzung.",
    renfo: "20 min SANFTES Krafttraining bis zur ärztlichen Einschätzung: Mobilität für Hüfte und Sprunggelenke, Rumpfstabilität 3×30 s (Unterarmstütz, Seitstütz), Glute Bridge 2×12, langsames Wadenheben 2×12, Einbeinstand 2×30 s. Nichts Explosives: bleib bei einer Belastung, bei der du sprechen kannst.",
  },
  es: {
    why: "Tu cuestionario de aptitud señala algo que debe ver un médico: hasta entonces, nada de correr. Un paseo tranquilo sigue siendo posible.",
    course: "Carrera retirada de tu plan: tu cuestionario de aptitud pide la opinión de un médico antes de correrla.",
    renfo: "20 min de fuerza SUAVE hasta que te vea un médico: movilidad de caderas y tobillos, core 3×30 s (plancha, lateral), puente de glúteos 2×12, elevaciones lentas de gemelos 2×12, equilibrio sobre una pierna 2×30 s. Nada explosivo: mantén un esfuerzo en el que puedas hablar.",
  },
  pt: {
    why: "O teu questionário de aptidão assinala algo que um médico deve ver: até lá, nada de corrida. Uma caminhada tranquila continua possível.",
    course: "Prova retirada do teu plano: o teu questionário de aptidão pede a opinião de um médico antes de a correres.",
    renfo: "20 min de reforço SUAVE até um médico te ver: mobilidade das ancas e dos tornozelos, core 3×30 s (prancha, lateral), ponte de glúteos 2×12, elevações lentas dos gémeos 2×12, equilíbrio numa perna 2×30 s. Nada explosivo: mantém um esforço em que consigas falar.",
  },
};
/** Ce qui reste sous « aucune course » : le repos, le renforcement, la mobilité. */
const GARDES_SANS_COURSE = new Set(["Repos", "Renfo", "Mobilité"]);

/** Le plan FINI quand l'avis d'un médecin est attendu : aucune séance d'endurance. Idempotent. */
export function appliquerAptitude(plan: readonly PlanDay[]): PlanDay[] {
  return plan.map((jour) => {
    // Le renfo est REMPLACÉ, pas annoté : « aucun saut » à la fin d'un texte qui prescrit des
    // bondissements, de la corde à sauter ou « 4×1 min sur un footing » ne protégeait personne
    // (relecture du directeur scientifique, 10/11/2026).
    if (jour.type === "Renfo") {
      // …en GARDANT la mise en garde « douleur » qu'un autre chemin y a mise (règle du 09/11/2026 :
      // chaque renfo dit de sauter ce qui sollicite la zone) — relecture du 10/11/2026.
      return reecrire(jour, "Renfo", (l) => {
        const avant = texteDe(jour, l).detail;
        return { ...texteDe(jour, l), detail: SANS_COURSE[l].renfo + (avant.includes(PLAN_T[l].renfoDouleur) ? PLAN_T[l].renfoDouleur : "") };
      });
    }
    if (GARDES_SANS_COURSE.has(jour.type)) return jour;
    const course = jour.type === "Course";
    return reecrire(jour, "Repos", (l) => ({
      title: PLAN_T[l].reposTitre, detail: PLAN_T[l].reposFinalDetail,
      why: course ? SANS_COURSE[l].course : SANS_COURSE[l].why, tags: [PLAN_T[l].tags["Repos"]],
    }));
  });
}

/** Pour les tests : les langues couvertes. */
export const LANGUES_CONSIGNES = LANGUES;
