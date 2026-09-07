/**
 * Textes de la vue relief, dans les cinq langues.
 *
 * ⚠️ LES NOMS DE FONDS SONT DES NOMS PROPRES. « IGN », « swisstopo », « USGS » ne se
 * traduisent pas : ce sont les institutions qui publient la donnée, et les renommer
 * rendrait l'attribution fausse. Seul ce qui les décrit est traduit.
 */
export type LangRelief = "fr" | "en" | "de" | "es" | "pt";

const COMMUN = {
  "fond.satellite": "Satellite", "fond.opentopo": "OpenTopoMap",
  "fond.ignPlan": "IGN France", "fond.ignOrtho": "IGN France — ortho",
  "fond.swisstopo": "swisstopo", "fond.usTopo": "US Topo — USGS",
  "fond.ignEs": "IGN España", "fond.bkgDe": "BKG Deutschland",
};

export const R: Record<LangRelief, Record<string, string>> = {
  fr: { ...COMMUN,
    "calque.pentesFr": "Inclinaison des pentes",
    "trace.rando": "Randonnées", "trace.vtt": "VTT", "trace.ski": "Ski de randonnée", "trace.randoCh": "Sentiers de randonnée",
    "trace.licence": "Traces sous licence de base de données ouverte Open Data Commons (ODbL), depuis OpenStreetMap.",
    "zone.monde": "Monde", "zone.fr": "France", "zone.ch": "Suisse", "zone.us": "États-Unis", "zone.es": "Espagne", "zone.de": "Allemagne",
    "onglet.cartes": "Cartes", "onglet.calques": "Calques", "onglet.traces": "Traces",
    "relief.chargement": "Chargement du relief…", "relief.echec": "Le relief n'a pas pu être chargé.",
    "relief.sansCle": "La clé cartographique n'est pas configurée sur ce serveur : la vue relief est indisponible.",
    "relief.cadrer": "Recadrer sur la trace", "relief.couches": "Cartes et calques", "relief.fermer": "Fermer",
    "relief.titre": "Vue relief", "relief.sous": "Le terrain en trois dimensions, avec les sentiers et l'inclinaison des pentes.",
    "relief.ouvrir": "Voir en relief",
  },
  en: { ...COMMUN,
    "calque.pentesFr": "Slope angle",
    "trace.rando": "Hiking routes", "trace.vtt": "Mountain biking", "trace.ski": "Ski touring", "trace.randoCh": "Hiking paths",
    "trace.licence": "Routes under the Open Data Commons Open Database License (ODbL), from OpenStreetMap.",
    "zone.monde": "Worldwide", "zone.fr": "France", "zone.ch": "Switzerland", "zone.us": "United States", "zone.es": "Spain", "zone.de": "Germany",
    "onglet.cartes": "Maps", "onglet.calques": "Layers", "onglet.traces": "Routes",
    "relief.chargement": "Loading terrain…", "relief.echec": "The terrain could not be loaded.",
    "relief.sansCle": "The map key is not configured on this server: the terrain view is unavailable.",
    "relief.cadrer": "Frame the route", "relief.couches": "Maps and layers", "relief.fermer": "Close",
    "relief.titre": "Terrain view", "relief.sous": "The ground in three dimensions, with trails and slope angles.",
    "relief.ouvrir": "View in 3D",
  },
  de: { ...COMMUN,
    "calque.pentesFr": "Hangneigung",
    "trace.rando": "Wanderwege", "trace.vtt": "Mountainbike", "trace.ski": "Skitouren", "trace.randoCh": "Wanderwege",
    "trace.licence": "Wege unter der Open Data Commons Open Database License (ODbL), aus OpenStreetMap.",
    "zone.monde": "Weltweit", "zone.fr": "Frankreich", "zone.ch": "Schweiz", "zone.us": "USA", "zone.es": "Spanien", "zone.de": "Deutschland",
    "onglet.cartes": "Karten", "onglet.calques": "Ebenen", "onglet.traces": "Wege",
    "relief.chargement": "Gelände wird geladen…", "relief.echec": "Das Gelände konnte nicht geladen werden.",
    "relief.sansCle": "Der Kartenschlüssel ist auf diesem Server nicht konfiguriert: die Geländeansicht ist nicht verfügbar.",
    "relief.cadrer": "Auf die Route zentrieren", "relief.couches": "Karten und Ebenen", "relief.fermer": "Schließen",
    "relief.titre": "Geländeansicht", "relief.sous": "Das Gelände in drei Dimensionen, mit Wegen und Hangneigung.",
    "relief.ouvrir": "In 3D ansehen",
  },
  es: { ...COMMUN,
    "calque.pentesFr": "Inclinación de las pendientes",
    "trace.rando": "Senderismo", "trace.vtt": "BTT", "trace.ski": "Esquí de travesía", "trace.randoCh": "Senderos",
    "trace.licence": "Rutas bajo la licencia Open Data Commons Open Database License (ODbL), desde OpenStreetMap.",
    "zone.monde": "Mundo", "zone.fr": "Francia", "zone.ch": "Suiza", "zone.us": "Estados Unidos", "zone.es": "España", "zone.de": "Alemania",
    "onglet.cartes": "Mapas", "onglet.calques": "Capas", "onglet.traces": "Rutas",
    "relief.chargement": "Cargando el relieve…", "relief.echec": "No se ha podido cargar el relieve.",
    "relief.sansCle": "La clave cartográfica no está configurada en este servidor: la vista de relieve no está disponible.",
    "relief.cadrer": "Encuadrar la ruta", "relief.couches": "Mapas y capas", "relief.fermer": "Cerrar",
    "relief.titre": "Vista de relieve", "relief.sous": "El terreno en tres dimensiones, con senderos e inclinación de pendientes.",
    "relief.ouvrir": "Ver en 3D",
  },
  pt: { ...COMMUN,
    "calque.pentesFr": "Inclinação das encostas",
    "trace.rando": "Percursos pedestres", "trace.vtt": "BTT", "trace.ski": "Esqui de montanha", "trace.randoCh": "Trilhos",
    "trace.licence": "Percursos sob a licença Open Data Commons Open Database License (ODbL), a partir do OpenStreetMap.",
    "zone.monde": "Mundo", "zone.fr": "França", "zone.ch": "Suíça", "zone.us": "Estados Unidos", "zone.es": "Espanha", "zone.de": "Alemanha",
    "onglet.cartes": "Mapas", "onglet.calques": "Camadas", "onglet.traces": "Percursos",
    "relief.chargement": "A carregar o relevo…", "relief.echec": "Não foi possível carregar o relevo.",
    "relief.sansCle": "A chave cartográfica não está configurada neste servidor: a vista de relevo está indisponível.",
    "relief.cadrer": "Enquadrar o percurso", "relief.couches": "Mapas e camadas", "relief.fermer": "Fechar",
    "relief.titre": "Vista de relevo", "relief.sous": "O terreno em três dimensões, com trilhos e inclinação das encostas.",
    "relief.ouvrir": "Ver em 3D",
  },
};

export function texteRelief(lang: string): Record<string, string> {
  return R[(lang as LangRelief)] ?? R.fr;
}
