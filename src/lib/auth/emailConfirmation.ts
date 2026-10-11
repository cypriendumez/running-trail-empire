import { coquilleEmail, ech } from "@/lib/newsletter/gabarit";
import { AUTH } from "@/components/auth/authI18n";

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

/**
 * L'E-MAIL DE RÉINITIALISATION DU MOT DE PASSE — le nôtre, pas celui de Supabase.
 *
 * ⚠️ CE QUI PARTAIT AVANT (constaté le 13/09/2026). `resetPasswordForEmail()` déclenche le
 * gabarit « Reset Your Password » du tableau de bord Supabase : en ANGLAIS, sans logo, avec
 * un lien nu « Reset Password ». Il est arrivé DANS LES INDÉSIRABLES d'Outlook — un contenu
 * anglais générique sur un domaine tout neuf a exactement la signature d'un hameçonnage.
 * Comme pour l'inscription, on génère le lien nous-mêmes (`generateLink` type `recovery`) et
 * on envoie NOTRE message : logo, français, expéditeur unique (`RESEND_FROM`), lien
 * `token_hash` robuste multi-navigateur. Un même expéditeur pour tous nos e-mails aide aussi
 * la réputation du domaine à se construire — donc à sortir des indésirables.
 */
const R: Record<string, Bloc> = {
  fr: {
    objet: "Réinitialise ton mot de passe — Pacevo",
    titre: "Nouveau mot de passe",
    p1: "Tu as demandé à réinitialiser ton mot de passe Pacevo. Clique ci-dessous pour en choisir un nouveau.",
    bouton: "Choisir un nouveau mot de passe",
    p2: "Ce lien expire dans une heure et ne sert qu'une fois.",
    secours: "Si le bouton ne fonctionne pas, copie cette adresse dans ton navigateur :",
    pied: "Tu reçois ce message parce qu'une réinitialisation a été demandée pour cette adresse. Si ce n'est pas toi, ignore-le : ton mot de passe actuel reste valable.",
  },
  en: {
    objet: "Reset your password — Pacevo",
    titre: "New password",
    p1: "You asked to reset your Pacevo password. Click below to choose a new one.",
    bouton: "Choose a new password",
    p2: "This link expires in one hour and works once.",
    secours: "If the button doesn't work, copy this address into your browser:",
    pied: "You're getting this because a reset was requested for this address. If it wasn't you, ignore it: your current password still works.",
  },
  de: {
    objet: "Setze dein Passwort zurück — Pacevo",
    titre: "Neues Passwort",
    p1: "Du hast angefragt, dein Pacevo-Passwort zurückzusetzen. Klicke unten, um ein neues zu wählen.",
    bouton: "Neues Passwort wählen",
    p2: "Dieser Link läuft in einer Stunde ab und funktioniert einmal.",
    secours: "Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:",
    pied: "Du erhältst diese Nachricht, weil für diese Adresse ein Zurücksetzen angefragt wurde. Warst du das nicht, ignoriere sie: Dein aktuelles Passwort bleibt gültig.",
  },
  es: {
    objet: "Restablece tu contraseña — Pacevo",
    titre: "Nueva contraseña",
    p1: "Has pedido restablecer tu contraseña de Pacevo. Haz clic abajo para elegir una nueva.",
    bouton: "Elegir una nueva contraseña",
    p2: "Este enlace caduca en una hora y sirve una sola vez.",
    secours: "Si el botón no funciona, copia esta dirección en tu navegador:",
    pied: "Recibes este mensaje porque se solicitó un restablecimiento para esta dirección. Si no has sido tú, ignóralo: tu contraseña actual sigue siendo válida.",
  },
  pt: {
    objet: "Repõe a tua palavra-passe — Pacevo",
    titre: "Nova palavra-passe",
    p1: "Pediste para repor a tua palavra-passe Pacevo. Clica abaixo para escolher uma nova.",
    bouton: "Escolher uma nova palavra-passe",
    p2: "Esta ligação expira numa hora e serve uma única vez.",
    secours: "Se o botão não funcionar, copia este endereço para o teu navegador:",
    pied: "Recebes esta mensagem porque foi pedida uma reposição para este endereço. Se não foste tu, ignora-a: a tua palavra-passe atual continua válida.",
  },
};

