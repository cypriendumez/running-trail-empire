"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { lireTemps, BORNES_SECONDES, type CleDistance } from "@/lib/dashboard/records";

/**
 * « Ajouter un record d'avant Pacevo » — le semi de 2024 que la montre n'a jamais transmis.
 *
 * Le temps et la date viennent de l'athlète, et seulement de lui : l'application ne les
 * devine pas, et les affiche avec la mention « Déclaré ». Validation dans le navigateur
 * pour répondre tout de suite, et À NOUVEAU sur le serveur (`validerRecordDeclare`), qui
 * seul fait foi.
 */
const DISTANCES: { cle: CleDistance; label: string }[] = [
  { cle: "5k", label: "5 km" }, { cle: "10k", label: "10 km" }, { cle: "semi", label: "Semi" }, { cle: "marathon", label: "Marathon" },
];

export function AjoutRecord({ aujourdhui }: { aujourdhui: string }) {
  const { t } = useT();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [distance, setDistance] = useState<CleDistance>("semi");
  const [temps, setTemps] = useState("");
  const [date, setDate] = useState("");
  const [course, setCourse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Libellés RELIÉS par id : deux formulaires sur une même page ne doivent pas se croiser.
  const id = useId();

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800">
        <Plus className="h-3.5 w-3.5" />{t("dash.rec.ajouter")}
      </button>
    );
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const secondes = lireTemps(temps);
    const [min, max] = BORNES_SECONDES[distance];
    if (secondes == null || secondes < min || secondes > max || !date || date > aujourdhui) {
      setErreur(t("dash.rec.invalide"));
      return;
    }
    setEnCours(true); setErreur(null);
    try {
      const r = await fetch("/api/records", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distance, secondes, date, course }),
      });
      if (!r.ok) throw new Error();
      setOuvert(false); setTemps(""); setDate(""); setCourse("");
      router.refresh();
    } catch {
      setErreur(t("dash.rec.erreur"));
    } finally {
      setEnCours(false);
    }
  };

  const champ = "w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  return (
    <form onSubmit={envoyer} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
      <p className="text-[11px] leading-snug text-zinc-500">{t("dash.rec.aide")}</p>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-d`} className="text-[11px] text-zinc-500">{t("dash.rec.distance")}
          <select id={`${id}-d`} value={distance} onChange={(e) => setDistance(e.target.value as CleDistance)} className={`mt-0.5 ${champ}`}>
            {DISTANCES.map((x) => <option key={x.cle} value={x.cle}>{x.label}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-t`} className="text-[11px] text-zinc-500">{t("dash.rec.temps")}
          <input id={`${id}-t`} value={temps} onChange={(e) => setTemps(e.target.value)} inputMode="numeric" placeholder="1:15:00" className={`mt-0.5 tabular-nums ${champ}`} />
        </label>
        <label htmlFor={`${id}-j`} className="text-[11px] text-zinc-500">{t("dash.rec.date")}
          <input id={`${id}-j`} type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} className={`mt-0.5 ${champ}`} />
        </label>
        <label htmlFor={`${id}-c`} className="text-[11px] text-zinc-500">{t("dash.rec.course")}
          <input id={`${id}-c`} value={course} maxLength={80} onChange={(e) => setCourse(e.target.value)} className={`mt-0.5 ${champ}`} />
        </label>
      </div>
      {erreur && <p role="alert" className="text-[12px] text-amber-700">{erreur}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={enCours}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
          {enCours && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("dash.rec.enregistrer")}
        </button>
        <button type="button" onClick={() => { setOuvert(false); setErreur(null); }} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
          {t("dash.rec.annuler")}
        </button>
      </div>
    </form>
  );
}
