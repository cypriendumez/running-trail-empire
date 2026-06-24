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
  description:
    "Le compagnon intelligent pour les coureurs et traileurs. Plans IA, analyse biomécanique, courses France, Trail Builder.",
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
    title: "Pacevo",
    description: "L'application hégémonique du running et du trail.",
    siteName: "Pacevo",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pacevo",
    description: "L'application hégémonique du running et du trail.",
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
