"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Les comptes créés AVANT l'ajout du questionnaire complet ont `onboarding_completed = true` :
// ils ne repasseront jamais par l'inscription et leur coach lira « non renseigné » indéfiniment.
// Ce bandeau leur dit précisément ce qui manque, et ce que ça leur coûte.
const T: Record<string, Record<string, string>> = {
  fr: { title: "Ton coach travaille à l'aveugle sur {n} point(s)", sub: "Sans ces informations, il applique des réglages prudents par défaut au lieu de s'adapter à toi.", cta: "Compléter mon profil", exp: "ancienneté en course", terr: "terrain habituel", elev: "rapport au dénivelé", health: "santé et antécédents", dismiss: "Masquer" },
  en: { title: "Your coach is missing {n} thing(s) about you", sub: "Without these, it falls back on cautious defaults instead of adapting to you.", cta: "Complete my profile", exp: "running experience", terr: "usual terrain", elev: "elevation preference", health: "health and history", dismiss: "Dismiss" },
  de: { title: "Deinem Coach fehlen {n} Angabe(n)", sub: "Ohne sie greift er auf vorsichtige Standardwerte zurück, statt sich dir anzupassen.", cta: "Profil vervollständigen", exp: "Lauferfahrung", terr: "übliches Terrain", elev: "Verhältnis zu Höhenmetern", health: "Gesundheit und Vorgeschichte", dismiss: "Ausblenden" },
  es: { title: "A tu entrenador le faltan {n} dato(s)", sub: "Sin ellos, aplica ajustes prudentes por defecto en lugar de adaptarse a ti.", cta: "Completar mi perfil", exp: "antigüedad corriendo", terr: "terreno habitual", elev: "relación con el desnivel", health: "salud y antecedentes", dismiss: "Ocultar" },
  pt: { title: "Faltam {n} dado(s) ao teu treinador", sub: "Sem eles, aplica definições prudentes por omissão em vez de se adaptar a ti.", cta: "Completar o meu perfil", exp: "experiência a correr", terr: "terreno habitual", elev: "relação com o desnível", health: "saúde e antecedentes", dismiss: "Ocultar" },
};

export function ProfileCompletionBanner({ profile }: { profile: Record<string, unknown> | null }) {
  const { lang } = useT();
  const [hidden, setHidden] = useState(false);
  const t = T[lang] ?? T.fr;

  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const missing = [
    profile?.running_years == null && t.exp,
    arr(profile?.main_terrains).length === 0 && !profile?.main_terrain && t.terr,
    !profile?.elevation_pref && t.elev,
    // La santé compte comme manquante seulement si RIEN n'a été touché : un athlète en
    // bonne santé a coché « rien à signaler », ce qui laisse les tableaux vides mais
    // renseigne `health_notes`… on ne peut pas distinguer ici, donc on reste permissif
    // et on ne réclame la santé que si aucun des trois champs n'existe.
    arr(profile?.health_conditions).length === 0 && arr(profile?.injury_zones).length === 0 && !profile?.health_notes && t.health,
  ].filter((x): x is string => typeof x === "string");

  if (hidden || missing.length === 0) return null;

  return (
    <div className="relative mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <button onClick={() => setHidden(true)} aria-label={t.dismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600">
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-900">{t.title.replace("{n}", String(missing.length))}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800/80">{t.sub}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span key={m} className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">{m}</span>
            ))}
          </div>
          <Link href="/dashboard/profile"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700">
            {t.cta} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
