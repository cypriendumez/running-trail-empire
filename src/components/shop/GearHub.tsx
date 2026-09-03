"use client";
/**
 * LE COMPARATEUR — filtrer, trier, comparer, et savoir ce que ça vaut POUR SOI.
 *
 * ⚠️ AUCUN PRIX MARCHAND N'EST AFFICHÉ ICI. Le seul montant montré est le prix public
 * conseillé du fabricant, et il est étiqueté comme tel. Les prix des enseignes viendront
 * de `product_offers`, alimentée par un flux officiel : tant que la table est vide, la
 * fiche le dit. C'est la règle qui a fait retirer l'ancienne boutique, dont les 1 167
 * prix étaient inventés.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SemelleProfil } from "./SemelleProfil";
import { ChaussureDessin } from "./ChaussureDessin";
import { PhotoMarchand, photoUtilisable } from "./PhotoMarchand";
import { filtrer, trier, marques, type Filtres, type Tri } from "@/lib/shop/catalogue";
import { useT } from "@/lib/i18n/LanguageProvider";
import { texteShop } from "./shopI18n";
import { evaluer, classer, paireAremplacer, type ProfilAthlete } from "@/lib/shop/pourToi";
import { usageDe } from "@/lib/shop/usage";
import { meilleure, remisePourcent, type Offre } from "@/lib/shop/offres";
import { PrixOffre } from "./PrixOffre";
import type { Modele, Usage, Terrain } from "@/lib/shop/modele";

const USAGES: Usage[] = ["quotidien", "polyvalent", "tempo", "competition", "trail_court", "trail_long", "amorti_max"];
const TERRAINS: Terrain[] = ["route", "trail"];

/**
 * Modèles affichés avant d'en demander plus.
 *
 * ⚠️ 24 ET PAS 309. Chaque carte porte un dessin de semelle en SVG : la page servait
 * 1 675 Ko de HTML — 687 SVG et 2 451 tracés — à un téléphone, pour des cartes que
 * personne ne déroule jusqu'au bout. Mesuré le 03/09/2026.
 */
const PAR_PAGE = 24;

function Chip({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] transition ${actif
        ? "bg-zinc-900 text-white"
        : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-300"}`}>
      {children}
    </button>
  );
}

function Spec({ label, valeur, vide }: { label: string; valeur: string | null; vide: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</div>
      {/* Une case vide serait lue comme « zéro » : on écrit ce qu'on ne sait pas. */}
      <div className={valeur ? "text-[15px] font-semibold text-zinc-900" : "text-[13px] text-zinc-400"}>
        {valeur ?? vide}
      </div>
    </div>
  );
}

