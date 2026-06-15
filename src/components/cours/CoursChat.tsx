"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageProvider";

type Msg = { role: "user" | "model"; text: string };

// Dictionnaire local 5 langues (UI du chat — le contenu des réponses vient de l'IA dans la langue de la question).
const D: Record<string, { title: string; sub: string; hint: string; ph: string; thinking: string; errReply: string; errConn: string; sug: string[] }> = {
  fr: {
    title: "Pose ta question au coach IA", sub: "Une réponse claire, pour tous les niveaux — même grand débutant.",
    hint: "Choisis une question ou écris la tienne 👇", ph: "Écris ta question… (ex : comment gérer une côte ?)",
    thinking: "Le coach réfléchit…", errReply: "Désolé, je n'ai pas pu répondre. Réessaie dans un instant 🙏", errConn: "Connexion impossible pour le moment.",
    sug: ["C'est quoi la VMA, simplement ?", "Combien de fois courir par semaine pour débuter ?", "Que manger avant et pendant une course longue ?", "Comment choisir mes chaussures de running ?", "Pourquoi courir lentement me fait progresser ?", "Comment préparer mon premier trail ?"],
  },
  en: {
    title: "Ask the AI coach", sub: "A clear answer, for every level — even complete beginners.",
    hint: "Pick a question or write your own 👇", ph: "Type your question… (e.g. how do I handle hills?)",
    thinking: "The coach is thinking…", errReply: "Sorry, I couldn't answer. Try again in a moment 🙏", errConn: "Connection unavailable right now.",
    sug: ["What is MAS (VMA), simply?", "How many runs per week to get started?", "What should I eat before and during a long race?", "How do I choose my running shoes?", "Why does running slow make me faster?", "How do I prepare my first trail race?"],
  },
  de: {
    title: "Frag den KI-Coach", sub: "Eine klare Antwort, für jedes Niveau — auch für absolute Anfänger.",
    hint: "Wähle eine Frage oder schreibe deine eigene 👇", ph: "Schreibe deine Frage… (z. B. wie laufe ich Anstiege?)",
    thinking: "Der Coach überlegt…", errReply: "Entschuldige, ich konnte nicht antworten. Versuch es gleich nochmal 🙏", errConn: "Verbindung derzeit nicht möglich.",
    sug: ["Was ist die vVO2max (MAS), einfach erklärt?", "Wie oft pro Woche laufen für den Einstieg?", "Was essen vor und während eines langen Laufs?", "Wie wähle ich meine Laufschuhe?", "Warum macht langsames Laufen mich schneller?", "Wie bereite ich meinen ersten Trail vor?"],
  },
  es: {
    title: "Pregunta al coach IA", sub: "Una respuesta clara, para todos los niveles — incluso principiantes.",
    hint: "Elige una pregunta o escribe la tuya 👇", ph: "Escribe tu pregunta… (ej.: ¿cómo gestiono una cuesta?)",
    thinking: "El coach está pensando…", errReply: "Lo siento, no pude responder. Inténtalo de nuevo en un momento 🙏", errConn: "Conexión no disponible ahora mismo.",
    sug: ["¿Qué es la VAM, explicado simple?", "¿Cuántas veces correr por semana para empezar?", "¿Qué comer antes y durante una carrera larga?", "¿Cómo elegir mis zapatillas de running?", "¿Por qué correr despacio me hace progresar?", "¿Cómo preparar mi primer trail?"],
  },
  pt: {
    title: "Pergunta ao coach IA", sub: "Uma resposta clara, para todos os níveis — mesmo principiantes.",
    hint: "Escolhe uma pergunta ou escreve a tua 👇", ph: "Escreve a tua pergunta… (ex.: como gerir uma subida?)",
    thinking: "O coach está a pensar…", errReply: "Desculpa, não consegui responder. Tenta novamente daqui a pouco 🙏", errConn: "Ligação indisponível de momento.",
    sug: ["O que é a VAM, explicado de forma simples?", "Quantas vezes correr por semana para começar?", "O que comer antes e durante uma prova longa?", "Como escolher as minhas sapatilhas de corrida?", "Porque é que correr devagar me faz progredir?", "Como preparar o meu primeiro trail?"],
  },
};

export function CoursChat() {
  const { lang } = useT();
  const d = D[lang] ?? D.fr;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  // Les boutons « Approfondir avec le coach » (chapitres) envoient leur question ici.
  const sendRef = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = String((e as CustomEvent).detail ?? "").trim();
      if (q) sendRef.current(q);
    };
    window.addEventListener("cours:ask", onAsk);
    return () => window.removeEventListener("cours:ask", onAsk);
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/ai/cours", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history: messages }),
      });
      const j = await r.json();
      if (j.error) { toast.error(j.error); setMessages((m) => [...m, { role: "model", text: d.errReply }]); }
      else setMessages((m) => [...m, { role: "model", text: j.reply }]);
    } catch {
      toast.error("Connexion impossible");
      setMessages((m) => [...m, { role: "model", text: d.errConn }]);
    } finally { setLoading(false); }
  };
  sendRef.current = send;

  return (
    <div id="cours-chat" className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm scroll-mt-24">
      {/* En-tête */}
      <div className="relative overflow-hidden px-5 py-4 text-white" style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 50%,#0d9488 100%)" }}>
        <div className="pointer-events-none absolute -top-12 -right-8 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
            <GraduationCap className="h-5 w-5 text-amber-200" />
          </span>
          <div>
            <h3 className="font-bold leading-tight">{d.title}</h3>
            <p className="text-[13px] text-white/80">{d.sub}</p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="max-h-[26rem] overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="py-2">
            <p className="mb-2.5 text-center text-sm text-zinc-400">{d.hint}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {d.sug.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === "user" ? "bg-emerald-600 text-white rounded-br-md" : "bg-zinc-100 text-zinc-800 rounded-bl-md"
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-emerald-500" /> {d.thinking}
            </div>
          </div>
        )}
      </div>

      {/* Saisie */}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-zinc-100 p-3">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={d.ph}
          className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
