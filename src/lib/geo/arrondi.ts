/**
 * LA POSITION D'UN COUREUR, ARRONDIE AVANT DE QUITTER SON APPAREIL (28/11/2026).
 *
 * Au centième de degré (≈ 1 km) : assez pour une météo, un nom de ville ou trier des parcours
 * « près de moi », pas assez pour désigner un domicile. Toute position qui part vers un service
 * tiers (Open-Meteo, BigDataCloud) ou dans une adresse de requête (`/api/parcours?near=…`, donc
 * dans les journaux de requêtes de l'hébergeur) passe par ici.
 *
 * Défaut d'origine : la puce météo envoyait la position au mètre près, et un rapport CSP l'a
 * enregistrée dans `error_logs` ; la recherche de parcours la mettait dans l'adresse à ≈ 11 m.
 */
export const arrondiPosition = (x: number) => Math.round(x * 100) / 100;
