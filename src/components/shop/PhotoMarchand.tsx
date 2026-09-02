/**
 * LA PHOTO D'UN PRODUIT — et le SEUL endroit de la boutique autorisé à afficher une image.
 *
 * ⚠️ UNE PHOTO PRODUIT N'EST PAS UNE DONNÉE, C'EST UNE ŒUVRE. Elle appartient à la marque
 * ou au marchand. La reprendre d'une page web serait une contrefaçon — pas un raccourci.
 * Le seul cas où l'afficher est licite, c'est quand elle vient d'un FLUX D'AFFILIATION :
 * le contrat d'éditeur affilié accorde explicitement le droit d'utiliser les visuels du
 * flux pour promouvoir le marchand.
 *
 * D'où la règle, tenue par un test : l'unique source admise est `product_offers.image_url`,
 * remplie par `import-flux`. Aucun autre fichier de la boutique ne peut rendre une balise
 * `<img>`. Tant qu'aucun flux n'est raccordé, cette colonne est vide et c'est le dessin
 * aux cotes qui s'affiche — voir `ChaussureDessin`.
 *
 * ⚠️ ET ON NE MET PAS L'IMAGE EN CACHE CHEZ NOUS. La licence porte sur l'affichage du
 * visuel du marchand, pas sur sa recopie : on pointe vers son adresse, on ne la rapatrie
 * pas. `next/image` optimiserait en la copiant sur notre hébergeur — c'est pour cela que
 * ce composant utilise une balise simple.
 */
export function PhotoMarchand({ src, alt, marchand, className }: {
  /** `product_offers.image_url`, et rien d'autre. */
  src: string;
  alt: string;
  /** Le marchand dont vient le visuel : il est nommé sous l'image. */
  marchand: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- voir l'en-tête : pas de recopie. */}
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer-when-downgrade"
        className="mx-auto max-h-full w-auto object-contain" />
      <figcaption className="mt-1 text-center text-[10.5px] text-zinc-400">© {marchand}</figcaption>
    </figure>
  );
}

/**
 * L'adresse d'image d'une offre, si elle est utilisable.
 *
 * ⚠️ ON REFUSE TOUT CE QUI N'EST PAS UNE ADRESSE HTTPS COMPLÈTE. Un flux mal formé peut
 * rendre un chemin relatif, une adresse `data:` ou du vide : afficher une image cassée
 * vaut moins que le dessin, qui lui est toujours juste.
 */
export function photoUtilisable(url: unknown): string | null {
  const s = String(url ?? "").trim();
  return /^https:\/\/[^\s"'<>]+\.[a-z]{2,}\/[^\s"'<>]*$/i.test(s) ? s : null;
}
