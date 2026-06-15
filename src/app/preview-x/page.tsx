"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { TrailBuilder } from "@/components/trail/TrailBuilder";
import { ParcoursBrowser } from "@/components/parcours/ParcoursBrowser";

export default function P() {
  return (
    <LanguageProvider initialLang="en">
      <TrailBuilder />
      <ParcoursBrowser />
    </LanguageProvider>
  );
}
