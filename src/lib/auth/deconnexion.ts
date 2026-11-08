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
  // ⚠️ ET LE RESTE DE CE QUI EST PERSONNEL (08/11/2026) : brouillons de messages, révisions
  // du cours. Les préférences d'affichage (son, thème) restent. Les parcours `trail_routes`
  // AUSSI : quand la sauvegarde en ligne a échoué, ils ne vivent QUE là (« Enregistré dans
  // CE navigateur seulement ») — les effacer à la déconnexion les détruirait sans retour.
  try {
    const perso = /^(rte:draft:|cours-)/;
    for (const k of Object.keys(localStorage)) if (perso.test(k)) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch { /* stockage refusé */ }
  try {
    if (typeof caches !== "undefined") for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* pas de cache */ }
}
