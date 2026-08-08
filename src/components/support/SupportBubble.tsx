"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  BULLE D'AIDE — accessible depuis toutes les pages du tableau de bord.
//
//  Volontairement flottante plutôt qu'une page « Aide » dans le menu : une question de
//  support naît DEVANT l'écran qui pose problème. Obliger à quitter cet écran pour aller
//  chercher l'aide, c'est perdre le contexte et la moitié des gens en route.
//
//  Aucun calcul ici : la route /api/ai/support ancre les réponses sur la carte réelle du
//  site et sur l'état du compte. Le composant n'affiche que ce qu'elle renvoie.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LifeBuoy, X, Send, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

type Msg = { role: "user" | "model"; text: string };

const T: Record<string, Record<string, string>> = {
  fr: { title: "Aide", sub: "Une question sur l'app ? Je regarde ton compte.", ph: "Ex : mes séances n'arrivent pas sur ma montre",
    seed: "Salut 👋 Pose-moi n'importe quelle question sur Pacevo — comment ça marche, ou ce qui ne marche pas. Je regarde l'état réel de ton compte pour te répondre.",
    s1: "Mes séances n'arrivent pas sur ma montre", s2: "Pourquoi aucun fractionné cette semaine ?", s3: "Comment fixer mon objectif de course ?",
    err: "Connexion impossible. Réessaie dans un instant.", open: "Ouvrir l'aide", close: "Fermer l'aide" },
  en: { title: "Help", sub: "A question about the app? I check your account.", ph: "E.g. my sessions don't reach my watch",
    seed: "Hi 👋 Ask me anything about Pacevo — how it works, or what isn't working. I look at your actual account state to answer.",
    s1: "My sessions don't reach my watch", s2: "Why no intervals this week?", s3: "How do I set my race goal?",
    err: "Connection failed. Try again in a moment.", open: "Open help", close: "Close help" },
  de: { title: "Hilfe", sub: "Eine Frage zur App? Ich sehe mir dein Konto an.", ph: "Z. B. meine Einheiten kommen nicht auf die Uhr",
    seed: "Hallo 👋 Frag mich alles zu Pacevo — wie es funktioniert oder was nicht klappt. Ich schaue mir deinen tatsächlichen Kontostand an.",
    s1: "Meine Einheiten kommen nicht auf die Uhr", s2: "Warum diese Woche keine Intervalle?", s3: "Wie lege ich mein Wettkampfziel fest?",
    err: "Verbindung fehlgeschlagen. Bitte gleich nochmal versuchen.", open: "Hilfe öffnen", close: "Hilfe schließen" },
  es: { title: "Ayuda", sub: "¿Una duda sobre la app? Miro tu cuenta.", ph: "Ej.: mis sesiones no llegan al reloj",
    seed: "Hola 👋 Pregúntame lo que quieras sobre Pacevo — cómo funciona o qué no funciona. Miro el estado real de tu cuenta para responderte.",
    s1: "Mis sesiones no llegan al reloj", s2: "¿Por qué no hay series esta semana?", s3: "¿Cómo fijo mi objetivo de carrera?",
    err: "Conexión imposible. Inténtalo en un momento.", open: "Abrir la ayuda", close: "Cerrar la ayuda" },
  pt: { title: "Ajuda", sub: "Uma dúvida sobre a app? Vejo a tua conta.", ph: "Ex.: as minhas sessões não chegam ao relógio",
    seed: "Olá 👋 Pergunta-me o que quiseres sobre o Pacevo — como funciona ou o que não está a funcionar. Vejo o estado real da tua conta para responder.",
    s1: "As minhas sessões não chegam ao relógio", s2: "Porquê nenhuma série esta semana?", s3: "Como defino o meu objetivo de prova?",
    err: "Ligação impossível. Tenta daqui a pouco.", open: "Abrir a ajuda", close: "Fechar a ajuda" },
};

export function SupportBubble() {
  const { lang } = useT();
  const t = (k: string) => T[lang]?.[k] ?? T.fr[k] ?? k;

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Le message d'accueil suit la langue tant que la conversation n'a pas commencé.
  const shown: Msg[] = msgs.length ? msgs : [{ role: "model", text: t("seed") }];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = msgs;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/support", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, lang, history }),
      });
      const j = await res.json();
      setMsgs((m) => [...m, { role: "model", text: j.reply || `⚠️ ${j.error || t("err")}` }]);
    } catch {
      setMsgs((m) => [...m, { role: "model", text: `⚠️ ${t("err")}` }]);
    } finally { setBusy(false); }
  }, [msgs, busy, lang]);

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} aria-label={open ? t("close") : t("open")}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 active:scale-95">
        {open ? <X className="h-5 w-5" /> : <LifeBuoy className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-24 right-5 z-50 flex w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_60px_-15px_rgba(16,24,40,0.35)]"
            style={{ maxHeight: "min(600px, calc(100vh - 8rem))" }}>

            <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><LifeBuoy className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">{t("title")}</div>
                <div className="truncate text-xs text-zinc-400">{t("sub")}</div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {shown.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? "rounded-br-md bg-zinc-900 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-800"
                  }`}>{m.text}</div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              {/* Suggestions : uniquement au premier écran, pour amorcer sans encombrer. */}
              {msgs.length === 0 && !busy && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {["s1", "s2", "s3"].map((k) => (
                    <button key={k} onClick={() => send(t(k))}
                      className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800">
                      {t(k)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 border-t border-zinc-100 px-3 py-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} placeholder={t("ph")}
                className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30" />
              <button type="submit" disabled={busy || !input.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
