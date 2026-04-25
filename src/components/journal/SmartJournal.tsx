"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = any;

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Sparkles, Brain, Flame, Zap, Frown, Meh, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface JournalEntry {
  id: string;
  entry_date: string;
  raw_text: string;
  mental_fatigue: number;
  motivation_score: number;
  stress_level: number;
  sentiment: "positive" | "neutral" | "negative";
  keywords: string[];
  ai_insights: string;
}

const GEMINI_ANALYZE_URL = "/api/ai/journal-analyze";

export function SmartJournal() {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Partial<JournalEntry> | null>(null);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"write" | "history">("write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recognition, setRecognition] = useState<any | null>(null);

  function startRecording() {
    const w = window as AnyWindow;
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Reconnaissance vocale non supportée sur ce navigateur.");
      return;
    }
    const SpeechRecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    const rec = new SpeechRecognitionAPI();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join(" ");
      setText(transcript);
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
    setRecognition(rec);
    setIsRecording(true);
  }

  function stopRecording() {
    recognition?.stop();
    setIsRecording(false);
  }

  async function analyzeEntry() {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const res = await fetch(GEMINI_ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function saveEntry() {
    if (!text.trim() || !analysis) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("journal_entries").insert({
      user_id: user.id,
      raw_text: text,
      mental_fatigue: analysis.mental_fatigue ?? 5,
      motivation_score: analysis.motivation_score ?? 5,
      stress_level: analysis.stress_level ?? 5,
      sentiment: analysis.sentiment ?? "neutral",
      keywords: analysis.keywords ?? [],
      ai_insights: analysis.ai_insights ?? "",
    });

    setSaved(true);
    setText("");
    setAnalysis(null);
    setTimeout(() => setSaved(false), 3000);
  }

  async function loadHistory() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("entry_date", { ascending: false })
      .limit(20);
    setEntries((data as JournalEntry[]) ?? []);
    setActiveTab("history");
  }

  const sentimentConfig = {
    positive: { icon: Smile, color: "text-green-600", bg: "bg-green-50", label: "Positif" },
    neutral: { icon: Meh, color: "text-blue-600", bg: "bg-blue-50", label: "Neutre" },
    negative: { icon: Frown, color: "text-orange-600", bg: "bg-orange-50", label: "Négatif" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Smart Journal</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Analyse NLP de votre état mental · Détection de fatigue psychologique
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("write")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "write" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Écrire
          </button>
          <button
            onClick={loadHistory}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "history" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Historique
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "write" && (
          <motion.div key="write" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Input area */}
            <div className="bg-white rounded-2xl border-2 border-zinc-200 focus-within:border-zinc-400 transition-all overflow-hidden">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Comment s'est passée votre séance ? Comment vous sentez-vous mentalement et physiquement ? Parlez librement…"
                rows={6}
                className="w-full px-5 pt-5 pb-3 text-zinc-800 text-sm leading-relaxed resize-none focus:outline-none placeholder:text-zinc-400"
              />
              <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isRecording
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isRecording ? "Arrêter" : "Vocal"}
                  </button>
                  <span className="text-xs text-zinc-400">{text.length} caractères</span>
                </div>
                <button
                  onClick={analyzeEntry}
                  disabled={!text.trim() || isAnalyzing}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? "Analyse en cours…" : "Analyser"}
                </button>
              </div>
            </div>

            {/* Analysis result */}
            <AnimatePresence>
              {analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-zinc-200 overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-500" />
                      <span className="text-sm font-semibold text-zinc-700">Analyse NLP</span>
                    </div>
                    {analysis.sentiment && (() => {
                      const cfg = sentimentConfig[analysis.sentiment];
                      const Icon = cfg.icon;
                      return (
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="p-6 grid grid-cols-3 gap-4 border-b border-zinc-100">
                    <ScoreBar label="Fatigue mentale" value={analysis.mental_fatigue ?? 0} icon={<Brain className="w-4 h-4" />} invertColor />
                    <ScoreBar label="Motivation" value={analysis.motivation_score ?? 0} icon={<Flame className="w-4 h-4" />} />
                    <ScoreBar label="Stress" value={analysis.stress_level ?? 0} icon={<Zap className="w-4 h-4" />} invertColor />
                  </div>

                  {analysis.keywords && analysis.keywords.length > 0 && (
                    <div className="px-6 py-4 border-b border-zinc-100">
                      <div className="text-xs text-zinc-500 mb-2">Mots-clés détectés</div>
                      <div className="flex flex-wrap gap-2">
                        {analysis.keywords.map((kw) => (
                          <span key={kw} className="text-xs px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.ai_insights && (
                    <div className="px-6 py-4 border-b border-zinc-100">
                      <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Insights IA
                      </div>
                      <p className="text-sm text-zinc-700 leading-relaxed">{analysis.ai_insights}</p>
                    </div>
                  )}

                  <div className="px-6 py-4 flex justify-end">
                    <button
                      onClick={saveEntry}
                      className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      {saved ? "Sauvegardé ✓" : "Sauvegarder l'entrée"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {entries.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">Aucune entrée pour le moment</div>
            ) : (
              entries.map((entry) => {
                const cfg = sentimentConfig[entry.sentiment ?? "neutral"];
                const Icon = cfg.icon;
                return (
                  <div key={entry.id} className="bg-white rounded-2xl border border-zinc-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-700">
                          {new Date(entry.entry_date).toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 mb-3 line-clamp-2">{entry.raw_text}</p>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span>💪 Motivation {entry.motivation_score}/10</span>
                      <span>🧠 Fatigue {entry.mental_fatigue}/10</span>
                      <span>⚡ Stress {entry.stress_level}/10</span>
                    </div>
                    {entry.ai_insights && (
                      <p className="mt-3 text-xs text-zinc-500 italic border-t border-zinc-100 pt-3">{entry.ai_insights}</p>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreBar({ label, value, icon, invertColor = false }: {
  label: string; value: number; icon: React.ReactNode; invertColor?: boolean;
}) {
  const pct = (value / 10) * 100;
  const color = invertColor
    ? value > 7 ? "bg-red-500" : value > 4 ? "bg-orange-400" : "bg-green-500"
    : value > 7 ? "bg-green-500" : value > 4 ? "bg-blue-400" : "bg-zinc-300";

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-zinc-600">
        {icon}
        {label}
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-1">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="text-right text-xs font-bold text-zinc-700">{value}/10</div>
    </div>
  );
}
