export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient as clientSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoriserPartage } from "@/lib/auth/limiteur";
import { controlerNouveauMotDePasse } from "@/lib/auth/motDePasseFuite";
import { changerMotDePasse } from "@/lib/auth/changerMotDePasse";
import { estErreurTransitoire } from "@/lib/cron/transitoire";

/**
 * CHANGER SON MOT DE PASSE — depuis le lien « mot de passe oublié » (`/reset-password`) ou
 * depuis les réglages. La décision (ordre des contrôles, mot de passe actuel, erreurs GoTrue)
 * vit dans `lib/auth/changerMotDePasse`, testée par son comportement ; ici, seulement les
 * vraies dépendances.
 *
 * ⚠️ POURQUOI PAR LE SERVEUR. Avant le 08/11/2026, les deux écrans appelaient
 * `supabase.auth.updateUser({ password })` depuis le navigateur : la seule règle était
 * « 8 caractères », vérifiée par la page, aucun contrôle de fuite n'était possible, et une
 * session laissée ouverte suffisait à changer le mot de passe (aucun mot de passe actuel demandé).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const entree = (await req.json().catch(() => ({}))) as { password?: unknown; actuel?: unknown; captcha?: unknown };

  const r = await changerMotDePasse(entree, {
    // `getUser` interroge GoTrue : s'il répond, le jeton de la session est authentique, et
    // `jetonAcces` (le même, relu dans les cookies) peut être décodé sans revérifier sa signature.
    utilisateur: async () => (await supabase.auth.getUser()).data.user,
    jetonAcces: async () => (await supabase.auth.getSession()).data.session?.access_token,
    autoriser: (cle) => autoriserPartage(admin, cle, 8, 15 * 60_000),
    verifierActuel: (email, motActuel, captcha) => verifierMotDePasseActuel(email, motActuel, captcha),
    controler: (mdp, email) => controlerNouveauMotDePasse(mdp, email, "/api/auth/mot-de-passe"),
    ecrire: async (mdp, motActuel) => {
      const { error } = await supabase.auth.updateUser({ password: mdp, ...(motActuel ? { current_password: motActuel } : {}) });
      return { error: error ? { message: error.message, code: (error as { code?: string }).code, status: error.status } : null };
    },
    journaliser,
  });
  return NextResponse.json(r.body, { status: r.status });
}

/**
 * Le mot de passe actuel est-il le bon ? Une connexion sur un client JETABLE (rien n'est
 * stocké, aucun cookie posé), puis sa session est révoquée aussitôt : la personne garde la
 * sienne, et aucune session fantôme ne traîne.
 */
async function verifierMotDePasseActuel(email: string, motActuel: string, captcha: string | null): Promise<"ok" | "faux" | "captcha" | "indisponible"> {
  const jetable = clientSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // ⚠️ AVEC LE JETON CAPTCHA DU NAVIGATEUR : une fois la protection CAPTCHA activée chez Supabase,
  // GoTrue refuse toute connexion par mot de passe sans jeton — y compris celle-ci, faite par le serveur.
  const { data, error } = await jetable.auth.signInWithPassword({ email, password: motActuel, ...(captcha ? { options: { captchaToken: captcha } } : {}) });
  if (error) {
    if ((error as { code?: string }).code === "invalid_credentials") return "faux";
    if ((error as { code?: string }).code === "captcha_failed") return "captcha";
    if (!estErreurTransitoire(error, error.status)) {
      await journaliser(null, `Vérification du mot de passe actuel impossible : ${(error as { code?: string }).code ?? error.status ?? "?"} — ${error.message}`);
    }
    return "indisponible";
  }
  const { error: e } = await jetable.auth.signOut({ scope: "local" });
  if (e) await journaliser(data.user?.id ?? null, `Session de vérification non révoquée : ${e.message}`);
  return "ok";
}

async function journaliser(userId: string | null, message: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({
      user_id: userId, source: "mot-de-passe", message: message.slice(0, 2000), url: "/api/auth/mot-de-passe", meta: {},
    });
    if (error) console.error("[mot-de-passe] journal non écrit :", error.message);
  } catch (e) {
    console.error("[mot-de-passe] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
