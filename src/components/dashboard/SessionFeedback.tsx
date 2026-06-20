"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquareHeart } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// IMPORTANT : la VALEUR (`v`) reste en FRANÇAIS — elle est envoyée au serveur et lue par l'IA coach
// (matching par mots-clés FR pour adapter les séances). Seul le LIBELLÉ (`k`) est traduit à l'affichage.
const PAINS: { v: string; k: string }[] = [
  { v: "Aucune douleur", k: "fb.pain.none" },
  { v: "Musculaire", k: "fb.pain.muscle" },
  { v: "Articulaire", k: "fb.pain.joint" },
];
const ZONES: { v: string; k: string }[] = [
  { v: "Mollet", k: "fb.zone.calf" },
  { v: "Tendon d'Achille", k: "fb.zone.achilles" },
  { v: "Genou", k: "fb.zone.knee" },
  { v: "Cuisse", k: "fb.zone.thigh" },
  { v: "Ischio-jambier", k: "fb.zone.hamstring" },
  { v: "Hanche", k: "fb.zone.hip" },
  { v: "Tibia (périoste)", k: "fb.zone.shin" },
  { v: "Pied / cheville", k: "fb.zone.foot" },
  { v: "Dos / bas du dos", k: "fb.zone.back" },
];
const NO_PAIN = "Aucune douleur";
// Dégradé vert → rouge pour l'échelle d'effort 0-10
const rpeColor = (v: number) => {
  const stops = ["#10b981", "#22c55e", "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444"];
  return stops[Math.min(stops.length - 1, Math.round((v / 10) * (stops.length - 1)))];
};

export function SessionFeedback({ date, title }: { date: string; title: string }) {
  const { t, lang } = useT();
  const [rpe, setRpe] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pain, setPain] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const togglePain = (p: string) => {
    setPain((prev) => {
      if (p === NO_PAIN) return prev.includes(p) ? [] : [NO_PAIN];
      const next = prev.filter((x) => x !== NO_PAIN);
      return next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
    });
  };

  const submit = async () => {
    if (rpe == null) { toast.error(t("fb.errRpe")); return; }
    setSending(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title, rpe, pain, note }),
      });
      const j = await r.json();
      if (j.ok) { setDone(true); toast.success(t("fb.ok")); }
      else toast.error(j.error || t("fb.fail"));
    } catch { toast.error(t("fb.fail")); }
    finally { setSending(false); }
  };

  if (done) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
        <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-900">{t("fb.doneTitle")}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50"><MessageSquareHeart className="h-5 w-5 text-rose-500" /></span>
        <div>
          <h3 className="font-bold text-zinc-900">{t("fb.title")}</h3>
          <p className="text-xs text-zinc-400">{title} · {new Date(date).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Ressenti d'effort 0-10 (RPE) avec explication de chaque niveau */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700">{t("fb.rpe")}</span>
            <span className="text-xs text-zinc-400">{t("fb.rpeHint")}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} onClick={() => setRpe(i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                className={`h-9 w-9 rounded-xl text-sm font-bold transition-all ${rpe === i ? "scale-110 text-white shadow-md" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                style={rpe === i ? { background: rpeColor(i) } : undefined}>
                {i}
              </button>
            ))}
          </div>
          {(() => {
            const v = hovered ?? rpe;
            if (v == null) return <p className="mt-2 text-xs text-zinc-400">{t("fb.rpeScale")}</p>;
            return (
              <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: rpeColor(v) }}>{v}</span>
                <span className="text-sm text-zinc-600"><b className="text-zinc-800">{t(`fb.rpe${v}.t`)}</b> — {t(`fb.rpe${v}.d`)}</span>
              </div>
            );
          })()}
        </div>

        {/* Douleurs */}
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">{t("fb.painQ")}</div>
          <div className="flex flex-wrap gap-2">
            {PAINS.map((p) => {
              const active = pain.includes(p.v);
              const danger = p.v !== NO_PAIN;
              return (
                <button key={p.v} onClick={() => togglePain(p.v)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition-colors ${active
                    ? danger ? "bg-red-500 text-white ring-red-500" : "bg-emerald-500 text-white ring-emerald-500"
                    : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}>
                  {t(p.k)}
                </button>
              );
            })}
          </div>
          {pain.some((p) => p !== NO_PAIN) && (
            <div className="mt-2.5">
              <div className="mb-1.5 text-xs font-medium text-zinc-500">{t("fb.where")}</div>
              <div className="flex flex-wrap gap-1.5">
                {ZONES.map((z) => {
                  const active = pain.includes(z.v);
                  return (
                    <button key={z.v} onClick={() => togglePain(z.v)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${active ? "bg-amber-500 text-white ring-amber-500" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}>
                      {t(z.k)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder={t("fb.notePh")}
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />

        <button onClick={submit} disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("fb.submit")}
        </button>
      </div>
    </div>
  );
}
