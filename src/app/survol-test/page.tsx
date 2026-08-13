// PAGE DE DIAGNOSTIC TEMPORAIRE — à supprimer après correction du survol 3D.
// Publique à dessein : les pages du tableau de bord sont protégées, donc impossibles
// à inspecter sans session. Aucune donnée personnelle ici, la trace est en dur.
export const dynamic = "force-dynamic";
import { FlyoverLazy } from "@/components/segments/FlyoverLazy";

// Petite boucle réelle autour de la Citadelle de Lille, encodée en polyline.
const TRACE = "ynhhHmshBkBqAyAaA_@YoAy@sAaAeAy@u@k@o@e@";

export default function SurvolTest() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold">Diagnostic survol 3D</h1>
      <FlyoverLazy polyline={TRACE} altitudes={null}
        stats={{ title: "Test", distanceKm: 1.2, paceLabel: "4'30\"" }} />
    </div>
  );
}
