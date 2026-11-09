import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";

/**
 * Une trace GPS illisible n'est pas une séance sans trace : la page se tait (ni carte ni
 * arrêts), mais l'échec part dans `error_logs`, une fois par jour (la page se recharge
 * souvent). Le libellé, lu par Cyprien dans l'onglet Bugs, vit ici et non dans l'écran :
 * un écran athlète ne porte aucun texte français en dur (tests/i18n).
 */
export async function journaliserTraceIllisible(
  userId: string, url: string, e: { code?: string | null; message: string },
): Promise<void> {
  await journaliserEchecUneFois(null, {
    source: "seance-trace", userId, url,
    message: `Trace illisible, carte et arrêts masqués : ${e.code ?? "?"} ${e.message}`,
  });
}
