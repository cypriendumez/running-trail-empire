import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminMessages } from "@/components/admin/AdminMessages";
import { ArrowLeft, MessagesSquare } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages clients · Coach" };

type Msg = { from: "client" | "coach"; subject: string; body: string; ts: string; attachments: { url: string; name: string; type: string }[] };

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const initialClient = (await searchParams).client;
  const sb = createAdminClient();
  const [msgRes, profRes] = await Promise.all([
    sb.from("notifications").select("user_id, type, data, created_at, read").in("type", ["client_message", "coach_message"]).order("created_at", { ascending: true }).limit(500),
    sb.from("profiles").select("id, full_name, email"),
  ]);

  const prof: Record<string, { full_name?: string; email?: string }> = {};
  for (const p of profRes.data ?? []) prof[p.id as string] = p;

  const byUser: Record<string, Msg[]> = {};
  const unreadByUser: Record<string, number> = {};
  for (const m of msgRes.data ?? []) {
    const d = (m.data ?? {}) as { subject?: string; body?: string; ts?: string; attachments?: { url: string; name: string; type: string }[] };
    (byUser[m.user_id as string] ??= []).push({ from: m.type === "coach_message" ? "coach" : "client", subject: d.subject || "", body: d.body || "", ts: d.ts || (m.created_at as string), attachments: Array.isArray(d.attachments) ? d.attachments : [] });
    if (m.type === "client_message" && !m.read) unreadByUser[m.user_id as string] = (unreadByUser[m.user_id as string] || 0) + 1;
  }

  const conversations = Object.entries(byUser).map(([userId, msgs]) => ({
    userId,
    name: (prof[userId]?.full_name as string) || (prof[userId]?.email as string) || "Client",
    email: (prof[userId]?.email as string) || "",
    msgs,
    lastTs: msgs[msgs.length - 1]?.ts ?? "",
    unread: unreadByUser[userId] || 0,
  })).sort((a, b) => b.lastTs.localeCompare(a.lastTs));

  return (
    <div className="flex h-screen flex-col bg-zinc-50 p-4 sm:p-6">
      <header className="mb-4 flex-shrink-0">
        <Link href="/admin/coach" className="mb-2 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"><ArrowLeft className="h-4 w-4" /> Retour au coach</Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900"><MessagesSquare className="h-6 w-6 text-emerald-600" /> Messages clients</h1>
      </header>
      <div className="min-h-0 flex-1">
        <AdminMessages conversations={conversations} initialClient={initialClient} />
      </div>
    </div>
  );
}
