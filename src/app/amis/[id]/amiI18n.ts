/** Les textes de la page publique d'invitation (/amis/<id>), dans les cinq langues. */
export const AMI_I18N: Record<string, { titre: string; sous: string; connexion: string; inscription: string; introuvable: string; introuvableSous: string; decouvrir: string }> = {
  fr: {
    titre: "{prenom} t'invite sur Pacevo",
    sous: "Connecte-toi ou crée ton compte : tu pourras suivre {prenom} juste après, et voir ses sorties dans ton fil.",
    connexion: "Se connecter", inscription: "Créer un compte",
    introuvable: "Invitation introuvable",
    introuvableSous: "Ce lien ne mène à aucun athlète visible. Demande à ton ami de te montrer à nouveau son QR code, dans Pacevo › Ajouter des amis.",
    decouvrir: "Découvrir Pacevo",
  },
  en: {
    titre: "{prenom} invites you to Pacevo",
    sous: "Sign in or create your account: you'll be able to follow {prenom} right after, and see their runs in your feed.",
    connexion: "Sign in", inscription: "Create an account",
    introuvable: "Invitation not found",
    introuvableSous: "This link doesn't lead to any visible athlete. Ask your friend to show you their QR code again, in Pacevo › Add friends.",
    decouvrir: "Discover Pacevo",
  },
  de: {
    titre: "{prenom} lädt dich zu Pacevo ein",
    sous: "Melde dich an oder erstelle dein Konto: gleich danach kannst du {prenom} folgen und seine Läufe in deinem Feed sehen.",
    connexion: "Anmelden", inscription: "Konto erstellen",
    introuvable: "Einladung nicht gefunden",
    introuvableSous: "Dieser Link führt zu keinem sichtbaren Athleten. Bitte deinen Freund, dir seinen QR-Code noch einmal zu zeigen, in Pacevo › Freunde hinzufügen.",
    decouvrir: "Pacevo entdecken",
  },
  es: {
    titre: "{prenom} te invita a Pacevo",
    sous: "Inicia sesión o crea tu cuenta: podrás seguir a {prenom} justo después y ver sus salidas en tu feed.",
    connexion: "Iniciar sesión", inscription: "Crear una cuenta",
    introuvable: "Invitación no encontrada",
    introuvableSous: "Este enlace no lleva a ningún atleta visible. Pide a tu amigo que te muestre de nuevo su código QR, en Pacevo › Añadir amigos.",
    decouvrir: "Descubrir Pacevo",
  },
  pt: {
    titre: "{prenom} convida-te para a Pacevo",
    sous: "Inicia sessão ou cria a tua conta: poderás seguir {prenom} logo a seguir e ver as suas saídas no teu feed.",
    connexion: "Iniciar sessão", inscription: "Criar conta",
    introuvable: "Convite não encontrado",
    introuvableSous: "Esta ligação não leva a nenhum atleta visível. Pede ao teu amigo para te mostrar de novo o código QR, em Pacevo › Adicionar amigos.",
    decouvrir: "Descobrir a Pacevo",
  },
};
