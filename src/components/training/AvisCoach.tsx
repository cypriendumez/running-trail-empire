"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareQuote, Loader2, Lock, Check } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { formatDateCivile } from "@/lib/time/fuseau";

/**
 * « Un avis sur ma semaine » — la seule partie du plan qui fait parler un modèle.
 *
 * Le plan reste DÉTERMINISTE et fait foi. Ce bouton demande à un modèle s'il voit UN
 * déplacement qui vaudrait la peine, et la route confronte sa réponse aux mêmes bornes
 * que le plan avant de la rendre : sur un budget qualité nul, seul un allègement est
 * recevable. Ce qu'il propose ne s'applique jamais tout seul — l'athlète lit, et décide.
 *
 * ⚠️ DEPUIS LE 30/10/2026, IL DÉCIDE D'UN GESTE (Cyprien : « la séance est réellement
 * modifiée, puis envoyée à la montre »). « Appliquer » montre d'abord le changement CONCRET
 * (jours, séance), calculé ici sur le plan affiché et non sur la phrase du modèle ; la route
 * `ai/ajustement/appliquer` le fait appliquer par le moteur, avec ses garde-fous.
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
type Textes = {
  bouton: string; charge: string; refus: string; indispo: string; quota: string; verrou: string; verrouCta: string;
  appliquer: string; enCours: string; applique: string; change: string; refuse: string;
  /** Ce que devient une séance allégée, et le séparateur « titre : détail » de la langue. */
  recup25: string; deux: string;
};
const T: Record<string, Textes> = {
  fr: { bouton: "Un avis sur ma semaine", charge: "Le coach regarde…", refus: "Rien à signaler sur cette semaine.", indispo: "Le coach n'est pas joignable pour le moment.", quota: "Tu as atteint ta limite de questions pour aujourd'hui.", verrou: "L'avis du coach IA sur ta semaine fait partie de la formule Premium.", verrouCta: "Voir les formules",
    appliquer: "Appliquer", enCours: "Le coach applique…", applique: "C'est fait : ton plan et ta montre sont à jour.", change: "Ton plan a changé depuis cette proposition : redemande un avis.", refuse: "Le coach ne peut pas appliquer ce changement : il enfreindrait une règle de sécurité du plan.",
    recup25: "récupération de 25 min", deux: " : " },
  en: { bouton: "A view on my week", charge: "The coach is looking…", refus: "Nothing to flag this week.", indispo: "The coach can't be reached right now.", quota: "You've reached today's question limit.", verrou: "The AI coach's view on your week is part of the Premium plan.", verrouCta: "See the plans",
    appliquer: "Apply", enCours: "The coach is applying…", applique: "Done: your plan and your watch are up to date.", change: "Your plan has changed since this suggestion: ask again.", refuse: "The coach can't apply this change: it would break one of the plan's safety rules.",
    recup25: "25-min recovery run", deux: ": " },
  de: { bouton: "Eine Einschätzung zur Woche", charge: "Der Coach schaut…", refus: "Diese Woche gibt es nichts anzumerken.", indispo: "Der Coach ist gerade nicht erreichbar.", quota: "Du hast dein Tageslimit an Fragen erreicht.", verrou: "Die Einschätzung des KI-Coachs zu deiner Woche ist Teil des Premium-Tarifs.", verrouCta: "Tarife ansehen",
    appliquer: "Übernehmen", enCours: "Der Coach übernimmt…", applique: "Erledigt: Dein Plan und deine Uhr sind auf dem neuesten Stand.", change: "Dein Plan hat sich seit diesem Vorschlag geändert: Frag noch einmal.", refuse: "Der Coach kann diese Änderung nicht übernehmen: Sie würde eine Sicherheitsregel des Plans verletzen.",
    recup25: "25 Min. Regenerationslauf", deux: ": " },
  es: { bouton: "Una opinión sobre mi semana", charge: "El entrenador está mirando…", refus: "Nada que señalar esta semana.", indispo: "El entrenador no está disponible ahora mismo.", quota: "Has alcanzado tu límite de preguntas de hoy.", verrou: "La opinión del coach IA sobre tu semana forma parte del plan Premium.", verrouCta: "Ver los planes",
    appliquer: "Aplicar", enCours: "El entrenador está aplicando…", applique: "Hecho: tu plan y tu reloj están al día.", change: "Tu plan ha cambiado desde esta sugerencia: vuelve a pedir una opinión.", refuse: "El entrenador no puede aplicar este cambio: rompería una regla de seguridad del plan.",
    recup25: "rodaje de recuperación de 25 min", deux: ": " },
  pt: { bouton: "Uma opinião sobre a minha semana", charge: "O treinador está a ver…", refus: "Nada a assinalar esta semana.", indispo: "O treinador não está disponível de momento.", quota: "Atingiste o teu limite de perguntas de hoje.", verrou: "A opinião do coach IA sobre a tua semana faz parte do plano Premium.", verrouCta: "Ver os planos",
    appliquer: "Aplicar", enCours: "O treinador está a aplicar…", applique: "Feito: o teu plano e o teu relógio estão atualizados.", change: "O teu plano mudou desde esta sugestão: pede uma nova opinião.", refuse: "O treinador não pode aplicar esta alteração: violaria uma regra de segurança do plano.",
    recup25: "corrida de recuperação de 25 min", deux: ": " },
};

