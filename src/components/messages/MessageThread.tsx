"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Send, Loader2, Paperclip, Trash2, RotateCcw, Inbox, FileText, X, Mail, Reply, Search, GraduationCap, User, PenSquare, ChevronLeft, Pencil } from "lucide-react";
import { timeAgo, fmtFull } from "@/lib/utils/time";
import { useT } from "@/lib/i18n/LanguageProvider";

export type Attachment = { url: string; name: string; type: string };
export type Msg = { id: string; from: "client" | "coach"; subject: string; body: string; ts: string; attachments: Attachment[]; deleted: boolean };
type Folder = "received" | "sent" | "drafts" | "all" | "trash";

const FOLDERS: { k: Folder; icon: typeof Inbox }[] = [
  { k: "received", icon: Inbox },
  { k: "sent", icon: Send },
  { k: "drafts", icon: Pencil },
  { k: "all", icon: Mail },
  { k: "trash", icon: Trash2 },
];

const DRAFT_KEY = "rte:draft:client";

// ── i18n local (5 langues) — messagerie côté client. ───────────────────────
const M: Record<string, Record<string, string>> = {
  fr: {
    "f.received": "Boîte de réception", "f.sent": "Envoyés", "f.drafts": "Brouillons", "f.all": "Tous les messages", "f.trash": "Corbeille",
    "new": "Nouveau message", "coachYou": "Ton coach", "sla": "Réponse sous 24-48 h",
    "searchPh": "Rechercher dans les messages…",
    "cnt.draft": "brouillon", "cnt.drafts": "brouillons", "cnt.msg": "message", "cnt.msgs": "messages",
    "draft": "Brouillon", "noSubject": "(Sans objet)",
    "empty.drafts": "Aucun brouillon.", "empty.trash": "La corbeille est vide.", "empty.received": "Aucune réponse du coach pour l'instant.", "empty.search": "Aucun message ne correspond.", "empty.here": "Aucun message ici.",
    "grp.today": "Aujourd'hui", "grp.yesterday": "Hier", "grp.week": "Cette semaine", "grp.month": "Ce mois-ci", "grp.older": "Plus ancien",
    "me": "Moi", "coach": "Coach", "attachment": "Pièce jointe",
    "compose.reply": "Répondre au coach", "to": "À", "subject": "Objet", "subjectPh": "Sujet (optionnel)",
    "bodyPh": "Écris ton message à ton coach…\n\nUne question, un imprévu, une douleur, un objectif…",
    "join": "Joindre", "send": "Envoyer",
    "restore": "Restaurer", "reply": "Répondre", "delete": "Supprimer",
    "you": "Toi", "roleCoach": "· entraîneur", "roleClient": "· client", "noText": "(aucun texte)",
    "pick.title": "Sélectionne un message", "pick.desc": "Choisis un message dans la liste pour le lire, ou écris à ton coach.",
    "t.upFail": "Upload échoué", "t.upErr": "Upload impossible", "t.sent": "Message envoyé ✉️", "t.fail": "Échec", "t.sendErr": "Envoi impossible", "t.trash": "Déplacé dans la corbeille",
    "tp1.l": "Signaler une douleur", "tp1.s": "Douleur à signaler", "tp1.b": "Bonjour coach,\n\nJe ressens une douleur à [zone] depuis [quand]. C'est plutôt [à l'effort / au repos / le matin], et ça [augmente / diminue] en courant.\n\nMerci !",
    "tp2.l": "Décaler une séance", "tp2.s": "Décaler une séance", "tp2.b": "Bonjour coach,\n\nJe ne pourrai pas faire la séance de [jour] ([raison]). Peut-on la décaler à [autre jour] ?\n\nMerci !",
    "tp3.l": "Ajuster mon plan", "tp3.s": "Ajustement de mon plan", "tp3.b": "Bonjour coach,\n\nJ'aimerais ajuster mon plan : [plus de volume / moins d'intensité / objectif modifié].\n\nQu'en penses-tu ?",
    "tp4.l": "Question nutrition", "tp4.s": "Question nutrition", "tp4.b": "Bonjour coach,\n\nUne question nutrition : ",
    "tp5.l": "Question libre",
  },
  en: {
    "f.received": "Inbox", "f.sent": "Sent", "f.drafts": "Drafts", "f.all": "All messages", "f.trash": "Trash",
    "new": "New message", "coachYou": "Your coach", "sla": "Replies within 24-48 h",
    "searchPh": "Search messages…",
    "cnt.draft": "draft", "cnt.drafts": "drafts", "cnt.msg": "message", "cnt.msgs": "messages",
    "draft": "Draft", "noSubject": "(No subject)",
    "empty.drafts": "No drafts.", "empty.trash": "Trash is empty.", "empty.received": "No reply from your coach yet.", "empty.search": "No messages match.", "empty.here": "No messages here.",
    "grp.today": "Today", "grp.yesterday": "Yesterday", "grp.week": "This week", "grp.month": "This month", "grp.older": "Older",
    "me": "Me", "coach": "Coach", "attachment": "Attachment",
    "compose.reply": "Reply to your coach", "to": "To", "subject": "Subject", "subjectPh": "Subject (optional)",
    "bodyPh": "Write a message to your coach…\n\nA question, a hiccup, a pain, a goal…",
    "join": "Attach", "send": "Send",
    "restore": "Restore", "reply": "Reply", "delete": "Delete",
    "you": "You", "roleCoach": "· coach", "roleClient": "· client", "noText": "(no text)",
    "pick.title": "Select a message", "pick.desc": "Pick a message from the list to read it, or write to your coach.",
    "t.upFail": "Upload failed", "t.upErr": "Couldn't upload", "t.sent": "Message sent ✉️", "t.fail": "Failed", "t.sendErr": "Couldn't send", "t.trash": "Moved to trash",
    "tp1.l": "Report a pain", "tp1.s": "Pain to report", "tp1.b": "Hi coach,\n\nI've been feeling pain in [area] since [when]. It mostly shows up [during effort / at rest / in the morning], and it [gets worse / eases off] while running.\n\nThanks!",
    "tp2.l": "Reschedule a session", "tp2.s": "Reschedule a session", "tp2.b": "Hi coach,\n\nI won't be able to do the [day] session ([reason]). Could we move it to [another day]?\n\nThanks!",
    "tp3.l": "Adjust my plan", "tp3.s": "Plan adjustment", "tp3.b": "Hi coach,\n\nI'd like to adjust my plan: [more volume / less intensity / new goal].\n\nWhat do you think?",
    "tp4.l": "Nutrition question", "tp4.s": "Nutrition question", "tp4.b": "Hi coach,\n\nA nutrition question: ",
    "tp5.l": "Open question",
  },
  de: {
    "f.received": "Posteingang", "f.sent": "Gesendet", "f.drafts": "Entwürfe", "f.all": "Alle Nachrichten", "f.trash": "Papierkorb",
    "new": "Neue Nachricht", "coachYou": "Dein Coach", "sla": "Antwort innerhalb von 24-48 h",
    "searchPh": "Nachrichten durchsuchen…",
    "cnt.draft": "Entwurf", "cnt.drafts": "Entwürfe", "cnt.msg": "Nachricht", "cnt.msgs": "Nachrichten",
    "draft": "Entwurf", "noSubject": "(Kein Betreff)",
    "empty.drafts": "Keine Entwürfe.", "empty.trash": "Der Papierkorb ist leer.", "empty.received": "Noch keine Antwort vom Coach.", "empty.search": "Keine Nachricht passt dazu.", "empty.here": "Keine Nachrichten hier.",
    "grp.today": "Heute", "grp.yesterday": "Gestern", "grp.week": "Diese Woche", "grp.month": "Diesen Monat", "grp.older": "Älter",
    "me": "Ich", "coach": "Coach", "attachment": "Anhang",
    "compose.reply": "Dem Coach antworten", "to": "An", "subject": "Betreff", "subjectPh": "Betreff (optional)",
    "bodyPh": "Schreib deinem Coach…\n\nEine Frage, etwas Unvorhergesehenes, ein Schmerz, ein Ziel…",
    "join": "Anhängen", "send": "Senden",
    "restore": "Wiederherstellen", "reply": "Antworten", "delete": "Löschen",
    "you": "Du", "roleCoach": "· Trainer", "roleClient": "· Kunde", "noText": "(kein Text)",
    "pick.title": "Wähle eine Nachricht", "pick.desc": "Wähle eine Nachricht aus der Liste, um sie zu lesen, oder schreib deinem Coach.",
    "t.upFail": "Upload fehlgeschlagen", "t.upErr": "Upload nicht möglich", "t.sent": "Nachricht gesendet ✉️", "t.fail": "Fehlgeschlagen", "t.sendErr": "Senden nicht möglich", "t.trash": "In den Papierkorb verschoben",
    "tp1.l": "Schmerz melden", "tp1.s": "Schmerz zu melden", "tp1.b": "Hallo Coach,\n\nich spüre seit [wann] einen Schmerz an [Stelle]. Er tritt eher [bei Belastung / in Ruhe / morgens] auf und wird beim Laufen [stärker / schwächer].\n\nDanke!",
    "tp2.l": "Einheit verschieben", "tp2.s": "Einheit verschieben", "tp2.b": "Hallo Coach,\n\nich kann die Einheit am [Tag] nicht machen ([Grund]). Können wir sie auf [anderen Tag] verschieben?\n\nDanke!",
    "tp3.l": "Meinen Plan anpassen", "tp3.s": "Anpassung meines Plans", "tp3.b": "Hallo Coach,\n\nich würde meinen Plan gern anpassen: [mehr Umfang / weniger Intensität / neues Ziel].\n\nWas meinst du?",
    "tp4.l": "Ernährungsfrage", "tp4.s": "Ernährungsfrage", "tp4.b": "Hallo Coach,\n\neine Frage zur Ernährung: ",
    "tp5.l": "Freie Frage",
  },
  es: {
    "f.received": "Bandeja de entrada", "f.sent": "Enviados", "f.drafts": "Borradores", "f.all": "Todos los mensajes", "f.trash": "Papelera",
    "new": "Nuevo mensaje", "coachYou": "Tu coach", "sla": "Respuesta en 24-48 h",
    "searchPh": "Buscar en los mensajes…",
    "cnt.draft": "borrador", "cnt.drafts": "borradores", "cnt.msg": "mensaje", "cnt.msgs": "mensajes",
    "draft": "Borrador", "noSubject": "(Sin asunto)",
    "empty.drafts": "Ningún borrador.", "empty.trash": "La papelera está vacía.", "empty.received": "Aún no hay respuesta del coach.", "empty.search": "Ningún mensaje coincide.", "empty.here": "No hay mensajes aquí.",
    "grp.today": "Hoy", "grp.yesterday": "Ayer", "grp.week": "Esta semana", "grp.month": "Este mes", "grp.older": "Más antiguo",
    "me": "Yo", "coach": "Coach", "attachment": "Archivo adjunto",
    "compose.reply": "Responder al coach", "to": "Para", "subject": "Asunto", "subjectPh": "Asunto (opcional)",
    "bodyPh": "Escribe tu mensaje a tu coach…\n\nUna pregunta, un imprevisto, un dolor, un objetivo…",
    "join": "Adjuntar", "send": "Enviar",
    "restore": "Restaurar", "reply": "Responder", "delete": "Eliminar",
    "you": "Tú", "roleCoach": "· entrenador", "roleClient": "· cliente", "noText": "(sin texto)",
    "pick.title": "Selecciona un mensaje", "pick.desc": "Elige un mensaje de la lista para leerlo, o escribe a tu coach.",
    "t.upFail": "Subida fallida", "t.upErr": "No se pudo subir", "t.sent": "Mensaje enviado ✉️", "t.fail": "Error", "t.sendErr": "No se pudo enviar", "t.trash": "Movido a la papelera",
    "tp1.l": "Avisar de un dolor", "tp1.s": "Dolor que comunicar", "tp1.b": "Hola coach:\n\nSiento un dolor en [zona] desde [cuándo]. Aparece sobre todo [durante el esfuerzo / en reposo / por la mañana] y [aumenta / disminuye] al correr.\n\n¡Gracias!",
    "tp2.l": "Mover una sesión", "tp2.s": "Mover una sesión", "tp2.b": "Hola coach:\n\nNo podré hacer la sesión del [día] ([motivo]). ¿Podemos pasarla a [otro día]?\n\n¡Gracias!",
    "tp3.l": "Ajustar mi plan", "tp3.s": "Ajuste de mi plan", "tp3.b": "Hola coach:\n\nMe gustaría ajustar mi plan: [más volumen / menos intensidad / objetivo modificado].\n\n¿Qué te parece?",
    "tp4.l": "Pregunta de nutrición", "tp4.s": "Pregunta de nutrición", "tp4.b": "Hola coach:\n\nUna pregunta de nutrición: ",
    "tp5.l": "Pregunta libre",
  },
  pt: {
    "f.received": "Caixa de entrada", "f.sent": "Enviadas", "f.drafts": "Rascunhos", "f.all": "Todas as mensagens", "f.trash": "Lixo",
    "new": "Nova mensagem", "coachYou": "O teu coach", "sla": "Resposta em 24-48 h",
    "searchPh": "Pesquisar nas mensagens…",
    "cnt.draft": "rascunho", "cnt.drafts": "rascunhos", "cnt.msg": "mensagem", "cnt.msgs": "mensagens",
    "draft": "Rascunho", "noSubject": "(Sem assunto)",
    "empty.drafts": "Nenhum rascunho.", "empty.trash": "O lixo está vazio.", "empty.received": "Ainda sem resposta do coach.", "empty.search": "Nenhuma mensagem corresponde.", "empty.here": "Nenhuma mensagem aqui.",
    "grp.today": "Hoje", "grp.yesterday": "Ontem", "grp.week": "Esta semana", "grp.month": "Este mês", "grp.older": "Mais antigo",
    "me": "Eu", "coach": "Coach", "attachment": "Anexo",
    "compose.reply": "Responder ao coach", "to": "Para", "subject": "Assunto", "subjectPh": "Assunto (opcional)",
    "bodyPh": "Escreve a tua mensagem ao teu coach…\n\nUma pergunta, um imprevisto, uma dor, um objetivo…",
    "join": "Anexar", "send": "Enviar",
    "restore": "Restaurar", "reply": "Responder", "delete": "Eliminar",
    "you": "Tu", "roleCoach": "· treinador", "roleClient": "· cliente", "noText": "(sem texto)",
    "pick.title": "Seleciona uma mensagem", "pick.desc": "Escolhe uma mensagem da lista para a ler, ou escreve ao teu coach.",
    "t.upFail": "Falha no upload", "t.upErr": "Upload impossível", "t.sent": "Mensagem enviada ✉️", "t.fail": "Falhou", "t.sendErr": "Não foi possível enviar", "t.trash": "Movida para o lixo",
    "tp1.l": "Comunicar uma dor", "tp1.s": "Dor a comunicar", "tp1.b": "Olá coach,\n\nSinto uma dor em [zona] desde [quando]. Surge sobretudo [no esforço / em repouso / de manhã] e [aumenta / diminui] a correr.\n\nObrigado!",
    "tp2.l": "Adiar uma sessão", "tp2.s": "Adiar uma sessão", "tp2.b": "Olá coach,\n\nNão vou conseguir fazer a sessão de [dia] ([motivo]). Podemos passá-la para [outro dia]?\n\nObrigado!",
    "tp3.l": "Ajustar o meu plano", "tp3.s": "Ajuste do meu plano", "tp3.b": "Olá coach,\n\nGostava de ajustar o meu plano: [mais volume / menos intensidade / objetivo alterado].\n\nO que achas?",
    "tp4.l": "Pergunta de nutrição", "tp4.s": "Pergunta de nutrição", "tp4.b": "Olá coach,\n\nUma pergunta de nutrição: ",
    "tp5.l": "Pergunta livre",
  },
};

