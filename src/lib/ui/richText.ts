/**
 * MISE EN FORME DES RÉPONSES DE MODÈLE — analyseur pur, sans dépendance.
 *
 * ⚠️ CE N'EST PAS UN CONFORT D'AFFICHAGE, C'EST UN DÉFAUT MESURÉ. Les invites du kiné IA
 * et du support demandent explicitement une réponse « structurée (titres courts / puces) ».
 * Le modèle obéit : sondé le 02/09/2026 sur une vraie question de tendinopathie, il a
 * renvoyé 7 passages en gras, 2 titres et 6 puces. L'interface, elle, les affichait en
 * `whitespace-pre-wrap` — l'athlète lisait donc « ### Pour mieux comprendre » et
 * « *   **Déclencheur :** ». On demandait une structure pour la jeter à l'écran.
 *
 * ⚠️ AUCUN HTML N'EST PRODUIT ICI. La fonction rend un ARBRE de blocs que React
 * transforme en éléments : le texte d'un modèle ne doit jamais traverser
 * `dangerouslySetInnerHTML`, sans quoi une réponse contenant une balise deviendrait du
 * balisage exécuté dans la page.
 *
 * On ne couvre volontairement que ce que les modèles produisent réellement : titres,
 * gras, listes à puces et numérotées, paragraphes. Le reste est laissé tel quel plutôt
 * que d'être « à peu près » interprété.
 */

export type Segment = { gras: boolean; texte: string };

export type Bloc =
  | { type: "titre"; niveau: 1 | 2 | 3; contenu: Segment[] }
  | { type: "paragraphe"; contenu: Segment[] }
  | { type: "liste"; ordonnee: boolean; items: Segment[][] };

/** Découpe une ligne en passages normaux et en gras (`**…**`). */
export function segments(ligne: string): Segment[] {
  const out: Segment[] = [];
  let reste = ligne;
  for (;;) {
    const m = reste.match(/\*\*([^*]+)\*\*/);
    if (!m || m.index === undefined) break;
    if (m.index > 0) out.push({ gras: false, texte: reste.slice(0, m.index) });
    out.push({ gras: true, texte: m[1] });
    reste = reste.slice(m.index + m[0].length);
  }
  if (reste) out.push({ gras: false, texte: reste });
  // Une ligne vide de contenu reste un segment vide plutôt que rien : le bloc existe.
  return out.length ? out : [{ gras: false, texte: "" }];
}

const TITRE = /^\s{0,3}(#{1,6})\s+(.*)$/;
// ⚠️ LA PUCE EXIGE UNE ESPACE APRÈS LE MARQUEUR. Sans elle, « **Attention** » commencerait
// par une étoile et deviendrait une puce, ce qui avalerait le gras d'ouverture.
const PUCE = /^\s*[*\-•]\s+(.*)$/;
const NUMERO = /^\s*\d{1,2}[.)]\s+(.*)$/;

/** Transforme la prose d'un modèle en blocs affichables. */
export function analyser(texte: string): Bloc[] {
  const blocs: Bloc[] = [];
  let para: string[] = [];
  let liste: { ordonnee: boolean; items: string[] } | null = null;

  const viderPara = () => {
    if (para.length) { blocs.push({ type: "paragraphe", contenu: segments(para.join("\n")) }); para = []; }
  };
  const viderListe = () => {
    if (liste) { blocs.push({ type: "liste", ordonnee: liste.ordonnee, items: liste.items.map(segments) }); liste = null; }
  };

  for (const ligne of String(texte ?? "").split("\n")) {
    const t = TITRE.exec(ligne);
    if (t) {
      viderPara(); viderListe();
      blocs.push({ type: "titre", niveau: Math.min(3, t[1].length) as 1 | 2 | 3, contenu: segments(t[2]) });
      continue;
    }
    const p = PUCE.exec(ligne), n = !p ? NUMERO.exec(ligne) : null;
    if (p || n) {
      viderPara();
      const ordonnee = Boolean(n);
      // Une puce qui suit une numérotation (ou l'inverse) ouvre une NOUVELLE liste :
      // les fusionner afficherait des numéros sur des puces, et inversement.
      if (liste && liste.ordonnee !== ordonnee) viderListe();
      liste ??= { ordonnee, items: [] };
      liste.items.push((p ?? n)![1]);
      continue;
    }
    if (!ligne.trim()) { viderPara(); viderListe(); continue; }
    viderListe();
    para.push(ligne);
  }
  viderPara(); viderListe();
  return blocs;
}

/** Le texte nu, marqueurs retirés — pour un aperçu, une notification ou un test. */
export function texteNu(texte: string): string {
  return analyser(texte)
    .map((b) => b.type === "liste"
      ? b.items.map((i) => i.map((s) => s.texte).join("")).join("\n")
      : b.contenu.map((s) => s.texte).join(""))
    .join("\n");
}
