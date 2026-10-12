"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { QrSvg } from "@/components/ui/QrSvg";
import { CHAMP, FOCUS } from "./habillage";
import { APP_STORE_COMPANION, MARQUES, marqueDe, type MarqueId } from "./marquesMontre";
import { cleMessageErreur, etatCle, verdictSuivi } from "@/lib/intervals/connexionMontre";

type Tr = (k: string, v?: Record<string, string | number>) => string;

/**
 * L'ÉTAPE MONTRE DU QUESTIONNAIRE — PAR MARQUE (12/10/2026).
 *
 * Avant : quatre étapes identiques pour tout le monde, rédigées pour une Garmin, avec
 * l'Apple Watch dans un encadré au milieu — alors que son porteur n'a RIEN à faire dans la
 * page Connexions d'intervals.icu (il n'y a pas de carte Apple) et doit installer une autre
 * application. Désormais :
 *
 *  1. on choisit sa montre ;
 *  2. on ne lit que ses gestes, en TROIS étapes au lieu de quatre — l'Athlete ID a disparu :
 *     la clé seule désigne le compte (`lib/intervals/compteDeLaCle`) ;
 *  3. sur ordinateur, l'Apple Watch a un QR code : on installe l'app sur l'iPhone d'un scan.
 *
 * Le choix « Je n'ai pas de montre » n'ouvre aucune étape : le plan fonctionne sans.
 *
 * ── LA CONNEXION EN UN CLIC (OAuth, application intervals.icu approuvée le 12/10/2026) ──
 * Quand l'application est configurée (`/api/intervals/status` → `oauth: true`), l'étape 3
 * n'est plus « colle ta clé » mais « autorise Pacevo ». ⚠️ Le questionnaire garde TOUTES les
 * réponses en mémoire jusqu'à « Terminer » : partir vers intervals.icu les effacerait. Le
 * bouton appelle donc `onOAuth`, qui enregistre d'abord tout (comme « Terminer »), puis
 * seulement quitte la page. La clé reste proposée, repliée, pour qui la préfère.
 */
