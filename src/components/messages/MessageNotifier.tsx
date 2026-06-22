"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageProvider";

// ── i18n local (5 langues) — textes des alertes nouveau message. ───────────
const N: Record<string, { coach: string; client: string; desc: string; open: string }> = {
  fr: { coach: "💬 Nouveau message d'un client", client: "💬 Ton coach t'a répondu", desc: "Clique pour ouvrir ta messagerie.", open: "Ouvrir" },
  en: { coach: "💬 New message from a client", client: "💬 Your coach replied", desc: "Click to open your inbox.", open: "Open" },
  de: { coach: "💬 Neue Nachricht von einem Kunden", client: "💬 Dein Coach hat dir geantwortet", desc: "Klicke, um deine Nachrichten zu öffnen.", open: "Öffnen" },
  es: { coach: "💬 Nuevo mensaje de un cliente", client: "💬 Tu coach te ha respondido", desc: "Haz clic para abrir tu mensajería.", open: "Abrir" },
  pt: { coach: "💬 Nova mensagem de um cliente", client: "💬 O teu coach respondeu-te", desc: "Clica para abrir as tuas mensagens.", open: "Abrir" },
};

// Sonne + notifie quand un nouveau message arrive (coach ou client). Monté dans les layouts.
export function MessageNotifier() {
  const { lang } = useT();
  const langRef = useRef(lang);
  langRef.current = lang;
  const last = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let stopped = false;

    const beep = () => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        if (!ctxRef.current) ctxRef.current = new Ctx();
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const t0 = ctx.currentTime;
        [0, 0.18].forEach((dt, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = i === 0 ? 660 : 880;
          g.gain.setValueAtTime(0.0001, t0 + dt);
          g.gain.exponentialRampToValueAtTime(0.16, t0 + dt + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.16);
          o.connect(g); g.connect(ctx.destination);
          o.start(t0 + dt); o.stop(t0 + dt + 0.18);
        });
      } catch { /* audio indisponible */ }
    };

    const poll = async () => {
      try {
        const r = await fetch("/api/messages/poll", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { count?: number; role?: string };
        const count = j.count ?? 0;
        const role = j.role ?? "client";
        if (last.current === null) { last.current = count; return; } // 1er passage = référence, pas d'alerte
        if (count > last.current) {
          const d = N[langRef.current] ?? N.fr;
          const dest = role === "coach" ? "/admin/messages" : "/dashboard/messages";
          const msg = role === "coach" ? d.coach : d.client;
          let soundOn = true;
          try { soundOn = localStorage.getItem("rte:sound") !== "off"; } catch { /* défaut: activé */ }
          if (soundOn) beep();
          toast(msg, { description: d.desc, action: { label: d.open, onClick: () => { window.location.href = dest; } } });
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              const n = new Notification("Pacevo", { body: msg, icon: "/favicon.ico", tag: "rte-message" });
              n.onclick = () => { window.focus(); window.location.href = dest; };
            }
          } catch { /* notif indisponible */ }
        }
        last.current = count;
      } catch { /* hors ligne : on réessaie au prochain tick */ }
    };

    poll();
    const id = setInterval(() => { if (!stopped) poll(); }, 45000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  return null;
}
