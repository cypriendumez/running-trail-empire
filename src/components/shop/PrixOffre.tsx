/**
 * LE BLOC PRIX D'UNE CARTE — ce qu'on a relevé, chez qui, et quand.
 *
 * ⚠️ TROIS CHIFFRES DIFFÉRENTS NE DOIVENT JAMAIS SE CONFONDRE :
 *   · le PRIX RELEVÉ chez un marchand, daté et attribué — c'est l'offre ;
 *   · le PRIX PUBLIC CONSEILLÉ du fabricant — ce n'est pas une offre, il sert de
 *     référence pour calculer une remise, et il est étiqueté comme tel ;
 *   · rien du tout, quand aucun prix n'a été relevé — et alors on l'écrit.
 * L'ancienne boutique affichait 1 167 prix INVENTÉS attribués à de vraies enseignes ;
 * c'est cette confusion-là qu'on interdit ici, pas l'affichage d'un prix.
 */
import { remisePourcent, estFraiche, type Offre } from "@/lib/shop/offres";

export function PrixOffre({ offre, conseille, tx, compact = false }: {
  offre: Offre | null;
  conseille: number | null | undefined;
  tx: (k: string, p?: Record<string, string | number>) => string;
  compact?: boolean;
}) {
  const remise = offre ? remisePourcent(Number(offre.price), conseille) : null;

  if (!offre) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] text-zinc-400">{tx("shop.offre.aucune")}</span>
        {conseille != null && (
          <span className="text-[12px] text-zinc-400">{tx("shop.conseille_court", { prix: conseille })}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[19px] font-semibold tracking-tight text-zinc-900">
          {Number(offre.price).toFixed(2).replace(".", ",")} €
        </span>
        {remise != null && (
          <>
            <span className="text-[13px] text-zinc-400 line-through">{conseille} €</span>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[12px] font-semibold text-emerald-700">
              −{remise} %
            </span>
          </>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-zinc-400">
        <span>{tx("shop.offre.chez", { marchand: offre.retailer })}</span>
        {/* La date n'est pas un détail : un prix sans date ne se vérifie pas. */}
        <span>· {tx("shop.offre.releve", { date: dateCourte(offre.updated_at) })}</span>
        {offre.in_stock === false && <span className="text-amber-600">· {tx("shop.indisponible")}</span>}
        {!estFraiche(offre) && <span className="text-amber-600">· {tx("shop.offre.aucune")}</span>}
      </div>
      {!compact && (
        <a href={offre.url} target="_blank" rel="nofollow sponsored noopener noreferrer"
          className="mt-2 inline-flex rounded-lg bg-zinc-900 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700">
          {tx("shop.voir_offre")}
        </a>
      )}
    </div>
  );
}

/** ⚠️ « 2026-09-02 » se lit comme un identifiant technique, pas comme une date. */
export function dateCourte(iso: unknown): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : "—";
}
