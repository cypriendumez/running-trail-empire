import { coquilleEmail, ligneDesinscription, ech } from "./gabarit";
import type { ArticleResume } from "./resume";
import { EDITEUR } from "@/lib/brand/editeur";

/**
 * L'HABILLAGE DE LA LETTRE, DANS LES CINQ LANGUES.
 *
 * La lettre partait en français pour tout le monde, alors que le reste du produit vit en
 * cinq langues. Un abonné allemand recevait un objet et un pied de page français.
 *
 * ⚠️ Le pied de page contient TOUJOURS le lien de désinscription, dans chaque langue.
 * Ce n'est pas une politesse : un envoi de prospection sans moyen de s'y soustraire est
 * contraire au RGPD, et le pied de page du site le promet déjà.
 *
 * ⚠️ La mention « résumés produits automatiquement » est délibérée. Le blog a dû retirer
 * un auteur « Équipe Pacevo » qui n'avait rien écrit ; on n'invente pas davantage une
 * plume pour la newsletter. Dire ce que c'est coûte trois mots et évite de mentir.
 */

/** Une rubrique de la lettre. Elle n'est rendue QUE si elle a du contenu — une section
 *  vide qui s'affiche quand même donne une lettre creuse, ce qu'on refuse par ailleurs. */
export type Section = { cle: CleSection; articles: ArticleResume[] };
export type CleSection = "une" | "trail" | "elite" | "materiel" | "nutrition";

/** Une course à venir, telle qu'elle sort de la base — jamais inventée. */
export type Course = {
  nom: string; date: string; ville: string | null;
  distance: number | null; url: string | null;
};

export type Lang = "fr" | "en" | "de" | "es" | "pt";
export const LANGS: Lang[] = ["fr", "en", "de", "es", "pt"];
/**
 * Les libellés des rubriques, pour qui doit les CITER ailleurs.
 *
 * ⚠️ L'accusé d'inscription annonce ce que contient la lettre. S'il recopiait la liste,
 * elle se périmerait au premier ajout — « Élites » et « Nutrition » sont apparues le
 * 21/08/2026, et un accusé écrit la veille aurait promis moins que ce qu'on envoie.
 */
export const libellesSections = (lang: Lang): string[] =>
  RUBRIQUES_CITEES.map((c) => (T[lang] ?? T.fr).sections[c]);

/** Les rubriques qu'on ANNONCE — dans l'ordre où elles arrivent dans la lettre. */
const RUBRIQUES_CITEES: CleSection[] = ["une", "trail", "elite", "materiel", "nutrition"];

export const estLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

type Chrome = {
  objet: (semaine: string) => string;
  surtitre: (semaine: string) => string;
  titre: string;
  chapo: string;
  auto: string;
  /**
   * ⚠️ LA MENTION DE REVUE DE PRESSE. Elle n'est pas décorative : elle dit exactement ce
   * que fait cette lettre — citer un titre, nommer l'éditeur, renvoyer chez lui, et
   * résumer avec nos mots — et elle donne à un éditeur une adresse pour demander le
   * retrait. Sans destinataire identifiable, une demande de retrait n'a nulle part où
   * aller, et c'est ce silence qui transforme un désaccord en litige.
   */
  revuePresse: (contact: string) => string;
  pourquoi: string;
  desinscrire: string;
  locale: string;
  sections: Record<CleSection, string>;
  courses: string;
  coursesNote: string;
  voirCourses: string;
};

/**
 * L'adresse à laquelle un éditeur peut demander un retrait.
 *
 * ⚠️ C'est celle des MENTIONS LÉGALES (`app/legalI18n`), pas une adresse inventée pour
 * l'occasion. Une mention de retrait qui pointe vers une boîte inexistante est pire que
 * pas de mention : elle affiche une voie de recours qui n'aboutit nulle part.
 */
const CONTACT = EDITEUR.email;

