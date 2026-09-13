/**
 * L'UNIQUE PORTE DE SORTIE DES E-MAILS.
 *
 * ⚠️ IL Y AVAIT ONZE APPELS DIRECTS À L'API RESEND, ET AUCUN NE LISAIT LA RÉPONSE. Chacun
 * enveloppait son `fetch` dans un `try {} catch {}` vide : un refus de Resend (403 sur le
 * domaine de test, 422 sur une adresse, 429 sur le quota) disparaissait sans trace, et la
 * route répondait « ok » à l'athlète. C'est ainsi qu'un abonné inscrit le 10/09/2026 n'a
 * jamais reçu son accusé — et que personne ne l'a su pendant deux jours.
 *
 * Désormais tout envoi passe ici : le statut est lu, la raison donnée par Resend est
 * conservée, et tout échec — refus, réseau, clé absente — est écrit dans `error_logs`,
 * le journal que /admin affiche déjà, avec une `source` qui dit quelle fonction envoyait.
 * L'appelant reçoit un résultat explicite et décide quoi en faire ; il ne peut plus ne
 * pas savoir. Un test refuse tout `api.resend.com` en dehors de ce fichier.
 *
 * BEST EFFORT reste la règle côté appelant : un e-mail qui ne part pas n'annule jamais
 * l'action qu'il accompagne (inscription, objectif, ressenti…). Ici, on ne lève jamais.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const RESEND = "https://api.resend.com/emails";

/**
 * L'expéditeur de secours de Resend. ⚠️ Il ne livre qu'à l'adresse du propriétaire du
 * compte — c'est un domaine de TEST. En production, `RESEND_FROM` doit porter un domaine
 * vérifié (`pacevo.fr` depuis le 13/09/2026) ; ce repli n'existe que pour ne pas casser
 * un environnement de développement.
 */
export const EXPEDITEUR_SECOURS = "Pacevo <onboarding@resend.dev>";

export type Message = {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  /** Adresse de réponse : l'expéditeur n'est pas une boîte qui reçoit. */
  reply_to?: string;
  bcc?: string[];
  headers?: Record<string, string>;
  /** Expéditeur explicite ; sinon `RESEND_FROM`, sinon le secours. */
  from?: string;
};

export type Resultat = { ok: true; id: string | null } | { ok: false; erreur: string };

export type Options = {
  /** Délai maximal (ms). 10 s par défaut : au-delà, la route répondrait trop tard. */
  delaiMs?: number;
  /** Athlète concerné, pour retrouver l'échec dans le journal. */
  userId?: string | null;
  /** Route ou fonction appelante, pour le journal. */
  url?: string;
  /** Tout ce qui aide à comprendre l'échec après coup (adresse, langue…). Jamais la clé. */
  meta?: Record<string, unknown>;
};

/**
 * Écrit l'échec dans `error_logs`. Ne lève jamais : le journal d'un envoi raté ne doit pas
 * faire tomber la route qui l'a tenté. Un échec d'écriture est signalé sur la console —
 * c'est le seul endroit qui reste.
 */
async function journaliser(source: string, message: string, o: Options | undefined, from: string | undefined) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("error_logs").insert({
      user_id: o?.userId ?? null,
      source: source.slice(0, 24),
      message: message.slice(0, 2000),
      url: o?.url ?? null,
      meta: { ...(o?.meta ?? {}), from },
    });
    if (error) console.error(`[email:${source}] journal non écrit :`, error.message);
  } catch (e) {
    console.error(`[email:${source}] journal non écrit :`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Envoie un e-mail par Resend et rend un résultat explicite.
 *
 * @param source Qui envoie (« newsletter », « ressenti », « compta »…) : c'est la clé de
 *               tri du journal, 24 caractères maximum.
 */
export async function envoyerEmail(source: string, m: Message, o?: Options): Promise<Resultat> {
  const cle = process.env.RESEND_API_KEY;
  const from = m.from ?? process.env.RESEND_FROM ?? EXPEDITEUR_SECOURS;
  const dest = m.to.join(", ");

  if (!cle) {
    const erreur = "RESEND_API_KEY absente";
    await journaliser(source, `E-mail non envoyé à ${dest} : variables manquantes (${erreur})`, o, from);
    return { ok: false, erreur };
  }

  try {
    const r = await fetch(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, from }),
      signal: AbortSignal.timeout(o?.delaiMs ?? 10000),
    });
    if (!r.ok) {
      // Le corps de Resend dit POURQUOI (« domain is not verified », « only send to your
      // own address », « rate limit »…) : c'est lui qu'on veut relire, sans la clé.
      const corps = await r.text().catch(() => "");
      const erreur = `Resend HTTP ${r.status} — ${corps.slice(0, 300)}`;
      await journaliser(source, `E-mail non envoyé à ${dest} : ${erreur}`, o, from);
      return { ok: false, erreur };
    }
    const j = (await r.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: j?.id ?? null };
  } catch (e) {
    const erreur = `envoi impossible (réseau ou délai) — ${e instanceof Error ? e.message : String(e)}`;
    await journaliser(source, `E-mail non envoyé à ${dest} : ${erreur}`, o, from);
    return { ok: false, erreur };
  }
}
