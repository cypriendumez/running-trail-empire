"use client";

import { useState } from "react";
import { Mail, Check, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Formulaire d'inscription à la newsletter. Variante "dark" pour le footer sombre.
export function NewsletterSignup({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading"); setMsg("");
    try {
      const r = await fetch("/api/newsletter/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (j.ok) { setState("done"); setEmail(""); }
      else { setState("error"); setMsg(j.error || "Inscription impossible"); }
    } catch { setState("error"); setMsg("Inscription impossible"); }
  }

  const dark = variant === "dark";
  if (state === "done") {
    return (
      <div className={`flex items-center gap-2 text-sm font-medium ${dark ? "text-emerald-300" : "text-emerald-700"}`}>
        <Check className="h-4 w-4" /> {t("news.confirmed")}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? "text-zinc-500" : "text-zinc-300"}`} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder={t("news.emailPh")}
            className={`w-full rounded-xl border px-3 py-2.5 pl-9 text-sm outline-none transition-colors ${
              dark
                ? "border-white/15 bg-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-400 focus:bg-white/15"
                : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            }`} />
        </div>
        <button type="submit" disabled={state === "loading"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} S&apos;abonner
        </button>
      </div>
      {state === "error" && <p className={`mt-1.5 text-xs ${dark ? "text-red-300" : "text-red-500"}`}>{msg}</p>}
    </form>
  );
}
