/**
 * CAPTCHA CLOUDFLARE TURNSTILE — la vérification CÔTÉ SERVEUR (08/11/2026).
 *
 * ⚠️ POURQUOI DEUX VÉRIFICATEURS. Supabase sait vérifier Turnstile lui-même (Authentication →
 * Attack Protection), et c'est lui qui protège la CONNEXION (`signInWithPassword` part du
 * navigateur vers GoTrue avec `captchaToken`). Mais l'inscription et « mot de passe oublié » de
 * Pacevo passent par NOS routes, qui appellent GoTrue avec la clé d'administration : GoTrue
 * dispense alors de CAPTCHA (`verifyCaptcha` → `requireAdminCredentials`, v2.197). Ces deux
 * routes vérifient donc le jeton ici, auprès de Cloudflare (`siteverify`).
 *
 * EN SOMMEIL tant que `TURNSTILE_SECRET_KEY` n'est pas posée : verdict `inactif`, rien ne change.
 *
 * ⚠️ CLOUDFLARE INJOIGNABLE = ON LAISSE PASSER, ET ON LE NOTE (verdict `inconnu`). Ces routes
 * ont déjà leurs limites par IP et par adresse ; bloquer toutes les inscriptions parce qu'un tiers
 * est en panne serait pire que le risque. Un jeton absent, faux, expiré ou déjà servi, lui, est
 * TOUJOURS refusé (`refuse`).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type VerdictCaptcha = "inactif" | "ok" | "refuse" | "inconnu";

/**
 * Le contrôle complet d'une route : `refuse` → l'appelant répond 400 `captcha_refuse` ;
 * `inconnu` → accepté, mais noté dans `error_logs` (source `captcha`), jamais en silence.
 */
export async function controlerCaptcha(jeton: unknown, ip: string | null, url: string,
  opts: { secret?: string; fetchImpl?: typeof fetch; journal?: (m: string) => Promise<void> } = {}): Promise<"accepte" | "refuse"> {
  const { verdict, cause } = await examinerCaptcha(jeton, ip, opts);
  if (verdict === "refuse") return "refuse";
  if (verdict === "inconnu") {
    await (opts.journal ?? ((m) => journaliserCaptcha(m, url)))(`Turnstile inutilisable (${cause}) : demande acceptée SANS contrôle anti-robot`);
  }
  return "accepte";
}

async function journaliserCaptcha(message: string, url: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({ user_id: null, source: "captcha", message, url, meta: {} });
    if (error) console.error("[captcha] journal non écrit :", error.message);
  } catch (e) {
    console.error("[captcha] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}

const URL_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Les SEULS codes de Cloudflare qui accusent le JETON du visiteur (absent, faux, expiré, déjà servi) :
 * eux seuls valent un refus. Tout autre code accuse NOTRE configuration ou Cloudflare
 * (`invalid-input-secret`, `missing-input-secret`, `bad-request`, `internal-error`…).
 *
 * ⚠️ RELECTURE DU 08/11/2026 : auparavant, tout code autre que `internal-error` était un refus. Une
 * clé secrète mal collée ou tournée (`invalid-input-secret`) aurait refusé 100 % des inscriptions et
 * des « mot de passe oublié », en disant « vérification anti-robot échouée » comme à un robot, et
 * SANS AUCUNE TRACE. Désormais : on laisse passer, et le code reçu va au journal.
 */
const CODES_JETON = new Set(["missing-input-response", "invalid-input-response", "timeout-or-duplicate"]);

async function examinerCaptcha(
  jeton: unknown,
  ip: string | null,
  opts: { secret?: string; fetchImpl?: typeof fetch; delaiMs?: number } = {},
): Promise<{ verdict: VerdictCaptcha; cause: string }> {
  const secret = opts.secret ?? process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!secret) return { verdict: "inactif", cause: "pas de clé" };
  const reponse = typeof jeton === "string" ? jeton.trim() : "";
  // Cloudflare : un jeton fait au plus 2 048 caractères. Vide ou démesuré = refusé sans appel.
  if (!reponse || reponse.length > 2048) return { verdict: "refuse", cause: "jeton absent" };
  try {
    const corps = new URLSearchParams({ secret, response: reponse });
    if (ip && ip !== "inconnue") corps.set("remoteip", ip);
    const rep = await (opts.fetchImpl ?? fetch)(URL_SITEVERIFY, {
      method: "POST", body: corps, signal: AbortSignal.timeout(opts.delaiMs ?? 5000), cache: "no-store",
    });
    if (!rep.ok) return { verdict: "inconnu", cause: `HTTP ${rep.status}` };
    const j = (await rep.json().catch(() => null)) as { success?: unknown; "error-codes"?: unknown } | null;
    if (j?.success === true) return { verdict: "ok", cause: "" };
    const codes = Array.isArray(j?.["error-codes"]) ? (j?.["error-codes"] as unknown[]).map(String) : [];
    if (codes.length > 0 && codes.every((c) => CODES_JETON.has(c))) return { verdict: "refuse", cause: codes.join(", ") };
    return { verdict: "inconnu", cause: codes.length ? codes.join(", ") : "réponse sans code" };
  } catch (e) {
    return { verdict: "inconnu", cause: e instanceof Error ? e.message.slice(0, 120) : "erreur réseau" };
  }
}

export async function verifierCaptcha(
  jeton: unknown,
  ip: string | null,
  opts: { secret?: string; fetchImpl?: typeof fetch; delaiMs?: number } = {},
): Promise<VerdictCaptcha> {
  return (await examinerCaptcha(jeton, ip, opts)).verdict;
}
