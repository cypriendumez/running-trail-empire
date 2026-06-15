"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { SettingsView } from "@/components/settings/SettingsView";

// Route de prévisualisation (non gardée) — voir SettingsView avec des données fictives.
// Bloquée à l'indexation via robots.txt (/preview-*).
export default function P() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <LanguageProvider initialLang="fr">
        <SettingsView
          profile={{ full_name: "Cyprien Dumez", avatar_url: "", intervals_athlete_id: "i564686", subscription_tier: "free", created_at: "2026-01-01T00:00:00Z" }}
          email="cyprien@example.com"
          userId="preview"
          settings={{ avatarColor: "emerald", unitSystem: "metric", weekStart: "mon" }}
        />
      </LanguageProvider>
    </div>
  );
}
