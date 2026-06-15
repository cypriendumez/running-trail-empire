// ─────────────────────────────────────────────────────────────────────────────
//  Catalogue de parcours emblématiques de France
//  Course (jogging) · Trail · Vélo · Marche
//  Sélection éditoriale "Trail Empire" — la communauté peut en ajouter d'autres.
// ─────────────────────────────────────────────────────────────────────────────

export type RouteSport = "course" | "trail" | "velo" | "marche";
export type RouteDifficulty = "green" | "blue" | "red" | "black";

export interface CatalogRoute {
  id: string;
  name: string;
  sport: RouteSport;
  city: string;
  region: string;
  lat: number;
  lng: number;
  distance_km: number;
  elevation_m: number; // dénivelé positif (D+)
  difficulty: RouteDifficulty;
  description: string;
  source: string; // origine / auteur
  loop?: boolean; // boucle (départ = arrivée)
}

// ─── Métadonnées par sport ────────────────────────────────────────────────────
export const SPORT_META: Record<
  RouteSport,
  { label: string; emoji: string; flat: number; climb: number; accent: string; gradient: string; chip: string }
> = {
  course: { label: "Course",  emoji: "🏃", flat: 11,  climb: 6,  accent: "#f97316", gradient: "from-orange-500 to-amber-500",  chip: "bg-orange-100 text-orange-700" },
  trail:  { label: "Trail",   emoji: "🥾", flat: 8.5, climb: 9,  accent: "#16a34a", gradient: "from-emerald-500 to-green-600", chip: "bg-emerald-100 text-emerald-700" },
  velo:   { label: "Vélo",    emoji: "🚴", flat: 19,  climb: 3,  accent: "#0ea5e9", gradient: "from-sky-500 to-blue-600",     chip: "bg-sky-100 text-sky-700" },
  marche: { label: "Marche",  emoji: "🚶", flat: 4.8, climb: 10, accent: "#14b8a6", gradient: "from-teal-500 to-emerald-500", chip: "bg-teal-100 text-teal-700" },
};

export const DIFFICULTY_META: Record<RouteDifficulty, { label: string; color: string }> = {
  green: { label: "Facile",    color: "#22c55e" },
  blue:  { label: "Modérée",   color: "#3b82f6" },
  red:   { label: "Difficile", color: "#ef4444" },
  black: { label: "Expert",    color: "#18181b" },
};

