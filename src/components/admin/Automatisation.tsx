import { superviser } from "@/lib/cron/github";
import { pire, type Etat } from "@/lib/cron/supervision";

const TON: Record<Etat, string> = {
  "à l'heure": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "en retard": "bg-amber-50 text-amber-800 ring-amber-200",
  "en échec": "bg-red-50 text-red-700 ring-red-200",
  "jamais lancée": "bg-red-100 text-red-800 ring-red-300",
};

const depuis = (h: number | null) =>
  h === null ? "—" : h < 1 ? "à l'instant" : h < 48 ? `il y a ${Math.round(h)} h` : `il y a ${Math.round(h / 24)} j`;

/**
 * L'ÉTAT RÉEL DE L'AUTOMATISATION — la question qu'aucun écran ne savait répondre.
 *
 * ⚠️ Il a fallu interroger l'API de GitHub à la main, le 03/09/2026, pour découvrir que
 * la synchronisation du coach ne tournait que 6 fois par jour sur 48 déclarées, que la
 * newsletter avait échoué le 31/08 sans que personne le sache, et que deux tâches
 * n'avaient jamais tourné du tout. Rien, dans le produit, ne le disait.
 */
export async function Automatisation() {
  const { constats, inconnues } = await superviser();
  const global = pire(constats);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-zinc-900">Automatisation</h2>
          <p className="text-xs text-zinc-500">
            Ce que GitHub a réellement lancé — pas ce que les fichiers déclarent.
          </p>
        </div>
        {constats.length > 0 && (
          <span className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${TON[global]}`}>{global}</span>
        )}
      </div>

      {constats.length === 0 ? (
        // ⚠️ « ON N'A PAS PU SAVOIR » N'EST PAS « TOUT VA BIEN ». Afficher un écran vert
        // quand GitHub est injoignable serait le pire des mensonges : celui qui rassure.
        <p className="text-sm text-amber-800">
          État indisponible : GitHub n&apos;a pas répondu. Rien ne permet de dire si les tâches tournent.
        </p>
      ) : (
        <div className="space-y-1.5">
          {constats.map((c) => (
            <div key={c.tache.fichier} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-zinc-900">{c.tache.fichier}</div>
                <div className="truncate text-[11px] text-zinc-500">{c.tache.role}</div>
              </div>
              <div className="text-right text-[11px] text-zinc-500">
                <div>{c.tache.cadence} déclaré</div>
                {/* On montre l'écart SANS le transformer en alarme : GitHub étrangle les
                    planifications, et un écran qui crie tous les jours cesse d'être lu. */}
                <div className="tabular-nums">{c.observees} lancée(s) sur {c.attendues} attendues</div>
              </div>
              <div className="w-24 text-right text-[11px] text-zinc-500">{depuis(c.ilYaHeures)}</div>
              <span className={`w-24 rounded-lg px-2 py-0.5 text-center text-[10px] font-semibold ring-1 ${TON[c.etat]}`}>
                {c.etat}
              </span>
            </div>
          ))}
        </div>
      )}

      {inconnues.length > 0 && constats.length > 0 && (
        <p className="mt-3 text-xs text-amber-800">
          Sans réponse de GitHub pour : {inconnues.join(", ")}. Leur état est inconnu, pas bon.
        </p>
      )}
    </section>
  );
}