export function EtapeMontre({ tr, cid, marque, onMarque, enregistre, onEnregistre, onOAuth, oauthEnCours }: {
  tr: Tr;
  cid: string;
  marque: MarqueId | null;
  onMarque: (m: MarqueId) => void;
  /** La clé est enregistrée (la barre d'actions propose alors « Terminer »). */
  enregistre: boolean;
  onEnregistre: () => void;
  /** Enregistre le questionnaire, puis part vers l'écran d'autorisation d'intervals.icu. */
  onOAuth: () => void;
  /** L'enregistrement qui précède le départ est en cours. */
  oauthEnCours: boolean;
}) {
  const [sous, setSous] = useState(0);
  const [cle, setCle] = useState("");
  const [voirCle, setVoirCle] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [compte, setCompte] = useState<string | null>(null);
  // Revenu sur l'étape après avoir enregistré : la connexion est faite, on ne relance rien.
  const [suivi, setSuivi] = useState<"checking" | "ok" | "vide" | "timeout">(enregistre ? "timeout" : "checking");
  const [suiviActif, setSuiviActif] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);
  const liste = useRef<HTMLOListElement>(null);

  // Le bouton « Autoriser Pacevo » n'existe que si l'application OAuth est configurée sur le
  // serveur : sinon il mènerait à une erreur. En attendant la réponse, on montre la clé.
  const [oauth, setOauth] = useState(false);
  useEffect(() => {
    let actif = true;
    fetch("/api/intervals/status")
      .then((r) => r.json())
      .then((s) => { if (actif) setOauth(s?.oauth === true); })
      .catch(() => {});
    return () => { actif = false; };
  }, []);

  // Après l'enregistrement : on guette les premières activités (12 × 5 s).
  useEffect(() => {
    if (!suiviActif) return;
    let essais = 0;
    minuterie.current = setInterval(async () => {
      essais++;
      try {
        const statut = await (await fetch("/api/intervals/status")).json();
        if (statut?.configured === true) {
          const synchro = await (await fetch("/api/intervals/sync?days=7")).json();
          // Une synchronisation réussie mais VIDE n'est pas « activités détectées » :
          // voir `verdictSuivi`. Dans les deux cas on arrête de relancer la synchro.
          const v = verdictSuivi(statut, synchro);
          if (v !== "attente") {
            setSuivi(v);
            clearInterval(minuterie.current!);
            setSuiviActif(false);
            return;
          }
        }
      } catch {}
      if (essais >= 12) {
        setSuivi("timeout");
        clearInterval(minuterie.current!);
        setSuiviActif(false);
      }
    }, 5000);
    return () => clearInterval(minuterie.current!);
  }, [suiviActif]);

  const m = marqueDe(marque);

  // Premier choix de marque : les étapes apparaissent SOUS la grille, souvent hors de
  // l'écran d'un téléphone — on les amène sous les yeux.
  const premierChoix = useRef(true);
  useEffect(() => {
    if (!m || m.chemin === "aucun" || !premierChoix.current) return;
    premierChoix.current = false;
    // Seulement si elles sont HORS de l'écran : sur un ordinateur, elles sont déjà visibles,
    // et faire défiler la page sous la souris désoriente plus qu'il n'aide.
    const haut = liste.current?.getBoundingClientRect().top ?? 0;
    if (haut < window.innerHeight * 0.6) return;
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    liste.current?.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "start" });
  }, [m]);

  // ── La clé : un seul code à coller ──
  const cleNette = cle.trim();
  const etat = etatCle(cle);
  const cleValide = etat.valide;
  const indice = etat.indice === "mdp" ? tr("hKeyPwd") : etat.indice === "format" ? tr("hKeyFormat") : null;

  async function connecter(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/intervals/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: cleNette }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const k = cleMessageErreur(data?.code);
        throw new Error(k ? tr(k) : typeof data?.error === "string" ? data.error : tr("tSaveError"));
      }
      setCompte(typeof data.nom === "string" ? data.nom : null);
      setSuivi("checking");
      setSuiviActif(true);
      onEnregistre();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : tr("tSaveError"));
    } finally {
      setEnvoi(false);
    }
  }

  const lien = "inline-flex items-center gap-1.5";
  const titres = m && m.chemin !== "aucun" ? [
    tr("wStep1"),
    m.chemin === "companion" ? tr("mEtape2Apple") : m.nom ? tr("mEtape2Lien", { m: m.nom }) : tr("wStep2"),
    oauth ? tr("mEtape3OAuth") : tr("mEtape3"),
  ] : [];

  // ── Le formulaire de la clé API : seul, ou replié sous le bouton « Autoriser Pacevo ». ──
  const formulaireCle = (classe: string) => (
    <form onSubmit={connecter} className={classe}>
      <p className="max-w-prose text-sm leading-relaxed text-zinc-600">{tr("mCleOu")}</p>
      <a href="https://intervals.icu/settings#developer" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline">
        {tr("mCleOuvrir")} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
      <div>
        <label htmlFor={`${cid}-cle`} className="block text-sm font-medium text-zinc-700">{tr("w3KeyLabel")}</label>
        <div className="relative mt-1.5">
          <input id={`${cid}-cle`} type={voirCle ? "text" : "password"} value={cle} onChange={(e) => setCle(e.target.value)}
            placeholder="a1b2c3d4e5f6…" autoComplete="off" spellCheck={false} autoCapitalize="none"
            aria-invalid={indice ? true : undefined} aria-describedby={`${cid}-cle-a${indice ? ` ${cid}-cle-e` : ""}`}
            className={`${CHAMP} font-mono ${indice ? "border-red-300" : cleValide ? "border-emerald-500" : ""}`} />
          <button type="button" onClick={() => setVoirCle((v) => !v)} aria-label={tr("w3KeyLabel")} aria-pressed={voirCle}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-800">
            {voirCle ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {indice && <p id={`${cid}-cle-e`} className="mt-1.5 text-sm text-red-600">{indice}</p>}
        <p id={`${cid}-cle-a`} className="mt-1.5 max-w-prose text-sm leading-relaxed text-zinc-500">{tr("w2Warn1")} {tr("w2Warn2")}</p>
      </div>
      {erreur && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{erreur}
        </p>
      )}
      <button type="submit" disabled={envoi || !cleValide} className="btn-brand disabled:opacity-50">
        {envoi && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {envoi ? tr("w3Verifying") : tr("w3Connect")}
      </button>
    </form>
  );

  return (
    <div className="mt-8 space-y-4">
      {/* ── Quelle montre ? ── */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-6 sm:px-7">
        <h2 id={`${cid}-marque-t`} className="text-[15px] font-semibold text-zinc-900">{tr("mQ")}</h2>
        <p id={`${cid}-marque-a`} className="mt-1 text-sm leading-relaxed text-zinc-500">{tr("mQAide")}</p>
        <div role="radiogroup" aria-labelledby={`${cid}-marque-t`} aria-describedby={`${cid}-marque-a`}
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MARQUES.map((x) => {
            const oid = `${cid}-marque-${x.id}`;
            const coche = marque === x.id;
            const libelle = x.nom ?? tr(x.id === "autre" ? "mAutre" : "mAucune");
            return (
              <label key={x.id} htmlFor={oid} className={`relative cursor-pointer ${x.id === "aucune" ? "col-span-2 sm:col-span-3" : ""}`}>
                <input id={oid} type="radio" name={`${cid}-marque`} value={x.id} checked={coche}
                  onChange={() => onMarque(x.id)} className="peer sr-only" />
                <span className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-center transition-colors hover:border-zinc-300 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:ring-1 peer-checked:ring-emerald-600 ${x.id === "aucune" ? "min-h-11 py-2" : "h-[4.5rem]"} ${FOCUS}`}>
                  {x.logo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={x.logo} alt={libelle} className="h-5 w-auto max-w-[104px] object-contain" />
                    : <span className={`text-sm ${x.id === "aucune" ? "font-medium text-zinc-600" : "font-semibold text-zinc-800"}`}>{libelle}</span>}
                  {x.id === "autre" && <span className="text-xs text-zinc-500">{tr("mAutreEx")}</span>}
                </span>
                {coche && <Check aria-hidden="true" className="absolute right-2 top-2 h-4 w-4 text-emerald-700" />}
              </label>
            );
          })}
        </div>
      </section>

      {m?.chemin === "aucun" && (
        <p className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 text-sm leading-relaxed text-zinc-600 sm:px-7">
          {tr("mAucuneTxt")}
        </p>
      )}

      {/* ── Les gestes de SA marque : une liste numérotée, parce que c'en est une. ── */}
      {m && m.chemin !== "aucun" && (
        <ol ref={liste} className="scroll-mt-32 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {titres.map((titre, i) => {
            const fait = i < sous || (i === 2 && enregistre);
            const ouvert = i === sous;
            return (
              <li key={i} className="px-5 py-5 sm:px-7">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                    fait ? "bg-emerald-600 text-white" : ouvert ? "border-2 border-emerald-600 text-emerald-700" : "border border-zinc-300 text-zinc-500"
                  }`}>
                    {fait ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <h3 className={`flex-1 text-[15px] font-semibold ${ouvert || fait ? "text-zinc-900" : "text-zinc-500"}`}>
                    {titre}{fait && <span className="sr-only"> — {tr("wDone")}</span>}
                  </h3>
                  {fait && !ouvert && !enregistre && (
                    <button type="button" onClick={() => setSous(i)} className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">
                      {tr("wRedo")}
                    </button>
                  )}
                </div>

                {/* 1 — Le compte intervals.icu, commun à toutes les marques. */}
                {ouvert && i === 0 && (
                  <div className="mt-4 space-y-4 sm:pl-10">
                    <p className="max-w-prose text-sm leading-relaxed text-zinc-600">{tr("m0Desc")}</p>
                    <div className="flex flex-wrap gap-2">
                      <a href="https://intervals.icu/signup" target="_blank" rel="noopener noreferrer" className={`btn-brand ${lien}`}>
                        {tr("w0Create")} <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                      <button type="button" onClick={() => setSous(1)} className="btn-secondary">{tr("w0Have")}</button>
                    </div>
                    <p className="max-w-prose text-sm leading-relaxed text-zinc-500">{tr("w0Tip")}</p>
                  </div>
                )}

                {/* 2a — Garmin, COROS, Suunto, Polar, autres : la page Connexions d'intervals.icu. */}
                {ouvert && i === 1 && m.chemin === "connexion" && (
                  <div className="mt-4 space-y-4 sm:pl-10">
                    <ol className="max-w-prose list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400">
                      <li>{m.nom ? tr("mLienOuvre", { m: m.nom }) : tr("mLienOuvreAutre")}</li>
                      <li>{m.nom ? tr("mCompteMarque", { m: m.nom }) : tr("mCompteAutre")}</li>
                      <li>
                        {m.nom ? tr("mCoche", { m: m.nom }) : tr("mCocheAutre")}
                        <ul className="mt-1.5 space-y-1.5">
                          {/* La case « envoyer les entraînements planifiés » porte le PLAN jusqu'au
                              poignet ; Polar n'en a pas (son API refuse les séances). */}
                          {[tr("w1Perm1"), tr("w1Perm2"), ...(m.recoit ? [tr("w1Perm4")] : []), tr("w1Perm3")].map((p) => (
                            <li key={p} className="flex items-start gap-2 text-zinc-700">
                              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{p}
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ol>
                    {!m.recoit && (
                      <p className="max-w-prose rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">{tr("mPolar")}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a href="https://intervals.icu/settings/connections" target="_blank" rel="noopener noreferrer" className={`btn-brand ${lien}`}>
                        {tr("w1Open")} <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                      <button type="button" onClick={() => setSous(2)} className="btn-secondary">{tr("w1Done")}</button>
                    </div>
                  </div>
                )}

                {/* 2b — Apple Watch : AUCUNE carte chez intervals.icu. L'app iPhone tierce
                    « Intervals.icu Companion » (McEwen Labs) fait le pont dans les deux sens.
                    Réglages relevés sur le fil de son auteur (forum intervals.icu, sujet 124208) :
                    onglet Apple Health, réglages Workouts, onglet Experimental. */}
                {ouvert && i === 1 && m.chemin === "companion" && (
                  <div className="mt-4 space-y-4 sm:pl-10">
                    <p className="max-w-prose text-sm leading-relaxed text-zinc-600">{tr("mAppleIntro")}</p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                      <a href={APP_STORE_COMPANION} target="_blank" rel="noopener noreferrer" className={`btn-brand ${lien}`}>
                        {tr("mAppleStore")} <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                      {/* Sur un téléphone, le bouton suffit ; sur ordinateur, on scanne. */}
                      <div className="hidden items-center gap-3 sm:flex">
                        <QrSvg texte={APP_STORE_COMPANION} label={tr("mAppleQrLabel")}
                          className="h-28 w-28 shrink-0 rounded-lg border border-zinc-200 bg-white p-2" />
                        <p className="max-w-[13rem] text-sm leading-relaxed text-zinc-500">{tr("mAppleQr")}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{tr("mAppleDans")}</p>
                      <ol className="mt-2 max-w-prose list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400">
                        <li>{tr("mApple1")}</li>
                        <li>{tr("mApple2")}</li>
                        <li>{tr("mApple3")}</li>
                      </ol>
                      <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-500">{tr("mApple4")}</p>
                    </div>
                    {/* ⚠️ L'ENVOI NE SE FAIT PAS TOUT SEUL (Cyprien, 12/10/2026 : « est-ce que tu lui
                        expliques bien ça ? »). Apple ne laisse lire Santé que sur un iPhone
                        déverrouillé (auteur de l'app, forum 124208, 06/07/2026) : la séance part quand
                        l'app tourne. Le dire une fois, en gris, à la fin, ne suffisait pas ; une
                        automatisation Raccourcis (déclencheur « Exercice Apple Watch » › « Fin ») ouvre
                        l'app à la fin de chaque séance. */}
                    <div className="max-w-prose rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                      <p className="text-sm font-semibold text-emerald-950">{tr("mAppleEnvoiTitre")}</p>
                      <p className="mt-1 text-sm leading-relaxed text-emerald-950/80">{tr("mAppleEnvoiTxt")}</p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-emerald-950/90 marker:text-emerald-700">
                        <li>{tr("mAuto1")}</li>
                        <li>{tr("mAuto2")}</li>
                        <li>{tr("mAuto3")}</li>
                        <li>{tr("mAuto4")}</li>
                      </ol>
                    </div>
                    <button type="button" onClick={() => setSous(2)} className="btn-secondary">{tr("w1Done")}</button>
                  </div>
                )}

                {/* 3 — En un clic (OAuth) quand l'application est configurée ; sinon, UN seul
                    code : la clé, dont le compte se lit. La clé reste proposée, repliée. */}
                {ouvert && i === 2 && !enregistre && oauth && (
                  <div className="mt-4 space-y-4 sm:pl-10">
                    <p className="max-w-prose text-sm leading-relaxed text-zinc-600">{tr("mOAuthIntro")}</p>
                    <button type="button" onClick={onOAuth} disabled={oauthEnCours} className="btn-brand disabled:opacity-60">
                      {oauthEnCours && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                      {oauthEnCours ? tr("mOAuthEnCours") : tr("mOAuthBouton")}
                    </button>
                    <p className="max-w-prose text-sm leading-relaxed text-zinc-500">{tr("mOAuthNote")}</p>
                    <details className="max-w-prose">
                      <summary className="cursor-pointer text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline">{tr("mOAuthCle")}</summary>
                      {formulaireCle("mt-4 space-y-4")}
                    </details>
                  </div>
                )}
                {ouvert && i === 2 && !enregistre && !oauth && formulaireCle("mt-4 space-y-4 sm:pl-10")}

                {ouvert && i === 2 && enregistre && (
                  <div className="mt-4 space-y-2 sm:pl-10" aria-live="polite">
                    {compte && (
                      <p className="flex items-start gap-2 text-sm font-medium text-zinc-900">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{tr("mCompte", { nom: compte })}
                      </p>
                    )}
                    {suivi === "checking" && (
                      <p className="flex items-start gap-2 text-sm text-zinc-700">
                        <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                        <span><span className="font-medium text-zinc-900">{tr("w3CheckTitle")}</span> {tr("w3CheckSub")}</span>
                      </p>
                    )}
                    {suivi === "ok" && (
                      <p className="flex items-start gap-2 text-sm text-zinc-700">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span><span className="font-medium text-zinc-900">{tr("w3OkTitle")}</span> {tr("w3OkSub")}</span>
                      </p>
                    )}
                    {suivi === "vide" && (
                      <p className="flex items-start gap-2 text-sm text-zinc-700">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span><span className="font-medium text-zinc-900">{tr("mVideTitre")}</span> {tr("mVideSub")}</span>
                      </p>
                    )}
                    {suivi === "timeout" && (
                      <p className="flex items-start gap-2 text-sm text-zinc-700">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span><span className="font-medium text-zinc-900">{tr("w3ToTitle")}</span> {tr("w3ToSub")}</span>
                      </p>
                    )}
                    {m.chemin === "companion" && (
                      <p className="max-w-prose rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-relaxed text-emerald-950">{tr("mAppleApres")}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
