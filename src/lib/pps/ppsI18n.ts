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
    champDate: "Date d'obtention",
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
    champDate: "Date obtained",
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
    champDate: "Ausstellungsdatum",
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
    champDate: "Fecha de obtención",
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
    champDate: "Data de obtenção",
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
  },
};
