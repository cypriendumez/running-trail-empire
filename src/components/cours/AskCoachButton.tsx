"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Envoie une question pré-remplie au chat du coach (CoursChat écoute « cours:ask »)
// et remonte jusqu'au chat pour voir la réponse arriver.
// `label` est OBLIGATOIRE : il portait une valeur par défaut française (« Approfondir
// avec le coach ») que PERSONNE n'utilisait — les deux appelants passaient déjà leur
// libellé traduit. Un défaut jamais atteint ne protège de rien ; exigé par le type, il
// rend impossible d'afficher ce bouton sans traduction.
export function AskCoachButton({ question, label }: { question: string; label: string }) {
  const { t } = useT();
  const ask = () => {
    document.getElementById("cours-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent("cours:ask", { detail: question }));
  };
  return (
    <button
      onClick={ask}
      title={t("cours.deepenTitle")}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition-all hover:border-emerald-300 hover:text-emerald-700"
    >
      <MessageCircleQuestion className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
