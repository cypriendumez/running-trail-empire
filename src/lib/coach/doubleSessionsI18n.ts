// ─────────────────────────────────────────────────────────────────────────────
//  TRADUCTIONS DES MOTIFS DE REFUS DES DOUBLES SÉANCES.
//
//  Ces phrases s'affichent dans le PROFIL, à la seconde où l'athlète coche la case.
//  Elles étaient en français quelle que soit sa langue : un utilisateur allemand
//  lisait des libellés traduits… suivis d'un verdict en français.
//
//  LA DETTE ANNONCÉE ICI EST SOLDÉE. Les DESCRIPTIONS DE SÉANCE (« Réveil musculaire :
//  6 km très faciles… ») restaient en français parce que TOUT le plan l'était : les
//  traduire seules aurait produit une séance allemande au milieu d'un plan français.
//  Le plan parle désormais les 5 langues (`lib/ai/planI18n.ts`), donc la séance du matin
//  d'un double les parle aussi — `matinFacile` ci-dessous.
//
//  ⚠️ Comme partout ailleurs, le FRANÇAIS reste canonique : c'est lui qui est écrit dans
//  `PlanDay.detail`, donc lui que la montre analyse. Les autres langues ne servent qu'à
//  l'affichage.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesDouble = {
  optIn: string;
  douleur: (zones: string) => string;
  rouge: string;
  affutage: string;
  volume: (km: number, seuil: number) => string;
  seuilPrealable: string;
  seuilVolume: (seuil: number, km: number) => string;
  seuilAnnees: (annees: number, actuel: string) => string;
  /** Séance du matin d'un double FACILE — le « réveil musculaire ». */
  matinFacile: (km: string, allure: string | null) => string;
};

export const DOUBLE_T: Record<Lang, TextesDouble> = {
  fr: {
    optIn: "l'option « deux séances par jour » n'est pas activée dans ton profil",
    douleur: (z) => `douleur en cours (${z})`,
    rouge: "fraîcheur au rouge : on ne double pas un jour où le corps demande du repos",
    affutage: "semaine d'affûtage : on cherche la fraîcheur, pas le volume",
    volume: (km, s) => `volume hebdomadaire de ${km} km : en dessous de ${s} km, une seule sortie par jour suffit et doubler n'ajoute que de la logistique`,
    seuilPrealable: "les conditions du double facile ne sont pas réunies",
    seuilVolume: (s, km) => `le double seuil demande un socle d'environ ${s} km/semaine (tu es à ${km})`,
    seuilAnnees: (a, actuel) => `il demande aussi environ ${a} ans de pratique (tu en as ${actuel})`,
    matinFacile: (km, a) => `Réveil musculaire : ${km} km très faciles en FC Z1-Z2${a ? ` (~${a}/km, voire plus lent)` : ""}, sans montre si tu peux. Le seul objectif est de faire circuler, pas de préparer la séance du soir — si tu finis essoufflé, c'était trop vite.`,
  },
  en: {
    optIn: "the “two sessions a day” option is not enabled in your profile",
    douleur: (z) => `ongoing pain (${z})`,
    rouge: "freshness in the red: you do not double on a day when the body is asking for rest",
    affutage: "taper week: we are after freshness, not volume",
    volume: (km, s) => `weekly volume of ${km} km: below ${s} km, one run a day is enough and doubling only adds logistics`,
    seuilPrealable: "the conditions for the easy double are not met",
    seuilVolume: (s, km) => `double threshold needs a base of roughly ${s} km/week (you are at ${km})`,
    seuilAnnees: (a, actuel) => `it also needs about ${a} years of running (you have ${actuel})`,
    matinFacile: (km, a) => `Muscular wake-up: ${km} km very easy at HR Z1-Z2${a ? ` (~${a}/km, or slower)` : ""}, without a watch if you can. The only goal is to get things circulating, not to prepare the evening session — if you finish out of breath, it was too fast.`,
  },
  de: {
    optIn: "die Option „zwei Einheiten pro Tag“ ist in deinem Profil nicht aktiviert",
    douleur: (z) => `bestehende Schmerzen (${z})`,
    rouge: "Frische auf Rot: An einem Tag, an dem der Körper Ruhe verlangt, wird nicht verdoppelt",
    affutage: "Tapering-Woche: Es geht um Frische, nicht um Umfang",
    volume: (km, s) => `Wochenumfang von ${km} km: unter ${s} km reicht ein Lauf pro Tag, und Verdoppeln bringt nur Organisationsaufwand`,
    seuilPrealable: "die Bedingungen für den lockeren Doppel sind nicht erfüllt",
    seuilVolume: (s, km) => `die doppelte Schwelle verlangt eine Basis von rund ${s} km/Woche (du bist bei ${km})`,
    seuilAnnees: (a, actuel) => `sie verlangt außerdem etwa ${a} Jahre Lauferfahrung (du hast ${actuel})`,
    matinFacile: (km, a) => `Muskuläres Aufwecken: ${km} km sehr locker bei HF Z1-Z2${a ? ` (~${a}/km, gerne langsamer)` : ""}, wenn möglich ohne Uhr. Das einzige Ziel ist, den Kreislauf in Gang zu bringen, nicht die Abendeinheit vorzubereiten — wenn du außer Atem ankommst, war es zu schnell.`,
  },
  es: {
    optIn: "la opción «dos sesiones al día» no está activada en tu perfil",
    douleur: (z) => `dolor en curso (${z})`,
    rouge: "frescura en rojo: no se dobla un día en que el cuerpo pide descanso",
    affutage: "semana de afinamiento: buscamos frescura, no volumen",
    volume: (km, s) => `volumen semanal de ${km} km: por debajo de ${s} km basta una salida al día y doblar solo añade logística`,
    seuilPrealable: "no se cumplen las condiciones del doble suave",
    seuilVolume: (s, km) => `el doble umbral exige una base de unos ${s} km/semana (estás en ${km})`,
    seuilAnnees: (a, actuel) => `también exige unos ${a} años de práctica (tienes ${actuel})`,
    matinFacile: (km, a) => `Despertar muscular: ${km} km muy fáciles en FC Z1-Z2${a ? ` (~${a}/km, o incluso más lento)` : ""}, sin reloj si puedes. El único objetivo es hacer circular, no preparar la sesión de la tarde — si acabas sin aliento, ibas demasiado rápido.`,
  },
  pt: {
    optIn: "a opção «duas sessões por dia» não está ativada no teu perfil",
    douleur: (z) => `dor em curso (${z})`,
    rouge: "frescura no vermelho: não se duplica num dia em que o corpo pede descanso",
    affutage: "semana de afinamento: procuramos frescura, não volume",
    volume: (km, s) => `volume semanal de ${km} km: abaixo de ${s} km basta uma saída por dia e duplicar só acrescenta logística`,
    seuilPrealable: "as condições do duplo leve não estão reunidas",
    seuilVolume: (s, km) => `o duplo limiar exige uma base de cerca de ${s} km/semana (estás em ${km})`,
    seuilAnnees: (a, actuel) => `exige também cerca de ${a} anos de prática (tens ${actuel})`,
    matinFacile: (km, a) => `Despertar muscular: ${km} km muito fáceis em FC Z1-Z2${a ? ` (~${a}/km, ou mais lento)` : ""}, sem relógio se puderes. O único objetivo é pôr a circular, não preparar a sessão da tarde — se acabares sem ar, foi demasiado rápido.`,
  },
};
