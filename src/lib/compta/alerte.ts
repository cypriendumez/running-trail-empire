import { coquilleEmail, ech } from "@/lib/newsletter/gabarit";
import { euros } from "./model";
import type { NouvelleEcriture } from "./stripe";

/**
 * « TU VIENS D'ÊTRE PAYÉ » — l'e-mail à l'éditeur.
 *
 * ⚠️ Il annonce le montant BRUT ET le net après commission, jamais l'un des deux seul.
 * Le brut est ce qu'on déclare, le net est ce qui arrive sur le compte : croire que le
 * premier atterrit en banque, ou que le second est le chiffre d'affaires, fausse tout le
 * raisonnement — et c'est une erreur qu'on ne découvre qu'à la déclaration.
 */
export function emailEncaissement(opts: { ecritures: NouvelleEcriture[]; base: string }): { objet: string; html: string; texte: string } {
  const { ecritures, base } = opts;
  const recette = ecritures.find((e) => e.sens === "entree");
  const frais = ecritures.find((e) => e.categorie === "frais_bancaires");
  const brut = recette?.montantCents ?? 0;
  const commission = frais?.montantCents ?? 0;

  const ligne = (l: string, v: string, fort = false) =>
    `<tr><td style="padding:6px 0;color:#71717a;font-size:14px">${ech(l)}</td>` +
    `<td style="padding:6px 0;text-align:right;font-size:${fort ? "16px;font-weight:700;color:#18181b" : "14px;color:#3f3f46"}">${ech(v)}</td></tr>`;

  const corps = `
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#18181b">${ech(euros(brut))} encaissés</h1>
    <p style="margin:0 0 20px;color:#71717a;font-size:15px">${ech(recette?.tiers ?? "Un client")} vient de payer son abonnement.</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin-bottom:20px">
      ${ligne("Montant brut", euros(brut))}
      ${commission ? ligne("Commission Stripe", "− " + euros(commission)) : ""}
      ${ligne("Net sur ton compte", euros(brut - commission), true)}
      ${recette?.piece ? ligne("Facture", recette.piece) : ""}
      ${recette?.date ? ligne("Date", recette.date.split("-").reverse().join("/")) : ""}
    </table>
    ${commission ? "" : `<p style="margin:0 0 20px;padding:12px;background:#fffbeb;border-radius:10px;color:#92400e;font-size:13px">La commission Stripe n'a pas pu être lue : elle n'est pas encore au journal. À saisir à la main pour que les dépenses soient justes.</p>`}
    <p style="margin:0"><a href="${base.replace(/\/$/, "")}/admin" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Ouvrir la comptabilité →</a></p>`;

  const texte = [
    `${euros(brut)} encaissés — ${recette?.tiers ?? "un client"}`,
    `Brut : ${euros(brut)}`,
    commission ? `Commission Stripe : −${euros(commission)}` : "Commission Stripe : non récupérée, à saisir à la main",
    `Net : ${euros(brut - commission)}`,
    recette?.piece ? `Facture : ${recette.piece}` : "",
    `${base.replace(/\/$/, "")}/admin`,
  ].filter(Boolean).join("\n");

  return {
    objet: `💶 ${euros(brut)} — ${recette?.tiers ?? "nouvel abonnement"}`,
    html: coquilleEmail({
      base, surtitre: "Encaissement",
      corps,
      pied: "Écriture déjà enregistrée dans ton journal comptable. Tu reçois ce message parce que tu es l'éditeur de Pacevo.",
    }),
    texte,
  };
}

/** Alerte quand un encaissement a eu lieu mais qu'AUCUNE écriture n'a pu être créée. */
export function emailAlerteCompta(opts: { raison: string; base: string }): { objet: string; html: string; texte: string } {
  const corps = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#18181b">Un mouvement d'argent n'a pas pu être enregistré</h1>
    <p style="margin:0 0 16px;color:#3f3f46;font-size:15px">${ech(opts.raison)}</p>
    <p style="margin:0 0 20px;padding:12px;background:#fef2f2;border-radius:10px;color:#991b1b;font-size:13px">
      Rien n'a été écrit au journal : une ligne fausse ne se voit pas, une ligne manquante se répare. À saisir à la main.
    </p>
    <p style="margin:0"><a href="${opts.base.replace(/\/$/, "")}/admin" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Ouvrir la comptabilité →</a></p>`;
  return {
    objet: "⚠️ Mouvement d'argent à saisir à la main",
    html: coquilleEmail({ base: opts.base, surtitre: "Comptabilité", corps, pied: "Tu reçois ce message parce que tu es l'éditeur de Pacevo." }),
    texte: `Un mouvement d'argent n'a pas pu être enregistré.\n${opts.raison}\nÀ saisir à la main : ${opts.base.replace(/\/$/, "")}/admin`,
  };
}
