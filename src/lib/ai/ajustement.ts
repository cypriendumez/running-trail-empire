/**
 * L'IA PROPOSE, L'ALGORITHME DISPOSE.
 *
 * Le plan de sept jours est DÉTERMINISTE (`autoPlan`) : mêmes données, même plan, aucun
 * jeton dépensé, recalculable toutes les dix minutes. C'est ce qui le rend explicable —
 * on peut dire à l'athlète POURQUOI son budget qualité est tombé à zéro — et sûr : le
 * plancher ACWR/TSB n'est pas négociable par une phrase bien tournée.
 *
 * Ce module ajoute la seule chose que le déterminisme ne sait pas faire : lire la
 * situation en langage naturel et proposer UN ajustement argumenté. « Ta séance de seuil
 * de jeudi tombe deux jours après ton semi : la décaler au samedi te laisserait un jour
 * de plus. »
 *
 * ── LA RÈGLE QUI REND ÇA ACCEPTABLE ──────────────────────────────────────────
 * ⚠️ LA PROPOSITION N'EST JAMAIS APPLIQUÉE AUTOMATIQUEMENT, et elle est VALIDÉE contre
 * les mêmes bornes que le plan. Un modèle qui suggère d'ajouter une séance de qualité
 * alors que le budget est à zéro voit sa proposition REJETÉE ici, avant tout affichage.
 * Sans ce filtre, on aurait rouvert par la fenêtre le risque que le plan déterministe
 * ferme par la porte : prescrire de l'intensité à quelqu'un d'épuisé.
 *
 * ── ET CE QUI LA REND RENTABLE ───────────────────────────────────────────────
 * ⚠️ Un appel coûte ~0,29 c€ en entrée, et la SORTIE coûte huit fois l'entrée : c'est
 * `maxOutputTokens` qui décide de la facture, pas le nombre d'athlètes. D'où :
 *  · à la DEMANDE, jamais à chaque synchronisation (le plan se replanifie toutes les
 *    10 minutes — un appel à chaque fois serait ruineux) ;
 *  · une sortie courte et STRUCTURÉE, pas un essai ;
 *  · une empreinte du plan : tant qu'il n'a pas changé, la proposition est resservie ;
 *  · l'appel passe par le quota du palier (0 / 10 / 30 par jour), donc le plafond de
 *    dépense par athlète existe déjà et n'a pas à être réinventé.
 */

export type JourPlan = { date: string; type: string; title: string };

/** Ce que le modèle n'a PAS le droit de franchir. Calculé, jamais demandé au modèle. */
export type Contraintes = {
  /** Séances de qualité que la semaine autorise. 0 = aucune intensité, point. */
  qBudget: number;
  /** Les types considérés comme « qualité » — ceux que le budget compte. */
  typesQualite: string[];
  /** Les dates du plan. Une proposition qui vise un autre jour est hors sujet. */
  dates: string[];
  /** Motifs d'allègement, tels qu'affichés à l'athlète. Le modèle doit s'y référer. */
  raisons: string[];
};

export type Ajustement = {
  /** Le jour visé, AAAA-MM-JJ. */
  date: string;
  /** Ce qu'on propose d'en faire : décaler, alléger, échanger, ou laisser tel quel. */
  action: "decaler" | "alleger" | "echanger" | "rien";
  /** Deux phrases, dans la langue de l'athlète. */
  texte: string;
};

/** Un type de séance compte-t-il dans le budget qualité ? */
export const EST_QUALITE = /vma|seuil|tempo|sp[ée]cifique|allure|c[oô]te|fractionn/i;

export function contraintesDe(week: JourPlan[], qBudget: number, raisons: string[]): Contraintes {
  return {
    qBudget: Math.max(0, Math.round(qBudget)),
    typesQualite: week.filter((d) => EST_QUALITE.test(d.type)).map((d) => d.type),
    dates: week.map((d) => d.date),
    raisons: raisons.slice(0, 4),
  };
}

