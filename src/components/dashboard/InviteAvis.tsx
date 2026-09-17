"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { CLE_INVITE, doitAfficher, lireEtat, refuser, reporter } from "@/lib/avis/invite";

/**
 * DONNER SON AVIS — une barre discrète, à la façon d'un bandeau de cookies.
 *
 * ⚠️ PORTE INVERSÉE, CONSTATÉE LE 17/09/2026 : `/api/avis` refuse toute soumission
 * anonyme, donc seuls les comptes peuvent écrire un avis — mais `/avis` n'était lié que
 * depuis la landing et le pied de page PUBLIC. Les seules personnes autorisées à écrire
 * étaient exactement celles qui ne voyaient jamais le lien. Ceci est leur porte.
 *
 * ⚠️ ELLE NE S'AFFICHE PAS AU PREMIER RENDU, ET C'EST VOLONTAIRE. La décision dépend de
 * `localStorage`, qui n'existe pas côté serveur : la lire dans l'initialiseur d'état
 * produirait un rendu serveur différent du rendu client, donc une erreur d'hydratation —
 * et un athlète qui a refusé verrait la barre APPARAÎTRE puis disparaître. On ne décide
 * donc qu'après le montage.
 *
 * La logique de report vit dans `lib/avis/invite`, à part et pure, parce qu'un « plus
 * tard » qui se comporte comme un « non » est précisément le défaut qu'on corrige : elle
 * mérite d'être testée, pas relue.
 */
const T: Record<string, { question: string; cta: string; plusTard: string; jamais: string }> = {
  fr: { question: "Un mot sur Pacevo ?", cta: "Écrire mon avis", plusTard: "Plus tard", jamais: "Non merci" },
  en: { question: "A word about Pacevo?", cta: "Write my review", plusTard: "Later", jamais: "No thanks" },
  de: { question: "Ein Wort zu Pacevo?", cta: "Bewertung schreiben", plusTard: "Später", jamais: "Nein danke" },
  es: { question: "¿Unas palabras sobre Pacevo?", cta: "Escribir mi opinión", plusTard: "Más tarde", jamais: "No, gracias" },
  pt: { question: "Uma palavra sobre a Pacevo?", cta: "Escrever a minha avaliação", plusTard: "Mais tarde", jamais: "Não, obrigado" },
};

export function InviteAvis({ afficher }: { afficher: boolean }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!afficher) return;
    let brut: string | null = null;
    try { brut = localStorage.getItem(CLE_INVITE); } catch { /* stockage refusé : on propose */ }
    setVisible(doitAfficher(lireEtat(brut)));
  }, [afficher]);

  if (!visible) return null;

  const memoriser = (etat: object) => {
    setVisible(false);
    try { localStorage.setItem(CLE_INVITE, JSON.stringify(etat)); } catch { /* rien à conserver */ }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-zinc-200">
      <Star aria-hidden className="h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" />
      <span className="text-sm font-medium text-zinc-700">{t.question}</span>
      <Link
        href="/avis"
        className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
      >
        {t.cta}
      </Link>
      {/* « Plus tard » se retire un mois ; « Non merci » ne revient jamais. */}
      <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
        <button onClick={() => memoriser(reporter())} className="transition-colors hover:text-zinc-600">{t.plusTard}</button>
        <span aria-hidden>·</span>
        <button onClick={() => memoriser(refuser())} className="transition-colors hover:text-zinc-600">{t.jamais}</button>
      </div>
    </div>
  );
}
