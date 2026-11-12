// ─────────────────────────────────────────────────────────────────────────────
//  LE BANDEAU « DONNÉES INCOMPLÈTES » — le coureur sait qu'une lecture a échoué (12/11/2026).
//
//  `signalerLectures` journalise les pannes pour l'admin ; ce bandeau les DIT au coureur, sur
//  chaque écran qui affiche une VMA, un niveau, des zones ou des allures. Sans lui, la VMA
//  retombait sur un autre chiffre, les zones disparaissaient, sans un mot : de quoi croire que
//  ses données sont perdues, ou se fier à un chiffre faux. Même texte et même allure que le
//  bandeau du tableau de bord (`dash.incomplet`), dans les 5 langues.
//
//  Composant SERVEUR, sans état : il ne fait qu'afficher ce qu'on lui passe.
// ─────────────────────────────────────────────────────────────────────────────
import { AlertTriangle } from "lucide-react";
import { T, fill, type Lang } from "@/lib/i18n/translations";

/** Rien quand rien n'est en panne ; sinon une phrase qui nomme ce qui manque. */
export function BandeauPanne({ lectures, lang }: { lectures: readonly string[]; lang: Lang }) {
  if (!lectures.length) return null;
  const d = T[lang] ?? T.fr;
  // Un identifiant sans libellé n'affiche pas sa clé brute : « tes données » en général.
  const quoi = [...new Set(lectures)].map((k) => d[`dash.inc.${k}`]).filter((l): l is string => !!l).join(", ") || d["dash.inc.donnees"];
  return (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
      <p className="text-rose-800">{fill(d["dash.incomplet"], { quoi })}</p>
    </div>
  );
}
