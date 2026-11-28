/**
 * LE LIEN D'AGENDA DU COMPTE — la logique de « Calendrier Apple » / « Google Agenda » (POST de
 * /api/calendrier/abonnement), à part pour être testée contre une fausse base, courses comprises.
 *
 * RÈGLE : un appui ne COUPE JAMAIS un agenda déjà relié (défaut du 28/11/2026 : un lien recréé
 * pour l'iPhone avait laissé Google sur un lien mort, vide). Donc :
 *   - un lien existe et se recalcule → on le rend, sans rien écrire ;
 *   - aucun lien → on le CRÉE par `insert` (jamais `upsert`) : si un autre appui (double clic,
 *     ordinateur et téléphone en même temps) l'a créé entre-temps, la base refuse (23505) et on
 *     rend le SIEN ;
 *   - un lien existe mais ne se recalcule pas (lien tiré au hasard avant le 28/11, ou serveur dont
 *     la clé diffère : `next dev`, aperçu) → « ancien » : rien n'est écrasé sans demande explicite ;
 *   - `remplacer` (« Changer de lien », confirmé par le coureur) → seul cas où l'ancien est coupé.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { adresseFlux, empreinteJeton, jetonDe, jetonRetrouve, type Liens } from "./jeton";

/** L'adresse vise TOUJOURS le site en ligne : un lien créé depuis un aperçu ou localhost mourrait avec lui. */
export const ORIGINE_FLUX = "https://pacevo.fr";

export type ResultatLien =
  | { k: "liens"; liens: Liens }
  | { k: "ancien" }
  | { k: "indisponible" }
  | { k: "erreur"; message: string };

type Err = { code?: string; message: string } | null;
/** Table absente (migration 042 pas encore passée) : l'écran dit « indisponible », pas « erreur ». */
export const tableAbsente = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const motif = (quoi: string, e: NonNullable<Err>) => `${quoi} : ${e.code ?? "?"} ${e.message}`;

export async function lienDuCompte(
  admin: SupabaseClient, userId: string,
  opts: { remplacer?: boolean; maintenant?: Date; maitre?: string } = {},
): Promise<ResultatLien> {
  const maitre = opts.maitre ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const lire = () => admin.from("calendrier_abonnements").select("cree_le, jeton_empreinte").eq("user_id", userId).maybeSingle();
  const depuis = (ligne: unknown): ResultatLien => {
    const j = jetonRetrouve(userId, ligne as { cree_le?: string | null; jeton_empreinte?: string | null }, maitre);
    return j ? { k: "liens", liens: adresseFlux(ORIGINE_FLUX, j) } : { k: "ancien" };
  };
  try {
    const creeLe = (opts.maintenant ?? new Date()).toISOString();
    const jeton = jetonDe(userId, creeLe, maitre);
    const ligne = { user_id: userId, jeton_empreinte: empreinteJeton(jeton), cree_le: creeLe, derniere_lecture: null };

    if (opts.remplacer) {
      const { error } = await admin.from("calendrier_abonnements").upsert(ligne, { onConflict: "user_id" });
      if (tableAbsente(error)) return { k: "indisponible" };
      if (error) return { k: "erreur", message: motif("Lien non remplacé", error) };
      return { k: "liens", liens: adresseFlux(ORIGINE_FLUX, jeton) };
    }

    const lu = await lire();
    if (tableAbsente(lu.error)) return { k: "indisponible" };
    // Sans savoir s'il existe déjà un lien, en créer un pourrait couper celui d'un agenda : on s'arrête.
    if (lu.error) return { k: "erreur", message: motif("Abonnement illisible avant création", lu.error) };
    if (lu.data) return depuis(lu.data);

    const { error } = await admin.from("calendrier_abonnements").insert(ligne);
    if (!error) return { k: "liens", liens: adresseFlux(ORIGINE_FLUX, jeton) };
    if (tableAbsente(error)) return { k: "indisponible" };
    if (error.code === "23505") {
      // Un autre appui l'a créé entre notre lecture et notre écriture : c'est LE lien du compte.
      const relu = await lire();
      if (relu.error || !relu.data) return { k: "erreur", message: relu.error ? motif("Lien concurrent illisible", relu.error) : "Lien concurrent introuvable" };
      return depuis(relu.data);
    }
    return { k: "erreur", message: motif("Abonnement non créé", error) };
  } catch (e) {
    return { k: "erreur", message: `Jeton non calculé : ${(e as Error).message}` };
  }
}
