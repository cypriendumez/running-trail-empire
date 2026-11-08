import { GraduationCap } from "lucide-react";
import { EDITEUR } from "@/lib/brand/editeur";
import { REMISE_ETUDIANTE_PCT } from "@/lib/billing/prix";

/**
 * Le tarif étudiant, sous les cartes de l'accueil et de /pricing — voir `REMISE_ETUDIANTE_PCT`.
 *
 * Le code se DEMANDE (adresse étudiante ou certificat de scolarité) : un code public finirait
 * sur un site de bons plans. L'adresse vient de `EDITEUR`, jamais recopiée.
 */
export function OffreEtudiante({ texte, cta, sujet }: { texte: string; cta: string; sujet: string }) {
  return (
    <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center sm:flex-row sm:text-left">
      <GraduationCap className="h-5 w-5 flex-shrink-0 text-[#059669]" />
      <p className="flex-1 text-sm leading-relaxed text-zinc-700">{texte.replace("{pct}", String(REMISE_ETUDIANTE_PCT))}</p>
      <a href={`mailto:${EDITEUR.email}?subject=${encodeURIComponent(sujet)}`}
        className="whitespace-nowrap text-sm font-semibold text-[#047857] underline-offset-2 hover:underline">
        {cta}
      </a>
    </div>
  );
}
