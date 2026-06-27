import type { Metadata } from "next";
import { LegalContent } from "@/components/legal/LegalContent";

export const metadata: Metadata = {
  title: "Conditions générales (CGU / CGV) | Pacevo",
  description: "Conditions générales d'utilisation et de vente de Pacevo.",
};

// Page PUBLIQUE (CGU + conditions d'abonnement). ⚠️ Adapte les montants/durées (dans legalI18n.ts) à ton offre réelle.
export default function TermsPage() {
  return <LegalContent page="terms" date="10/06/2026" />;
}
