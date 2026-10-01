"use client";

/**
 * LA MESSAGERIE, EN MESSAGES PRIVÉS — refaite le 30/09/2026.
 *
 * Cyprien : « ça fait trop formel, boîte mail pro ; fais plutôt en mode Instagram, ça sera
 * bien plus simple ». L'ancien écran empilait cinq dossiers (réception, envoyés,
 * brouillons, tous, corbeille), un objet à remplir, un volet de lecture et un bouton
 * « Répondre » : un client de courrier pour échanger trois phrases avec son coach.
 *
 * Désormais : à gauche les CONVERSATIONS (le coach épinglé, puis les amis), à droite le fil
 * en bulles, par jour, et la barre d'écriture en bas — Entrée envoie, Maj+Entrée va à la
 * ligne. Plus d'objet (la route le déduit du texte pour l'e-mail du coach), plus de
 * corbeille : un message supprimé se rattrape tout de suite (« Annuler »).
 *
 * Et Cyprien veut recevoir les messages dans SA boîte : chaque message au coach part aussi
 * par e-mail (`/api/messages`, réponse directe à l'athlète depuis Outlook), et l'en-tête du
 * coach propose « Écrire par e-mail » vers l'adresse publique de l'éditeur.
 */
import { useState, useRef, useEffect, useMemo, Fragment } from "react";
import { toast } from "sonner";
import { Send, Loader2, Paperclip, Trash2, FileText, X, Mail, Search, GraduationCap, ChevronLeft } from "lucide-react";
import { timeAgo } from "@/lib/utils/time";
import { useT } from "@/lib/i18n/LanguageProvider";
import { EDITEUR } from "@/lib/brand/editeur";

export type Attachment = { url: string; name: string; type: string };
/**
 * Un message, et la CONVERSATION à laquelle il appartient : `avec` = "coach", ou
 * l'identifiant de l'ami (expéditeur d'un message reçu, destinataire d'un message envoyé).
 */
export type Msg = {
  id: string; from: "client" | "coach"; subject: string; body: string; ts: string; attachments: Attachment[]; deleted: boolean;
  avec?: string; avecNom?: string;
};

const COACH = "coach";
const brouillonCle = (conv: string) => `rte:draft:${conv}`;

