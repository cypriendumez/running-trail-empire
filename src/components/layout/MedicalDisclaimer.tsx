import { T, normLang } from "@/lib/i18n/translations";

// Avertissement santé affiché en bas de chaque page du dashboard (l'app donne des conseils
// d'entraînement via l'IA → ne pas se présenter comme dispositif médical).
//
// Il reste un composant SERVEUR : la langue arrive en prop depuis le layout, qui connaît
// déjà `profiles.preferred_language`. Le basculer en client pour un texte figé aurait
// envoyé du JavaScript sur chaque page du dashboard sans rien y gagner.
export function MedicalDisclaimer({ lang }: { lang?: string }) {
  const d = T[normLang(lang)] ?? T.fr;
  return (
    /* ⚠️ RÉSERVE À DROITE POUR LA BULLE D'AIDE. Elle est en `fixed bottom-5 right-5`,
       fait 56 px et flotte donc au-dessus de ce pied de page : sur une ligne pleine, elle
       recouvrait le dernier lien — « Confidentialité », c'est-à-dire précisément celui
       qu'un utilisateur cherche et qu'un contrôle RGPD vérifie. On réserve la place au
       lieu de déplacer la bulle : sa position en bas à droite est la convention, c'est au
       texte de céder. `pe-20` seulement à partir de `sm` — sur mobile la ligne se replie
       sur plusieurs lignes et la dernière ne finit pas dans le coin. */
    <footer className="shrink-0 border-t border-zinc-100 bg-white px-6 py-2.5 sm:pe-20">
      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
        ⚕️ {d["med.intro"]}
        <b className="font-semibold text-zinc-500"> {d["med.strong"]}</b>. {d["med.after"]} ·{" "}
        <a href="/mentions-legales" className="hover:text-zinc-600 underline-offset-2 hover:underline">{d["med.legal"]}</a> ·{" "}
        <a href="/terms" className="hover:text-zinc-600 underline-offset-2 hover:underline">{d["med.terms"]}</a> ·{" "}
        <a href="/confidentialite" className="hover:text-zinc-600 underline-offset-2 hover:underline">{d["med.privacy"]}</a>
      </p>
    </footer>
  );
}
