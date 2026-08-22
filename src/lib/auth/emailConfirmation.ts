import { coquilleEmail, ech } from "@/lib/newsletter/gabarit";

/**
 * L'E-MAIL DE CONFIRMATION D'INSCRIPTION — le nôtre, pas celui de Supabase.
 *
 * ⚠️ CE QUI PARTAIT AVANT. Le gabarit par défaut de Supabase : « Confirm your email
 * address », en ANGLAIS quelle que soit la langue choisie, expédié par
 * `noreply@mail.app.supabase.io`, sans logo, sans un mot sur Pacevo. C'est le TOUT
 * PREMIER message qu'une personne reçoit après avoir donné son adresse et son mot de
 * passe — celui qui décide si elle clique ou si elle referme l'onglet. Un message qui
 * porte le nom d'un prestataire inconnu ressemble exactement à ce qu'on apprend à ne
 * pas ouvrir.
 *
 * ── POURQUOI ON NE PASSE PAS PAR LE TABLEAU DE BORD ──────────────────────────
 * Supabase permet de personnaliser ses gabarits et de brancher un SMTP maison, mais
 * seulement à la main, dans son interface — donc invérifiable par un test et invisible
 * dans l'historique du dépôt. En générant le lien côté serveur (`generateLink`) et en
 * envoyant NOTRE message, la mise en forme vit dans le code, se relit, se teste, et
 * suit l'application si elle change d'hébergeur.
 *
 * ⚠️ Le lien est à USAGE UNIQUE et daté : il ne se journalise pas et ne se met pas en
 * cache. Il ne doit apparaître nulle part ailleurs que dans ce message.
 */
type Bloc = { objet: string; titre: string; p1: string; bouton: string; p2: string; secours: string; pied: string };

const T: Record<string, Bloc> = {
  fr: {
    objet: "Confirme ton adresse — Pacevo",
    titre: "Plus qu'un clic",
    p1: "Confirme ton adresse et ton compte Pacevo est ouvert. Ta montre se synchronise, ton plan se construit sur tes données.",
    bouton: "Confirmer mon adresse",
    p2: "Ce lien expire dans 24 heures et ne sert qu'une fois.",
    secours: "Si le bouton ne fonctionne pas, copie cette adresse dans ton navigateur :",
    pied: "Tu reçois ce message parce qu'un compte Pacevo vient d'être créé avec cette adresse. Si ce n'est pas toi, ignore-le : sans confirmation, le compte reste inutilisable.",
  },
  en: {
    objet: "Confirm your address — Pacevo",
    titre: "One click away",
    p1: "Confirm your address and your Pacevo account is open. Your watch syncs, your plan is built on your own data.",
    bouton: "Confirm my address",
    p2: "This link expires in 24 hours and works once.",
    secours: "If the button doesn't work, copy this address into your browser:",
    pied: "You're getting this because a Pacevo account was just created with this address. If it wasn't you, ignore it: without confirmation the account stays unusable.",
  },
  de: {
    objet: "Bestätige deine Adresse — Pacevo",
    titre: "Nur noch ein Klick",
    p1: "Bestätige deine Adresse und dein Pacevo-Konto ist offen. Deine Uhr synchronisiert, dein Plan entsteht aus deinen Daten.",
    bouton: "Adresse bestätigen",
    p2: "Dieser Link läuft in 24 Stunden ab und funktioniert einmal.",
    secours: "Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:",
    pied: "Du erhältst diese Nachricht, weil gerade ein Pacevo-Konto mit dieser Adresse erstellt wurde. Warst du das nicht, ignoriere sie: Ohne Bestätigung bleibt das Konto unbrauchbar.",
  },
  es: {
    objet: "Confirma tu dirección — Pacevo",
    titre: "Solo un clic",
    p1: "Confirma tu dirección y tu cuenta Pacevo queda abierta. Tu reloj se sincroniza, tu plan se construye con tus datos.",
    bouton: "Confirmar mi dirección",
    p2: "Este enlace caduca en 24 horas y sirve una sola vez.",
    secours: "Si el botón no funciona, copia esta dirección en tu navegador:",
    pied: "Recibes este mensaje porque se acaba de crear una cuenta Pacevo con esta dirección. Si no has sido tú, ignóralo: sin confirmación la cuenta queda inutilizable.",
  },
  pt: {
    objet: "Confirma o teu endereço — Pacevo",
    titre: "Falta um clique",
    p1: "Confirma o teu endereço e a tua conta Pacevo fica aberta. O teu relógio sincroniza, o teu plano constrói-se com os teus dados.",
    bouton: "Confirmar o meu endereço",
    p2: "Esta ligação expira em 24 horas e serve uma única vez.",
    secours: "Se o botão não funcionar, copia este endereço para o teu navegador:",
    pied: "Recebes esta mensagem porque acabou de ser criada uma conta Pacevo com este endereço. Se não foste tu, ignora-a: sem confirmação a conta fica inutilizável.",
  },
};

export function emailInscription(lang: string, base: string, lien: string): { objet: string; html: string; texte: string } {
  const t = T[lang] ?? T.fr;
  const corps = `
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#18181b;font-weight:800">${ech(t.titre)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#52525b">${ech(t.p1)}</p>

      <a href="${ech(lien)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 26px;border-radius:999px">${ech(t.bouton)}</a>

      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa">${ech(t.p2)}</p>

      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #f4f4f5">
        <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa">${ech(t.secours)}</p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;word-break:break-all">${ech(lien)}</p>
      </div>`;
  return {
    objet: t.objet,
    html: coquilleEmail({ base, corps, pied: `<p style="margin:0">${ech(t.pied)}</p>` }),
    texte: `${t.titre}\n\n${t.p1}\n\n${t.bouton} : ${lien}\n\n${t.p2}\n\n${t.pied}`,
  };
}
