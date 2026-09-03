import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MessageThread, type Msg } from "@/components/messages/MessageThread";
import { MessagesSquare } from "lucide-react";
import { normLang } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messagerie" };

// ── i18n local (5 langues) — en-tête serveur de la page. ───────────────────
const L: Record<string, { title: string; subtitle: string }> = {
  fr: { title: "Messagerie", subtitle: "Échange directement avec ton coach — questions, imprévus, douleurs, objectifs." },
  en: { title: "Messages", subtitle: "Chat directly with your coach — questions, hiccups, aches, goals." },
  de: { title: "Nachrichten", subtitle: "Tausche dich direkt mit deinem Coach aus — Fragen, Unvorhergesehenes, Schmerzen, Ziele." },
  es: { title: "Mensajería", subtitle: "Habla directamente con tu coach: preguntas, imprevistos, dolores, objetivos." },
  pt: { title: "Mensagens", subtitle: "Fala diretamente com o teu coach — perguntas, imprevistos, dores, objetivos." },
};

export default async function MessagesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: profileRow }] = await Promise.all([
    sb.from("notifications")
      .select("id, type, data, created_at")
      // ⚠️ LES QUATRE TYPES. Les messages entre athlètes s'écrivent en deux lignes —
      // `athlete_message` chez le destinataire, `athlete_message_sent` chez l'expéditeur —
      // sans quoi le dossier « Envoyés » resterait vide de son côté.
      .eq("user_id", user.id).in("type", ["client_message", "coach_message", "athlete_message", "athlete_message_sent"])
      .order("created_at", { ascending: true }).limit(200),
    sb.from("profiles").select("preferred_language").eq("id", user.id).single(),
  ]);
  const l = L[normLang(profileRow?.preferred_language ?? "fr")] ?? L.fr;

  const initial: Msg[] = (data ?? []).map((r) => {
    const d = (r.data ?? {}) as { subject?: string; body?: string; ts?: string; attachments?: { url: string; name: string; type: string }[]; deleted?: boolean; from_name?: string; from_id?: string; to_id?: string };
    // Un message reçu d'un athlète est « à moi » comme un message du coach ; un message
    // que J'AI envoyé est à ranger dans « Envoyés », d'où la distinction par type.
    const from = r.type === "coach_message" || r.type === "athlete_message" ? "coach" : "client";
    const auteur = r.type === "athlete_message" ? String(d.from_name ?? "").trim() : "";
    return { id: String(r.id), from, subject: auteur ? `${auteur} — ${d.subject || ""}` : (d.subject || ""), body: d.body || "", ts: d.ts || (r.created_at as string), attachments: Array.isArray(d.attachments) ? d.attachments : [], deleted: !!d.deleted };
  });

  // Dès l'ouverture, les réponses du coach sont considérées lues → la pastille de la sidebar disparaît.
  await createAdminClient().from("notifications").update({ read: true })
    .eq("user_id", user.id).in("type", ["coach_message", "athlete_message"]).eq("read", false);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-zinc-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)]"><MessagesSquare className="h-[18px] w-[18px]" /></span>
            {l.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{l.subtitle}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <MessageThread initial={initial} />
      </div>
    </div>
  );
}
