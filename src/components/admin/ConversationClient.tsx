"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessagesSquare } from "lucide-react";

type Msg = { de: "coach" | "client"; objet: string; texte: string; at: string };

/**
 * LE FIL DE DISCUSSION, DANS LA FICHE DE L'ATHLÈTE.
 *
 * ⚠️ Il vivait sur une page séparée. Pour répondre à quelqu'un, il fallait quitter sa
 * fiche — donc perdre de vue sa charge, ses séances et son ressenti, c'est-à-dire
 * précisément ce dont on lui parle. Répondre « ta séance de jeudi » sans l'avoir sous
 * les yeux, c'est répondre de mémoire.
 *
 * ⚠️ On ne recharge PAS le fil en boucle. Un sondage permanent sur un écran ouvert toute
 * la journée, pour une messagerie qui reçoit quelques messages par semaine, dépense sans
 * rien apporter : le fil se charge à l'ouverture de la fiche, et après chaque envoi.
 */
export function ConversationClient({ userId, nom }: { userId: string; nom: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const bas = useRef<HTMLDivElement>(null);

  async function charger() {
    try {
      const r = await fetch(`/api/admin/conversation?user_id=${encodeURIComponent(userId)}`);
      const j = await r.json();
      setMsgs(j?.ok ? j.messages : []);
    } catch { setMsgs([]); }
  }

  useEffect(() => { setMsgs(null); setTexte(""); setErreur(null); charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);
  useEffect(() => { bas.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function envoyer() {
    const t = texte.trim();
    if (!t) return;
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch("/api/admin/reply-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, body: t, attachments: [] }),
      });
      if (!r.ok) { setErreur("L'envoi a échoué. Réessaie."); setEnvoi(false); return; }
      setTexte("");
      await charger();
    } catch { setErreur("Connexion impossible."); }
    setEnvoi(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col" style={{ maxHeight: 520 }}>
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
        <MessagesSquare className="w-4 h-4 text-violet-600" />
        <h3 className="font-bold text-zinc-900 text-sm">Conversation</h3>
        <span className="text-xs text-zinc-400">avec {nom}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[140px]">
        {msgs === null && <p className="text-xs text-zinc-400">Chargement…</p>}
        {msgs?.length === 0 && (
          <p className="text-sm text-zinc-400 leading-relaxed">
            Aucun message pour l&apos;instant. Écris-lui — il le recevra dans sa messagerie et par e-mail.
          </p>
        )}
        {msgs?.map((m, i) => (
          <div key={`${m.at}-${i}`} className={`flex ${m.de === "coach" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.de === "coach" ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-800"}`}>
              {m.objet && <div className={`text-[11px] font-semibold mb-0.5 ${m.de === "coach" ? "text-white/70" : "text-zinc-500"}`}>{m.objet}</div>}
              <p className="text-sm leading-relaxed whitespace-pre-line">{m.texte}</p>
              <div className={`mt-1 text-[10px] ${m.de === "coach" ? "text-white/50" : "text-zinc-400"}`}>
                {m.at ? new Date(m.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
              </div>
            </div>
          </div>
        ))}
        <div ref={bas} />
      </div>

      <div className="border-t border-zinc-100 p-3">
        {erreur && <p className="mb-2 text-xs font-medium text-red-600">{erreur}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={texte} onChange={(e) => setTexte(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) envoyer(); }}
            rows={2} placeholder={`Répondre à ${nom.split(" ")[0]}…`}
            className="flex-1 resize-none rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-violet-500"
          />
          <button onClick={envoyer} disabled={envoi || !texte.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-400">⌘ + Entrée pour envoyer</p>
      </div>
    </div>
  );
}
