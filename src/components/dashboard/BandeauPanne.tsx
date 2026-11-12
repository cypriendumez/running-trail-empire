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
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { T, fill, type Lang } from "@/lib/i18n/translations";

/** Rien quand rien n'est en panne ; sinon une phrase qui nomme ce qui manque.
 *  `seul` : le bandeau est TOUT l'écran (Jour J sans profil ou sans objectif lisible) — il ne dit
 *  pas « les chiffres ci-dessous » quand il n'y a rien dessous, et offre le retour au tableau de bord.
 *  `cadre` : classes du conteneur qui aligne le bandeau sur la colonne de la page. Le conteneur n'existe
 *  QUE s'il y a une panne : un div vide à marge interne poussait la page de 16 à 24 px sans raison. */
export function BandeauPanne({ lectures, lang, seul = false, cadre }: { lectures: readonly string[]; lang: Lang; seul?: boolean; cadre?: string }) {
  if (!lectures.length) return null;
  const d = T[lang] ?? T.fr;
  // Un identifiant sans libellé n'affiche pas sa clé brute : « tes données » en général.
  const quoi = [...new Set(lectures)].map((k) => d[`dash.inc.${k}`]).filter((l): l is string => !!l).join(", ") || d["dash.inc.donnees"];
  const bandeau = (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
      <div className="text-rose-800">
        <p>{fill(d[seul ? "dash.incomplet.seul" : "dash.incomplet"], { quoi })}</p>
        {seul && <Link href="/dashboard" className="mt-2 inline-block font-semibold underline">{d["act.retour"]}</Link>}
      </div>
    </div>
  );
  return cadre ? <div className={cadre}>{bandeau}</div> : bandeau;
}
