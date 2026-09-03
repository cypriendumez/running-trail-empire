/**
 * Textes des pages PUBLIQUES de courses, dans les cinq langues.
 *
 * ⚠️ SEULE L'INTERFACE EST TRADUITE, PAS LES DONNÉES. Le nom d'une course, sa ville et
 * sa région sont des noms propres français : « Trail des Crêtes » reste « Trail des
 * Crêtes » en allemand, et « Épinal » reste « Épinal ». Traduire une donnée pour faire
 * joli la rendrait fausse et introuvable.
 */
export type LangCourses = "fr" | "en" | "de" | "es" | "pt";

export const C: Record<LangCourses, Record<string, string>> = {
  fr: {
    "index.titre": "Calendrier des courses et trails en France",
    "index.titreRegion": "Courses et trails {region}",
    "index.sous": "Dates, distances, dénivelé et lien d'inscription officiel. Les prochaines épreuves d'abord.",
    "index.meta": "Le calendrier des courses à pied, trails et ultras en France : dates, distances, dénivelé et lien d'inscription officiel.",
    "index.metaRegion": "Toutes les courses à pied et trails à venir {region} : dates, distances, dénivelé et inscription.",
    "index.toutes": "Toutes", "index.vide": "Aucune course à venir n'est enregistrée pour cette région.",
    "index.limite": "Les {n} prochaines épreuves.", "fil.courses": "Courses",
    "f.distance": "Distance", "f.denivele": "Dénivelé positif", "f.terrain": "Terrain",
    "f.orga": "Organisation", "f.itra": "Certification ITRA", "f.points": "{n} point(s)", "f.oui": "oui",
    "cta.inscription": "Voir les inscriptions sur {site}",
    "cta.avertissement": "Informations données à titre indicatif : seul l'organisateur fait foi pour les dates, tarifs et conditions.", "cta.tiers": "Ce lien mène à {site}, un calendrier de courses indépendant de Pacevo — pas au site de l'organisateur.", "cta.direct": "Ce lien mène à {site}.",
    "prep.titre": "Se préparer pour cette course",
    "prep.texte": "Pacevo construit un plan d'entraînement qui vise cette date, l'ajuste à ta forme réelle et l'envoie sur ta montre.",
    "prep.bouton": "Créer mon plan", "sansDate.titre": "Date non encore annoncée", "sansDate.texte": "L'organisateur n'a pas publié la date de la prochaine édition. Le lien ci-dessous mène à son site officiel, où elle paraîtra.", "sansDate.liste": "Date non annoncée", "index.sansDate": "Épreuves dont la date n'est pas encore annoncée",
 "introuvable": "Course introuvable",
  },
  en: {
    "index.titre": "Running races and trails calendar in France",
    "index.titreRegion": "Races and trails in {region}",
    "index.sous": "Dates, distances, elevation gain and official registration link. Upcoming events first.",
    "index.meta": "The calendar of road races, trails and ultras in France: dates, distances, elevation gain and official registration link.",
    "index.metaRegion": "All upcoming races and trails in {region}: dates, distances, elevation gain and registration.",
    "index.toutes": "All", "index.vide": "No upcoming race is listed for this region.",
    "index.limite": "The next {n} events.", "fil.courses": "Races",
    "f.distance": "Distance", "f.denivele": "Elevation gain", "f.terrain": "Terrain",
    "f.orga": "Organiser", "f.itra": "ITRA certification", "f.points": "{n} point(s)", "f.oui": "yes",
    "cta.inscription": "See registration on {site}",
    "cta.avertissement": "Information is indicative only: the organiser alone is authoritative on dates, prices and conditions.", "cta.tiers": "This link goes to {site}, a race calendar independent of Pacevo — not to the organiser's own site.", "cta.direct": "This link goes to {site}.",
    "prep.titre": "Train for this race",
    "prep.texte": "Pacevo builds a training plan aimed at this date, adjusts it to your actual fitness and sends it to your watch.",
    "prep.bouton": "Build my plan", "sansDate.titre": "Date not announced yet", "sansDate.texte": "The organiser has not published the date of the next edition. The link below leads to their official site, where it will appear.", "sansDate.liste": "Date not announced", "index.sansDate": "Events whose date is not announced yet",
 "introuvable": "Race not found",
  },
  de: {
    "index.titre": "Lauf- und Trailkalender in Frankreich",
    "index.titreRegion": "Läufe und Trails in {region}",
    "index.sous": "Termine, Distanzen, Höhenmeter und offizieller Anmeldelink. Die nächsten Veranstaltungen zuerst.",
    "index.meta": "Der Kalender der Straßenläufe, Trails und Ultras in Frankreich: Termine, Distanzen, Höhenmeter und offizieller Anmeldelink.",
    "index.metaRegion": "Alle kommenden Läufe und Trails in {region}: Termine, Distanzen, Höhenmeter und Anmeldung.",
    "index.toutes": "Alle", "index.vide": "Für diese Region ist kein kommender Lauf erfasst.",
    "index.limite": "Die nächsten {n} Veranstaltungen.", "fil.courses": "Läufe",
    "f.distance": "Distanz", "f.denivele": "Höhenmeter", "f.terrain": "Gelände",
    "f.orga": "Veranstalter", "f.itra": "ITRA-Zertifizierung", "f.points": "{n} Punkt(e)", "f.oui": "ja",
    "cta.inscription": "Anmeldung auf {site} ansehen",
    "cta.avertissement": "Die Angaben sind unverbindlich: Für Termine, Preise und Bedingungen gilt allein der Veranstalter.", "cta.tiers": "Dieser Link führt zu {site}, einem von Pacevo unabhängigen Laufkalender — nicht zur Seite des Veranstalters.", "cta.direct": "Dieser Link führt zu {site}.",
    "prep.titre": "Für diesen Lauf trainieren",
    "prep.texte": "Pacevo erstellt einen Trainingsplan für dieses Datum, passt ihn an deine tatsächliche Form an und schickt ihn auf deine Uhr.",
    "prep.bouton": "Plan erstellen", "sansDate.titre": "Termin noch nicht bekannt", "sansDate.texte": "Der Veranstalter hat den Termin der nächsten Ausgabe noch nicht veröffentlicht. Der Link unten führt auf seine offizielle Seite, wo er erscheinen wird.", "sansDate.liste": "Termin offen", "index.sansDate": "Veranstaltungen ohne bekannten Termin",
 "introuvable": "Lauf nicht gefunden",
  },
  es: {
    "index.titre": "Calendario de carreras y trails en Francia",
    "index.titreRegion": "Carreras y trails en {region}",
    "index.sous": "Fechas, distancias, desnivel y enlace de inscripción oficial. Las próximas pruebas primero.",
    "index.meta": "El calendario de carreras, trails y ultras en Francia: fechas, distancias, desnivel y enlace de inscripción oficial.",
    "index.metaRegion": "Todas las carreras y trails próximos en {region}: fechas, distancias, desnivel e inscripción.",
    "index.toutes": "Todas", "index.vide": "No hay ninguna carrera próxima registrada para esta región.",
    "index.limite": "Las próximas {n} pruebas.", "fil.courses": "Carreras",
    "f.distance": "Distancia", "f.denivele": "Desnivel positivo", "f.terrain": "Terreno",
    "f.orga": "Organización", "f.itra": "Certificación ITRA", "f.points": "{n} punto(s)", "f.oui": "sí",
    "cta.inscription": "Ver las inscripciones en {site}",
    "cta.avertissement": "La información es orientativa: solo el organizador da fe de fechas, precios y condiciones.", "cta.tiers": "Este enlace lleva a {site}, un calendario de carreras independiente de Pacevo — no a la web del organizador.", "cta.direct": "Este enlace lleva a {site}.",
    "prep.titre": "Preparar esta carrera",
    "prep.texte": "Pacevo construye un plan de entrenamiento que apunta a esta fecha, lo ajusta a tu forma real y lo envía a tu reloj.",
    "prep.bouton": "Crear mi plan", "sansDate.titre": "Fecha aún no anunciada", "sansDate.texte": "El organizador no ha publicado la fecha de la próxima edición. El enlace de abajo lleva a su web oficial, donde aparecerá.", "sansDate.liste": "Fecha no anunciada", "index.sansDate": "Pruebas cuya fecha aún no se ha anunciado",
 "introuvable": "Carrera no encontrada",
  },
  pt: {
    "index.titre": "Calendário de corridas e trails em França",
    "index.titreRegion": "Corridas e trails em {region}",
    "index.sous": "Datas, distâncias, desnível e link de inscrição oficial. As próximas provas primeiro.",
    "index.meta": "O calendário de corridas, trails e ultras em França: datas, distâncias, desnível e link de inscrição oficial.",
    "index.metaRegion": "Todas as corridas e trails a chegar em {region}: datas, distâncias, desnível e inscrição.",
    "index.toutes": "Todas", "index.vide": "Nenhuma corrida a chegar está registada para esta região.",
    "index.limite": "As próximas {n} provas.", "fil.courses": "Corridas",
    "f.distance": "Distância", "f.denivele": "Desnível positivo", "f.terrain": "Terreno",
    "f.orga": "Organização", "f.itra": "Certificação ITRA", "f.points": "{n} ponto(s)", "f.oui": "sim",
    "cta.inscription": "Ver as inscrições em {site}",
    "cta.avertissement": "As informações são indicativas: só o organizador faz fé quanto a datas, preços e condições.", "cta.tiers": "Este link leva a {site}, um calendário de corridas independente da Pacevo — não ao site do organizador.", "cta.direct": "Este link leva a {site}.",
    "prep.titre": "Preparar esta corrida",
    "prep.texte": "A Pacevo constrói um plano de treino que aponta para esta data, ajusta-o à tua forma real e envia-o para o teu relógio.",
    "prep.bouton": "Criar o meu plano", "sansDate.titre": "Data ainda não anunciada", "sansDate.texte": "O organizador não publicou a data da próxima edição. O link abaixo leva ao seu site oficial, onde ela aparecerá.", "sansDate.liste": "Data não anunciada", "index.sansDate": "Provas cuja data ainda não foi anunciada",
 "introuvable": "Corrida não encontrada",
  },
};

export function texteCourses(lang: string, cle: string, p: Record<string, string | number> = {}): string {
  const table = C[(lang as LangCourses)] ?? C.fr;
  const brut = table[cle] ?? C.fr[cle] ?? cle;
  return brut.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
}
