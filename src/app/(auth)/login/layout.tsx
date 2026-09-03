import type { Metadata } from "next";

/**
 * ⚠️ LE TITRE VIT ICI PARCE QUE LA PAGE EST UN COMPOSANT CLIENT. Next interdit
 * d'exporter `metadata` depuis un fichier « use client » : il doit être résolu sur le
 * serveur AVANT le rendu. Un `layout.tsx` voisin le porte donc, sans rien refactorer.
 *
 * ⚠️ ET CETTE ERREUR NE SE VOIT QU'AU BUILD : `tsc` passe, la suite de tests passe.
 * C'est ce qui distingue `npm run verify` de `npm run build`.
 */
export const metadata: Metadata = { title: "Connexion" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
