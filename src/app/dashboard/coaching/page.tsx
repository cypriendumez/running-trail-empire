"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, Mic, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  "Que dois-je faire aujourd'hui selon ma VFC ?",
  "Crée-moi un plan de 10 semaines pour un trail 50km",
  "Comment améliorer ma cadence ?",
  "Stratégie nutrition pour un marathon",
  "Mon genou me fait mal, que faire ?",
  "Analyse mes 3 dernières séances",
];

export default function CoachingPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Bonjour ! Je suis votre coach IA Running & Trail Empire. Je peux analyser vos données d'entraînement, créer des plans personnalisés, répondre à vos questions sur la biomécanique, la nutrition ou la récupération. Comment puis-je vous aider aujourd'hui ?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json() as { reply: string };
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply ?? "Désolé, je n'ai pas pu traiter votre demande.",
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Erreur de connexion. Vérifiez votre clé OpenAI dans .env.local",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="bento-card mb-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-zinc-900">Coaching IA</h2>
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-slow" />
            En ligne · Personnalisé sur votre profil
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 flex-wrap mb-4">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => sendMessage(p)}
            className="text-xs px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            {p}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant" ? "bg-zinc-900" : "bg-green-500"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-4 h-4 text-white" /> : <span className="text-white text-xs font-bold">Toi</span>}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white rounded-tr-sm"
                  : "bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm shadow-card"
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div className={`text-xs mt-1.5 ${msg.role === "user" ? "text-zinc-400" : "text-zinc-400"}`}>
                  {msg.timestamp.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 bg-white border border-zinc-100 rounded-2xl rounded-tl-sm shadow-card">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-white border border-zinc-200 rounded-2xl focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Posez votre question à votre coach IA..."
            className="flex-1 bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 outline-none"
          />
          <button className="text-zinc-400 hover:text-zinc-600">
            <Mic className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          className="btn-brand px-4 py-3 rounded-2xl disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
