import { CLE_EN_COURS, CLE_ATTENTE } from "@/lib/courses/horsLigne";

/**
 * SE DÉCONNECTER, PROPREMENT — une seule fonction pour la barre latérale, la barre du
 * haut et la barre d'onglets du téléphone.
 *
 * ⚠️ ELLE VIDE CE QUE LE TÉLÉPHONE GARDE : depuis que la page « Enregistrer » est
 * conservée hors ligne par le service worker (elle contient les séances de l'athlète), et
 * que les courses attendent le réseau dans localStorage, une déconnexion sans ménage
 * laisserait les données d'une personne à la suivante sur le même appareil.
 */
export async function deconnexion(): Promise<void> {
  // Import PARESSEUX : le client Supabase (≈ 220 kB de JS) ne se charge qu'au clic sur
  // « Déconnexion », pas à chaque page où vit un bouton de déconnexion (toutes).
  try { const { createClient } = await import("@/lib/supabase/client"); await createClient().auth.signOut(); } catch { /* la session est peut-être déjà morte */ }
  try { localStorage.removeItem(CLE_EN_COURS); localStorage.removeItem(CLE_ATTENTE); } catch { /* stockage refusé */ }
  try {
    if (typeof caches !== "undefined") for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* pas de cache */ }
}