// ─── Estimations (durée / vitesse) ─────────────────────────────────────────────
export function estimateDurationMin(r: { sport: RouteSport; distance_km: number; elevation_m: number }): number {
  const m = SPORT_META[r.sport];
  return (r.distance_km / m.flat) * 60 + (r.elevation_m / 100) * m.climb;
}
export function estimateSpeedKmh(r: { sport: RouteSport; distance_km: number; elevation_m: number }): number {
  const d = estimateDurationMin(r);
  return d > 0 ? r.distance_km / (d / 60) : SPORT_META[r.sport].flat;
}
export function formatDurationShort(min: number): string {
  if (!isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

// ─── Vignette carte (1 tuile raster MapTiler centrée sur le parcours) ──────────
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";
export function thumbZoomFor(distanceKm: number): number {
  if (distanceKm > 250) return 8;
  if (distanceKm > 80) return 9;
  if (distanceKm > 25) return 11;
  if (distanceKm > 8) return 12;
  return 13;
}
export function tileUrl(lat: number, lng: number, z: number): string {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const yf = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const y = Math.floor(yf);
  const xc = Math.max(0, Math.min(n - 1, x));
  const yc = Math.max(0, Math.min(n - 1, y));
  return MAPTILER_KEY
    ? `https://api.maptiler.com/maps/outdoor-v2/${z}/${xc}/${yc}@2x.png?key=${MAPTILER_KEY}`
    : `https://tile.openstreetmap.org/${z}/${xc}/${yc}.png`;
}

// ─── Le catalogue ───────────────────────────────────────────────────────────────
export const CATALOG: CatalogRoute[] = [
  // ══════════════════ TRAIL · grands itinéraires & sommets ══════════════════
  { id: "tr-tmb", name: "Tour du Mont-Blanc", sport: "trail", city: "Chamonix", region: "Auvergne-Rhône-Alpes", lat: 45.923, lng: 6.869, distance_km: 170, elevation_m: 10000, difficulty: "black", description: "Le tour mythique du massif du Mont-Blanc, entre France, Italie et Suisse.", source: "GR® TMB" },
  { id: "tr-gr20", name: "GR20 Corse", sport: "trail", city: "Calenzana", region: "Corse", lat: 42.300, lng: 9.050, distance_km: 180, elevation_m: 12000, difficulty: "black", description: "Le sentier le plus exigeant d'Europe, de Calenzana à Conca.", source: "GR® FFRandonnée" },
  { id: "tr-gr10", name: "GR10 Traversée des Pyrénées", sport: "trail", city: "Hendaye", region: "Nouvelle-Aquitaine", lat: 42.800, lng: 0.700, distance_km: 920, elevation_m: 48000, difficulty: "black", description: "D'Hendaye à Banyuls, l'Atlantique à la Méditerranée par les crêtes.", source: "GR® FFRandonnée" },
  { id: "tr-gr5", name: "GR5 Grande Traversée des Alpes", sport: "trail", city: "Thonon-les-Bains", region: "Auvergne-Rhône-Alpes", lat: 46.371, lng: 6.479, distance_km: 650, elevation_m: 33000, difficulty: "black", description: "Du Léman à Nice par les plus beaux alpages alpins.", source: "GR® FFRandonnée" },
  { id: "tr-gr54", name: "GR54 Tour de l'Oisans et des Écrins", sport: "trail", city: "Bourg-d'Oisans", region: "Auvergne-Rhône-Alpes", lat: 44.940, lng: 6.040, distance_km: 176, elevation_m: 12800, difficulty: "black", description: "L'un des tours les plus difficiles, au cœur du Parc des Écrins.", source: "GR® FFRandonnée" },
  { id: "tr-gr70", name: "GR70 Chemin de Stevenson", sport: "trail", city: "Le Puy-en-Velay", region: "Auvergne-Rhône-Alpes", lat: 44.713, lng: 3.886, distance_km: 252, elevation_m: 7000, difficulty: "red", description: "Sur les traces de R.L. Stevenson, du Velay aux Cévennes.", source: "GR® FFRandonnée" },
  { id: "tr-gr34", name: "GR34 Sentier des Douaniers", sport: "trail", city: "Côte de Bretagne", region: "Bretagne", lat: 48.600, lng: -3.900, distance_km: 2000, elevation_m: 30000, difficulty: "red", description: "Le sentier littoral le plus célèbre de France, tout autour de la Bretagne.", source: "GR® FFRandonnée" },
  { id: "tr-gr4-verdon", name: "Gorges du Verdon (GR4)", sport: "trail", city: "La Palud-sur-Verdon", region: "Provence-Alpes-Côte d'Azur", lat: 43.750, lng: 6.330, distance_km: 23, elevation_m: 1100, difficulty: "red", description: "Le sentier Blanc-Martel au fond du plus grand canyon d'Europe.", source: "GR® FFRandonnée" },
  { id: "tr-calanques", name: "Traversée des Calanques", sport: "trail", city: "Marseille", region: "Provence-Alpes-Côte d'Azur", lat: 43.215, lng: 5.460, distance_km: 28, elevation_m: 1400, difficulty: "red", description: "De Marseille à Cassis par les calanques de Sormiou, Morgiou et En-Vau.", source: "Classique" },
  { id: "tr-sainte-victoire", name: "Montagne Sainte-Victoire", sport: "trail", city: "Aix-en-Provence", region: "Provence-Alpes-Côte d'Azur", lat: 43.531, lng: 5.575, distance_km: 18, elevation_m: 1100, difficulty: "red", description: "La montagne de Cézanne et la Croix de Provence (946 m).", source: "Classique" },
  { id: "tr-ventoux", name: "Trail du Mont Ventoux", sport: "trail", city: "Bédoin", region: "Provence-Alpes-Côte d'Azur", lat: 44.174, lng: 5.278, distance_km: 25, elevation_m: 1600, difficulty: "black", description: "L'ascension du Géant de Provence par les Cèdres et le sommet à 1909 m.", source: "Classique" },
  { id: "tr-canigou", name: "Pic du Canigou", sport: "trail", city: "Vernet-les-Bains", region: "Occitanie", lat: 42.519, lng: 2.456, distance_km: 21, elevation_m: 1600, difficulty: "black", description: "La montagne sacrée des Catalans, panorama jusqu'à la Méditerranée.", source: "Classique" },
  { id: "tr-gavarnie", name: "Cirque de Gavarnie", sport: "trail", city: "Gavarnie", region: "Occitanie", lat: 42.700, lng: -0.009, distance_km: 16, elevation_m: 900, difficulty: "red", description: "Vers la plus haute cascade de France, UNESCO, au pied des 3000.", source: "Classique" },
  { id: "tr-puy-sancy", name: "Puy de Sancy", sport: "trail", city: "Le Mont-Dore", region: "Auvergne-Rhône-Alpes", lat: 45.528, lng: 2.814, distance_km: 14, elevation_m: 900, difficulty: "red", description: "Le toit du Massif central (1885 m) et les crêtes du Sancy.", source: "Classique" },
  { id: "tr-puy-dome", name: "Puy de Dôme & Chaîne des Puys", sport: "trail", city: "Clermont-Ferrand", region: "Auvergne-Rhône-Alpes", lat: 45.772, lng: 2.964, distance_km: 12, elevation_m: 650, difficulty: "blue", description: "Le volcan emblématique d'Auvergne, classé UNESCO.", source: "Classique" },
  { id: "tr-mont-aiguille", name: "Mont Aiguille", sport: "trail", city: "Chichilianne", region: "Auvergne-Rhône-Alpes", lat: 44.838, lng: 5.553, distance_km: 13, elevation_m: 800, difficulty: "red", description: "Le tour de la montagne inaccessible, berceau de l'alpinisme.", source: "Classique" },
  { id: "tr-grand-veymont", name: "Grand Veymont (Vercors)", sport: "trail", city: "Gresse-en-Vercors", region: "Auvergne-Rhône-Alpes", lat: 44.846, lng: 5.553, distance_km: 17, elevation_m: 1100, difficulty: "red", description: "Le point culminant du Vercors (2341 m) et les Hauts-Plateaux.", source: "Classique" },
  { id: "tr-dent-crolles", name: "Dent de Crolles (Chartreuse)", sport: "trail", city: "Saint-Pierre-de-Chartreuse", region: "Auvergne-Rhône-Alpes", lat: 45.301, lng: 5.857, distance_km: 14, elevation_m: 1000, difficulty: "red", description: "Sommet emblématique de la Chartreuse au-dessus de Grenoble.", source: "Classique" },
  { id: "tr-chamrousse", name: "Croix de Chamrousse", sport: "trail", city: "Chamrousse", region: "Auvergne-Rhône-Alpes", lat: 45.118, lng: 5.875, distance_km: 12, elevation_m: 900, difficulty: "red", description: "Balcon sur Grenoble et les massifs, depuis Recoin.", source: "Classique" },
  { id: "tr-lac-blanc", name: "Lac Blanc (Aiguilles Rouges)", sport: "trail", city: "Chamonix", region: "Auvergne-Rhône-Alpes", lat: 45.984, lng: 6.918, distance_km: 14, elevation_m: 1100, difficulty: "red", description: "Face au Mont-Blanc, le lac le plus photographié des Alpes.", source: "Classique" },
  { id: "tr-mont-joly", name: "Mont Joly", sport: "trail", city: "Saint-Gervais-les-Bains", region: "Auvergne-Rhône-Alpes", lat: 45.808, lng: 6.706, distance_km: 16, elevation_m: 1300, difficulty: "black", description: "Belvédère à 360° sur le massif du Mont-Blanc (2525 m).", source: "Classique" },
  { id: "tr-semnoz", name: "Le Semnoz", sport: "trail", city: "Annecy", region: "Auvergne-Rhône-Alpes", lat: 45.835, lng: 6.105, distance_km: 14, elevation_m: 950, difficulty: "red", description: "La montagne d'Annecy, balcon sur le lac et les Aravis.", source: "Classique" },
  { id: "tr-tournette", name: "La Tournette", sport: "trail", city: "Talloires", region: "Auvergne-Rhône-Alpes", lat: 45.815, lng: 6.245, distance_km: 14, elevation_m: 1500, difficulty: "black", description: "Le plus haut sommet dominant le lac d'Annecy (2351 m).", source: "Classique" },
  { id: "tr-saleve", name: "Le Salève", sport: "trail", city: "Annemasse", region: "Auvergne-Rhône-Alpes", lat: 46.135, lng: 6.180, distance_km: 12, elevation_m: 900, difficulty: "blue", description: "Le balcon de Genève, panorama Léman et Mont-Blanc.", source: "Classique" },
  { id: "tr-hohneck", name: "Crêtes des Vosges – Le Hohneck", sport: "trail", city: "La Bresse", region: "Grand Est", lat: 48.027, lng: 7.001, distance_km: 18, elevation_m: 800, difficulty: "blue", description: "La route des crêtes vosgiennes, lacs glaciaires et chaumes.", source: "Classique" },
  { id: "tr-grand-ballon", name: "Grand Ballon", sport: "trail", city: "Guebwiller", region: "Grand Est", lat: 47.901, lng: 7.097, distance_km: 16, elevation_m: 950, difficulty: "blue", description: "Le point culminant des Vosges (1424 m).", source: "Classique" },
  { id: "tr-ballon-alsace", name: "Ballon d'Alsace", sport: "trail", city: "Saint-Maurice-sur-Moselle", region: "Bourgogne-Franche-Comté", lat: 47.821, lng: 6.838, distance_km: 14, elevation_m: 700, difficulty: "blue", description: "Sommet partagé entre trois régions, hauts chaumes.", source: "Classique" },
  { id: "tr-crets-neige", name: "Crêt de la Neige (Jura)", sport: "trail", city: "Lélex", region: "Auvergne-Rhône-Alpes", lat: 46.310, lng: 5.945, distance_km: 18, elevation_m: 1100, difficulty: "red", description: "Le point culminant du Jura (1720 m) et le balcon sur le Léman.", source: "Classique" },
  { id: "tr-mont-dor", name: "Mont d'Or", sport: "trail", city: "Métabief", region: "Bourgogne-Franche-Comté", lat: 46.766, lng: 6.354, distance_km: 13, elevation_m: 600, difficulty: "blue", description: "Falaises et belvédère sur le Léman et les Alpes.", source: "Classique" },
  { id: "tr-herisson", name: "Cascades du Hérisson", sport: "trail", city: "Ménétrux-en-Joux", region: "Bourgogne-Franche-Comté", lat: 46.604, lng: 5.866, distance_km: 8, elevation_m: 350, difficulty: "blue", description: "La plus belle succession de cascades du Jura.", source: "Classique" },
  { id: "tr-mezenc", name: "Mont Mézenc", sport: "trail", city: "Les Estables", region: "Auvergne-Rhône-Alpes", lat: 44.917, lng: 4.197, distance_km: 11, elevation_m: 550, difficulty: "blue", description: "Le toit de l'Ardèche et de la Haute-Loire (1753 m).", source: "Classique" },
  { id: "tr-aigoual", name: "Mont Aigoual (Cévennes)", sport: "trail", city: "Valleraugue", region: "Occitanie", lat: 44.121, lng: 3.581, distance_km: 22, elevation_m: 1500, difficulty: "black", description: "Le 4000 marches, mythique montée cévenole jusqu'à l'observatoire.", source: "Classique" },
  { id: "tr-pic-st-loup", name: "Pic Saint-Loup", sport: "trail", city: "Saint-Mathieu-de-Tréviers", region: "Occitanie", lat: 43.783, lng: 3.808, distance_km: 12, elevation_m: 650, difficulty: "blue", description: "La sentinelle de Montpellier, panorama sur le Languedoc.", source: "Classique" },
  { id: "tr-navacelles", name: "Cirque de Navacelles", sport: "trail", city: "Saint-Maurice-Navacelles", region: "Occitanie", lat: 43.890, lng: 3.500, distance_km: 14, elevation_m: 700, difficulty: "red", description: "Le plus grand cirque d'Europe, Grand Site de France.", source: "Classique" },
  { id: "tr-esterel", name: "Massif de l'Esterel", sport: "trail", city: "Saint-Raphaël", region: "Provence-Alpes-Côte d'Azur", lat: 43.480, lng: 6.870, distance_km: 20, elevation_m: 900, difficulty: "red", description: "Roches rouges face à la Méditerranée, Pic de l'Ours.", source: "Classique" },
  { id: "tr-bavella", name: "Aiguilles de Bavella", sport: "trail", city: "Zonza", region: "Corse", lat: 41.797, lng: 9.225, distance_km: 11, elevation_m: 700, difficulty: "red", description: "Le trou de la Bombe et les célèbres aiguilles corses.", source: "Classique" },
  { id: "tr-cap-corse", name: "Sentier du Cap Corse", sport: "trail", city: "Macinaggio", region: "Corse", lat: 42.962, lng: 9.456, distance_km: 22, elevation_m: 600, difficulty: "blue", description: "Le sentier des douaniers entre criques sauvages et tours génoises.", source: "Classique" },
  { id: "tr-roc-chere", name: "Roc de Chère", sport: "trail", city: "Talloires", region: "Auvergne-Rhône-Alpes", lat: 45.847, lng: 6.210, distance_km: 7, elevation_m: 250, difficulty: "green", description: "Réserve naturelle et belvédère sur le lac d'Annecy.", source: "Classique" },
  { id: "tr-mont-granier", name: "Mont Granier", sport: "trail", city: "Chapareillan", region: "Auvergne-Rhône-Alpes", lat: 45.451, lng: 5.927, distance_km: 15, elevation_m: 1100, difficulty: "red", description: "Les grandes falaises de la Chartreuse au-dessus de Grenoble.", source: "Classique" },

  // ══════════════════ TRAIL · courses & ultras emblématiques ══════════════════
  { id: "tr-utmb", name: "UTMB® – Ultra-Trail du Mont-Blanc", sport: "trail", city: "Chamonix", region: "Auvergne-Rhône-Alpes", lat: 45.923, lng: 6.870, distance_km: 171, elevation_m: 10000, difficulty: "black", description: "La course de trail la plus célèbre du monde, au départ de Chamonix.", source: "Course mythique" },
  { id: "tr-ccc", name: "CCC® (Courmayeur-Champex-Chamonix)", sport: "trail", city: "Chamonix", region: "Auvergne-Rhône-Alpes", lat: 45.792, lng: 6.969, distance_km: 101, elevation_m: 6100, difficulty: "black", description: "Le format 100 km de la semaine de l'UTMB.", source: "Course mythique" },
  { id: "tr-saintelyon", name: "SaintéLyon", sport: "trail", city: "Saint-Étienne", region: "Auvergne-Rhône-Alpes", lat: 45.439, lng: 4.387, distance_km: 78, elevation_m: 2000, difficulty: "red", description: "La grande nocturne hivernale de Saint-Étienne à Lyon.", source: "Course mythique" },
  { id: "tr-templiers", name: "Festival des Templiers", sport: "trail", city: "Millau", region: "Occitanie", lat: 44.099, lng: 3.078, distance_km: 76, elevation_m: 3200, difficulty: "black", description: "Le rendez-vous mythique du trail français sur les Causses.", source: "Course mythique" },
  { id: "tr-maxirace", name: "MaxiRace Annecy", sport: "trail", city: "Annecy", region: "Auvergne-Rhône-Alpes", lat: 45.900, lng: 6.130, distance_km: 90, elevation_m: 5700, difficulty: "black", description: "Le tour du lac d'Annecy par les sommets.", source: "Course mythique" },
  { id: "tr-grp", name: "Grand Raid des Pyrénées", sport: "trail", city: "Vielle-Aure", region: "Occitanie", lat: 42.788, lng: 0.318, distance_km: 120, elevation_m: 7500, difficulty: "black", description: "L'ultra des Hautes-Pyrénées au départ de Saint-Lary.", source: "Course mythique" },
  { id: "tr-6000d", name: "6000 D – La Plagne", sport: "trail", city: "La Plagne", region: "Auvergne-Rhône-Alpes", lat: 45.507, lng: 6.677, distance_km: 65, elevation_m: 3900, difficulty: "black", description: "Le mythique trail vers le glacier de Bellecôte.", source: "Course mythique" },
  { id: "tr-ecotrail", name: "EcoTrail de Paris", sport: "trail", city: "Paris", region: "Île-de-France", lat: 48.842, lng: 2.221, distance_km: 80, elevation_m: 1500, difficulty: "red", description: "Un trail urbain et forestier jusqu'à la Tour Eiffel.", source: "Course mythique" },

  // ══════════════════ COURSE / JOGGING · grandes villes ══════════════════
  { id: "ru-paris-boulogne", name: "Bois de Boulogne – Grande boucle", sport: "course", city: "Paris", region: "Île-de-France", lat: 48.862, lng: 2.250, distance_km: 14, elevation_m: 60, difficulty: "green", description: "Le poumon vert de l'Ouest parisien, lac Inférieur et allées ombragées.", source: "Classique", loop: true },
  { id: "ru-paris-vincennes", name: "Bois de Vincennes – Tour du lac Daumesnil", sport: "course", city: "Paris", region: "Île-de-France", lat: 48.834, lng: 2.432, distance_km: 10, elevation_m: 40, difficulty: "green", description: "Boucle plate et roulante autour du lac Daumesnil.", source: "Classique", loop: true },
  { id: "ru-paris-seine", name: "Berges de Seine – Bastille à Tour Eiffel", sport: "course", city: "Paris", region: "Île-de-France", lat: 48.851, lng: 2.350, distance_km: 8, elevation_m: 20, difficulty: "green", description: "Le long de la Seine entre ponts et monuments, voie sur berges.", source: "Classique" },
  { id: "ru-paris-canal", name: "Canal Saint-Martin & Bassin de la Villette", sport: "course", city: "Paris", region: "Île-de-France", lat: 48.875, lng: 2.366, distance_km: 9, elevation_m: 15, difficulty: "green", description: "Du canal Saint-Martin au parc de la Villette, plat et urbain.", source: "Classique" },
  { id: "ru-paris-buttes", name: "Parc des Buttes-Chaumont", sport: "course", city: "Paris", region: "Île-de-France", lat: 48.880, lng: 2.382, distance_km: 5, elevation_m: 90, difficulty: "blue", description: "Le parc le plus vallonné de Paris, idéal pour le fractionné en côte.", source: "Classique", loop: true },
  { id: "ru-paris-champ-mars", name: "Champ-de-Mars & Trocadéro", sport: "course", city: "Paris", region: "Île-de-France", lat: 48.856, lng: 2.298, distance_km: 6, elevation_m: 25, difficulty: "green", description: "Boucle iconique au pied de la Tour Eiffel.", source: "Classique", loop: true },
  { id: "ru-lyon-tete-or", name: "Parc de la Tête d'Or", sport: "course", city: "Lyon", region: "Auvergne-Rhône-Alpes", lat: 45.778, lng: 4.852, distance_km: 8, elevation_m: 30, difficulty: "green", description: "Le grand parc lyonnais, tour du lac et roseraie.", source: "Classique", loop: true },
  { id: "ru-lyon-rhone", name: "Berges du Rhône", sport: "course", city: "Lyon", region: "Auvergne-Rhône-Alpes", lat: 45.755, lng: 4.842, distance_km: 10, elevation_m: 20, difficulty: "green", description: "Du parc de la Tête d'Or à la Confluence le long du Rhône.", source: "Classique" },
  { id: "ru-marseille-corniche", name: "Corniche Kennedy", sport: "course", city: "Marseille", region: "Provence-Alpes-Côte d'Azur", lat: 43.279, lng: 5.357, distance_km: 11, elevation_m: 120, difficulty: "blue", description: "Le front de mer marseillais face aux îles du Frioul.", source: "Classique" },
  { id: "ru-marseille-borely", name: "Parc Borély & Plages du Prado", sport: "course", city: "Marseille", region: "Provence-Alpes-Côte d'Azur", lat: 43.262, lng: 5.382, distance_km: 8, elevation_m: 25, difficulty: "green", description: "Parc, hippodrome et bord de mer du Prado.", source: "Classique", loop: true },
  { id: "ru-toulouse-canal", name: "Canal du Midi", sport: "course", city: "Toulouse", region: "Occitanie", lat: 43.611, lng: 1.453, distance_km: 12, elevation_m: 20, difficulty: "green", description: "Les berges ombragées du canal classé UNESCO.", source: "Classique" },
  { id: "ru-toulouse-garonne", name: "Prairie des Filtres & Garonne", sport: "course", city: "Toulouse", region: "Occitanie", lat: 43.595, lng: 1.434, distance_km: 7, elevation_m: 15, difficulty: "green", description: "Boucle le long de la Garonne au cœur de la ville rose.", source: "Classique", loop: true },
  { id: "ru-bordeaux-quais", name: "Quais de Garonne & Miroir d'eau", sport: "course", city: "Bordeaux", region: "Nouvelle-Aquitaine", lat: 44.841, lng: -0.569, distance_km: 10, elevation_m: 15, difficulty: "green", description: "Du pont de pierre au pont Chaban, le long des quais classés.", source: "Classique" },
  { id: "ru-bordeaux-parc", name: "Parc Bordelais", sport: "course", city: "Bordeaux", region: "Nouvelle-Aquitaine", lat: 44.855, lng: -0.602, distance_km: 5, elevation_m: 20, difficulty: "green", description: "Le grand jardin à l'anglaise des Bordelais.", source: "Classique", loop: true },
  { id: "ru-lille-citadelle", name: "Citadelle de Lille – Bois de Boulogne", sport: "course", city: "Lille", region: "Hauts-de-France", lat: 50.643, lng: 3.043, distance_km: 7, elevation_m: 25, difficulty: "green", description: "La boucle running n°1 des Lillois autour de la Citadelle Vauban.", source: "Classique", loop: true },
  { id: "ru-lille-deule", name: "Bords de Deûle", sport: "course", city: "Lille", region: "Hauts-de-France", lat: 50.650, lng: 3.040, distance_km: 10, elevation_m: 15, difficulty: "green", description: "Le long de la Deûle, de la Citadelle à la Lambersart.", source: "Classique" },
  { id: "ru-nantes-erdre", name: "Bords de l'Erdre", sport: "course", city: "Nantes", region: "Pays de la Loire", lat: 47.232, lng: -1.546, distance_km: 11, elevation_m: 20, difficulty: "green", description: "« La plus belle rivière de France » depuis l'île de Versailles.", source: "Classique" },
  { id: "ru-nantes-ile", name: "Île de Nantes & Machines", sport: "course", city: "Nantes", region: "Pays de la Loire", lat: 47.205, lng: -1.565, distance_km: 8, elevation_m: 10, difficulty: "green", description: "Boucle plate le long de la Loire, près de l'Éléphant.", source: "Classique", loop: true },
  { id: "ru-strasbourg-orangerie", name: "Parc de l'Orangerie", sport: "course", city: "Strasbourg", region: "Grand Est", lat: 48.589, lng: 7.776, distance_km: 6, elevation_m: 15, difficulty: "green", description: "Le plus ancien parc strasbourgeois, près des institutions européennes.", source: "Classique", loop: true },
  { id: "ru-nice-anglais", name: "Promenade des Anglais", sport: "course", city: "Nice", region: "Provence-Alpes-Côte d'Azur", lat: 43.695, lng: 7.265, distance_km: 9, elevation_m: 10, difficulty: "green", description: "Le mythique front de mer azuréen, plat et roulant.", source: "Classique" },
  { id: "ru-montpellier-peyrou", name: "Promenade du Peyrou & Lez", sport: "course", city: "Montpellier", region: "Occitanie", lat: 43.612, lng: 3.870, distance_km: 8, elevation_m: 30, difficulty: "green", description: "De l'arc de triomphe aux berges du Lez.", source: "Classique" },
  { id: "ru-rennes-thabor", name: "Parc du Thabor & Vilaine", sport: "course", city: "Rennes", region: "Bretagne", lat: 48.114, lng: -1.667, distance_km: 7, elevation_m: 25, difficulty: "green", description: "Le jardin remarquable de Rennes et les bords de Vilaine.", source: "Classique", loop: true },
  { id: "ru-grenoble-isere", name: "Berges de l'Isère & Bastille", sport: "course", city: "Grenoble", region: "Auvergne-Rhône-Alpes", lat: 45.197, lng: 5.726, distance_km: 9, elevation_m: 60, difficulty: "blue", description: "Le long de l'Isère au pied de la Bastille et des massifs.", source: "Classique" },
  { id: "ru-annecy-paquier", name: "Tour du Pâquier & bord du lac", sport: "course", city: "Annecy", region: "Auvergne-Rhône-Alpes", lat: 45.899, lng: 6.139, distance_km: 10, elevation_m: 15, difficulty: "green", description: "Le long du plus beau lac de France depuis le Pâquier.", source: "Classique" },
  { id: "ru-dijon-kir", name: "Lac Kir", sport: "course", city: "Dijon", region: "Bourgogne-Franche-Comté", lat: 47.323, lng: 5.000, distance_km: 7, elevation_m: 15, difficulty: "green", description: "Tour du lac Kir et coulée verte dijonnaise.", source: "Classique", loop: true },
  { id: "ru-nancy-pepiniere", name: "Parc de la Pépinière", sport: "course", city: "Nancy", region: "Grand Est", lat: 48.697, lng: 6.183, distance_km: 4, elevation_m: 10, difficulty: "green", description: "Le parc historique près de la place Stanislas.", source: "Classique", loop: true },
  { id: "ru-tours-loire", name: "Bords de Loire", sport: "course", city: "Tours", region: "Centre-Val de Loire", lat: 47.397, lng: 0.688, distance_km: 12, elevation_m: 20, difficulty: "green", description: "Le long du dernier fleuve sauvage, levées et guinguettes.", source: "Classique" },
  { id: "ru-biarritz-basque", name: "Côte des Basques", sport: "course", city: "Biarritz", region: "Nouvelle-Aquitaine", lat: 43.477, lng: -1.566, distance_km: 8, elevation_m: 110, difficulty: "blue", description: "Le front de mer surf entre Grande Plage et Côte des Basques.", source: "Classique" },
  { id: "ru-clermont-jardin", name: "Jardin Lecoq & coteaux", sport: "course", city: "Clermont-Ferrand", region: "Auvergne-Rhône-Alpes", lat: 45.774, lng: 3.090, distance_km: 6, elevation_m: 60, difficulty: "blue", description: "Du jardin Lecoq vers les coteaux, vue sur le Puy de Dôme.", source: "Classique" },
  { id: "ru-caen-orne", name: "Bords de l'Orne & Prairie", sport: "course", city: "Caen", region: "Normandie", lat: 49.176, lng: -0.370, distance_km: 9, elevation_m: 15, difficulty: "green", description: "Le canal de Caen à la mer et la grande prairie.", source: "Classique" },
  { id: "ru-rouen-seine", name: "Quais de Seine & Île Lacroix", sport: "course", city: "Rouen", region: "Normandie", lat: 49.435, lng: 1.097, distance_km: 8, elevation_m: 15, difficulty: "green", description: "Le long de la Seine au cœur de la ville aux cent clochers.", source: "Classique" },
  { id: "ru-aix-cezanne", name: "Aix – Tour du parc & coteaux", sport: "course", city: "Aix-en-Provence", region: "Provence-Alpes-Côte d'Azur", lat: 43.531, lng: 5.447, distance_km: 8, elevation_m: 90, difficulty: "blue", description: "Sur les pas de Cézanne, vue sur la Sainte-Victoire.", source: "Classique" },

  // ══════════════════ VÉLO · cols mythiques ══════════════════
  { id: "ve-ventoux", name: "Mont Ventoux par Bédoin", sport: "velo", city: "Bédoin", region: "Provence-Alpes-Côte d'Azur", lat: 44.124, lng: 5.179, distance_km: 21.5, elevation_m: 1610, difficulty: "black", description: "L'ascension légendaire du Géant de Provence, 21 km à 7,5 %.", source: "Col mythique" },
  { id: "ve-galibier", name: "Col du Galibier (Sud)", sport: "velo", city: "Valloire", region: "Auvergne-Rhône-Alpes", lat: 45.064, lng: 6.408, distance_km: 18, elevation_m: 1245, difficulty: "black", description: "Le géant des Alpes à 2642 m, par le Télégraphe et Valloire.", source: "Col mythique" },
  { id: "ve-tourmalet", name: "Col du Tourmalet (Sainte-Marie)", sport: "velo", city: "Sainte-Marie-de-Campan", region: "Occitanie", lat: 42.909, lng: 0.221, distance_km: 17.2, elevation_m: 1268, difficulty: "black", description: "Le col le plus emprunté par le Tour de France, 2115 m.", source: "Col mythique" },
  { id: "ve-alpe-huez", name: "Alpe d'Huez – 21 virages", sport: "velo", city: "Bourg-d'Oisans", region: "Auvergne-Rhône-Alpes", lat: 45.058, lng: 6.040, distance_km: 13.8, elevation_m: 1071, difficulty: "black", description: "Les 21 lacets mythiques, montée la plus célèbre du Tour.", source: "Col mythique" },
  { id: "ve-izoard", name: "Col d'Izoard (Casse Déserte)", sport: "velo", city: "Briançon", region: "Provence-Alpes-Côte d'Azur", lat: 44.820, lng: 6.735, distance_km: 19, elevation_m: 1100, difficulty: "black", description: "Le décor lunaire de la Casse Déserte à 2360 m.", source: "Col mythique" },
  { id: "ve-madeleine", name: "Col de la Madeleine", sport: "velo", city: "La Chambre", region: "Auvergne-Rhône-Alpes", lat: 45.434, lng: 6.395, distance_km: 19.2, elevation_m: 1520, difficulty: "black", description: "L'un des plus longs cols alpins, 2000 m.", source: "Col mythique" },
  { id: "ve-croix-fer", name: "Col de la Croix de Fer", sport: "velo", city: "Saint-Jean-de-Maurienne", region: "Auvergne-Rhône-Alpes", lat: 45.227, lng: 6.187, distance_km: 29, elevation_m: 1520, difficulty: "black", description: "Longue ascension vers 2067 m et le lac de Grand Maison.", source: "Col mythique" },
  { id: "ve-iseran", name: "Col de l'Iseran", sport: "velo", city: "Val-d'Isère", region: "Auvergne-Rhône-Alpes", lat: 45.417, lng: 7.031, distance_km: 16, elevation_m: 950, difficulty: "black", description: "Le plus haut col routier des Alpes (2770 m).", source: "Col mythique" },
  { id: "ve-bonette", name: "Cime de la Bonette", sport: "velo", city: "Jausiers", region: "Provence-Alpes-Côte d'Azur", lat: 44.321, lng: 6.806, distance_km: 24, elevation_m: 1590, difficulty: "black", description: "La plus haute route d'Europe (2802 m).", source: "Col mythique" },
  { id: "ve-aubisque", name: "Col d'Aubisque", sport: "velo", city: "Laruns", region: "Nouvelle-Aquitaine", lat: 42.977, lng: -0.337, distance_km: 16.6, elevation_m: 1190, difficulty: "black", description: "Les balcons du cirque du Litor dans les Pyrénées.", source: "Col mythique" },
  { id: "ve-peyresourde", name: "Col de Peyresourde", sport: "velo", city: "Bagnères-de-Luchon", region: "Occitanie", lat: 42.795, lng: 0.443, distance_km: 13.2, elevation_m: 940, difficulty: "red", description: "Classique pyrénéenne entre Luchon et la vallée du Louron.", source: "Col mythique" },
  { id: "ve-planche", name: "La Planche des Belles Filles", sport: "velo", city: "Plancher-les-Mines", region: "Bourgogne-Franche-Comté", lat: 47.774, lng: 6.785, distance_km: 5.9, elevation_m: 540, difficulty: "red", description: "La montée vosgienne devenue star du Tour de France.", source: "Col mythique" },
  { id: "ve-grand-colombier", name: "Grand Colombier", sport: "velo", city: "Culoz", region: "Auvergne-Rhône-Alpes", lat: 45.900, lng: 5.604, distance_km: 18.3, elevation_m: 1255, difficulty: "black", description: "Le balcon du Bugey au-dessus du Rhône (1501 m).", source: "Col mythique" },
  { id: "ve-joux-plane", name: "Col de Joux Plane", sport: "velo", city: "Morzine", region: "Auvergne-Rhône-Alpes", lat: 46.155, lng: 6.715, distance_km: 11.6, elevation_m: 990, difficulty: "black", description: "Pentes sévères face au Mont-Blanc depuis Morzine.", source: "Col mythique" },
  { id: "ve-puy-mary", name: "Pas de Peyrol – Puy Mary", sport: "velo", city: "Le Falgoux", region: "Auvergne-Rhône-Alpes", lat: 45.108, lng: 2.683, distance_km: 12, elevation_m: 870, difficulty: "red", description: "Le plus haut col routier du Massif central (1589 m).", source: "Col mythique" },
  { id: "ve-colombiere", name: "Col de la Colombière", sport: "velo", city: "Le Grand-Bornand", region: "Auvergne-Rhône-Alpes", lat: 45.974, lng: 6.464, distance_km: 11.7, elevation_m: 750, difficulty: "red", description: "Classique aravisienne entre Cluses et Le Grand-Bornand.", source: "Col mythique" },

  // ══════════════════ VÉLO · véloroutes & voies vertes ══════════════════
  { id: "ve-loire", name: "La Loire à Vélo", sport: "velo", city: "Orléans", region: "Centre-Val de Loire", lat: 47.902, lng: 1.909, distance_km: 900, elevation_m: 2000, difficulty: "green", description: "L'itinéraire des châteaux, de Nevers à l'Atlantique.", source: "Véloroute" },
  { id: "ve-viarhona", name: "ViaRhôna", sport: "velo", city: "Lyon", region: "Auvergne-Rhône-Alpes", lat: 45.740, lng: 4.840, distance_km: 815, elevation_m: 2500, difficulty: "blue", description: "Du lac Léman à la Méditerranée le long du Rhône.", source: "Véloroute" },
  { id: "ve-velodyssee", name: "La Vélodyssée", sport: "velo", city: "La Rochelle", region: "Nouvelle-Aquitaine", lat: 46.159, lng: -1.151, distance_km: 1300, elevation_m: 3500, difficulty: "blue", description: "La plus longue véloroute de France, façade atlantique.", source: "Véloroute" },
  { id: "ve-2mers", name: "Canal des 2 Mers à vélo", sport: "velo", city: "Toulouse", region: "Occitanie", lat: 43.605, lng: 1.444, distance_km: 750, elevation_m: 1500, difficulty: "green", description: "De l'Atlantique à la Méditerranée par le Canal du Midi.", source: "Véloroute" },
  { id: "ve-ile-re", name: "Île de Ré à vélo", sport: "velo", city: "Saint-Martin-de-Ré", region: "Nouvelle-Aquitaine", lat: 46.201, lng: -1.366, distance_km: 35, elevation_m: 60, difficulty: "green", description: "Boucle plate entre marais salants, vignes et plages.", source: "Véloroute", loop: true },
  { id: "ve-leman", name: "Tour du Léman à vélo", sport: "velo", city: "Évian-les-Bains", region: "Auvergne-Rhône-Alpes", lat: 46.401, lng: 6.589, distance_km: 180, elevation_m: 1200, difficulty: "blue", description: "Le tour du plus grand lac alpin, France et Suisse.", source: "Véloroute", loop: true },
  { id: "ve-bourgogne", name: "Voie Verte de Bourgogne (Cluny-Givry)", sport: "velo", city: "Cluny", region: "Bourgogne-Franche-Comté", lat: 46.434, lng: 4.659, distance_km: 44, elevation_m: 300, difficulty: "green", description: "L'une des premières voies vertes de France, vignobles du Mâconnais.", source: "Voie verte" },
  { id: "ve-francette", name: "La Vélo Francette", sport: "velo", city: "Ouistreham", region: "Normandie", lat: 49.278, lng: -0.255, distance_km: 630, elevation_m: 3000, difficulty: "blue", description: "De la Manche à l'Atlantique par la Normandie et l'Anjou.", source: "Véloroute" },

  // ══════════════════ MARCHE · promenades & sites emblématiques ══════════════════
  { id: "ma-mont-st-michel", name: "Baie du Mont-Saint-Michel", sport: "marche", city: "Le Mont-Saint-Michel", region: "Normandie", lat: 48.636, lng: -1.511, distance_km: 12, elevation_m: 20, difficulty: "blue", description: "La traversée de la baie classée UNESCO (avec guide).", source: "Grand Site" },
  { id: "ma-etretat", name: "Falaises d'Étretat", sport: "marche", city: "Étretat", region: "Normandie", lat: 49.707, lng: 0.204, distance_km: 9, elevation_m: 350, difficulty: "blue", description: "Les célèbres arches et l'Aiguille creuse par le GR21.", source: "Grand Site", loop: true },
  { id: "ma-pointe-raz", name: "Pointe du Raz", sport: "marche", city: "Plogoff", region: "Bretagne", lat: 48.038, lng: -4.732, distance_km: 7, elevation_m: 150, difficulty: "green", description: "L'extrémité sauvage du Finistère, Grand Site de France.", source: "Grand Site", loop: true },
  { id: "ma-cap-frehel", name: "Cap Fréhel & Fort la Latte", sport: "marche", city: "Plévenon", region: "Bretagne", lat: 48.685, lng: -2.319, distance_km: 13, elevation_m: 250, difficulty: "blue", description: "Landes, phare et château fort face à la Manche.", source: "Grand Site" },
  { id: "ma-dune-pilat", name: "Dune du Pilat", sport: "marche", city: "La Teste-de-Buch", region: "Nouvelle-Aquitaine", lat: 44.589, lng: -1.214, distance_km: 6, elevation_m: 120, difficulty: "green", description: "La plus haute dune d'Europe face au banc d'Arguin.", source: "Grand Site" },
  { id: "ma-gorges-tarn", name: "Gorges du Tarn – Belvédères", sport: "marche", city: "Sainte-Énimie", region: "Occitanie", lat: 44.365, lng: 3.412, distance_km: 11, elevation_m: 600, difficulty: "blue", description: "Les belvédères au-dessus du canyon du Tarn.", source: "Grand Site" },
  { id: "ma-pont-gard", name: "Pont du Gard & garrigue", sport: "marche", city: "Vers-Pont-du-Gard", region: "Occitanie", lat: 43.947, lng: 4.535, distance_km: 6, elevation_m: 90, difficulty: "green", description: "Autour de l'aqueduc romain le mieux conservé au monde.", source: "Grand Site", loop: true },
  { id: "ma-roussillon", name: "Sentier des Ocres de Roussillon", sport: "marche", city: "Roussillon", region: "Provence-Alpes-Côte d'Azur", lat: 43.902, lng: 5.293, distance_km: 4, elevation_m: 60, difficulty: "green", description: "Les falaises ocre flamboyantes du Luberon.", source: "Grand Site", loop: true },
  { id: "ma-ste-croix", name: "Lac de Sainte-Croix & Basses Gorges", sport: "marche", city: "Sainte-Croix-du-Verdon", region: "Provence-Alpes-Côte d'Azur", lat: 43.762, lng: 6.150, distance_km: 9, elevation_m: 300, difficulty: "green", description: "Eaux turquoise au pied du Verdon.", source: "Classique" },
  { id: "ma-annecy-prom", name: "Promenade du lac d'Annecy", sport: "marche", city: "Annecy", region: "Auvergne-Rhône-Alpes", lat: 45.876, lng: 6.165, distance_km: 14, elevation_m: 60, difficulty: "green", description: "La voie verte au bord du lac jusqu'à Doussard.", source: "Classique" },
  { id: "ma-fontainebleau", name: "Forêt de Fontainebleau – Rochers", sport: "marche", city: "Fontainebleau", region: "Île-de-France", lat: 48.404, lng: 2.671, distance_km: 10, elevation_m: 250, difficulty: "blue", description: "Chaos de grès et sentiers Denecourt, paradis des marcheurs.", source: "Classique", loop: true },
  { id: "ma-broceliande", name: "Forêt de Brocéliande (Paimpont)", sport: "marche", city: "Paimpont", region: "Bretagne", lat: 48.018, lng: -2.172, distance_km: 12, elevation_m: 200, difficulty: "green", description: "La forêt légendaire du roi Arthur, Val sans Retour.", source: "Classique" },
  { id: "ma-baie-somme", name: "Baie de Somme – Le Crotoy", sport: "marche", city: "Le Crotoy", region: "Hauts-de-France", lat: 50.218, lng: 1.626, distance_km: 14, elevation_m: 20, difficulty: "green", description: "L'une des plus belles baies du monde, phoques et oiseaux.", source: "Grand Site" },
  { id: "ma-crozon", name: "Presqu'île de Crozon – Cap de la Chèvre", sport: "marche", city: "Crozon", region: "Bretagne", lat: 48.171, lng: -4.535, distance_km: 13, elevation_m: 300, difficulty: "blue", description: "Falaises et plages sauvages du Finistère par le GR34.", source: "Grand Site" },
  { id: "ma-cap-antibes", name: "Sentier du Cap d'Antibes", sport: "marche", city: "Antibes", region: "Provence-Alpes-Côte d'Azur", lat: 43.552, lng: 7.130, distance_km: 5, elevation_m: 80, difficulty: "green", description: "Le sentier des douaniers du Cap, criques et villas.", source: "Classique" },
  { id: "ma-versailles", name: "Jardins du Château de Versailles", sport: "marche", city: "Versailles", region: "Île-de-France", lat: 48.805, lng: 2.121, distance_km: 8, elevation_m: 40, difficulty: "green", description: "Les jardins de Le Nôtre, Grand Canal et bosquets.", source: "Classique", loop: true },
  { id: "ma-st-cloud", name: "Parc de Saint-Cloud", sport: "marche", city: "Saint-Cloud", region: "Île-de-France", lat: 48.840, lng: 2.215, distance_km: 9, elevation_m: 120, difficulty: "blue", description: "Domaine national avec vue sur Paris et la grande cascade.", source: "Classique", loop: true },
  { id: "ma-ardeche", name: "Gorges de l'Ardèche – Belvédères", sport: "marche", city: "Vallon-Pont-d'Arc", region: "Auvergne-Rhône-Alpes", lat: 44.378, lng: 4.412, distance_km: 11, elevation_m: 400, difficulty: "blue", description: "Du Pont d'Arc aux belvédères surplombant la réserve.", source: "Grand Site" },
  { id: "ma-marais-poitevin", name: "Marais Poitevin – Venise Verte", sport: "marche", city: "Coulon", region: "Nouvelle-Aquitaine", lat: 46.323, lng: -0.586, distance_km: 10, elevation_m: 10, difficulty: "green", description: "Le long des conches dans la Venise verte.", source: "Grand Site" },
  { id: "ma-gavarnie-easy", name: "Cirque de Gavarnie (aller-retour)", sport: "marche", city: "Gavarnie", region: "Occitanie", lat: 42.735, lng: -0.012, distance_km: 9, elevation_m: 350, difficulty: "green", description: "Promenade familiale au pied de la grande cascade.", source: "Grand Site" },
];

// Index utile pour la recherche / filtrage
export function searchCatalog(routes: CatalogRoute[], query: string): CatalogRoute[] {
  const q = query.trim().toLowerCase();
  if (!q) return routes;
  return routes.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.city.toLowerCase().includes(q) ||
    r.region.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q)
  );
}
