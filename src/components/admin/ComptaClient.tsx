"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Download, X, Settings2,
  Search, Ban, AlertCircle, Check, Repeat, Loader2, FileText, PenLine, ArrowRight, Paperclip, Sparkles, CalendarClock,
} from "lucide-react";
import {
  CATEGORIES, MOYENS, categorieDe, enCentimes, euros, totaux, cotisationsEstimees,
  versCSV, versLivreRecettes, valider, soldeCumule, numeroter, doublonsProbables, parTrimestre,
  modelesRecurrents, evolution, cotisations, type Ecriture, type Reglages, type Sens,
} from "@/lib/compta/model";

/**
 * COMPTABILITÉ — l'écran.
 *
 * Trois partis pris, tous du même ordre :
 *
 * 1. ⚠️ AUCUN CHIFFRE INVENTÉ. Pas de données de démonstration, pas de taux de
 *    cotisations pré-rempli, pas de seuil de franchise codé en dur. Ces valeurs changent
 *    chaque année et dépendent d'un statut que l'application ne connaît pas : les
 *    afficher « pour l'exemple » produirait des estimations fausses impossibles à
 *    distinguer des vraies. Quand la donnée manque, l'écran le DIT.
 *
 * 2. ⚠️ ON N'EFFACE PAS, ON ANNULE. Une écriture barrée avec son motif reste lisible.
 *    Un journal dont on peut retirer une ligne ne peut servir de justificatif à rien.
 *
 * 3. Le vide se dit. Un journal vide affiche « aucune écriture », jamais un tableau de
 *    bord à zéro qui laisse croire à un exercice réellement nul.
 */

const MOIS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const moisLisible = (m: string) => `${MOIS_FR[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(2, 4)}`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);

type Brouillon = {
  date: string; libelle: string; sens: Sens; categorie: string; montant: string;
  moyen: string; tiers: string; piece: string; tvaTaux: string; note: string; recurrente: boolean;
  pieceFichier?: string; pieceNom?: string;
};
const brouillonVide = (): Brouillon => ({
  date: aujourdhui(), libelle: "", sens: "sortie", categorie: "hebergement", montant: "",
  moyen: "Carte", tiers: "", piece: "", tvaTaux: "", note: "", recurrente: false,
});

