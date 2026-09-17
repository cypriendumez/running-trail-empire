"use client";
import { useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * DONNER SON AVIS — depuis l'application, parce que c'est le SEUL endroit d'où c'est
 * possible.
 *
 * ⚠️ PORTE INVERSÉE, CONSTATÉE LE 17/09/2026. `/api/avis` refuse toute soumission
 * anonyme : seuls les comptes peuvent écrire un avis. Or `/avis` n'était atteignable que
 * depuis la landing et le pied de page PUBLIC — jamais depuis l'espace connecté. Les
 * seules personnes autorisées à écrire étaient donc exactement celles qui ne voyaient
 * jamais le lien, ce qui explique à lui seul les zéro avis en base. Même motif que la
 * boutique dont la porte s'ouvrait du mauvais côté.
 *
 * ⚠️ ET ON NE LE DEMANDE PAS À N'IMPORTE QUEL MOMENT. Un avis réclamé à quelqu'un qui
 * vient de s'inscrire ne vaut rien — ni pour lui (il n'a rien à dire), ni pour les
 * lecteurs, ni au regard de la directive (UE) 2019/2161, qui n'admet que des avis
 * d'utilisateurs réels du produit. Le serveur ne l'affiche donc qu'au-delà d'un seuil de
 * séances réellement synchronisées, et jamais à qui en a déjà écrit un.
 *
 * Le report est stocké dans le navigateur : c'est un confort par visiteur, pas une
 * donnée à conserver. `try/catch` obligatoire — `localStorage` lève en navigation privée
 * ou quand les données de site sont bloquées, et une invitation ne doit pas casser le
 * tableau de bord.
 */
const CLE_REPORT = "pacevo.avis.plusTard";

const T: Record<string, { titre: string; texte: string; cta: string; plusTard: string; fermer: string }> = {
  fr: {
    titre: "Ton avis compte vraiment",
    texte: "Tu utilises Pacevo depuis quelques séances. Un mot sur ce qui t'a servi — et sur ce qui t'a manqué — aide autant les prochains coureurs que moi.",
    cta: "Écrire mon avis", plusTard: "Plus tard", fermer: "Masquer",
  },
  en: {
    titre: "Your feedback genuinely matters",
    texte: "You have been using Pacevo for a few sessions now. A word on what helped — and what was missing — helps the next runners as much as it helps me.",
    cta: "Write my review", plusTard: "Later", fermer: "Hide",
  },
  de: {
    titre: "Deine Meinung zählt wirklich",
    texte: "Du nutzt Pacevo jetzt seit einigen Einheiten. Ein Wort dazu, was geholfen hat — und was gefehlt hat — hilft den nächsten Läufern so viel wie mir.",
    cta: "Bewertung schreiben", plusTard: "Später", fermer: "Ausblenden",
  },
  es: {
    titre: "Tu opinión cuenta de verdad",
    texte: "Llevas ya unas cuantas sesiones usando Pacevo. Unas palabras sobre lo que te sirvió — y lo que faltó — ayudan tanto a los próximos corredores como a mí.",
    cta: "Escribir mi opinión", plusTard: "Más tarde", fermer: "Ocultar",
  },
  pt: {
    titre: "A tua opinião conta a sério",
    texte: "Já usas a Pacevo há algumas sessões. Umas palavras sobre o que te ajudou — e o que faltou — ajudam tanto os próximos corredores como a mim.",
    cta: "Escrever a minha avaliação", plusTard: "Mais tarde", fermer: "Ocultar",
  },
};

export function InviteAvis({ afficher }: { afficher: boolean }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const [masque, setMasque] = useState(() => {
    try { return localStorage.getItem(CLE_REPORT) === "1"; } catch { return false; }
  });

  if (!afficher || masque) return null;

  const reporter = () => {
    setMasque(true);
    try { localStorage.setItem(CLE_REPORT, "1"); } catch { /* rien à conserver : le report est un confort */ }
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-inset ring-zinc-200">
      <button
        onClick={reporter}
        aria-label={t.fermer}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-500"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </span>
        <div className="min-w-0 pr-8">
          <h3 className="text-base font-bold text-zinc-900">{t.titre}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{t.texte}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/avis"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              <Star className="h-4 w-4" /> {t.cta}
            </Link>
            <button onClick={reporter} className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600">
              {t.plusTard}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
