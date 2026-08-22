import { coquilleEmail, ligneDesinscription, ech } from "./gabarit";
import { libellesSections, type Lang, estLang } from "./email";

/**
 * L'ACCUSÉ D'INSCRIPTION, dans la langue de l'abonné.
 *
 * ⚠️ IL PARTAIT EN FRANÇAIS POUR TOUT LE MONDE. La route connaissait pourtant la langue
 * choisie — elle l'écrivait dans `newsletter_subscribers.lang` à la ligne d'avant, puis
 * envoyait un message français à un abonné allemand. Le tout premier message qu'une
 * personne reçoit de Pacevo est celui qui décide si elle fait confiance à la suite.
 *
 * ⚠️ La promesse « rien d'autre » est tenue par le code, pas par la formule : cette
 * adresse ne sert qu'à la lettre du lundi (voir `api/newsletter/weekly`), et le lien de
 * désinscription est donné AVANT le premier envoi — on peut partir sans avoir rien reçu.
 */
type Bloc = {
  objet: string; titre: string; p1: string;
  /** Le titre de la liste : « Chaque lundi, tu recevras : ». */
  sommaire: string;
  /** Ce qui suit la liste : le rendez-vous, et la promesse de ne rien envoyer d'autre. */
  quand: string; p2: string;
  voirLeSite: string; desinscrire: string; pourquoi: string;
};

const T: Record<string, Bloc> = {
  fr: {
    objet: "Tu es inscrit au résumé Pacevo",
    titre: "Tu es bien inscrit",
    p1: "Merci. Voilà ce qui t'attend, et rien de plus.",
    sommaire: "Chaque lundi matin, cinq rubriques :",
    quand: "Plus les courses qui approchent, tirées du calendrier de Pacevo.",
    p2: "C'est notre seul envoi récurrent. Cette adresse ne sert à rien d'autre, et chaque titre renvoie chez son éditeur — on ne recopie aucun article.",
    voirLeSite: "Découvrir Pacevo",
    desinscrire: "Se désinscrire",
    pourquoi: "Tu reçois ce message parce que tu viens de t'inscrire à la lettre Pacevo.",
  },
  en: {
    objet: "You're subscribed to the Pacevo digest",
    titre: "You're subscribed",
    p1: "Thank you. Here is what's coming, and nothing more.",
    sommaire: "Every Monday morning, five sections:",
    quand: "Plus the races coming up, taken from the Pacevo calendar.",
    p2: "It's our only recurring email. This address is used for nothing else, and every headline links to its publisher — we don't reproduce any article.",
    voirLeSite: "Explore Pacevo",
    desinscrire: "Unsubscribe",
    pourquoi: "You're getting this because you just subscribed to the Pacevo digest.",
  },
  de: {
    objet: "Du hast den Pacevo-Wochenrückblick abonniert",
    titre: "Du bist angemeldet",
    p1: "Danke. Das erwartet dich — und nichts weiter.",
    sommaire: "Jeden Montagmorgen, fünf Rubriken:",
    quand: "Dazu die anstehenden Rennen aus dem Pacevo-Kalender.",
    p2: "Das ist unsere einzige wiederkehrende E-Mail. Diese Adresse wird für nichts anderes verwendet, und jede Überschrift führt zum Verlag — wir geben keinen Artikel wieder.",
    voirLeSite: "Pacevo entdecken",
    desinscrire: "Abmelden",
    pourquoi: "Du erhältst diese Nachricht, weil du dich gerade für den Pacevo-Rückblick angemeldet hast.",
  },
  es: {
    objet: "Estás suscrito al resumen de Pacevo",
    titre: "Ya estás suscrito",
    p1: "Gracias. Esto es lo que te espera, y nada más.",
    sommaire: "Cada lunes por la mañana, cinco secciones:",
    quand: "Además de las carreras que se acercan, del calendario de Pacevo.",
    p2: "Es nuestro único envío recurrente. Esta dirección no se usa para nada más, y cada titular lleva a su medio — no reproducimos ningún artículo.",
    voirLeSite: "Descubrir Pacevo",
    desinscrire: "Darse de baja",
    pourquoi: "Recibes este mensaje porque acabas de suscribirte al resumen de Pacevo.",
  },
  pt: {
    objet: "Estás inscrito no resumo da Pacevo",
    titre: "Estás inscrito",
    p1: "Obrigado. É isto que te espera, e nada mais.",
    sommaire: "Todas as segundas de manhã, cinco rubricas:",
    quand: "Mais as provas que se aproximam, do calendário da Pacevo.",
    p2: "É o nosso único envio recorrente. Este endereço não serve para mais nada, e cada título remete para o seu editor — não reproduzimos nenhum artigo.",
    voirLeSite: "Descobrir a Pacevo",
    desinscrire: "Cancelar a subscrição",
    pourquoi: "Recebes esta mensagem porque acabaste de te inscrever no resumo da Pacevo.",
  },
};

export function emailConfirmation(lang: string, base: string, lien: string): { objet: string; html: string; texte: string } {
  const t = T[lang] ?? T.fr;
  const lg: Lang = estLang(lang) ? lang : "fr";
  // ⚠️ Les rubriques viennent de `lib/newsletter/email`, pas d'une liste recopiée ici :
  // « Élites » et « Nutrition » sont apparues le 21/08/2026, et un accusé écrit la
  // veille aurait promis moins que ce qu'on envoie réellement.
  const rubriques = libellesSections(lg);

  const puces = rubriques.map((r) => `
        <tr><td style="padding:4px 0;font-size:15px;line-height:1.6;color:#3f3f46">
          <span style="color:#059669;font-weight:700">·</span>&nbsp;&nbsp;${ech(r)}
        </td></tr>`).join("");

  const corps = `
      <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;color:#18181b;font-weight:800">${ech(t.titre)}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#52525b">${ech(t.p1)}</p>

      <div style="background:#fafafa;border-radius:12px;padding:18px 20px;border:1px solid #f4f4f5">
        <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#71717a">${ech(t.sommaire)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px;width:100%">${puces}</table>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#71717a">${ech(t.quand)}</p>
      </div>

      <p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#71717a">${ech(t.p2)}</p>

      <div style="margin-top:26px">
        <a href="${ech(base)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:999px">${ech(t.voirLeSite)}</a>
      </div>`;

  const pied = `<p style="margin:0">${ech(t.pourquoi)}<br>${ligneDesinscription(t.desinscrire, lien)}</p>`;
  return {
    objet: t.objet,
    // ⚠️ Pas de sur-titre « PACEVO » : l'en-tête au-dessus de la carte porte déjà le logo
    // ET le mot. Le répéter à 3 cm d'intervalle donnait l'air d'un gabarit mal fini.
    html: coquilleEmail({ base, corps, pied }),
    // La version texte PORTE l'adresse complète : sans HTML, il n'y a pas de lien à
    // cliquer, seulement du texte à recopier.
    texte: [t.titre, "", t.p1, "", t.sommaire, ...rubriques.map((r) => `  - ${r}`), t.quand, "", t.p2, "", t.pourquoi, `${t.desinscrire} : ${lien}`].join("\n"),
  };
}
