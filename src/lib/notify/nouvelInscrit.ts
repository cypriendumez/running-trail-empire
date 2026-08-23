import { coquilleEmail, ech } from "@/lib/newsletter/gabarit";

/**
 * « QUELQU'UN VIENT DE S'INSCRIRE » — l'alerte qui n'existait pas.
 *
 * Une alerte partait déjà quand un athlète notait son ressenti, mais RIEN à la création
 * d'un compte : il fallait penser à ouvrir `/admin` pour s'en apercevoir. Sur un site
 * qu'on vient de publier, c'est l'information la plus utile de la journée.
 *
 * ── ENVOYÉE À LA CONFIRMATION, PAS À LA SAISIE ───────────────────────────────
 * ⚠️ Le point qui décide si cette alerte sert ou agace. Prévenir dès la soumission du
 * formulaire ferait sonner une faute de frappe, une adresse jetable ou un robot. À la
 * confirmation, l'adresse est prouvée : quelqu'un a reçu le message et a cliqué. C'est
 * la seule version qu'on a envie de lire.
 *
 * ⚠️ Elle ne peut pas partir deux fois : le lien de confirmation est à usage unique, et
 * `verifyOtp` échoue au second clic — donc on n'atteint jamais ce code une deuxième fois.
 */
export function emailNouvelInscrit(opts: {
  nom: string; email: string; base: string; premier: boolean;
}): { objet: string; html: string; texte: string } {
  const { email, base, premier } = opts;
  // ⚠️ LE REPLI EST ICI AUSSI, pas seulement chez l'appelant. Le nom vient d'un profil
  // qui peut être vide — et l'objet devenait « 🎉 Nouvel inscrit : », suivi de rien.
  // Un garde-fou qui ne vit que chez l'appelant ne protège pas le prochain appelant.
  const nom = String(opts.nom ?? "").trim() || String(email ?? "").split("@")[0] || "Un coureur";
  const quand = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  const ligne = (cle: string, valeur: string) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#a1a1aa;width:92px;vertical-align:top">${ech(cle)}</td>
          <td style="padding:6px 0;font-size:15px;color:#18181b;font-weight:600">${ech(valeur)}</td>
        </tr>`;

  const corps = `
      ${premier ? `<div style="display:inline-block;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px">Premier inscrit</div>` : ""}
      <h1 style="margin:${premier ? "14px" : "0"} 0 6px;font-size:24px;line-height:1.25;color:#18181b;font-weight:800">${ech(nom)} vient de créer un compte</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#71717a">Son adresse est confirmée : il a reçu l'e-mail et cliqué.</p>

      <div style="background:#fafafa;border-radius:12px;padding:16px 18px;border:1px solid #f4f4f5">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
          ${ligne("Nom", nom)}
          ${ligne("E-mail", email)}
          ${ligne("Inscrit le", quand)}
        </table>
      </div>

      <div style="margin-top:24px">
        <a href="${ech(base)}/admin" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:999px">Voir dans l'espace coach</a>
      </div>`;

  return {
    objet: `${premier ? "🎉 Premier inscrit" : "🎉 Nouvel inscrit"} : ${nom}`,
    html: coquilleEmail({ base, corps, pied: `<p style="margin:0">Tu reçois ce message parce que tu es l'éditeur de Pacevo. Il part une fois par compte, à la confirmation de l'adresse.</p>` }),
    texte: `${nom} vient de créer un compte Pacevo.\n\nNom : ${nom}\nE-mail : ${email}\nInscrit le : ${quand}\n\nEspace coach : ${base}/admin`,
  };
}
