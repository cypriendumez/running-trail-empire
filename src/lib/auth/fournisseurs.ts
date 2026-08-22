/**
 * QUELS FOURNISSEURS OAUTH SONT RÉELLEMENT BRANCHÉS.
 *
 * ⚠️ VÉRIFIÉ LE 22/08/2026 : NI GOOGLE NI APPLE n'étaient activés côté Supabase.
 * `GET /auth/v1/authorize?provider=google` répondait
 * « Unsupported provider: provider is not enabled ». Les deux boutons, placés tout en
 * haut de la page de connexion — avant même le champ e-mail — échouaient donc à chaque
 * clic. Le code affichait un message honnête (« La connexion Google n'est pas encore
 * activée »), ce qui vaut mieux qu'un plantage, mais c'est une promesse qu'on ne tient
 * pas : un visiteur clique sur ce qu'on lui propose en premier, et se heurte à un mur.
 *
 * Ils ne s'affichent donc que si on les DÉCLARE, exactement comme les badges des
 * boutiques : une fonction qu'on ne peut pas rendre ne s'annonce pas.
 *
 * ── COMMENT LES ALLUMER ──────────────────────────────────────────────────────
 * 1. Activer le fournisseur dans Supabase → Authentication → Providers
 *    (identifiants Google Cloud, ou Apple Developer — ce dernier est payant).
 * 2. Poser la variable sur Vercel, puis redéployer :
 *       NEXT_PUBLIC_OAUTH = google
 *       NEXT_PUBLIC_OAUTH = google,apple
 *
 * ⚠️ Chaque fournisseur est indépendant : déclarer Google seul affiche Google seul.
 * Et déclarer un fournisseur qui n'est PAS activé côté Supabase remet le bouton mort —
 * la variable dit ce qu'on a branché, elle ne le branche pas.
 */
export type Fournisseur = "google" | "apple";

const CONNUS: Fournisseur[] = ["google", "apple"];

export function fournisseursActifs(brut: string | undefined = process.env.NEXT_PUBLIC_OAUTH): Fournisseur[] {
  return String(brut ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Fournisseur => CONNUS.includes(s as Fournisseur));
}