type Jour = { date: string; type: string; title: string };
type Proposition = { date: string; action: "decaler" | "alleger" | "echanger"; vers?: string };

/** Le changement CONCRET, lu sur le plan affiché (jamais sur la phrase du modèle). */
export function changementConcret(p: Proposition, week: readonly Jour[], t: Textes, lang: string): string | null {
  const jour = (d: string) => formatDateCivile(d, lang, { weekday: "long" });
  const titre = week.find((d) => d.date === p.date)?.title;
  if (!titre) return null;
  if (p.action === "alleger") return `${jour(p.date)}${t.deux}${titre} → ${t.recup25}`;
  if (!p.vers || !week.some((d) => d.date === p.vers)) return null;
  return p.action === "decaler" ? `${titre}${t.deux}${jour(p.date)} → ${jour(p.vers)}` : `${jour(p.date)} ⇄ ${jour(p.vers)}`;
}

export function AvisCoach({ week, qBudget, raisons }: { week: Jour[]; qBudget: number; raisons: string[] }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const router = useRouter();
  const [etat, setEtat] = useState<"pret" | "charge" | "fait" | "verrou">("pret");
  const [texte, setTexte] = useState<string | null>(null);
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const [application, setApplication] = useState<"aucune" | "en-cours" | "faite" | "echec">("aucune");
  const [retour, setRetour] = useState<string | null>(null);

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
      else {
        setTexte(j.ajustement.texte);
        if (j.ajustement.action !== "rien") setProposition(j.ajustement as Proposition);
      }
    } catch { setTexte(t.indispo); }
    setEtat("fait");
  }

  async function appliquer() {
    setApplication("en-cours");
    try {
      const r = await fetch("/api/ai/ajustement/appliquer", { method: "POST" });
      if (r.status === 402) { setEtat("verrou"); return; }
      if (r.ok) {
        setApplication("faite"); setRetour(t.applique);
        router.refresh(); // le calendrier relit le plan que le moteur vient de republier
        return;
      }
      setApplication("echec");
      setRetour(r.status === 409 ? t.change : r.status === 422 ? t.refuse : t.indispo);
    } catch { setApplication("echec"); setRetour(t.indispo); }
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
    const concret = proposition ? changementConcret(proposition, week, t, lang) : null;
    return (
      <div className="mt-2 space-y-2 rounded-xl bg-white/70 px-3 py-2 text-sm leading-relaxed text-zinc-700">
        <p>{texte}</p>
        {concret && application !== "faite" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-xs font-medium text-zinc-500">{concret}</span>
            <button
              onClick={appliquer} disabled={application === "en-cours" || application === "echec"}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-50"
            >
              {application === "en-cours" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {application === "en-cours" ? t.enCours : t.appliquer}
            </button>
          </div>
        )}
        {retour && <p className={`text-xs font-medium ${application === "faite" ? "text-emerald-700" : "text-zinc-500"}`}>{retour}</p>}
      </div>
    );
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