const T: Record<Lang, Chrome> = {
  fr: {
    objet: (s) => `Running & trail — la semaine du ${s}`,
    surtitre: (s) => `Semaine du ${s}`,
    titre: "L'actualité running et trail",
    chapo: "Ce qu'il fallait retenir cette semaine. Chaque titre renvoie chez l'éditeur — on ne recopie aucun article.",
    auto: "Résumés produits automatiquement à partir des articles cités. Tout chiffre absent de la source d'origine est retiré avant l'envoi.",
    revuePresse: (c) => `Revue de presse : chaque entrée cite le titre et l\u2019éditeur, renvoie vers son site, et le résumé est rédigé par nos soins. Aucun article ni aucune photo n\u2019est reproduit. Un éditeur peut demander le retrait de ses contenus à ${c}.`,
    pourquoi: "Tu reçois cet e-mail parce que tu t'es inscrit sur Pacevo.",
    desinscrire: "Se désinscrire en un clic",
    sections: { une: "À la une", trail: "Trail & ultra", elite: "Élites & résultats", materiel: "Matériel & chaussures", nutrition: "Nutrition" },
    courses: "Les courses qui approchent",
    coursesNote: "Extraites du calendrier de Pacevo. Les modalités font foi sur le site de l'organisateur.",
    voirCourses: "Voir toutes les courses",
    locale: "fr-FR",
  },
  en: {
    objet: (s) => `Running & trail — week of ${s}`,
    surtitre: (s) => `Week of ${s}`,
    titre: "This week in running and trail",
    chapo: "What mattered this week. Every headline links to the publisher — we don't reproduce any article.",
    auto: "Summaries are produced automatically from the articles cited. Any figure absent from the original source is removed before sending.",
    revuePresse: (c) => `Press review: each entry cites the headline and the publisher, links to their site, and the summary is written by us. No article or photograph is reproduced. Publishers may request removal of their content at ${c}.`,
    pourquoi: "You're receiving this because you subscribed on Pacevo.",
    desinscrire: "Unsubscribe in one click",
    sections: { une: "Headlines", trail: "Trail & ultra", elite: "Elites & results", materiel: "Gear & shoes", nutrition: "Nutrition" },
    courses: "Races coming up",
    coursesNote: "Taken from Pacevo's race calendar. The organiser's site is the authority on entry terms.",
    voirCourses: "See all races",
    locale: "en-GB",
  },
  de: {
    objet: (s) => `Laufen & Trail — Woche vom ${s}`,
    surtitre: (s) => `Woche vom ${s}`,
    titre: "Die Woche im Laufsport",
    chapo: "Was diese Woche zählte. Jede Überschrift führt zum Verlag — wir geben keinen Artikel wieder.",
    auto: "Die Zusammenfassungen entstehen automatisch aus den genannten Artikeln. Jede Zahl, die in der Originalquelle fehlt, wird vor dem Versand entfernt.",
    revuePresse: (c) => `Pressespiegel: Jeder Eintrag nennt Titel und Verlag, verlinkt auf dessen Website; die Zusammenfassung stammt von uns. Kein Artikel und kein Foto wird wiedergegeben. Verlage können die Entfernung ihrer Inhalte unter ${c} verlangen.`,
    pourquoi: "Du erhältst diese E-Mail, weil du dich auf Pacevo angemeldet hast.",
    desinscrire: "Mit einem Klick abmelden",
    sections: { une: "Schlagzeilen", trail: "Trail & Ultra", elite: "Elite & Ergebnisse", materiel: "Ausrüstung & Schuhe", nutrition: "Ernährung" },
    courses: "Anstehende Rennen",
    coursesNote: "Aus dem Rennkalender von Pacevo. Maßgeblich sind die Angaben des Veranstalters.",
    voirCourses: "Alle Rennen ansehen",
    locale: "de-DE",
  },
  es: {
    objet: (s) => `Running y trail — semana del ${s}`,
    surtitre: (s) => `Semana del ${s}`,
    titre: "La actualidad del running y el trail",
    chapo: "Lo que ha contado esta semana. Cada titular lleva al editor — no reproducimos ningún artículo.",
    auto: "Los resúmenes se generan automáticamente a partir de los artículos citados. Toda cifra ausente de la fuente original se elimina antes del envío.",
    revuePresse: (c) => `Revista de prensa: cada entrada cita el titular y el editor, enlaza a su sitio, y el resumen lo redactamos nosotros. No se reproduce ningún artículo ni fotografía. Los editores pueden solicitar la retirada de sus contenidos en ${c}.`,
    pourquoi: "Recibes este correo porque te suscribiste en Pacevo.",
    desinscrire: "Darse de baja en un clic",
    sections: { une: "Titulares", trail: "Trail y ultra", elite: "Élites y resultados", materiel: "Material y zapatillas", nutrition: "Nutrición" },
    courses: "Carreras que se acercan",
    coursesNote: "Extraídas del calendario de Pacevo. La web del organizador es la referencia para inscribirse.",
    voirCourses: "Ver todas las carreras",
    locale: "es-ES",
  },
  pt: {
    objet: (s) => `Corrida e trail — semana de ${s}`,
    surtitre: (s) => `Semana de ${s}`,
    titre: "A atualidade da corrida e do trail",
    chapo: "O que contou esta semana. Cada título leva ao editor — não reproduzimos nenhum artigo.",
    auto: "Os resumos são gerados automaticamente a partir dos artigos citados. Qualquer número ausente da fonte original é removido antes do envio.",
    revuePresse: (c) => `Revista de imprensa: cada entrada cita o título e o editor, remete para o seu site, e o resumo é redigido por nós. Nenhum artigo ou fotografia é reproduzido. Os editores podem pedir a remoção dos seus conteúdos em ${c}.`,
    pourquoi: "Recebes este e-mail porque te inscreveste no Pacevo.",
    desinscrire: "Cancelar a subscrição num clique",
    sections: { une: "Destaques", trail: "Trail e ultra", elite: "Elites e resultados", materiel: "Equipamento e sapatilhas", nutrition: "Nutrição" },
    courses: "Provas que se aproximam",
    coursesNote: "Retiradas do calendário do Pacevo. O site do organizador é a referência para inscrição.",
    voirCourses: "Ver todas as provas",
    locale: "pt-PT",
  },
};


