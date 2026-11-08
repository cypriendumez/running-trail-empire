import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifierRegles, type RaisonMotDePasse } from "@/lib/auth/reglesMotDePasse";
import { UA_PACEVOBOT } from "@/lib/races/robot";

/**
 * MOT DE PASSE DÉJÀ FUITÉ ? — la base Pwned Passwords de Have I Been Pwned.
 *
 * ⚠️ POURQUOI ICI ET PAS DANS SUPABASE : la « Leaked password protection » de Supabase existe,
 * mais seulement à partir de l'offre Pro (doc Supabase « Password security », lue le
 * 08/11/2026 ; l'alerte `auth_leaked_password_protection` du Security Advisor le rappelle).
 * Et l'inscription de Pacevo passe par `generateLink` (route `/api/auth/confirmation`), que
 * GoTrue v2.197 ne soumet à AUCUNE règle de mot de passe (`checkPasswordStrength` n'est appelé
 * que par la création et la mise à jour d'utilisateur, pas par `adminGenerateLink`) : sans ce
 * contrôle, l'inscription accepterait n'importe quoi, quel que soit le réglage du tableau de bord.
 *
 * ⚠️ LE MOT DE PASSE NE SORT PAS D'ICI. Méthode « k-anonymat » : on calcule son empreinte
 * SHA-1, on n'envoie que ses 5 premiers caractères hexadécimaux, et le service renvoie les
 * centaines d'empreintes qui commencent pareil ; la comparaison se fait chez nous. `Add-Padding`
 * ajoute de fausses lignes (compte 0) pour que la taille de la réponse ne trahisse rien.
 * L'appel part du serveur : l'adresse IP du coureur n'est pas transmise non plus.
 *
 * ⚠️ SERVICE INDISPONIBLE = ON LAISSE PASSER, ET ON LE NOTE. Bloquer toutes les inscriptions
 * parce qu'un service tiers est en panne serait pire que le risque (c'est aussi le choix par
 * défaut de GoTrue, `FailClosed: false`). Mais on ne prétend pas avoir vérifié : le verdict
 * vaut `inconnu`, et l'appelant le journalise (`error_logs`, source `hibp`).
 */

export type VerdictFuite = "fuite" | "sain" | "inconnu";

const URL_HIBP = "https://api.pwnedpasswords.com/range/";
const DELAI_MS = 3000;

export function empreinteSha1(mdp: string): string {
  return createHash("sha1").update(mdp, "utf8").digest("hex").toUpperCase();
}

export async function motDePasseFuite(
  mdp: string,
  opts: { fetchImpl?: typeof fetch; delaiMs?: number } = {},
): Promise<VerdictFuite> {
  const empreinte = empreinteSha1(mdp);
  const prefixe = empreinte.slice(0, 5);
  const suffixe = empreinte.slice(5);
  try {
    const rep = await (opts.fetchImpl ?? fetch)(URL_HIBP + prefixe, {
      // Une seule identité pour tout appel sortant de Pacevo (tests/legalite.test.ts).
      headers: { "Add-Padding": "true", "User-Agent": UA_PACEVOBOT },
      signal: AbortSignal.timeout(opts.delaiMs ?? DELAI_MS),
      cache: "no-store",
    });
    if (!rep.ok) return "inconnu";
    const corps = await rep.text();
    for (const ligne of corps.split("\n")) {
      const [suf, compte] = ligne.trim().split(":");
      // Les lignes de remplissage portent un compte de 0 : ce ne sont pas des fuites.
      if (suf?.toUpperCase() === suffixe) return Number(compte) > 0 ? "fuite" : "sain";
    }
    return "sain";
  } catch {
    return "inconnu";
  }
}

export type ControleMotDePasse =
  | { ok: true; fuiteVerifiee: boolean }
  | { ok: false; error: "mot_de_passe_faible"; raisons: RaisonMotDePasse[] }
  | { ok: false; error: "mot_de_passe_fuite" };

/**
 * Le contrôle complet d'un mot de passe CHOISI : les règles (sans réseau), puis la fuite.
 * `url` : la route appelante, pour le journal si Have I Been Pwned ne répond pas.
 */
export async function controlerNouveauMotDePasse(
  mdp: string, email: string | null | undefined, url: string,
  opts: { fetchImpl?: typeof fetch; journal?: (message: string) => Promise<void> } = {},
): Promise<ControleMotDePasse> {
  const raisons = verifierRegles(mdp, email);
  if (raisons.length) return { ok: false, error: "mot_de_passe_faible", raisons };
  const verdict = await motDePasseFuite(mdp, { fetchImpl: opts.fetchImpl });
  if (verdict === "fuite") return { ok: false, error: "mot_de_passe_fuite" };
  if (verdict === "inconnu") {
    await (opts.journal ?? ((m) => journaliserHibp(m, url)))(
      "Have I Been Pwned injoignable : mot de passe accepté SANS contrôle de fuite",
    );
  }
  return { ok: true, fuiteVerifiee: verdict === "sain" };
}

async function journaliserHibp(message: string, url: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({ user_id: null, source: "hibp", message, url, meta: {} });
    if (error) console.error("[hibp] journal non écrit :", error.message);
  } catch (e) {
    console.error("[hibp] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
