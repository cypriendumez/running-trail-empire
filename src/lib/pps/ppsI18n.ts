// ─────────────────────────────────────────────────────────────────────────────
//  PPS — les 5 langues.
//
//  Le dispositif est FRANÇAIS, mais le public ne l'est pas : un Allemand qui vient
//  courir un marathon en France y est soumis exactement comme un Français. Les textes
//  précisent donc « pour les courses en France » plutôt que de supposer le lecteur.
//
//  ⚠️ RÈGLE DE RÉDACTION. On n'écrit NULLE PART que l'athlète est « apte », « en règle »
//  ou « autorisé à courir ». Nous ne vérifions rien auprès de la fédération — il n'y a
//  pas d'API pour cela — et nous ne raisonnons que sur une date qu'il a saisie lui-même.
//  Chaque formulation le rappelle. L'autorité reste l'organisateur et la FFA.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesPps = {
  nav: string;
  titre: string;
  sousTitre: string;
  quoiTitre: string;
  quoi: string;
  quiTitre: string;
  qui: string;
  licencie: string;
  mineur: string;
  /** Les 4 étapes du parcours officiel. */
  etapes: string[];
  etapesTitre: string;
  cta: string;
  prixEtDuree: (prix: number, mois: number) => string;

  // ── Suivi personnel ────────────────────────────────────────────────────────
  suiviTitre: string;
  suiviIntro: string;
  champDate: string;
  champDateAide: string;
  champNumero: string;
  champNumeroAide: string;
  licencieCase: string;
  licencieAide: string;
  enregistrer: string;
  enregistre: string;
  effacer: string;

  // ── Verdicts ───────────────────────────────────────────────────────────────
  vInconnu: string;
  vInconnuAide: string;
  vValide: (expire: string, jours: number) => string;
  vExpire: (expire: string) => string;
  vExpireAvantCourse: (expire: string, course: string) => string;
  vLicencie: string;
  /** Rappel affiché sous CHAQUE verdict : nous ne vérifions rien. */
  avertissement: string;
  /** Pastille compacte, sur une carte de course. */
  pastilleRequis: string;
  pastilleOk: string;
  pastilleAlerte: string;
  /** Bandeau au moment de s'inscrire. */
  avantInscription: string;

  // ── Vérification du pass ────────────────────────────────────────────────────
  verifTitre: string;
  /** « Tu peux courir jusqu'au 24 mars 2027 inclus. » */
  jusquA: (date: string) => string;
  jusquALicencie: string;
  jusquAInconnu: string;
  /** Pourquoi nous ne validons PAS le numéro — limite de droit, pas d'oubli. */
  pasDeVerification: string;
  mesCourses: string;
  aucuneCourse: string;
  couverte: string;
  nonCouverte: string;
  numeroFormat: string;
};