/**
 * Valide ce que le modèle renvoie. Rend l'ajustement, ou `null` avec un motif.
 *
 * ⚠️ TOUT CE QUI N'EST PAS EXPLICITEMENT AUTORISÉ EST REFUSÉ. C'est l'inverse de
 * l'habitude — on filtre d'ordinaire ce qu'on sait dangereux — mais un modèle produit
 * l'imprévu par construction : la liste de ce qu'on accepte est finie, celle de ce
 * qu'il peut inventer ne l'est pas.
 */
export function validerAjustement(
  brut: unknown,
  c: Contraintes,
): { ok: true; ajustement: Ajustement } | { ok: false; motif: string } {
  const o = brut as Partial<Ajustement> | null;
  if (!o || typeof o !== "object") return { ok: false, motif: "reponse-illisible" };

  const action = String(o.action ?? "");
  if (!["decaler", "alleger", "echanger", "rien"].includes(action)) {
    return { ok: false, motif: `action inconnue : ${action.slice(0, 24)}` };
  }

  const texte = typeof o.texte === "string" ? o.texte.trim() : "";
  if (texte.length < 30) return { ok: false, motif: "texte trop court pour être une explication" };
  if (texte.length > 400) return { ok: false, motif: "texte trop long" };

  // « Rien à changer » est une réponse LÉGITIME, et elle ne vise aucun jour.
  if (action === "rien") return { ok: true, ajustement: { date: "", action: "rien", texte } };

  const date = String(o.date ?? "");
  if (!c.dates.includes(date)) {
    return { ok: false, motif: `le jour ${date.slice(0, 12)} n'est pas dans le plan` };
  }

  // ⚠️ LE GARDE-FOU QUI COMPTE. Décaler ou échanger une séance de qualité, c'est en
  // reposer une ailleurs dans la semaine. Quand le budget est à ZÉRO — fatigue réelle,
  // ratio aigu:chronique dans le rouge — la seule direction autorisée est d'alléger.
  // Un modèle qui propose de « déplacer le seuil à samedi » sur un budget nul rouvrirait
  // exactement la porte que le plan déterministe vient de fermer.
  if (c.qBudget === 0 && action !== "alleger") {
    return { ok: false, motif: "budget qualité à zéro : seul un allègement est recevable" };
  }

  return { ok: true, ajustement: { date, action: action as Ajustement["action"], texte } };
}

/**
 * L'empreinte du plan. Tant qu'elle ne change pas, la proposition est resservie.
 *
 * ⚠️ Elle inclut le BUDGET, pas seulement les séances : deux plans identiques sur le
 * papier mais dont l'un a été allégé pour fatigue n'appellent pas le même conseil.
 */
export function empreintePlan(week: JourPlan[], qBudget: number): string {
  return `${qBudget}|${week.map((d) => `${d.date}:${d.type}`).join(",")}`;
}

export const CONSIGNE_AJUSTEMENT = `Tu es un entraîneur de course à pied. On te donne un plan de 7 jours DÉJÀ CALCULÉ et les contraintes qui l'ont produit.

Tu ne réécris pas le plan. Tu proposes AU PLUS UN ajustement, celui qui apporterait le plus — ou tu dis qu'il n'y a rien à changer, ce qui est souvent la bonne réponse.

RÈGLES ABSOLUES
- Tu ne proposes JAMAIS d'ajouter de l'intensité. Le budget qualité fourni est un plafond calculé sur la fatigue réelle de l'athlète ; il n'est pas discutable.
- Si le budget qualité vaut 0, la seule action recevable est « alleger ».
- Tu ne vises qu'un jour figurant dans le plan.
- Tu n'inventes aucun chiffre : n'utilise que ceux du contexte fourni.

FORME — deux phrases maximum, ton direct, dans la langue demandée. Tu dis ce que tu changes ET pourquoi, en t'appuyant sur les motifs fournis.

Réponds UNIQUEMENT par un objet JSON : {"date":"AAAA-MM-JJ","action":"decaler|alleger|echanger|rien","texte":"…"}`;
