/**
 * DEUX E-MAILS QUE LA LOI EXIGE, DANS LA LANGUE DE L'ABONNÉ.
 *
 *  · L'ACCUSÉ DE RÉCEPTION D'UNE RÉTRACTATION : il doit partir « sans retard », sur un
 *    support durable, et dire ce qui a été reçu et quand (art. L221-21). C'est la preuve de
 *    l'abonné : sans lui, rien ne montre qu'il a renoncé dans le délai.
 *  · LE RAPPEL AVANT RECONDUCTION D'UN ABONNEMENT ANNUEL : entre trois mois et un mois
 *    avant l'échéance, il rappelle qu'on peut ne pas le reconduire (art. L215-1). Faute de
 *    quoi l'abonné peut résilier à tout moment et se faire rembourser la période entamée.
 *
 * ⚠️ FONCTIONS PURES : aucune lecture d'environnement, aucun envoi. Les routes construisent
 * le message ici et l'envoient par `lib/email/envoyer`, la seule porte de sortie.
 */
import { EDITEUR } from "@/lib/brand/editeur";
import { normLang, type Lang } from "@/lib/i18n/translations";

const LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };

/** Le nom d'une formule tel qu'on l'écrit (« starter » → « Starter »). */
const nomFormule = (f: string) => (f ? f.charAt(0).toUpperCase() + f.slice(1) : "");

/** Échappe ce qui vient de l'abonné (son nom) avant de l'écrire dans du HTML. */
function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

