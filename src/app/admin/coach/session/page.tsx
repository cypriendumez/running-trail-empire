import { SessionDetail } from "@/components/admin/SessionDetail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Séance · Coach" };

export default async function SessionPage({ searchParams }: { searchParams: Promise<{ user?: string; date?: string; dist?: string; title?: string }> }) {
  const sp = await searchParams;
  if (!sp.user || !sp.date) {
    return (
      <div className="p-10 text-center text-zinc-400">
        Séance introuvable. <a href="/admin/coach" className="text-emerald-600 underline">← Retour aux clients</a>
      </div>
    );
  }
  return <SessionDetail user={sp.user} date={sp.date} dist={sp.dist} title={sp.title} />;
}
