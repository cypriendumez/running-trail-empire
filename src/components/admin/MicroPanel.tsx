"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Copy, Check, Loader2, Plus, CalendarClock, Info, TriangleAlert } from "lucide-react";
import { CATEGORIES, euros, enCentimes, horsResultat, type Ecriture, type Reglages } from "@/lib/compta/model";
import { declarationsMicro, bilanAnnuel } from "@/lib/compta/micro";

type ComptaRep = { ecritures: Ecriture[]; reglages: Reglages; error?: string };

const RECETTES = CATEGORIES.filter((c) => c.sens === "entree" && !horsResultat({ categorie: c.id }));
const anneeParis = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(new Date()));
const jourParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateFr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function MicroPanel() {
  const [rep, setRep] = useState<ComptaRep | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [annee, setAnnee] = useState<number>(anneeParis());
  const [copie, setCopie] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState(false);

  // Formulaire d'ajout rapide de recette.
  const [montant, setMontant] = useState("");
  const [categorie, setCategorie] = useState(RECETTES[0]?.id ?? "abonnements");
  const [dateOp, setDateOp] = useState(jourParis());
  const [ajout, setAjout] = useState(false);

  const charger = () => {
    setChargement(true); setErreur(null);
    fetch("/api/admin/compta")
      .then(async (r) => { const j = await r.json() as ComptaRep; if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`); setRep(j); })
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setChargement(false));
  };
  useEffect(charger, []);

  const reglages = rep?.reglages ?? {};
  const ecritures = rep?.ecritures ?? [];
  const periodicite = reglages.periodiciteUrssaf === "mensuel" ? "mensuel" : "trimestriel";

  const anneesDispo = useMemo(() => {
    const s = new Set<number>([anneeParis()]);
    for (const e of ecritures) { const a = Number(String(e.date).slice(0, 4)); if (a) s.add(a); }
    return [...s].sort((a, b) => b - a);
  }, [ecritures]);

  const periodes = useMemo(() => declarationsMicro(ecritures, reglages, annee, jourParis()), [ecritures, reglages, annee]);
  const bilan = useMemo(() => bilanAnnuel(ecritures, reglages, annee), [ecritures, reglages, annee]);

  async function majReglages(patch: Partial<Reglages>) {
    setSauvegarde(true);
    try {
      const r = await fetch("/api/admin/compta", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reglages", reglages: { ...reglages, ...patch } }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.erreurs?.[0] ?? "Échec");
      setRep((prev) => prev ? { ...prev, reglages: j.reglages } : prev);
    } catch (e) { setErreur(String(e)); }
    finally { setSauvegarde(false); }
  }

  async function ajouterRecette() {
    const cents = enCentimes(montant);
    if (!cents || cents <= 0) { setErreur("Montant invalide."); return; }
    setAjout(true); setErreur(null);
    try {
      const r = await fetch("/api/admin/compta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateOp, libelle: RECETTES.find((c) => c.id === categorie)?.label ?? "Recette", sens: "entree", categorie, montantCents: cents, moyen: "Stripe" }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.erreurs?.[0] ?? "Échec");
      setMontant("");
      setRep((prev) => prev ? { ...prev, ecritures: [j.ecriture, ...prev.ecritures] } : prev);
    } catch (e) { setErreur(String(e)); }
    finally { setAjout(false); }
  }

  const copier = async (cle: string, cents: number) => {
    // Le formulaire URSSAF attend un CA en euros entiers : on copie l'arrondi.
    try { await navigator.clipboard.writeText(String(Math.round(cents / 100))); setCopie(cle); setTimeout(() => setCopie(null), 2000); } catch { /* copie indispo */ }
  };

  const tauxManque = reglages.tauxCotisations === undefined;
  const partPlafond = bilan.partPlafondPct;

  return (
    <div className="mx-auto w-full max-w-5xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900"><Landmark className="h-5 w-5 text-emerald-600" /> Micro-entreprise</h2>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            Ton chiffre d&apos;affaires encaissé, prêt à recopier dans la déclaration URSSAF. Recettes hors apports personnels, par date d&apos;opération. Les taux sont ceux que tu saisis — jamais devinés.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} aria-label="Année" className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700">
            {anneesDispo.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
            {(["trimestriel", "mensuel"] as const).map((mode) => (
              <button key={mode} onClick={() => majReglages({ periodiciteUrssaf: mode })} disabled={sauvegarde}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${periodicite === mode ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erreur && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}
      {chargement && !rep && <div className="flex items-center gap-2 py-10 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Lecture du journal…</div>}

      {rep && (
        <>
          {/* Bilan annuel */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
              <div className="text-2xl font-bold tabular-nums text-emerald-700">{euros(bilan.caCents)}</div>
              <div className="mt-0.5 text-xs font-medium text-zinc-600">CA encaissé {annee}</div>
              <div className="text-[11px] text-zinc-400">cumul de l&apos;année</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
              <div className="text-2xl font-bold tabular-nums text-zinc-900">{bilan.cotisationsCents === null ? "—" : euros(bilan.cotisationsCents)}</div>
              <div className="mt-0.5 text-xs font-medium text-zinc-600">Cotisations estimées {annee}</div>
              <div className="text-[11px] text-zinc-400">{tauxManque ? "saisis ton taux ci-dessous" : `au taux de ${reglages.tauxCotisations}%`}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
              {partPlafond === null ? (
                <><div className="text-2xl font-bold text-zinc-300">—</div><div className="mt-0.5 text-xs font-medium text-zinc-600">Plafond de franchise</div><div className="text-[11px] text-zinc-400">saisis ton plafond ci-dessous</div></>
              ) : (
                <>
                  <div className="flex items-baseline justify-between"><div className="text-2xl font-bold tabular-nums text-zinc-900">{partPlafond}%</div><div className="text-[11px] text-zinc-400">de {euros(bilan.seuilCents ?? 0)}</div></div>
                  <div className="mt-2 h-1.5 rounded-full bg-zinc-100"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, partPlafond)}%`, background: partPlafond >= 90 ? "#dc2626" : partPlafond >= 70 ? "#f59e0b" : "#059669" }} /></div>
                  <div className="mt-1 text-[11px] text-zinc-400">part du plafond micro-entreprise</div>
                </>
              )}
            </div>
          </div>

          {/* Périodes à déclarer */}
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900"><CalendarClock className="h-4 w-4 text-zinc-400" /> À déclarer ({periodicite})</div>
          {periodes.length === 0 ? (
            <p className="mb-6 rounded-2xl border border-zinc-100 bg-white p-5 text-sm text-zinc-400 shadow-sm">Aucune période commencée pour {annee}.</p>
          ) : (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {periodes.map((p) => (
                <div key={p.cle} className={`rounded-2xl border bg-white p-5 shadow-sm ${p.close ? "border-zinc-100" : "border-emerald-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold capitalize text-zinc-900">{p.libelle}</div>
                      <div className="text-[11px] text-zinc-400">{dateFr(p.debut)} → {dateFr(p.fin)}</div>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.close ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"}`}>{p.close ? "close" : "en cours"}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold tabular-nums text-zinc-900">{euros(p.caCents)}</div>
                      <div className="text-[11px] text-zinc-400">CA à déclarer · {p.nbEcritures} recette(s)</div>
                    </div>
                    <button onClick={() => copier(p.cle, p.caCents)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
                      {copie === p.cle ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> copié</> : <><Copy className="h-3.5 w-3.5" /> copier</>}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-[11px]">
                    <span className="text-zinc-500">Cotisations : <b className="text-zinc-700">{p.cotisationsCents === null ? "taux manquant" : euros(p.cotisationsCents)}</b></span>
                    <span className="text-zinc-400">échéance ≈ {dateFr(p.echeanceIndicative)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ajout rapide de recette */}
          <div className="mb-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900"><Plus className="h-4 w-4 text-emerald-600" /> Encaisser une recette</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="m-montant" className="mb-1 block text-[11px] font-medium text-zinc-500">Montant (€)</label>
                <input id="m-montant" value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" placeholder="9,99" className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label htmlFor="m-cat" className="mb-1 block text-[11px] font-medium text-zinc-500">Type</label>
                <select id="m-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  {RECETTES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="m-date" className="mb-1 block text-[11px] font-medium text-zinc-500">Date</label>
                <input id="m-date" type="date" value={dateOp} onChange={(e) => setDateOp(e.target.value)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
              </div>
              <button onClick={ajouterRecette} disabled={ajout} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                {ajout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">Enregistré au journal comptable (moyen : Stripe). La déclaration ci-dessus se met à jour aussitôt.</p>
          </div>

          {/* Réglages micro-entreprise */}
          <details className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-bold text-zinc-900">Mes taux et mon identité</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ChampNombre label="Taux de cotisations (%)" aide="relevé sur urssaf.fr — pendant l'ACRE, le taux réduit" valeur={reglages.tauxCotisations} onSave={(v) => majReglages({ tauxCotisations: v })} />
              <ChampNombre label="Plafond de franchise (€)" aide="seuil de ton régime, relevé sur impots.gouv.fr" valeur={reglages.seuilCA} onSave={(v) => majReglages({ seuilCA: v })} />
              <ChampTexte label="Fin de l'ACRE (AAAA-MM-JJ)" aide="dernier jour du taux réduit ; après, le taux remonte" valeur={reglages.acreJusquau} onSave={(v) => majReglages({ acreJusquau: v })} />
              <ChampNombre label="Taux après l'ACRE (%)" aide="taux plein applicable après cette date" valeur={reglages.tauxApresAcre} onSave={(v) => majReglages({ tauxApresAcre: v })} />
              <ChampTexte label="SIRET" aide="à renseigner quand tu l'auras" valeur={reglages.siret} onSave={(v) => majReglages({ siret: v })} />
              <ChampTexte label="Régime déclaré" aide="ex. micro-entreprise (BNC)" valeur={reglages.regime} onSave={(v) => majReglages({ regime: v })} />
            </div>
            {reglages.acreJusquau && (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-700"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> Après le {dateFr(reglages.acreJusquau)}, le taux passe à {reglages.tauxApresAcre ?? "?"}% : les recettes suivantes sont calculées à ce taux.</p>
            )}
          </details>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Le CA affiché est la somme de tes recettes encaissées (hors apports personnels). Vérifie le traitement des remboursements et aides selon ta situation, et confirme tes taux et échéances sur ton compte URSSAF. Les montants « à copier » sont arrondis à l&apos;euro.
          </p>
        </>
      )}
    </div>
  );
}

/** Un champ qui ne sauvegarde qu'à la validation (Entrée ou perte de focus). */
function ChampNombre({ label, aide, valeur, onSave }: { label: string; aide: string; valeur?: number; onSave: (v: number | undefined) => void }) {
  const [v, setV] = useState(valeur === undefined ? "" : String(valeur));
  useEffect(() => { setV(valeur === undefined ? "" : String(valeur)); }, [valeur]);
  const commit = () => { const s = v.trim().replace(",", "."); const n = s === "" ? undefined : Number(s); if (n === undefined || (Number.isFinite(n) && n >= 0)) onSave(n); };
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-500">{label}</span>
      <input aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} inputMode="decimal"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
      <span className="mt-1 block text-[10px] text-zinc-400">{aide}</span>
    </label>
  );
}
function ChampTexte({ label, aide, valeur, onSave }: { label: string; aide: string; valeur?: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(valeur ?? "");
  useEffect(() => { setV(valeur ?? ""); }, [valeur]);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-500">{label}</span>
      <input aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v.trim())} onKeyDown={(e) => e.key === "Enter" && onSave(v.trim())}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
      <span className="mt-1 block text-[10px] text-zinc-400">{aide}</span>
    </label>
  );
}
