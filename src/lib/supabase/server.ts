import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { secondFacteurEnAttente } from "@/lib/auth/mfa";

async function construire() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options as any)
            );
          } catch { /* server component — ignore */ }
        },
      },
    }
  );
}

/**
 * Le client Supabase du serveur, lié à la session du visiteur (cookies, RLS appliquée).
 *
 * ⚠️ DOUBLE AUTHENTIFICATION (08/11/2026) : `auth.getUser()` répond « personne » pour une session
 * qui doit encore donner son code (compte avec facteur TOTP vérifié, session `aal1` — voir
 * `lib/auth/mfa`). C'est LE point de passage de toutes les pages et de toutes les routes qui
 * identifient le coureur : sans ce filtre, un mot de passe volé suffirait à lire ses données de
 * santé par n'importe quelle route serveur (dont celles qui lisent avec la clé de service).
 * Les pages renvoient alors vers `/login`, qui envoie vers `/verification-2fa`.
 *
 * Seuls les écrans du second facteur ont besoin de voir la session en attente :
 * `createClientSansGarde2fa`.
 */
export async function createClient() {
  return avecGardeSecondFacteur(await construire());
}

type ClientAuth = {
  auth: {
    getUser: (jwt?: string) => Promise<{ data: { user: unknown }; error: unknown }>;
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
  };
};

/** La garde elle-même, séparée pour être testée sur un faux client (`tests/deux-facteurs.test.ts`). */
export function avecGardeSecondFacteur<C extends ClientAuth>(client: C): C {
  const brut = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async (jwt?: string) => {
    const r = await brut(jwt);
    if (!jwt && r.data.user) {
      // Le jeton que GoTrue vient de valider (le même, relu dans les cookies) porte le niveau `aal`.
      const { data: { session } } = await client.auth.getSession();
      if (secondFacteurEnAttente(r.data.user as Parameters<typeof secondFacteurEnAttente>[0], session?.access_token)) {
        return { data: { user: null }, error: null };
      }
    }
    return r;
  }) as C["auth"]["getUser"];
  return client;
}

/** ⚠️ SANS la garde du second facteur : réservé à `/verification-2fa` et à ses routes. */
export async function createClientSansGarde2fa() {
  return construire();
}
