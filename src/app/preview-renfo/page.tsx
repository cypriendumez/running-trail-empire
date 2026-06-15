// TEMPORARY throwaway route to SSR-verify RenfoGuide i18n. Delete after curl.
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { RenfoGuide } from "@/components/training/RenfoGuide";

export default function PreviewRenfoPage() {
  return (
    <LanguageProvider initialLang="fr">
      <RenfoGuide />
    </LanguageProvider>
  );
}
