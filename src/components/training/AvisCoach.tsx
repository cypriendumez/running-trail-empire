"use client";
import { useState } from "react";
import Link from "next/link";
import { MessageSquareQuote, Loader2, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * « Un avis sur ma semaine » — la seule partie du plan qui fait parler un modèle.
 *
 * Le plan reste DÉTERMINISTE et fait foi. Ce bouton demande à un modèle s'il voit UN
 * déplacement qui vaudrait la peine, et la route confronte sa réponse aux mêmes bornes
 * que le plan avant de la rendre : sur un budget qualité nul, seul un allègement est
 * recevable. Ce qu'il propose ne s'applique jamais tout seul — l'athlète lit, et décide.
 *
 * ⚠️ À LA DEMANDE, ET C'EST CE QUI LE REND RENTABLE. Le plan se replanifie à chaque
 * synchronisation ; brancher un appel de modèle sur cette cadence coûterait des dizaines
 * d'appels par athlète et par jour. Ici, un clic = au plus un appel, et la réponse est
 * mémorisée tant que le plan ne bouge pas.
 *
 * ⚠️ RÉSERVÉ À PREMIUM DEPUIS LE 23/10/2026 (route `ai/ajustement`, capacité `plan_ia`).
 * Le bouton reste visible pour tous : l'athlète doit savoir que la fonction existe. Un
 * refus 402 s'affichait « Le coach n'est pas joignable » — une panne inventée, sans la
 * sortie. Il dit maintenant la formule et mène aux tarifs.
 */
const T: Record<string, { bouton: string; charge: string; refus: string; indispo: string; quota: string; verrou: string; verrouCta: string }> = {
  fr: { bouton: "Un avis sur ma semaine", charge: "Le coach regarde…", refus: "Rien à signaler sur cette semaine.", indispo: "Le coach n'est pas joignable pour le moment.", quota: "Tu as atteint ta limite de questions pour aujourd'hui.", verrou: "L'avis du coach IA sur ta semaine fait partie de la formule Premium.", verrouCta: "Voir les formules" },
  en: { bouton: "A view on my week", charge: "The coach is looking…", refus: "Nothing to flag this week.", indispo: "The coach can't be reached right now.", quota: "You've reached today's question limit.", verrou: "The AI coach's view on your week is part of the Premium plan.", verrouCta: "See the plans" },
  de: { bouton: "Eine Einschätzung zur Woche", charge: "Der Coach schaut…", refus: "Diese Woche gibt es nichts anzumerken.", indispo: "Der Coach ist gerade nicht erreichbar.", quota: "Du hast dein Tageslimit an Fragen erreicht.", verrou: "Die Einschätzung des KI-Coachs zu deiner Woche ist Teil des Premium-Tarifs.", verrouCta: "Tarife ansehen" },
  es: { bouton: "Una opinión sobre mi semana", charge: "El entrenador está mirando…", refus: "Nada que señalar esta semana.", indispo: "El entrenador no está disponible ahora mismo.", quota: "Has alcanzado tu límite de preguntas de hoy.", verrou: "La opinión del coach IA sobre tu semana forma parte del plan Premium.", verrouCta: "Ver los planes" },
  pt: { bouton: "Uma opinião sobre a minha semana", charge: "O treinador está a ver…", refus: "Nada a assinalar esta semana.", indispo: "O treinador não está disponível de momento.", quota: "Atingiste o teu limite de perguntas de hoje.", verrou: "A opinião do coach IA sobre a tua semana faz parte do plano Premium.", verrouCta: "Ver os planos" },
};

type Jour = { date: string; type: string; title: string };

export function AvisCoach({ week, qBudget, raisons }: { week: Jour[]; qBudget: number; raisons: string[] }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const [etat, setEtat] = useState<"pret" | "charge" | "fait" | "verrou">("pret");
  const [texte, setTexte] = useState<string | null>(null);

  async function demander() {
    setEtat("charge");
    try {
      const r = await fetch("/api/ai/ajustement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, qBudget, raisons, lang }),
      });
      // 402 = la formule ne couvre pas la fonction : ce n'est pas une panne.
      if (r.status === 402) { setEtat("verrou"); return; }
      const j = await r.json().catch(() => null);
      if (r.status === 429) setTexte(t.quota);
      // 422 = le modèle a répondu, mais sa proposition a été écartée par le garde-fou.
      // On ne montre PAS le motif technique : ce n'est pas le problème de l'athlète.
      else if (r.status === 422) setTexte(t.refus);
      else if (!r.ok || !j?.ok) setTexte(t.indispo);
      else setTexte(j.ajustement.action === "rien" ? j.ajustement.texte : j.ajustement.texte);
    } catch { setTexte(t.indispo); }
    setEtat("fait");
  }

  if (etat === "verrou") {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm leading-relaxed text-zinc-700">
        <Lock className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">{t.verrou}</span>
        <Link href="/pricing" className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline">{t.verrouCta}</Link>
      </p>
    );
  }

  if (etat === "fait" && texte) {
    return <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm leading-relaxed text-zinc-700">{texte}</p>;
  }

  return (
    <button
      onClick={demander} disabled={etat === "charge" || !week.length}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-white disabled:opacity-50"
    >
      {etat === "charge" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareQuote className="h-3.5 w-3.5" />}
      {etat === "charge" ? t.charge : t.bouton}
    </button>
  );
}
