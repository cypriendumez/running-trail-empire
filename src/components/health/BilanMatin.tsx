"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sunrise } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";
import type { BilanMatin as Bilan } from "@/lib/health/bilanMatin";

/**
 * LE BILAN DU MATIN (Santé, lot 2, 10/11/2026) — trois réponses de 1 à 5, un envoi.
 *
 * Sur le tableau de bord (`variante="carte"`, tant qu'il n'est pas rempli aujourd'hui) et dans
 * Santé › Récupération. 1 = très bien, 5 = très mal. Fatigue ou jambes à 4-5 allègent la séance
 * dure du jour (lib/health/bilanMatin) ; l'écran ne dit « plan mis à jour » que si la route l'a fait.
 */
type Cle = "fatigue" | "jambes" | "stress";
const T: Record<Lang, {
  titre: string; aide: string; enregistrer: string; modifier: string; q: Record<Cle, [string, string, string]>;
  ok: string; okAllege: string; attente: string; erreur: string; douleur: string;
}> = {
  fr: {
    titre: "Ton bilan du matin", aide: "Trois clics : ton plan du jour en tient compte. 1 = très bien, 5 = très mal.",
    enregistrer: "Envoyer mon bilan", modifier: "Mettre à jour mon bilan",
    q: { fatigue: ["Fatigue", "En forme", "Épuisé"], jambes: ["Jambes", "Légères", "Très lourdes, courbatures"], stress: ["Stress", "Serein", "Très stressé"] },
    ok: "Bilan enregistré : ton plan du jour est à jour.", okAllege: "Bilan enregistré : la séance dure du jour devient facile.",
    attente: "Bilan enregistré : ton plan en tiendra compte à son prochain recalcul.", erreur: "Bilan non enregistré, réessaie dans un instant.",
    douleur: "Une douleur précise (tendon, articulation, os) se déclare dans Santé › Douleurs, pas ici.",
  },
  en: {
    titre: "Your morning check-in", aide: "Three taps: today's plan takes it into account. 1 = very good, 5 = very bad.",
    enregistrer: "Send my check-in", modifier: "Update my check-in",
    q: { fatigue: ["Fatigue", "Fresh", "Exhausted"], jambes: ["Legs", "Light", "Very heavy, sore"], stress: ["Stress", "Calm", "Very stressed"] },
    ok: "Check-in saved: today's plan is up to date.", okAllege: "Check-in saved: today's hard session becomes easy.",
    attente: "Check-in saved: your plan will take it into account at its next recalculation.", erreur: "Check-in not saved, try again in a moment.",
    douleur: "A specific pain (tendon, joint, bone) is reported in Health › Pain, not here.",
  },
  de: {
    titre: "Dein Morgen-Check", aide: "Drei Klicks: Dein heutiger Plan berücksichtigt ihn. 1 = sehr gut, 5 = sehr schlecht.",
    enregistrer: "Check senden", modifier: "Check aktualisieren",
    q: { fatigue: ["Müdigkeit", "Fit", "Erschöpft"], jambes: ["Beine", "Leicht", "Sehr schwer, Muskelkater"], stress: ["Stress", "Entspannt", "Sehr gestresst"] },
    ok: "Check gespeichert: Dein heutiger Plan ist aktuell.", okAllege: "Check gespeichert: Die harte Einheit von heute wird locker.",
    attente: "Check gespeichert: Dein Plan berücksichtigt ihn bei der nächsten Neuberechnung.", erreur: "Check nicht gespeichert, versuche es gleich noch einmal.",
    douleur: "Ein konkreter Schmerz (Sehne, Gelenk, Knochen) wird unter Gesundheit › Schmerzen gemeldet, nicht hier.",
  },
  es: {
    titre: "Tu chequeo matinal", aide: "Tres clics: tu plan de hoy lo tiene en cuenta. 1 = muy bien, 5 = muy mal.",
    enregistrer: "Enviar mi chequeo", modifier: "Actualizar mi chequeo",
    q: { fatigue: ["Cansancio", "En forma", "Agotado"], jambes: ["Piernas", "Ligeras", "Muy pesadas, agujetas"], stress: ["Estrés", "Tranquilo", "Muy estresado"] },
    ok: "Chequeo guardado: tu plan de hoy está al día.", okAllege: "Chequeo guardado: la sesión dura de hoy pasa a ser suave.",
    attente: "Chequeo guardado: tu plan lo tendrá en cuenta en su próximo recálculo.", erreur: "Chequeo no guardado, inténtalo de nuevo en un momento.",
    douleur: "Un dolor concreto (tendón, articulación, hueso) se declara en Salud › Dolor, no aquí.",
  },
  pt: {
    titre: "O teu check-in da manhã", aide: "Três cliques: o teu plano de hoje tem-no em conta. 1 = muito bem, 5 = muito mal.",
    enregistrer: "Enviar o meu check-in", modifier: "Atualizar o meu check-in",
    q: { fatigue: ["Cansaço", "Em forma", "Exausto"], jambes: ["Pernas", "Leves", "Muito pesadas, dores musculares"], stress: ["Stress", "Tranquilo", "Muito stressado"] },
    ok: "Check-in guardado: o teu plano de hoje está atualizado.", okAllege: "Check-in guardado: a sessão dura de hoje passa a ser fácil.",
    attente: "Check-in guardado: o teu plano vai tê-lo em conta no próximo recálculo.", erreur: "Check-in não guardado, tenta novamente daqui a pouco.",
    douleur: "Uma dor concreta (tendão, articulação, osso) declara-se em Saúde › Dor, não aqui.",
  },
};

