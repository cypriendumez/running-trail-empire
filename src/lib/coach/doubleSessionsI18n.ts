// ─────────────────────────────────────────────────────────────────────────────
//  TRADUCTIONS DES MOTIFS DE REFUS DES DOUBLES SÉANCES.
//
//  Ces phrases s'affichent dans le PROFIL, à la seconde où l'athlète coche la case.
//  Elles étaient en français quelle que soit sa langue : un utilisateur allemand
//  lisait des libellés traduits… suivis d'un verdict en français.
//
//  ⚠️ CE QUI RESTE VOLONTAIREMENT EN FRANÇAIS, ET POURQUOI. Les DESCRIPTIONS DE SÉANCE
//  (« Réveil musculaire : 6 km très faciles… ») ne sont pas traduites ici, parce que
//  TOUT le plan est en français : `autoPlan` écrit chaque échauffement, chaque corps de
//  séance et chaque retour au calme en français, en dur. Traduire ces trois phrases-là
//  et elles seules produirait une séance allemande au milieu d'un plan français —
//  pire que l'état actuel. La traduction du plan est une dette entière et séparée ;
//  la mélanger ici donnerait l'illusion qu'elle est réglée.
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
  },
};
