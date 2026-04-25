export const dynamic = "force-dynamic";
import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Running & Trail Empire",
    template: "%s | Running & Trail Empire",
  },
  description:
    "Le compagnon intelligent pour les coureurs et traileurs. Plans IA, analyse biomécanique, courses France, Trail Builder.",
  keywords: [
    "running", "trail", "course à pied", "entraînement", "plan d'entraînement",
    "VMA", "biomécanique", "GPX", "Garmin", "Coros", "UTMB",
  ],
  authors: [{ name: "Running & Trail Empire" }],
  creator: "Running & Trail Empire",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "Running & Trail Empire",
    description: "L'application hégémonique du running et du trail.",
    siteName: "Running & Trail Empire",
  },
  twitter: {
    card: "summary_large_image",
    title: "Running & Trail Empire",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${barlow.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
