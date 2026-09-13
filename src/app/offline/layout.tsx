import type { Metadata } from "next";

/**
 * ⚠️ LE TITRE VIT ICI PARCE QUE LA PAGE EST UN COMPOSANT CLIENT. Next interdit d'exporter
 * `metadata` depuis un fichier « use client » ; un `layout.tsx` voisin le porte, comme pour
 * /onboarding. Sans titre, l'onglet afficherait « Pacevo » sans plus de précision.
 */
export const metadata: Metadata = { title: "Hors-ligne" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
