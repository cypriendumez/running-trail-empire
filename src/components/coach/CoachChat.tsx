"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, BrainCircuit, Loader2, Lock, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/base";
import { RichText } from "@/components/ui/RichText";
import { LONGUEUR_QUESTION, type MessageCoach, type Niveau } from "@/lib/ai/coachChatTypes";

/**
 * L'écran « Coach IA » — une conversation avec le coach qui connaît le plan.
 *
 * ⚠️ `Record<Lang, …>` ET NON `Record<string, …>` : une langue oubliée ne compile pas. Le
 * dictionnaire du cours (`CoursChat`) accepte n'importe quelle clé, et une langue manquante
 * y retomberait en silence sur le français.
 */
type Dico = {
  titre: string; sousTitre: string; complet: string; essentiel: string; essai: string;
  restants: string; vide: string; placeholder: string; envoyer: string;
  reflechit: string; nouvelle: string; confirmerNouvelle: string; quota: string;
  sature: string; erreur: string; verrouTitre: string; verrouTexte: string; verrouCta: string;
  upsellTitre: string; upsellTexte: string; upsellCta: string; memoire: string; nonMemorise: string;
  suggestions: string[]; suggestionBloc: string; toi: string; coach: string;
};

const D: Record<Lang, Dico> = {
  fr: {
    titre: "Coach IA", sousTitre: "Il connaît ton plan, ta forme, tes séances et ton objectif. Pose-lui ta question.",
    complet: "Coach complet", essentiel: "Coach essentiel", essai: "Essai · niveau Premium",
    restants: "{n} / {max} échanges restants aujourd'hui",
    vide: "Par exemple :", placeholder: "Écris ta question…", envoyer: "Envoyer", reflechit: "Le coach regarde tes données…",
    nouvelle: "Nouvelle conversation", confirmerNouvelle: "Effacer cette conversation ? Le coach ne s'en souviendra plus.",
    quota: "Tu as utilisé tes {max} échanges du jour. Ils reviennent demain.",
    sature: "Le coach est très sollicité en ce moment. Réessaie dans un instant.",
    erreur: "Le coach n'a pas pu répondre. Réessaie dans un instant.",
    verrouTitre: "Le coach IA fait partie des formules Starter et Premium",
    verrouTexte: "Ton historique, tes courses et l'aperçu de ton plan restent gratuits. Pour parler à ton coach, choisis une formule.",
    verrouCta: "Voir les formules",
    upsellTitre: "Premium va plus loin",
    upsellTexte: "Ton plan semaine par semaine jusqu'à la course, 30 échanges par jour et un coach qui se souvient de deux fois plus de choses.",
    upsellCta: "Découvrir Premium",
    memoire: "Le coach se souvient de cette conversation. « Nouvelle conversation » l'efface.",
    nonMemorise: "Réponse reçue, mais pas mémorisée : le coach ne s'en souviendra pas à la prochaine question.",
    suggestions: ["Pourquoi cette séance aujourd'hui ?", "J'ai raté ma séance, qu'est-ce que je fais ?", "Suis-je sur la bonne voie pour mon objectif ?", "Comment gérer ma sortie longue de la semaine ?"],
    suggestionBloc: "Déroule mon plan jusqu'à la course", toi: "Toi", coach: "Coach",
  },
  en: {
    titre: "AI Coach", sousTitre: "It knows your plan, your form, your sessions and your goal. Ask it anything.",
    complet: "Full coach", essentiel: "Essential coach", essai: "Trial · Premium level",
    restants: "{n} / {max} messages left today",
    vide: "For example:", placeholder: "Type your question…", envoyer: "Send", reflechit: "Your coach is reading your data…",
    nouvelle: "New conversation", confirmerNouvelle: "Clear this conversation? Your coach won't remember it anymore.",
    quota: "You've used your {max} messages for today. They come back tomorrow.",
    sature: "The coach is very busy right now. Try again in a moment.",
    erreur: "The coach couldn't answer. Try again in a moment.",
    verrouTitre: "The AI coach is part of the Starter and Premium plans",
    verrouTexte: "Your history, your races and the preview of your plan stay free. To talk to your coach, pick a plan.",
    verrouCta: "See plans",
    upsellTitre: "Premium goes further",
    upsellTexte: "Your plan week by week up to race day, 30 messages a day and a coach that remembers twice as much.",
    upsellCta: "Discover Premium",
    memoire: "Your coach remembers this conversation. “New conversation” clears it.",
    nonMemorise: "Answer received but not saved: your coach won't remember it next time.",
    suggestions: ["Why this session today?", "I missed my session, what should I do?", "Am I on track for my goal?", "How should I approach this week's long run?"],
    suggestionBloc: "Walk me through my plan to race day", toi: "You", coach: "Coach",
  },
  de: {
    titre: "KI-Coach", sousTitre: "Er kennt deinen Plan, deine Form, deine Einheiten und dein Ziel. Frag ihn.",
    complet: "Voller Coach", essentiel: "Basis-Coach", essai: "Testphase · Premium-Niveau",
    restants: "{n} / {max} Nachrichten heute übrig",
    vide: "Zum Beispiel:", placeholder: "Schreib deine Frage…", envoyer: "Senden", reflechit: "Dein Coach liest deine Daten…",
    nouvelle: "Neues Gespräch", confirmerNouvelle: "Dieses Gespräch löschen? Dein Coach erinnert sich dann nicht mehr daran.",
    quota: "Du hast deine {max} Nachrichten für heute verbraucht. Morgen gibt es neue.",
    sature: "Der Coach ist gerade stark ausgelastet. Versuch es gleich noch einmal.",
    erreur: "Der Coach konnte nicht antworten. Versuch es gleich noch einmal.",
    verrouTitre: "Der KI-Coach gehört zu den Tarifen Starter und Premium",
    verrouTexte: "Dein Verlauf, deine Rennen und die Vorschau deines Plans bleiben kostenlos. Um mit deinem Coach zu sprechen, wähle einen Tarif.",
    verrouCta: "Tarife ansehen",
    upsellTitre: "Premium geht weiter",
    upsellTexte: "Dein Plan Woche für Woche bis zum Wettkampf, 30 Nachrichten pro Tag und ein Coach, der sich doppelt so viel merkt.",
    upsellCta: "Premium entdecken",
    memoire: "Dein Coach merkt sich dieses Gespräch. „Neues Gespräch“ löscht es.",
    nonMemorise: "Antwort erhalten, aber nicht gespeichert: Dein Coach erinnert sich beim nächsten Mal nicht daran.",
    suggestions: ["Warum diese Einheit heute?", "Ich habe meine Einheit verpasst – was nun?", "Bin ich auf Kurs für mein Ziel?", "Wie gehe ich den langen Lauf dieser Woche an?"],
    suggestionBloc: "Zeig mir meinen Plan bis zum Wettkampf", toi: "Du", coach: "Coach",
  },
  es: {
    titre: "Coach IA", sousTitre: "Conoce tu plan, tu forma, tus sesiones y tu objetivo. Pregúntale.",
    complet: "Coach completo", essentiel: "Coach esencial", essai: "Prueba · nivel Premium",
    restants: "{n} / {max} mensajes restantes hoy",
    vide: "Por ejemplo:", placeholder: "Escribe tu pregunta…", envoyer: "Enviar", reflechit: "Tu coach está leyendo tus datos…",
    nouvelle: "Nueva conversación", confirmerNouvelle: "¿Borrar esta conversación? Tu coach ya no la recordará.",
    quota: "Has usado tus {max} mensajes de hoy. Vuelven mañana.",
    sature: "El coach está muy solicitado ahora mismo. Inténtalo de nuevo en un momento.",
    erreur: "El coach no ha podido responder. Inténtalo de nuevo en un momento.",
    verrouTitre: "El coach IA forma parte de los planes Starter y Premium",
    verrouTexte: "Tu historial, tus carreras y la vista previa de tu plan siguen siendo gratis. Para hablar con tu coach, elige un plan.",
    verrouCta: "Ver los planes",
    upsellTitre: "Premium va más allá",
    upsellTexte: "Tu plan semana a semana hasta la carrera, 30 mensajes al día y un coach que recuerda el doble.",
    upsellCta: "Descubrir Premium",
    memoire: "Tu coach recuerda esta conversación. «Nueva conversación» la borra.",
    nonMemorise: "Respuesta recibida pero no guardada: tu coach no la recordará la próxima vez.",
    suggestions: ["¿Por qué esta sesión hoy?", "Me he saltado la sesión, ¿qué hago?", "¿Voy bien para mi objetivo?", "¿Cómo afronto la tirada larga de esta semana?"],
    suggestionBloc: "Explícame mi plan hasta la carrera", toi: "Tú", coach: "Coach",
  },
  pt: {
    titre: "Coach IA", sousTitre: "Conhece o teu plano, a tua forma, as tuas sessões e o teu objetivo. Pergunta-lhe.",
    complet: "Coach completo", essentiel: "Coach essencial", essai: "Teste · nível Premium",
    restants: "{n} / {max} mensagens restantes hoje",
    vide: "Por exemplo:", placeholder: "Escreve a tua pergunta…", envoyer: "Enviar", reflechit: "O teu coach está a ler os teus dados…",
    nouvelle: "Nova conversa", confirmerNouvelle: "Apagar esta conversa? O teu coach deixará de se lembrar dela.",
    quota: "Usaste as tuas {max} mensagens de hoje. Voltam amanhã.",
    sature: "O coach está muito solicitado neste momento. Tenta novamente daqui a pouco.",
    erreur: "O coach não conseguiu responder. Tenta novamente daqui a pouco.",
    verrouTitre: "O coach IA faz parte dos planos Starter e Premium",
    verrouTexte: "O teu histórico, as tuas provas e a pré-visualização do teu plano continuam gratuitos. Para falar com o teu coach, escolhe um plano.",
    verrouCta: "Ver os planos",
    upsellTitre: "O Premium vai mais longe",
    upsellTexte: "O teu plano semana a semana até à prova, 30 mensagens por dia e um coach que se lembra do dobro.",
    upsellCta: "Descobrir o Premium",
    memoire: "O teu coach lembra-se desta conversa. «Nova conversa» apaga-a.",
    nonMemorise: "Resposta recebida, mas não guardada: o teu coach não se vai lembrar dela da próxima vez.",
    suggestions: ["Porquê esta sessão hoje?", "Falhei a sessão, o que faço?", "Estou no bom caminho para o meu objetivo?", "Como abordar o longo desta semana?"],
    suggestionBloc: "Explica-me o meu plano até à prova", toi: "Tu", coach: "Coach",
  },
};

