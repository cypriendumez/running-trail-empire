"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  CLE_PREMIER_IMPORT, EVENEMENT_MONTRE_RELIEE, EVENEMENT_SYNCHRO, decisionPremierImport, lireMarque,
  marqueApres, marqueAuLancement, tranchesPremierImport, type Marque,
} from "@/lib/intervals/premierImport";

const STORAGE_KEY = "rte_last_auto_sync";
const THROTTLE_MS = 60 * 1000;   // 60 s mini entre deux syncs (anti-martèlement de l'API)
const POLL_MS = 120 * 1000;      // re-check toutes les 2 min tant que l'onglet est ouvert
const AUTO_SYNC_DAYS = 3;        // on tire les 3 derniers jours (inclut aujourd'hui)
/** Le serveur n'a pas su dire si l'historique est à importer : on repose la question, pas sans fin. */
const QUESTIONS_PREMIER_IMPORT = 3;

const L: Record<string, { enCours: string; fini: string; fini1: string; vide: string }> = {
  fr: { enCours: "Import des séances de la montre", fini: "{n} séances importées depuis la montre", fini1: "1 séance importée depuis la montre", vide: "Aucune séance sur intervals.icu pour l'instant. Elles arriveront ici d'elles-mêmes." },
  en: { enCours: "Importing sessions from the watch", fini: "{n} sessions imported from the watch", fini1: "1 session imported from the watch", vide: "No sessions on intervals.icu yet. They will show up here on their own." },
  de: { enCours: "Einheiten der Uhr werden importiert", fini: "{n} Einheiten von der Uhr importiert", fini1: "1 Einheit von der Uhr importiert", vide: "Noch keine Einheiten auf intervals.icu. Sie erscheinen hier von selbst." },
  es: { enCours: "Importando las sesiones del reloj", fini: "{n} sesiones importadas del reloj", fini1: "1 sesión importada del reloj", vide: "Aún no hay sesiones en intervals.icu. Aparecerán aquí por sí solas." },
  pt: { enCours: "A importar as sessões do relógio", fini: "{n} sessões importadas do relógio", fini1: "1 sessão importada do relógio", vide: "Ainda não há sessões no intervals.icu. Vão aparecer aqui sozinhas." },
};

type Bandeau = { phase: "import"; fait: number; total: number } | { phase: "fini"; n: number } | { phase: "vide" } | null;

/**
 * Composant (monté dans le layout dashboard) qui garde les activités fraîches SANS action
 * de l'utilisateur. Il synchronise Intervals.icu :
 *  - au chargement,
 *  - dès que l'onglet (re)devient visible (ex. retour sur l'app après une sortie),
 *  - puis toutes les 2 min tant que le dashboard est ouvert.
 * Dès qu'une sync ramène du neuf, router.refresh() met à jour l'écran tout seul.
 * Throttle 60 s pour ne pas marteler l'API.
 *
 * NB : intervals.icu ne permet PAS d'enregistrer un webhook avec une clé API (404 sur
 * /athlete/{id}/webhooks). Seuls les athlètes reliés par OAuth reçoivent les alertes de
 * l'application (/api/webhooks/intervals), et aucune pour une séance venue de Strava :
 * ce sondage reste donc le filet de tous les autres — et la route de sync republie le
 * plan dès qu'une séance inédite arrive.
 *
 * ── LE PREMIER IMPORT (09/11/2026) ──
 * Trois jours, c'est un rafraîchissement. Un athlète qui vient de relier sa montre arrivait
 * sur une liste VIDE et devait trouver le bouton « Synchroniser » (le frère de Cyprien, le
 * 09/11). Quand le serveur dit qu'aucune séance de montre n'est en base — ou que le
 * navigateur sait qu'une montre vient d'être reliée — on importe l'année, par tranches, la
 * plus récente d'abord, en le DISANT à l'écran. Les décisions sont dans
 * `lib/intervals/premierImport` ; ici, on les exécute.
 */