export function GearHub({ catalogue, profil, offres = {} }: {
  catalogue: Modele[];
  profil: ProfilAthlete;
  /** Offres relevées chez les marchands, rangées par code-barres. */
  offres?: Record<string, Offre[]>;
}) {
  const { lang } = useT();
  const tx = (k: string, p?: Record<string, string | number>) => texteShop(lang, k, p);
  const [f, setF] = useState<Filtres>({});
  const [tri, setTri] = useState<Tri>("pertinence");
  const [compare, setCompare] = useState<string[]>([]);
  /**
   * ⚠️ ON N'AFFICHE PAS LES 309 MODÈLES D'UN COUP. Mesuré le 03/09/2026 : la page
   * servait 1 675 Ko de HTML, dont l'essentiel en 687 SVG et 2 451 tracés — un dessin
   * de semelle par modèle. Sur un téléphone, c'est plusieurs secondes de téléchargement
   * puis de mise en page, pour des cartes que personne ne fera défiler jusqu'au bout.
   */
  const [combien, setCombien] = useState(PAR_PAGE);

  const pertinence = useMemo(() => classer(catalogue, profil), [catalogue, profil]);
  // La meilleure offre de chaque modèle, calculée une fois : elle sert au tri, aux
  // cartes et au bandeau des promotions.
  const parModele = useMemo(() => {
    const m = new Map<string, { offre: Offre; prix: number; remise: number | null }>();
    for (const x of catalogue) {
      const best = x.ean ? meilleure(offres[x.ean] ?? []) : null;
      if (best) m.set(x.slug, { offre: best, prix: Number(best.price), remise: remisePourcent(Number(best.price), x.prixConseilleEur?.valeur) });
    }
    return m;
  }, [catalogue, offres]);
  const liste = useMemo(() => trier(filtrer(catalogue, f), tri, pertinence, parModele), [catalogue, f, tri, pertinence, parModele]);
  // ⚠️ CHANGER DE FILTRE REVIENT AU DÉBUT. Sans cette remise à zéro, quelqu'un qui a
  // déroulé jusqu'à 200 modèles puis filtre sur une marque verrait la liste entière de
  // cette marque d'un coup — le gain disparaîtrait dès le premier filtre posé.
  const cleFiltres = `${JSON.stringify(f)}|${tri}`;
  const [dernierFiltre, setDernierFiltre] = useState(cleFiltres);
  if (cleFiltres !== dernierFiltre) { setDernierFiltre(cleFiltres); setCombien(PAR_PAGE); }
  const visibles = liste.slice(0, combien);
  // Les plus fortes remises du moment, tous filtres confondus : c'est une vitrine, pas
  // un résultat de recherche.
  const promos = useMemo(() => [...parModele.entries()]
    .filter(([, v]) => v.remise != null && v.remise >= 15)
    .sort((a, b) => (b[1].remise ?? 0) - (a[1].remise ?? 0))
    .slice(0, 4)
    .map(([slug, v]) => ({ modele: catalogue.find((m) => m.slug === slug)!, ...v }))
    .filter((x) => x.modele), [parModele, catalogue]);
  const toutesMarques = useMemo(() => marques(catalogue), [catalogue]);
  const compares = compare.map((s) => catalogue.find((m) => m.slug === s)).filter(Boolean) as Modele[];
  const avecOffre = liste.filter((m) => parModele.has(m.slug)).length;
  // Le bandeau n'apparaît que sur un kilométrage RENSEIGNÉ : voir `paireAremplacer`.
  const usee = useMemo(() => paireAremplacer(profil.rotation), [profil.rotation]);

  const bascule = <K extends "marques" | "terrains" | "usages">(clef: K, v: string) =>
    setF((x) => {
      const cur = (x[clef] ?? []) as string[];
      const suiv = cur.includes(v) ? cur.filter((y) => y !== v) : [...cur, v];
      return { ...x, [clef]: suiv.length ? suiv : undefined };
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
      {/* ── FILTRES ─────────────────────────────────────────────────────────────── */}
      <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <input
          value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value })}
          placeholder={tx("shop.rechercher")}
          className="w-full rounded-xl bg-white px-3.5 py-2.5 text-[14px] ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-zinc-400"
        />
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{tx("shop.terrain")}</div>
          <div className="flex flex-wrap gap-1.5">
            {TERRAINS.map((t) => (
              <Chip key={t} actif={!!f.terrains?.includes(t)} onClick={() => bascule("terrains", t)}>{tx(`shop.t.${t}`)}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{tx("shop.usage")}</div>
          <div className="flex flex-wrap gap-1.5">
            {USAGES.map((u) => (
              <Chip key={u} actif={!!f.usages?.includes(u)} onClick={() => bascule("usages", u)}>{tx(`shop.u.${u}`)}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{tx("shop.marque")}</div>
          <div className="flex flex-wrap gap-1.5">
            {toutesMarques.map((m) => (
              <Chip key={m} actif={!!f.marques?.includes(m)} onClick={() => bascule("marques", m)}>{m}</Chip>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {([["shop.poids_max", "poidsMax", 180, 340, 10, "g"], ["shop.drop_max", "dropMax", 0, 12, 1, "mm"]] as const).map(
            ([label, clef, min, max, pas, unite]) => (
              <div key={clef}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{tx(label)}</span>
                  <span className="text-[12px] text-zinc-600">{f[clef] != null ? `${f[clef]} ${unite}` : tx("shop.indifferent")}</span>
                </div>
                <input type="range" min={min} max={max} step={pas} value={(f[clef] as number | undefined) ?? max}
                  onChange={(e) => setF({ ...f, [clef]: Number(e.target.value) === max ? null : Number(e.target.value) })}
                  className="w-full accent-emerald-600" />
              </div>
            ))}
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{tx("shop.plaque")}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip actif={f.plaqueCarbone === true} onClick={() => setF({ ...f, plaqueCarbone: f.plaqueCarbone === true ? null : true })}>{tx("shop.avec")}</Chip>
            <Chip actif={f.plaqueCarbone === false} onClick={() => setF({ ...f, plaqueCarbone: f.plaqueCarbone === false ? null : false })}>{tx("shop.sans")}</Chip>
          </div>
          {f.plaqueCarbone != null && (
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
              {tx("shop.plaque_avert")}
            </p>
          )}
        </div>
        {(Object.keys(f).length > 0) && (
          <button type="button" onClick={() => setF({})} className="text-[13px] text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
            {tx("shop.effacer")}
          </button>
        )}
      </aside>

      {/* ── RÉSULTATS ───────────────────────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-zinc-500">
            {tx(liste.length > 1 ? "shop.n_modeles_plusieurs" : "shop.n_modeles_un", { n: liste.length })}
            {liste.length !== catalogue.length && <> {tx("shop.sur_total", { n: catalogue.length })}</>}
            {avecOffre > 0 && <span className="text-zinc-400"> · {tx("shop.n_offres", { n: avecOffre })}</span>}
          </p>
          <label className="flex items-center gap-2 text-[13px] text-zinc-500">
            {tx("shop.trier")}
            <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}
              className="rounded-lg bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none">
              <option value="pertinence">{tx("shop.tri.pertinence")}</option>
              <option value="remise">{tx("shop.tri.remise")}</option>
              <option value="prix_bas">{tx("shop.tri.prix_bas")}</option>
              <option value="poids">{tx("shop.tri.poids")}</option>
              <option value="drop">{tx("shop.tri.drop")}</option>
              <option value="prix">{tx("shop.tri.prix")}</option>
              <option value="nouveaute">{tx("shop.tri.nouveaute")}</option>
              <option value="nom">{tx("shop.tri.nom")}</option>
            </select>
          </label>
        </div>

        {/* ── ENTRÉES RAPIDES ──────────────────────────────────────────────────────
            Quatre portes d'entrée, comme sur les comparateurs : elles POSENT un filtre,
            elles ne remplacent pas la liste. Chacune se désactive d'un second clic. */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["shop.cat.route", () => ({ terrains: ["route"] as Terrain[] })],
            ["shop.cat.trail", () => ({ terrains: ["trail"] as Terrain[] })],
            ["shop.cat.competition", () => ({ usages: ["competition"] as Usage[] })],
            ["shop.cat.amorti", () => ({ usages: ["amorti_max"] as Usage[] })],
          ] as const).map(([cle, poser]) => {
            const v = poser();
            const actif = JSON.stringify({ ...f, q: undefined }) === JSON.stringify({ ...v, q: undefined });
            return (
              <button key={cle} type="button" onClick={() => setF(actif ? {} : v)}
                className={`rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${actif
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-400"}`}>
                {tx(cle)}
              </button>
            );
          })}
        </div>

        {promos.length > 0 && (
          <Card className="mb-4 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-zinc-900">{tx("shop.meilleures")}</h2>
              <button type="button" onClick={() => { setF({}); setTri("remise"); }}
                className="text-[13px] text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                {tx("shop.tout_voir")}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {promos.map((p) => (
                <Link key={p.modele.slug} href={`/dashboard/shop/${p.modele.slug}`}
                  className="rounded-xl p-3 ring-1 ring-inset ring-zinc-200 transition hover:ring-zinc-400">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-400">{p.modele.marque}</div>
                  <div className="truncate text-[14px] font-semibold text-zinc-900">{p.modele.nom}</div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-[16px] font-semibold text-zinc-900">{p.prix.toFixed(0)} €</span>
                    <span className="text-[12px] text-zinc-400 line-through">{p.modele.prixConseilleEur?.valeur} €</span>
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">−{p.remise} %</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {usee && (
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-l-amber-400 p-4">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-zinc-900">
                {tx("shop.usure.titre", { marque: usee.marque, modele: usee.modele })}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-zinc-500">
                {tx("shop.usure.corps", { km: Math.round(usee.km), max: Math.round(usee.maxKm) })}
              </p>
            </div>
            <button type="button"
              onClick={() => setF((x) => ({ ...x, terrains: usee.terrain === "trail" ? ["trail"] : usee.terrain === "route" ? ["route"] : undefined }))}
              className="shrink-0 rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-zinc-700">
              {tx("shop.usure.action")}
            </button>
          </Card>
        )}

        {compares.length > 0 && <Comparaison modeles={compares} profil={profil} onVider={() => setCompare([])} tx={tx} />}

        {liste.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-[15px] font-semibold text-zinc-900">{tx("shop.aucun")}</p>
            <p className="mt-1 text-[13px] text-zinc-500">{tx("shop.aucun_aide", { n: catalogue.length })}</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((m) => {
              const avis = evaluer(m, profil);
              const choisi = compare.includes(m.slug);
              return (
                <Card key={m.slug} hover className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{m.marque}</div>
                      <Link href={`/dashboard/shop/${m.slug}`} className="block truncate text-[16px] font-semibold text-zinc-900 hover:underline">
                        {m.nom}
                      </Link>
                    </div>
                    <button type="button" title={tx("shop.comparer")}
                      onClick={() => setCompare((c) => c.includes(m.slug) ? c.filter((x) => x !== m.slug) : c.length >= 3 ? c : [...c, m.slug])}
                      className={`shrink-0 rounded-lg px-2 py-1 text-[11px] ring-1 ring-inset transition ${choisi
                        ? "bg-zinc-900 text-white ring-zinc-900"
                        : "bg-white text-zinc-500 ring-zinc-200 hover:ring-zinc-400"}`}>
                      {choisi ? tx("shop.compare") : tx("shop.comparer")}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{tx(`shop.t.${m.terrain}`)}</Badge>
                    {(() => {
                      // L'usage est DÉDUIT des cotes : sans cotes, pas d'étiquette — une
                      // case vide vaut mieux qu'un classement inventé.
                      const u = usageDe(m);
                      return u ? <Badge tone="neutral">{tx(`shop.u.${u}`)}</Badge> : null;
                    })()}
                    {m.plaqueCarbone?.valeur && <Badge tone="dark">{tx("shop.plaque")}</Badge>}
                  </div>

                  {/* ⚠️ LE DESSIN NE S'AFFICHE QUE S'IL DIT QUELQUE CHOSE. La hauteur de
                      semelle n'est publiée que pour une minorité des modèles : réserver
                      54 px à un cadre vide sur quatre cartes sur cinq noyait les fiches
                      renseignées, celles-là mêmes que le dessin sert à comparer.
                      L'absence reste dite, sur une ligne, dans les caractéristiques. */}
                  {/* ⚠️ TOUJOURS UN DESSIN, MÊME SANS LA HAUTEUR. Réserver la place à un
                      cadre vide sur les fiches incomplètes les faisait passer pour des
                      erreurs ; le dessin, lui, montre la silhouette et HACHURE la mousse
                      quand son épaisseur n'est pas connue. L'absence se voit, elle ne se
                      comble pas. */}
                  {/* ⚠️ LA PHOTO NE S'AFFICHE QUE SI ELLE VIENT D'UN FLUX. `image_url` est
                      rempli par l'import d'un flux d'affiliation, qui accorde le droit de
                      l'afficher ; tant qu'aucun flux n'est raccordé la colonne est vide et
                      c'est le dessin aux cotes qui parle. */}
                  {(() => {
                    const photo = photoUtilisable(parModele.get(m.slug)?.offre.image_url);
                    return photo ? (
                      <div className="my-3 h-[110px]">
                        <PhotoMarchand src={photo} alt={`${m.marque} ${m.nom}`}
                          marchand={parModele.get(m.slug)!.offre.retailer} className="h-full" />
                      </div>
                    ) : null;
                  })()}
                  {!photoUtilisable(parModele.get(m.slug)?.offre.image_url) && (
                  <div className="my-3">
                    <ChaussureDessin marque={m.marque} stackTalonMm={m.stackTalonMm?.valeur}
                      dropMm={m.dropMm?.valeur} terrain={m.terrain} plaqueCarbone={m.plaqueCarbone?.valeur}
                      absent={tx("shop.profil_absent")} className="w-full"
                      description={m.stackTalonMm
                        ? tx("shop.dessin_alt", { marque: m.marque, talon: Math.round(m.stackTalonMm.valeur), avant: Math.round(m.stackTalonMm.valeur - (m.dropMm?.valeur ?? 0)) })
                        : tx("shop.profil_absent")} />
                  </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
                    <Spec label={tx("shop.spec.poids")} valeur={m.poidsG ? `${m.poidsG.valeur} g` : null} vide={tx("shop.non_communique")} />
                    <Spec label={tx("shop.spec.drop")} valeur={m.dropMm ? `${m.dropMm.valeur} mm` : null} vide={tx("shop.non_communique")} />
                  </div>

                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <PrixOffre offre={parModele.get(m.slug)?.offre ?? null}
                      conseille={m.prixConseilleEur?.valeur} tx={tx} compact />
                  </div>

                  {/* Le lien part CHEZ LE MARCHAND, en `nofollow sponsored` : on ne
                      revendique pas cette page, on y renvoie. */}
                  {parModele.get(m.slug) && (
                    <a href={parModele.get(m.slug)!.offre.url} target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                      className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700">
                      {tx("shop.voir_offre")}
                    </a>
                  )}

                  {(avis.pour.length > 0 || avis.contre.length > 0) && (
                    <p className={`mt-3 text-[12.5px] leading-snug ${avis.score >= 60 ? "text-emerald-700" : avis.score < 45 ? "text-amber-700" : "text-zinc-500"}`}>
                      {tx(avis.verdict.replace("shop.v.", "shop.vc."))}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {visibles.length < liste.length && (
          <div className="mt-4 text-center">
            {/* ⚠️ LE NOMBRE RESTANT EST AFFICHÉ. Un bouton « voir plus » muet laisse
                croire qu'on a tout vu, ce qui est pire que la liste complète. */}
            <button type="button" onClick={() => setCombien((n) => n + PAR_PAGE)}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
              {tx("shop.voir_plus", { n: liste.length - visibles.length })}
            </button>
          </div>
        )}

        <p className="mt-6 border-t border-zinc-100 pt-4 text-[11.5px] leading-snug text-zinc-400">
          {tx("shop.provenance")}
        </p>
      </div>
    </div>
  );
}

/** Tableau de comparaison — jusqu'à trois modèles, côte à côte, cotes à l'échelle. */
function Comparaison({ modeles, profil, onVider, tx }: { modeles: Modele[]; profil: ProfilAthlete; onVider: () => void; tx: (k: string, p?: Record<string, string | number>) => string }) {
  const nc = tx("shop.non_communique");
  const lignes: [string, (m: Modele) => string][] = [
    ["shop.spec.poids", (m) => m.poidsG ? `${m.poidsG.valeur} g` : nc],
    ["shop.spec.drop", (m) => m.dropMm ? `${m.dropMm.valeur} mm` : nc],
    ["shop.spec.stack", (m) => m.stackTalonMm ? `${m.stackTalonMm.valeur} mm` : nc],
    ["shop.spec.plaque", (m) => m.plaqueCarbone ? tx(m.plaqueCarbone.valeur ? "shop.oui" : "shop.non") : nc],
    ["shop.spec.prix", (m) => m.prixConseilleEur ? `${m.prixConseilleEur.valeur} €` : nc],
    ["shop.spec.usage", (m) => { const u = usageDe(m); return u ? tx(`shop.u.${u}`) : nc; }],
    ["shop.spec.verdict", (m) => tx(evaluer(m, profil).verdict)],
  ];
  return (
    <Card className="mb-4 overflow-x-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-900">{tx("shop.comparaison")}</h2>
        <button type="button" onClick={onVider} className="text-[13px] text-zinc-500 underline underline-offset-2">{tx("shop.vider")}</button>
      </div>
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead>
          <tr>
            <th className="w-40 pb-2 font-normal text-zinc-400"> </th>
            {modeles.map((m) => (
              <th key={m.slug} className="pb-2 align-bottom">
                <div className="text-[11px] uppercase tracking-wider text-zinc-400">{m.marque}</div>
                <div className="text-[14px] font-semibold text-zinc-900">{m.nom}</div>
                <div className="mt-1 h-[42px]"><SemelleProfil stackTalonMm={m.stackTalonMm?.valeur} dropMm={m.dropMm?.valeur} hauteur={42} absent={tx("shop.profil_absent")} className="w-full" /></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map(([label, f]) => (
            <tr key={label} className="border-t border-zinc-100">
              <td className="py-2 text-zinc-400">{tx(label)}</td>
              {modeles.map((m) => <td key={m.slug} className="py-2 text-zinc-900">{f(m)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
