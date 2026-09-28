/**
 * LE COACH IA AVANCÉ — invisible, et plus puissant en Premium.
 *
 * Cyprien, 28/09/2026 : « le coach IA, c'est l'intelligence qui donne les meilleures
 * séances possibles, pas un onglet ; la personne ne doit rien voir, juste un coach plus
 * puissant selon l'abonnement ». L'onglet de conversation a donc été retiré, et l'IA
 * travaille là où elle sert : DANS les séances.
 *
 *  · Starter : le moteur (`autoPlan`) — VFC, charge, météo, objectif, douleurs,
 *    séances manquées. Déterministe, recalculé à chaque synchronisation.
 *  · Premium (et l'essai) : le même moteur, plus une RELECTURE par le modèle des séances
 *    clés à venir. Pour chacune, un conseil d'exécution personnalisé — ce que la dernière
 *    séance a montré, la dérive cardiaque, la nuit, la chaleur du jour, la douleur en
 *    cours — ajouté au « pourquoi » de la séance, dans la langue de l'athlète. Il le lit
 *    à l'accueil, dans le calendrier et dans l'e-mail, sans rien avoir à demander.
 *
 * ⚠️ L'IA N'ÉCRIT PAS LE PLAN. La séance (distance, allure, structure) reste celle du
 * moteur, testée sur 4 000 scénarios : le conseil dit COMMENT l'exécuter, jamais QUOI
 * courir. Un conseil qui contient un chiffre absent des données est REJETÉ entier
 * (`chiffresInconnus`) — pas corrigé, rejeté : un chiffre inventé ne se répare pas.
 *
 * ⚠️ LE COÛT EST BORNÉ. Le plan se republie jusqu'à ~6 fois par jour ; la relecture ne
 * repart que si les séances relues ont CHANGÉ (empreinte) et au plus `APPELS_MAX_JOUR`
 * fois par jour et par athlète. Sinon les conseils mémorisés sont réappliqués.
 */
import type { Lang } from "@/lib/i18n/base";

export type JourPlan = { date: string; type: string; title: string; detail: string; why: string };
export type Conseil = { date: string; lang: Lang; texte: string };

/** Séances relues au plus : aujourd'hui, puis les séances CLÉS de la semaine. */
export const JOURS_MAX = 4;
export const APPELS_MAX_JOUR = 3;
export const LONGUEUR_MAX = 240;
export const LONGUEUR_MIN = 25;

const SANS_CONSEIL = /^(repos|renfo|vélo|velo)$/i;
const CLE = /vma|seuil|sp[ée]cifique|sortie longue|course/i;

/**
 * Les jours à relire : aujourd'hui s'il y a de la course, puis les séances CLÉS (qualité,
 * sortie longue, course) dans l'ordre chronologique — le reste est du footing, où un
 * conseil de plus serait du bruit.
 */
export function joursARelire(week: readonly JourPlan[], from: string): JourPlan[] {
  const avenir = week.filter((d) => d.date >= from && !SANS_CONSEIL.test(d.type.trim()));
  const choisis: JourPlan[] = [];
  const aujourdhui = avenir.find((d) => d.date === from);
  if (aujourdhui) choisis.push(aujourdhui);
  for (const d of avenir) {
    if (choisis.length >= JOURS_MAX) break;
    if (d === aujourdhui || !CLE.test(`${d.type} ${d.title}`)) continue;
    choisis.push(d);
  }
  return choisis.sort((a, b) => a.date.localeCompare(b.date));
}

