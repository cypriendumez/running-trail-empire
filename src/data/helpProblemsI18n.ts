// ─────────────────────────────────────────────────────────────────────────────
//  REPLI SANS IA — synonymes de recherche et réponses traduites.
//
//  Séparé de `helpKb.ts` à dessein : ce fichier ne sert QU'AU REPLI, quand le modèle est
//  indisponible. Le prompt de l'assistant, lui, continue de lire les entrées françaises
//  de `HELP_PROBLEMS` — une seule source de vérité pour le contenu, deux usages.
//
//  Les clés sont les questions françaises de `HELP_PROBLEMS`, à l'identique. Un test
//  vérifie la correspondance : renommer une question sans toucher ici casserait le repli
//  en silence, ce qui est exactement le genre de panne qu'on ne voit jamais venir.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mots-clés supplémentaires, toutes langues confondues.
 *
 * Trouvés par fuzz : « la synchronisation ne marche pas » ne correspondait à RIEN, le mot
 * « synchronisation » n'apparaissant dans aucune question type. Un repli muet sur une
 * question aussi banale rend le repli inutile le jour où il compte.
 */
export const PROBLEM_KEYS: Record<string, string[]> = {
  "Mes séances n'arrivent pas sur ma montre": ["montre", "garmin", "watch", "uhr", "reloj", "relogio", "envoi", "recoit", "pousse", "synchro", "synchronisation", "synchroniser", "sync", "bluetooth", "connect", "arrivent", "recu"],
  "Mes séances sont dans Garmin Connect mais pas sur ma montre": ["connect", "calendrier", "appairer", "appairage", "reappairer", "desappairer", "retirer", "oublier", "rajouter", "reconnecter", "forerunner", "fenix", "venu", "vivoactive", "instinct", "pairing", "unpair", "kopplung", "koppeln", "emparejar", "emparelhar"],
  "Ma séance Apple Watch n'arrive pas dans l'app": ["apple", "iphone", "companion", "sante", "health", "healthkit", "raccourcis", "raccourci", "automatisation", "automatiser", "shortcuts", "automation", "kurzbefehle", "atajos", "atalhos"],
  "Mes activités n'apparaissent pas dans l'app": ["activites", "apparait", "apparaissent", "import", "importer", "synchro", "synchronisation", "synchroniser", "sync", "marche", "fonctionne", "intervals", "icu", "activities", "aktivitaten", "actividades", "atividades", "remontent"],
  "Le coach ne me donne aucune séance de fractionné": ["fractionne", "intervalles", "qualite", "intensite", "vma", "seuil", "intervals", "tempo", "series", "dur", "dure", "einheiten", "facile", "molles"],
  "Mon kilométrage me semble faux": ["kilometrage", "volume", "randonnee", "rando", "marche", "velo", "faux", "compte", "mileage", "hiking", "wandern", "senderismo", "caminhada", "totaux", "errone"],
  "Je n'ai pas d'allure cible sur mes séances": ["allure", "cible", "pace", "vma", "rythme", "tempo", "geschwindigkeit", "ritmo", "zonas", "vide", "affichee"],
  "Je ne peux pas m'abonner / le paiement ne fonctionne pas": ["abonner", "abonnement", "paiement", "payer", "carte", "stripe", "prix", "subscribe", "payment", "bezahlen", "suscribir", "pago", "assinar", "pagamento", "premium"],
  "La boutique est vide": ["boutique", "shop", "magasin", "produits", "equipement", "vide", "laden", "tienda", "loja", "empty", "chaussures"],
  "Mon objectif de course n'a rien changé à mes séances": ["objectif", "course", "marathon", "semi", "change", "plan", "goal", "race", "ziel", "objetivo", "carrera", "prova", "periodisation", "specifique"],
  "Puis-je connecter Strava, Polar, COROS ou Suunto ?": ["strava", "polar", "coros", "suunto", "connecter", "integration", "plateforme", "compte", "relier", "connect", "verbinden", "conectar", "ligar"],
  "Comment supprimer mon compte ou mes données": ["supprimer", "compte", "donnees", "rgpd", "effacer", "delete", "account", "data", "konto", "loschen", "daten", "borrar", "cuenta", "datos", "apagar", "conta", "dados", "desinscrire"],
};

