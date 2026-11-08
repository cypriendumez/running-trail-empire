/**
 * Les textes de la page /robot, en 5 langues — séparés de la page pour être testés
 * (tests/legalite.test.ts) : chaque langue doit dire comment refuser.
 */
import type { Lang } from "@/lib/i18n/translations";

/** Les deux lignes qu'un organisateur ajoute à son robots.txt pour ne plus être lu. */
export const ROBOTS_TXT_REFUS = "User-agent: PacevoBot\nDisallow: /";

export type TexteRobot = { titre: string; intro: string; quoiT: string; quoi: string[]; gardeT: string; garde: string; refusT: string; refusA: string; refusB: string; refusC: string; idT: string };
export const TEXTES_ROBOT: Record<Lang, TexteRobot> = {
  fr: {
    titre: "PacevoBot", intro: "PacevoBot est le robot de Pacevo, une application d'entraînement à la course à pied. Il lit les pages PUBLIQUES des courses — sites des organisateurs et leurs pages d'inscription — pour proposer aux coureurs un lien direct vers votre site.",
    quoiT: "Ce qu'il fait", quoi: [
      "Il respecte votre robots.txt (agent « PacevoBot », sinon « * ») : un chemin interdit n'est jamais lu.",
      "Il ne lit qu'une page à la fois par site, avec des pauses. Une même page est relue au plus quelques fois par jour dans les semaines qui entourent la course (pour annoncer vite les résultats), bien moins le reste de l'année.",
      "Il ne se connecte à aucun compte et ne lit jamais une page réservée.",
      "Il s'identifie toujours : jamais de déguisement en navigateur.",
    ],
    gardeT: "Ce qu'il garde", garde: "Uniquement des liens (inscription, classement, parcours) et les dates annoncées. Jamais le contenu de vos pages, jamais les noms ni les temps de vos classements : les coureurs sont renvoyés vers VOTRE site.",
    refusT: "Comment refuser", refusA: "Ajoutez à votre robots.txt :", refusB: "ou écrivez-nous à", refusC: "— votre site est ajouté à notre liste d'opposition, que lisent tous nos robots.",
    idT: "Son identité",
  },
  en: {
    titre: "PacevoBot", intro: "PacevoBot is the robot of Pacevo, a running training app. It reads PUBLIC race pages — organisers' websites and their registration pages — to give runners a direct link to your site.",
    quoiT: "What it does", quoi: [
      "It respects your robots.txt (agent “PacevoBot”, otherwise “*”): a disallowed path is never read.",
      "It reads one page at a time per site, with pauses. The same page is read again at most a few times a day in the weeks around the race (to announce results quickly), far less the rest of the year.",
      "It never logs into any account and never reads a restricted page.",
      "It always identifies itself: it never pretends to be a browser.",
    ],
    gardeT: "What it keeps", garde: "Only links (registration, results, course map) and announced dates. Never the content of your pages, never the names or times in your results: runners are sent to YOUR site.",
    refusT: "How to opt out", refusA: "Add to your robots.txt:", refusB: "or write to us at", refusC: "— your site is added to our opt-out list, which every one of our robots reads.",
    idT: "Its identity",
  },
  de: {
    titre: "PacevoBot", intro: "PacevoBot ist der Roboter von Pacevo, einer Lauftrainings-App. Er liest ÖFFENTLICHE Seiten von Laufveranstaltungen — Websites der Veranstalter und ihre Anmeldeseiten —, um Läufern einen direkten Link zu Ihrer Website anzubieten.",
    quoiT: "Was er tut", quoi: [
      "Er beachtet Ihre robots.txt (Agent „PacevoBot“, sonst „*“): Ein gesperrter Pfad wird nie gelesen.",
      "Er liest pro Website jeweils nur eine Seite, mit Pausen. Dieselbe Seite wird in den Wochen rund um den Lauf höchstens einige Male pro Tag erneut gelesen (um Ergebnisse schnell anzukündigen), im Rest des Jahres viel seltener.",
      "Er meldet sich bei keinem Konto an und liest nie eine geschützte Seite.",
      "Er gibt sich immer zu erkennen: Er tarnt sich nie als Browser.",
    ],
    gardeT: "Was er speichert", garde: "Nur Links (Anmeldung, Ergebnisse, Strecke) und angekündigte Termine. Nie den Inhalt Ihrer Seiten, nie Namen oder Zeiten Ihrer Ergebnislisten: Läufer werden auf IHRE Website geleitet.",
    refusT: "Wie Sie widersprechen", refusA: "Ergänzen Sie Ihre robots.txt:", refusB: "oder schreiben Sie uns an", refusC: "— Ihre Website kommt auf unsere Sperrliste, die jeder unserer Roboter liest.",
    idT: "Seine Kennung",
  },
  es: {
    titre: "PacevoBot", intro: "PacevoBot es el robot de Pacevo, una aplicación de entrenamiento para correr. Lee las páginas PÚBLICAS de las carreras — webs de los organizadores y sus páginas de inscripción — para ofrecer a los corredores un enlace directo a su web.",
    quoiT: "Qué hace", quoi: [
      "Respeta su robots.txt (agente «PacevoBot», si no «*»): una ruta prohibida nunca se lee.",
      "Lee una sola página a la vez por sitio, con pausas. Una misma página se vuelve a leer como mucho unas pocas veces al día en las semanas cercanas a la carrera (para anunciar pronto los resultados), mucho menos el resto del año.",
      "Nunca inicia sesión en una cuenta ni lee una página restringida.",
      "Siempre se identifica: nunca se hace pasar por un navegador.",
    ],
    gardeT: "Qué guarda", garde: "Solo enlaces (inscripción, clasificación, recorrido) y las fechas anunciadas. Nunca el contenido de sus páginas, nunca los nombres ni los tiempos de sus clasificaciones: los corredores van a SU web.",
    refusT: "Cómo oponerse", refusA: "Añada a su robots.txt:", refusB: "o escríbanos a", refusC: "— su sitio se añade a nuestra lista de oposición, que leen todos nuestros robots.",
    idT: "Su identidad",
  },
  pt: {
    titre: "PacevoBot", intro: "O PacevoBot é o robô da Pacevo, uma aplicação de treino de corrida. Lê as páginas PÚBLICAS das provas — sites dos organizadores e as suas páginas de inscrição — para dar aos corredores uma ligação direta para o seu site.",
    quoiT: "O que faz", quoi: [
      "Respeita o seu robots.txt (agente «PacevoBot», senão «*»): um caminho proibido nunca é lido.",
      "Lê uma página de cada vez por site, com pausas. A mesma página é relida no máximo algumas vezes por dia nas semanas em torno da prova (para anunciar depressa os resultados), muito menos no resto do ano.",
      "Nunca entra numa conta nem lê uma página reservada.",
      "Identifica-se sempre: nunca se faz passar por um navegador.",
    ],
    gardeT: "O que guarda", garde: "Apenas ligações (inscrição, classificação, percurso) e as datas anunciadas. Nunca o conteúdo das suas páginas, nunca os nomes nem os tempos das suas classificações: os corredores são enviados para o SEU site.",
    refusT: "Como recusar", refusA: "Acrescente ao seu robots.txt:", refusB: "ou escreva-nos para", refusC: "— o seu site é adicionado à nossa lista de oposição, lida por todos os nossos robôs.",
    idT: "A sua identidade",
  },
};