// ── i18n local (5 langues). ─────────────────────────────────────────────────
const M: Record<string, Record<string, string>> = {
  fr: {
    "titre": "Messages", "searchPh": "Rechercher", "coachYou": "Ton coach", "sla": "Répond sous 24-48 h",
    "amis": "Tes amis", "amisVides": "Aucun ami pour l'instant. Suis un athlète depuis le Club — vous pourrez échanger dès qu'il te suivra en retour.",
    "toi": "Toi", "ami": "Ami", "retour": "Retour", "aujourdhui": "Aujourd'hui", "hier": "Hier",
    "vide.coach": "Une question, un imprévu, une douleur, un objectif ? Écris à ton coach, il te répond ici.",
    "vide.ami": "Écris le premier message à {nom}.",
    "ecrire": "Écris un message…", "envoyer": "Envoyer", "joindre": "Joindre un fichier", "pj": "Pièce jointe",
    "suppr": "Supprimer", "supprime": "Message supprimé", "annuler": "Annuler",
    "mail": "Écrire par e-mail", "mailNote": "Tes messages au coach arrivent aussi directement dans sa boîte mail.",
    "suggestions": "Suggestions",
    "t.upFail": "Envoi du fichier échoué", "t.upErr": "Fichier impossible à envoyer", "t.fail": "Échec", "t.sendErr": "Envoi impossible",
    "tp1.l": "Signaler une douleur", "tp1.b": "Bonjour coach, je ressens une douleur à [zone] depuis [quand]. C'est plutôt [à l'effort / au repos / le matin].",
    "tp2.l": "Décaler une séance", "tp2.b": "Bonjour coach, je ne pourrai pas faire la séance de [jour] ([raison]). Peut-on la décaler à [autre jour] ?",
    "tp3.l": "Ajuster mon plan", "tp3.b": "Bonjour coach, j'aimerais ajuster mon plan : [plus de volume / moins d'intensité / objectif modifié].",
    "tp4.l": "Question nutrition", "tp4.b": "Bonjour coach, une question nutrition : ",
  },
  en: {
    "titre": "Messages", "searchPh": "Search", "coachYou": "Your coach", "sla": "Replies within 24-48 h",
    "amis": "Your friends", "amisVides": "No friends yet. Follow an athlete from the Club — you can talk as soon as they follow you back.",
    "toi": "You", "ami": "Friend", "retour": "Back", "aujourdhui": "Today", "hier": "Yesterday",
    "vide.coach": "A question, a hiccup, an ache, a goal? Write to your coach — the reply lands here.",
    "vide.ami": "Send the first message to {nom}.",
    "ecrire": "Write a message…", "envoyer": "Send", "joindre": "Attach a file", "pj": "Attachment",
    "suppr": "Delete", "supprime": "Message deleted", "annuler": "Undo",
    "mail": "Write by email", "mailNote": "Your messages to the coach also land straight in their inbox.",
    "suggestions": "Suggestions",
    "t.upFail": "File upload failed", "t.upErr": "Couldn't upload the file", "t.fail": "Failed", "t.sendErr": "Couldn't send",
    "tp1.l": "Report a pain", "tp1.b": "Hi coach, I've been feeling pain in [area] since [when]. It mostly shows up [during effort / at rest / in the morning].",
    "tp2.l": "Reschedule a session", "tp2.b": "Hi coach, I won't be able to do the [day] session ([reason]). Could we move it to [another day]?",
    "tp3.l": "Adjust my plan", "tp3.b": "Hi coach, I'd like to adjust my plan: [more volume / less intensity / new goal].",
    "tp4.l": "Nutrition question", "tp4.b": "Hi coach, a nutrition question: ",
  },
  de: {
    "titre": "Nachrichten", "searchPh": "Suchen", "coachYou": "Dein Coach", "sla": "Antwortet innerhalb von 24-48 h",
    "amis": "Deine Freunde", "amisVides": "Noch keine Freunde. Folge einem Athleten im Club — ihr könnt schreiben, sobald er zurückfolgt.",
    "toi": "Du", "ami": "Freund", "retour": "Zurück", "aujourdhui": "Heute", "hier": "Gestern",
    "vide.coach": "Eine Frage, etwas Unvorhergesehenes, ein Schmerz, ein Ziel? Schreib deinem Coach — die Antwort kommt hier an.",
    "vide.ami": "Schreib {nom} die erste Nachricht.",
    "ecrire": "Nachricht schreiben…", "envoyer": "Senden", "joindre": "Datei anhängen", "pj": "Anhang",
    "suppr": "Löschen", "supprime": "Nachricht gelöscht", "annuler": "Rückgängig",
    "mail": "Per E-Mail schreiben", "mailNote": "Deine Nachrichten an den Coach landen auch direkt in seinem Postfach.",
    "suggestions": "Vorschläge",
    "t.upFail": "Datei-Upload fehlgeschlagen", "t.upErr": "Datei konnte nicht hochgeladen werden", "t.fail": "Fehlgeschlagen", "t.sendErr": "Senden nicht möglich",
    "tp1.l": "Schmerz melden", "tp1.b": "Hallo Coach, ich spüre seit [wann] einen Schmerz an [Stelle]. Er tritt eher [bei Belastung / in Ruhe / morgens] auf.",
    "tp2.l": "Einheit verschieben", "tp2.b": "Hallo Coach, ich kann die Einheit am [Tag] nicht machen ([Grund]). Können wir sie auf [anderen Tag] verschieben?",
    "tp3.l": "Plan anpassen", "tp3.b": "Hallo Coach, ich würde meinen Plan gern anpassen: [mehr Umfang / weniger Intensität / neues Ziel].",
    "tp4.l": "Ernährungsfrage", "tp4.b": "Hallo Coach, eine Frage zur Ernährung: ",
  },
  es: {
    "titre": "Mensajes", "searchPh": "Buscar", "coachYou": "Tu coach", "sla": "Responde en 24-48 h",
    "amis": "Tus amigos", "amisVides": "Aún no tienes amigos. Sigue a un atleta desde el Club — podréis hablar en cuanto te siga de vuelta.",
    "toi": "Tú", "ami": "Amigo", "retour": "Volver", "aujourdhui": "Hoy", "hier": "Ayer",
    "vide.coach": "¿Una pregunta, un imprevisto, un dolor, un objetivo? Escribe a tu coach: la respuesta llega aquí.",
    "vide.ami": "Envía el primer mensaje a {nom}.",
    "ecrire": "Escribe un mensaje…", "envoyer": "Enviar", "joindre": "Adjuntar un archivo", "pj": "Archivo adjunto",
    "suppr": "Eliminar", "supprime": "Mensaje eliminado", "annuler": "Deshacer",
    "mail": "Escribir por e-mail", "mailNote": "Tus mensajes al coach también llegan directamente a su correo.",
    "suggestions": "Sugerencias",
    "t.upFail": "Error al subir el archivo", "t.upErr": "No se pudo subir el archivo", "t.fail": "Error", "t.sendErr": "No se pudo enviar",
    "tp1.l": "Avisar de un dolor", "tp1.b": "Hola coach, siento un dolor en [zona] desde [cuándo]. Aparece sobre todo [durante el esfuerzo / en reposo / por la mañana].",
    "tp2.l": "Mover una sesión", "tp2.b": "Hola coach, no podré hacer la sesión del [día] ([motivo]). ¿Podemos pasarla a [otro día]?",
    "tp3.l": "Ajustar mi plan", "tp3.b": "Hola coach, me gustaría ajustar mi plan: [más volumen / menos intensidad / objetivo modificado].",
    "tp4.l": "Pregunta de nutrición", "tp4.b": "Hola coach, una pregunta de nutrición: ",
  },
  pt: {
    "titre": "Mensagens", "searchPh": "Pesquisar", "coachYou": "O teu coach", "sla": "Responde em 24-48 h",
    "amis": "Os teus amigos", "amisVides": "Ainda sem amigos. Segue um atleta no Clube — podem falar assim que ele te seguir de volta.",
    "toi": "Tu", "ami": "Amigo", "retour": "Voltar", "aujourdhui": "Hoje", "hier": "Ontem",
    "vide.coach": "Uma pergunta, um imprevisto, uma dor, um objetivo? Escreve ao teu coach — a resposta chega aqui.",
    "vide.ami": "Envia a primeira mensagem a {nom}.",
    "ecrire": "Escreve uma mensagem…", "envoyer": "Enviar", "joindre": "Anexar um ficheiro", "pj": "Anexo",
    "suppr": "Eliminar", "supprime": "Mensagem eliminada", "annuler": "Anular",
    "mail": "Escrever por e-mail", "mailNote": "As tuas mensagens ao coach também chegam diretamente à caixa de correio dele.",
    "suggestions": "Sugestões",
    "t.upFail": "Falha no envio do ficheiro", "t.upErr": "Não foi possível enviar o ficheiro", "t.fail": "Falhou", "t.sendErr": "Não foi possível enviar",
    "tp1.l": "Comunicar uma dor", "tp1.b": "Olá coach, sinto uma dor em [zona] desde [quando]. Surge sobretudo [no esforço / em repouso / de manhã].",
    "tp2.l": "Adiar uma sessão", "tp2.b": "Olá coach, não vou conseguir fazer a sessão de [dia] ([motivo]). Podemos passá-la para [outro dia]?",
    "tp3.l": "Ajustar o meu plano", "tp3.b": "Olá coach, gostava de ajustar o meu plano: [mais volume / menos intensidade / objetivo alterado].",
    "tp4.l": "Pergunta de nutrição", "tp4.b": "Olá coach, uma pergunta de nutrição: ",
  },
};

