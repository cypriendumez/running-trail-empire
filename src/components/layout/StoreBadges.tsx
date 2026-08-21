"use client";
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
      {ios && (
        <a href={ios} target="_blank" rel="noopener noreferrer" aria-label="App Store">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badges/app-store.svg" alt={alt.ios} className="h-11 w-auto" loading="lazy" />
        </a>
      )}
      {android && (
        <a href={android} target="_blank" rel="noopener noreferrer" aria-label="Google Play">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badges/google-play.png" alt={alt.android} className="h-11 w-auto" loading="lazy" />
        </a>
      )}
    </div>
  );
}
