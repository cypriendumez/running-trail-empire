"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Clock, Globe, Loader2, Minus, Monitor, RefreshCw, Smartphone, Users } from "lucide-react";
import type { Agregat, Classement } from "@/lib/visites/agreger";

type Reponse = Agregat & { lues: number; tronque: boolean; error?: string };

// Deux entités, deux teintes fixes (validées dataviz : ΔE 16 en vision déficiente, contraste ≥ 3:1).
const COULEUR = { site: "#0284c7", app: "#059669" } as const;

const jourCourt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const jourLong = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Drapeau emoji depuis un code pays ISO-2 (les lettres régionales Unicode). */
const drapeau = (iso2: string) => {
  const c = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🏳️";
  return String.fromCodePoint(...[...c].map((l) => 0x1f1e6 + l.charCodeAt(0) - 65));
};
const NOM_PAYS: Record<string, string> = { FR: "France", BE: "Belgique", CH: "Suisse", CA: "Canada", US: "États-Unis", GB: "Royaume-Uni", DE: "Allemagne", ES: "Espagne", IT: "Italie", PT: "Portugal", NL: "Pays-Bas", LU: "Luxembourg", MA: "Maroc", DZ: "Algérie", TN: "Tunisie" };
const NOM_LANGUE: Record<string, string> = { fr: "français", en: "anglais", de: "allemand", es: "espagnol", pt: "portugais", it: "italien", nl: "néerlandais" };