const montant = (centimes: number, lang: Lang) =>
  (centimes / 100).toLocaleString(LOCALE[lang], { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

const date = (d: Date, lang: Lang) =>
  d.toLocaleDateString(LOCALE[lang], { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });

const heure = (d: Date, lang: Lang) =>
  d.toLocaleTimeString(LOCALE[lang], { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

/** Une date civile AAAA-MM-JJ, écrite en toutes lettres (sans glisser d'un jour). */
const dateCivile = (jour: string, lang: Lang) => date(new Date(`${jour}T12:00:00Z`), lang);

/** Des paragraphes en texte brut → le même message en HTML minimal. */
function enHtml(paragraphes: string[]): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#18181b">${
    paragraphes.map((p) => `<p>${echapper(p).replace(/\n/g, "<br>")}</p>`).join("")
  }</div>`;
}

const signature = `${EDITEUR.nom} — ${EDITEUR.email}`;

// ── ACCUSÉ DE RÉCEPTION D'UNE RÉTRACTATION ───────────────────────────────────────

export type AccuseRetractation = {
  lang: string;
  /** Le nom saisi par l'abonné dans le formulaire de rétractation. */
  nom: string;
  email: string;
  recueLe: Date;
  souscritLe: Date | null;
  formule: string;
  /** Centimes remboursés ; 0 = rien n'avait été prélevé ; `null` = remboursement à
   *  effectuer à la main (Stripe n'a pas répondu). */
  rembourseCentimes: number | null;
};

type TexteAccuse = {
  objet: string;
  bonjour: (nom: string) => string;
  recue: (d: string, h: string) => string;
  contrat: (f: string, d: string | null) => string;
  envoye: (e: string) => string;
  arrete: string;
  rembourse: (m: string) => string;
  rien: string;
  aRembourser: string;
  garde: string;
};

const ACCUSE: Record<Lang, TexteAccuse> = {
  fr: {
    objet: "Accusé de réception de ta rétractation",
    bonjour: (n) => `Bonjour ${n},`,
    recue: (d, h) => `Nous avons bien reçu ta demande de rétractation le ${d} à ${h} (heure de Paris).`,
    contrat: (f, d) => `Contrat concerné : abonnement ${f}${d ? `, souscrit le ${d}` : ""}.`,
    envoye: (e) => `Accusé de réception envoyé à : ${e}.`,
    arrete: "Ton abonnement est arrêté dès maintenant.",
    rembourse: (m) => `Remboursement : ${m}, sur le moyen de paiement utilisé, au plus tard dans les 14 jours (en pratique, sous quelques jours). Tu paies seulement la part du service déjà fournie.`,
    rien: "Aucun montant n'avait été prélevé : il n'y a rien à rembourser.",
    aRembourser: "La part non utilisée de ton paiement te sera remboursée au plus tard dans les 14 jours, sur le moyen de paiement utilisé.",
    garde: "Garde cet e-mail : il prouve la date de ta demande.",
  },
  en: {
    objet: "Acknowledgement of your withdrawal",
    bonjour: (n) => `Hello ${n},`,
    recue: (d, h) => `We received your withdrawal request on ${d} at ${h} (Paris time).`,
    contrat: (f, d) => `Contract concerned: ${f} subscription${d ? `, taken out on ${d}` : ""}.`,
    envoye: (e) => `Acknowledgement sent to: ${e}.`,
    arrete: "Your subscription has been stopped as of now.",
    rembourse: (m) => `Refund: ${m}, to the payment method you used, within 14 days at the latest (in practice, within a few days). You only pay for the part of the service already provided.`,
    rien: "Nothing had been charged: there is nothing to refund.",
    aRembourser: "The unused part of your payment will be refunded within 14 days at the latest, to the payment method you used.",
    garde: "Keep this email: it proves the date of your request.",
  },
  de: {
    objet: "Eingangsbestätigung deines Widerrufs",
    bonjour: (n) => `Hallo ${n},`,
    recue: (d, h) => `Wir haben deinen Widerruf am ${d} um ${h} Uhr (Pariser Zeit) erhalten.`,
    contrat: (f, d) => `Betroffener Vertrag: ${f}-Abo${d ? `, abgeschlossen am ${d}` : ""}.`,
    envoye: (e) => `Eingangsbestätigung gesendet an: ${e}.`,
    arrete: "Dein Abo ist ab sofort beendet.",
    rembourse: (m) => `Erstattung: ${m} auf das verwendete Zahlungsmittel, spätestens innerhalb von 14 Tagen (in der Praxis innerhalb weniger Tage). Du zahlst nur den bereits erbrachten Teil der Leistung.`,
    rien: "Es war noch nichts abgebucht: Es gibt nichts zu erstatten.",
    aRembourser: "Der nicht genutzte Teil deiner Zahlung wird dir spätestens innerhalb von 14 Tagen auf das verwendete Zahlungsmittel erstattet.",
    garde: "Bewahre diese E-Mail auf: Sie belegt das Datum deines Widerrufs.",
  },
  es: {
    objet: "Acuse de recibo de tu desistimiento",
    bonjour: (n) => `Hola ${n}:`,
    recue: (d, h) => `Hemos recibido tu solicitud de desistimiento el ${d} a las ${h} (hora de París).`,
    contrat: (f, d) => `Contrato afectado: suscripción ${f}${d ? `, contratada el ${d}` : ""}.`,
    envoye: (e) => `Acuse de recibo enviado a: ${e}.`,
    arrete: "Tu suscripción queda detenida desde ahora.",
    rembourse: (m) => `Reembolso: ${m}, en el medio de pago utilizado, en un plazo máximo de 14 días (en la práctica, en pocos días). Solo pagas la parte del servicio ya prestada.`,
    rien: "No se había cobrado nada: no hay nada que reembolsar.",
    aRembourser: "La parte no utilizada de tu pago se te reembolsará en un plazo máximo de 14 días, en el medio de pago utilizado.",
    garde: "Conserva este correo: demuestra la fecha de tu solicitud.",
  },
  pt: {
    objet: "Aviso de receção da tua retratação",
    bonjour: (n) => `Olá ${n},`,
    recue: (d, h) => `Recebemos o teu pedido de retratação em ${d} às ${h} (hora de Paris).`,
    contrat: (f, d) => `Contrato em causa: subscrição ${f}${d ? `, feita em ${d}` : ""}.`,
    envoye: (e) => `Aviso de receção enviado para: ${e}.`,
    arrete: "A tua subscrição termina a partir de agora.",
    rembourse: (m) => `Reembolso: ${m}, no meio de pagamento utilizado, no prazo máximo de 14 dias (na prática, em poucos dias). Pagas apenas a parte do serviço já prestada.`,
    rien: "Não tinha sido cobrado nenhum valor: não há nada a reembolsar.",
    aRembourser: "A parte não utilizada do teu pagamento será reembolsada no prazo máximo de 14 dias, no meio de pagamento utilizado.",
    garde: "Guarda este e-mail: comprova a data do teu pedido.",
  },
};

export function emailAccuseRetractation(i: AccuseRetractation): { objet: string; texte: string; html: string } {
  const lang = normLang(i.lang);
  const t = ACCUSE[lang];
  const remboursement = i.rembourseCentimes === null
    ? t.aRembourser
    : i.rembourseCentimes > 0 ? t.rembourse(montant(i.rembourseCentimes, lang)) : t.rien;
  const paragraphes = [
    t.bonjour(i.nom),
    t.recue(date(i.recueLe, lang), heure(i.recueLe, lang)),
    `${t.contrat(nomFormule(i.formule), i.souscritLe ? date(i.souscritLe, lang) : null)}\n${t.envoye(i.email)}`,
    `${t.arrete}\n${remboursement}`,
    t.garde,
    signature,
  ];
  return { objet: t.objet, texte: paragraphes.join("\n\n"), html: enHtml(paragraphes) };
}

// ── RAPPEL AVANT RECONDUCTION D'UN ABONNEMENT ANNUEL ─────────────────────────────

export type RappelReconduction = {
  lang: string;
  formule: string;
  /** Prix du renouvellement, en centimes (plein tarif : une remise de première année ne
   *  se reconduit pas). */
  montantCentimes: number;
  /** Date de reconduction, AAAA-MM-JJ. */
  echeance: string;
  /** Lien direct vers Profil → Abonnement. */
  lien: string;
};

type TexteRappel = {
  objet: (d: string) => string;
  corps: (f: string, d: string, m: string) => string;
  resilier: (lien: string, d: string) => string;
  sinon: string;
  loi: string;
};

const RAPPEL: Record<Lang, TexteRappel> = {
  fr: {
    objet: (d) => `Ton abonnement annuel sera renouvelé le ${d}`,
    corps: (f, d, m) => `Ton abonnement annuel ${f} sera reconduit automatiquement le ${d}, pour ${m}.`,
    resilier: (l, d) => `Si tu ne souhaites pas le reconduire, tu peux le résilier à tout moment d'ici là, depuis Profil → Abonnement : ${l}\nTon accès restera ouvert jusqu'au ${d}.`,
    sinon: "Sans action de ta part, il sera renouvelé pour un an.",
    loi: "Ce message t'est envoyé en application de l'article L215-1 du code de la consommation.",
  },
  en: {
    objet: (d) => `Your annual subscription renews on ${d}`,
    corps: (f, d, m) => `Your annual ${f} subscription will renew automatically on ${d}, for ${m}.`,
    resilier: (l, d) => `If you do not want it renewed, you can cancel it at any time before then, from Profile → Subscription: ${l}\nYour access stays open until ${d}.`,
    sinon: "If you do nothing, it will be renewed for one year.",
    loi: "This message is sent under article L215-1 of the French Consumer Code.",
  },
  de: {
    objet: (d) => `Dein Jahresabo verlängert sich am ${d}`,
    corps: (f, d, m) => `Dein Jahresabo ${f} verlängert sich automatisch am ${d}, für ${m}.`,
    resilier: (l, d) => `Wenn du keine Verlängerung möchtest, kannst du es bis dahin jederzeit kündigen, unter Profil → Abo: ${l}\nDein Zugang bleibt bis zum ${d} offen.`,
    sinon: "Ohne dein Zutun verlängert es sich um ein Jahr.",
    loi: "Diese Nachricht wird gemäß Artikel L215-1 des französischen Verbrauchergesetzbuchs versendet.",
  },
  es: {
    objet: (d) => `Tu suscripción anual se renueva el ${d}`,
    corps: (f, d, m) => `Tu suscripción anual ${f} se renovará automáticamente el ${d}, por ${m}.`,
    resilier: (l, d) => `Si no quieres renovarla, puedes cancelarla en cualquier momento antes de esa fecha, desde Perfil → Suscripción: ${l}\nTu acceso seguirá abierto hasta el ${d}.`,
    sinon: "Si no haces nada, se renovará por un año.",
    loi: "Este mensaje se envía en aplicación del artículo L215-1 del Código de Consumo francés.",
  },
  pt: {
    objet: (d) => `A tua subscrição anual renova-se a ${d}`,
    corps: (f, d, m) => `A tua subscrição anual ${f} será renovada automaticamente a ${d}, por ${m}.`,
    resilier: (l, d) => `Se não a quiseres renovar, podes cancelá-la a qualquer momento até lá, em Perfil → Subscrição: ${l}\nO teu acesso mantém-se aberto até ${d}.`,
    sinon: "Se não fizeres nada, será renovada por um ano.",
    loi: "Esta mensagem é enviada nos termos do artigo L215-1 do Código do Consumo francês.",
  },
};

export function emailRappelReconduction(i: RappelReconduction): { objet: string; texte: string; html: string } {
  const lang = normLang(i.lang);
  const t = RAPPEL[lang];
  const d = dateCivile(i.echeance, lang);
  const paragraphes = [
    t.corps(nomFormule(i.formule), d, montant(i.montantCentimes, lang)),
    t.resilier(i.lien, d),
    t.sinon,
    t.loi,
    signature,
  ];
  return { objet: t.objet(d), texte: paragraphes.join("\n\n"), html: enHtml(paragraphes) };
}
