"use client";
import { useState } from "react";
import { liensStore } from "@/lib/brand/stores";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Le texte alternatif suit la LANGUE DE LA PAGE, pas celle de l'image.
 *
 * ⚠️ Apple et Google fournissent leur badge dans chaque langue. Si tu déposes la version
 * française, un visiteur allemand verra une image en français — c'est acceptable, et
 * corrigeable en ajoutant `app-store-de.svg` & co. Ce qui ne l'est pas, c'est un `alt`
 * en dur : un lecteur d'écran lit ce texte, et lui seul.
 */
const ALT: Record<string, { ios: string; android: string }> = {
  fr: { ios: "Télécharger dans l'App Store", android: "Disponible sur Google Play" },
  en: { ios: "Download on the App Store", android: "Get it on Google Play" },
  de: { ios: "Laden im App Store", android: "Jetzt bei Google Play" },
  es: { ios: "Consíguelo en el App Store", android: "Disponible en Google Play" },
  pt: { ios: "Descarregar na App Store", android: "Disponível no Google Play" },
};

/**
 * Les badges des boutiques d'applications.
 *
 * ⚠️ Ils n'apparaissent que si l'adresse correspondante est renseignée — l'application
 * n'étant publiée nulle part à ce jour, un badge visible mènerait à une page d'erreur.
 * Voir `lib/brand/stores` pour les deux variables à poser sur Vercel.
 *
 * ⚠️ Les images sont les artworks OFFICIELS d'Apple et de Google, jamais des
 * reconstitutions : les deux chartes l'interdisent. Voir `public/badges/README.md`.
 */
export function StoreBadges({ className = "" }: { className?: string }) {
  const { lang } = useT();
  const alt = ALT[lang] ?? ALT.fr;
  // `liensStore()` lit `process.env`, remplacé à la compilation pour les clés
  // `NEXT_PUBLIC_*` : la valeur est donc bien celle du déploiement, pas du navigateur.
  const { ios, android } = liensStore({
    NEXT_PUBLIC_APP_STORE_URL: process.env.NEXT_PUBLIC_APP_STORE_URL,
    NEXT_PUBLIC_PLAY_STORE_URL: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
  });
  if (!ios && !android) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {ios && <Badge href={ios} img="/badges/app-store.svg" label={alt.ios} />}
      {android && <Badge href={android} img="/badges/google-play.png" label={alt.android} />}
    </div>
  );
}

/**
 * Un badge, avec REPLI SUR DU TEXTE si l'image officielle n'a pas été déposée.
 *
 * ⚠️ Sans ce repli, poser les adresses sans les fichiers affichait deux images cassées
 * sur toutes les pages publiques — et rien ne l'aurait signalé, une image manquante
 * n'étant pas une erreur. Deux conditions à réunir, c'est une de trop : le jour de la
 * publication on pense aux liens, pas aux fichiers.
 *
 * Le repli n'est pas une reconstitution du badge — Apple comme Google l'interdisent :
 * c'est un bouton de texte, ce que leurs chartes autorisent explicitement.
 */
function Badge({ href, img, label }: { href: string; img: string; label: string }) {
  const [casse, setCasse] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      className={casse ? "rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800" : ""}>
      {casse ? label : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={label} className="h-11 w-auto" loading="lazy" onError={() => setCasse(true)} />
      )}
    </a>
  );
}
