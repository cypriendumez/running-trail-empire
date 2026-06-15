"use client";

import { MessageCircleQuestion } from "lucide-react";

// Envoie une question pré-remplie au chat du coach (CoursChat écoute « cours:ask »)
// et remonte jusqu'au chat pour voir la réponse arriver.
export function AskCoachButton({ question, label = "Approfondir avec le coach" }: { question: string; label?: string }) {
  const ask = () => {
    document.getElementById("cours-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent("cours:ask", { detail: question }));
  };
  return (
    <button
      onClick={ask}
      title="Le coach IA approfondit ce chapitre avec TES données"
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition-all hover:border-emerald-300 hover:text-emerald-700"
    >
      <MessageCircleQuestion className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
