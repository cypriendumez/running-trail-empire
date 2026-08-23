import type { Lang } from "@/lib/i18n/translations";

/**
 * L'IDENTITÉ DE L'ÉDITEUR ET DE SES HÉBERGEURS — une seule fiche.
 *
 * ⚠️ CES FAITS ÉTAIENT RECOPIÉS ~35 FOIS : mentions légales, CGU et politique de
 * confidentialité, en cinq langues, plus la page contact, le pied des lettres
 * d'information et le texte RGPD des réglages. Une identité légale qui vit en trente-cinq
 * exemplaires ne se met pas à jour : elle se met à jour À MOITIÉ. Le jour d'une cession,
 * d'un déménagement ou d'une immatriculation, il reste des pages qui désignent encore
 * l'ancien éditeur — et ce sont des pages qui ENGAGENT.
 *
 * Ici : les FAITS. Les phrases qui les entourent restent dans `legalI18n.ts`, à leur
 * place, traduites. Un test interdit à toute page légale de réécrire un de ces faits.
 */
export const EDITEUR = {
  nom: "Cyprien Dumez",
  /**
   * ⚠️ À COMPLÉTER, ET VOLONTAIREMENT VISIBLE TANT QUE ÇA NE L'EST PAS. L'article 6-III
   * de la LCEN impose de publier le statut et, si l'éditeur est immatriculé, son numéro
   * SIREN/SIRET. Afficher un blanc discret laisserait croire que la page est complète.
   */
  statut: "[À COMPLÉTER / TO BE COMPLETED — statut juridique et n° SIREN/SIRET]",
  /** Sans le pays : il est TRADUIT (France / Frankreich / Francia / França) — voir PAYS_EDITEUR. */
  adresse: "28 avenue Pasteur, 59130 Lambersart",
  email: "cypriendumez@outlook.fr",
  directeurPublication: "Cyprien Dumez",
} as const;

/**
 * Hébergeur de l'application.
 *
 * Adresse relevée le 23/08/2026 sur les pages légales de Vercel elles-mêmes
 * (vercel.com/legal/privacy-policy et /legal/terms), pas de mémoire.
 *
 * ⚠️ `region` VÉRIFIÉE EN PRODUCTION le 23/08/2026 : l'en-tête `x-vercel-id` renvoie
 * `cdg1::iad1::…` sur chaque appel — `cdg1` n'est que le point d'entrée parisien,
 * `iad1` est la région où le CODE SERVEUR S'EXÉCUTE, en Virginie du Nord. Autrement dit,
 * toute donnée qui traverse une route de l'application est traitée aux États-Unis. La
 * politique de confidentialité le disait pour l'hébergement, mais l'omettait dans la
 * section « transferts hors Union européenne » — c'est corrigé.
 */
export const HEBERGEUR_APP = {
  nom: "Vercel Inc.",
  adresse: "440 N Barranca Avenue #4133, Covina, CA 91723",
  site: "vercel.com",
  region: "iad1",
} as const;

/**
 * Hébergeur de la base de données.
 *
 * ⚠️ RÉGION NON VÉRIFIABLE DEPUIS LE CODE — et il ne faut pas croire l'inverse. L'API
 * Supabase répond derrière Cloudflare (`cf-ray: …-CDG` désigne le point d'entrée
 * parisien, PAS la base), aucun en-tête ne nomme la région, `db.<ref>.supabase.co` ne
 * résout pas, et tous les poolers régionaux existent quel que soit le projet.
 *
 * ✅ CONFIRMÉE LE 23/08/2026 par l'éditeur, dans le tableau de bord Supabase
 * (Project Settings → General → Region) : `eu-central-1`. La phrase publiée dans les
 * mentions légales et la politique de confidentialité est donc exacte.
 *
 * Si la base est un jour migrée, corriger ICI seulement — les cinq langues en découlent.
 */
export const HEBERGEUR_BDD = {
  nom: "Supabase",
  region: "eu-central-1",
  ville: { fr: "Francfort", en: "Frankfurt", de: "Frankfurt", es: "Fráncfort", pt: "Frankfurt" } as Record<Lang, string>,
} as const;

/** Le pays de l'éditeur, dans chaque langue publiée. */
export const PAYS_EDITEUR: Record<Lang, string> = {
  fr: "France", en: "France", de: "Frankreich", es: "Francia", pt: "França",
};

/** Le pays d'exécution de l'application, dans chaque langue publiée. */
export const PAYS_APP: Record<Lang, string> = {
  fr: "États-Unis", en: "United States", de: "USA", es: "Estados Unidos", pt: "Estados Unidos",
};

/**
 * Les sous-traitants déclarés dans la politique de confidentialité.
 *
 * `preuve` est le marqueur qui atteste, DANS LE CODE, qu'on s'adresse vraiment à ce
 * tiers. Un test le cherche. Déclarer un tiers qu'on n'appelle jamais trompe le lecteur
 * d'une page qui engage ; appeler un tiers qu'on ne déclare pas est une faute au sens du
 * RGPD. Les deux dérives se produisent en silence : personne ne relit une politique de
 * confidentialité.
 *
 * ⚠️ LA PREUVE N'EST PAS TOUJOURS UNE URL, et le supposer rendait le test faux. Supabase
 * et Stripe n'apparaissent nulle part sous forme d'adresse : l'un est joint via
 * `NEXT_PUBLIC_SUPABASE_URL`, l'autre par sa bibliothèque officielle. Le test les a
 * signalés « déclarés mais jamais appelés » alors qu'ils sont au cœur du service —
 * c'était la preuve qui était mal choisie, pas la déclaration.
 *
 * `heberge: true` = l'entreprise nous héberge ; il n'y a rien à appeler.
 */
export const SOUS_TRAITANTS: { nom: string; preuve?: string; heberge?: boolean }[] = [
  { nom: "Supabase", preuve: "@supabase/supabase-js" },
  { nom: "Vercel", heberge: true },
  { nom: "Google", preuve: "generativelanguage.googleapis.com" },
  { nom: "Anthropic", preuve: "api.anthropic.com" },
  { nom: "intervals.icu", preuve: "intervals.icu" },
  { nom: "Stripe", preuve: 'from "stripe"' },
  { nom: "Resend", preuve: "api.resend.com" },
];
