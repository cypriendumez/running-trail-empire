"use client";
import { useState } from "react";

/**
 * L'ANALYSE DE LA SÉANCE, écrite par le coach.
 *
 * ⚠️ CE COMPOSANT NE DÉCIDE DE RIEN. Le droit d'appeler le modèle est vérifié par la
 * route (`exigeAcces`), pas ici : masquer un bouton ne protège pas une route, qui reste
 * appelable à la main. On se contente donc de DEMANDER, et d'afficher honnêtement ce que
 * le serveur répond — y compris son refus (402), qui est la seule source de vérité sur
 * l'abonnement.
 *
 * L'analyse n'est pas lancée toute seule : une séance passée ne bouge plus, mais un appel
 * au modèle se paie. C'est l'athlète qui décide, et la réponse est ensuite mémorisée
 * définitivement côté serveur — la deuxième ouverture ne coûte rien.
 */
export function AnalyseCoach({ workoutId, textes }: {
  workoutId: string;
  textes: { titre: string; demander: string; encours: string; verrou: string; offre: string; echec: string; memorise: string; tronquee: string };
}) {
  const [etat, setEtat] = useState<"repos" | "encours" | "faite" | "verrou" | "echec">("repos");
  const [texte, setTexte] = useState("");
  const [memorise, setMemorise] = useState(false);
  const [tronquee, setTronquee] = useState(false);
  const [erreur, setErreur] = useState("");

  async function demander() {
    setEtat("encours"); setErreur("");
    try {
      const r = await fetch("/api/ai/analyse-seance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId }),
      });
      // 402 = « Payment Required » : ce n'est pas une panne, c'est une formule trop
      // courte. Le dire tel quel évite de faire passer un verrou commercial pour un bug.
      if (r.status === 402) { setEtat("verrou"); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.texte) { setErreur(String(j?.error ?? "")); setEtat("echec"); return; }
      setTexte(String(j.texte)); setMemorise(j.memorise === true); setTronquee(j.tronquee === true);
      setEtat("faite");
    } catch { setEtat("echec"); }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{textes.titre}</h2>

      {etat === "repos" && (
        <button onClick={demander}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
          {textes.demander}
        </button>
      )}

      {etat === "encours" && <p className="text-sm text-zinc-500">{textes.encours}</p>}

      {etat === "faite" && (
        <div className="space-y-2">
          {texte.split("\n").filter((l) => l.trim()).map((l, i) => (
            <p key={i} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{l}</p>
          ))}
          {/* Une réponse coupée ressemble à une réponse : si le serveur l'a détectée, on
              le dit — détecter sans rien en dire ne change rien pour l'athlète. */}
          {tronquee && <p className="text-xs text-amber-600">{textes.tronquee}</p>}
          {memorise && <p className="text-xs text-zinc-400">{textes.memorise}</p>}
        </div>
      )}

      {etat === "verrou" && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{textes.verrou}</p>
          <a href="/tarifs" className="inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            {textes.offre}
          </a>
        </div>
      )}

      {etat === "echec" && (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{erreur || textes.echec}</p>
          <button onClick={demander} className="text-sm font-semibold text-emerald-700 underline">{textes.demander}</button>
        </div>
      )}
    </section>
  );
}