/** Variation en % entre deux valeurs, avec la flèche et la teinte qui vont avec. */
function Tendance({ actuel, precedent }: { actuel: number; precedent: number }) {
  if (precedent === 0) {
    if (actuel === 0) return <span className="text-[11px] text-zinc-400">—</span>;
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> nouveau</span>;
  }
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] text-zinc-400"><Minus className="h-3 w-3" /> stable</span>;
  const hausse = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${hausse ? "text-emerald-600" : "text-rose-500"}`}>
      {hausse ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{hausse ? "+" : ""}{pct}%
    </span>
  );
}

/** Barres par jour, deux séries côte à côte (site / app). SVG nu : pas de bibliothèque. */
function BarresJour({ jours }: { jours: Agregat["jours"] }) {
  const H = 150, PAD = 26;
  const max = Math.max(1, ...jours.map((j) => Math.max(j.visiteursSite, j.visiteursApp)));
  const largeurJour = Math.max(6, Math.min(38, 720 / Math.max(1, jours.length)));
  const W = largeurJour * jours.length + PAD;
  const y = (v: number) => H - (v / max) * (H - 18);
  const pas = max <= 5 ? 1 : max <= 20 ? 5 : max <= 100 ? 20 : Math.ceil(max / 5 / 50) * 50;
  const lignes: number[] = [];
  for (let v = pas; v <= max; v += pas) lignes.push(v);
  const barre = Math.max(2, (largeurJour - 4) / 2 - 1);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 22}`} width={W} height={H + 22} className="block" role="img" aria-label="Visiteurs par jour">
        {lignes.map((v) => (
          <g key={v}>
            <line x1={PAD} x2={W} y1={y(v)} y2={y(v)} stroke="#f4f4f5" />
            <text x={PAD - 5} y={y(v) + 3} fontSize="9" fill="#a1a1aa" textAnchor="end">{v}</text>
          </g>
        ))}
        <line x1={PAD} x2={W} y1={H} y2={H} stroke="#e4e4e7" />
        {jours.map((j, i) => {
          const x0 = PAD + i * largeurJour + 2;
          return (
            <g key={j.jour}>
              <title>{`${jourLong(j.jour)} — Site : ${j.visiteursSite} · App : ${j.visiteursApp}`}</title>
              <rect x={x0} y={y(j.visiteursSite)} width={barre} height={Math.max(0, H - y(j.visiteursSite))} rx={2} fill={COULEUR.site} />
              <rect x={x0 + barre + 2} y={y(j.visiteursApp)} width={barre} height={Math.max(0, H - y(j.visiteursApp))} rx={2} fill={COULEUR.app} />
              {(jours.length <= 31 || i % 7 === 0) && (
                <text x={x0 + barre + 1} y={H + 14} fontSize="9" fill="#a1a1aa" textAnchor="middle">{jours.length <= 12 ? jourCourt(j.jour) : j.jour.slice(8)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Affluence par heure (0-23), une seule série neutre — « à quelle heure viennent-ils ». */
function BarresHeure({ heures }: { heures: Agregat["heures"] }) {
  const max = Math.max(1, ...heures.map((h) => h.vues));
  const total = heures.reduce((s, h) => s + h.vues, 0);
  if (total === 0) return <p className="text-xs text-zinc-400">Pas encore assez de données pour l&apos;affluence horaire.</p>;
  const pointe = heures.reduce((a, b) => (b.vues > a.vues ? b : a));
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: 90 }}>
        {heures.map((h) => (
          <div key={h.h} className="group relative flex h-full flex-1 flex-col justify-end" title={`${String(h.h).padStart(2, "0")} h — ${h.vues} vue(s)`}>
            <div className="rounded-t-sm transition-colors" style={{ height: `${Math.max(2, (h.vues / max) * 100)}%`, background: h.h === pointe.h ? COULEUR.site : "#cbd5e1" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-zinc-400">
        {[0, 6, 12, 18, 23].map((h) => <span key={h}>{String(h).padStart(2, "0")} h</span>)}
      </div>
      <p className="mt-2 text-xs text-zinc-500">Pointe autour de <b className="text-zinc-800">{String(pointe.h).padStart(2, "0")} h</b> (heure de Paris).</p>
    </div>
  );
}

function Liste({ titre, lignes, vide, icone: Icone, total, rendreCle }: { titre: string; lignes: Classement; vide: string; icone: typeof Globe; total: number; rendreCle?: (c: string) => React.ReactNode }) {
  const max = Math.max(1, ...lignes.map((l) => l.vues));
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900"><Icone className="h-4 w-4 text-zinc-400" /> {titre}</h3>
      {lignes.length === 0 ? <p className="text-xs text-zinc-400">{vide}</p> : (
        <ul className="space-y-2">
          {lignes.map((l) => {
            const part = total ? Math.round((l.vues / total) * 100) : 0;
            return (
              <li key={l.cle} className="text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-zinc-700" title={l.cle}>{rendreCle ? rendreCle(l.cle) : <span className="truncate font-mono">{l.cle}</span>}</span>
                  <span className="flex-shrink-0 tabular-nums text-zinc-500">{l.vues} vue{l.vues > 1 ? "s" : ""} · <span className="text-zinc-400">{part}%</span></span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-zinc-100"><div className="h-1.5 rounded-full" style={{ width: `${(l.vues / max) * 100}%`, background: COULEUR.site }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * QUI VIENT, D'OÙ, QUAND — le site public et l'application, avec la tendance.
 *
 * ⚠️ « Visiteurs » est un chiffre PAR JOUR (l'empreinte change chaque nuit, voir
 * `lib/visites/empreinte.ts`) : le cumul compte dix fois la personne venue dix jours.
 * Seuls les « comptes actifs » sont des personnes distinctes sur la période.
 */
export function VisitesPanel() {
  const [jours, setJours] = useState<7 | 30 | 90>(30);
  const [rep, setRep] = useState<Reponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = () => {
    setChargement(true); setErreur(null);
    fetch(`/api/admin/visites?jours=${jours}`)
      .then(async (r) => { const j = await r.json() as Reponse; if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`); setRep(j); })
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setChargement(false));
  };
  useEffect(charger, [jours]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = rep?.total;
  const p = rep?.precedent;
  const aujourdhui = rep?.jours[rep.jours.length - 1];
  const partApp = t && t.vues ? Math.round((t.vuesApp / t.vues) * 100) : 0;

  const kpis: { label: string; value: number | undefined; note: string; fort?: boolean; actuel?: number; precedent?: number }[] = [
    { label: "Comptes actifs", value: t?.comptesActifs, note: `clients distincts sur ${jours} j`, fort: true, actuel: t?.comptesActifs, precedent: p?.comptesActifs },
    { label: "Pages vues", value: t?.vues, note: `${jours} derniers jours`, actuel: t?.vues, precedent: p?.vues },
    { label: "Visiteurs (cumul/jour)", value: t?.visiteursJours, note: "somme des visiteurs quotidiens", actuel: t?.visiteursJours, precedent: p?.visiteursJours },
    { label: "Visiteurs aujourd'hui", value: aujourdhui?.visiteurs, note: `${aujourdhui?.visiteursSite ?? 0} site · ${aujourdhui?.visiteursApp ?? 0} app` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900"><Globe className="h-5 w-5 text-sky-600" /> Visites</h2>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            Mesure maison, sans cookie ni tiers : empreinte quotidienne, adresse IP jamais stockée, robots et éditeur exclus. Tendance comparée aux {jours} jours précédents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
            {([7, 30, 90] as const).map((j) => (
              <button key={j} onClick={() => setJours(j)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${jours === j ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                {j} j
              </button>
            ))}
          </div>
          <button onClick={charger} className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 hover:bg-zinc-50" title="Recharger">
            <RefreshCw className={`h-4 w-4 ${chargement ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {erreur && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Mesure illisible : {erreur}. {/42P01|does not exist/i.test(erreur) ? "La table « visites » n'existe pas encore : lancer la migration 028." : "Rien ne permet de dire combien de personnes sont venues."}
        </p>
      )}
      {rep?.tronque && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Lecture tronquée à {rep.lues} lignes : les chiffres sont un MINIMUM. Il est temps d&apos;agréger en base.
        </p>
      )}

      {/* KPI avec tendance */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <div className={`text-2xl font-bold tabular-nums ${k.fort ? "text-emerald-700" : "text-zinc-900"}`}>{chargement && !rep ? "…" : (k.value ?? "—")}</div>
              {k.actuel !== undefined && k.precedent !== undefined && <Tendance actuel={k.actuel} precedent={k.precedent} />}
            </div>
            <div className="mt-0.5 text-xs font-medium text-zinc-600">{k.label}</div>
            <div className="text-[11px] text-zinc-400">{k.note}</div>
          </div>
        ))}
      </div>

      {/* Répartition site / app */}
      {t && t.vues > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">Site public vs application</h3>
            <div className="flex items-center gap-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COULEUR.site }} /> Site {100 - partApp}%</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COULEUR.app }} /> App {partApp}%</span>
            </div>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
            <div style={{ width: `${100 - partApp}%`, background: COULEUR.site }} />
            <div style={{ width: `${partApp}%`, background: COULEUR.app }} />
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">{t.vuesSite} vue(s) sur le site public · {t.vuesApp} dans l&apos;application connectée.</p>
        </div>
      )}

      {/* Graphes */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-zinc-900">Visiteurs par jour</h3>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COULEUR.site }} /> Site</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COULEUR.app }} /> App</span>
            </div>
          </div>
          {chargement && !rep ? <div className="flex items-center gap-2 py-10 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Lecture…</div>
            : rep ? <BarresJour jours={rep.jours} /> : null}
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900"><Clock className="h-4 w-4 text-zinc-400" /> Affluence par heure</h3>
          {rep ? <BarresHeure heures={rep.heures} /> : null}
        </div>
      </div>

      {/* Détails */}
      {rep && (
        <div className="grid gap-4 md:grid-cols-2">
          <Liste titre="Pages les plus vues" lignes={rep.pages} total={t?.vues ?? 0} vide="Aucune page vue sur la période." icone={Globe}
            rendreCle={(c) => <span className="truncate font-mono">{c}</span>} />
          <Liste titre="Provenance (comment ils arrivent)" lignes={rep.referents} total={rep.referents.reduce((s, l) => s + l.vues, 0)} vide="Accès directs, favoris ou applications — aucune provenance externe pour l'instant." icone={Globe}
            rendreCle={(c) => <span className="truncate font-mono">{c}</span>} />
          <Liste titre="Appareils" lignes={rep.appareils} total={rep.appareils.reduce((s, l) => s + l.vues, 0)} vide="—" icone={rep.appareils[0]?.cle === "mobile" ? Smartphone : Monitor}
            rendreCle={(c) => <span className="capitalize">{c}</span>} />
          <Liste titre="Pays" lignes={rep.pays} total={rep.pays.reduce((s, l) => s + l.vues, 0)} vide="Pays non transmis par l'hébergeur." icone={Globe}
            rendreCle={(c) => <span className="flex items-center gap-1.5">{drapeau(c)} {NOM_PAYS[c] ?? c}</span>} />
          <Liste titre="Langues du navigateur" lignes={rep.langues} total={rep.langues.reduce((s, l) => s + l.vues, 0)} vide="—" icone={Users}
            rendreCle={(c) => <span className="capitalize">{NOM_LANGUE[c] ?? c}</span>} />
        </div>
      )}
    </div>
  );
}
