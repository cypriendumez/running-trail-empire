"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { CLE_INVITE, doitAfficher, lireEtat, refuser, reporter } from "@/lib/avis/invite";

/**
 * DONNER SON AVIS — une petite carte à étoiles, au BON MOMENT (refaite le 09/11/2026).
 *
 * Avant : une barre « Un mot sur Pacevo ? » posée sous le tableau de bord, à n'importe quel
 * moment. Cyprien : « est-ce le meilleur endroit ? comment font les grosses applications ? ».
 * Elles demandent JUSTE APRÈS un moment réussi, en un geste (cinq étoiles), et rarement.
 * D'où :
 *  · le moment est décidé par le serveur : une séance prescrite par le coach, FAITE
 *    aujourd'hui ou hier (`momentFavorable`, lib/avis/invite) ;
 *  · une carte qui monte du bas de l'écran (au-dessus de la barre d'onglets sur téléphone,
 *    au-dessus de la bulle d'aide sur ordinateur) ;
 *  · toucher une étoile ouvre `/avis` avec la note déjà posée. TOUTES les notes y vont :
 *    n'envoyer au public que les 4 et 5 étoiles serait trier les avis (pratique commerciale
 *    trompeuse, directive (UE) 2019/2161 ; interdit aussi par Apple et Google).
 *
 * ⚠️ ELLE NE S'AFFICHE PAS AU PREMIER RENDU, ET C'EST VOLONTAIRE. La décision dépend de
 * `localStorage`, qui n'existe pas côté serveur : la lire dans l'initialiseur d'état
 * produirait une erreur d'hydratation. On ne décide qu'après le montage, et la carte monte
 * deux secondes plus tard : on regarde d'abord sa séance du jour.
 *
 * « Plus tard » (la croix) se retire un mois ; « Ne plus demander » ne revient jamais. La
 * logique vit dans `lib/avis/invite`, à part et pure : elle mérite d'être testée.
 */
const T: Record<string, { titre: string; sous: string; plusTard: string; jamais: string; sur5: string }> = {
  fr: { titre: "Comment tu trouves Pacevo ?", sous: "Belle séance. Ta note aide d'autres coureurs à choisir.", plusTard: "Plus tard", jamais: "Ne plus demander", sur5: "sur 5" },
  en: { titre: "How do you like Pacevo?", sous: "Nice session. Your rating helps other runners choose.", plusTard: "Later", jamais: "Don't ask again", sur5: "out of 5" },
  de: { titre: "Wie gefällt dir Pacevo?", sous: "Starke Einheit. Deine Bewertung hilft anderen Läufern bei der Wahl.", plusTard: "Später", jamais: "Nicht mehr fragen", sur5: "von 5" },
  es: { titre: "¿Qué te parece Pacevo?", sous: "Buena sesión. Tu nota ayuda a otros corredores a elegir.", plusTard: "Más tarde", jamais: "No volver a preguntar", sur5: "de 5" },
  pt: { titre: "O que achas da Pacevo?", sous: "Boa sessão. A tua nota ajuda outros corredores a escolher.", plusTard: "Mais tarde", jamais: "Não perguntar mais", sur5: "em 5" },
};

/** Délai avant que la carte monte : le temps de lire sa séance du jour. */
const DELAI_MS = 2000;

export function InviteAvis({ afficher }: { afficher: boolean }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const [visible, setVisible] = useState(false);
  const [entree, setEntree] = useState(false);
  const [survol, setSurvol] = useState<number | null>(null);

  useEffect(() => {
    if (!afficher) return;
    let brut: string | null = null;
    try { brut = localStorage.getItem(CLE_INVITE); } catch { /* stockage refusé : on propose */ }
    if (!doitAfficher(lireEtat(brut))) return;
    const minuterie = window.setTimeout(() => {
      setVisible(true);
      // Deux images plus tard : la carte est dans le DOM, sa transition peut jouer.
      requestAnimationFrame(() => requestAnimationFrame(() => setEntree(true)));
    }, DELAI_MS);
    return () => window.clearTimeout(minuterie);
  }, [afficher]);

  if (!visible) return null;

  const memoriser = (etat: object) => {
    try { localStorage.setItem(CLE_INVITE, JSON.stringify(etat)); } catch { /* rien à conserver */ }
  };
  const fermer = (etat: object) => { memoriser(etat); setVisible(false); };

  return (
    <div
      role="dialog" aria-labelledby="invite-avis-titre" data-bulle-aide
      className={`fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-50 rounded-2xl bg-white p-5 ring-1 ring-inset ring-zinc-200 shadow-[0_24px_60px_-15px_rgba(16,24,40,0.35)] motion-safe:transition-[opacity,transform] motion-safe:duration-300 md:inset-x-auto md:bottom-[4.25rem] md:right-3 md:w-[22rem] ${entree ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="invite-avis-titre" className="text-[15px] font-semibold text-zinc-900">{t.titre}</h2>
        <button onClick={() => fermer(reporter())} aria-label={t.plusTard}
          className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm leading-snug text-zinc-500">{t.sous}</p>

      {/* Toucher une étoile = choisir sa note ; la page des avis s'ouvre avec elle. On se
          retire un mois : si l'avis n'est pas écrit, on ne relance pas dès demain. */}
      <div className="mt-4 flex items-center gap-1" onMouseLeave={() => setSurvol(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Link
            key={n} href={`/avis?note=${n}`} aria-label={`${n} ${t.sur5}`}
            onMouseEnter={() => setSurvol(n)} onFocus={() => setSurvol(n)} onBlur={() => setSurvol(null)}
            onClick={() => memoriser(reporter())}
            className="rounded-lg p-1 outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-90"
          >
            <Star className={`h-8 w-8 transition-colors ${survol != null && n <= survol ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`} strokeWidth={1.5} />
          </Link>
        ))}
      </div>

      <button onClick={() => fermer(refuser())} className="mt-3 text-xs text-zinc-400 transition-colors hover:text-zinc-600">{t.jamais}</button>
    </div>
  );
}
