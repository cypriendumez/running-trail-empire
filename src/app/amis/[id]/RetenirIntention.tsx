"use client";
import { useEffect } from "react";
import { CLE_SUIVRE } from "@/components/social/AjouterAmis";

/**
 * Dépose l'intention « suivre cet athlète » dans le stockage local du navigateur.
 * L'annuaire (`AjouterAmis`) la consomme à la première ouverture après connexion ou
 * inscription — y compris après l'e-mail de confirmation et le questionnaire, que le
 * paramètre `next` de /login ne traverserait pas.
 */
export function RetenirIntention({ id }: { id: string }) {
  useEffect(() => {
    try { localStorage.setItem(CLE_SUIVRE, id); } catch { /* stockage indisponible : l'ami retrouvera l'athlète par la recherche */ }
  }, [id]);
  return null;
}
