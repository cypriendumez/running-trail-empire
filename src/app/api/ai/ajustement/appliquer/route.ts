export const dynamic = "force-dynamic";
// La replanification attend la relecture du coach avancé (≤ 8 s) et l'envoi de cinq jours à
// la montre : la durée par défaut d'une fonction ne suffirait pas toujours.
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigeAcces } from "@/lib/billing/guard";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { TYPE_PROPOSITION, type Ajustement } from "@/lib/ai/ajustement";
import { TYPE_AJUSTEMENTS, type AjustementApplique } from "@/lib/coach/ajustementApplique";

/**
 * « APPLIQUER » — LA PROPOSITION DE « UN AVIS SUR MA SEMAINE » DEVIENT RÉELLE (Premium).
 *
 * Cyprien, 30/10/2026 : « la séance est réellement modifiée, puis envoyée à la montre,
 * toujours dans les limites de sécurité du moteur ».
 *
 * ⚠️ RIEN N'EST PRIS AU NAVIGATEUR. La route relit la proposition que le serveur a lui-même
 * validée et mémorisée (`TYPE_PROPOSITION`), et le plan RÉEL en base. Un appel forgé ne peut
 * donc ni inventer un déplacement, ni viser un jour que le plan ne porte pas.
 *
 * ⚠️ LE MOTEUR APPLIQUE, PAS CETTE ROUTE. Elle enregistre l'ajustement, puis relance le
 * coach : c'est lui qui le réapplique à chaque reconstruction du plan, avec ses garde-fous
 * (deux séances dures d'affilée, jour où l'athlète ne court pas, budget qualité nul), qui
 * publie le calendrier et qui envoie la séance à la montre. La route relit ensuite le plan :
 * si le moteur a refusé, l'ajustement est retiré et l'athlète l'apprend — on ne lui dit pas
 * « c'est fait » sur une séance qui n'a pas bougé.
 *
 * Aucun appel de modèle ici : la proposition a déjà été payée. Le plafond quotidien n'est
 * donc pas décompté ; seule la formule est vérifiée.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const refus = await exigeAcces(supabase, user.id, "plan_ia");
  if (refus) return refus.reponse;

  const admin = createAdminClient();

  // ── 1. La proposition mémorisée par le serveur ─────────────────────────────
  const { data: memo, error: eMemo } = await admin.from("notifications").select("data")
    .eq("user_id", user.id).eq("type", TYPE_PROPOSITION).maybeSingle();
  if (eMemo) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  const aj = (memo?.data as { ajustement?: Ajustement } | null)?.ajustement;
  if (!aj || aj.action === "rien" || !aj.date) {
    return NextResponse.json({ ok: false, error: "aucune_proposition" }, { status: 409 });
  }
  const jours = [aj.date, ...(aj.vers ? [aj.vers] : [])];

  // ── 2. Le plan réel de ces jours ───────────────────────────────────────────
  const lireTypes = async (): Promise<Record<string, string[]> | null> => {
    const { data, error } = await admin.from("notifications").select("data")
      .eq("user_id", user.id).eq("type", "coach_session").in("data->>date", jours);
    if (error) return null;
    const t: Record<string, string[]> = {};
    for (const l of data ?? []) {
      const d = l.data as { date?: string; sessionType?: string } | null;
      if (d?.date) (t[d.date] ??= []).push(String(d.sessionType ?? ""));
    }
    return t;
  };
  const avant = await lireTypes();
  if (!avant) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  // Un jour absent (plan changé depuis la proposition) ou doublé (matin + soir) ne se déplace pas.
  if (jours.some((j) => (avant[j]?.length ?? 0) !== 1)) {
    return NextResponse.json({ ok: false, error: "plan_change" }, { status: 409 });
  }
  const types = Object.fromEntries(jours.map((j) => [j, avant[j][0]]));

  // ── 3. Enregistrer l'ajustement ────────────────────────────────────────────
  const nouveau: AjustementApplique = {
    date: aj.date, action: aj.action, ...(aj.vers ? { vers: aj.vers } : {}), types, appliqueLe: new Date().toISOString(),
  };
  const { data: ligne, error: eLigne } = await admin.from("notifications").select("id, data")
    .eq("user_id", user.id).eq("type", TYPE_AJUSTEMENTS).maybeSingle();
  if (eLigne) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  // Un ajustement plus ancien sur les mêmes jours est remplacé : le dernier choix de l'athlète fait foi.
  const anciens = (((ligne?.data ?? null) as { ajustements?: AjustementApplique[] } | null)?.ajustements ?? [])
    .filter((a) => ![a.date, a.vers].some((d) => d && jours.includes(d)));
  const ecrire = (liste: AjustementApplique[]) => ligne?.id
    ? admin.from("notifications").update({ data: { ajustements: liste } }).eq("id", ligne.id)
    : admin.from("notifications").insert({ user_id: user.id, type: TYPE_AJUSTEMENTS, title: "ajustements", body: "", read: true, data: { ajustements: liste } });
  const { error: eEcriture } = await ecrire([...anciens, nouveau]);
  if (eEcriture) {
    console.error("[ajustement] non enregistré :", eEcriture.message);
    return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  }

  // ── 4. Replanifier tout de suite : le moteur applique, publie, envoie à la montre ──
  const { data: creds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
    notify: false, // l'athlète vient d'agir : pas d'e-mail pour le lui annoncer
  }).catch((e) => console.error("[ajustement] replanification :", e));

  // ── 5. Relire : la séance a-t-elle VRAIMENT changé ? ───────────────────────
  const apres = await lireTypes();
  const seul = (j: string) => (apres?.[j]?.length === 1 ? apres[j][0] : null);
  const tenu = aj.action === "alleger"
    ? seul(aj.date) === "Récup"
    : !!aj.vers && seul(aj.date) === types[aj.vers] && seul(aj.vers) === types[aj.date];
  if (!tenu) {
    // Le moteur l'a refusé (ou n'a pas pu replanifier) : on le retire, on ne promet rien.
    const { error } = await ecrire(anciens);
    if (error) console.error("[ajustement] refusé, mais non retiré :", error.message);
    return NextResponse.json({ ok: false, error: "ajustement_refuse" }, { status: 422 });
  }

  // ── 6. La proposition est consommée : un second clic n'appliquerait rien deux fois ──
  const { error: eConso } = await admin.from("notifications").delete().eq("user_id", user.id).eq("type", TYPE_PROPOSITION);
  if (eConso) console.error("[ajustement] proposition non consommée :", eConso.message);
  return NextResponse.json({ ok: true });
}
