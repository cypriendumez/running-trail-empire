"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarRange, Loader2, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * « Bilan de la semaine » (Premium) — plusieurs séances lues ENSEMBLE : intensité, dérive
 * cardiaque, efficacité, sommeil et VFC, préparation à l'objectif (route `ai/bilan`).
 *
 * ⚠️ À LA DEMANDE : un clic, au plus un appel de modèle, et le bilan est resservi sans
 * rien dépenser tant que les faits de la semaine ne changent pas.
 *
 * ⚠️ VISIBLE POUR TOUS. Starter voit la carte verrouillée, avec la formule qui l'ouvre :
 * une fonction qu'on ne voit jamais ne se vend pas, et un bouton qui échoue sans dire
 * pourquoi ressemble à une panne.
 */
const T: Record<string, { titre: string; sous: string; bouton: string; charge: string; indispo: string; quota: string; verrou: string; verrouCta: string }> = {
  fr: { titre: "Bilan de la semaine", sous: "Tes séances lues ensemble : tendances, dérive cardiaque, préparation à ton objectif.", bouton: "Lire mon bilan", charge: "Le coach relit ta semaine…", indispo: "Le bilan n'a pas pu être écrit. Réessaie dans un instant.", quota: "Tu as atteint ta limite d'échanges avec l'IA pour aujourd'hui.", verrou: "Le bilan de la semaine fait partie de la formule Premium.", verrouCta: "Voir les formules" },
  en: { titre: "Weekly review", sous: "Your sessions read together: trends, cardiac drift, readiness for your goal.", bouton: "Read my review", charge: "The coach is reading your week…", indispo: "The review couldn't be written. Try again in a moment.", quota: "You've reached today's AI limit.", verrou: "The weekly review is part of the Premium plan.", verrouCta: "See the plans" },
  de: { titre: "Wochenbilanz", sous: "Deine Einheiten zusammen gelesen: Trends, kardiale Drift, Stand der Vorbereitung auf dein Ziel.", bouton: "Bilanz lesen", charge: "Der Coach liest deine Woche…", indispo: "Die Bilanz konnte nicht erstellt werden. Versuch es gleich noch einmal.", quota: "Du hast dein KI-Tageslimit erreicht.", verrou: "Die Wochenbilanz ist Teil des Premium-Tarifs.", verrouCta: "Tarife ansehen" },
  es: { titre: "Balance de la semana", sous: "Tus sesiones leídas en conjunto: tendencias, deriva cardiaca, preparación para tu objetivo.", bouton: "Leer mi balance", charge: "El entrenador está leyendo tu semana…", indispo: "No se pudo escribir el balance. Vuelve a intentarlo en un momento.", quota: "Has alcanzado tu límite diario de IA.", verrou: "El balance de la semana forma parte del plan Premium.", verrouCta: "Ver los planes" },
  pt: { titre: "Balanço da semana", sous: "As tuas sessões lidas em conjunto: tendências, deriva cardíaca, preparação para o teu objetivo.", bouton: "Ler o meu balanço", charge: "O treinador está a ler a tua semana…", indispo: "Não foi possível escrever o balanço. Tenta de novo daqui a pouco.", quota: "Atingiste o teu limite diário de IA.", verrou: "O balanço da semana faz parte do plano Premium.", verrouCta: "Ver os planos" },
};

export function BilanSemaine({ ouvert }: { ouvert: boolean }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const [etat, setEtat] = useState<"pret" | "charge" | "fait" | "verrou">(ouvert ? "pret" : "verrou");
  const [texte, setTexte] = useState<string | null>(null);

  async function lire() {
    setEtat("charge");
    try {
      const r = await fetch("/api/ai/bilan", { method: "POST" });
      if (r.status === 402) { setEtat("verrou"); return; }
      const j = await r.json().catch(() => null);
      setTexte(r.status === 429 ? t.quota : r.ok && j?.ok && typeof j.texte === "string" ? j.texte : t.indispo);
    } catch { setTexte(t.indispo); }
    setEtat("fait");
  }

  return (
    <div className="bento-card">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-[#059669]" />
        <div className="metric-label">{t.titre}</div>
        <span className="ml-auto rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Premium</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{t.sous}</p>
      {etat === "verrou" ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm leading-relaxed text-zinc-700">
          <Lock className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1">{t.verrou}</span>
          <Link href="/pricing" className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline">{t.verrouCta}</Link>
        </p>
      ) : etat === "fait" && texte ? (
        <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{texte}</p>
      ) : (
        <button
          onClick={lire} disabled={etat === "charge"}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-50"
        >
          {etat === "charge" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />}
          {etat === "charge" ? t.charge : t.bouton}
        </button>
      )}
    </div>
  );
}
