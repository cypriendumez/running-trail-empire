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
import { LifeBuoy, X, Send, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { RichText } from "@/components/ui/RichText";

type Msg = { role: "user" | "model"; text: string; source?: "base" | "memoire" };

const T: Record<string, Record<string, string>> = {
  fr: { title: "Aide", sub: "Une question sur l'app ? Je regarde ton compte.", ph: "Ex : mes séances n'arrivent pas sur ma montre",
    seed: "Salut ! Pose-moi n'importe quelle question sur Pacevo — comment ça marche, ou ce qui ne marche pas. Je regarde l'état réel de ton compte pour te répondre.",
    s1: "Mes séances n'arrivent pas sur ma montre", s2: "Pourquoi aucun fractionné cette semaine ?", s3: "Comment fixer mon objectif de course ?",
    err: "Connexion impossible. Réessaie dans un instant.",  instant: "Réponse instantanée", suggest: "Questions fréquentes", open: "Ouvrir l'aide", close: "Fermer l'aide" },
  en: { title: "Help", sub: "A question about the app? I check your account.", ph: "E.g. my sessions don't reach my watch",
    seed: "Hi! Ask me anything about Pacevo — how it works, or what isn't working. I look at your actual account state to answer.",
    s1: "My sessions don't reach my watch", s2: "Why no intervals this week?", s3: "How do I set my race goal?",
    err: "Connection failed. Try again in a moment.",  instant: "Instant answer", suggest: "Common questions", open: "Open help", close: "Close help" },
  de: { title: "Hilfe", sub: "Eine Frage zur App? Ich sehe mir dein Konto an.", ph: "Z. B. meine Einheiten kommen nicht auf die Uhr",
    seed: "Hallo! Frag mich alles zu Pacevo — wie es funktioniert oder was nicht klappt. Ich schaue mir deinen tatsächlichen Kontostand an.",
    s1: "Meine Einheiten kommen nicht auf die Uhr", s2: "Warum diese Woche keine Intervalle?", s3: "Wie lege ich mein Wettkampfziel fest?",
    err: "Verbindung fehlgeschlagen. Bitte gleich nochmal versuchen.",  instant: "Sofortantwort", suggest: "Häufige Fragen", open: "Hilfe öffnen", close: "Hilfe schließen" },
  es: { title: "Ayuda", sub: "¿Una duda sobre la app? Miro tu cuenta.", ph: "Ej.: mis sesiones no llegan al reloj",
    seed: "¡Hola! Pregúntame lo que quieras sobre Pacevo — cómo funciona o qué no funciona. Miro el estado real de tu cuenta para responderte.",
    s1: "Mis sesiones no llegan al reloj", s2: "¿Por qué no hay series esta semana?", s3: "¿Cómo fijo mi objetivo de carrera?",
    err: "Conexión imposible. Inténtalo en un momento.",  instant: "Respuesta instantánea", suggest: "Preguntas frecuentes", open: "Abrir la ayuda", close: "Cerrar la ayuda" },
  pt: { title: "Ajuda", sub: "Uma dúvida sobre a app? Vejo a tua conta.", ph: "Ex.: as minhas sessões não chegam ao relógio",
    seed: "Olá! Pergunta-me o que quiseres sobre o Pacevo — como funciona ou o que não está a funcionar. Vejo o estado real da tua conta para responder.",
    s1: "As minhas sessões não chegam ao relógio", s2: "Porquê nenhuma série esta semana?", s3: "Como defino o meu objetivo de prova?",
    err: "Ligação impossível. Tenta daqui a pouco.",  instant: "Resposta instantânea", suggest: "Perguntas frequentes", open: "Abrir a ajuda", close: "Fechar a ajuda" },
};

/**
 * Rend le **gras** que le modèle produit.
 *
 * ⚠️ LE COMPOSANT AFFICHAIT LES ASTÉRISQUES. Le prompt demande explicitement au modèle
 * de mettre en gras le nom des pages et des boutons — c'est ce qui rend un chemin de
 * clics lisible d'un coup d'œil. Faute de rendu, l'athlète lisait littéralement
 * « ouvre **Réglages** puis **Montre** », ce qui donne l'impression d'un texte brut
 * sorti d'une machine, et noie précisément le mot qu'il fallait faire ressortir.
 *
 * Découpage par segments et rendu en `<strong>` : pas de `dangerouslySetInnerHTML`,
 * donc rien de ce que renvoie le modèle ne peut être interprété comme du balisage.
 */
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
      setMsgs((m) => [...m, { role: "model", text: j.reply || `⚠️ ${j.error || t("err")}`, source: j.source }]);
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

            {/* En-tête volontairement SOBRE. Une version précédente empilait un dégradé
                émeraude, un avatar en dégradé avec ombre portée, une pastille verte et un
                badge « EN LIGNE » : quatre signaux décoratifs pour une seule information,
                dans une app dont tout le reste est minimal. La décoration attirait l'œil
                sur le cadre au lieu de la réponse. */}
            <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                <LifeBuoy className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-900">{t("title")}</div>
                <div className="truncate text-xs text-zinc-400">{t("sub")}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {shown.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[88%] whitespace-pre-wrap text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-zinc-900 px-3.5 py-2.5 text-white"
                      : "rounded-2xl rounded-bl-md border border-zinc-200/80 bg-white px-3.5 py-3 text-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  }`}>
                    {/* ⚠️ LE GRAS ÉTAIT DÉJÀ RENDU, PAS LES ÉTAPES. Mesuré le 02/09/2026 :
                        sur « mes séances n'arrivent pas sur ma montre », le modèle renvoie
                        2 passages en gras (affichés) et 2 étapes numérotées (affichées en
                        texte plat). Or l'invite réclame précisément des étapes numérotées
                        pour une manipulation — c'est la partie qu'on suit du doigt, et
                        c'était la seule sans mise en forme. Le message de la personne,
                        lui, reste brut : elle a tapé du texte, pas du balisage. */}
                    {m.role === "user" ? m.text : <RichText texte={m.text} />}
                  </div>
                  {/* D'où vient la réponse. Une réponse servie sans appel arrive en 0 ms :
                      le dire évite qu'on la prenne pour une réponse bâclée, et c'est
                      honnête sur ce que l'assistant a réellement fait. */}
                  {m.source && (
                    <span className="mt-1 pl-1 text-[10px] text-zinc-400">{t("instant")}</span>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  {/* Trois points plutôt qu'un sablier : un spinner dit « ça charge »,
                      les points disent « quelqu'un est en train de te répondre ». */}
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-zinc-200/80 bg-white px-4 py-3.5">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              {/* Suggestions : uniquement au premier écran, pour amorcer sans encombrer. */}
              {msgs.length === 0 && !busy && (
                <div className="space-y-1.5 pt-1">
                  <div className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{t("suggest")}</div>
                  {/* Une ligne par question, alignée à gauche : en pastilles, une question
                      de huit mots se coupait sur deux lignes et devenait illisible. */}
                  {["s1", "s2", "s3"].map((k) => (
                    <button key={k} onClick={() => send(t(k))}
                      className="group flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-zinc-600 transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800">
                      <span className="min-w-0 flex-1">{t(k)}</span>
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-emerald-500" />
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
