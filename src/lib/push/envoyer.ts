import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { EDITEUR } from "@/lib/brand/editeur";

/**
 * ENVOI D'UNE NOTIFICATION PUSH À UN ATHLÈTE — LA PORTE UNIQUE.
 *
 * ⚠️ BEST EFFORT, JAMAIS D'EXCEPTION. Une notification qui ne part pas ne doit jamais faire
 * tomber l'action qu'elle accompagne (plan prêt, séance recalculée…). Comme pour l'e-mail,
 * on ne lève pas ici.
 *
 * ⚠️ SANS CLÉS VAPID, ON NE FAIT RIEN. Tant que `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et
 * `VAPID_PRIVATE_KEY` ne sont pas posées sur l'hébergement, le push est simplement inactif —
 * pas d'erreur, pas de crash. Le jour où elles existent, ça s'allume sans toucher au code.
 *
 * ⚠️ ON NETTOIE LES ABONNEMENTS MORTS. Un navigateur désinstallé ou une permission révoquée
 * renvoie 404/410 : on supprime l'abonnement pour ne pas réessayer indéfiniment (et ne pas
 * gonfler la table d'endpoints fantômes).
 */
export type ChargePush = { title: string; body: string; url?: string; tag?: string };

function configurer(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  try {
    // Le « sujet » VAPID est un contact joignable exigé par la spec. On le tire de l'identité
    // unique de l'éditeur (jamais recopié en dur — un test l'interdit).
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${EDITEUR.email}`, pub, priv);
    return true;
  } catch {
    return false; // clés mal formées : on désactive plutôt que de planter
  }
}

export async function envoyerPush(userId: string, charge: ChargePush): Promise<{ envoyes: number; morts: number }> {
  if (!userId || !configurer()) return { envoyes: 0, morts: 0 };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !data?.length) return { envoyes: 0, morts: 0 };

  const payload = JSON.stringify({
    title: charge.title,
    body: charge.body,
    url: charge.url ?? "/dashboard",
    tag: charge.tag,
  });

  let envoyes = 0, morts = 0;
  await Promise.all(
    data.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          payload,
        );
        envoyes++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410 : l'abonnement n'existe plus côté navigateur → on le retire.
        if (code === 404 || code === 410) {
          morts++;
          // On lit l'erreur du ménage : si elle échoue, on le sait (sinon on réessaierait
          // d'écrire à un endpoint mort à chaque envoi, en silence).
          const { error: eSuppr } = await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint as string);
          if (eSuppr) console.error("[push] suppression d'un abonnement mort échouée :", eSuppr.message);
        }
      }
    }),
  );
  return { envoyes, morts };
}
