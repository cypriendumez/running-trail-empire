/**
 * L'ÉTAT D'UN COMPTE, TEL QUE L'ÉCRAN PEUT LE DIRE.
 *
 * ⚠️ DÉCISION DU 11/10/2026 (Cyprien) : on dit à l'écran si une adresse a un compte, et
 * comment il s'ouvre — comme les applications courantes. Avant, la règle anti-annuaire
 * faisait répondre « c'est envoyé » à tout, et Cyprien lui-même, inscrit avec une adresse
 * déjà ouverte par Google, a attendu un e-mail qui ne partait pas, puis s'est vu refuser
 * la connexion sans comprendre pourquoi. Le prix — on peut tester si une adresse est
 * inscrite — est borné par un limiteur de débit (`limiteur.ts`) sur chaque route qui répond.
 *
 * Module PUR : importable par les pages (types, lecture d'un compte). La recherche, qui lit
 * la clé de service, vit dans `statutCompte.ts` et ne doit jamais atteindre le navigateur.
 */
export type Methode = "mot_de_passe" | "google" | "apple";

export type StatutCompte = {
  /** `a_confirmer` : créé par e-mail, lien de confirmation jamais cliqué. */
  compte: "aucun" | "a_confirmer" | "actif";
  /** Comment ce compte s'ouvre. Vide quand il n'existe pas. */
  methodes: Methode[];
};

/** Ce que GoTrue rend d'un utilisateur, réduit à ce qui sert ici. */
export type UtilisateurAuth = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
};

/**
 * `app_metadata.providers` → méthodes. « email » = un mot de passe existe (inscription par
 * le formulaire, ou mot de passe ajouté à un compte Google : GoTrue crée alors une identité
 * « email »). Un fournisseur inconnu n'ouvre aucun bouton ici, il est ignoré.
 */
export function statutDepuisUtilisateur(u: UtilisateurAuth | null | undefined): StatutCompte {
  if (!u) return { compte: "aucun", methodes: [] };
  const brut = Array.isArray(u.app_metadata?.providers)
    ? (u.app_metadata!.providers as unknown[])
    : [u.app_metadata?.provider ?? "email"];
  const methodes: Methode[] = [];
  for (const p of brut.map((x) => String(x).toLowerCase())) {
    const m: Methode | null = p === "email" ? "mot_de_passe" : p === "google" ? "google" : p === "apple" ? "apple" : null;
    if (m && !methodes.includes(m)) methodes.push(m);
  }
  return { compte: u.email_confirmed_at || u.confirmed_at ? "actif" : "a_confirmer", methodes };
}

/** Le fournisseur externe d'un compte (Google avant Apple), s'il en a un. */
export function fournisseurDe(methodes: readonly Methode[]): "google" | "apple" | null {
  return methodes.includes("google") ? "google" : methodes.includes("apple") ? "apple" : null;
}

/** Vrai si ce compte ne s'ouvre QUE par Google/Apple : il n'a pas de mot de passe. */
export function sansMotDePasse(methodes: readonly Methode[]): boolean {
  return !methodes.includes("mot_de_passe") && fournisseurDe(methodes) !== null;
}
