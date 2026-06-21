export const dynamic = "force-dynamic";
import { TrailBuilderLazy } from "@/components/trail/TrailBuilderLazy";
import { ParcoursBrowser } from "@/components/parcours/ParcoursBrowser";

export const metadata = { title: "Trail Builder" };

export default async function TrailPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="space-y-6">
      <TrailBuilderLazy />
      <ParcoursBrowser initialSearch={q ?? ""} />
    </div>
  );
}
