"use client";
import { useEffect, useId, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";
import { fmtAllure, testEnVigueur, type TestLactate, type ErreurLactate } from "@/lib/coach/lactate";
import { formatDateCivile, aujourdhui as jourDans } from "@/lib/time/fuseau";
import { useFuseau } from "@/lib/time/FuseauProvider";

/**
 * SAISIR UN TEST DE LACTATE — les deux seuils mesurés (lib/coach/lactate, /api/lactate).
 *
 * Le test passe devant les allures estimées pendant six mois : le seuil 2 devient l'allure
 * seuil des séances, le seuil 1 la limite de l'allure de footing. Le serveur CONTRÔLE la
 * saisie (bornes, ordre des seuils, date) et répond par un code d'erreur traduit ici.
 */
const T: Record<Lang, {
  titre: string; intro: string; seuil1: string; seuil2: string; allure: string; fc: string; date: string;
  enregistrer: string; envoi: string; ok: string; actuel: string; expire: string; erreurs: Record<ErreurLactate | "enregistrement", string>;
}> = {
  fr: {
    titre: "Test de lactate", intro: "Tu as fait un test en laboratoire ou avec un lactatemètre ? Saisis tes deux seuils : ils remplacent les allures estimées pendant six mois.",
    seuil1: "Seuil 1 (aérobie, ~2 mmol/L)", seuil2: "Seuil 2 (anaérobie, ~4 mmol/L)", allure: "Allure (ex. 4'20)", fc: "FC (facultatif)", date: "Date du test",
    enregistrer: "Enregistrer le test", envoi: "Enregistrement…", ok: "Test enregistré : ton plan est recalculé avec ces seuils.",
    actuel: "Test du {date} : seuil 1 à {a1}/km{f1}, seuil 2 à {a2}/km{f2}.", expire: "Ce test a plus de six mois : il ne pilote plus tes allures.",
    erreurs: { date: "Date invalide : le test doit dater de moins de deux ans, et pas du futur.", allure: "Allure invalide : écris-la comme 4'20 (entre 2'30 et 10'00).", ordre: "Le seuil 1 doit être plus lent que le seuil 2.", fc: "Fréquence cardiaque invalide (entre 80 et 220).", ordreFc: "La FC du seuil 1 doit être plus basse que celle du seuil 2.", enregistrement: "Enregistrement impossible. Réessaie." },
  },
  en: {
    titre: "Lactate test", intro: "Did a lab test or used a lactate meter? Enter your two thresholds: they replace the estimated paces for six months.",
    seuil1: "Threshold 1 (aerobic, ~2 mmol/L)", seuil2: "Threshold 2 (anaerobic, ~4 mmol/L)", allure: "Pace (e.g. 4'20)", fc: "HR (optional)", date: "Test date",
    enregistrer: "Save the test", envoi: "Saving…", ok: "Test saved: your plan is recalculated with these thresholds.",
    actuel: "Test of {date}: threshold 1 at {a1}/km{f1}, threshold 2 at {a2}/km{f2}.", expire: "This test is more than six months old: it no longer sets your paces.",
    erreurs: { date: "Invalid date: the test must be less than two years old, and not in the future.", allure: "Invalid pace: write it like 4'20 (between 2'30 and 10'00).", ordre: "Threshold 1 must be slower than threshold 2.", fc: "Invalid heart rate (between 80 and 220).", ordreFc: "Threshold 1 HR must be lower than threshold 2 HR.", enregistrement: "Could not save. Try again." },
  },
  de: {
    titre: "Laktattest", intro: "Labortest gemacht oder ein Laktatmessgerät genutzt? Trage deine zwei Schwellen ein: Sie ersetzen sechs Monate lang die geschätzten Tempi.",
    seuil1: "Schwelle 1 (aerob, ~2 mmol/L)", seuil2: "Schwelle 2 (anaerob, ~4 mmol/L)", allure: "Tempo (z. B. 4'20)", fc: "HF (optional)", date: "Testdatum",
    enregistrer: "Test speichern", envoi: "Wird gespeichert…", ok: "Test gespeichert: Dein Plan wird mit diesen Schwellen neu berechnet.",
    actuel: "Test vom {date}: Schwelle 1 bei {a1}/km{f1}, Schwelle 2 bei {a2}/km{f2}.", expire: "Dieser Test ist älter als sechs Monate: Er bestimmt deine Tempi nicht mehr.",
    erreurs: { date: "Ungültiges Datum: Der Test muss jünger als zwei Jahre sein und darf nicht in der Zukunft liegen.", allure: "Ungültiges Tempo: Schreib es wie 4'20 (zwischen 2'30 und 10'00).", ordre: "Schwelle 1 muss langsamer sein als Schwelle 2.", fc: "Ungültige Herzfrequenz (zwischen 80 und 220).", ordreFc: "Die HF von Schwelle 1 muss niedriger sein als die von Schwelle 2.", enregistrement: "Speichern nicht möglich. Versuch es erneut." },
  },
  es: {
    titre: "Test de lactato", intro: "¿Hiciste un test de laboratorio o usas un lactatómetro? Introduce tus dos umbrales: sustituyen los ritmos estimados durante seis meses.",
    seuil1: "Umbral 1 (aeróbico, ~2 mmol/L)", seuil2: "Umbral 2 (anaeróbico, ~4 mmol/L)", allure: "Ritmo (p. ej. 4'20)", fc: "FC (opcional)", date: "Fecha del test",
    enregistrer: "Guardar el test", envoi: "Guardando…", ok: "Test guardado: tu plan se recalcula con estos umbrales.",
    actuel: "Test del {date}: umbral 1 a {a1}/km{f1}, umbral 2 a {a2}/km{f2}.", expire: "Este test tiene más de seis meses: ya no fija tus ritmos.",
    erreurs: { date: "Fecha no válida: el test debe tener menos de dos años y no ser futuro.", allure: "Ritmo no válido: escríbelo como 4'20 (entre 2'30 y 10'00).", ordre: "El umbral 1 debe ser más lento que el umbral 2.", fc: "Frecuencia cardíaca no válida (entre 80 y 220).", ordreFc: "La FC del umbral 1 debe ser más baja que la del umbral 2.", enregistrement: "No se pudo guardar. Inténtalo de nuevo." },
  },
  pt: {
    titre: "Teste de lactato", intro: "Fizeste um teste em laboratório ou usas um lactatómetro? Introduz os teus dois limiares: substituem os ritmos estimados durante seis meses.",
    seuil1: "Limiar 1 (aeróbio, ~2 mmol/L)", seuil2: "Limiar 2 (anaeróbio, ~4 mmol/L)", allure: "Ritmo (ex. 4'20)", fc: "FC (opcional)", date: "Data do teste",
    enregistrer: "Guardar o teste", envoi: "A guardar…", ok: "Teste guardado: o teu plano é recalculado com estes limiares.",
    actuel: "Teste de {date}: limiar 1 a {a1}/km{f1}, limiar 2 a {a2}/km{f2}.", expire: "Este teste tem mais de seis meses: já não define os teus ritmos.",
    erreurs: { date: "Data inválida: o teste deve ter menos de dois anos e não pode ser futuro.", allure: "Ritmo inválido: escreve-o como 4'20 (entre 2'30 e 10'00).", ordre: "O limiar 1 deve ser mais lento do que o limiar 2.", fc: "Frequência cardíaca inválida (entre 80 e 220).", ordreFc: "A FC do limiar 1 deve ser mais baixa do que a do limiar 2.", enregistrement: "Não foi possível guardar. Tenta novamente." },
  },
};

const CHAMP = "w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export function TestLactateCard() {
  const { lang } = useT();
  // Le jour de l'ATHLÈTE (fuseau du cookie, le même au rendu serveur et dans le navigateur) :
  // un « aujourd'hui » lu de l'horloge locale diverge du serveur vers minuit (erreur #418).
  const aujourdhui = jourDans(useFuseau());
  const t = T[lang] ?? T.fr;
  const cid = useId();
  const [actuel, setActuel] = useState<TestLactate | null>(null);
  const [saisie, setSaisie] = useState({ date: aujourdhui, a1: "", f1: "", a2: "", f2: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lactate").then((r) => (r.ok ? r.json() : null))
      .then((j: { test?: TestLactate | null } | null) => setActuel(j?.test ?? null)).catch(() => {});
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch("/api/lactate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: saisie.date, lt1: { allure: saisie.a1, fc: saisie.f1 }, lt2: { allure: saisie.a2, fc: saisie.f2 } }),
      });
      const j = (await r.json().catch(() => ({}))) as { test?: TestLactate; error?: string };
      if (!r.ok || !j.test) { setErreur(t.erreurs[(j.error as ErreurLactate) ?? "enregistrement"] ?? t.erreurs.enregistrement); return; }
      setActuel(j.test);
      toast.success(t.ok);
    } catch { setErreur(t.erreurs.enregistrement); }
    finally { setEnvoi(false); }
  }

  const fcTxt = (fc: number | null) => (fc ? ` (${fc} bpm)` : "");
  return (
    <div className="bento-card space-y-3">
      <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><FlaskConical className="w-4 h-4" /> {t.titre}</h3>
      <p className="text-xs leading-relaxed text-zinc-500">{t.intro}</p>
      {actuel && (
        <p className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${testEnVigueur(actuel, aujourdhui) ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          {t.actuel.replace("{date}", formatDateCivile(actuel.date, lang, { day: "numeric", month: "long", year: "numeric" }))
            .replace("{a1}", fmtAllure(actuel.lt1.allureSec)).replace("{f1}", fcTxt(actuel.lt1.fc))
            .replace("{a2}", fmtAllure(actuel.lt2.allureSec)).replace("{f2}", fcTxt(actuel.lt2.fc))}
          {!testEnVigueur(actuel, aujourdhui) && <> {t.expire}</>}
        </p>
      )}
      <form onSubmit={enregistrer} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor={`${cid}-d`} className="text-xs font-medium text-zinc-500 block mb-1">{t.date}</label>
          <input id={`${cid}-d`} type="date" max={aujourdhui} value={saisie.date} onChange={(e) => setSaisie((s) => ({ ...s, date: e.target.value }))} className={CHAMP} />
        </div>
        {([["1", t.seuil1, "a1", "f1"], ["2", t.seuil2, "a2", "f2"]] as const).map(([n, titre, a, f]) => (
          <fieldset key={n} className="col-span-2 grid grid-cols-2 gap-3">
            <legend className="col-span-2 mb-1 text-xs font-semibold text-zinc-700">{titre}</legend>
            <div>
              <label htmlFor={`${cid}-${a}`} className="text-xs font-medium text-zinc-500 block mb-1">{t.allure}</label>
              <input id={`${cid}-${a}`} inputMode="numeric" placeholder="4'20" value={saisie[a]} onChange={(e) => setSaisie((s) => ({ ...s, [a]: e.target.value }))} className={CHAMP} />
            </div>
            <div>
              <label htmlFor={`${cid}-${f}`} className="text-xs font-medium text-zinc-500 block mb-1">{t.fc}</label>
              <input id={`${cid}-${f}`} type="number" inputMode="numeric" min={80} max={220} value={saisie[f]} onChange={(e) => setSaisie((s) => ({ ...s, [f]: e.target.value }))} className={CHAMP} />
            </div>
          </fieldset>
        ))}
        {erreur && <p role="alert" className="col-span-2 text-[12px] text-red-700">{erreur}</p>}
        <button type="submit" disabled={envoi} className="btn-brand col-span-2 justify-center">
          {envoi ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.envoi}</> : t.enregistrer}
        </button>
      </form>
    </div>
  );
}
