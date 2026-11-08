import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aConsenti } from "@/lib/auth/consentement";

/**
 * ⚠️ LE TITRE VIT ICI PARCE QUE LA PAGE EST UN COMPOSANT CLIENT. Next interdit
 * d'exporter `metadata` depuis un fichier « use client » : il doit être résolu sur le
 * serveur AVANT le rendu. Un `layout.tsx` voisin le porte donc, sans rien refactorer.
 *
 * ⚠️ ET CETTE ERREUR NE SE VOIT QU'AU BUILD : `tsc` passe, la suite de tests passe.
 * C'est ce qui distingue `npm run verify` de `npm run build`.
 */
export const metadata: Metadata = { title: "Premiers pas" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // L'onboarding demande des données de santé (VMA, FC, douleurs) : pas sans accord
  // enregistré. Un compte neuf ouvert avec Google depuis la CONNEXION arrive ici sans
  // avoir vu la case de l'inscription. Voir `lib/auth/consentement`.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && !aConsenti(user.app_metadata)) redirect("/consentement?next=/onboarding");
  return <>{children}</>;
}
