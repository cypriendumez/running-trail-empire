import type { Metadata } from "next";

// Le titre vit ici parce que la page est un composant client (voir onboarding/layout.tsx).
export const metadata: Metadata = { title: "Ton accord", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
