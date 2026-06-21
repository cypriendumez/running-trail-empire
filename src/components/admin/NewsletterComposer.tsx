"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Mail, Send, Loader2, Users } from "lucide-react";

export function NewsletterComposer({ subscriberCount }: { subscriberCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) { toast.error("Titre et contenu requis"); return; }
    setSending(true);
    try {
      const r = await fetch("/api/admin/broadcast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(`Publié ! ${j.emailed} e-mail(s) envoyé(s) · ${j.notified} notification(s)`, { duration: 7000 });
        setTitle(""); setBody(""); setConfirm(false);
      } else toast.error(j.error || "Échec de l'envoi");
    } catch { toast.error("Échec de l'envoi"); }
    finally { setSending(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800">
        <ArrowLeft className="h-4 w-4" /> Retour à l'admin
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50"><Mail className="h-5 w-5 text-emerald-600" /></span>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Nouvel article / newsletter</h1>
          <p className="flex items-center gap-1.5 text-sm text-zinc-500"><Users className="h-3.5 w-3.5" /> {subscriberCount} abonné(s) à la newsletter</p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Titre</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
            placeholder="Ex. Comment bien gérer ton premier marathon"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Contenu</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
            placeholder="Écris ton article ici… (texte simple, les sauts de ligne sont conservés)"
            className="w-full resize-y rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
        </div>

        {!confirm ? (
          <button onClick={() => { if (!title.trim() || !body.trim()) { toast.error("Titre et contenu requis"); return; } setConfirm(true); }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
            <Send className="h-4 w-4" /> Publier
          </button>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="text-sm font-medium text-amber-800">Envoyer à <b>{subscriberCount}</b> abonné(s) à la newsletter (e-mail + notif) ?</p>
            <div className="mt-3 flex gap-2">
              <button onClick={send} disabled={sending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmer l'envoi
              </button>
              <button onClick={() => setConfirm(false)} disabled={sending} className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100">Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
