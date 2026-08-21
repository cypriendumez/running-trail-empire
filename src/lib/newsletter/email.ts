import type { ArticleResume } from "./resume";

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

export type Lang = "fr" | "en" | "de" | "es" | "pt";
export const LANGS: Lang[] = ["fr", "en", "de", "es", "pt"];
export const estLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

type Chrome = {
  objet: (semaine: string) => string;
  surtitre: (semaine: string) => string;
  titre: string;
  chapo: string;
  auto: string;
  pourquoi: string;
  desinscrire: string;
  locale: string;
};

const T: Record<Lang, Chrome> = {
  fr: {
    objet: (s) => `Running & trail — la semaine du ${s}`,
    surtitre: (s) => `Semaine du ${s}`,
    titre: "L'actualité running et trail",
    chapo: "Ce qu'il fallait retenir cette semaine. Chaque titre renvoie chez l'éditeur — on ne recopie aucun article.",
    auto: "Résumés produits automatiquement à partir des articles cités. Tout chiffre absent de la source d'origine est retiré avant l'envoi.",
    pourquoi: "Tu reçois cet e-mail parce que tu t'es inscrit sur Pacevo.",
    desinscrire: "Se désinscrire en un clic",
    locale: "fr-FR",
  },
  en: {
    objet: (s) => `Running & trail — week of ${s}`,
    surtitre: (s) => `Week of ${s}`,
    titre: "This week in running and trail",
    chapo: "What mattered this week. Every headline links to the publisher — we don't reproduce any article.",
    auto: "Summaries are produced automatically from the articles cited. Any figure absent from the original source is removed before sending.",
    pourquoi: "You're receiving this because you subscribed on Pacevo.",
    desinscrire: "Unsubscribe in one click",
    locale: "en-GB",
  },
  de: {
    objet: (s) => `Laufen & Trail — Woche vom ${s}`,
    surtitre: (s) => `Woche vom ${s}`,
    titre: "Die Woche im Laufsport",
    chapo: "Was diese Woche zählte. Jede Überschrift führt zum Verlag — wir geben keinen Artikel wieder.",
    auto: "Die Zusammenfassungen entstehen automatisch aus den genannten Artikeln. Jede Zahl, die in der Originalquelle fehlt, wird vor dem Versand entfernt.",
    pourquoi: "Du erhältst diese E-Mail, weil du dich auf Pacevo angemeldet hast.",
    desinscrire: "Mit einem Klick abmelden",
    locale: "de-DE",
  },
  es: {
    objet: (s) => `Running y trail — semana del ${s}`,
    surtitre: (s) => `Semana del ${s}`,
    titre: "La actualidad del running y el trail",
    chapo: "Lo que ha contado esta semana. Cada titular lleva al editor — no reproducimos ningún artículo.",
    auto: "Los resúmenes se generan automáticamente a partir de los artículos citados. Toda cifra ausente de la fuente original se elimina antes del envío.",
    pourquoi: "Recibes este correo porque te suscribiste en Pacevo.",
    desinscrire: "Darse de baja en un clic",
    locale: "es-ES",
  },
  pt: {
    objet: (s) => `Corrida e trail — semana de ${s}`,
    surtitre: (s) => `Semana de ${s}`,
    titre: "A atualidade da corrida e do trail",
    chapo: "O que contou esta semana. Cada título leva ao editor — não reproduzimos nenhum artigo.",
    auto: "Os resumos são gerados automaticamente a partir dos artigos citados. Qualquer número ausente da fonte original é removido antes do envio.",
    pourquoi: "Recebes este e-mail porque te inscreveste no Pacevo.",
    desinscrire: "Cancelar a subscrição num clique",
    locale: "pt-PT",
  },
};

const ech = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const semaineDe = (lang: Lang, d = new Date()) =>
  d.toLocaleDateString(T[lang].locale, { day: "numeric", month: "long" });

export function construireEmail(
  lang: Lang,
  articles: ArticleResume[],
  lienDesinscription: string,
): { objet: string; html: string; texte: string } {
  const t = T[lang];
  const semaine = semaineDe(lang);
  // Un résumé au moins quelque part : sinon la mention « produits automatiquement »
  // n'a rien à qualifier et n'est que du bruit en bas de page.
  const auMoinsUnResume = articles.some((a) => a.resume);

  const corps = articles
    .map(
      (a) => `<li style="margin:0 0 1.5rem;padding:0">
  <a href="${ech(a.link)}" style="color:#18181b;text-decoration:none;font-weight:650;font-size:1.02rem;line-height:1.4">${ech(a.title)}</a>
  <div style="margin:.2rem 0 0;font-size:.76rem;color:#a1a1aa">${ech(a.source)}</div>
  ${a.resume ? `<p style="margin:.55rem 0 0;font-size:.92rem;line-height:1.65;color:#52525b">${ech(a.resume)}</p>` : ""}
</li>`,
    )
    .join("");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:37rem;margin:0 auto;padding:2rem 1.5rem;color:#18181b;background:#fff">
  <div style="font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#059669">Pacevo · ${ech(t.surtitre(semaine))}</div>
  <h1 style="margin:.9rem 0 .4rem;font-size:1.4rem;line-height:1.25">${ech(t.titre)}</h1>
  <p style="margin:0 0 2rem;font-size:.88rem;line-height:1.6;color:#71717a">${ech(t.chapo)}</p>
  <ul style="margin:0;padding:0;list-style:none">${corps}</ul>
  <div style="margin:2.25rem 0 0;padding-top:1.25rem;border-top:1px solid #e4e4e7;font-size:.74rem;color:#a1a1aa;line-height:1.65">
    ${auMoinsUnResume ? `<p style="margin:0 0 .75rem">${ech(t.auto)}</p>` : ""}
    <p style="margin:0">${ech(t.pourquoi)}<br>
    <a href="${ech(lienDesinscription)}" style="color:#71717a">${ech(t.desinscrire)}</a></p>
  </div>
</div>`;

  const texte = `PACEVO — ${t.surtitre(semaine)}
${t.titre}
${t.chapo}

${articles.map((a) => `• ${a.title}\n  ${a.source} — ${a.link}${a.resume ? `\n  ${a.resume}` : ""}`).join("\n\n")}

—
${auMoinsUnResume ? `${t.auto}\n` : ""}${t.pourquoi}
${t.desinscrire} : ${lienDesinscription}`;

  return { objet: t.objet(semaine), html, texte };
}
