import type { Metadata } from "next";
import { LegalContent } from "@/components/legal/LegalContent";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment Pacevo collecte, utilise et protège tes données personnelles (RGPD).",
  alternates: { canonical: "/confidentialite" },
};

// Page PUBLIQUE (URL à fournir à Apple App Store / Google Play).
// ⚠️ Remplace les [À RENSEIGNER] (dans legalI18n.ts) par tes informations réelles avant publication.
export default function ConfidentialitePage() {
  return <LegalContent page="privacy" date="08/11/2026" />;
}
