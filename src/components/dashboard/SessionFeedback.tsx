"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, CheckCircle2, Footprints, Loader2, MessageSquareHeart } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { kmApres, type SeanceRessenti } from "@/lib/dashboard/ressenti";

/** Une paire active du Garage, telle que le questionnaire la propose. */
export type ChaussureGarage = { id: string; nom: string; km: number; maxKm: number };

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

/** « 52 min », « 1 h 32 » — la durée comme on la dit. */
const duree = (sec: number | null) => {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};
/** Allure « 5:06 /km », seulement pour une séance à pied de plus d'un kilomètre. */
const allure = (s: SeanceRessenti) => {
  if (!s.aPied || !s.distanceKm || !s.dureeSec || s.distanceKm < 1) return null;
  const secKm = Math.round(s.dureeSec / s.distanceKm);
  return `${Math.floor(secKm / 60)}:${String(secKm % 60).padStart(2, "0")} /km`;
};

/**
 * ⚠️ UNE SÉANCE À LA FOIS, MAIS NOMMÉE (30/09/2026). Avec trois sorties importées, le
 * questionnaire demandait « Comment s'est passée ta séance ? » trois fois de suite, sous le
 * même titre : impossible de savoir laquelle. Chaque séance est désormais présentée par ce
 * qui la distingue — son nom, sa date, sa distance, sa durée — avec « 1 sur 3 ».
 */
export function SessionFeedback({ seances, chaussures }: { seances: SeanceRessenti[]; chaussures: ChaussureGarage[] }) {
  const { t, lang } = useT();
  const [index, setIndex] = useState(0);
  const [garage, setGarage] = useState(chaussures);
  const [rpe, setRpe] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pain, setPain] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [chaussure, setChaussure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [masque, setMasque] = useState(false);
  const seance = seances[index];

  /** Séance suivante — ou fin du questionnaire. Le formulaire repart de zéro. « Plus tard »
   *  sur la dernière ferme la carte sans dire « merci » : rien n'a été répondu. */
  const suivante = (repondu: boolean) => {
    if (index + 1 >= seances.length) { if (repondu) setDone(true); else setMasque(true); return; }
    setIndex(index + 1); setRpe(null); setHovered(null); setPain([]); setNote(""); setChaussure(null);
  };

  const togglePain = (p: string) => {
    setPain((prev) => {
      if (p === NO_PAIN) return prev.includes(p) ? [] : [NO_PAIN];
      const next = prev.filter((x) => x !== NO_PAIN);
      return next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
    });
  };

  const submit = async () => {
    if (!seance) return;
    if (rpe == null) { toast.error(t("fb.errRpe")); return; }
    setSending(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout_id: seance.id, date: seance.date, title: seance.titre, rpe, pain, note, chaussure_id: chaussure }),
      });
      const j = await r.json();
      if (j.ok) {
        // Le kilométrage écrit par le SERVEUR (il relit la distance) : la carte suivante le montre.
        if (j.chaussure?.id) setGarage((g) => g.map((c) => (c.id === j.chaussure.id ? { ...c, km: Number(j.chaussure.km) || c.km } : c)));
        if (j.chaussureErreur) toast.warning(t("fb.shoeFail"));
        toast.success(t("fb.ok"));
        suivante(true);
      } else toast.error(j.error || t("fb.fail"));
    } catch { toast.error(t("fb.fail")); }
    finally { setSending(false); }
  };

  if (!seance || masque) return null;
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
      <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-3.5">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50"><MessageSquareHeart className="h-5 w-5 text-rose-500" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-zinc-900">{t("fb.title")}</h3>
            {seances.length > 1 && (
              <span className="flex-shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600">
                {t("fb.of", { i: index + 1, n: seances.length })}
              </span>
            )}
          </div>
          {/* Ce qui DÉSIGNE la séance : son nom, sa date, sa distance, sa durée, son allure. */}
          <p className="mt-0.5 truncate text-sm font-semibold text-zinc-700">{seance.titre}</p>
          <p className="text-xs text-zinc-500">
            {[
              new Date(`${seance.date}T12:00:00`).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }),
              seance.distanceKm ? `${seance.distanceKm.toLocaleString(lang, { maximumFractionDigits: 1 })} km` : null,
              duree(seance.dureeSec),
              allure(seance),
            ].filter(Boolean).join(" · ")}
          </p>
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

        {/* Chaussures portées — FACULTATIF. C'est ce qui rend l'usure mesurable : sans savoir
            quelle paire a servi, le Garage ne pouvait rien compter. Sans paire au Garage, pas
            de choix possible : on dit seulement où les ajouter. */}
        {seance.aPied && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
              <Footprints className="h-4 w-4 text-zinc-400" />{t("fb.shoes")}
              <span className="text-xs font-normal text-zinc-400">· {t("fb.optional")}</span>
            </div>
            {garage.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
                {t("fb.shoesNone")}{" "}
                <Link href="/dashboard/profile?onglet=garage" className="font-semibold text-emerald-700 hover:underline">{t("fb.shoesGo")}</Link>
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("fb.shoes")}>
                {garage.map((c) => {
                  const choisie = chaussure === c.id;
                  const apres = kmApres(c.km, seance.distanceKm);
                  const usure = c.maxKm > 0 ? Math.min(100, Math.round((apres / c.maxKm) * 100)) : null;
                  return (
                    <button key={c.id} type="button" role="radio" aria-checked={choisie}
                      onClick={() => setChaussure(choisie ? null : c.id)}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${choisie
                        ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-100"
                        : "border-zinc-200 bg-white hover:border-zinc-300"}`}>
                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${choisie ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 bg-white"}`}>
                        {choisie && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-800">{c.nom}</span>
                        <span className="block text-xs tabular-nums text-zinc-500">
                          {choisie && seance.distanceKm
                            ? t("fb.shoeAfter", { avant: c.km.toLocaleString(lang, { maximumFractionDigits: 1 }), apres: apres.toLocaleString(lang, { maximumFractionDigits: 1 }) })
                            : t("fb.shoeKm", { km: c.km.toLocaleString(lang, { maximumFractionDigits: 1 }) })}
                        </span>
                        {usure != null && (
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-zinc-100">
                            <span className={`block h-full rounded-full ${usure >= 90 ? "bg-red-500" : usure >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${choisie ? usure : Math.min(100, Math.round((c.km / c.maxKm) * 100))}%` }} />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder={t("fb.notePh")}
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />

        <div className="flex gap-2">
          <button onClick={submit} disabled={sending}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:text-base">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("fb.submit")}
          </button>
          {/* « Plus tard » : cette séance est reposée à la prochaine visite, rien n'est enregistré. */}
          <button type="button" onClick={() => suivante(false)} disabled={sending}
            className="flex-shrink-0 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50">
            {t("fb.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