export const semaineDe = (lang: Lang, d = new Date()) =>
  d.toLocaleDateString(T[lang].locale, { day: "numeric", month: "long" });

const listeArticles = (articles: ArticleResume[]) =>
  articles
    .map(
      (a) => `<li style="margin:0 0 1.4rem;padding:0">
  <a href="${ech(a.link)}" style="color:#18181b;text-decoration:none;font-weight:650;font-size:1rem;line-height:1.4">${ech(a.title)}</a>
  <div style="margin:.2rem 0 0;font-size:.74rem;color:#a1a1aa">${ech(a.source)}</div>
  ${a.resume ? `<p style="margin:.5rem 0 0;font-size:.9rem;line-height:1.65;color:#52525b">${ech(a.resume)}</p>` : ""}
</li>`,
    )
    .join("");

const titreRubrique = (texte: string) =>
  `<h2 style="margin:2.25rem 0 1rem;font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669">${ech(texte)}</h2>`;

/**
 * Construit la lettre.
 *
 * ⚠️ Une rubrique VIDE n'est pas rendue. La lettre refuse déjà de partir quand la semaine
 * compte moins de cinq articles ; afficher « Matériel & chaussures » suivi de rien serait
 * la même faute en plus petit — annoncer un contenu qu'on n'a pas.
 */
