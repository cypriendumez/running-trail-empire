import { CATEGORIES, categorieDe, enCentimes, dateReelle, type Sens } from "./model";

/**
 * LIRE UNE FACTURE OU UN TICKET DE CAISSE — et n'en garder que ce qui est SÛR.
 *
 * ⚠️ UNE LECTURE AUTOMATIQUE NE CRÉE JAMAIS D'ÉCRITURE. Elle pré-remplit un formulaire
 * que l'éditeur valide. Un total mal lu — 19,90 pris pour 1990, une date d'échéance prise
 * pour une date de paiement — deviendrait une ligne comptable fausse, indiscernable d'une
 * ligne juste une fois enregistrée. La machine propose, l'humain confirme.
 *
 * ⚠️ ET CE QUI N'EST PAS LISIBLE RESTE VIDE. Un champ deviné « pour rendre service » est
 * pire qu'un champ vide : le vide se voit et se remplit, l'approximation se recopie.
 */

export type Suggestion = {
  date?: string;
  libelle?: string;
  montantCents?: number;
  tiers?: string;
  piece?: string;
  categorie?: string;
  sens?: Sens;
  /** Ce que la lecture n'a pas pu établir, en clair, pour l'afficher à l'écran. */
  avertissements: string[];
};

export const CONSIGNE_LECTURE = `Tu lis une facture, un reçu ou un ticket de caisse français et tu en extrais les données comptables.

Réponds UNIQUEMENT par un objet JSON, sans texte autour, avec ces clés :
- "date" : date de l'opération au format AAAA-MM-JJ. La date de PAIEMENT ou d'émission, jamais une date d'échéance ni une date de livraison. Omets la clé si tu ne la lis pas avec certitude.
- "montantTTC" : le total TOUTES TAXES COMPRISES, en euros, avec un point décimal (ex. 19.90). Jamais le HT, jamais un sous-total, jamais un montant de TVA.
- "devise" : le code de la devise (EUR, USD…).
- "tiers" : le nom du commerçant ou du fournisseur.
- "piece" : le numéro de facture ou de ticket.
- "sens" : "sortie" si c'est un achat (le cas courant), "entree" si c'est une facture que l'éditeur a émise à un client.
- "categorie" : un identifiant PARMI CETTE LISTE EXACTE, ou omets la clé : ${CATEGORIES.map((c) => c.id).join(", ")}.
- "libelle" : une description courte, 60 caractères maximum.

RÈGLE ABSOLUE : si une information n'est pas lisible ou si tu hésites, OMETS la clé. N'invente jamais une valeur plausible : un chiffre inventé est indiscernable d'un chiffre lu, et il finira dans une comptabilité.`;

const txt = (v: unknown, max: number): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : undefined;
};

/**
 * Vérifie et normalise ce que le modèle a répondu.
 *
 * Tout ce qui ne passe pas ces contrôles est ÉCARTÉ et signalé — on ne « répare » rien.
 */
export function interpreterLecture(brut: unknown): Suggestion {
  const o = (brut ?? {}) as Record<string, unknown>;
  const av: string[] = [];
  const s: Suggestion = { avertissements: av };

  // — Sens : sortie par défaut, c'est le cas courant d'un justificatif reçu.
  s.sens = o.sens === "entree" ? "entree" : "sortie";

  // — Date : format ET existence réelle. « 2026-02-31 » se lit comme une date valable.
  const d = txt(o.date, 10);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && dateReelle(d)) s.date = d;
  else av.push("Date non lue — à saisir.");

  // — Devise : on ne convertit rien, jamais. Même règle que pour Stripe.
  const devise = txt(o.devise, 8)?.toUpperCase();
  const enEuros = !devise || devise === "EUR" || devise === "€";

  // — Montant : le TTC, strictement positif.
  const cents = typeof o.montantTTC === "number" || typeof o.montantTTC === "string"
    ? enCentimes(o.montantTTC as string | number) : null;
  if (cents === null || cents <= 0) av.push("Montant non lu — à saisir.");
  else if (!enEuros) av.push(`Montant en ${devise} : non repris, l'application ne convertit aucune devise.`);
  else s.montantCents = cents;

  s.tiers = txt(o.tiers, 120);
  s.piece = txt(o.piece, 160);
  s.libelle = txt(o.libelle, 60) ?? s.tiers;
  if (!s.libelle) av.push("Libellé non lu — à saisir.");

  // — Catégorie : uniquement un identifiant existant, ET cohérent avec le sens.
  const cat = txt(o.categorie, 40);
  const c = cat ? categorieDe(cat) : undefined;
  if (c && c.sens === s.sens) s.categorie = c.id;
  else if (cat) av.push("Catégorie proposée écartée — à choisir toi-même.");

  return s;
}

/** Extrait le premier objet JSON d'une réponse de modèle, qui aime les enrober. */
export function jsonDeLaReponse(texte: string): unknown {
  const net = texte.replace(/```json|```/g, "").trim();
  const i = net.indexOf("{"), j = net.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(net.slice(i, j + 1)); } catch { return null; }
}
