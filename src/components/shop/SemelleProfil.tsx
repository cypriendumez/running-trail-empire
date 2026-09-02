/**
 * PROFIL DE SEMELLE — le dessin remplace la photo, et en dit davantage.
 *
 * ⚠️ POURQUOI PAS DE PHOTO. Les visuels produit appartiennent aux marques et aux
 * marchands ; Pacevo n'en a pas les droits. Plutôt qu'une vignette grise, on dessine ce
 * que la photo ne montre justement PAS : l'épaisseur réelle de la semelle au talon et à
 * l'avant, à l'échelle, d'un modèle à l'autre. Deux chaussures côte à côte deviennent
 * comparables d'un coup d'œil — ce qu'aucune photo de catalogue ne permet.
 *
 * ⚠️ LE DESSIN NE S'INVENTE PAS. Sans hauteur de semelle relevée, il n'y a pas de dessin :
 * une silhouette « par défaut » laisserait croire à une cote qu'on n'a pas.
 */
export function SemelleProfil({ stackTalonMm, dropMm, hauteur = 54, className, absent }: {
  stackTalonMm?: number;
  dropMm?: number;
  hauteur?: number;
  className?: string;
  /** Texte affiché quand la hauteur de semelle n'a pas été relevée, dans la langue du lecteur. */
  absent: string;
}) {
  // ⚠️ PAS DE COTE, PAS DE DESSIN. Une silhouette « générique » à la place laisserait
  // croire à une épaisseur qu'on n'a pas relevée, et deux modèles inconnus paraîtraient
  // identiques. On dessine donc l'absence : une ligne de sol et le mot qui manque.
  if (stackTalonMm == null) {
    return (
      <svg viewBox={`0 0 190 ${hauteur + 6}`} className={className} role="img"
        aria-label={absent}>
        <line x1="0" y1={hauteur + 2} x2="190" y2={hauteur + 2} stroke="#e4e4e7" strokeWidth="1" />
        <line x1="6" y1={hauteur - 6} x2="184" y2={hauteur - 6} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="3 4" />
        <text x="95" y={hauteur - 12} fontSize="9" fill="#a1a1aa" textAnchor="middle">{absent}</text>
      </svg>
    );
  }
  const avant = Math.max(4, stackTalonMm - (dropMm ?? 0));
  // Échelle commune à toutes les fiches : 50 mm de semelle occupent la hauteur donnée.
  // Fixe, sinon deux modèles ne seraient plus comparables entre eux.
  const k = hauteur / 50;
  const L = 190;
  const yBas = hauteur + 2;
  const hT = stackTalonMm * k, hA = avant * k;

  return (
    <svg viewBox={`0 0 ${L} ${hauteur + 6}`} className={className} role="img"
      aria-label={`${stackTalonMm} mm / ${avant.toFixed(0)} mm`}>
      <defs>
        <linearGradient id="mousse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Le sol : la référence des deux hauteurs. */}
      <line x1="0" y1={yBas} x2={L} y2={yBas} stroke="#d4d4d8" strokeWidth="1" />
      {/* Semelle vue de profil : talon arrondi à gauche, ligne de mousse qui s'affine
          vers l'avant, pointe relevée à droite comme sur une chaussure réelle. */}
      <path
        d={`M 10 ${yBas}
            C 3 ${yBas}, 3 ${yBas - hT}, 12 ${yBas - hT}
            C 60 ${yBas - hT + 1}, 118 ${yBas - hA - 2}, ${L - 26} ${yBas - hA - 1}
            C ${L - 12} ${yBas - hA - 1}, ${L - 6} ${yBas - hA + 2}, ${L - 8} ${yBas - hA + 5}
            L ${L - 14} ${yBas} Z`}
        fill="url(#mousse)"
      />
      <text x="12" y={yBas - hT - 5} fontSize="8.5" fill="#71717a" fontWeight="600">{Math.round(stackTalonMm)} mm</text>
      <text x={L - 46} y={yBas - hA - 5} fontSize="8.5" fill="#71717a" fontWeight="600">{Math.round(avant)} mm</text>
    </svg>
  );
}