/** Remplit « {n} » et « {max} » : le même idiome que `t()`, que le relevé i18n sait lire. */
const remplir = (gabarit: string, p: Record<string, number>) => gabarit.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));

function EnTete({ d }: { d: Dico }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_10px_26px_-10px_rgba(16,185,129,0.65)] sm:h-12 sm:w-12">
        <BrainCircuit className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">{d.titre}</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">{d.sousTitre}</p>
      </div>
    </div>
  );
}

export type EtatInitialCoach = {
  messages: MessageCoach[];
  /** L'athlète a-t-il droit au coach ? (faux = palier gratuit) */
  acces: boolean;
  niveau: Niveau;
  essai: boolean;
  restants: number;
  plafond: number;
};

export function CoachChat({ initial, prefill = "" }: { initial: EtatInitialCoach; prefill?: string }) {
  const { lang } = useT();
  const d = D[lang] ?? D.fr;
  const [messages, setMessages] = useState<MessageCoach[]>(initial.messages);
  const [saisie, setSaisie] = useState(prefill.slice(0, LONGUEUR_QUESTION));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);
  const [restants, setRestants] = useState(initial.restants);
  const [plafond, setPlafond] = useState(initial.plafond);
  const finRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (messages.length || enCours) finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, enCours]);

  if (!initial.acces) {
    return (
      <div className="space-y-5">
      <EnTete d={d} />
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100"><Lock className="h-5 w-5 text-zinc-500" /></div>
        <h2 className="text-lg font-bold text-zinc-900">{d.verrouTitre}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-zinc-500">{d.verrouTexte}</p>
        <Link href="/pricing" className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">{d.verrouCta}</Link>
      </div>
      </div>
    );
  }

  const epuise = restants <= 0;

  const envoyer = async (brut: string) => {
    const question = brut.trim().slice(0, LONGUEUR_QUESTION);
    if (!question || enCours || epuise) return;
    setErreur(null); setAvis(null);
    const avant = messages;
    setMessages([...avant, { role: "user", text: question }]);
    setSaisie("");
    setEnCours(true);
    try {
      const r = await fetch("/api/ai/coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, lang }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.reply) {
        // La question n'a pas eu de réponse : on la rend au champ plutôt que de la perdre.
        setMessages(avant); setSaisie(question);
        if (r.status === 429 && j.error === "quota_ia_atteint") { setRestants(0); if (Number(j.plafond) > 0) setPlafond(Number(j.plafond)); }
        else if (r.status === 402) setErreur(d.verrouTexte);
        else setErreur(r.status === 429 ? d.sature : d.erreur);
        // ⚠️ UN APPEL ÉCHOUÉ COÛTE UN CRÉDIT (il est pris avant l'appel, voir `aiQuota`) :
        // on relit le compteur plutôt que d'afficher un nombre faux.
        fetch("/api/ai/coach").then((x) => x.json()).then((k) => { if (typeof k.restants === "number") setRestants(k.restants); }).catch(() => {});
        return;
      }
      setMessages([...avant, { role: "user", text: question }, { role: "model", text: String(j.reply) }]);
      if (typeof j.restants === "number") setRestants(j.restants);
      if (typeof j.plafond === "number") setPlafond(j.plafond);
      if (j.memorise === false) setAvis(d.nonMemorise);
    } catch {
      setMessages(avant); setSaisie(question); setErreur(d.erreur);
    } finally {
      setEnCours(false);
      champRef.current?.focus();
    }
  };

  const nouvelle = async () => {
    if (!window.confirm(d.confirmerNouvelle)) return;
    const r = await fetch("/api/ai/coach", { method: "DELETE" }).catch(() => null);
    if (r?.ok) { setMessages([]); setErreur(null); setAvis(null); } else setErreur(d.erreur);
  };

  const suggestions = initial.niveau === "complet" ? [d.suggestionBloc, ...d.suggestions] : d.suggestions;

  return (
    <div className="space-y-4">
      <EnTete d={d} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${initial.niveau === "complet" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-zinc-100 text-zinc-600"}`}>
            <Sparkles className="h-3 w-3" />{initial.essai ? d.essai : initial.niveau === "complet" ? d.complet : d.essentiel}
          </span>
          <span className={`text-xs tabular-nums ${epuise ? "font-semibold text-amber-700" : "text-zinc-500"}`}>{remplir(d.restants, { n: Math.max(0, restants), max: plafond })}</span>
        </div>
        {messages.length > 0 && (
          <button onClick={nouvelle} disabled={enCours} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" />{d.nouvelle}
          </button>
        )}
      </div>

      {messages.length === 0 && !enCours && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{d.vide}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => envoyer(s)} disabled={epuise}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-left text-sm text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <ol className="space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              {m.role === "user" ? (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-white">
                  <span className="sr-only">{d.toi} : </span>{m.text}
                </div>
              ) : (
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-700 shadow-sm">
                  <span className="sr-only">{d.coach} : </span><RichText texte={m.text} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {enCours && (
        <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin text-emerald-600" />{d.reflechit}</div>
      )}
      {erreur && <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{erreur}</p>}
      {/* EN CLAIR, pas en texte indicatif : dans un champ d'une ligne, la phrase était coupée
          au milieu sur téléphone (vérifié à 375 px). */}
      {epuise && !erreur && <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{remplir(d.quota, { max: plafond })}</p>}
      {avis && <p className="text-xs text-zinc-500">{avis}</p>}
      <div ref={finRef} />

      <form onSubmit={(e) => { e.preventDefault(); void envoyer(saisie); }}
        className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
        <textarea
          ref={champRef} value={saisie} rows={1} maxLength={LONGUEUR_QUESTION}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void envoyer(saisie); } }}
          placeholder={d.placeholder} disabled={enCours || epuise} aria-label={d.placeholder}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
        />
        <button type="submit" disabled={enCours || epuise || !saisie.trim()} aria-label={d.envoyer}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400">
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
      <p className="text-[11px] text-zinc-400">{d.memoire}</p>

      {initial.niveau === "essentiel" && !initial.essai && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-900">{d.upsellTitre}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-emerald-800">{d.upsellTexte}</p>
          <Link href="/pricing" className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline">{d.upsellCta}</Link>
        </div>
      )}
    </div>
  );
}