export function ComptaClient() {
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [reglages, setReglages] = useState<Reglages>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [b, setB] = useState<Brouillon>(brouillonVide());
  const [erreursForm, setErreursForm] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [envoiPiece, setEnvoiPiece] = useState(false);
  const [lecture, setLecture] = useState<string[] | null>(null);
  const [acces, setAcces] = useState<{ le: string; par: string; ip: string | null; appareil: string }[]>([]);

  // Filtres
  const [annee, setAnnee] = useState<string>("toutes");
  const [filtreSens, setFiltreSens] = useState<"tous" | Sens>("tous");
  const [filtreCat, setFiltreCat] = useState("toutes");
  const [recherche, setRecherche] = useState("");
  const [voirAnnulees, setVoirAnnulees] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await fetch("/api/admin/compta", { cache: "no-store" });
      const j = await r.json();
      // ⚠️ Une erreur de lecture doit se VOIR. Un journal qui s'affiche vide parce que la
      // requête a échoué se lit exactement comme un journal vide.
      if (!r.ok || !j.ok) { setErreur(j.error || "Lecture impossible."); setEcritures([]); }
      else { setErreur(""); setEcritures(j.ecritures ?? []); setReglages(j.reglages ?? {}); setAcces(j.acces ?? []); }
    } catch { setErreur("Le serveur n'a pas répondu."); }
    setChargement(false);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const annees = useMemo(() => {
    const s = new Set(ecritures.map((e) => e.date.slice(0, 4)));
    return [...s].sort((a, z) => z.localeCompare(a));
  }, [ecritures]);

  /** Périmètre des CALCULS : l'année choisie, annulées exclues par les totaux. */
  const duPerimetre = useMemo(
    () => ecritures.filter((e) => annee === "toutes" || e.date.startsWith(annee)),
    [ecritures, annee],
  );

  const t = useMemo(() => totaux(duPerimetre), [duPerimetre]);

  /**
   * La même période, un an plus tôt.
   *
   * ⚠️ Seulement quand UNE année est sélectionnée. Comparer « tout l'historique » à
   * quelque chose n'a pas de sens, et un écart affiché sans période de référence se lit
   * comme une performance.
   */
  const precedent = useMemo(() => {
    if (annee === "toutes") return null;
    const liste = ecritures.filter((e) => e.date.startsWith(String(Number(annee) - 1)));
    return liste.length ? totaux(liste) : null;
  }, [ecritures, annee]);

  // ⚠️ Numérotés sur TOUT le journal, pas sur le périmètre affiché : un numéro d'ordre
  // qui change selon le filtre ne désigne plus rien.
  const numeros = useMemo(() => numeroter(ecritures), [ecritures]);

  const soldes = useMemo(
    () => new Map(soldeCumule(duPerimetre, reglages.soldeInitialCents ?? 0).map((x) => [x.id, x.soldeCents])),
    [duPerimetre, reglages.soldeInitialCents],
  );

  const moisCourant = aujourdhui().slice(0, 7);
  const modeles = useMemo(() => modelesRecurrents(ecritures, moisCourant), [ecritures, moisCourant]);
  const aReporter = modeles.filter((m) => !m.dejaSaisi);
  const trimestres = useMemo(() => parTrimestre(duPerimetre), [duPerimetre]);

  // Doublon probable, calculé pendant la frappe : on avertit, on ne bloque pas.
  const doublons = useMemo(() => {
    const c = enCentimes(b.montant);
    if (c === null || !b.libelle.trim()) return [];
    return doublonsProbables({ date: b.date, libelle: b.libelle, montantCents: c, sens: b.sens }, ecritures);
  }, [b.date, b.libelle, b.montant, b.sens, ecritures]);
  const cot = useMemo(() => cotisations(duPerimetre, reglages), [duPerimetre, reglages]);
  const cotis = cot.totalCents;
  // ⚠️ La trésorerie N'EST PAS le résultat. Elle compte aussi l'argent personnel mis dans
  // l'entreprise et celui qu'on en sort — deux mouvements qui ne sont ni des recettes ni
  // des charges, mais qui déplacent bien de l'argent.
  const tresorerie = (reglages.soldeInitialCents ?? 0) + t.resultatCents + t.apportsCents - t.retraitsCents;

  /** Périmètre du TABLEAU : les filtres d'affichage s'ajoutent au périmètre de calcul. */
  const listees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return duPerimetre
      .filter((e) => (voirAnnulees ? true : !e.annulee))
      .filter((e) => filtreSens === "tous" || e.sens === filtreSens)
      .filter((e) => filtreCat === "toutes" || e.categorie === filtreCat)
      .filter((e) => !q || e.libelle.toLowerCase().includes(q) || (e.tiers ?? "").toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q))
      .sort((x, y) => y.date.localeCompare(x.date) || (y.saisieLe ?? "").localeCompare(x.saisieLe ?? ""));
  }, [duPerimetre, filtreSens, filtreCat, recherche, voirAnnulees]);

  const catsDuSens = CATEGORIES.filter((c) => c.sens === b.sens);

  /**
   * Dépose la pièce AVANT d'enregistrer l'écriture.
   *
   * ⚠️ L'inverse — créer l'écriture puis attacher — laisserait une ligne sans pièce si
   * le dépôt échoue, et personne ne saurait qu'il manque quelque chose : c'est
   * précisément le document qu'on doit pouvoir produire dix ans plus tard.
   */
  async function deposerPiece(f: File) {
    setEnvoiPiece(true); setErreursForm([]);
    const fd = new FormData(); fd.append("fichier", f);
    const r = await fetch("/api/admin/compta/piece", { method: "POST", body: fd });
    const j = await r.json();
    setEnvoiPiece(false);
    if (!r.ok || !j.ok) { setErreursForm(j.erreurs ?? ["Dépôt refusé."]); return; }
    setB((prev) => ({ ...prev, pieceFichier: j.chemin, pieceNom: j.nom }));
    await lirePiece(f);
  }

  /**
   * Lit la facture et PRÉ-REMPLIT — sans jamais enregistrer, ni écraser ce qui est saisi.
   *
   * ⚠️ Seuls les champs LAISSÉS VIDES sont remplis. Écraser une valeur tapée à la main
   * par une valeur lue ferait perdre une correction sans le dire — et la correction est
   * justement ce que l'humain apporte à une lecture automatique.
   */
  async function lirePiece(f: File) {
    setLecture([]);
    const fd = new FormData(); fd.append("fichier", f);
    const r = await fetch("/api/admin/compta/lire", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { setLecture(j.erreurs ?? ["Lecture impossible — saisis l'écriture à la main."]); return; }
    const g = j.suggestion as {
      date?: string; libelle?: string; montantCents?: number; tiers?: string;
      piece?: string; categorie?: string; sens?: Sens; avertissements: string[];
    };
    setB((prev) => ({
      ...prev,
      sens: g.sens ?? prev.sens,
      date: g.date ?? prev.date,
      libelle: prev.libelle || g.libelle || "",
      montant: prev.montant || (g.montantCents ? (g.montantCents / 100).toFixed(2).replace(".", ",") : ""),
      tiers: prev.tiers || g.tiers || "",
      piece: prev.piece || g.piece || "",
      categorie: g.categorie && !prev.libelle ? g.categorie : prev.categorie,
    }));
    setLecture(g.avertissements ?? []);
  }

  async function enregistrer() {
    const cents = enCentimes(b.montant);
    const projet: Partial<Ecriture> = {
      date: b.date, libelle: b.libelle, sens: b.sens, categorie: b.categorie,
      montantCents: cents ?? NaN, moyen: b.moyen as Ecriture["moyen"],
      tiers: b.tiers || undefined, piece: b.piece || undefined,
      tvaTaux: reglages.tva && b.tvaTaux ? Number(b.tvaTaux) : undefined,
      note: b.note || undefined, recurrente: b.recurrente,
      pieceFichier: b.pieceFichier,
    };
    // ⚠️ « Montant illisible » plutôt que 0 : une faute de frappe transformée en zéro
    // entrerait dans le journal sans que personne ne la voie.
    const errs = cents === null ? ["Montant illisible (ex. 12,50)."] : valider(projet);
    if (errs.length) { setErreursForm(errs); return; }

    setEnvoi(true); setErreursForm([]);
    const r = await fetch("/api/admin/compta", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(projet),
    });
    const j = await r.json();
    setEnvoi(false);
    if (!r.ok || !j.ok) { setErreursForm(j.erreurs ?? ["Enregistrement refusé."]); return; }
    setEcritures((prev) => [j.ecriture as Ecriture, ...prev]);
    setLecture(null);
    // La pièce n'est PAS conservée d'une écriture à l'autre : rattacher par erreur la
    // facture précédente à une nouvelle ligne est pire que ne rien attacher.
    setB({ ...brouillonVide(), date: b.date, sens: b.sens, categorie: b.categorie, moyen: b.moyen });
    setFormOuvert(false);
  }

  /**
   * Corriger une écriture : on l'annule et on rouvre le formulaire pré-rempli.
   *
   * ⚠️ Il n'y a PAS de bouton « modifier », et ce n'est pas un oubli : réécrire une ligne
   * déjà passée détruit la trace de ce qui avait été enregistré. La correction comptable,
   * c'est une annulation motivée suivie d'une nouvelle écriture — les deux restent
   * visibles. Ce bouton fait simplement les deux gestes d'un coup.
   */
  async function corriger(e: Ecriture) {
    const ok = await annuler(e, "Erreur de saisie — remplacée par une nouvelle écriture");
    if (!ok) return;
    setB({
      date: e.date, libelle: e.libelle, sens: e.sens, categorie: e.categorie,
      montant: (e.montantCents / 100).toFixed(2).replace(".", ","),
      moyen: e.moyen, tiers: e.tiers ?? "", piece: e.piece ?? "",
      tvaTaux: e.tvaTaux === undefined ? "" : String(e.tvaTaux),
      note: e.note ?? "", recurrente: Boolean(e.recurrente),
    });
    setErreursForm([]); setFormOuvert(true);
  }

  /** Reporte une charge mensuelle connue sur le mois en cours, en un clic. */
  async function reporter(m: { libelle: string; categorie: string; montantCents: number; moyen: string; tiers?: string }) {
    const projet: Partial<Ecriture> = {
      date: aujourdhui(), libelle: m.libelle, sens: "sortie", categorie: m.categorie,
      montantCents: m.montantCents, moyen: m.moyen as Ecriture["moyen"], tiers: m.tiers, recurrente: true,
      note: "Report de la charge mensuelle précédente.",
    };
    const r = await fetch("/api/admin/compta", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(projet),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) { window.alert((j.erreurs ?? ["Report refusé."]).join("\n")); return; }
    setEcritures((prev) => [j.ecriture as Ecriture, ...prev]);
  }

  async function annuler(e: Ecriture, motifPropose = "") {
    const motif = window.prompt(`Annuler « ${e.libelle} » (${euros(e.montantCents)}) ?\n\nMotif — il restera dans le journal :`, motifPropose);
    if (motif === null) return false;
    if (!motif.trim()) { window.alert("Un motif est obligatoire : une annulation sans raison est indiscernable d'une fausse manœuvre."); return false; }
    const r = await fetch("/api/admin/compta", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "annuler", id: e.id, motif }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) { window.alert((j.erreurs ?? ["Annulation refusée."]).join("\n")); return false; }
    setEcritures((prev) => prev.map((x) => x.id === e.id
      ? { ...x, annulee: true, motifAnnulation: motif, annuleeLe: new Date().toISOString() } : x));
    return true;
  }

  async function sauverReglages(r: Reglages) {
    setReglages(r);
    await fetch("/api/admin/compta", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reglages", reglages: r }),
    });
  }

  function telecharger(contenu: string, nom: string) {
    const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = nom; a.click();
    URL.revokeObjectURL(url);
  }

  function exporterLivre() {
    telecharger(versLivreRecettes(duPerimetre), `livre-des-recettes-${annee === "toutes" ? "tout" : annee}.csv`);
  }

  function exporter() {
    // Les annulées SONT exportées, marquées : un export qui les masque ne justifie rien.
    telecharger(versCSV(duPerimetre), `pacevo-comptabilite-${annee === "toutes" ? "tout" : annee}.csv`);
  }

  const maxMois = Math.max(1, ...t.parMois.map((m) => Math.max(m.entreesCents, m.sortiesCents)));

  if (chargement) {
    return <div className="p-8 flex items-center gap-3 text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" />Chargement du journal…</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
      {erreur && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div><b>Le journal n'a pas pu être lu.</b><div className="mt-0.5 text-rose-700">{erreur}</div>
            <div className="mt-1 text-xs text-rose-600">Rien n'est affiché plutôt qu'un journal vide : un tableau à zéro se lirait comme un exercice réellement nul.</div></div>
        </div>
      )}

      {/* ─── Barre d'action ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Comptabilité</h2>
          <p className="text-sm text-zinc-400">Toutes les entrées et sorties d'argent, tenues à la main.</p>
        </div>
        <div className="flex-1" />
        <select value={annee} onChange={(ev) => setAnnee(ev.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700">
          <option value="toutes">Tout l'historique</option>
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => setReglagesOuverts((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
          <Settings2 className="w-4 h-4" />Réglages
        </button>
        {/* Deux exports, deux usages : le livre des recettes est le document que tient un
            micro-entrepreneur ; l'export complet sert à tout le reste. */}
        <button onClick={exporterLivre} disabled={!t.entreesCents}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          title="Le document obligatoire en micro-entreprise : recettes numérotées, dans l'ordre">
          <FileText className="w-4 h-4" />Livre des recettes
        </button>
        <button onClick={exporter} disabled={!duPerimetre.length}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">
          <Download className="w-4 h-4" />Export complet
        </button>
        <button onClick={() => { setFormOuvert((v) => !v); setErreursForm([]); }}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
          <Plus className="w-4 h-4" />Nouvelle écriture
        </button>
      </div>

      {/* ─── Réglages ───────────────────────────────────────────────────── */}
      {reglagesOuverts && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Taux de cotisations (%)</span>
              <input type="number" step="0.1" min="0" max="100" defaultValue={reglages.tauxCotisations ?? ""}
                onBlur={(e) => void sauverReglages({ ...reglages, tauxCotisations: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="ex. 23,1"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Taux réduit jusqu'au (ACRE)</span>
              <input type="date" defaultValue={reglages.acreJusquau ?? ""}
                onBlur={(e) => void sauverReglages({ ...reglages, acreJusquau: e.target.value || undefined })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Taux après l'ACRE (%)</span>
              <input type="number" step="0.1" min="0" max="100" defaultValue={reglages.tauxApresAcre ?? ""}
                onBlur={(e) => void sauverReglages({ ...reglages, tauxApresAcre: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="taux plein"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Seuil de CA à surveiller (€)</span>
              <input type="number" min="0" defaultValue={reglages.seuilCA ?? ""}
                onBlur={(e) => void sauverReglages({ ...reglages, seuilCA: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="ex. 77700"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Solde de départ (€)</span>
              <input type="text" defaultValue={reglages.soldeInitialCents ? (reglages.soldeInitialCents / 100).toFixed(2).replace(".", ",") : ""}
                onBlur={(e) => void sauverReglages({ ...reglages, soldeInitialCents: enCentimes(e.target.value) ?? undefined })}
                placeholder="ex. 250,00"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={Boolean(reglages.tva)}
                onChange={(e) => void sauverReglages({ ...reglages, tva: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm font-medium text-zinc-700">Assujetti à la TVA</span>
            </label>
          </div>
          {/* ─── Qui a ouvert une facture ────────────────────────────────────
              Une trace que personne ne peut lire ne répond à aucune question. */}
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <div className="text-xs font-semibold text-zinc-500">Consultations des factures</div>
            {acces.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-400">Aucune facture n'a encore été ouverte.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {acces.slice(0, 8).map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">{new Date(a.le).toLocaleString("fr-FR")}</span>
                    <span>{a.par}</span>
                    {a.ip && <span className="text-zinc-400">depuis {a.ip}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ⚠️ Dit explicitement d'où viennent les taux. L'application n'en connaît aucun. */}
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Ces taux viennent de <b>toi</b>, pas de l'application : ils changent chaque année et dépendent de ton
              statut juridique. À relever sur <b>urssaf.fr</b> et <b>impots.gouv.fr</b>. Tant qu'un taux n'est pas
              renseigné, l'estimation correspondante affiche « non renseigné » au lieu d'un montant.
            </span>
          </p>
        </div>
      )}

      {/* ─── Formulaire ─────────────────────────────────────────────────── */}
      {formOuvert && (
        <div
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          onKeyDown={(ev) => { if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); void enregistrer(); } }}
        >
          <div className="mb-4 inline-flex rounded-xl bg-zinc-100 p-1">
            {(["sortie", "entree"] as Sens[]).map((s) => (
              <button key={s}
                onClick={() => setB({ ...b, sens: s, categorie: CATEGORIES.find((c) => c.sens === s)!.id, recurrente: false })}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  b.sens === s ? (s === "entree" ? "bg-white text-emerald-700 shadow-sm" : "bg-white text-rose-700 shadow-sm") : "text-zinc-500"}`}>
                {s === "entree" ? "Recette" : "Dépense"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Date de l'opération</span>
              <input type="date" value={b.date} onChange={(e) => setB({ ...b, date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            <label className="block lg:col-span-2"><span className="text-xs font-semibold text-zinc-500">Libellé</span>
              <input value={b.libelle} onChange={(e) => setB({ ...b, libelle: e.target.value })}
                placeholder={b.sens === "entree" ? "Abonnement Premium — août" : "Vercel — abonnement mensuel"}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Montant TTC (€)</span>
              <input value={b.montant} onChange={(e) => setB({ ...b, montant: e.target.value })} inputMode="decimal"
                placeholder="12,50" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Catégorie</span>
              <select value={b.categorie} onChange={(e) => setB({ ...b, categorie: e.target.value })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                {catsDuSens.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Moyen</span>
              <select value={b.moyen} onChange={(e) => setB({ ...b, moyen: e.target.value })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                {MOYENS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Tiers (facultatif)</span>
              <input value={b.tiers} onChange={(e) => setB({ ...b, tiers: e.target.value })}
                placeholder="Vercel Inc." className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Référence de la pièce</span>
              <input value={b.piece} onChange={(e) => setB({ ...b, piece: e.target.value })}
                placeholder="N° de facture" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            {/* ⚠️ L'obligation est de CONSERVER la facture, pas d'en noter le numéro :
                un numéro sans document ne justifie rien. Le fichier va dans un espace
                PRIVÉ — les deux autres seaux du projet sont publics. */}
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Facture (PDF ou photo)</span>
              {b.pieceFichier ? (
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{b.pieceNom}</span>
                  <button onClick={() => setB({ ...b, pieceFichier: undefined, pieceNom: undefined })}
                    className="text-emerald-600 hover:text-emerald-800" title="Retirer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <input type="file" accept="application/pdf,image/*" disabled={envoiPiece}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void deposerPiece(f); }}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-1.5 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium" />
              )}
              {envoiPiece && <span className="mt-1 block text-xs text-zinc-400">Dépôt et lecture en cours…</span>}
            </label>
            {reglages.tva && (
              <label className="block"><span className="text-xs font-semibold text-zinc-500">TVA (%)</span>
                <input value={b.tvaTaux} onChange={(e) => setB({ ...b, tvaTaux: e.target.value })} inputMode="decimal"
                  placeholder="20" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            )}
            <label className="block lg:col-span-2"><span className="text-xs font-semibold text-zinc-500">Note (facultatif)</span>
              <input value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></label>
            {/* ⚠️ Dit AU MOMENT DU CHOIX pourquoi cette ligne ne comptera pas dans le CA.
                Le découvrir plus tard, en constatant que le chiffre d'affaires n'a pas
                bougé, ferait douter du calcul plutôt que comprendre la règle. */}
            {categorieDe(b.categorie)?.horsResultat && (
              <p className="sm:col-span-2 lg:col-span-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Cette ligne bouge la <b>trésorerie</b> et rien d'autre : ni chiffre d'affaires, ni charge, ni
                  cotisations. Ton propre argent n'est pas une recette — le compter comme telle te ferait cotiser
                  dessus et te rapprocherait d'un plafond sans qu'un euro ait été facturé.
                </span>
              </p>
            )}
            {b.sens === "sortie" && (
              <label className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" checked={b.recurrente} onChange={(e) => setB({ ...b, recurrente: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300" />
                <span className="text-sm font-medium text-zinc-700">Charge mensuelle</span>
              </label>
            )}
          </div>

          {/* ⚠️ AVERTIR, PAS BLOQUER. Deux abonnements identiques le même jour arrivent
              vraiment ; refuser la seconde ligne pousserait à contourner l'outil. Mais
              saisir deux fois la même facture est l'erreur la plus banale d'une compta
              tenue à la main — et elle devient invisible une fois enregistrée. */}
          {/* ⚠️ La lecture PROPOSE, elle n'enregistre rien. Un total mal lu deviendrait
              une ligne comptable fausse, indiscernable d'une ligne juste une fois
              enregistrée. Ce bandeau dit toujours de vérifier, même quand tout est lu. */}
          {lecture !== null && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>Lu sur la pièce — à vérifier.</b>{" "}
                {lecture.length
                  ? <>Non lu : {lecture.join(" ")}</>
                  : "Tous les champs ont été proposés ; contrôle le montant et la date avant d'enregistrer."}
              </span>
            </div>
          )}

          {doublons.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Une écriture identique existe déjà le {b.date.split("-").reverse().join("/")} —
                <b> {doublons[0].libelle}</b>, {euros(doublons[0].montantCents)}.
                Si c'est bien un second paiement, enregistre : rien ne t'en empêche.
              </span>
            </div>
          )}

          {erreursForm.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {erreursForm.map((e) => <li key={e} className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{e}</li>)}
            </ul>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => void enregistrer()} disabled={envoi}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Enregistrer
            </button>
            <span className="text-xs text-zinc-400">⌘ + Entrée</span>
            <button onClick={() => { setFormOuvert(false); setErreursForm([]); setLecture(null); }}
              className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100">Annuler</button>
          </div>
        </div>
      )}

      {/* ─── Premier pas ────────────────────────────────────────────────────
          ⚠️ À journal vide, quatre cartes de « 0,00 € », trois pavés d'explication et une
          barre de filtres qui ne filtrent rien : le bruit cache la seule chose à faire.
          Un tableau de bord n'a de sens qu'une fois qu'il y a quelque chose à montrer. */}
      {ecritures.length === 0 && !formOuvert && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <Wallet className="mx-auto h-9 w-9 text-zinc-200" />
          <h3 className="mt-4 text-lg font-bold text-zinc-900">Ton journal est vide</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-500">
            Commence par ce que tu paies déjà : hébergement, nom de domaine, API. Coche « charge mensuelle » et
            elles se reporteront en un clic chaque mois. Les encaissements Stripe, eux, s'inscriront tout seuls.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => { setB({ ...brouillonVide() }); setFormOuvert(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              <Plus className="h-4 w-4" />Première écriture
            </button>
            <button onClick={() => setReglagesOuverts(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
              <Settings2 className="h-4 w-4" />Renseigner mes taux<ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Chiffres clés ──────────────────────────────────────────────────
          ⚠️ Le RÉSULTAT domine, les autres l'expliquent. Quatre cartes de même poids
          obligent à chercher lequel des quatre chiffres compte — alors qu'un seul répond
          à la question qu'on se pose en ouvrant cet écran. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <FileText className="h-3.5 w-3.5" />Résultat {annee === "toutes" ? "" : annee}
          </div>
          <div className={`mt-2 text-4xl font-extrabold tracking-tight ${t.resultatCents < 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {euros(t.resultatCents, true)}
          </div>
          <Ecart actuel={t.resultatCents} precedent={precedent?.resultatCents} annee={annee} />
          {cotis !== null && (
            <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              Après cotisations : <b className="text-zinc-800">{euros(t.resultatCents - cotis, true)}</b>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <Carte titre="Recettes" valeur={euros(t.entreesCents)} icone={<TrendingUp className="w-4 h-4 text-emerald-600" />} fond="bg-emerald-50"
            ecart={<Ecart actuel={t.entreesCents} precedent={precedent?.entreesCents} annee={annee} />} />
          <Carte titre="Dépenses" valeur={euros(t.sortiesCents)} icone={<TrendingDown className="w-4 h-4 text-rose-600" />} fond="bg-rose-50"
            ecart={<Ecart actuel={t.sortiesCents} precedent={precedent?.sortiesCents} annee={annee} inverse />} />
          {/* La carte OUVRE le réglage : « solde de départ non renseigné » sans moyen de
              le renseigner depuis là est un constat qui ne mène à rien. */}
          <button onClick={() => setReglagesOuverts(true)} className="text-left">
            <Carte titre="Trésorerie" valeur={euros(tresorerie)} icone={<Wallet className="w-4 h-4 text-blue-600" />} fond="bg-blue-50"
              sous={[
                reglages.soldeInitialCents ? `${euros(reglages.soldeInitialCents)} de départ` : "solde de départ à renseigner →",
                t.apportsCents ? `+${euros(t.apportsCents)} d'apports` : "",
                t.retraitsCents ? `−${euros(t.retraitsCents)} de retraits` : "",
              ].filter(Boolean).join(" · ")} />
          </button>
        </div>
      </div>

      {/* ─── Fin de l'ACRE ──────────────────────────────────────────────────
          ⚠️ Le taux réduit s'arrête à une date précise, et le taux REMONTE. Sans rappel,
          on continue de provisionner au taux réduit pendant des mois — l'écart ne se
          découvre qu'à l'appel de cotisations, quand l'argent est déjà dépensé. */}
      {cot.joursAvantFinAcre !== null && (
        <div className={`flex items-start gap-2 rounded-2xl border p-4 text-sm ${
          cot.joursAvantFinAcre < 0 ? "border-zinc-200 bg-zinc-50 text-zinc-600"
            : cot.joursAvantFinAcre <= 60 ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-blue-200 bg-blue-50 text-blue-800"}`}>
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {cot.joursAvantFinAcre < 0
              ? <>Ton taux réduit a pris fin le <b>{reglages.acreJusquau?.split("-").reverse().join("/")}</b>.
                  Les recettes postérieures sont estimées au taux plein.</>
              : <>Taux réduit jusqu'au <b>{reglages.acreJusquau?.split("-").reverse().join("/")}</b> —
                  encore <b>{cot.joursAvantFinAcre} jour{cot.joursAvantFinAcre > 1 ? "s" : ""}</b>.
                  {reglages.tauxApresAcre === undefined && " Pense à renseigner le taux qui s'appliquera ensuite."}</>}
          </span>
        </div>
      )}

      {/* ─── Charges mensuelles à reporter ──────────────────────────────────
          La partie la plus fastidieuse d'une compta tenue à la main, donc celle qu'on
          oublie. Une charge déjà reportée ce mois-ci n'apparaît pas : c'est la façon la
          plus simple de créer un doublon en croyant bien faire. */}
      {aReporter.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <Repeat className="h-3.5 w-3.5" />
            {aReporter.length} charge{aReporter.length > 1 ? "s" : ""} mensuelle{aReporter.length > 1 ? "s" : ""} pas encore saisie{aReporter.length > 1 ? "s" : ""} ce mois-ci
          </div>
          <div className="flex flex-wrap gap-2">
            {aReporter.map((m) => (
              <button key={m.libelle + m.categorie} onClick={() => void reporter(m)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50">
                <Plus className="h-3 w-3 text-amber-600" />{m.libelle}
                <span className="text-zinc-400">{euros(m.montantCents)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {ecritures.length > 0 && (
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cotisations */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-zinc-400">Cotisations estimées</div>
          {cotis === null ? (
            <>
              <div className="mt-1 text-lg font-semibold text-zinc-400">
                {cot.manquant.length ? "Calcul impossible" : "Taux non renseigné"}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {cot.manquant.length
                  ? <>Il manque <b>{cot.manquant.join(" et ")}</b>. Rien n'est estimé : additionner ce qui est calculable
                      et taire le reste donnerait un montant plus petit que la réalité, avec l'apparence d'un vrai total.</>
                  : <>Aucun taux n'est appliqué par défaut : il change chaque année et dépend de ton statut.
                      Renseigne-le dans <b>Réglages</b> après l'avoir relevé sur urssaf.fr.</>}
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 text-2xl font-bold text-zinc-900">{euros(cotis)}</div>
              {/* Détail par période : pendant l'ACRE et après, deux taux, deux assiettes. */}
              {cot.tranches.filter((x) => x.recettesCents > 0).map((x) => (
                <p key={x.libelle} className="mt-1 text-xs text-zinc-400">
                  {x.libelle} — {x.taux} % de {euros(x.recettesCents)} = <b className="text-zinc-600">{euros(x.cotisationsCents ?? 0)}</b>
                </p>
              ))}
              <p className="mt-2 text-xs text-zinc-500">Après cotisations : <b>{euros(t.resultatCents - cotis, true)}</b></p>
            </>
          )}
        </div>

        {/* Charges fixes */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400"><Repeat className="w-3 h-3" />Charges fixes mensuelles</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{euros(t.chargesFixesMensuellesCents)}</div>
          <p className="mt-1 text-xs text-zinc-400">soit {euros(t.chargesFixesMensuellesCents * 12)} sur un an</p>
          <p className="mt-2 text-xs text-zinc-500">
            Calculé sur la <b>dernière</b> occurrence de chaque charge cochée « mensuelle », pas sur leur somme —
            douze lignes d'hébergement annonceraient sinon douze fois le montant.
          </p>
        </div>

        {/* Seuil */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-zinc-400">Chiffre d'affaires</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{euros(t.entreesCents)}</div>
          {reglages.seuilCA ? (() => {
            const seuilC = reglages.seuilCA * 100;
            const pct = Math.min(100, Math.round((t.entreesCents / seuilC) * 100));
            return (
              <>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-zinc-500">{pct} % du seuil que tu surveilles ({euros(seuilC)})</p>
              </>
            );
          })() : (
            <p className="mt-2 text-xs text-zinc-500">
              Aucun seuil surveillé. Les plafonds légaux changent chaque année : renseigne le tien dans <b>Réglages</b>.
            </p>
          )}
        </div>
      </div>

      )}

      {/* ─── TVA, seulement si assujetti ────────────────────────────────── */}
      {reglages.tva && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Carte titre="TVA collectée" valeur={euros(t.tvaCollecteeCents)} icone={<TrendingUp className="w-4 h-4 text-emerald-600" />} fond="bg-emerald-50" />
          <Carte titre="TVA déductible" valeur={euros(t.tvaDeductibleCents)} icone={<TrendingDown className="w-4 h-4 text-blue-600" />} fond="bg-blue-50" />
          <Carte titre="TVA à reverser" valeur={euros(t.tvaCollecteeCents - t.tvaDeductibleCents, true)} icone={<FileText className="w-4 h-4 text-violet-600" />} fond="bg-violet-50" />
        </div>
      )}

      {/* ─── Mois par mois ──────────────────────────────────────────────── */}
      {t.parMois.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Mois par mois</h3>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Recettes</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-rose-400" />Dépenses</span>
            </div>
          </div>
          <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 140 }}>
            {t.parMois.map((m) => (
              <div key={m.mois} className="flex min-w-[42px] flex-1 flex-col items-center gap-1">
                <div className="flex h-[104px] w-full items-end justify-center gap-1">
                  <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${Math.round((m.entreesCents / maxMois) * 100)}%` }} title={`Recettes : ${euros(m.entreesCents)}`} />
                  <div className="w-1/2 rounded-t bg-rose-400" style={{ height: `${Math.round((m.sortiesCents / maxMois) * 100)}%` }} title={`Dépenses : ${euros(m.sortiesCents)}`} />
                </div>
                <div className="text-[10px] text-zinc-400">{moisLisible(m.mois)}</div>
                <div className={`text-[10px] font-semibold ${m.resultatCents < 0 ? "text-rose-500" : "text-emerald-600"}`}>{euros(m.resultatCents, true)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Par poste ──────────────────────────────────────────────────── */}
      {t.parCategorie.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-zinc-700">Par poste</h3>
          <div className="space-y-2">
            {t.parCategorie.map((c) => {
              const base = c.sens === "entree" ? t.entreesCents : t.sortiesCents;
              const pct = base ? Math.round((c.cents / base) * 100) : 0;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-56 shrink-0 truncate text-sm text-zinc-600">{c.label}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${c.sens === "entree" ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-24 shrink-0 text-right text-sm font-semibold text-zinc-800">{euros(c.cents)}</div>
                  <div className="w-10 shrink-0 text-right text-xs text-zinc-400">{pct} %</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Par trimestre ──────────────────────────────────────────────────
          ⚠️ On ne déclare pas un cumul « depuis le début », on déclare une PÉRIODE.
          Recopier un total général dans un formulaire trimestriel est une erreur qu'on
          ne découvre qu'au redressement. Ces montants sont ceux qui se recopient. */}
      {trimestres.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Par trimestre</h3>
            <span className="text-xs text-zinc-400">recettes encaissées, à recopier dans tes déclarations</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trimestres.map((q) => (
              <div key={q.periode} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <div className="text-xs font-semibold text-zinc-400">{q.periode.replace("-", " ")}</div>
                <div className="mt-1 text-lg font-bold text-zinc-900">{euros(q.recettesCents)}</div>
                <div className="text-[11px] text-zinc-400">dépenses {euros(q.depensesCents)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Ce sont les recettes <b>encaissées</b> sur la période. L'application ne remplit aucun formulaire et ne
            connaît aucun taux : elle te donne le montant, tu le reportes.
          </p>
        </div>
      )}

      {/* ─── Journal ──────────────────────────────────────────────────────
          Masqué quand il n'y a rien : le premier pas guidé le remplace, et deux états
          vides empilés disant la même chose font douter qu'ils parlent du même sujet. */}
      {ecritures.length > 0 && (
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-4">
          <h3 className="text-sm font-semibold text-zinc-700">Journal</h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{listees.length}</span>
          <div className="flex-1" />
          {ecritures.length > 0 && (<>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…"
              className="w-44 rounded-xl border border-zinc-200 py-1.5 pl-8 pr-3 text-sm" />
          </div>
          <select value={filtreSens} onChange={(e) => setFiltreSens(e.target.value as "tous" | Sens)}
            className="rounded-xl border border-zinc-200 px-2 py-1.5 text-sm text-zinc-600">
            <option value="tous">Tout</option><option value="entree">Recettes</option><option value="sortie">Dépenses</option>
          </select>
          <select value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)}
            className="rounded-xl border border-zinc-200 px-2 py-1.5 text-sm text-zinc-600">
            <option value="toutes">Tous les postes</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={voirAnnulees} onChange={(e) => setVoirAnnulees(e.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-300" />
            Voir les annulées{t.nbAnnulees > 0 ? ` (${t.nbAnnulees})` : ""}
          </label>
          </>)}
        </div>

        {listees.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="mx-auto h-8 w-8 text-zinc-200" />
            <p className="mt-3 text-sm font-medium text-zinc-500">
              {ecritures.length === 0 ? "Aucune écriture. Le journal est vide." : "Aucune écriture ne correspond à ces filtres."}
            </p>
            {ecritures.length === 0 && (
              <p className="mx-auto mt-2 max-w-md text-xs text-zinc-400">
                Rien n'est pré-rempli et aucun exemple n'est affiché : un tableau de bord garni de chiffres
                inventés ne se distingue pas d'un vrai. Dès que tes clés Stripe seront en place, chaque
                encaissement s'inscrira ici tout seul — montant brut et commission séparés — et tu recevras
                un e-mail. En attendant, tout se saisit à la main.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                  {/* Un livre de recettes se tient par numéros d'ordre continus : sans
                      eux, rien ne montre qu'il ne manque pas une ligne au milieu. */}
                  <th className="px-4 py-2 font-medium" title="Numéro d'ordre, continu et définitif">N°</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Libellé</th>
                  <th className="px-4 py-2 font-medium">Poste</th>
                  <th className="px-4 py-2 font-medium">Moyen</th>
                  <th className="px-4 py-2 text-right font-medium">Montant</th>
                  <th className="px-4 py-2 text-right font-medium" title="Trésorerie après cette écriture">Solde</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {listees.map((e) => (
                  <tr key={e.id} className={`border-b border-zinc-50 last:border-0 ${e.annulee ? "bg-zinc-50/60 text-zinc-400" : "hover:bg-zinc-50/60"}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{numeros.get(e.id) ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500">{e.date.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${e.annulee ? "line-through" : "text-zinc-800"}`}>{e.libelle}</span>
                        {/* Une écriture automatique et une écriture saisie à la main n'ont
                            pas la même valeur de preuve : on doit les distinguer sans cliquer. */}
                        {e.origine === "stripe" && (
                          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">Stripe</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {[e.tiers, e.piece && `pièce ${e.piece}`, e.recurrente && "mensuelle", e.note].filter(Boolean).join(" · ")}
                        {e.pieceFichier && (
                          <a href={`/api/admin/compta/piece?chemin=${encodeURIComponent(e.pieceFichier)}`}
                            target="_blank" rel="noreferrer"
                            className="ml-1 inline-flex items-center gap-0.5 font-medium text-blue-500 hover:text-blue-700"
                            title="Ouvrir la facture (lien valable 2 minutes)">
                            <Paperclip className="h-3 w-3" />facture
                          </a>
                        )}
                      </div>
                      {e.annulee && <div className="mt-0.5 text-xs text-rose-500">Annulée — {e.motifAnnulation}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{categorieDe(e.categorie)?.label ?? e.categorie}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{e.moyen}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${
                      e.annulee ? "text-zinc-300 line-through" : e.sens === "entree" ? "text-emerald-600" : "text-rose-500"}`}>
                      {e.sens === "entree" ? "+" : "−"}{euros(e.montantCents).replace("−", "")}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right text-xs ${e.annulee ? "text-zinc-300" : "text-zinc-500"}`}>
                      {/* Le solde ne se calcule que sur les écritures vives, dans l'ordre
                          des opérations : une annulée n'a pas de solde, elle n'a rien bougé. */}
                      {e.annulee ? "—" : euros(soldes.get(e.id) ?? 0)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {!e.annulee && (
                        <>
                          {/* ⚠️ Pas de bouton « modifier », et ce n'est pas un oubli :
                              réécrire une ligne passée détruit la trace de ce qui avait
                              été enregistré. Corriger = annuler puis ressaisir. */}
                          <button onClick={() => void corriger(e)} title="Corriger : annule cette écriture et rouvre le formulaire pré-rempli"
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-blue-50 hover:text-blue-500">
                            <PenLine className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => void annuler(e)} title="Annuler cette écriture (elle reste au journal)"
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500">
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      )}

      {ecritures.length > 0 && (
      <p className="flex items-start gap-2 px-1 text-xs text-zinc-400">
        <X className="mt-0.5 h-3 w-3 shrink-0" />
        Une écriture ne se supprime pas : elle s'annule, avec son motif, et reste au journal. Un livre de recettes
        dont on peut retirer une ligne ne prouve plus rien.
      </p>
      )}
    </div>
  );
}

function Carte({ titre, valeur, icone, fond, sous, accent, ecart }: {
  titre: string; valeur: string; icone: React.ReactNode; fond: string; sous?: string; accent?: string; ecart?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${fond}`}>{icone}</div>
      <div className={`text-2xl font-bold ${accent ?? "text-zinc-900"}`}>{valeur}</div>
      <div className="mt-0.5 text-xs text-zinc-400">{titre}</div>
      {ecart}
      {sous && <div className="mt-1 text-[11px] text-zinc-400">{sous}</div>}
    </div>
  );
}

/**
 * L'écart avec la même période un an plus tôt.
 *
 * ⚠️ RIEN NE S'AFFICHE SANS BASE DE COMPARAISON. Un « +100 % » calculé à partir de zéro
 * ne veut rien dire, et se lit pourtant comme une performance. Quand il n'y a pas
 * d'année précédente, l'écran ne dit rien — c'est la seule réponse honnête.
 *
 * `inverse` : pour les DÉPENSES, une hausse n'est pas une bonne nouvelle. Colorer en vert
 * une augmentation de charges parce que « la flèche monte » induirait en erreur.
 */
function Ecart({ actuel, precedent, annee, inverse }: { actuel: number; precedent?: number; annee: string; inverse?: boolean }) {
  if (annee === "toutes" || precedent === undefined) return null;
  const pct = evolution(actuel, precedent);
  if (pct === null) return <div className="mt-1 text-[11px] text-zinc-400">rien en {Number(annee) - 1} : pas de comparaison</div>;
  const bon = inverse ? pct <= 0 : pct >= 0;
  return (
    <div className={`mt-1 text-[11px] font-medium ${bon ? "text-emerald-600" : "text-rose-500"}`}>
      {pct > 0 ? "+" : ""}{pct} % vs {Number(annee) - 1} ({euros(precedent)})
    </div>
  );
}