/** Réponse servie par le repli, traduite. Le français vit dans `HELP_PROBLEMS`. */
export const PROBLEM_T: Record<string, Record<string, string>> = {
  "Mes séances n'arrivent pas sur ma montre": {
    en: "Four possible causes: (1) Garmin sync goes through your phone's Bluetooth — open Garmin Connect with the watch nearby; (2) only the first 5 days of the plan are pushed, so a session 6 days out isn't there yet; (3) your intervals.icu credentials are missing or stale — check them in Watch Sync; (4) the session is in Garmin Connect but not on the watch: remove the watch in Garmin Connect (Devices › your watch › Remove Device), forget it in your phone's Bluetooth, then add it again from Garmin Connect.",
    de: "Vier mögliche Ursachen: (1) die Garmin-Synchronisierung läuft über das Bluetooth deines Telefons — öffne Garmin Connect mit der Uhr in der Nähe; (2) nur die ersten 5 Tage des Plans werden übertragen; (3) deine intervals.icu-Zugangsdaten fehlen oder sind veraltet — prüfe sie unter Uhr-Sync; (4) die Einheit ist in Garmin Connect, aber nicht auf der Uhr: entferne die Uhr in Garmin Connect (Geräte › deine Uhr › Gerät entfernen), lass sie im Bluetooth des Telefons ignorieren und füge sie dann über Garmin Connect neu hinzu.",
    es: "Cuatro causas posibles: (1) la sincronización Garmin pasa por el Bluetooth de tu teléfono — abre Garmin Connect con el reloj cerca; (2) solo se envían los 5 primeros días del plan; (3) tus credenciales de intervals.icu faltan o han caducado — revísalas en Sincronizar reloj; (4) la sesión está en Garmin Connect pero no en el reloj: elimina el reloj en Garmin Connect (Dispositivos › tu reloj › Eliminar dispositivo), olvídalo en el Bluetooth del teléfono y vuelve a añadirlo desde Garmin Connect.",
    pt: "Quatro causas possíveis: (1) a sincronização Garmin passa pelo Bluetooth do telemóvel — abre o Garmin Connect com o relógio por perto; (2) só os 5 primeiros dias do plano são enviados; (3) as tuas credenciais intervals.icu faltam ou expiraram — verifica em Sincronizar relógio; (4) a sessão está no Garmin Connect mas não no relógio: remove o relógio no Garmin Connect (Dispositivos › o teu relógio › Remover dispositivo), esquece-o no Bluetooth do telemóvel e volta a adicioná-lo no Garmin Connect.",
  },
  "Mes séances sont dans Garmin Connect mais pas sur ma montre": {
    en: "The link between your phone and your watch is stuck on Garmin's side: Pacevo did its part, since the session is in Garmin Connect. First check on the watch: Run › hold UP › Training › Workouts. If it isn't there, what works: (1) in the Garmin Connect app › Devices › your watch › Remove Device; (2) in your phone's Bluetooth settings, forget the watch; (3) add it again from Garmin Connect (Add Device). Your data stays on your Garmin account, and the sessions arrive at the next sync.",
    de: "Die Verbindung zwischen Telefon und Uhr hängt auf Garmins Seite: Pacevo hat seinen Teil erledigt, die Einheit ist in Garmin Connect. Prüfe zuerst auf der Uhr: Laufen › UP gedrückt halten › Training › Trainings. Ist sie nicht da, hilft: (1) in der Garmin-Connect-App › Geräte › deine Uhr › Gerät entfernen; (2) in den Bluetooth-Einstellungen des Telefons die Uhr ignorieren; (3) sie über Garmin Connect neu hinzufügen (Gerät hinzufügen). Deine Daten bleiben in deinem Garmin-Konto, die Einheiten kommen bei der nächsten Synchronisierung.",
    es: "Lo que está bloqueado es la conexión entre el teléfono y el reloj, del lado de Garmin: Pacevo hizo su parte, la sesión está en Garmin Connect. Comprueba primero en el reloj: Carrera › mantén pulsado UP › Entrenamiento › Entrenamientos. Si no está, lo que funciona: (1) en la app Garmin Connect › Dispositivos › tu reloj › Eliminar dispositivo; (2) en los ajustes Bluetooth del teléfono, olvida el reloj; (3) vuelve a añadirlo desde Garmin Connect (Añadir dispositivo). Tus datos siguen en tu cuenta Garmin y las sesiones llegan en la siguiente sincronización.",
    pt: "O que está bloqueado é a ligação entre o telemóvel e o relógio, do lado da Garmin: a Pacevo fez a sua parte, a sessão está no Garmin Connect. Verifica primeiro no relógio: Corrida › mantém premido UP › Treino › Treinos. Se não estiver, o que resulta: (1) na app Garmin Connect › Dispositivos › o teu relógio › Remover dispositivo; (2) nas definições Bluetooth do telemóvel, esquece o relógio; (3) volta a adicioná-lo no Garmin Connect (Adicionar dispositivo). Os teus dados ficam na conta Garmin e as sessões chegam na sincronização seguinte.",
  },
  "Ma séance Apple Watch n'arrive pas dans l'app": {
    en: "It goes through the Intervals.icu Companion iPhone app, which can only read Health on an unlocked iPhone: open the app after your session, that's when it sends it. To stop thinking about it: Shortcuts app › Automation › + › “Apple Watch Workout” › “End” › “Run Immediately”, then the “Open App” action › Intervals.icu Companion. Also check, in the app's Apple Health tab, that sending workouts is turned on.",
    de: "Sie läuft über die iPhone-App Intervals.icu Companion, die Health nur auf einem entsperrten iPhone lesen kann: Öffne die App nach deiner Einheit, dann schickt sie sie. Damit du nicht mehr daran denken musst: App Kurzbefehle › Automation › + › „Apple Watch-Training“ › „Ende“ › „Sofort ausführen“, dann die Aktion „App öffnen“ › Intervals.icu Companion. Prüfe auch im Tab Apple Health der App, dass das Senden der Trainings eingeschaltet ist.",
    es: "Pasa por la app de iPhone Intervals.icu Companion, que solo puede leer Salud con el iPhone desbloqueado: abre la app después de la sesión, es entonces cuando la envía. Para no tener que acordarte: app Atajos › Automatización › + › «Entreno con el Apple Watch» › «Fin» › «Ejecutar inmediatamente», y luego la acción «Abrir app» › Intervals.icu Companion. Comprueba también, en la pestaña Apple Health de la app, que el envío de entrenamientos esté activado.",
    pt: "Passa pela app de iPhone Intervals.icu Companion, que só consegue ler a app Saúde com o iPhone desbloqueado: abre a app depois da sessão, é nesse momento que a envia. Para não teres de te lembrar: app Atalhos › Automatização › + › «Treino com o Apple Watch» › «Fim» › «Executar imediatamente», e depois a ação «Abrir app» › Intervals.icu Companion. Verifica também, no separador Apple Health da app, que o envio de treinos está ativado.",
  },
  "Mes activités n'apparaissent pas dans l'app": {
    en: "Imports go through intervals.icu. In Watch Sync, check that your API key is filled in and still valid. If you regenerated the key on intervals.icu, you must re-enter it here.",
    de: "Der Import läuft über intervals.icu. Prüfe unter Uhr-Sync, ob dein API-Schlüssel eingetragen und noch gültig ist. Wenn du den Schlüssel neu erzeugt hast, musst du ihn hier erneut eingeben.",
    es: "La importación pasa por intervals.icu. Comprueba en Sincronizar reloj que tu clave API esté rellenada y siga siendo válida. Si regeneraste la clave, vuelve a introducirla aquí.",
    pt: "A importação passa pelo intervals.icu. Verifica em Sincronizar relógio que a tua chave API está preenchida e válida. Se regeraste a chave, tens de a introduzir novamente aqui.",
  },
  "Le coach ne me donne aucune séance de fractionné": {
    en: "It is almost always intentional. The Calendar shows a « why this plan » banner with the exact reason: fatigue (high acute:chronic ratio, very negative TSB, low HRV, poor sleep), reported pain, or a cap tied to your running history. Intensity comes back on its own once the signal drops.",
    de: "Das ist fast immer beabsichtigt. Der Kalender zeigt ein Banner « warum dieser Plan » mit dem genauen Grund: Ermüdung (hohes Belastungsverhältnis, stark negativer TSB, niedrige HRV, schlechter Schlaf), gemeldete Schmerzen oder eine Grenze wegen deiner Laufhistorie.",
    es: "Casi siempre es intencionado. El Calendario muestra un aviso « por qué este plan » con el motivo exacto: fatiga (ratio de carga alto, TSB muy negativo, VFC baja, mal sueño), dolor declarado o un tope ligado a tu historial de carrera.",
    pt: "É quase sempre intencional. O Calendário mostra um aviso « porquê este plano » com o motivo exato: fadiga (rácio de carga alto, TSB muito negativo, VFC baixa, mau sono), dor declarada ou um limite ligado ao teu histórico.",
  },
  "Mon kilométrage me semble faux": {
    en: "Only running counts toward training volume. Hikes, walks and rides are excluded on purpose — otherwise a hiking week would trigger an oversized long run. They do count toward fatigue, though.",
    de: "Nur Laufen zählt zum Trainingsumfang. Wanderungen, Spaziergänge und Radfahrten sind bewusst ausgenommen — sonst würde eine Wanderwoche einen überzogenen langen Lauf auslösen. In die Ermüdung fließen sie aber ein.",
    es: "Solo la carrera cuenta en el volumen de entrenamiento. Senderismo, marcha y bici quedan excluidos a propósito — si no, una semana de senderismo provocaría una tirada larga desmesurada. Sí cuentan en la fatiga.",
    pt: "Só a corrida conta no volume de treino. Caminhadas e bicicleta são excluídas de propósito — caso contrário uma semana de caminhada provocaria um treino longo desmesurado. Contam, isso sim, na fadiga.",
  },
  "Je n'ai pas d'allure cible sur mes séances": {
    en: "Paces are derived from your VMA. With no imported session, VMA cannot be estimated and no pace is shown — deliberately: better none than an invented one. They appear as soon as your first activities sync.",
    de: "Die Tempovorgaben leiten sich aus deiner VMA ab. Ohne importierte Einheit lässt sie sich nicht schätzen und es wird kein Tempo angezeigt — bewusst: lieber keines als ein erfundenes.",
    es: "Los ritmos se calculan desde tu VAM. Sin sesiones importadas no puede estimarse y no se muestra ningún ritmo — a propósito: mejor ninguno que uno inventado.",
    pt: "Os ritmos calculam-se a partir da tua VAM. Sem sessões importadas não pode ser estimada e nenhum ritmo é mostrado — de propósito: melhor nenhum do que um inventado.",
  },
  "Je ne peux pas m'abonner / le paiement ne fonctionne pas": {
    en: "Payment is not open yet. It is not a fault on your side.",
    de: "Die Bezahlung ist noch nicht freigeschaltet. Es liegt nicht an dir.",
    es: "El pago aún no está abierto. No es un fallo de tu parte.",
    pt: "O pagamento ainda não está aberto. Não é uma falha do teu lado.",
  },
  "La boutique est vide": {
    en: "It only shows real offers imported from an official merchant feed. Until a feed is connected, a waiting screen is shown — a deliberate choice over a catalogue with made-up prices.",
    de: "Es werden nur echte Angebote aus einem offiziellen Händler-Feed angezeigt. Solange kein Feed angebunden ist, erscheint ein Wartebildschirm — bewusst gewählt statt eines Katalogs mit erfundenen Preisen.",
    es: "Solo muestra ofertas reales importadas de un feed comercial oficial. Mientras no haya feed, aparece una pantalla de espera — una elección deliberada frente a un catálogo con precios inventados.",
    pt: "Só mostra ofertas reais importadas de um feed comercial oficial. Enquanto não houver feed, aparece um ecrã de espera — escolha deliberada em vez de um catálogo com preços inventados.",
  },
  "Mon objectif de course n'a rien changé à mes séances": {
    en: "The TYPE of sessions does change (Threshold and Marathon pace instead of VO2max, for instance), but VOLUME stays anchored to what you actually run. And if fatigue is high, no quality session is scheduled that week, which makes it look like nothing moved. The Calendar's « why this plan » banner shows the real state.",
    de: "Die ART der Einheiten ändert sich sehr wohl (z. B. Schwelle und Marathontempo statt VO2max), aber der UMFANG bleibt an dem, was du tatsächlich läufst. Bei hoher Ermüdung wird zudem keine Qualitätseinheit gesetzt — es sieht dann so aus, als hätte sich nichts geändert.",
    es: "El TIPO de sesiones sí cambia (por ejemplo Umbral y ritmo maratón en vez de VO2max), pero el VOLUMEN sigue anclado a lo que corres de verdad. Y con fatiga alta no se programa ninguna sesión de calidad esa semana.",
    pt: "O TIPO de sessões muda mesmo (por exemplo Limiar e ritmo de maratona em vez de VO2max), mas o VOLUME continua ancorado no que corres de facto. E com fadiga alta não é marcada nenhuma sessão de qualidade nessa semana.",
  },
  "Puis-je connecter Strava, Polar, COROS ou Suunto ?": {
    en: "Pacevo connects to ONE platform only: intervals.icu. It is intervals.icu that then links to Garmin, COROS, Polar, Suunto or Strava through their official connections — Pacevo never accesses those accounts directly. So there is no « connect Strava » button: link Strava to intervals.icu, then intervals.icu to Pacevo from Watch Sync. Otherwise you can import a GPX or FIT file by hand from that same page.",
    de: "Pacevo verbindet sich mit NUR EINER Plattform: intervals.icu. Diese wiederum verbindet sich über die offiziellen Schnittstellen mit Garmin, COROS, Polar, Suunto oder Strava — Pacevo greift nie direkt auf diese Konten zu. Es gibt daher keinen « Strava verbinden »-Knopf: verbinde Strava mit intervals.icu und dann intervals.icu mit Pacevo unter Uhr-Sync. Alternativ lässt sich eine GPX- oder FIT-Datei von Hand importieren.",
    es: "Pacevo se conecta a UNA sola plataforma: intervals.icu. Es intervals.icu quien luego enlaza con Garmin, COROS, Polar, Suunto o Strava mediante sus conexiones oficiales — Pacevo nunca accede directamente a esas cuentas. Por eso no hay botón « conectar Strava »: enlaza Strava con intervals.icu y después intervals.icu con Pacevo desde Sincronizar reloj. También puedes importar un archivo GPX o FIT a mano.",
    pt: "O Pacevo liga-se a UMA só plataforma: intervals.icu. É o intervals.icu que depois se liga ao Garmin, COROS, Polar, Suunto ou Strava através das ligações oficiais — o Pacevo nunca acede diretamente a essas contas. Por isso não existe botão « ligar Strava »: liga o Strava ao intervals.icu e depois o intervals.icu ao Pacevo em Sincronizar relógio. Em alternativa podes importar um ficheiro GPX ou FIT à mão.",
  },
  "Comment supprimer mon compte ou mes données": {
    en: "From Settings. For any personal-data request, the Privacy page explains the procedure.",
    de: "Über die Einstellungen. Für Anfragen zu personenbezogenen Daten beschreibt die Datenschutzseite das Vorgehen.",
    es: "Desde Ajustes. Para cualquier solicitud sobre datos personales, la página de Privacidad indica el procedimiento.",
    pt: "A partir das Definições. Para pedidos sobre dados pessoais, a página de Privacidade indica o procedimento.",
  },
};
