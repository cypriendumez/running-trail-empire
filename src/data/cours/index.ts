import type { ChapterContent, QuizQuestion, CoursUI } from "./types";
import { CHAPTERS_FR, CHAPTERS_FR_SUPP, EXTRAS_FR, QUIZ_FR, QUIZ_FR_SUPP, UI_FR } from "./fr";
import { CHAPTERS_EN, CHAPTERS_EN_SUPP, EXTRAS_EN, QUIZ_EN, QUIZ_EN_SUPP, UI_EN } from "./en";
import { CHAPTERS_DE, CHAPTERS_DE_SUPP, EXTRAS_DE, QUIZ_DE, QUIZ_DE_SUPP, UI_DE } from "./de";
import { CHAPTERS_ES, CHAPTERS_ES_SUPP, EXTRAS_ES, QUIZ_ES, QUIZ_ES_SUPP, UI_ES } from "./es";
import { CHAPTERS_PT, CHAPTERS_PT_SUPP, EXTRAS_PT, QUIZ_PT, QUIZ_PT_SUPP, UI_PT } from "./pt";
import { SOURCES_COURS } from "./sources";

export type CoursContent = { chapters: ChapterContent[]; quiz: QuizQuestion[]; ui: CoursUI };

type Extras = Record<string, Pick<ChapterContent, "objectif" | "erreurs" | "action">>;

/**
 * Assemble un cours : les chapitres d'origine + les chapitres ajoutés le 22/09/2026, chacun
 * joint à son objectif / ses erreurs / son action (par langue) et à ses sources (communes).
 * Un chapitre sans extras reste un chapitre — le rendu s'en accommode.
 */
function assembler(base: ChapterContent[], supp: ChapterContent[], extras: Extras, quiz: QuizQuestion[], quizSupp: QuizQuestion[], ui: CoursUI): CoursContent {
  const chapters = [...base, ...supp].map((c) => ({ ...c, ...(extras[c.id] ?? {}), sources: SOURCES_COURS[c.id] ?? [] }));
  return { chapters, quiz: [...quiz, ...quizSupp], ui };
}

const ALL: Record<string, CoursContent> = {
  fr: assembler(CHAPTERS_FR, CHAPTERS_FR_SUPP, EXTRAS_FR, QUIZ_FR, QUIZ_FR_SUPP, UI_FR),
  en: assembler(CHAPTERS_EN, CHAPTERS_EN_SUPP, EXTRAS_EN, QUIZ_EN, QUIZ_EN_SUPP, UI_EN),
  de: assembler(CHAPTERS_DE, CHAPTERS_DE_SUPP, EXTRAS_DE, QUIZ_DE, QUIZ_DE_SUPP, UI_DE),
  es: assembler(CHAPTERS_ES, CHAPTERS_ES_SUPP, EXTRAS_ES, QUIZ_ES, QUIZ_ES_SUPP, UI_ES),
  pt: assembler(CHAPTERS_PT, CHAPTERS_PT_SUPP, EXTRAS_PT, QUIZ_PT, QUIZ_PT_SUPP, UI_PT),
};

export const getCoursContent = (lang: string): CoursContent => ALL[lang] ?? ALL.fr;
