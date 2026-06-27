import type { Metadata } from "next";
import { LegalContent } from "@/components/legal/LegalContent";

export const metadata: Metadata = {
  title: "Mentions légales | Pacevo",
  description: "Mentions légales de Pacevo (éditeur, hébergeur, contact).",
};

// Page PUBLIQUE. ⚠️ Remplace les [À RENSEIGNER] (dans legalI18n.ts) par tes informations réelles avant publication.
export default function MentionsLegalesPage() {
  return <LegalContent page="mentions" date="10/06/2026" />;
}
