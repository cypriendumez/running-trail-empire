export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { douleursDeclarees } from "@/lib/coach/painZonesI18n";
import { PEREMPTION_JOURS } from "@/lib/health/douleurs";
import { journaliserEchec } from "@/lib/journal/echecServeur";

/**
 * « C'EST PASSÉ » POUR UNE DOULEUR COCHÉE APRÈS UNE SÉANCE (et son annulation).
 *
 * ⚠️ ELLE NE POUVAIT PAS S'ÉTEINDRE (Cyprien, 09/11/2026) : la douleur du ressenti
 * d'après séance pesait sur le plan tant que ce ressenti restait parmi les cinq derniers.
 * On écrit la zone dans `painPasse` de CHAQUE ressenti récent qui la porte : la règle
 * (lib/health/douleursSeance) l'ignore alors, et un ressenti suivant qui la recoche la
 * rouvre. On ne supprime rien : l'historique des ressentis reste intact.
 *
 * ⚠️ ON N'ÉCRIT QUE SUR SES PROPRES LIGNES (filtre `user_id` à chaque requête, en plus de la RLS).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const { zone, annuler } = (await req.json().catch(() => ({}))) as { zone?: unknown; annuler?: unknown };
  const z = String(zone ?? "").trim().slice(0, 24);
  if (!z || douleursDeclarees([z]).length === 0) {
    return NextResponse.json({ ok: false, error: "requete_invalide" }, { status: 400 });
  }

  // Un jour de marge sur la péremption : la date de séance peut précéder la saisie.
  const depuis = new Date(Date.now() - (PEREMPTION_JOURS + 1) * 86400000).toISOString();
  const { data: lignes, error: eLecture } = await supabase.from("notifications").select("id, data")
    .eq("user_id", user.id).eq("type", "session_feedback").gte("created_at", depuis).limit(60);
  if (eLecture) {
    await journaliserEchec(null, { source: "douleur-seance", userId: user.id, url: "/api/health/douleur-seance", message: `Ressentis illisibles, douleur non éteinte : ${eLecture.code ?? "?"} ${eLecture.message}` });
    return NextResponse.json({ ok: false, error: "lecture" }, { status: 500 });
  }
  const cibles = ((lignes ?? []) as { id: string; data: Record<string, unknown> | null }[])
    .filter((l) => douleursDeclarees(l.data?.pain).includes(z));
  if (!cibles.length) return NextResponse.json({ ok: false, error: "introuvable" }, { status: 404 });

  for (const l of cibles) {
    const avant = Array.isArray(l.data?.painPasse) ? (l.data!.painPasse as unknown[]).map(String) : [];
    const painPasse = annuler === true ? avant.filter((x) => x !== z) : [...new Set([...avant, z])];
    // ⚠️ SUPABASE RETOURNE SES ERREURS, IL NE LES LÈVE PAS : c'est `error` qu'on lit.
    const { error } = await supabase.from("notifications").update({ data: { ...(l.data ?? {}), painPasse } })
      .eq("id", l.id).eq("user_id", user.id).eq("type", "session_feedback");
    if (error) {
      await journaliserEchec(null, { source: "douleur-seance", userId: user.id, url: "/api/health/douleur-seance", message: `État d'une douleur d'après séance non enregistré : ${error.code ?? "?"} ${error.message}` });
      return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
    }
  }

  // Le motif des séances est un texte figé dans le plan : sans replanification, l'écran dirait
  // encore « douleur en cours ». Même chemin que /api/health/douleur ; le cron de nuit rattrape
  // un échec. Plan déterministe : aucun appel d'IA pour la séance elle-même.
  const admin = createAdminClient();
  const { data: creds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
    notify: false,
  }).catch((e) => console.error("[santé] replanification après une douleur d'après séance :", e));

  return NextResponse.json({ ok: true, passee: annuler !== true });
}
