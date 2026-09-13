/**
 * TEXTES DE L'EXPÉRIENCE « APPLICATION » (PWA) — installation, hors-ligne, notifications.
 *
 * Regroupés ici, dans les cinq langues publiées, sur le modèle de `authI18n.ts` : un
 * composant client lit `PWA_I18N[lang] ?? PWA_I18N.fr`. Aucune de ces chaînes ne doit
 * rester en anglais chez un coureur francophone — c'est le même principe que pour les
 * e-mails et les erreurs de connexion.
 */
export type PwaBloc = {
  // Installation (Android : bouton natif ; iPhone : geste manuel)
  installTitle: string;
  installBody: string;
  installBtn: string;
  later: string;
  iosTitle: string;
  iosBody: string;
  // Page hors-ligne
  offlineTitle: string;
  offlineBody: string;
  offlineRetry: string;
  // Notifications push
  pushTitle: string;
  pushBody: string;
  pushEnable: string;
  pushEnabled: string;
  pushBlocked: string;
};

export const PWA_I18N: Record<string, PwaBloc> = {
  fr: {
    installTitle: "Installe Pacevo",
    installBody: "Ton coach en un tap sur l'écran d'accueil, même hors-ligne.",
    installBtn: "Installer l'application",
    later: "Plus tard",
    iosTitle: "Ajoute Pacevo à ton écran d'accueil",
    iosBody: "Appuie sur Partager, puis « Sur l'écran d'accueil ».",
    offlineTitle: "Tu es hors-ligne",
    offlineBody: "Vérifie ta connexion. Ton plan et tes données reviennent dès que tu es reconnecté.",
    offlineRetry: "Réessayer",
    pushTitle: "Reste prévenu",
    pushBody: "Reçois une alerte quand ta séance du jour est prête ou que ton plan change.",
    pushEnable: "Activer les notifications",
    pushEnabled: "Notifications activées",
    pushBlocked: "Notifications bloquées — autorise-les dans les réglages de ton navigateur.",
  },
  en: {
    installTitle: "Install Pacevo",
    installBody: "Your coach one tap away on your home screen, even offline.",
    installBtn: "Install the app",
    later: "Later",
    iosTitle: "Add Pacevo to your home screen",
    iosBody: "Tap Share, then “Add to Home Screen”.",
    offlineTitle: "You're offline",
    offlineBody: "Check your connection. Your plan and data come back as soon as you're reconnected.",
    offlineRetry: "Try again",
    pushTitle: "Stay in the loop",
    pushBody: "Get an alert when your session of the day is ready or your plan changes.",
    pushEnable: "Enable notifications",
    pushEnabled: "Notifications on",
    pushBlocked: "Notifications blocked — allow them in your browser settings.",
  },
  de: {
    installTitle: "Pacevo installieren",
    installBody: "Dein Coach mit einem Tipp auf dem Startbildschirm, auch offline.",
    installBtn: "App installieren",
    later: "Später",
    iosTitle: "Füge Pacevo zum Startbildschirm hinzu",
    iosBody: "Tippe auf Teilen und dann „Zum Home-Bildschirm“.",
    offlineTitle: "Du bist offline",
    offlineBody: "Prüfe deine Verbindung. Dein Plan und deine Daten sind zurück, sobald du wieder verbunden bist.",
    offlineRetry: "Erneut versuchen",
    pushTitle: "Bleib informiert",
    pushBody: "Erhalte eine Meldung, wenn deine Einheit des Tages bereit ist oder sich dein Plan ändert.",
    pushEnable: "Benachrichtigungen aktivieren",
    pushEnabled: "Benachrichtigungen an",
    pushBlocked: "Benachrichtigungen blockiert — erlaube sie in den Browsereinstellungen.",
  },
  es: {
    installTitle: "Instala Pacevo",
    installBody: "Tu entrenador a un toque en la pantalla de inicio, incluso sin conexión.",
    installBtn: "Instalar la app",
    later: "Más tarde",
    iosTitle: "Añade Pacevo a tu pantalla de inicio",
    iosBody: "Toca Compartir y luego “Añadir a pantalla de inicio”.",
    offlineTitle: "Estás sin conexión",
    offlineBody: "Revisa tu conexión. Tu plan y tus datos vuelven en cuanto te reconectes.",
    offlineRetry: "Reintentar",
    pushTitle: "Mantente al día",
    pushBody: "Recibe un aviso cuando tu sesión del día esté lista o cambie tu plan.",
    pushEnable: "Activar notificaciones",
    pushEnabled: "Notificaciones activadas",
    pushBlocked: "Notificaciones bloqueadas — permítelas en los ajustes del navegador.",
  },
  pt: {
    installTitle: "Instala o Pacevo",
    installBody: "O teu treinador a um toque no ecrã inicial, mesmo offline.",
    installBtn: "Instalar a aplicação",
    later: "Mais tarde",
    iosTitle: "Adiciona o Pacevo ao teu ecrã inicial",
    iosBody: "Toca em Partilhar e depois “Adicionar ao ecrã principal”.",
    offlineTitle: "Estás offline",
    offlineBody: "Verifica a tua ligação. O teu plano e os teus dados voltam assim que te reconectares.",
    offlineRetry: "Tentar de novo",
    pushTitle: "Fica a par",
    pushBody: "Recebe um alerta quando a tua sessão do dia estiver pronta ou o teu plano mudar.",
    pushEnable: "Ativar notificações",
    pushEnabled: "Notificações ativadas",
    pushBlocked: "Notificações bloqueadas — permite-as nas definições do navegador.",
  },
};
