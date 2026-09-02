/**
 * LE DESSIN D'UNE CHAUSSURE — tracé à partir de ses cotes, pas d'une photo.
 *
 * ⚠️ POURQUOI PAS DE PHOTO, ET POURQUOI CE N'EST PAS UN PIS-ALLER. Les visuels produit
 * appartiennent aux marques et aux marchands ; Pacevo n'en a pas la licence, et les
 * reprendre serait une contrefaçon, pas une facilité. Le seul chemin propre est le flux
 * d'affiliation, qui fournit les images AVEC le droit de les afficher — `product_offers`
 * a déjà la colonne `image_url` pour ça.
 *
 * En attendant, ce dessin fait quelque chose qu'une photo de catalogue ne fait PAS : il
 * est à l'échelle et il ne montre que ce qui est mesuré. Deux modèles côte à côte se
 * comparent vraiment — épaisseur de semelle, inclinaison talon-avant, crampons ou gomme
 * lisse, plaque ou non. Une photo, elle, montre surtout un coloris.
 *
 * ⚠️ ET IL NE DESSINE JAMAIS CE QU'IL IGNORE. Sans hauteur de semelle relevée, la zone de
 * mousse est hachurée et légendée « hauteur non communiquée » : le contour de la chaussure
 * reste lisible, mais aucune épaisseur n'est suggérée. C'est la même règle que partout
 * ailleurs — l'absence se montre, elle ne se comble pas.
 */

