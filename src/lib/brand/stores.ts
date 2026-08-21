/**
 * LES LIENS VERS LES BOUTIQUES D'APPLICATIONS.
 *
 * ⚠️ L'APPLICATION N'EST PUBLIÉE NULLE PART À CE JOUR (21/08/2026). Afficher un badge
 * « Télécharger dans l'App Store » qui ne mène à rien — ou pire, à une page d'erreur —
 * serait exactement la faute qu'on vient de corriger sur la page des avis : promettre au
 * visiteur quelque chose qui n'existe pas. Les badges ne s'affichent donc QUE si les
 * adresses sont renseignées.
 *
 * ── COMMENT LES ALLUMER, LE JOUR VENU ────────────────────────────────────────
 * Deux variables d'environnement sur Vercel, rien à recompiler côté code :
 *   NEXT_PUBLIC_APP_STORE_URL   = https://apps.apple.com/app/idXXXXXXXXX
 *   NEXT_PUBLIC_PLAY_STORE_URL  = https://play.google.com/store/apps/details?id=…
 * Chaque badge apparaît indépendamment : publier d'abord sur Google Play affiche le
 * badge Google seul, ce qui est le comportement voulu.
 *
 * ⚠️ Il faut AUSSI déposer les deux images officielles dans `public/badges/`
 * (voir le README qui s'y trouve) : Apple comme Google interdisent de redessiner leur
 * badge, et fournissent l'artwork exact pour cet usage précis.
 */
export type LiensStore = { ios: string | null; android: string | null };

/** Une adresse vide, absente ou non http ne vaut pas un lien : on n'affiche rien. */
function propre(v: string | undefined): string | null {
  const s = String(v ?? "").trim();
  return /^https?:\/\/\S+$/.test(s) ? s : null;
}

export function liensStore(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): LiensStore {
  return {
    ios: propre(env.NEXT_PUBLIC_APP_STORE_URL),
    android: propre(env.NEXT_PUBLIC_PLAY_STORE_URL),
  };
}