/** Rendu commun aux deux e-mails d'authentification : un bouton, un lien de secours. */
function rendreEmailLien(t: Bloc, base: string, lien: string): { objet: string; html: string; texte: string } {
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

export function emailInscription(lang: string, base: string, lien: string): { objet: string; html: string; texte: string } {
  return rendreEmailLien(T[lang] ?? T.fr, base, lien);
}

export function emailReinitialisation(lang: string, base: string, lien: string): { objet: string; html: string; texte: string } {
  return rendreEmailLien(R[lang] ?? R.fr, base, lien);
}

/**
 * « TU AS DÉJÀ UN COMPTE » — l'e-mail qui part quand on s'inscrit avec une adresse déjà prise.
 *
 * ⚠️ AVANT, IL NE PARTAIT RIEN (constaté le 11/10/2026). Cyprien s'inscrit avec
 * `cyprien.dumez@gwsp.fr` ; l'écran affiche « Vérifiez votre email »… et rien n'arrive,
 * jamais. L'adresse avait déjà un compte, ouvert avec Google le 23/08 : Supabase refuse de
 * créer le doublon (`email_exists`) et la route se taisait — volontairement, pour que le
 * formulaire ne dise pas qui a un compte. Mais se taire envers l'ÉCRAN ne veut pas dire se
 * taire envers la BOÎTE : seul le titulaire de l'adresse lit ce message. Il apprend qu'il a
 * déjà un compte, comment il s'ouvre (Google ou mot de passe), et peut choisir un mot de
 * passe en un clic — le lien `recovery` sert aussi à poser un PREMIER mot de passe sur un
 * compte Google (GoTrue v2.197 : `addingFirstPassword`).
 *
 * `fournisseurs` = `app_metadata.providers` du compte (« email », « google », « apple »).
 */
type BlocExistant = {
  objet: string; titre: string; p1: string;
  /** Compte ouvert uniquement par Google/Apple. Jetons {fournisseur} et {bouton}. */
  oauth: string;
  /** Compte avec mot de passe ET Google/Apple. Jeton {bouton}. */
  oauthEtMdp: string;
  /** Compte avec mot de passe seulement. */
  mdp: string;
  bouton: string;
  /** Pas encore de mot de passe : en choisir un. Jeton {fournisseur}. */
  choisir: string; boutonChoisir: string;
  /** Un mot de passe existe : en choisir un nouveau. */
  oublie: string; boutonOublie: string;
  p2: string; secours: string; pied: string;
};

const E: Record<string, BlocExistant> = {
  fr: {
    objet: "Tu as déjà un compte Pacevo",
    titre: "Ton compte existe déjà",
    p1: "Quelqu'un — sans doute toi — vient de demander à créer un compte Pacevo avec cette adresse. Tu en as déjà un : aucun second compte n'a été créé, ton historique est intact.",
    oauth: "Ce compte s'ouvre avec {fournisseur} : sur la page de connexion, choisis « {bouton} ».",
    oauthEtMdp: "Connecte-toi avec ton mot de passe, ou avec « {bouton} ».",
    mdp: "Connecte-toi avec ton adresse et ton mot de passe.",
    bouton: "Me connecter",
    choisir: "Tu préfères te connecter avec un mot de passe ? Choisis-en un ici ; {fournisseur} continuera de marcher aussi.",
    boutonChoisir: "Choisir un mot de passe",
    oublie: "Mot de passe oublié ? Choisis-en un nouveau ici.",
    boutonOublie: "Choisir un nouveau mot de passe",
    p2: "Ce lien expire dans une heure et ne sert qu'une fois.",
    secours: "Si le bouton ne fonctionne pas, copie cette adresse dans ton navigateur :",
    pied: "Tu reçois ce message parce que quelqu'un a demandé à créer un compte Pacevo avec cette adresse. Si ce n'est pas toi, ignore-le : ton compte n'a pas changé.",
  },
  en: {
    objet: "You already have a Pacevo account",
    titre: "Your account already exists",
    p1: "Someone — probably you — just asked to create a Pacevo account with this address. You already have one: no second account was created, and your history is intact.",
    oauth: "This account opens with {fournisseur}: on the login page, choose “{bouton}”.",
    oauthEtMdp: "Log in with your password, or with “{bouton}”.",
    mdp: "Log in with your address and password.",
    bouton: "Log in",
    choisir: "Prefer to log in with a password? Choose one here; {fournisseur} will keep working too.",
    boutonChoisir: "Choose a password",
    oublie: "Forgot your password? Choose a new one here.",
    boutonOublie: "Choose a new password",
    p2: "This link expires in one hour and works once.",
    secours: "If the button doesn't work, copy this address into your browser:",
    pied: "You're getting this because someone asked to create a Pacevo account with this address. If it wasn't you, ignore it: your account hasn't changed.",
  },
  de: {
    objet: "Du hast schon ein Pacevo-Konto",
    titre: "Dein Konto existiert bereits",
    p1: "Jemand – wahrscheinlich du – wollte gerade ein Pacevo-Konto mit dieser Adresse erstellen. Du hast bereits eins: Es wurde kein zweites Konto angelegt, dein Verlauf ist unverändert.",
    oauth: "Dieses Konto öffnet sich mit {fournisseur}: Wähle auf der Anmeldeseite „{bouton}“.",
    oauthEtMdp: "Melde dich mit deinem Passwort an oder über „{bouton}“.",
    mdp: "Melde dich mit deiner Adresse und deinem Passwort an.",
    bouton: "Anmelden",
    choisir: "Lieber mit Passwort anmelden? Wähle hier eins; {fournisseur} funktioniert weiterhin.",
    boutonChoisir: "Passwort wählen",
    oublie: "Passwort vergessen? Wähle hier ein neues.",
    boutonOublie: "Neues Passwort wählen",
    p2: "Dieser Link läuft in einer Stunde ab und funktioniert einmal.",
    secours: "Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:",
    pied: "Du erhältst diese Nachricht, weil jemand ein Pacevo-Konto mit dieser Adresse erstellen wollte. Warst du das nicht, ignoriere sie: Dein Konto ist unverändert.",
  },
  es: {
    objet: "Ya tienes una cuenta Pacevo",
    titre: "Tu cuenta ya existe",
    p1: "Alguien — probablemente tú — acaba de pedir crear una cuenta Pacevo con esta dirección. Ya tienes una: no se ha creado una segunda cuenta y tu historial está intacto.",
    oauth: "Esta cuenta se abre con {fournisseur}: en la página de inicio de sesión, elige «{bouton}».",
    oauthEtMdp: "Inicia sesión con tu contraseña o con «{bouton}».",
    mdp: "Inicia sesión con tu dirección y tu contraseña.",
    bouton: "Iniciar sesión",
    choisir: "¿Prefieres entrar con contraseña? Elige una aquí; {fournisseur} seguirá funcionando.",
    boutonChoisir: "Elegir una contraseña",
    oublie: "¿Has olvidado tu contraseña? Elige una nueva aquí.",
    boutonOublie: "Elegir una nueva contraseña",
    p2: "Este enlace caduca en una hora y sirve una sola vez.",
    secours: "Si el botón no funciona, copia esta dirección en tu navegador:",
    pied: "Recibes este mensaje porque alguien pidió crear una cuenta Pacevo con esta dirección. Si no has sido tú, ignóralo: tu cuenta no ha cambiado.",
  },
  pt: {
    objet: "Já tens uma conta Pacevo",
    titre: "A tua conta já existe",
    p1: "Alguém — provavelmente tu — acabou de pedir para criar uma conta Pacevo com este endereço. Já tens uma: não foi criada uma segunda conta e o teu histórico está intacto.",
    oauth: "Esta conta abre-se com {fournisseur}: na página de início de sessão, escolhe «{bouton}».",
    oauthEtMdp: "Inicia sessão com a tua palavra-passe ou com «{bouton}».",
    mdp: "Inicia sessão com o teu endereço e a tua palavra-passe.",
    bouton: "Entrar",
    choisir: "Preferes entrar com uma palavra-passe? Escolhe uma aqui; o {fournisseur} continua a funcionar.",
    boutonChoisir: "Escolher uma palavra-passe",
    oublie: "Esqueceste a palavra-passe? Escolhe uma nova aqui.",
    boutonOublie: "Escolher uma nova palavra-passe",
    p2: "Esta ligação expira numa hora e serve uma única vez.",
    secours: "Se o botão não funcionar, copia este endereço para o teu navegador:",
    pied: "Recebes esta mensagem porque alguém pediu para criar uma conta Pacevo com este endereço. Se não foste tu, ignora-a: a tua conta não mudou.",
  },
};

const NOMS_FOURNISSEURS = { google: "Google", apple: "Apple" } as const;

export function emailCompteExistant(
  lang: string, base: string, lienMotDePasse: string, fournisseurs: readonly string[],
): { objet: string; html: string; texte: string } {
  const t = E[lang] ?? E.fr;
  const oauth = (["google", "apple"] as const).find((p) => fournisseurs.includes(p));
  const aMotDePasse = fournisseurs.includes("email");
  // Le libellé EXACT du bouton de la page de connexion, dans la même langue : la personne
  // doit le reconnaître à l'écran.
  const boutonOauth = oauth ? (AUTH[lang as keyof typeof AUTH] ?? AUTH.fr).login[oauth] : "";
  const remplir = (s: string) => s.replaceAll("{fournisseur}", oauth ? NOMS_FOURNISSEURS[oauth] : "").replaceAll("{bouton}", boutonOauth);
  const acces = remplir(oauth && !aMotDePasse ? t.oauth : oauth ? t.oauthEtMdp : t.mdp);
  const [invite, boutonMdp] = oauth && !aMotDePasse ? [remplir(t.choisir), t.boutonChoisir] : [t.oublie, t.boutonOublie];
  const connexion = `${base.replace(/\/+$/, "")}/login`;

  const corps = `
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#18181b;font-weight:800">${ech(t.titre)}</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#52525b">${ech(t.p1)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#52525b">${ech(acces)}</p>

      <a href="${ech(connexion)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 26px;border-radius:999px">${ech(t.bouton)}</a>

      <div style="margin-top:26px;padding-top:20px;border-top:1px solid #f4f4f5">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#52525b">${ech(invite)}</p>
        <a href="${ech(lienMotDePasse)}" style="display:inline-block;border:1px solid #059669;color:#047857;text-decoration:none;font-size:14px;font-weight:700;padding:11px 22px;border-radius:999px">${ech(boutonMdp)}</a>
        <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa">${ech(t.p2)}</p>
      </div>

      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #f4f4f5">
        <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa">${ech(t.secours)}</p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;word-break:break-all">${ech(lienMotDePasse)}</p>
      </div>`;
  return {
    objet: t.objet,
    html: coquilleEmail({ base, corps, pied: `<p style="margin:0">${ech(t.pied)}</p>` }),
    texte: `${t.titre}\n\n${t.p1}\n\n${acces}\n\n${t.bouton} : ${connexion}\n\n${invite}\n${boutonMdp} : ${lienMotDePasse}\n\n${t.p2}\n\n${t.pied}`,
  };
}
