// ─────────────────────────────────────────────────────────────────────────────
//  SIGNALER LES LECTURES EN PANNE — dans le journal que Cyprien lit (onglet Bugs de /admin).
//
//  Relecture du 12/11/2026 : sur les écrans qui affichent une VMA, un niveau, un volume ou des
//  zones cardiaques, des lectures en panne passaient pour « aucune donnée », et celles qui étaient
//  lues ne finissaient que dans les journaux du serveur (`console.error`), que personne ne lit.
//  Une seule porte désormais : la panne RÉELLE (`estUnePanne` : « aucune ligne », PGRST116, n'en
//  est pas une) part dans `error_logs`, une fois par jour et par message, et l'écran reçoit le nom
//  des lectures touchées pour le dire s'il le veut.
//
//  ⚠️ SERVEUR SEULEMENT (client admin du journal) : jamais importé par un composant client.
// ─────────────────────────────────────────────────────────────────────────────
import { estUnePanne, type Lecture } from "@/lib/dashboard/lectures";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";

type LectureErreur = { error: (Lecture["error"] & { message?: string }) | null };

/**
 * Journalise les lectures RÉELLEMENT en panne et rend leurs noms (vide dans le cas normal, compte
 * tout neuf compris). `ecran` et les noms sont des identifiants stables, sans accent : le message
 * reste le même d'une panne à l'autre, et la déduplication du journal fonctionne.
 */
export async function signalerLectures(
  ecran: string, userId: string | null, entrees: [string, LectureErreur | null | undefined][],
  /** Le journal : `journaliserEchecUneFois` en vrai ; injecté par les tests, qui n'écrivent jamais en base. */
  journal: (e: { source: string; message: string; userId: string | null }) => Promise<void> = (e) => journaliserEchecUneFois(null, e),
): Promise<string[]> {
  const enPanne = entrees.filter(([, l]) => estUnePanne(l ?? null));
  if (!enPanne.length) return [];
  const message = `lectures illisibles : ${enPanne.map(([nom, l]) => `${nom} (${l?.error?.code ?? "?"})`).join(", ")}`;
  console.error(`[${ecran}]`, message, enPanne.map(([, l]) => l?.error?.message).join(" | "));
  await journal({ source: ecran, message, userId });
  return enPanne.map(([nom]) => nom);
}
