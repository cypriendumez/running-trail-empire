/**
 * LE CORPS DE LA FICHE MODÈLE.
 *
 * Extrait de la route pour une raison simple : la page est protégée par
 * l'authentification et rendue sur le serveur. Sans ce composant, la seule façon de
 * REGARDER la fiche était de contourner la garde d'accès — c'est-à-dire de vérifier
 * autre chose que ce que voient les athlètes.
 *
 * Composant serveur : il ne fait aucun appel réseau, il ne reçoit que des données déjà
 * lues et une fonction de traduction.
 */
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ChaussureDessin } from "@/components/shop/ChaussureDessin";
import { PhotoMarchand, photoUtilisable } from "@/components/shop/PhotoMarchand";
import { sourcesCitables, type Modele } from "@/lib/shop/modele";
import { usageDe } from "@/lib/shop/usage";
import type { Avis } from "@/lib/shop/pourToi";
import { texteFoulee, type Bout } from "@/components/shop/shopI18n";
import type { Offre } from "@/lib/shop/offres";

/**
 * ⚠️ « 2026-09-02 » N'EST PAS UNE DATE POUR UN LECTEUR. Le format ISO sert au stockage ;
 * affiché tel quel, il se lit comme un identifiant technique et affaiblit la ligne qui
 * dit précisément où et quand la donnée a été relevée.
 */
