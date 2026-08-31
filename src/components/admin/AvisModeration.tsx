"use client";
import { useMemo, useState } from "react";
import { Loader2, Star, Check, EyeOff, Reply, Trash2, Search, Inbox } from "lucide-react";
// ⚠️ `lib/avis/bornes`, PAS `lib/avis/store` : le store importe le filtre de
// grossièretés, et cet écran est un composant CLIENT — l'arbre d'imports emmènerait les
// 106 racines surveillées dans le JavaScript public. Défaut déjà mesuré sur le build le
// 23/08/2026, et re-provoqué ici en écrivant la réponse aux avis.
import { REPONSE_MAX } from "@/lib/avis/bornes";

type Ligne = {
  id: string; note: number; texte: string; auteur: string; at: string; publie: boolean;
  reponse?: string; reponseAt?: string;
};

/**
 * MODÉRER LES AVIS, ET Y RÉPONDRE.
 *
 * ⚠️ IL N'Y A TOUJOURS PAS DE CHAMP D'ÉDITION SUR L'AVIS, ET C'EST VOULU. La page
 * publique promet « publiés tels qu'ils sont écrits, sans les retoucher » ; un champ
 * modifiable ici rendrait la promesse invérifiable. La RÉPONSE, elle, est un champ
 * séparé, attribué à Pacevo et affiché SOUS l'avis — comme le font App Store, Google
 * Play et Google. Le texte de l'athlète reste intact et vérifiable.
 *
 * ⚠️ LE TRI RESTE CHRONOLOGIQUE, JAMAIS PAR NOTE. Un écran qui présenterait les cinq
 * étoiles en premier inviterait à ne publier que ceux-là — ce que la directive (UE)
 * 2019/2161 interdit explicitement. Le filtre par état (« à relire », « en ligne ») est
 * une aide au travail ; il n'existe aucun filtre par note, et c'est délibéré.
 */
