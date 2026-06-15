"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, Loader2, MessagesSquare, Paperclip, FileText, X, Search, ChevronLeft } from "lucide-react";
import { timeAgo, fmtFull } from "@/lib/utils/time";

type Attachment = { url: string; name: string; type: string };
type Msg = { from: "client" | "coach"; subject: string; body: string; ts: string; attachments: Attachment[] };
type Conv = { userId: string; name: string; email: string; msgs: Msg[]; lastTs: string; unread: number };

function Atts({ atts, dark }: { atts: Attachment[]; dark?: boolean }) {
  if (!atts?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {atts.map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ${dark ? "bg-white/15 text-white ring-white/20 hover:bg-white/25" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"}`}>
          <FileText className="h-3.5 w-3.5 flex-shrink-0" /><span className="max-w-[150px] truncate">{a.name}</span>
        </a>
      ))}
    </div>
  );
}

const draftKey = (uid: string) => `rte:draft:coach:${uid}`;

export function AdminMessages({ conversations, initialClient }: { conversations: Conv[]; initialClient?: string }) {
  const [convs, setConvs] = useState<Conv[]>(conversations);
  const [sel, setSel] = useState<string | null>(
    initialClient && conversations.some((c) => c.userId === initialClient) ? initialClient : (conversations[0]?.userId ?? null));
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const current = convs.find((c) => c.userId === sel);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [sel, convs]);

  const markRead = async (userId: string) => {
    setConvs((cs) => cs.map((x) => x.userId === userId ? { ...x, unread: 0 } : x));
    try { await fetch("/api/admin/read-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) }); } catch { /* ignore */ }
  };
  const selectConv = (userId: string) => {
    setSel(userId);
    try { setReply(localStorage.getItem(draftKey(userId)) || ""); } catch { setReply(""); }
    setPending([]);
    if ((convs.find((x) => x.userId === userId)?.unread ?? 0) > 0) markRead(userId);
  };
  // Montage : restaure le brouillon de la conversation présélectionnée + permission notif ; marque lu si besoin.
  useEffect(() => {
    if (sel) {
      try { const d = localStorage.getItem(draftKey(sel)); if (d) setReply(d); } catch { /* ignore */ }
      if ((conversations.find((x) => x.userId === sel)?.unread ?? 0) > 0) markRead(sel);
    }
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Auto-sauvegarde du brouillon de réponse, par conversation.
  useEffect(() => {
    if (!sel) return;
    try { if (reply.trim()) localStorage.setItem(draftKey(sel), reply); else localStorage.removeItem(draftKey(sel)); } catch { /* ignore */ }
  }, [reply, sel]);
  // Rafraîchit « il y a … » chaque minute.
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(i); }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) setPending((p) => [...p, { url: j.url, name: j.name, type: j.type }]); else toast.error(j.error || "Upload échoué");
    } catch { toast.error("Upload impossible"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const send = async () => {
    if (!current || (!reply.trim() && pending.length === 0) || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/admin/reply-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: current.userId, body: reply, attachments: pending }) });
      const j = await r.json();
      if (j.ok) {
        setConvs((cs) => cs.map((c) => c.userId === sel ? { ...c, msgs: [...c.msgs, { from: "coach", subject: "", body: reply, ts: new Date().toISOString(), attachments: pending }], lastTs: new Date().toISOString() } : c));
        setReply(""); setPending([]);
        try { if (sel) localStorage.removeItem(draftKey(sel)); } catch { /* ignore */ }
        toast.success("Réponse envoyée ✅");
      } else toast.error(j.error || "Échec");
    } catch { toast.error("Envoi impossible"); }
    finally { setSending(false); }
  };

  const q = query.trim().toLowerCase();
  const filtered = convs.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.msgs.some((m) => m.body.toLowerCase().includes(q)));
  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);

  if (convs.length === 0) {
    return <div className="flex h-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-center text-sm text-zinc-400"><div><MessagesSquare className="mx-auto mb-3 h-9 w-9 text-zinc-200" />Aucun message client pour l&apos;instant.</div></div>;
  }

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* ░░ Liste des conversations ░░ */}
      <div className={`w-full flex-shrink-0 flex-col border-r border-zinc-100 md:flex md:w-[360px] ${sel ? "hidden md:flex" : "flex"}`}>
        <div className="flex h-[60px] flex-shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-4">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-zinc-900">Conversations
            {totalUnread > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">{totalUnread}</span>}
          </h2>
          <span className="text-xs text-zinc-400">{convs.length}</span>
        </div>
        <div className="border-b border-zinc-100 p-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
            <Search className="h-4 w-4 flex-shrink-0 text-zinc-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un client…" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
            {query && <button onClick={() => setQuery("")} className="text-zinc-400 hover:text-zinc-600"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-zinc-400">Aucun client ne correspond.</div>
          ) : filtered.map((c) => {
            const last = c.msgs[c.msgs.length - 1];
            const active = c.userId === sel;
            return (
              <button key={c.userId} onClick={() => selectConv(c.userId)}
                className={`flex w-full gap-3 border-b border-zinc-50 px-4 py-3 text-left transition-colors ${active ? "bg-emerald-50" : "hover:bg-zinc-50"}`}>
                <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  {c.name.charAt(0).toUpperCase()}
                  {c.unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread > 0 ? "font-bold text-zinc-900" : "font-semibold text-zinc-700"}`}>{c.name}</span>
                    <span className="flex-shrink-0 text-[11px] text-zinc-400" title={fmtFull(c.lastTs)}>{timeAgo(c.lastTs)}</span>
                  </div>
                  <div className={`truncate text-xs ${c.unread > 0 ? "font-medium text-zinc-600" : "text-zinc-400"}`}>{last?.from === "coach" ? "Toi : " : ""}{last?.body || (last?.attachments.length ? "📎 pièce jointe" : "—")}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ░░ Fil + réponse ░░ */}
      <div className={`min-w-0 flex-1 flex-col ${sel ? "flex" : "hidden md:flex"}`}>
        {current ? (
          <>
            <div className="flex h-[60px] flex-shrink-0 items-center gap-3 border-b border-zinc-100 px-4">
              <button onClick={() => setSel(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 md:hidden"><ChevronLeft className="h-5 w-5" /></button>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">{current.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0">
                <div className="truncate font-bold text-zinc-900">{current.name}</div>
                <div className="truncate text-xs text-zinc-400">{current.email}</div>
              </div>
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-zinc-50/40 p-4">
              {current.msgs.map((m, i) => {
                const coach = m.from === "coach";
                return (
                  <div key={i} className={`flex ${coach ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${coach ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-zinc-100"}`}>
                      <div className={`mb-0.5 text-[10px] font-bold uppercase tracking-wide ${coach ? "text-emerald-100" : "text-zinc-400"}`}>{coach ? "Toi (coach)" : current.name.split(" ")[0]}{m.subject ? ` · ${m.subject}` : ""}</div>
                      {m.body && <div className="whitespace-pre-line">{m.body}</div>}
                      <Atts atts={m.attachments} dark={coach} />
                      <div className="mt-1 text-right text-[10px] opacity-70" title={fmtFull(m.ts)}>{timeAgo(m.ts)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex-shrink-0 space-y-2 border-t border-zinc-100 p-3">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pending.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"><FileText className="h-3.5 w-3.5 text-emerald-600" /><span className="max-w-[120px] truncate">{a.name}</span><button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500"><X className="h-3 w-3" /></button></span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" onChange={onFile} className="hidden" accept="image/*,.pdf,.gpx,.fit,.csv,.txt,.doc,.docx" />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50" title="Joindre">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</button>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={`Répondre à ${current.name.split(" ")[0]}…`}
                  className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
                <button onClick={send} disabled={sending || (!reply.trim() && pending.length === 0)} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100"><MessagesSquare className="h-8 w-8 text-zinc-300" /></div>
            <h3 className="mt-4 text-base font-semibold text-zinc-700">Sélectionne une conversation</h3>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">Choisis un client à gauche pour lire l&apos;échange et lui répondre.</p>
          </div>
        )}
      </div>
    </div>
  );
}
