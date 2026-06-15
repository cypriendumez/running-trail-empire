"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { CommunityFeed } from "@/components/community/CommunityFeed";

// Route de prévisualisation (non gardée, bloquée via robots /preview-*) pour vérifier
// l'habillage photo du fil Communauté.
export default function P() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <LanguageProvider initialLang="fr">
        <CommunityFeed />
      </LanguageProvider>
    </div>
  );
}
