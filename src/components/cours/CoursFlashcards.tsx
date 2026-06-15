"use client";

import { useEffect, useState } from "react";
import { Layers, Eye, Check, RotateCcw, Trash2 } from "lucide-react";
import type { CoursUI } from "@/data/cours/types";

type Card = { q: string; a: string; explain: string; chapitre: string; anchor: string; streak: number };

const KEY = "cours-flash-deck";
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));

// Flashcards façon Leitner (léger) : les questions ratées au quiz reviennent ici.
// « Je savais » 2 fois d'affilée → la carte sort du deck. « À revoir » → retour en fin de pile.
export function CoursFlashcards({ ui }: { ui: CoursUI["flash"] }) {
  const [deck, setDeck] = useState<Card[]>([]);
  const [revealed, setRevealed] = useState(false);

  const load = () => {
    try { setDeck(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { setDeck([]); }
  };
  useEffect(() => {
    load();
    window.addEventListener("cours:flash-update", load);
    return () => window.removeEventListener("cours:flash-update", load);
  }, []);

  const save = (d: Card[]) => { setDeck(d); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } };

  const card = deck[0];
  const knew = () => {
    if (!card) return;
    const c = { ...card, streak: card.streak + 1 };
    // 2 bonnes réponses d'affilée → acquise, elle sort du deck.
    save(c.streak >= 2 ? deck.slice(1) : [...deck.slice(1), c]);
    setRevealed(false);
  };
  const review = () => {
    if (!card) return;
    save([...deck.slice(1), { ...card, streak: 0 }]); // retour en fin de pile
    setRevealed(false);
  };
  const reset = () => { save([]); setRevealed(false); };

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50"><Layers className="h-5 w-5 text-violet-600" /></span>
          <div>
            <h3 className="font-bold leading-tight text-zinc-900">{ui.title}</h3>
            <p className="text-[13px] text-zinc-500">{ui.sub}</p>
          </div>
        </div>
        {deck.length > 0 && (
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold tabular-nums text-violet-700">{fill(ui.remaining, { n: deck.length })}</span>
        )}
      </div>

      <div className="p-5">
        {deck.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">{ui.empty}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                <a href={`#${card.anchor}`} className="hover:text-violet-600">{card.chapitre}</a>
              </p>
              <p className="mt-1.5 font-semibold text-zinc-900">{card.q}</p>
              {revealed && (
                <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-violet-100">
                  <p className="font-semibold text-violet-800">{card.a}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{card.explain}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {!revealed ? (
                <button onClick={() => setRevealed(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
                  <Eye className="h-4 w-4" /> {ui.show}
                </button>
              ) : (
                <>
                  <button onClick={knew}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                    <Check className="h-4 w-4" /> {ui.knew}
                  </button>
                  <button onClick={review}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:border-amber-300 hover:text-amber-700">
                    <RotateCcw className="h-4 w-4" /> {ui.review}
                  </button>
                </>
              )}
              <button onClick={reset} title={ui.reset}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> {ui.reset}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