export const PPS_T: Record<Lang, TextesPps> = {
  fr: {
    nav: "PPS course",
    titre: "Pass Prévention Santé",
    sousTitre: "Sans lui, tu ne peux plus t'inscrire à une course chronométrée en France.",
    quoiTitre: "Ce que c'est",
    quoi: "Depuis le 1er septembre 2024, le certificat médical ne suffit plus pour s'inscrire à une compétition de course à pied chronométrée en France. Il est remplacé par le PPS, un parcours de prévention en ligne de la Fédération Française d'Athlétisme. Depuis janvier 2026, c'est un pass payant, valable un an, qui inclut une responsabilité civile.",
    quiTitre: "Qui doit le faire",
    qui: "Tout coureur MAJEUR NON LICENCIÉ qui s'inscrit à une course chronométrée en France — route comme trail, du 10 km à l'ultra.",
    licencie: "Licencié FFA : ta licence en tient lieu, tu n'as rien à faire.",
    mineur: "Mineur : pas de pass payant, mais un questionnaire de santé gratuit à remplir avec un parent, à refaire pour chaque course.",
    etapesTitre: "Comment l'obtenir",
    etapes: [
      "Crée ton compte sur la plateforme de la fédération.",
      "Suis le parcours de sensibilisation (vidéos sur le risque cardiovasculaire et les gestes qui sauvent).",
      "Règle les 5 € en ligne.",
      "Télécharge ton attestation et note ton numéro de pass — c'est ce que l'organisateur te demandera.",
    ],
    cta: "Faire mon PPS sur pps.athle.fr",
    prixEtDuree: (p, m) => `${p} € · valable ${m} mois`,

    suiviTitre: "Garde-le à l'œil",
    suiviIntro: "Note ici la date à laquelle tu l'as obtenu. On te préviendra s'il expire avant une de tes courses — c'est le piège classique d'une préparation longue.",
    champDate: "Expire le (indiqué sur ton pass)",
    champDateAide: "Recopie la date affichée sur ton pass — pas besoin de calculer quoi que ce soit.",
    champNumero: "Numéro de pass (facultatif)",
    champNumeroAide: "Pour l'avoir sous la main le jour de l'inscription.",
    licencieCase: "Je suis licencié FFA",
    licencieAide: "Ta licence remplace le PPS : on cesse de t'en parler.",
    enregistrer: "Enregistrer",
    enregistre: "Enregistré",
    effacer: "Effacer",

    vInconnu: "PPS non renseigné",
    vInconnuAide: "Tu en auras besoin pour t'inscrire à une course en France.",
    vValide: (e, j) => `Valable jusqu'au ${e} — encore ${j} jour${j > 1 ? "s" : ""}`,
    vExpire: (e) => `Expiré depuis le ${e}`,
    vExpireAvantCourse: (e, c) => `⚠️ Il expire le ${e}, avant ta course du ${c} : refais-le, sinon tu ne pourras pas t'inscrire ou retirer ton dossard.`,
    vLicencie: "Licencié FFA — dispensé de PPS",
    avertissement: "Calculé à partir de la date que tu as saisie. Nous ne vérifions rien auprès de la fédération : seul l'organisateur de la course fait foi.",
    pastilleRequis: "PPS requis",
    pastilleOk: "PPS valable ce jour-là",
    pastilleAlerte: "PPS à refaire",
    avantInscription: "Avant de t'inscrire",
    verifTitre: "Vérifier mon pass",
    jusquA: (d) => `Tu peux courir toute course jusqu'au ${d} inclus.`,
    jusquALicencie: "Ta licence FFA te couvre : aucune date d'expiration à surveiller.",
    jusquAInconnu: "Renseigne la date d'expiration de ton pass pour savoir jusqu'à quand tu peux courir.",
    pasDeVerification: "Nous ne pouvons PAS contrôler l'authenticité de ton numéro : l'API de vérification de la FFA est réservée aux entreprises labellisées. Le jour J, c'est l'organisateur qui scanne ton QR code. On vérifie seulement la forme du numéro et on suit ta date.",
    mesCourses: "Tes courses à venir",
    aucuneCourse: "Aucune course prévue pour l'instant — ajoute-en une depuis l'onglet Courses.",
    couverte: "couverte",
    nonCouverte: "après expiration",
    numeroFormat: "Ce numéro ne ressemble pas à un numéro de pass — vérifie la copie.",
  },

  en: {
    nav: "Race health pass",
    titre: "Health Prevention Pass (PPS)",
    sousTitre: "Without it you can no longer enter a timed race in France.",
    quoiTitre: "What it is",
    quoi: "Since 1 September 2024 a medical certificate is no longer enough to enter a timed running competition in France. It has been replaced by the PPS, an online prevention course run by the French Athletics Federation. Since January 2026 it is a paid pass, valid for one year, and it includes third-party liability cover.",
    quiTitre: "Who needs one",
    qui: "Every ADULT runner WITHOUT A FEDERATION LICENCE entering a timed race in France — road and trail alike, from 10 km to ultra.",
    licencie: "FFA licence holder: your licence covers it, there is nothing to do.",
    mineur: "Under 18: no paid pass, but a free health questionnaire to fill in with a parent, redone for each race.",
    etapesTitre: "How to get it",
    etapes: [
      "Create your account on the federation's platform.",
      "Go through the awareness course (videos on cardiovascular risk and life-saving actions).",
      "Pay the €5 online.",
      "Download your certificate and note your pass number — that is what the organiser will ask for.",
    ],
    cta: "Get my PPS on pps.athle.fr",
    prixEtDuree: (p, m) => `€${p} · valid for ${m} months`,

    suiviTitre: "Keep an eye on it",
    suiviIntro: "Record the date you got it. We will warn you if it runs out before one of your races — the classic trap of a long build-up.",
    champDate: "Expires on (shown on your pass)",
    champDateAide: "Copy the date printed on your pass — no arithmetic needed.",
    champNumero: "Pass number (optional)",
    champNumeroAide: "So you have it to hand when you enter.",
    licencieCase: "I hold an FFA licence",
    licencieAide: "Your licence replaces the PPS: we will stop bringing it up.",
    enregistrer: "Save",
    enregistre: "Saved",
    effacer: "Clear",

    vInconnu: "PPS not recorded",
    vInconnuAide: "You will need one to enter a race in France.",
    vValide: (e, j) => `Valid until ${e} — ${j} day${j > 1 ? "s" : ""} left`,
    vExpire: (e) => `Expired on ${e}`,
    vExpireAvantCourse: (e, c) => `⚠️ It expires on ${e}, before your race on ${c}: renew it, otherwise you will not be able to enter or collect your bib.`,
    vLicencie: "FFA licence holder — no PPS needed",
    avertissement: "Worked out from the date you entered. We check nothing with the federation: only the race organiser decides.",
    pastilleRequis: "PPS required",
    pastilleOk: "PPS valid that day",
    pastilleAlerte: "PPS to renew",
    avantInscription: "Before you enter",
    verifTitre: "Check my pass",
    jusquA: (d) => `You can enter any race up to and including ${d}.`,
    jusquALicencie: "Your FFA licence covers you: no expiry date to watch.",
    jusquAInconnu: "Enter your pass expiry date to find out how far ahead you are covered.",
    pasDeVerification: "We CANNOT check whether your number is genuine: the federation's verification API is reserved for labelled companies. On race day the organiser scans your QR code. We only check the shape of the number and track your date.",
    mesCourses: "Your upcoming races",
    aucuneCourse: "No race planned yet — add one from the Races tab.",
    couverte: "covered",
    nonCouverte: "after expiry",
    numeroFormat: "That does not look like a pass number — check what you pasted.",
  },

  de: {
    nav: "Gesundheitspass",
    titre: "Gesundheits-Präventionspass (PPS)",
    sousTitre: "Ohne ihn kannst du in Frankreich an keinem Wettkampf mit Zeitmessung mehr teilnehmen.",
    quoiTitre: "Worum es geht",
    quoi: "Seit dem 1. September 2024 genügt ein ärztliches Attest nicht mehr, um sich in Frankreich für einen Laufwettkampf mit Zeitmessung anzumelden. An seine Stelle tritt der PPS, ein Online-Präventionsparcours des französischen Leichtathletikverbands. Seit Januar 2026 ist es ein kostenpflichtiger Pass mit einem Jahr Gültigkeit, inklusive Haftpflichtversicherung.",
    quiTitre: "Wer ihn braucht",
    qui: "Jede ERWACHSENE Läuferin und jeder erwachsene Läufer OHNE VERBANDSLIZENZ, die oder der sich in Frankreich für einen Wettkampf mit Zeitmessung anmeldet — Straße wie Trail, von 10 km bis Ultra.",
    licencie: "Mit FFA-Lizenz: Die Lizenz deckt das ab, du musst nichts tun.",
    mineur: "Minderjährige: kein kostenpflichtiger Pass, sondern ein kostenloser Gesundheitsfragebogen zusammen mit einem Elternteil, für jeden Wettkampf neu.",
    etapesTitre: "So bekommst du ihn",
    etapes: [
      "Lege dein Konto auf der Plattform des Verbands an.",
      "Durchlaufe den Sensibilisierungsparcours (Videos zum Herz-Kreislauf-Risiko und zu lebensrettenden Maßnahmen).",
      "Zahle die 5 € online.",
      "Lade deine Bescheinigung herunter und notiere deine Passnummer — danach fragt der Veranstalter.",
    ],
    cta: "PPS auf pps.athle.fr machen",
    prixEtDuree: (p, m) => `${p} € · ${m} Monate gültig`,

    suiviTitre: "Behalte ihn im Blick",
    suiviIntro: "Trage hier ein, wann du ihn bekommen hast. Wir warnen dich, wenn er vor einem deiner Wettkämpfe abläuft — die klassische Falle einer langen Vorbereitung.",
    champDate: "Gültig bis (auf deinem Pass)",
    champDateAide: "Übertrage das Datum von deinem Pass — du musst nichts ausrechnen.",
    champNumero: "Passnummer (optional)",
    champNumeroAide: "Damit du sie bei der Anmeldung zur Hand hast.",
    licencieCase: "Ich habe eine FFA-Lizenz",
    licencieAide: "Deine Lizenz ersetzt den PPS: Wir sprechen dich nicht mehr darauf an.",
    enregistrer: "Speichern",
    enregistre: "Gespeichert",
    effacer: "Löschen",

    vInconnu: "PPS nicht hinterlegt",
    vInconnuAide: "Du brauchst ihn für die Anmeldung zu einem Wettkampf in Frankreich.",
    vValide: (e, j) => `Gültig bis ${e} — noch ${j} Tag${j > 1 ? "e" : ""}`,
    vExpire: (e) => `Abgelaufen am ${e}`,
    vExpireAvantCourse: (e, c) => `⚠️ Er läuft am ${e} ab, also vor deinem Wettkampf am ${c}: erneuere ihn, sonst kannst du dich nicht anmelden und deine Startnummer nicht abholen.`,
    vLicencie: "FFA-Lizenz — kein PPS nötig",
    avertissement: "Berechnet aus dem von dir eingetragenen Datum. Wir prüfen nichts beim Verband: maßgeblich ist allein der Veranstalter.",
    pastilleRequis: "PPS erforderlich",
    pastilleOk: "PPS an dem Tag gültig",
    pastilleAlerte: "PPS erneuern",
    avantInscription: "Vor der Anmeldung",
    verifTitre: "Pass prüfen",
    jusquA: (d) => `Du kannst bis einschließlich ${d} an jedem Wettkampf teilnehmen.`,
    jusquALicencie: "Deine FFA-Lizenz deckt dich ab: kein Ablaufdatum im Blick zu behalten.",
    jusquAInconnu: "Trage das Ablaufdatum deines Passes ein, um zu sehen, wie weit du abgedeckt bist.",
    pasDeVerification: "Wir können die Echtheit deiner Nummer NICHT prüfen: Die Prüf-API des Verbands ist zertifizierten Unternehmen vorbehalten. Am Wettkampftag scannt der Veranstalter deinen QR-Code. Wir prüfen nur die Form der Nummer und verfolgen dein Datum.",
    mesCourses: "Deine kommenden Wettkämpfe",
    aucuneCourse: "Noch kein Wettkampf geplant — füge einen über den Reiter Wettkämpfe hinzu.",
    couverte: "abgedeckt",
    nonCouverte: "nach Ablauf",
    numeroFormat: "Das sieht nicht nach einer Passnummer aus — prüfe, was du eingefügt hast.",
  },

  es: {
    nav: "Pase de salud",
    titre: "Pase de Prevención de Salud (PPS)",
    sousTitre: "Sin él ya no puedes inscribirte en una carrera cronometrada en Francia.",
    quoiTitre: "Qué es",
    quoi: "Desde el 1 de septiembre de 2024 el certificado médico ya no basta para inscribirse en una competición de carrera cronometrada en Francia. Lo sustituye el PPS, un recorrido de prevención en línea de la Federación Francesa de Atletismo. Desde enero de 2026 es un pase de pago, válido un año, que incluye responsabilidad civil.",
    quiTitre: "Quién debe hacerlo",
    qui: "Todo corredor MAYOR DE EDAD SIN LICENCIA que se inscriba en una carrera cronometrada en Francia — asfalto o trail, del 10 km al ultra.",
    licencie: "Con licencia FFA: tu licencia lo cubre, no tienes que hacer nada.",
    mineur: "Menores: sin pase de pago, pero un cuestionario de salud gratuito a rellenar con un progenitor, en cada carrera.",
    etapesTitre: "Cómo obtenerlo",
    etapes: [
      "Crea tu cuenta en la plataforma de la federación.",
      "Haz el recorrido de sensibilización (vídeos sobre el riesgo cardiovascular y los gestos que salvan).",
      "Paga los 5 € en línea.",
      "Descarga tu certificado y anota tu número de pase — es lo que te pedirá el organizador.",
    ],
    cta: "Hacer mi PPS en pps.athle.fr",
    prixEtDuree: (p, m) => `${p} € · válido ${m} meses`,

    suiviTitre: "No lo pierdas de vista",
    suiviIntro: "Anota aquí la fecha en que lo obtuviste. Te avisaremos si caduca antes de una de tus carreras — la trampa clásica de una preparación larga.",
    champDate: "Caduca el (indicado en tu pase)",
    champDateAide: "Copia la fecha impresa en tu pase — no hay que calcular nada.",
    champNumero: "Número de pase (opcional)",
    champNumeroAide: "Para tenerlo a mano al inscribirte.",
    licencieCase: "Tengo licencia FFA",
    licencieAide: "Tu licencia sustituye al PPS: dejamos de mencionártelo.",
    enregistrer: "Guardar",
    enregistre: "Guardado",
    effacer: "Borrar",

    vInconnu: "PPS no registrado",
    vInconnuAide: "Lo necesitarás para inscribirte en una carrera en Francia.",
    vValide: (e, j) => `Válido hasta el ${e} — quedan ${j} día${j > 1 ? "s" : ""}`,
    vExpire: (e) => `Caducado el ${e}`,
    vExpireAvantCourse: (e, c) => `⚠️ Caduca el ${e}, antes de tu carrera del ${c}: renuévalo o no podrás inscribirte ni recoger el dorsal.`,
    vLicencie: "Licencia FFA — exento de PPS",
    avertissement: "Calculado a partir de la fecha que has indicado. No verificamos nada ante la federación: solo el organizador decide.",
    pastilleRequis: "PPS obligatorio",
    pastilleOk: "PPS válido ese día",
    pastilleAlerte: "PPS a renovar",
    avantInscription: "Antes de inscribirte",
    verifTitre: "Comprobar mi pase",
    jusquA: (d) => `Puedes inscribirte en cualquier carrera hasta el ${d} incluido.`,
    jusquALicencie: "Tu licencia FFA te cubre: ninguna fecha de caducidad que vigilar.",
    jusquAInconnu: "Indica la fecha de caducidad de tu pase para saber hasta cuándo estás cubierto.",
    pasDeVerification: "NO podemos comprobar la autenticidad de tu número: la API de verificación de la federación está reservada a empresas homologadas. El día de la carrera, el organizador escanea tu código QR. Nosotros solo comprobamos la forma del número y seguimos tu fecha.",
    mesCourses: "Tus próximas carreras",
    aucuneCourse: "Ninguna carrera prevista todavía — añade una desde la pestaña Carreras.",
    couverte: "cubierta",
    nonCouverte: "tras la caducidad",
    numeroFormat: "Esto no parece un número de pase — revisa lo que has pegado.",
  },

  pt: {
    nav: "Passe de saúde",
    titre: "Passe de Prevenção de Saúde (PPS)",
    sousTitre: "Sem ele já não podes inscrever-te numa corrida cronometrada em França.",
    quoiTitre: "O que é",
    quoi: "Desde 1 de setembro de 2024 o atestado médico deixou de bastar para a inscrição numa competição de corrida cronometrada em França. Foi substituído pelo PPS, um percurso de prevenção em linha da Federação Francesa de Atletismo. Desde janeiro de 2026 é um passe pago, válido um ano, que inclui responsabilidade civil.",
    quiTitre: "Quem tem de o fazer",
    qui: "Todo o corredor MAIOR DE IDADE SEM LICENÇA que se inscreva numa corrida cronometrada em França — estrada ou trail, dos 10 km ao ultra.",
    licencie: "Com licença FFA: a licença cobre-o, não tens nada a fazer.",
    mineur: "Menores: sem passe pago, mas um questionário de saúde gratuito a preencher com um progenitor, em cada corrida.",
    etapesTitre: "Como obtê-lo",
    etapes: [
      "Cria a tua conta na plataforma da federação.",
      "Faz o percurso de sensibilização (vídeos sobre o risco cardiovascular e os gestos que salvam).",
      "Paga os 5 € em linha.",
      "Descarrega o teu comprovativo e anota o número do passe — é o que o organizador te vai pedir.",
    ],
    cta: "Fazer o meu PPS em pps.athle.fr",
    prixEtDuree: (p, m) => `${p} € · válido ${m} meses`,

    suiviTitre: "Não o percas de vista",
    suiviIntro: "Regista aqui a data em que o obtiveste. Avisamos-te se expirar antes de uma das tuas corridas — a armadilha clássica de uma preparação longa.",
    champDate: "Expira a (indicado no teu passe)",
    champDateAide: "Copia a data impressa no teu passe — não tens de calcular nada.",
    champNumero: "Número do passe (opcional)",
    champNumeroAide: "Para o teres à mão na inscrição.",
    licencieCase: "Tenho licença FFA",
    licencieAide: "A tua licença substitui o PPS: deixamos de te falar nisso.",
    enregistrer: "Guardar",
    enregistre: "Guardado",
    effacer: "Apagar",

    vInconnu: "PPS não registado",
    vInconnuAide: "Vais precisar dele para te inscreveres numa corrida em França.",
    vValide: (e, j) => `Válido até ${e} — faltam ${j} dia${j > 1 ? "s" : ""}`,
    vExpire: (e) => `Expirou a ${e}`,
    vExpireAvantCourse: (e, c) => `⚠️ Expira a ${e}, antes da tua corrida de ${c}: renova-o, senão não poderás inscrever-te nem levantar o dorsal.`,
    vLicencie: "Licença FFA — dispensado de PPS",
    avertissement: "Calculado a partir da data que indicaste. Não verificamos nada junto da federação: só o organizador decide.",
    pastilleRequis: "PPS obrigatório",
    pastilleOk: "PPS válido nesse dia",
    pastilleAlerte: "PPS a renovar",
    avantInscription: "Antes de te inscreveres",
    verifTitre: "Verificar o meu passe",
    jusquA: (d) => `Podes inscrever-te em qualquer corrida até ${d} inclusive.`,
    jusquALicencie: "A tua licença FFA cobre-te: nenhuma data de expiração a vigiar.",
    jusquAInconnu: "Indica a data de expiração do teu passe para saberes até quando estás coberto.",
    pasDeVerification: "NÃO podemos verificar a autenticidade do teu número: a API de verificação da federação está reservada a empresas certificadas. No dia da corrida, é o organizador que lê o teu código QR. Nós só verificamos a forma do número e seguimos a tua data.",
    mesCourses: "As tuas próximas corridas",
    aucuneCourse: "Ainda não há corridas previstas — adiciona uma no separador Corridas.",
    couverte: "coberta",
    nonCouverte: "após a expiração",
    numeroFormat: "Isto não parece um número de passe — confere o que colaste.",
  },
};
