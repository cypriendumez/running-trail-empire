"use client";
import { analyser, type Segment } from "@/lib/ui/richText";

/**
 * Affiche la prose d'un modèle avec la structure qu'on lui a demandée.
 *
 * ⚠️ RIEN N'EST INJECTÉ EN HTML. `analyser` rend un arbre, et ce composant le transforme
 * en éléments React : une réponse de modèle contenant du balisage s'affiche comme du
 * texte, elle ne devient jamais du balisage exécuté dans la page.
 */
function Ligne({ contenu }: { contenu: Segment[] }) {
  return <>{contenu.map((s, i) => (s.gras
    ? <strong key={i} className="font-semibold text-zinc-900">{s.texte}</strong>
    : <span key={i}>{s.texte}</span>))}</>;
}

export function RichText({ texte, className = "" }: { texte: string; className?: string }) {
  const blocs = analyser(texte);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocs.map((b, i) => {
        if (b.type === "titre") {
          const taille = b.niveau === 1 ? "text-[15px]" : b.niveau === 2 ? "text-sm" : "text-[13px]";
          return (
            <h4 key={i} className={`${taille} font-bold text-zinc-900 ${i > 0 ? "pt-1.5" : ""}`}>
              <Ligne contenu={b.contenu} />
            </h4>
          );
        }
        if (b.type === "liste") {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  {/* Une puce ET un numéro sur la même ligne, c'est deux marqueurs pour
                      une seule idée : le numéro remplace la puce, il ne s'y ajoute pas. */}
                  {b.ordonnee
                    ? <span className="mt-px w-4 flex-shrink-0 text-right text-xs font-bold tabular-nums text-emerald-600">{j + 1}.</span>
                    : <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500/70" aria-hidden />}
                  <span className="min-w-0 flex-1"><Ligne contenu={it} /></span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-wrap"><Ligne contenu={b.contenu} /></p>;
      })}
    </div>
  );
}
