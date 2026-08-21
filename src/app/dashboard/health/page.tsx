export const dynamic = "force-dynamic";
import { HealthCenter } from "@/components/health/HealthCenter";

export const metadata = { title: "Santé & Guardian" };

export default function HealthPage() {
  return (
    <>
      <HealthCenter />
    </>
  );
}