const CLES: Cle[] = ["fatigue", "jambes", "stress"];

export function BilanMatin({ initial = null, variante = "onglet" }: { initial?: Bilan | null; variante?: "carte" | "onglet" }) {
  const { lang } = useT();
  const t = T[lang as Lang] ?? T.fr;
  const router = useRouter();
  const [rep, setRep] = useState<Partial<Record<Cle, number>>>(initial ? { fatigue: initial.fatigue, jambes: initial.jambes, stress: initial.stress } : {});
  const [enCours, setEnCours] = useState(false);
  const complet = CLES.every((c) => typeof rep[c] === "number");

  async function envoyer() {
    if (!complet) return;
    setEnCours(true);
    try {
      const r = await fetch("/api/health/bilan-matin", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rep),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) { toast.error(t.erreur); return; }
      // « Plan à jour » seulement si la route l'a recalculé (essai expiré, contexte refusé : non).
      toast.success(j.replanifie === true ? (j.allege === true ? t.okAllege : t.ok) : t.attente);
      router.refresh();
    } catch {
      toast.error(t.erreur);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className={variante === "carte"
      ? "mb-4 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm"
      : "rounded-2xl border border-zinc-200 bg-white p-4"}>
      <div className="flex items-start gap-2.5">
        <Sunrise className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">{t.titre}</h2>
          <p className="text-[12.5px] text-zinc-600">{t.aide}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {CLES.map((c) => (
          <div key={c} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 sm:grid-cols-[5.5rem_1fr]">
            <span className="text-[13px] font-medium text-zinc-800">{t.q[c][0]}</span>
            <div>
              <div className="flex gap-1.5" role="radiogroup" aria-label={t.q[c][0]}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const choisi = rep[c] === n;
                  return (
                    <button key={n} type="button" role="radio" aria-checked={choisi} onClick={() => setRep((p) => ({ ...p, [c]: n }))}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold ring-1 transition-colors ${choisi
                        ? n >= 4 ? "bg-amber-600 text-white ring-amber-600" : "bg-zinc-900 text-white ring-zinc-900"
                        : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"}`}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-0.5 flex w-[13.5rem] justify-between text-[11px] text-zinc-500">
                <span>{t.q[c][1]}</span><span>{t.q[c][2]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!complet || enCours} onClick={envoyer}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? t.modifier : t.enregistrer}
        </button>
        <p className="text-[11.5px] text-zinc-500">{t.douleur}</p>
      </div>
    </section>
  );
}
