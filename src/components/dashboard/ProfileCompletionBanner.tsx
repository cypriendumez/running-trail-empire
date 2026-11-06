"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListChecks, ArrowRight, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Les comptes créés AVANT l'ajout du questionnaire complet ont `onboarding_completed = true` :
// ils ne repasseront jamais par l'inscription et leur coach lira « non renseigné » indéfiniment.
// Ce bandeau leur dit précisément ce qui manque, et ce que ça leur coûte.
const T: Record<string, Record<string, string>> = {
  fr: { title: "{n} réponses pour un plan vraiment à ta mesure", title1: "Une réponse pour un plan vraiment à ta mesure", sub: "Sans elles, ton coach applique des réglages prudents par défaut. Une minute suffit.", cta: "Compléter mon profil", exp: "ancienneté en course", terr: "terrain habituel", elev: "rapport au dénivelé", health: "santé et antécédents", dismiss: "Masquer" },
  en: { title: "{n} answers for a plan truly built around you", title1: "One answer for a plan truly built around you", sub: "Without them, your coach falls back on cautious defaults. It takes a minute.", cta: "Complete my profile", exp: "running experience", terr: "usual terrain", elev: "elevation preference", health: "health and history", dismiss: "Dismiss" },
  de: { title: "{n} Antworten für einen Plan, der wirklich zu dir passt", title1: "Eine Antwort für einen Plan, der wirklich zu dir passt", sub: "Ohne sie greift dein Coach auf vorsichtige Standardwerte zurück. Dauert eine Minute.", cta: "Profil vervollständigen", exp: "Lauferfahrung", terr: "übliches Terrain", elev: "Verhältnis zu Höhenmetern", health: "Gesundheit und Vorgeschichte", dismiss: "Ausblenden" },
  es: { title: "{n} respuestas para un plan realmente a tu medida", title1: "Una respuesta para un plan realmente a tu medida", sub: "Sin ellas, tu entrenador aplica ajustes prudentes por defecto. Te lleva un minuto.", cta: "Completar mi perfil", exp: "antigüedad corriendo", terr: "terreno habitual", elev: "relación con el desnivel", health: "salud y antecedentes", dismiss: "Ocultar" },
  pt: { title: "{n} respostas para um plano mesmo à tua medida", title1: "Uma resposta para um plano mesmo à tua medida", sub: "Sem elas, o teu treinador aplica definições prudentes por omissão. Leva um minuto.", cta: "Completar o meu perfil", exp: "experiência a correr", terr: "terreno habitual", elev: "relação com o desnível", health: "saúde e antecedentes", dismiss: "Ocultar" },
};

const CLE_MASQUE = "pacevo_profil_masque";

export function ProfileCompletionBanner({ profile }: { profile: Record<string, unknown> | null }) {
  const { lang } = useT();
  const [hidden, setHidden] = useState(false);
  const t = T[lang] ?? T.fr;

  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const missing = [
    profile?.running_years == null && t.exp,
    arr(profile?.main_terrains).length === 0 && !profile?.main_terrain && t.terr,
    !profile?.elevation_pref && t.elev,
    // `health_declared` distingue « je n'ai rien » de « je n'ai pas répondu » : un athlète
    // en bonne santé coche « rien à signaler » et ne doit plus jamais voir ce rappel.
    !profile?.health_declared && t.health,
  ].filter((x): x is string => typeof x === "string");

  // ⚠️ « MASQUER » SE SOUVIENT (06/11/2026). La croix ne valait que pour l'affichage en cours :
  // le bandeau revenait à chaque visite. Mémorisé dans le navigateur pour CET ensemble de
  // points manquants — s'il en manque un autre plus tard, le bandeau revient, à raison.
  const cle = missing.join("|");
  useEffect(() => {
    try { if (localStorage.getItem(CLE_MASQUE) === cle) setHidden(true); } catch { /* stockage refusé */ }
  }, [cle]);
  const masquer = () => {
    setHidden(true);
    try { localStorage.setItem(CLE_MASQUE, cle); } catch { /* rien à mémoriser */ }
  };

  if (hidden || missing.length === 0) return null;

  return (
    // LA CHARTE (DESIGN.md) : surface blanche, liseré fin, émeraude par petites touches,
    // bouton principal noir. L'ancien bandeau ambre à bouton orange criait « alerte » en
    // haut de la page pour ce qui est une invitation (07/11/2026).
    <div className="relative mb-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-zinc-200">
      <button onClick={masquer} aria-label={t.dismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-500">
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex flex-col gap-3 pr-6 sm:flex-row sm:items-center">
        <span className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-50 sm:flex">
          <ListChecks className="h-[18px] w-[18px] text-zinc-500" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{missing.length === 1 ? t.title1 : t.title.replace("{n}", String(missing.length))}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{t.sub}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span key={m} className="rounded-md bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">{m}</span>
            ))}
          </div>
        </div>
        <Link href="/dashboard/profile"
          className="inline-flex w-fit flex-shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
          {t.cta} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
