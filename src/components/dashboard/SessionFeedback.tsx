"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquareHeart } from "lucide-react";

const PAINS = ["Aucune douleur", "Musculaire", "Articulaire"];
// Localisation de la douleur → transmise au coach pour adapter les séances suivantes.
const ZONES = ["Mollet", "Tendon d'Achille", "Genou", "Cuisse", "Ischio-jambier", "Hanche", "Tibia (périoste)", "Pied / cheville", "Dos / bas du dos"];
// Dégradé vert → rouge pour l'échelle d'effort 0-10
const rpeColor = (v: number) => {
  const stops = ["#10b981", "#22c55e", "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444"];
  return stops[Math.min(stops.length - 1, Math.round((v / 10) * (stops.length - 1)))];
};
// Échelle de perception de l'effort (RPE / Borg CR10) — explication de chaque niveau.
const RPE_LABELS: { t: string; d: string }[] = [
  { t: "Repos", d: "aucun effort, à l'arrêt" },
  { t: "Très très facile", d: "à peine perceptible" },
  { t: "Très facile", d: "récupération — tu discutes sans aucune gêne" },
  { t: "Facile", d: "endurance fondamentale — conversation aisée" },
  { t: "Modéré", d: "endurance active — l'effort se sent mais reste confortable" },
  { t: "Soutenu", d: "tempo — conversation devient hachée" },
  { t: "Assez dur", d: "tu dois commencer à te concentrer" },
  { t: "Dur", d: "allure seuil — tenable environ 1 h" },
  { t: "Très dur", d: "fractionné VMA long — parler devient difficile" },
  { t: "Quasi maximal", d: "VMA courte — presque tout donné" },
  { t: "Maximal", d: "sprint — impossible à tenir plus de quelques secondes" },
];

export function SessionFeedback({ date, title }: { date: string; title: string }) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pain, setPain] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const togglePain = (p: string) => {
    setPain((prev) => {
      if (p === "Aucune douleur") return prev.includes(p) ? [] : ["Aucune douleur"];
      const next = prev.filter((x) => x !== "Aucune douleur");
      return next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
    });
  };

  const submit = async () => {
    if (rpe == null) { toast.error("Indique ton ressenti d'effort (0-10)"); return; }
    setSending(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title, rpe, pain, note }),
      });
      const j = await r.json();
      if (j.ok) { setDone(true); toast.success("Merci ! Ton coach en tient compte 🙏"); }
      else toast.error(j.error || "Envoi impossible");
    } catch { toast.error("Envoi impossible"); }
    finally { setSending(false); }
  };

  if (done) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
        <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-900">Merci pour ton retour — il aide ton coach à ajuster tes prochaines séances. 💪</p>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50"><MessageSquareHeart className="h-5 w-5 text-rose-500" /></span>
        <div>
          <h3 className="font-bold text-zinc-900">Comment s&apos;est passée ta séance ?</h3>
          <p className="text-xs text-zinc-400">{title} · {new Date(date).toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Ressenti d'effort 0-10 (RPE) avec explication de chaque niveau */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700">Ressenti d&apos;effort (RPE)</span>
            <span className="text-xs text-zinc-400">passe sur un chiffre pour son sens</span>
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
            if (v == null) return <p className="mt-2 text-xs text-zinc-400">0 = repos total · 10 = effort maximal</p>;
            return (
              <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: rpeColor(v) }}>{v}</span>
                <span className="text-sm text-zinc-600"><b className="text-zinc-800">{RPE_LABELS[v].t}</b> — {RPE_LABELS[v].d}</span>
              </div>
            );
          })()}
        </div>

        {/* Douleurs */}
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">As-tu ressenti des douleurs ?</div>
          <div className="flex flex-wrap gap-2">
            {PAINS.map((p) => {
              const active = pain.includes(p);
              const danger = p !== "Aucune douleur";
              return (
                <button key={p} onClick={() => togglePain(p)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition-colors ${active
                    ? danger ? "bg-red-500 text-white ring-red-500" : "bg-emerald-500 text-white ring-emerald-500"
                    : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}>
                  {p}
                </button>
              );
            })}
          </div>
          {pain.some((p) => p !== "Aucune douleur") && (
            <div className="mt-2.5">
              <div className="mb-1.5 text-xs font-medium text-zinc-500">Où exactement ? (aide ton coach à adapter les prochaines séances)</div>
              <div className="flex flex-wrap gap-1.5">
                {ZONES.map((z) => {
                  const active = pain.includes(z);
                  return (
                    <button key={z} onClick={() => togglePain(z)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${active ? "bg-amber-500 text-white ring-amber-500" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}>
                      {z}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Un mot pour ton coach ? (optionnel — sensations, fatigue, météo…)"
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />

        <button onClick={submit} disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Envoyer mon ressenti
        </button>
      </div>
    </div>
  );
}
