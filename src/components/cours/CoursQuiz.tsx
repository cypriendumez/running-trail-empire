"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Trophy, ArrowRight, MessageCircleQuestion, Zap, BookOpen } from "lucide-react";
import type { QuizQuestion, CoursUI } from "@/data/cours/types";

const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));

const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
// Mélange aussi l'ordre des réponses (en suivant l'index de la bonne).
const shuffleOptions = (q: QuizQuestion): QuizQuestion => {
  const order = shuffle([0, 1, 2]);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
};

type Mode = "express" | "complet";

// Quiz du coureur — banque complète, 2 modes, record sauvegardé, badge, flashcards.
export function CoursQuiz({ bank, ui }: { bank: QuizQuestion[]; ui: CoursUI["quiz"] }) {
  const [phase, setPhase] = useState<"start" | "play" | "done">("start");
  const [mode, setMode] = useState<Mode>("express");
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<QuizQuestion[]>([]);
  const [best, setBest] = useState<Record<Mode, number | null>>({ express: null, complet: null });
  const [newRecord, setNewRecord] = useState(false);
  const [badge, setBadge] = useState(false);

  useEffect(() => {
    try {
      setBest({
        express: localStorage.getItem("cours-quiz-best-express") ? Number(localStorage.getItem("cours-quiz-best-express")) : null,
        complet: localStorage.getItem("cours-quiz-best-complet") ? Number(localStorage.getItem("cours-quiz-best-complet")) : null,
      });
    } catch { /* localStorage indisponible */ }
  }, []);

  // Les questions ratées alimentent le deck de flashcards (révision espacée).
  const addToFlashDeck = (q: QuizQuestion) => {
    try {
      const deck = JSON.parse(localStorage.getItem("cours-flash-deck") ?? "[]") as { q: string }[];
      if (!deck.some((c) => c.q === q.q)) {
        deck.push({ q: q.q, a: q.options[q.answer], explain: q.explain, chapitre: q.chapitre, anchor: q.anchor, streak: 0 } as never);
        localStorage.setItem("cours-flash-deck", JSON.stringify(deck));
        window.dispatchEvent(new Event("cours:flash-update"));
      }
    } catch { /* ignore */ }
  };

  const start = (m: Mode) => {
    const drawn = shuffle(bank).slice(0, m === "express" ? 10 : bank.length).map(shuffleOptions);
    setMode(m); setQs(drawn); setIdx(0); setPicked(null); setScore(0); setWrong([]); setNewRecord(false); setBadge(false);
    setPhase("play");
  };

  const q = qs[idx];
  const pick = (i: number) => {
    if (picked != null || !q) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
    else { setWrong((w) => [...w, q]); addToFlashDeck(q); }
  };

  const next = () => {
    if (idx + 1 >= qs.length) {
      const final = score;
      try {
        const key = `cours-quiz-best-${mode}`;
        const prev = localStorage.getItem(key) ? Number(localStorage.getItem(key)) : null;
        if (prev == null || final > prev) { localStorage.setItem(key, String(final)); setNewRecord(true); setBest((b) => ({ ...b, [mode]: final })); }
      } catch { /* ignore */ }
      // 🏅 Badge « Expert du cours » : mode Complet réussi à ≥ 90 %.
      if (mode === "complet" && final / qs.length >= 0.9) {
        setBadge(true);
        fetch("/api/cours/badge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: final, total: qs.length }) }).catch(() => {});
      }
      setPhase("done");
      return;
    }
    setIdx(idx + 1); setPicked(null);
  };

  const askCoach = (question: QuizQuestion) => {
    document.getElementById("cours-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent("cours:ask", { detail: `${question.q} → « ${question.options[question.answer]} »` }));
  };

  const pct = qs.length ? Math.round((score / qs.length) * 100) : 0;
  const verdict = pct >= 90 ? ui.verdicts.coach : pct >= 70 ? ui.verdicts.solid : pct >= 50 ? ui.verdicts.good : ui.verdicts.learn;
  const wrongChapters = [...new Map(wrong.map((w) => [w.anchor, w.chapitre])).entries()];

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="relative overflow-hidden px-5 py-4 text-white" style={{ background: "linear-gradient(135deg,#18181b 0%,#27272a 60%,#064e3b 100%)" }}>
        <div className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Trophy className="h-5 w-5 text-amber-300" /></span>
            <div>
              <h3 className="font-bold leading-tight">{ui.title}</h3>
              <p className="text-[13px] text-white/75">{fill(ui.sub, { n: bank.length })}</p>
            </div>
          </div>
          {phase === "play" && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums ring-1 ring-white/15">{idx + 1} / {qs.length}</span>}
        </div>
      </div>

      <div className="p-5">
        {phase === "start" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => start("express")}
              className="group rounded-2xl border border-zinc-200 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50"><Zap className="h-4 w-4 text-emerald-600" /></span>
                {best.express != null && <span className="text-xs font-bold text-zinc-400">{fill(ui.record, { score: best.express, total: 10 })}</span>}
              </div>
              <div className="mt-3 font-bold text-zinc-900">{ui.express}</div>
              <p className="mt-0.5 text-xs text-zinc-500">{ui.expressSub}</p>
            </button>
            <button onClick={() => start("complet")}
              className="group rounded-2xl border border-zinc-200 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50"><BookOpen className="h-4 w-4 text-amber-600" /></span>
                {best.complet != null && <span className="text-xs font-bold text-zinc-400">{fill(ui.record, { score: best.complet, total: bank.length })}</span>}
              </div>
              <div className="mt-3 font-bold text-zinc-900">{ui.complet}</div>
              <p className="mt-0.5 text-xs text-zinc-500">{fill(ui.completSub, { n: bank.length })}</p>
            </button>
          </div>
        )}

        {phase === "play" && q && (
          <>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${((idx + (picked != null ? 1 : 0)) / qs.length) * 100}%` }} />
            </div>
            <p className="font-semibold text-zinc-900">{q.q}</p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, i) => {
                const isAnswer = i === q.answer;
                const isPicked = picked === i;
                const state = picked == null ? "idle" : isAnswer ? "good" : isPicked ? "bad" : "dim";
                return (
                  <button key={i} onClick={() => pick(i)} disabled={picked != null}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      state === "idle" ? "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                      : state === "good" ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                      : state === "bad" ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-zinc-100 bg-zinc-50 text-zinc-400"
                    }`}>
                    {state === "good" ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      : state === "bad" ? <XCircle className="h-4 w-4 flex-shrink-0 text-rose-500" />
                      : <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[10px] font-bold text-zinc-400">{String.fromCharCode(65 + i)}</span>}
                    {opt}
                  </button>
                );
              })}
            </div>
            {picked != null && (
              <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                <b className={picked === q.answer ? "text-emerald-700" : "text-rose-600"}>{picked === q.answer ? ui.exact : ui.wrong}</b>{" "}
                {q.explain} <a href={`#${q.anchor}`} className="text-zinc-400 underline-offset-2 hover:text-emerald-700 hover:underline">— {q.chapitre}</a>
              </div>
            )}
            {picked != null && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
                  {idx + 1 >= qs.length ? ui.seeScore : ui.next} <ArrowRight className="h-4 w-4" />
                </button>
                {picked !== q.answer && (
                  <button onClick={() => askCoach(q)} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                    <MessageCircleQuestion className="h-4 w-4" /> {ui.askCoach}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {phase === "done" && (
          <div className="py-2 text-center">
            <div className="text-5xl font-black tabular-nums text-zinc-900">{score}<span className="text-2xl text-zinc-300"> / {qs.length}</span></div>
            <p className="mt-2 font-semibold text-zinc-700">{verdict}</p>
            {newRecord && <p className="mt-1 text-sm font-bold text-amber-600">{ui.newRecord}</p>}
            {badge && (
              <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 ring-1 ring-amber-200">
                {ui.badgeUnlocked} {ui.badgeName}
              </div>
            )}
            {wrongChapters.length > 0 && (
              <div className="mx-auto mt-4 max-w-md">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{ui.toReview}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {wrongChapters.map(([anchor, title]) => (
                    <a key={anchor} href={`#${anchor}`} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                      {title}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={() => start(mode)} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
                <RotateCcw className="h-4 w-4" /> {ui.replay} ({mode === "express" ? ui.express : ui.complet})
              </button>
              <button onClick={() => setPhase("start")} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50">
                {ui.changeMode}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