/** Empreinte des séances relues : si elle n'a pas bougé, les conseils mémorisés valent encore. */
export function empreinte(jours: readonly JourPlan[], lang: Lang): string {
  const s = `${lang}|${jours.map((d) => `${d.date}|${d.type}|${d.detail}`).join("¶")}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const NOM_LANGUE: Record<Lang, string> = {
  fr: "français (tutoiement)", en: "anglais", de: "allemand (« du »)", es: "espagnol (« tú »)", pt: "portugais européen (« tu »)",
};

/** L'invite. Le contexte est en français ; les conseils, dans la langue de l'athlète. */
export function inviteRelecture(e: { systeme: string; contexte: string; jours: readonly JourPlan[]; lang: Lang; aujourdhui?: string }): string {
  const seances = e.jours.map((d) => `- ${d.date} — ${d.title} : ${d.detail.slice(0, 300)} (pourquoi : ${d.why.slice(0, 200)})`).join("\n");
  return `${e.systeme}

TOUT CE QUE TU SAIS DE L'ATHLÈTE :
${e.contexte}

SES PROCHAINES SÉANCES, CALCULÉES PAR LE MOTEUR DU PLAN — elles sont FIXÉES :
${seances}

MISSION : pour chaque séance ci-dessus, écris UN conseil d'exécution personnalisé que l'athlète lira sous la séance.
- Il dit COMMENT réussir CETTE séance avec CES données : ce que la dernière séance ou la dernière séance de qualité a montré, la dérive cardiaque, le sommeil et la VFC, la chaleur prévue ce jour-là, une douleur en cours, une séance manquée, l'objectif proche.
- Tu ne modifies JAMAIS la séance : ni distance, ni allure, ni structure, ni intensité en plus. Tu peux dire de lever le pied, jamais d'en faire plus.
- Chiffres : UNIQUEMENT ceux qui figurent ci-dessus. Aucun autre.
- Le « pourquoi » de chaque séance est DÉJÀ affiché juste au-dessus de ton conseil : ne le répète pas, complète-le.
- Temps : ${e.aujourdhui ? `aujourd'hui, c'est le ${e.aujourdhui}. N'écris « aujourd'hui » que pour cette date ; pour les autres, « jeudi », « dimanche »… ou rien.` : "n'écris pas « aujourd'hui » : tu ne sais pas quel jour l'athlète lira."}
- 2 phrases COURTES au maximum, ${LONGUEUR_MAX} caractères AU TOTAL au maximum — la plus importante d'abord, car au-delà la fin est coupée. En ${NOM_LANGUE[e.lang]}, directement à l'athlète, sans salutation.
- S'il n'y a rien de PERSONNEL à dire pour une séance, mets "" : un conseil générique ne vaut rien.

Réponds UNIQUEMENT par ce JSON, sans texte autour :
{"conseils":[{"date":"AAAA-MM-JJ","conseil":"…"}]}`;
}

/** Normalise un texte pour comparer des chiffres : décimale en point, sans espace avant l'unité, sans accent typographique. */
const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/(\d),(\d)/g, "$1.$2").replace(/(\d)\s+(?=[a-z%°'])/g, "$1");

/**
 * Les chiffres du conseil qui n'apparaissent NULLE PART dans les données. Allures
 * (« 3'47 »), et nombres suivis d'une unité (km, m, ms, bpm, %, °C, min, h, s).
 */
export function chiffresInconnus(conseil: string, source: string): string[] {
  const src = norm(source);
  const c = norm(conseil);
  const jetons = [
    ...(c.match(/\d{1,2}'\d{2}/g) ?? []),
    // L'ordre des unités compte : « min » avant « m », « ms » avant « m ».
    ...(c.match(/\d+(?:\.\d+)?(?:km|ms|min|bpm|m|%|°c|°|h|s)(?![a-z])/g) ?? []),
  ];
  return [...new Set(jetons)].filter((j) => !src.includes(j));
}

/**
 * Garde les premières phrases COMPLÈTES qui tiennent dans `max`. Mesuré le 28/09/2026 : le
 * modèle rend 360 à 460 caractères malgré une consigne à 240. Couper au milieu d'une phrase
 * la rendrait fausse ; retirer des phrases entières, jamais — d'où la consigne de mettre
 * la plus importante en premier. `null` si même la première phrase est trop longue.
 */
export function raccourcir(texte: string, max = LONGUEUR_MAX): string | null {
  if (texte.length <= max) return texte;
  const phrases = texte.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) ?? [texte];
  let out = "";
  for (const p of phrases) {
    const suite = (out ? `${out} ${p.trim()}` : p.trim());
    if (suite.length > max) break;
    out = suite;
  }
  return out.length >= LONGUEUR_MIN ? out : null;
}

/** Les conseils du modèle, validés un par un. Tout ce qui ne passe pas est écarté. */
export function validerConseils(brut: string, jours: readonly JourPlan[], lang: Lang, source: string, motifs?: string[]): Conseil[] {
  const json = String(brut ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").match(/\{[\s\S]*\}/)?.[0];
  if (!json) { motifs?.push("pas de JSON"); return []; }
  let items: unknown;
  try { items = (JSON.parse(json) as { conseils?: unknown }).conseils; } catch { motifs?.push("JSON illisible"); return []; }
  if (!Array.isArray(items)) { motifs?.push("pas de liste"); return []; }
  const dates = new Set(jours.map((d) => d.date));
  const vus = new Set<string>();
  const out: Conseil[] = [];
  for (const it of items) {
    const date = String((it as { date?: unknown })?.date ?? "").slice(0, 10);
    const brutTexte = String((it as { conseil?: unknown })?.conseil ?? "").replace(/\s+/g, " ").trim();
    if (!brutTexte) continue;   // « rien de personnel à dire » : voulu, pas une erreur
    if (!dates.has(date) || vus.has(date)) { motifs?.push(`date ${date}`); continue; }
    const texte = raccourcir(brutTexte);
    if (!texte || texte.length < LONGUEUR_MIN) { motifs?.push(`longueur ${brutTexte.length}`); continue; }
    const inconnus = chiffresInconnus(texte, source);
    if (inconnus.length) { motifs?.push(`chiffres inventés ${inconnus.join(",")}`); continue; }
    vus.add(date);
    out.push({ date, lang, texte });
  }
  return out;
}

/**
 * Le « pourquoi » enrichi du conseil. Le motif du moteur passe TOUJOURS en premier : il
 * explique la décision ; le conseil dit comment l'exécuter. Le total tient dans `max`.
 */
export function composerPourquoi(base: string, conseil: string | null | undefined, max = 640): string {
  const b = String(base ?? "").trim();
  const c = String(conseil ?? "").trim();
  if (!c) return b.slice(0, max);
  const place = Math.max(0, max - c.length - 1);
  return `${b.slice(0, place)} ${c}`.trim();
}

/** État mémorisé dans `auto_coach_state.data.relecture`. */
export type EtatRelecture = { jour: string; empreinte: string; appels: number; conseils: Conseil[] };

/** Faut-il rappeler le modèle ? Non si les séances n'ont pas changé, ni au-delà du plafond du jour. */
export function decisionRelecture(prec: EtatRelecture | null | undefined, jour: string, emp: string): "reutiliser" | "relire" | "plafond" {
  if (prec && prec.empreinte === emp && prec.jour === jour) return "reutiliser";
  const appels = prec && prec.jour === jour ? prec.appels : 0;
  return appels >= APPELS_MAX_JOUR ? "plafond" : "relire";
}

/**
 * Applique les conseils au plan : au « pourquoi » FRANÇAIS si l'athlète lit en français,
 * sinon à SA traduction (`i18n[lang].why`). Le français canonique d'un athlète allemand
 * n'est pas touché : c'est la version que lisent la montre et les autres modules.
 */
export function appliquerConseils<T extends { date: string; why: string; i18n?: Partial<Record<Lang, { why: string }>> }>(
  week: readonly T[], conseils: readonly Conseil[],
): T[] {
  const par = new Map(conseils.map((c) => [c.date, c]));
  return week.map((d) => {
    const c = par.get(d.date);
    if (!c) return d;
    if (c.lang === "fr") return { ...d, why: composerPourquoi(d.why, c.texte) };
    const tr = d.i18n?.[c.lang];
    if (!tr) return d;   // pas de traduction de ce jour : on n'invente pas un pourquoi
    return { ...d, i18n: { ...d.i18n, [c.lang]: { ...tr, why: composerPourquoi(tr.why, c.texte) } } };
  });
}
