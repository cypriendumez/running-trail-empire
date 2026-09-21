import { Globe, Footprints, Mountain, TreePine, Bike } from "lucide-react";

/**
 * L'ICÔNE D'UN SPORT — un trait, pas un emoji.
 *
 * Les filtres de parcours et le sélecteur d'activité de la carte affichaient des emoji
 * (🏃 🥾 🚶 🚴 🚵). Cyprien, 21/09/2026 : « enlève les petits personnages, ça fait trop
 * IA ». Le reste de l'app dessine ses icônes en trait (lucide) ; celles-ci aussi,
 * désormais. Une seule table pour les deux écrans, sinon ils divergent.
 */
const ICONES = {
  all: Globe,
  // Clés du catalogue de parcours (SportHdf)…
  "Running": Footprints, "Trail": Mountain, "Randonnée": TreePine, "Vélo (Route)": Bike, "VTT": Bike,
  // …et celles du sélecteur d'activité de la carte.
  course: Footprints, trail: Mountain, marche: TreePine, velo: Bike,
} as const;

export type CleSport = keyof typeof ICONES;

export function IconeSport({ sport, className = "h-4 w-4" }: { sport: string; className?: string }) {
  const Icone = (ICONES as Record<string, typeof Globe>)[sport] ?? Footprints;
  return <Icone className={className} aria-hidden />;
}