export function construireEmail(
  lang: Lang,
  sections: Section[],
  courses: Course[],
  lienDesinscription: string,
  base: string,
): { objet: string; html: string; texte: string } {
  const t = T[lang];
  const semaine = semaineDe(lang);
  const tous = sections.flatMap((sec) => sec.articles);
  const auMoinsUnResume = tous.some((a) => a.resume);
  const pleines = sections.filter((sec) => sec.articles.length);

  const corpsSections = pleines
    .map((sec) => `${titreRubrique(t.sections[sec.cle])}<ul style="margin:0;padding:0;list-style:none">${listeArticles(sec.articles)}</ul>`)
    .join("");

  // Les courses viennent de la base, jamais d'un modèle : nom, date, ville et distance
  // sont des faits. C'est la seule rubrique de la lettre qui ne dépend d'aucune IA.
  const dateCourse = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(T[lang].locale, { day: "numeric", month: "short" });

  const corpsCourses = courses.length
    ? `${titreRubrique(t.courses)}
<ul style="margin:0;padding:0;list-style:none">${courses
        .map(
          (c) => `<li style="margin:0 0 .85rem;font-size:.92rem;line-height:1.5">
  <span style="color:#a1a1aa;font-variant-numeric:tabular-nums">${ech(dateCourse(c.date))}</span>
  ${c.url ? `<a href="${ech(c.url)}" style="color:#18181b;text-decoration:none;font-weight:600">${ech(c.nom)}</a>` : `<span style="font-weight:600">${ech(c.nom)}</span>`}
  <span style="color:#71717a">${[c.ville, c.distance ? `${c.distance} km` : null].filter((x): x is string => Boolean(x)).map(ech).join(" · ")}</span>
</li>`,
        )
        .join("")}</ul>
<p style="margin:.9rem 0 0;font-size:.74rem;color:#a1a1aa;line-height:1.55">${ech(t.coursesNote)}
  <a href="${ech(base)}/dashboard/races" style="color:#059669">${ech(t.voirCourses)}</a></p>`
    : "";

  const corps = `
      <h1 style="margin:14px 0 10px;font-size:22px;line-height:1.28;color:#18181b;font-weight:800">${ech(t.titre)}</h1>
      <p style="margin:0;font-size:14px;line-height:1.65;color:#71717a">${ech(t.chapo)}</p>
      ${corpsSections}
      ${corpsCourses}`;

  const pied = `
      ${auMoinsUnResume ? `<p style="margin:0 0 8px">${ech(t.auto)}</p>` : ""}
      <p style="margin:0 0 8px">${ech(t.revuePresse(CONTACT))}</p>
      <p style="margin:0">${ech(t.pourquoi)}<br>${ligneDesinscription(t.desinscrire, lienDesinscription)}</p>`;

  const html = coquilleEmail({ base, surtitre: ech(t.surtitre(semaine)), corps, pied });

  const texteSections = pleines
    .map((sec) => `\n\n## ${t.sections[sec.cle].toUpperCase()}\n\n${sec.articles.map((a) => `• ${a.title}\n  ${a.source} — ${a.link}${a.resume ? `\n  ${a.resume}` : ""}`).join("\n\n")}`)
    .join("");
  const texteCourses = courses.length
    ? `\n\n## ${t.courses.toUpperCase()}\n\n${courses.map((c) => `• ${dateCourse(c.date)} — ${c.nom}${c.ville ? ` (${c.ville})` : ""}${c.distance ? ` · ${c.distance} km` : ""}${c.url ? `\n  ${c.url}` : ""}`).join("\n")}\n\n${t.coursesNote}`
    : "";

  const texte = `PACEVO — ${t.surtitre(semaine)}
${t.titre}
${t.chapo}${texteSections}${texteCourses}

—
${auMoinsUnResume ? `${t.auto}\n` : ""}${t.revuePresse(CONTACT)}\n${t.pourquoi}
${t.desinscrire} : ${lienDesinscription}`;

  return { objet: t.objet(semaine), html, texte };
}
