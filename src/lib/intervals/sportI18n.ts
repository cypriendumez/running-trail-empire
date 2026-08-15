// ─────────────────────────────────────────────────────────────────────────────
//  NOM DES SPORTS DANS LES 5 LANGUES.
//
//  `SPORT_LABEL` (français) est la version canonique : elle part dans le prompt du
//  modèle et dans les analyses. Ces traductions ne servent qu'aux phrases AFFICHÉES —
//  le résumé du cross-training se retrouve dans le « pourquoi » d'une séance
//  (« dont 34 % venant d'un autre sport : 3 × vélo (4 h 10, 294 TSS) »), et une
//  séance allemande ne peut pas se terminer par « randonnée ».
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";
import type { Sport } from "@/lib/intervals/sport";

export const SPORT_LABEL_T: Record<Lang, Record<Sport, string>> = {
  fr: {
    run: "course", bike: "vélo", swim: "natation", row: "rame", ski: "ski",
    hike: "randonnée", walk: "marche", strength: "renforcement", cardio: "cardio",
    mobility: "mobilité", ballsport: "sport de ballon", other: "autre sport",
  },
  en: {
    run: "run", bike: "bike", swim: "swim", row: "row", ski: "ski",
    hike: "hike", walk: "walk", strength: "strength", cardio: "cardio",
    mobility: "mobility", ballsport: "ball sport", other: "other sport",
  },
  de: {
    run: "Lauf", bike: "Rad", swim: "Schwimmen", row: "Rudern", ski: "Ski",
    hike: "Wanderung", walk: "Gehen", strength: "Kraft", cardio: "Cardio",
    mobility: "Mobilität", ballsport: "Ballsport", other: "andere Sportart",
  },
  es: {
    run: "carrera", bike: "bici", swim: "natación", row: "remo", ski: "esquí",
    hike: "senderismo", walk: "marcha", strength: "fuerza", cardio: "cardio",
    mobility: "movilidad", ballsport: "deporte de pelota", other: "otro deporte",
  },
  pt: {
    run: "corrida", bike: "bicicleta", swim: "natação", row: "remo", ski: "esqui",
    hike: "caminhada", walk: "marcha", strength: "força", cardio: "cardio",
    mobility: "mobilidade", ballsport: "desporto com bola", other: "outro desporto",
  },
};

/** « durée non renseignée » — quand la séance importée n'a pas de durée. */
export const DUREE_INCONNUE: Record<Lang, string> = {
  fr: "durée non renseignée",
  en: "duration not recorded",
  de: "Dauer nicht erfasst",
  es: "duración no registrada",
  pt: "duração não registada",
};
