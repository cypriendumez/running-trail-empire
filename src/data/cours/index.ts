import type { ChapterContent, QuizQuestion, CoursUI } from "./types";
import { CHAPTERS_FR, QUIZ_FR, UI_FR } from "./fr";
import { CHAPTERS_EN, QUIZ_EN, UI_EN } from "./en";
import { CHAPTERS_DE, QUIZ_DE, UI_DE } from "./de";
import { CHAPTERS_ES, QUIZ_ES, UI_ES } from "./es";
import { CHAPTERS_PT, QUIZ_PT, UI_PT } from "./pt";

export type CoursContent = { chapters: ChapterContent[]; quiz: QuizQuestion[]; ui: CoursUI };

const ALL: Record<string, CoursContent> = {
  fr: { chapters: CHAPTERS_FR, quiz: QUIZ_FR, ui: UI_FR },
  en: { chapters: CHAPTERS_EN, quiz: QUIZ_EN, ui: UI_EN },
  de: { chapters: CHAPTERS_DE, quiz: QUIZ_DE, ui: UI_DE },
  es: { chapters: CHAPTERS_ES, quiz: QUIZ_ES, ui: UI_ES },
  pt: { chapters: CHAPTERS_PT, quiz: QUIZ_PT, ui: UI_PT },
};

export const getCoursContent = (lang: string): CoursContent => ALL[lang] ?? ALL.fr;