/** Couleur d'accent stable par marque : la même chaussure garde sa teinte d'une visite à l'autre. */
export function tonDeMarque(marque: string): { clair: string; fonce: string } {
  let h = 0;
  for (const c of marque.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  // Teintes désaturées : le dessin doit rester lisible à côté du texte, pas crier.
  return { clair: `hsl(${h} 42% 72%)`, fonce: `hsl(${h} 38% 46%)` };
}

export function ChaussureDessin({
  marque, stackTalonMm, dropMm, terrain, plaqueCarbone, className, absent, description,
}: {
  marque: string;
  stackTalonMm?: number;
  dropMm?: number;
  terrain: "route" | "trail" | "piste";
  plaqueCarbone?: boolean;
  className?: string;
  /** Libellé affiché quand la hauteur de semelle n'a pas été relevée. */
  absent: string;
  /**
   * Description du dessin pour les lecteurs d'écran, dans la langue du lecteur.
   *
   * ⚠️ ELLE NE PEUT PAS ÊTRE ÉCRITE ICI. Un `aria-label` rédigé dans le composant serait
   * en français pour tout le monde — invisible à la relecture, et c'est précisément aux
   * lecteurs d'écran qu'il s'adresse.
   */
  description: string;
}) {
  // ⚠️ REPÈRE INTERNE FIXE, MISE À L'ÉCHELLE PAR LE CONTENEUR. Premier jet : la hauteur
  //    du dessin servait aussi de hauteur de boîte. Avec 76 px de carte et 40 px de
  //    mousse, il ne restait que 36 px pour une tige qui en demande 60 : le haut de la
  //    chaussure sortait du cadre et n'apparaissait qu'en fine lamelle. Le dessin vit
  //    maintenant dans un repère de 260 × 150, et c'est le CSS qui le réduit.
  const L = 260, H = 150;
  const sol = H - 10;
  const ton = tonDeMarque(marque);
  const connu = stackTalonMm != null;

  // Échelle commune à toutes les fiches : 50 mm de mousse valent 46 unités. Fixe, sinon
  // deux modèles ne seraient plus comparables — c'est tout l'intérêt du dessin.
  const k = 46 / 50;
  const hT = connu ? stackTalonMm! * k : 22;
  const hA = connu ? Math.max(4, stackTalonMm! - (dropMm ?? 0)) * k : 16;

  const yT = sol - hT;   // dessus de la mousse au talon
  const yA = sol - hA;   // dessus de la mousse à l'avant

  // ── LA MOUSSE ────────────────────────────────────────────────────────────────────
  //  Talon arrondi à gauche, ligne qui s'affine vers l'avant, pointe légèrement relevée.
  //  La pointe se relève : toute chaussure de course a un « toe spring », et sans lui le
  //  dessin ressemble à une planche posée au sol.
  const semelle = `M 16 ${sol} C 5 ${sol}, 5 ${yT}, 20 ${yT}
                   C 84 ${yT + 1}, 168 ${yA - 3}, ${L - 34} ${yA - 4}
                   C ${L - 16} ${yA - 5}, ${L - 8} ${yA + 2}, ${L - 14} ${sol - 4}
                   C ${L - 30} ${sol}, ${L - 40} ${sol}, ${L - 48} ${sol} Z`;

  // ── LA TIGE ──────────────────────────────────────────────────────────────────────
  //  Contrefort au talon, col qui monte sur le cou-de-pied, descente vers la pointe.
  //  Le tracé se referme le long du dessus de la mousse, que la mousse recouvre ensuite.
  const hautTalon = yT - 58;
  const tige = `M 22 ${yT}
                C 18 ${yT - 24}, 22 ${hautTalon + 4}, 36 ${hautTalon}
                C 58 ${hautTalon - 6}, 80 ${hautTalon + 3}, 98 ${hautTalon + 15}
                C 132 ${hautTalon + 33}, 170 ${yA - 24}, ${L - 44} ${yA - 12}
                C ${L - 32} ${yA - 9}, ${L - 26} ${yA - 6}, ${L - 30} ${yA - 3}
                L 22 ${yT} Z`;

  //  Le col de la chaussure : un liseré qui donne le relief sans surcharger.
  const col = `M 34 ${hautTalon + 2} C 56 ${hautTalon - 4}, 78 ${hautTalon + 4}, 96 ${hautTalon + 14}`;

  return (
    <svg viewBox={`0 0 ${L} ${H}`} className={className} role="img"
      aria-label={description}>
      <defs>
        <linearGradient id={`mousse-${marque.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ton.clair} />
          <stop offset="100%" stopColor={ton.fonce} />
        </linearGradient>
        <pattern id="inconnu" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#d4d4d8" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* Le sol : la référence des deux épaisseurs. */}
      <line x1="0" y1={sol + 1} x2={L} y2={sol + 1} stroke="#e4e4e7" strokeWidth="1" />

      {/* La tige, toujours dessinée : c'est elle qui rend la silhouette lisible, même
          quand l'épaisseur de mousse est inconnue. */}
      {/* ⚠️ UN REMPLISSAGE BLANC CASSÉ SUR UNE CARTE BLANCHE NE SE VOIT PAS. Premier
          jet : seule la ligne de contour apparaissait, et la chaussure se lisait comme un
          trait. La tige a maintenant sa propre valeur de gris, distincte de la carte. */}
      <path d={tige} fill="#f1f1f3" stroke="#a1a1aa" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={col} fill="none" stroke="#71717a" strokeWidth="2.6" strokeLinecap="round" />
      {/* Contrefort du talon : la partie rigide qui tient le pied, en teinte de marque. */}
      <path d={`M 22 ${yT} C 18 ${yT - 24}, 22 ${hautTalon + 4}, 36 ${hautTalon}
                L 50 ${hautTalon + 5} C 42 ${hautTalon + 24}, 38 ${yT - 12}, 42 ${yT} Z`}
        fill={ton.clair} opacity="0.45" />
      {/* Lacets — trois traits en travers du cou-de-pied. */}
      {[0, 1, 2].map((i) => (
        <line key={i} x1={62 + i * 20} y1={hautTalon + 18 + i * 7} x2={80 + i * 20} y2={hautTalon + 30 + i * 8}
          stroke="#a1a1aa" strokeWidth="1.8" strokeLinecap="round" />
      ))}

      {/* La mousse : à l'échelle si on la connaît, hachurée sinon. */}
      <path d={semelle} fill={connu ? `url(#mousse-${marque.replace(/\W/g, "")})` : "url(#inconnu)"}
        stroke={connu ? "none" : "#e4e4e7"} strokeWidth="1" />

      {/* Plaque carbone : un trait dans l'épaisseur, là où elle se trouve. */}
      {connu && plaqueCarbone && (
        <path d={`M 30 ${sol - hT * 0.42} C 100 ${sol - hT * 0.4}, 170 ${sol - hA * 0.42}, ${L - 30} ${sol - hA * 0.44}`}
          fill="none" stroke="#27272a" strokeWidth="2.4" strokeLinecap="round" />
      )}

      {/* Semelle d'usure : crantée en trail, lisse sur route. */}
      {terrain === "trail"
        ? Array.from({ length: 10 }, (_, i) => 26 + i * 20).map((x) => (
            <path key={x} d={`M ${x} ${sol} l 4 5 l 4 -5 Z`} fill="#a1a1aa" />
          ))
        : <rect x="16" y={sol - 2} width={L - 62} height="3" rx="1.5" fill="#a1a1aa" />}

      {connu ? (
        <>
          <text x="20" y={yT - 6} fontSize="10" fill="#52525b" fontWeight="600">{Math.round(stackTalonMm!)} mm</text>
          <text x={L - 62} y={yA - 6} fontSize="10" fill="#52525b" fontWeight="600">
            {Math.round(stackTalonMm! - (dropMm ?? 0))} mm
          </text>
        </>
      ) : (
        <text x={L / 2} y={sol - 34} fontSize="10" fill="#a1a1aa" textAnchor="middle">{absent}</text>
      )}
    </svg>
  );
}