export function AutoSync() {
  const router = useRouter();
  const { lang } = useT();
  const d = L[lang] ?? L.fr;
  const configured = useRef<boolean | null>(null);
  const premier = useRef<boolean | null>(null);
  const questions = useRef(0);
  const [bandeau, setBandeau] = useState<Bandeau>(null);

  useEffect(() => {
    let stopped = false;
    // Propre à CE montage : en mode strict (dev), React monte, démonte, remonte. Un verrou
    // partagé entre les deux montages faisait perdre la synchronisation du chargement.
    const busy = { current: false };
    const minuteries: ReturnType<typeof setTimeout>[] = [];
    const plusTard = (f: () => void, ms: number) => { minuteries.push(setTimeout(() => { if (!stopped) f(); }, ms)); };

    // Un stockage refusé (navigation privée stricte) ne doit rien casser : sans marque, le
    // signal du serveur décide seul.
    const lire = (): Marque | null => { try { return lireMarque(localStorage.getItem(CLE_PREMIER_IMPORT)); } catch { return null; } };
    const ecrire = (m: Marque | null) => {
      try {
        if (m) localStorage.setItem(CLE_PREMIER_IMPORT, JSON.stringify(m));
        else localStorage.removeItem(CLE_PREMIER_IMPORT);
      } catch { /* stockage refusé */ }
    };

    /** Des séances inédites sont en base : les pages rendues par le serveur se relisent, et
     *  les listes chargées par le navigateur (page Sync Montre) aussi. */
    const seancesInedites = () => {
      router.refresh();
      window.dispatchEvent(new Event(EVENEMENT_SYNCHRO));
    };

    /**
     * Le plan a été construit à la fin du questionnaire, AVANT la montre, et la
     * replanification qui suit une séance importée est retenue 10 minutes : sans cet appel,
     * le premier plan ignorait tout l'historique jusqu'à la nuit. La route se protège seule
     * (60 s entre deux générations) : un « trop récent » se retente une fois.
     */
    const replanifier = async (dernierEssai: boolean) => {
      try {
        const r = await fetch("/api/coach/generate", { method: "POST" });
        const j = r.ok ? await r.json() : null;
        if (j?.skipped === "trop_recent" && !dernierEssai) { plusTard(() => { void replanifier(true); }, 61_000); return; }
        if (j?.ok && !stopped) router.refresh();
      } catch { /* le passage de la nuit recalculera le plan */ }
    };

    const premierImport = async (annoncer: boolean) => {
      const tranches = tranchesPremierImport(Date.now());
      // Écrite AVANT le premier appel : si l'onglet se ferme, l'import reprendra.
      const marque = marqueAuLancement(lire(), Date.now());
      ecrire(marque);
      if (annoncer) setBandeau({ phase: "import", fait: 0, total: tranches.length });

      let faites = 0, ecrites = 0, inedites = 0;
      for (const t of tranches) {
        if (stopped) break;
        let data: { configured?: boolean; freshWorkouts?: number; synced?: { workouts?: number } } | null = null;
        try {
          const r = await fetch(`/api/intervals/sync?oldest=${t.oldest}&newest=${t.newest}`);
          data = r.ok ? await r.json() : null;
        } catch { /* coupure : la tranche n'a pas répondu */ }
        // La montre a été déliée entre-temps : il n'y a plus rien à importer.
        if (data?.configured === false) {
          ecrire(null);
          configured.current = null;
          if (!stopped) setBandeau(null);
          return;
        }
        // Une tranche sans réponse : on s'arrête là, et l'import reprendra (`enCours`).
        if (!data?.synced) break;
        faites++;
        ecrites += data.synced.workouts ?? 0;
        const n = data.freshWorkouts ?? 0;
        inedites += n;
        if (stopped) break;
        if (annoncer) setBandeau({ phase: "import", fait: faites, total: tranches.length });
        // L'écran se remplit tranche après tranche, sans attendre la fin de l'année.
        if (n > 0) seancesInedites();
      }

      const complet = faites === tranches.length;
      ecrire(marqueApres(marque, { complet, ecrites }));
      if (faites > 0) { try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* stockage refusé */ } }
      if (complet && ecrites > 0) premier.current = false;
      if (stopped) return;

      if (inedites > 0) {
        setBandeau({ phase: "fini", n: inedites });
        plusTard(() => setBandeau(null), 8_000);
        void replanifier(false);
      } else if (annoncer && complet && ecrites === 0) {
        // Tout a répondu, et intervals.icu n'avait rien : on le dit, on ne laisse pas un
        // « import en cours » s'éteindre sans un mot.
        setBandeau({ phase: "vide" });
        plusTard(() => setBandeau(null), 10_000);
      } else {
        setBandeau(null);
      }
    };

    const trigger = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        // Vérifie une seule fois si Intervals.icu est configuré, puis met en cache.
        // ⚠️ SEULE UNE RÉPONSE RÉUSSIE SE MET EN CACHE. Une coupure ou un 503 était gardé comme
        // « pas de montre » pour toute la visite : plus aucune synchronisation, sans un mot.
        // Sans réponse, on ne sait pas : on reposera la question au tick suivant.
        const premierInconnu = configured.current === true && premier.current === null && questions.current < QUESTIONS_PREMIER_IMPORT;
        if (configured.current === null || premierInconnu) {
          try {
            const r = await fetch("/api/intervals/status");
            const s = r.ok ? await r.json() : null;
            if (r.ok) configured.current = !!s.configured;
            // `null` (le serveur n'a pas pu compter les séances) n'est pas « rien à importer ».
            if (r.ok) { premier.current = typeof s.premierImport === "boolean" ? s.premierImport : null; questions.current++; }
          } catch { /* sans réponse : on ne sait pas, on reposera la question */ }
        }
        if (!configured.current || stopped) return;

        const decision = decisionPremierImport(premier.current, lire(), Date.now());
        if (decision.lancer) { await premierImport(decision.annoncer); return; }

        const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
        if (Date.now() - last < THROTTLE_MS) return;

        const data = await fetch(`/api/intervals/sync?days=${AUTO_SYNC_DAYS}`).then(r => r.ok ? r.json() : null);
        if (data?.synced) {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          const total = (data.synced.workouts ?? 0) + (data.synced.hrv ?? 0) + (data.synced.sleep ?? 0);
          if (stopped) return;
          // Une séance INÉDITE relit aussi les listes du navigateur ; un simple rafraîchissement
          // des trois derniers jours, non (la liste clignoterait toutes les 2 minutes).
          if ((data.freshWorkouts ?? 0) > 0) seancesInedites();
          else if (total > 0) router.refresh(); // du neuf est arrivé → on met à jour l'écran
        }
      } catch { /* échec silencieux, on retentera au prochain tick */ }
      finally { busy.current = false; }
    };

    trigger();
    const onVisible = () => { if (document.visibilityState === "visible") trigger(); };
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => { if (document.visibilityState === "visible") trigger(); }, POLL_MS);
    // Une montre reliée sans rechargement de page (clé API collée dans Sync Montre) : la
    // réponse « pas de montre » retenue au chargement ne vaut plus.
    const onReliee = () => { configured.current = null; premier.current = null; questions.current = 0; trigger(); };
    window.addEventListener(EVENEMENT_MONTRE_RELIEE, onReliee);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(EVENEMENT_MONTRE_RELIEE, onReliee);
      clearInterval(id);
      minuteries.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bandeau) return null;
  // Au-dessus de la pastille « Nouvelle version » (MiseAJour), qui occupe le cran du dessous.
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-[64] flex justify-center px-3 md:bottom-20">
      <div className="flex max-w-md items-center gap-2.5 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl">
        {bandeau.phase === "import" && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />}
        {bandeau.phase === "fini" && <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />}
        <span>
          {bandeau.phase === "import" && <>{d.enCours}… <span className="tabular-nums text-zinc-300">{bandeau.fait}/{bandeau.total}</span></>}
          {bandeau.phase === "fini" && (bandeau.n === 1 ? d.fini1 : d.fini.replace("{n}", String(bandeau.n)))}
          {bandeau.phase === "vide" && d.vide}
        </span>
      </div>
    </div>
  );
}
