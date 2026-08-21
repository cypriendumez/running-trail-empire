export const dynamic = "force-dynamic";
import { HealthCenter } from "@/components/health/HealthCenter";
import { AttributionGarmin } from "@/components/legal/AttributionGarmin";

export const metadata = { title: "Santé & Guardian" };

export default function HealthPage() {
  return (
    <>
      <HealthCenter />
      {/* La page Santé affiche VFC et sommeil, souvent d'origine Garmin. Article 1.1 des
          conditions d'API d'intervals.icu : l'attribution y est due aussi. */}
      <AttributionGarmin className="mt-6 pb-6" />
    </>
  );
}
