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
import { filtrer, trier, marques, type Filtres, type Tri } from "@/lib/shop/catalogue";
import { useT } from "@/lib/i18n/LanguageProvider";
import { texteShop } from "./shopI18n";
import { evaluer, classer, type ProfilAthlete } from "@/lib/shop/pourToi";
import type { Modele, Usage, Terrain } from "@/lib/shop/modele";

const USAGES: Usage[] = ["quotidien", "polyvalent", "tempo", "competition", "trail_court", "trail_long", "amorti_max"];
const TERRAINS: Terrain[] = ["route", "trail"];

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

export function GearHub({ catalogue, profil }: { catalogue: Modele[]; profil: ProfilAthlete }) {
  const { lang } = useT();
  const tx = (k: string, p?: Record<string, string | number>) => texteShop(lang, k, p);
  const [f, setF] = useState<Filtres>({});
  const [tri, setTri] = useState<Tri>("pertinence");
  const [compare, setCompare] = useState<string[]>([]);

  const pertinence = useMemo(() => classer(catalogue, profil), [catalogue, profil]);
  const liste = useMemo(() => trier(filtrer(catalogue, f), tri, pertinence), [catalogue, f, tri, pertinence]);
  const toutesMarques = useMemo(() => marques(catalogue), [catalogue]);
  const compares = compare.map((s) => catalogue.find((m) => m.slug === s)).filter(Boolean) as Modele[];

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
          </p>
          <label className="flex items-center gap-2 text-[13px] text-zinc-500">
            {tx("shop.trier")}
            <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}
              className="rounded-lg bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none">
              <option value="pertinence">{tx("shop.tri.pertinence")}</option>
              <option value="poids">{tx("shop.tri.poids")}</option>
              <option value="drop">{tx("shop.tri.drop")}</option>
              <option value="prix">{tx("shop.tri.prix")}</option>
              <option value="nouveaute">{tx("shop.tri.nouveaute")}</option>
              <option value="nom">{tx("shop.tri.nom")}</option>
            </select>
          </label>
        </div>

        {compares.length > 0 && <Comparaison modeles={compares} profil={profil} onVider={() => setCompare([])} tx={tx} />}

        {liste.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-[15px] font-semibold text-zinc-900">{tx("shop.aucun")}</p>
            <p className="mt-1 text-[13px] text-zinc-500">{tx("shop.aucun_aide", { n: catalogue.length })}</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {liste.map((m) => {
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
                    <Badge tone="neutral">{tx(`shop.u.${m.usage}`)}</Badge>
                    {m.plaqueCarbone?.valeur && <Badge tone="dark">{tx("shop.plaque")}</Badge>}
                  </div>

                  <div className="my-3 h-[54px]">
                    <SemelleProfil stackTalonMm={m.stackTalonMm?.valeur} dropMm={m.dropMm?.valeur} absent={tx("shop.profil_absent")} className="h-full w-full" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3">
                    <Spec label={tx("shop.spec.poids")} valeur={m.poidsG ? `${m.poidsG.valeur} g` : null} vide={tx("shop.non_communique")} />
                    <Spec label={tx("shop.spec.drop")} valeur={m.dropMm ? `${m.dropMm.valeur} mm` : null} vide={tx("shop.non_communique")} />
                    <Spec label={tx("shop.spec.conseille")} valeur={m.prixConseilleEur ? `${m.prixConseilleEur.valeur} €` : null} vide={tx("shop.non_communique")} />
                  </div>

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
    ["shop.spec.usage", (m) => tx(`shop.u.${m.usage}`)],
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
                <div className="mt-1 h-[42px]"><SemelleProfil stackTalonMm={m.stackTalonMm?.valeur} dropMm={m.dropMm?.valeur} hauteur={42} absent={tx("shop.profil_absent")} className="h-full w-full" /></div>
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
