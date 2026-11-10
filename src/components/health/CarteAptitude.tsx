"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";
import { QUESTIONS_APTITUDE, type QuestionAptitude } from "@/lib/health/aptitude";
import { APTITUDE_UI } from "@/lib/health/aptitudeI18n";

/**
 * LE QUESTIONNAIRE D'APTITUDE dans Santé (lot 3, 10/11/2026).
 *
 * `etat = "absent"` : le coureur ne l'a jamais rempli (inscrit avant le lot 3) → les 5 situations.
 * `etat = "attente"` : une situation cochée, pas encore d'avis médical → le plan est sans intensité
 * et un bouton permet de déclarer l'avis d'un médecin. `"ok"` : rien n'est affiché.
 * L'écran ne dit « plan à jour » que si la route l'a recalculé.
 */
export function CarteAptitude({ etat }: { etat: "absent" | "attente" | "ok" }) {
  const { lang } = useT();
  const t = APTITUDE_UI[(lang as Lang) in APTITUDE_UI ? (lang as Lang) : "fr"];
  const router = useRouter();
  const [oui, setOui] = useState<QuestionAptitude[]>([]);
  const [aucune, setAucune] = useState(false);
  const [enCours, setEnCours] = useState(false);
  if (etat === "ok") return null;

  async function envoyer(corps: Record<string, unknown>, succes: string) {
    setEnCours(true);
    try {
      const r = await fetch("/api/health/aptitude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) { toast.error(t.erreur); return; }
      toast.success(j.replanifie === true ? succes : `${t.ok} ${t.recalcul}`);
      router.refresh();
    } catch {
      toast.error(t.erreur);
    } finally {
      setEnCours(false);
    }
  }

  if (etat === "attente") {
    return (
      <section role="status" className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
        <div className="flex items-start gap-2.5">
          <HeartPulse className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-700" aria-hidden />
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">{t.attenteTitre}</h2>
            <p className="mt-1 text-[13px] leading-snug text-zinc-700">{t.attente}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={enCours} onClick={() => envoyer({ avisMedecin: true }, t.okAvis)}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}{t.avisBouton}
          </button>
          <p className="text-[11.5px] text-zinc-500">{t.avisAide}</p>
        </div>
      </section>
    );
  }

  const repondu = oui.length > 0 || aucune;
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-2.5">
        <HeartPulse className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" aria-hidden />
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">{t.titre}</h2>
          <p className="mt-0.5 text-[12.5px] text-zinc-600">{t.aide}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {QUESTIONS_APTITUDE.map((q) => (
          <label key={q} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-[13px] text-zinc-800 hover:bg-zinc-50">
            <input type="checkbox" checked={oui.includes(q)} className="mt-0.5 h-4 w-4 rounded border-zinc-300"
              onChange={() => { setAucune(false); setOui((o) => (o.includes(q) ? o.filter((x) => x !== q) : [...o, q])); }} />
            {t.questions[q]}
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
          <input type="checkbox" checked={aucune} className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            onChange={() => { setOui([]); setAucune((v) => !v); }} />
          {t.aucune}
        </label>
      </div>
      <button type="button" disabled={!repondu || enCours} onClick={() => envoyer({ oui }, oui.length ? t.okAttente : t.ok)}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
        {enCours && <Loader2 className="h-4 w-4 animate-spin" />}{t.envoyer}
      </button>
    </section>
  );
}
