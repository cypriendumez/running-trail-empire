export const dynamic = "force-dynamic";
import { TrailBuilder } from "@/components/trail/TrailBuilder";
import { ParcoursBrowser } from "@/components/parcours/ParcoursBrowser";

export const metadata = { title: "Trail Builder" };

export default async function TrailPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="space-y-6">
      <TrailBuilder />
      <ParcoursBrowser initialSearch={q ?? ""} />
    </div>
  );
}
