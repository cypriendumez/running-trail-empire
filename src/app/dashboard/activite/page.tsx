import Link from "next/link";
import { SessionDetail } from "@/components/admin/SessionDetail";
import { cleanActivityName } from "@/lib/utils/activityName";

export const dynamic = "force-dynamic";

// Page détail d'une séance (côté CLIENT) — toutes les données : métriques, zones FC, courbes, tours.
export default async function ActivitePage({ searchParams }: { searchParams: Promise<{ date?: string; dist?: string; title?: string }> }) {
  const sp = await searchParams;
  const date = (sp.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-zinc-500">Séance introuvable.</p>
        <Link href="/dashboard" className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Retour au tableau de bord</Link>
      </div>
    );
  }
  return <SessionDetail clientMode user="" date={date} dist={sp.dist} title={cleanActivityName(sp.title) || undefined} />;
}
