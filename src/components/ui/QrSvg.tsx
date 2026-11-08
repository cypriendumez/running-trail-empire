import qrcode from "qrcode-generator";

/**
 * Le QR code, rendu en <rect> React — pas en HTML injecté. Le contenu est un lien que
 * NOUS composons ; le rendre module par module ferme quand même la porte à toute
 * injection le jour où ce composant recevrait un texte venu d'ailleurs.
 *
 * Sorti d'AjouterAmis le 12/10/2026 : le questionnaire s'en sert aussi, pour qu'un porteur
 * d'Apple Watch inscrit depuis un ordinateur ouvre l'App Store sur son iPhone d'un scan.
 */
export function QrSvg({ texte, className = "mx-auto h-48 w-48", label }: { texte: string; className?: string; label?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(texte);
  qr.make();
  const n = qr.getModuleCount();
  const cases: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cases.push(`M${c} ${r}h1v1h-1z`);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={className} shapeRendering="crispEdges" role="img" aria-label={label ?? texte}>
      <path d={cases.join("")} fill="#18181b" />
    </svg>
  );
}
