export const dynamic = "force-dynamic";
import type { Metadata, Viewport } from "next";
import { Inter, Anton } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { ErrorReporter } from "@/components/ErrorReporter";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getPublicLang } from "@/lib/i18n/serverLang";

// Polices réellement chargées (avant : variables jamais définies → tout en system-ui).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Pacevo",
    template: "%s | Pacevo",
  },
  // Description remaniée avec le slogan : c'est la ligne que Google affiche sous le titre.
  // L'ancienne énumérait des fonctions (« Plans IA, analyse biomécanique… ») sans jamais
  // dire ce que l'app FAIT concrètement pour le coureur, ni d'où vient le nom.
  description:
    "Tes données servent enfin à quelque chose. Ta montre mesure VFC, sommeil et charge : Pacevo en fait une séance recalculée à chaque synchronisation.",
  keywords: [
    "running", "trail", "course à pied", "entraînement", "plan d'entraînement",
    "VMA", "biomécanique", "GPX", "Garmin", "Coros", "UTMB",
  ],
  authors: [{ name: "Pacevo" }],
  creator: "Pacevo",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "Pacevo — Tes données servent enfin à quelque chose.",
    // « L'application hégémonique du running et du trail » : une affirmation que rien ne
    // soutient, servie à chaque partage de lien. Remplacée par ce que fait le produit.
    description: "Ta montre mesure déjà tout : VFC, sommeil, charge, allures. Pacevo en fait une séance recalculée à chaque synchronisation.",
    siteName: "Pacevo",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pacevo — Tes données servent enfin à quelque chose.",
    // « L'application hégémonique du running et du trail » : une affirmation que rien ne
    // soutient, servie à chaque partage de lien. Remplacée par ce que fait le produit.
    description: "Ta montre mesure déjà tout : VFC, sommeil, charge, allures. Pacevo en fait une séance recalculée à chaque synchronisation.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getPublicLang();
  return (
    <html lang={lang} className={`${inter.variable} ${anton.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <ErrorReporter />
        <LanguageProvider initialLang={lang}>
          <Providers>{children}</Providers>
        </LanguageProvider>
      </body>
    </html>
  );
}
