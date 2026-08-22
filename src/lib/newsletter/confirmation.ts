import { coquilleEmail, ligneDesinscription, ech } from "./gabarit";

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
type Bloc = { objet: string; titre: string; p1: string; p2: string; desinscrire: string; pourquoi: string };

const T: Record<string, Bloc> = {
  fr: {
    objet: "Tu es inscrit au résumé Pacevo",
    titre: "Tu es bien inscrit",
    p1: "Chaque lundi matin, tu recevras un résumé de l'actualité running et trail : les titres de la semaine, leur source, et le lien pour lire chez l'éditeur.",
    p2: "C'est notre seul envoi récurrent. Cette adresse ne sert à rien d'autre.",
    desinscrire: "Se désinscrire",
    pourquoi: "Tu reçois ce message parce que tu viens de t'inscrire à la lettre Pacevo.",
  },
  en: {
    objet: "You're subscribed to the Pacevo digest",
    titre: "You're subscribed",
    p1: "Every Monday morning you'll get a summary of running and trail news: the week's headlines, their source, and the link to read them at the publisher.",
    p2: "It's our only recurring email. This address is used for nothing else.",
    desinscrire: "Unsubscribe",
    pourquoi: "You're getting this because you just subscribed to the Pacevo digest.",
  },
  de: {
    objet: "Du hast den Pacevo-Wochenrückblick abonniert",
    titre: "Du bist angemeldet",
    p1: "Jeden Montagmorgen bekommst du eine Zusammenfassung der Lauf- und Trail-News: die Schlagzeilen der Woche, ihre Quelle und den Link zum Verlag.",
    p2: "Das ist unsere einzige wiederkehrende E-Mail. Diese Adresse wird für nichts anderes verwendet.",
    desinscrire: "Abmelden",
    pourquoi: "Du erhältst diese Nachricht, weil du dich gerade für den Pacevo-Rückblick angemeldet hast.",
  },
  es: {
    objet: "Estás suscrito al resumen de Pacevo",
    titre: "Ya estás suscrito",
    p1: "Cada lunes por la mañana recibirás un resumen de la actualidad del running y el trail: los titulares de la semana, su fuente y el enlace para leerlos en el medio.",
    p2: "Es nuestro único envío recurrente. Esta dirección no se usa para nada más.",
    desinscrire: "Darse de baja",
    pourquoi: "Recibes este mensaje porque acabas de suscribirte al resumen de Pacevo.",
  },
  pt: {
    objet: "Estás inscrito no resumo da Pacevo",
    titre: "Estás inscrito",
    p1: "Todas as segundas de manhã vais receber um resumo da atualidade da corrida e do trail: os títulos da semana, a fonte e a ligação para ler no editor.",
    p2: "É o nosso único envio recorrente. Este endereço não serve para mais nada.",
    desinscrire: "Cancelar a subscrição",
    pourquoi: "Recebes esta mensagem porque acabaste de te inscrever no resumo da Pacevo.",
  },
};

export function emailConfirmation(lang: string, base: string, lien: string): { objet: string; html: string; texte: string } {
  const t = T[lang] ?? T.fr;
  const corps = `
      <h1 style="margin:14px 0 12px;font-size:22px;line-height:1.3;color:#18181b;font-weight:800">${ech(t.titre)}</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#52525b">${ech(t.p1)}</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#52525b">${ech(t.p2)}</p>`;
  const pied = `<p style="margin:0">${ech(t.pourquoi)}<br>${ligneDesinscription(t.desinscrire, lien)}</p>`;
  return {
    objet: t.objet,
    html: coquilleEmail({ base, surtitre: "Pacevo", corps, pied }),
    // La version texte, elle, PORTE l'adresse complète : un client sans HTML n'a pas de
    // lien à cliquer, seulement du texte à recopier.
    texte: `${t.titre}\n\n${t.p1}\n\n${t.p2}\n\n${t.pourquoi}\n${t.desinscrire} : ${lien}`,
  };
}