export function AvisModeration({ initial }: { initial: Ligne[] }) {
  const [lignes, setLignes] = useState(initial);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "attente" | "publies" | "sansReponse">("tous");
  const [recherche, setRecherche] = useState("");
  /** L'avis dont la zone de réponse est ouverte, et son brouillon. */
  const [redige, setRedige] = useState<{ id: string; texte: string } | null>(null);

  const attente = lignes.filter((l) => !l.publie).length;
  const sansReponse = lignes.filter((l) => l.publie && !l.reponse).length;
  const moyenne = lignes.length
    ? Math.round((lignes.reduce((s, l) => s + l.note, 0) / lignes.length) * 10) / 10
    : null;

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes
      .filter((l) =>
        filtre === "tous" ? true
        : filtre === "attente" ? !l.publie
        : filtre === "publies" ? l.publie
        : l.publie && !l.reponse)
      .filter((l) => !q || l.texte.toLowerCase().includes(q) || l.auteur.toLowerCase().includes(q));
  }, [lignes, filtre, recherche]);

  async function envoyer(id: string, corps: Record<string, unknown>) {
    setEnCours(id); setErreur(null);
    try {
      const r = await fetch("/api/admin/avis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...corps }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setErreur(j?.error ?? "L'enregistrement a échoué."); return null; }
      return j as { publie?: boolean; reponse?: string | null; reponseAt?: string | null };
    } catch { setErreur("Connexion impossible. Réessaie."); return null; }
    finally { setEnCours(null); }
  }

  async function bascule(id: string, publie: boolean) {
    const j = await envoyer(id, { publie });
    if (j) setLignes((l) => l.map((x) => (x.id === id ? { ...x, publie } : x)));
  }

  async function repondre(id: string, texte: string) {
    const j = await envoyer(id, { reponse: texte });
    if (!j) return;
    setLignes((l) => l.map((x) => (x.id === id
      ? { ...x, reponse: j.reponse ?? undefined, reponseAt: j.reponseAt ?? undefined }
      : x)));
    setRedige(null);
  }

  const ONGLETS = [
    { cle: "tous" as const, label: "Tous", n: lignes.length },
    { cle: "attente" as const, label: "À relire", n: attente },
    { cle: "publies" as const, label: "En ligne", n: lignes.length - attente },
    { cle: "sansReponse" as const, label: "Sans réponse", n: sansReponse },
  ];

  return (
    <div className="space-y-5">
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Avis</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
            La relecture ne sert qu&apos;à écarter l&apos;insulte et le spam.{" "}
            <b className="font-semibold text-zinc-700">Ne jamais retenir un avis parce que la note est basse</b> —
            c&apos;est interdit, et ça se voit.
          </p>
        </div>
        {moyenne !== null && (
          <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-3 ring-1 ring-inset ring-zinc-200">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums text-zinc-900">{moyenne}</span>
                <span className="text-sm text-zinc-400">/5</span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">{lignes.length} avis</div>
            </div>
            <div className="h-9 w-px bg-zinc-200" />
            <div>
              <div className="text-2xl font-bold tabular-nums text-zinc-900">{attente}</div>
              <div className="mt-0.5 text-xs text-zinc-400">à relire</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Filtres et recherche ─────────────────────────────────────────── */}
      {lignes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {ONGLETS.map((o) => (
            <button key={o.cle} onClick={() => setFiltre(o.cle)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filtre === o.cle ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"}`}>
              {o.label}
              <span className={`tabular-nums ${filtre === o.cle ? "text-white/60" : "text-zinc-400"}`}>{o.n}</span>
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un mot, un prénom…"
              className="w-64 rounded-full border-0 bg-white py-2 pl-9 pr-4 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900" />
          </div>
        </div>
      )}

      {erreur && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200">{erreur}</p>}

      {/* ── Vide ─────────────────────────────────────────────────────────── */}
      {!lignes.length && (
        <div className="rounded-3xl bg-white p-12 text-center ring-1 ring-inset ring-zinc-200">
          <Inbox className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-4 font-semibold text-zinc-900">Aucun avis pour l&apos;instant.</p>
          {/* ⚠️ ON DIT D'OÙ ILS VIENDRONT. Sans cette phrase, un écran vide laisse croire
              à une panne — ou pire, fait chercher des avis d'App Store qui n'existent pas. */}
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
            Ils arriveront d&apos;ici : les athlètes qui ont un compte Pacevo peuvent en
            écrire un depuis la page <span className="font-medium text-zinc-700">/avis</span>. Rien n&apos;est
            publié tant que tu ne l&apos;as pas relu.
          </p>
        </div>
      )}

      {lignes.length > 0 && !visibles.length && (
        <p className="rounded-2xl bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
          Aucun avis ne correspond à ce filtre.
        </p>
      )}

      {/* ── La liste ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {visibles.map((l) => {
          const enRedaction = redige?.id === l.id;
          const occupe = enCours === l.id;
          return (
            <div key={l.id} className="rounded-2xl bg-white p-5 ring-1 ring-inset ring-zinc-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
                    {l.auteur.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">{l.auteur}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        l.publie ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {l.publie ? "En ligne" : "À relire"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="flex gap-0.5" aria-label={`${l.note}/5`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < l.note ? "fill-amber-400 text-amber-400" : "text-zinc-200"}`} />
                        ))}
                      </span>
                      <span className="text-xs text-zinc-400">{l.at.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!enRedaction && (
                    <button onClick={() => setRedige({ id: l.id, texte: l.reponse ?? "" })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50">
                      <Reply className="h-3.5 w-3.5" />{l.reponse ? "Modifier" : "Répondre"}
                    </button>
                  )}
                  <button onClick={() => bascule(l.id, !l.publie)} disabled={occupe}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                      l.publie ? "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                               : "bg-zinc-900 text-white hover:bg-zinc-700"}`}>
                    {occupe ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : l.publie ? <EyeOff className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {l.publie ? "Retirer" : "Publier"}
                  </button>
                </div>
              </div>

              <p className="mt-3.5 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{l.texte}</p>

              {/* La réponse déjà publiée, telle qu'elle apparaît au public. */}
              {l.reponse && !enRedaction && (
                <div className="mt-4 rounded-xl border-l-2 border-emerald-500 bg-zinc-50 py-3 pl-4 pr-3">
                  <div className="text-xs font-semibold text-emerald-700">
                    Réponse de Pacevo
                    {l.reponseAt ? <span className="ml-2 font-normal text-zinc-400">{l.reponseAt.slice(0, 10)}</span> : null}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-zinc-600">{l.reponse}</p>
                </div>
              )}

              {/* ── Rédaction ────────────────────────────────────────────────
                  ⌘+Entrée envoie, Échap ferme : répondre à dix avis à la souris
                  décourage, et une modération pénible finit par ne plus se faire. */}
              {enRedaction && (
                <div className="mt-4">
                  <textarea
                    autoFocus rows={3} value={redige.texte}
                    onChange={(e) => setRedige({ id: l.id, texte: e.target.value.slice(0, REPONSE_MAX) })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setRedige(null);
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void repondre(l.id, redige.texte);
                    }}
                    placeholder="Ta réponse, publiée sous l'avis et signée Pacevo…"
                    className="w-full resize-none rounded-xl border-0 bg-zinc-50 p-3.5 text-sm leading-relaxed text-zinc-800 ring-1 ring-inset ring-zinc-200 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => void repondre(l.id, redige.texte)} disabled={occupe}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">
                      {occupe && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {l.reponse ? "Mettre à jour" : "Publier la réponse"}
                    </button>
                    <button onClick={() => setRedige(null)}
                      className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800">Annuler</button>
                    {l.reponse && (
                      <button onClick={() => void repondre(l.id, "")} disabled={occupe}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
                        <Trash2 className="h-3.5 w-3.5" />Supprimer la réponse
                      </button>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-zinc-400">
                      {redige.texte.length}/{REPONSE_MAX} · ⌘↵ pour publier
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