function dateLisible(iso: string | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

function Ligne({ label, valeur, vide }: { label: string; valeur: string | null; vide: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-0">
      <span className="text-[13px] text-zinc-500">{label}</span>
      <span className={valeur ? "text-[14px] font-semibold text-zinc-900" : "text-[13px] text-zinc-500"}>
        {valeur ?? vide}
      </span>
    </div>
  );
}

export function FicheModele({ m, avis, bouts, manquantes, proches, offres, offresLisibles, best, tx, langue }: {
  m: Modele;
  avis: Avis;
  bouts: Bout[];
  manquantes: string[];
  proches: Modele[];
  offres: Offre[];
  offresLisibles: boolean;
  best: Offre | null;
  tx: (k: string, p?: Record<string, string | number>) => string;
  /** Langue du lecteur : le type de foulée vient des données, il se traduit à part. */
  langue: string;
}) {
  const nc = tx("shop.non_communique");
  const foulee = texteFoulee(langue, m.foulee);
  const usage = usageDe(m);
  const photo = photoUtilisable(best?.image_url);
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6">
      <Link href="/dashboard/shop" className="text-[13px] text-zinc-500 hover:text-zinc-900">← {tx("shop.retour")}</Link>

      <header className="mt-3 mb-6">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{m.marque}</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[34px]">{m.nom}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="neutral">{tx(`shop.t.${m.terrain}`)}</Badge>
          {usage && <Badge tone="neutral">{tx(`shop.u.${usage}`)}</Badge>}
          {m.plaqueCarbone?.valeur && <Badge tone="dark">{tx("shop.plaque")}</Badge>}
          {foulee && <Badge tone="neutral">{foulee}</Badge>}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {/* La photo du flux d'abord — le dessin reste dessous, il dit ce que la photo
              ne montre pas : les épaisseurs réelles, à l'échelle. */}
          {photo && (
            <Card className="p-5">
              <div className="h-[220px]">
                <PhotoMarchand src={photo} alt={`${m.marque} ${m.nom}`} marchand={best!.retailer} className="h-full" />
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="mx-auto max-w-[420px]">
              <ChaussureDessin marque={m.marque} stackTalonMm={m.stackTalonMm?.valeur}
                dropMm={m.dropMm?.valeur} terrain={m.terrain} plaqueCarbone={m.plaqueCarbone?.valeur}
                absent={tx("shop.profil_absent")} className="w-full"
                      description={m.stackTalonMm
                        ? tx("shop.dessin_alt", { marque: m.marque, talon: Math.round(m.stackTalonMm.valeur), avant: Math.round(m.stackTalonMm.valeur - (m.dropMm?.valeur ?? 0)) })
                        : tx("shop.profil_absent")} />
            </div>
            <p className="mt-2 text-[12px] leading-snug text-zinc-500">{tx("shop.dessin_aide")}</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold text-zinc-900">{tx("shop.ce_que_cest")}</h2>
            <div className="space-y-3">
              {bouts.map((b, i) => (
                <p key={i} className="text-[14px] leading-relaxed text-zinc-600">
                  {tx(b.cle, b.params ? Object.fromEntries(Object.entries(b.params).map(([k, v]) =>
                    [k, typeof v === "string" && v.startsWith("shop.") ? tx(v) : v])) : undefined)}
                </p>
              ))}
            </div>
            {manquantes.length > 0 && (
              <p className="mt-4 border-t border-zinc-100 pt-3 text-[12.5px] leading-snug text-zinc-400">
                {tx("shop.non_publie", { liste: manquantes.map((k) => tx(k).toLowerCase()).join(", ") })}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-[15px] font-semibold text-zinc-900">{tx("shop.pour_toi")}</h2>
            <p className="mb-3 text-[14px] font-medium text-zinc-900">{tx(avis.verdict)}</p>
            {avis.pour.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {avis.pour.map((x, i) => <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-zinc-600"><span className="text-emerald-600">+</span>{tx(x.cle, x.params)}</li>)}
              </ul>
            )}
            {avis.contre.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {avis.contre.map((x, i) => <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-zinc-600"><span className="text-amber-600">−</span>{tx(x.cle, x.params)}</li>)}
              </ul>
            )}
            {avis.inconnu.length > 0 && (
              <p className="border-t border-zinc-100 pt-3 text-[12.5px] leading-snug text-zinc-400">
                {tx("shop.pas_pris", { liste: avis.inconnu.map((x) => tx(x.cle, x.params)).join(" · ") })}
              </p>
            )}
          </Card>

          {proches.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-[15px] font-semibold text-zinc-900">{tx("shop.proches")}</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {proches.map((p) => (
                  <Link key={p.slug} href={`/dashboard/shop/${p.slug}`}
                    className="rounded-xl p-3 ring-1 ring-inset ring-zinc-200 transition hover:ring-zinc-400">
                    <div className="text-[11px] uppercase tracking-wider text-zinc-500">{p.marque}</div>
                    <div className="text-[14px] font-semibold text-zinc-900">{p.nom}</div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                      {p.poidsG ? `${p.poidsG.valeur} g` : "—"} · {p.dropMm != null ? `${p.dropMm.valeur} mm` : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-2 text-[15px] font-semibold text-zinc-900">{tx("shop.caracteristiques")}</h2>
            <Ligne label={tx("shop.spec.poids")} valeur={m.poidsG ? `${m.poidsG.valeur} g` : null} vide={nc} />
            {m.poidsG?.autre != null && (
              <p className="-mt-1 pb-2 text-[11.5px] leading-snug text-zinc-400">
                {tx("shop.poids_ecart", { autre: m.poidsG.autre })}
              </p>
            )}
            <Ligne label={tx("shop.spec.drop")} valeur={m.dropMm != null ? `${m.dropMm.valeur} mm` : null} vide={nc} />
            <Ligne label={tx("shop.spec.stack")} valeur={m.stackTalonMm ? `${m.stackTalonMm.valeur} mm` : null} vide={nc} />
            <Ligne label={tx("shop.spec.plaque")} valeur={m.plaqueCarbone ? tx(m.plaqueCarbone.valeur ? "shop.oui" : "shop.non") : null} vide={nc} />
            <Ligne label={tx("shop.spec.duree")} valeur={m.dureeVieKm ? `${m.dureeVieKm.valeur} km` : null} vide={nc} />
            <Ligne label={tx("shop.spec.prix")} valeur={m.prixConseilleEur ? `${m.prixConseilleEur.valeur} €` : null} vide={nc} />
            <Ligne label={tx("shop.spec.ean")} valeur={m.ean ?? null} vide={nc} />
            {sourcesCitables(m.sources).length > 0 && (
              <p className="mt-3 border-t border-zinc-100 pt-3 text-[11.5px] leading-snug text-zinc-400">
                {tx("shop.releve", { date: dateLisible(m.poidsG?.vu ?? m.dropMm?.vu), sources: sourcesCitables(m.sources).join(", ") })}
              </p>
            )}
            {/* ⚠️ MESURER ET ANNONCER NE DONNENT PAS LE MÊME CHIFFRE. Une partie des
                hauteurs vient d'un laboratoire qui découpe la chaussure, l'autre du
                fabricant : trois à cinq millimètres d'écart systématique. Les afficher
                sans le dire ferait croire à une différence de conception. */}
            {m.stackTalonMm && m.sources.includes("runrepeat.com") && (
              <p className="mt-2 text-[11.5px] leading-snug text-zinc-400">
                {tx("shop.mesuree")}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-[15px] font-semibold text-zinc-900">{tx("shop.offres")}</h2>
            {!offresLisibles ? (
              <p className="text-[13px] leading-snug text-amber-700">
                {tx("shop.offres_illisibles")}
              </p>
            ) : offres.length === 0 ? (
              <>
                <p className="text-[13px] leading-snug text-zinc-500">
                  {tx("shop.offres_aucune")}
                </p>
                <p className="mt-2 text-[12px] leading-snug text-zinc-500">
                  {tx("shop.offres_aucune_aide")}
                </p>
              </>
            ) : (
              <ul className="space-y-2">
                {offres.map((o, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl p-2.5 ring-1 ring-inset ring-zinc-200">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-zinc-900">{o.retailer}</div>
                      <div className="text-[11px] text-zinc-500">{tx(o.in_stock === false ? "shop.indisponible" : "shop.en_stock")}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[15px] font-semibold ${best === o ? "text-emerald-700" : "text-zinc-900"}`}>
                        {Number(o.price).toFixed(2)} {o.currency === "EUR" ? "€" : o.currency}
                      </div>
                      <a href={o.url} target="_blank" rel="nofollow sponsored noopener noreferrer" className="text-[11px] text-zinc-500 underline underline-offset-2">
                        {tx("shop.voir_offre")}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