// Regroupe les messages par période → séparateurs lisibles dans la liste (clés traduites au rendu).
function groupOf(ts: string): string {
  const d = new Date(ts), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff <= 7) return "week";
  if (diff <= 31) return "month";
  return "older";
}

function Avatar({ coach, big }: { coach: boolean; big?: boolean }) {
  return (
    <span className={`flex flex-shrink-0 items-center justify-center rounded-full text-white ${big ? "h-11 w-11" : "h-9 w-9"} ${coach ? "bg-gradient-to-br from-emerald-400 to-green-600 ring-2 ring-emerald-100" : "bg-gradient-to-br from-zinc-700 to-zinc-900"}`}>
      {coach ? <GraduationCap className={big ? "h-5 w-5" : "h-[18px] w-[18px]"} /> : <User className={big ? "h-5 w-5" : "h-[18px] w-[18px]"} />}
    </span>
  );
}

function AttachmentList({ atts }: { atts: Attachment[] }) {
  if (!atts?.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
      {atts.map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50">
          <FileText className="h-4 w-4 flex-shrink-0 text-emerald-600" /><span className="max-w-[200px] truncate">{a.name}</span>
        </a>
      ))}
    </div>
  );
}

export function MessageThread({ initial }: { initial: Msg[] }) {
  const { lang } = useT();
  const d = M[lang] ?? M.fr;
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [folder, setFolder] = useState<Folder>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initial.filter((m) => !m.deleted).slice(-1)[0]?.id ?? null);
  const [mode, setMode] = useState<"read" | "compose">(initial.length === 0 ? "compose" : "read");
  const [query, setQuery] = useState("");
  // Composer
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string }>({ subject: "", body: "" });
  const [, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Modèles de message prêts à l'emploi (insérés dans le rédacteur en un clic).
  const TEMPLATES: { icon: string; label: string; subject: string; body: string }[] = [
    { icon: "🩹", label: d["tp1.l"], subject: d["tp1.s"], body: d["tp1.b"] },
    { icon: "📅", label: d["tp2.l"], subject: d["tp2.s"], body: d["tp2.b"] },
    { icon: "🎯", label: d["tp3.l"], subject: d["tp3.s"], body: d["tp3.b"] },
    { icon: "🍌", label: d["tp4.l"], subject: d["tp4.s"], body: d["tp4.b"] },
    { icon: "💬", label: d["tp5.l"], subject: "", body: "" },
  ];

  // Montage : restaure le brouillon + demande poliment la permission de notification.
  useEffect(() => {
    try {
      const s = localStorage.getItem(DRAFT_KEY);
      if (s) { const d = JSON.parse(s) as { subject?: string; body?: string }; const dd = { subject: d.subject || "", body: d.body || "" }; setDraft(dd); if (initial.length === 0) { setSubject(dd.subject); setBody(dd.body); } }
    } catch { /* ignore */ }
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Rafraîchit « il y a … » chaque minute.
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(i); }, []);
  // Auto-sauvegarde du brouillon pendant la rédaction.
  useEffect(() => {
    if (mode !== "compose") return;
    setDraft({ subject, body });
    try { if (subject.trim() || body.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, body })); else localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, [subject, body, mode]);

  const hasDraft = !!(draft.subject.trim() || draft.body.trim());
  const counts = {
    all: msgs.filter((m) => !m.deleted).length,
    sent: msgs.filter((m) => m.from === "client" && !m.deleted).length,
    received: msgs.filter((m) => m.from === "coach" && !m.deleted).length,
    drafts: hasDraft ? 1 : 0,
    trash: msgs.filter((m) => m.deleted).length,
  };
  const inFolder = (m: Msg) =>
    folder === "trash" ? m.deleted
      : !m.deleted && (folder === "all" || (folder === "sent" && m.from === "client") || (folder === "received" && m.from === "coach"));
  const q = query.trim().toLowerCase();
  const view = msgs.filter(inFolder)
    .filter((m) => !q || m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q))
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const selected = msgs.find((m) => m.id === selectedId) ?? null;
  const readerOpen = mode === "compose" || !!selected;

  const openMsg = (m: Msg) => { setSelectedId(m.id); setMode("read"); };
  // Sans argument = « Nouveau message » → restaure le brouillon. Avec argument = réponse (objet pré-rempli).
  const startCompose = (prefill?: string) => {
    setMode("compose");
    if (prefill !== undefined) { setSubject(prefill); setBody(""); }
    else { setSubject(draft.subject); setBody(draft.body); }
    setPending([]);
  };
  const cancelCompose = () => { setMode("read"); setSubject(""); setBody(""); setPending([]); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) setPending((p) => [...p, { url: j.url, name: j.name, type: j.type }]);
      else toast.error(j.error || d["t.upFail"]);
    } catch { toast.error(d["t.upErr"]); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const doSend = async () => {
    if ((!body.trim() && pending.length === 0) || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body, attachments: pending }) });
      const j = await r.json();
      if (j.ok) {
        const id = j.id || `tmp-${Date.now()}`;
        setMsgs((m) => [...m, { id, from: "client", subject, body, ts: new Date().toISOString(), attachments: pending, deleted: false }]);
        setSubject(""); setBody(""); setPending([]);
        setDraft({ subject: "", body: "" });
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setFolder("sent"); setSelectedId(id); setMode("read");
        toast.success(d["t.sent"]);
      } else toast.error(j.error || d["t.fail"]);
    } catch { toast.error(d["t.sendErr"]); }
    finally { setSending(false); }
  };
  const send = (e: React.FormEvent) => { e.preventDefault(); doSend(); };

  const softDelete = async (id: string) => {
    setMsgs((m) => m.map((x) => x.id === id ? { ...x, deleted: true } : x));
    if (selectedId === id) setSelectedId(null);
    toast.success(d["t.trash"]);
    try { await fetch(`/api/messages?id=${id}`, { method: "DELETE" }); } catch { /* ignore */ }
  };
  const restore = async (id: string) => {
    setMsgs((m) => m.map((x) => x.id === id ? { ...x, deleted: false } : x));
    try { await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", id }) }); } catch { /* ignore */ }
  };

  const folderLabel = d[`f.${folder}`] ?? "";

  return (
    <div className="flex h-full overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_48px_-28px_rgba(16,24,40,0.22)]">
      {/* ░░ Volet dossiers ░░ */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-zinc-100 bg-gradient-to-b from-zinc-50/80 to-white md:flex">
        <div className="p-3">
          <button onClick={() => startCompose()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_-10px_rgba(16,185,129,0.7)] transition-all hover:shadow-[0_12px_26px_-10px_rgba(16,185,129,0.85)] active:scale-[0.98]">
            <PenSquare className="h-4 w-4" /> {d["new"]}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {FOLDERS.map((f) => {
            const active = folder === f.k && mode === "read";
            const n = counts[f.k];
            return (
              <button key={f.k} onClick={() => { setFolder(f.k); setMode("read"); }}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100" : "text-zinc-600 hover:bg-white/70"}`}>
                {active && <motion.span layoutId="msg-folder-bar" transition={{ type: "spring", stiffness: 500, damping: 36 }} className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-emerald-500" />}
                <f.icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${active ? "text-emerald-600" : "text-zinc-400 group-hover:text-zinc-600"}`} />
                <span className="flex-1 text-left">{d[`f.${f.k}`]}</span>
                {n > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-emerald-100 text-emerald-700" : f.k === "received" ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"}`}>{n}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 ring-1 ring-zinc-100">
            <div className="relative">
              <Avatar coach />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-zinc-800">{d["coachYou"]}</div>
              <div className="truncate text-[11px] text-zinc-400">{d["sla"]}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ░░ Liste des messages ░░ */}
      <div className={`w-full flex-shrink-0 flex-col border-r border-zinc-100 md:flex md:w-[380px] ${readerOpen ? "hidden md:flex" : "flex"}`}>
        <div className="flex h-[60px] flex-shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-4">
          <h2 className="text-[15px] font-bold text-zinc-900">{folderLabel}</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
            {folder === "drafts"
              ? <>{counts.drafts} {counts.drafts > 1 ? d["cnt.drafts"] : d["cnt.draft"]}</>
              : <>{view.length} {view.length > 1 ? d["cnt.msgs"] : d["cnt.msg"]}</>}
          </span>
        </div>
        <div className="border-b border-zinc-100 p-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-100/80 px-3 py-2 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/30">
            <Search className="h-4 w-4 flex-shrink-0 text-zinc-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={d["searchPh"]}
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
            {query && <button onClick={() => setQuery("")} className="text-zinc-400 transition-colors hover:text-zinc-600"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {folder === "drafts" ? (
            hasDraft ? (
              <button onClick={() => startCompose()} className="flex w-full gap-3 border-b border-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-50">
                <Avatar coach={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-700">{d["draft"]}</span>
                    <span className="flex-shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">{d["draft"]}</span>
                  </div>
                  <div className="truncate text-[13px] font-medium text-zinc-700">{draft.subject || d["noSubject"]}</div>
                  <div className="truncate text-xs text-zinc-400">{draft.body || "—"}</div>
                </div>
              </button>
            ) : (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-100"><Pencil className="h-7 w-7 text-zinc-300" /></div>
                <p className="mt-3 text-sm text-zinc-400">{d["empty.drafts"]}</p>
              </div>
            )
          ) : view.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-100"><Mail className="h-7 w-7 text-zinc-300" /></div>
              <p className="mt-3 text-sm text-zinc-400">{folder === "trash" ? d["empty.trash"] : folder === "received" ? d["empty.received"] : query ? d["empty.search"] : d["empty.here"]}</p>
            </div>
          ) : (() => { let lastGroup = ""; return view.map((m, i) => {
            const coach = m.from === "coach";
            const active = m.id === selectedId && mode === "read";
            const grp = groupOf(m.ts);
            const showSep = grp !== lastGroup; lastGroup = grp;
            return (
              <Fragment key={m.id}>
                {showSep && <div className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-300">{d[`grp.${grp}`]}</div>}
                <motion.button onClick={() => openMsg(m)}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.2 }}
                  className={`relative flex w-full gap-3 border-b border-zinc-50 px-4 py-3 text-left transition-colors ${active ? "bg-emerald-50/80" : "hover:bg-zinc-50"}`}>
                  {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-emerald-500" />}
                  <Avatar coach={coach} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${coach ? "font-bold text-zinc-900" : "font-semibold text-zinc-700"}`}>{coach ? d["coach"] : d["me"]}</span>
                      <span className="flex-shrink-0 text-[11px] text-zinc-400" title={fmtFull(m.ts, lang)}>{timeAgo(m.ts, lang)}</span>
                    </div>
                    <div className="truncate text-[13px] font-medium text-zinc-700">{m.subject || d["noSubject"]}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs text-zinc-400">{m.body || (m.attachments.length ? d["attachment"] : "—")}</span>
                      {m.attachments.length > 0 && <Paperclip className="h-3 w-3 flex-shrink-0 text-zinc-400" />}
                    </div>
                  </div>
                </motion.button>
              </Fragment>
            );
          }); })()}
        </div>
      </div>

      {/* ░░ Volet lecture / composition ░░ */}
      <div className={`min-w-0 flex-1 flex-col ${readerOpen ? "flex" : "hidden md:flex"}`}>
        <AnimatePresence mode="wait">
        {mode === "compose" ? (
          <motion.form key="compose" onSubmit={send} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex h-full flex-col">
            <div className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-zinc-100 px-5">
              <h1 className="flex items-center gap-2 text-base font-bold text-zinc-900"><PenSquare className="h-4 w-4 text-emerald-600" /> {subject.startsWith("Re:") ? d["compose.reply"] : d["new"]}</h1>
              <button type="button" onClick={cancelCompose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-12 flex-shrink-0 text-zinc-400">{d["to"]}</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 py-1 pl-1 pr-3 ring-1 ring-emerald-100"><Avatar coach /><span className="text-[13px] font-semibold text-emerald-800">{d["coachYou"]}</span></span>
              </div>
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
                <span className="w-12 flex-shrink-0 text-sm text-zinc-400">{d["subject"]}</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={d["subjectPh"]} className="w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-zinc-400" />
              </div>
              {!body.trim() && (
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <button key={t.label} type="button" onClick={() => { setSubject(t.subject); setBody(t.body); }}
                      className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              )}
              <textarea value={body} onChange={(e) => setBody(e.target.value)} autoFocus
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); doSend(); } }}
                placeholder={d["bodyPh"]}
                className="min-h-[180px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-zinc-300" />
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pending.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600">
                      <FileText className="h-3.5 w-3.5 text-emerald-600" /><span className="max-w-[160px] truncate">{a.name}</span>
                      <button type="button" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center justify-between border-t border-zinc-100 px-4 py-3">
              <div>
                <input ref={fileRef} type="file" onChange={onFile} className="hidden" accept="image/*,.pdf,.gpx,.fit,.csv,.txt,.doc,.docx" />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} {d["join"]}
                </button>
              </div>
              <button type="submit" disabled={sending || (!body.trim() && pending.length === 0)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(16,185,129,0.7)] transition-all hover:shadow-[0_10px_22px_-8px_rgba(16,185,129,0.85)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {d["send"]}
              </button>
            </div>
          </motion.form>
        ) : selected ? (
          <motion.div key="read" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex h-full flex-col">
            <div className="flex-shrink-0 border-b border-zinc-100 px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button onClick={() => setSelectedId(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 md:hidden"><ChevronLeft className="h-5 w-5" /></button>
                  <h1 className="truncate text-xl font-bold text-zinc-900">{selected.subject || d["noSubject"]}</h1>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {selected.deleted ? (
                    <button onClick={() => restore(selected.id)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"><RotateCcw className="h-4 w-4" /> {d["restore"]}</button>
                  ) : (
                    <>
                      <button onClick={() => startCompose(selected.subject ? (selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`) : "")} title={d["reply"]} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"><Reply className="h-[18px] w-[18px]" /></button>
                      <button onClick={() => softDelete(selected.id)} title={d["delete"]} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 className="h-[18px] w-[18px]" /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar coach={selected.from === "coach"} big />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">{selected.from === "coach" ? d["coachYou"] : d["you"]} <span className="font-normal text-zinc-400">{selected.from === "coach" ? d["roleCoach"] : d["roleClient"]}</span></div>
                  <div className="text-xs capitalize text-zinc-400" title={fmtFull(selected.ts, lang)}>{timeAgo(selected.ts, lang)} · {fmtFull(selected.ts, lang)}</div>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className={`rounded-2xl p-4 ring-1 ${selected.from === "coach" ? "bg-emerald-50/50 ring-emerald-100" : "bg-zinc-50/70 ring-zinc-100"}`}>
                <div className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-800">{selected.body || <span className="italic text-zinc-400">{d["noText"]}</span>}</div>
                <AttachmentList atts={selected.attachments} />
              </div>
            </div>
            {!selected.deleted && (
              <div className="flex-shrink-0 border-t border-zinc-100 px-6 py-3">
                <button onClick={() => startCompose(selected.subject ? (selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`) : "")}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
                  <Reply className="h-4 w-4" /> {d["reply"]}
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex h-full flex-col items-center justify-center px-6 text-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 20 }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-green-50 ring-1 ring-emerald-100"><Mail className="h-9 w-9 text-emerald-300" /></motion.div>
            <h3 className="mt-4 text-base font-semibold text-zinc-700">{d["pick.title"]}</h3>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">{d["pick.desc"]}</p>
            <button onClick={() => startCompose()} className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(16,185,129,0.7)] transition-all hover:shadow-[0_10px_22px_-8px_rgba(16,185,129,0.85)] active:scale-[0.98]"><PenSquare className="h-4 w-4" /> {d["new"]}</button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
