"use client";

import { LanguageProvider, useT } from "@/lib/i18n/LanguageProvider";
import { SmartJournal } from "@/components/journal/SmartJournal";

// Route de prévisualisation (non gardée) pour vérifier l'i18n du Smart Journal.
// Bloquée à l'indexation via robots.txt (/preview-*).
function LangSwitcher() {
  const { lang, setLang } = useT();
  const langs: Array<"fr" | "en" | "de" | "es" | "pt"> = ["fr", "en", "de", "es", "pt"];
  return (
    <div className="flex gap-2 mb-6">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold uppercase ${
            lang === l ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export default function P() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <LanguageProvider initialLang="en">
        <LangSwitcher />
        <SmartJournal />
      </LanguageProvider>
    </div>
  );
}