/** « 2026-09-30 » d'un horodatage, en heure locale — la clé des séparateurs de jour. */
const jourDe = (ts: string) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function Avatar({ coach, nom, petit }: { coach?: boolean; nom?: string; petit?: boolean }) {
  const taille = petit ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  return coach
    ? <span className={`flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white ${taille}`}><GraduationCap className={petit ? "h-4 w-4" : "h-5 w-5"} /></span>
    : <span className={`flex flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 font-semibold text-white ${taille}`}>{(nom || "?").charAt(0).toUpperCase()}</span>;
}

export function MessageThread({ initial }: { initial: Msg[] }) {
  const { lang } = useT();
  const d = M[lang] ?? M.fr;
  const tr = (k: string, p?: Record<string, string>) => { let s = d[k] ?? M.fr[k] ?? k; for (const [c, v] of Object.entries(p ?? {})) s = s.split(`{${c}}`).join(v); return s; };
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [query, setQuery] = useState("");
  /** La conversation ouverte : "" = le coach, sinon l'identifiant de l'ami. */
  const [aQui, setAQui] = useState<string>("");
  /** Sur téléphone : la liste OU la conversation, comme Instagram. */
  const [ouverte, setOuverte] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const filRef = useRef<HTMLDivElement>(null);
  const saisieRef = useRef<HTMLTextAreaElement>(null);
  const conv = aQui || COACH;

  // ⚠️ LA LISTE VIENT DU SERVEUR, ET LE DROIT D'ÉCRIRE Y EST REVÉRIFIÉ. Ce qu'on
  // affiche ici n'est qu'un confort : la route refuse un destinataire non réciproque,
  // qu'il soit dans cette liste ou non.
  const [amis, setAmis] = useState<{ id: string; nom: string }[]>([]);
  useEffect(() => {
    let vivant = true;
    fetch("/api/social/amis")
      .then((r) => (r.ok ? r.json() : { amis: [] }))
      .then((j) => { if (vivant) setAmis(Array.isArray(j.amis) ? j.amis : []); })
      .catch(() => { /* la messagerie du coach doit marcher même si cette liste échoue */ });
    return () => { vivant = false; };
  }, []);

  // « il y a 3 min » se rafraîchit chaque minute.
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(i); }, []);
  // Le brouillon est gardé PAR conversation, et revient quand on la rouvre.
  useEffect(() => {
    try { setBody(localStorage.getItem(brouillonCle(conv)) ?? ""); } catch { setBody(""); }
    setPending([]);
  }, [conv]);
  useEffect(() => {
    try { if (body.trim()) localStorage.setItem(brouillonCle(conv), body); else localStorage.removeItem(brouillonCle(conv)); } catch { /* navigation privée */ }
  }, [body, conv]);

  // Les conversations : le coach toujours, puis les amis (et quiconque nous a écrit).
  const visibles = msgs.filter((m) => !m.deleted);
  const nomDe = (id: string) => amis.find((a) => a.id === id)?.nom ?? visibles.find((m) => m.avec === id && m.avecNom)?.avecNom ?? d["ami"];
  const conversations = useMemo(() => {
    const ids = new Set<string>([COACH, ...amis.map((a) => a.id), ...visibles.map((m) => m.avec ?? COACH)]);
    return [...ids].map((id) => {
      const fil = visibles.filter((m) => (m.avec ?? COACH) === id).sort((a, b) => a.ts.localeCompare(b.ts));
      return { id, nom: id === COACH ? d["coachYou"] : nomDe(id), dernier: fil.at(-1) ?? null };
    })
      .filter((c) => !query.trim() || c.nom.toLowerCase().includes(query.trim().toLowerCase())
        || visibles.some((m) => (m.avec ?? COACH) === c.id && m.body.toLowerCase().includes(query.trim().toLowerCase())))
      // Le coach épinglé en tête ; les autres, la conversation la plus récente d'abord.
      .sort((a, b) => Number(b.id === COACH) - Number(a.id === COACH) || (b.dernier?.ts ?? "").localeCompare(a.dernier?.ts ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, amis, query, lang]);

  const fil = visibles.filter((m) => (m.avec ?? COACH) === conv).sort((a, b) => a.ts.localeCompare(b.ts));
  // Le fil s'ouvre en bas, sur le dernier message — comme toute messagerie.
  useEffect(() => { filRef.current?.scrollTo({ top: filRef.current.scrollHeight }); }, [conv, fil.length, ouverte]);

  const ouvrir = (id: string) => { setAQui(id === COACH ? "" : id); setOuverte(true); setTimeout(() => saisieRef.current?.focus(), 50); };

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
    const texte = body;
    try {
      // Pas d'objet à remplir : la route le déduit du texte pour l'e-mail du coach.
      const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "", body: texte, attachments: pending, to: aQui || undefined }) });
      const j = await r.json();
      if (j.ok) {
        const id = j.id || `tmp-${Date.now()}`;
        setMsgs((m) => [...m, { id, from: "client", subject: "", body: texte, ts: new Date().toISOString(), attachments: pending, deleted: false, avec: conv, avecNom: aQui ? amis.find((a) => a.id === aQui)?.nom : undefined }]);
        setBody(""); setPending([]);
        try { localStorage.removeItem(brouillonCle(conv)); } catch { /* */ }
      } else toast.error(j.error || d["t.fail"]);
    } catch { toast.error(d["t.sendErr"]); }
    finally { setSending(false); }
  };

  const restore = async (id: string) => {
    setMsgs((m) => m.map((x) => x.id === id ? { ...x, deleted: false } : x));
    try { await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", id }) }); } catch { /* */ }
  };
  const softDelete = async (id: string) => {
    setMsgs((m) => m.map((x) => x.id === id ? { ...x, deleted: true } : x));
    toast(d["supprime"], { action: { label: d["annuler"], onClick: () => { void restore(id); } } });
    try { await fetch(`/api/messages?id=${id}`, { method: "DELETE" }); } catch { /* */ }
  };

  const libelleJour = (ts: string) => {
    const j = jourDe(ts), auj = jourDe(new Date().toISOString());
    const hier = jourDe(new Date(Date.now() - 864e5).toISOString());
    if (j === auj) return d["aujourdhui"];
    if (j === hier) return d["hier"];
    return new Date(ts).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
  };
  const heure = (ts: string) => new Date(ts).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  const nomConv = aQui ? (amis.find((a) => a.id === aQui)?.nom ?? nomDe(aQui)) : d["coachYou"];
  const TEMPLATES = [1, 2, 3, 4].map((n) => ({ label: d[`tp${n}.l`], body: d[`tp${n}.b`] }));
  const mailto = `mailto:${EDITEUR.email}?subject=${encodeURIComponent("Pacevo — ")}`;

  return (
    <div className="flex h-full min-h-[520px] overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      {/* ░░ Conversations ░░ */}
      <aside className={`${ouverte ? "hidden" : "flex"} w-full flex-shrink-0 flex-col border-r border-zinc-100 md:flex md:w-80`}>
        <div className="px-4 pb-2 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={d["searchPh"]} aria-label={d["searchPh"]}
              className="h-10 w-full rounded-full bg-zinc-100 pl-9 pr-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500/30" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {conversations.map((c) => {
            const active = conv === c.id && ouverte;
            const moiDernier = c.dernier?.from === "client";
            return (
              <Fragment key={c.id}>
                {c.id !== COACH && conversations.findIndex((x) => x.id !== COACH) === conversations.indexOf(c) && (
                  <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d["amis"]}</div>
                )}
                <button onClick={() => ouvrir(c.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${active || (conv === c.id && !ouverte) ? "bg-zinc-100 md:bg-zinc-100" : "hover:bg-zinc-50"}`}>
                  <Avatar coach={c.id === COACH} nom={c.nom} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-900">{c.nom}</span>
                      {c.dernier && <span className="flex-shrink-0 text-[11px] text-zinc-400">{timeAgo(c.dernier.ts, lang)}</span>}
                    </span>
                    <span className={`block truncate text-[13px] ${c.dernier && !moiDernier ? "font-medium text-zinc-700" : "text-zinc-500"}`}>
                      {c.dernier ? `${moiDernier ? `${d["toi"]} : ` : ""}${c.dernier.body || d["pj"]}` : c.id === COACH ? d["sla"] : ""}
                    </span>
                  </span>
                </button>
              </Fragment>
            );
          })}
          {amis.length === 0 && (
            <p className="mx-3 mt-4 rounded-2xl bg-zinc-50 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-500">{d["amisVides"]}</p>
          )}
        </div>
      </aside>

      {/* ░░ La conversation ░░ */}
      <section className={`${ouverte ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}>
        <header className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 sm:px-4">
          <button onClick={() => setOuverte(false)} aria-label={d["retour"]} className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 md:hidden">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Avatar coach={!aQui} nom={nomConv} petit />
          <div className="min-w-0 flex-1">
            {/* À QUI on écrit, toujours visible : un message ne part jamais chez un autre que prévu. */}
            <div className="truncate text-sm font-semibold text-zinc-900">{aQui ? (amis.find((a) => a.id === aQui)?.nom ?? nomDe(aQui)) : d["coachYou"]}</div>
            <div className="truncate text-xs text-zinc-500">{aQui ? d["ami"] : d["sla"]}</div>
          </div>
          {!aQui && (
            <a href={mailto} title={d["mailNote"]}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
              <Mail className="h-3.5 w-3.5" /><span className="hidden sm:inline">{d["mail"]}</span>
            </a>
          )}
        </header>

        <div ref={filRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-5">
          {fil.length === 0 ? (
            <div className="mx-auto mt-10 max-w-sm text-center">
              <div className="mx-auto mb-3 w-fit"><Avatar coach={!aQui} nom={nomConv} /></div>
              <p className="text-sm text-zinc-600">{aQui ? tr("vide.ami", { nom: nomConv }) : d["vide.coach"]}</p>
              {!aQui && <p className="mt-2 text-xs text-zinc-400">{d["mailNote"]}</p>}
            </div>
          ) : fil.map((m, i) => {
            const moi = m.from === "client";
            const nouveauJour = i === 0 || jourDe(fil[i - 1].ts) !== jourDe(m.ts);
            return (
              <Fragment key={m.id}>
                {nouveauJour && <div className="py-3 text-center text-[11px] font-medium text-zinc-400">{libelleJour(m.ts)}</div>}
                <div className={`group flex items-end gap-2 ${moi ? "justify-end" : "justify-start"}`}>
                  {moi && (
                    <button onClick={() => softDelete(m.id)} aria-label={d["suppr"]} title={d["suppr"]}
                      className="mb-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className={`max-w-[78%] rounded-3xl px-4 py-2 text-[15px] leading-relaxed ${moi ? "rounded-br-lg bg-emerald-600 text-white" : "rounded-bl-lg bg-zinc-100 text-zinc-900"}`}>
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {m.attachments.map((a, k) => (
                          <a key={k} href={a.url} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-sm underline-offset-2 hover:underline ${moi ? "text-white" : "text-emerald-700"}`}>
                            <FileText className="h-4 w-4 flex-shrink-0" /><span className="max-w-[200px] truncate">{a.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    <div className={`mt-0.5 text-right text-[10px] ${moi ? "text-emerald-100" : "text-zinc-400"}`}>{heure(m.ts)}</div>
                  </div>
                  {!moi && (
                    <button onClick={() => softDelete(m.id)} aria-label={d["suppr"]} title={d["suppr"]}
                      className="mb-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>

        {/* Suggestions au coach, tant que le champ est vide. */}
        {!aQui && !body.trim() && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-4" aria-label={d["suggestions"]}>
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" onClick={() => { setBody(t.body); saisieRef.current?.focus(); }}
                className="flex-shrink-0 whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50">
                {t.label}
              </button>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pb-2 sm:px-4">
            {pending.map((a, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                <FileText className="h-3.5 w-3.5" /><span className="max-w-[160px] truncate">{a.name}</span>
                <button onClick={() => setPending((p) => p.filter((_, k) => k !== i))} aria-label={d["suppr"]}><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); void doSend(); }} className="flex items-end gap-2 border-t border-zinc-100 px-3 py-3 sm:px-4">
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label={d["joindre"]} title={d["joindre"]}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-50">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </button>
          <textarea ref={saisieRef} value={body} rows={1} placeholder={d["ecrire"]} aria-label={d["ecrire"]}
            onChange={(e) => { setBody(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
            // Entrée envoie, Maj+Entrée va à la ligne — comme dans toute messagerie.
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void doSend(); } }}
            className="max-h-40 min-h-[40px] flex-1 resize-none rounded-3xl border border-zinc-200 bg-white px-4 py-2 text-[15px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20" />
          <button type="submit" disabled={sending || (!body.trim() && pending.length === 0)} aria-label={d["envoyer"]}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </section>
    </div>
  );
}
