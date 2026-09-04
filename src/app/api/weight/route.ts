export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildWeightPlan, weightModeEligibility, trendVerdict,
  type WeightLog, type EnergyWorkout,
} from "@/lib/weight/energy";
import { weightTrainingRules } from "@/lib/weight/coaching";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

// ─────────────────────────────────────────────────────────────────────────────
//  MODE PERTE DE POIDS — lecture du plan et enregistrement des pesées.
//
//  Tout le calcul reste SERVEUR : le navigateur ne reçoit que des nombres finis, jamais
//  la ligne `profiles` (qui contient `intervals_api_key`). C'est la même raison qui a
//  imposé `stripProfileSecrets` ailleurs — ici on va plus loin : le profil ne sort pas
//  du tout, on n'en renvoie que ce qui est calculé.
//
//  Les lectures passent par le client utilisateur (RLS active) et non par le client
//  admin : une route qui lit avec la clé de service et filtre « à la main » sur un
//  identifiant venu du corps de la requête est exactement la faille trouvée sur quatre
//  routes pendant l'audit.
// ─────────────────────────────────────────────────────────────────────────────

/** Colonnes ajoutées par la migration 018 — absentes tant qu'elle n'est pas passée. */
const MODE_COLS = "weight_mode_enabled, weight_goal_kg";
const BASE_COLS = "age, height_cm, weight_kg, gender, health_conditions";

type ProfileRow = {
  age: number | null; height_cm: number | null; weight_kg: number | null;
  gender: string | null; health_conditions: unknown;
  weight_mode_enabled?: boolean | null; weight_goal_kg?: number | null;
};

/**
 * Profil du mode, en tolérant que la migration 018 soit en retard.
 *
 * PostgREST rejette la requête ENTIÈRE (code 42703) si une seule colonne du `select`
 * n'existe pas encore. Nommer `weight_mode_enabled` avant l'exécution du SQL ferait donc
 * échouer la lecture du profil TOUT ENTIER — l'utilisateur verrait « erreur » là où il
 * fallait lire « migration à exécuter ». On retente sans, et on le signale.
 */
async function fetchProfile(sb: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const full = await sb.from("profiles").select(`${BASE_COLS}, ${MODE_COLS}`).eq("id", userId).single();
  if (!full.error) return { profile: full.data as unknown as ProfileRow, migrated: true };
  const base = await sb.from("profiles").select(BASE_COLS).eq("id", userId).single();
  if (base.error) return { profile: null, migrated: false };
  return { profile: base.data as unknown as ProfileRow, migrated: false };
}

/** Pesées — table absente tant que la migration 018 n'est pas passée. */
async function fetchLogs(sb: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<WeightLog[] | null> {
  const r = await sb.from("weight_logs").select("date, weight_kg, note")
    .eq("user_id", userId).order("date", { ascending: false }).limit(120);
  if (r.error) return null; // table inexistante → on le dira, on ne renverra pas « 0 pesée »
  return (r.data ?? []) as unknown as WeightLog[];
}

async function fetchWorkouts(sb: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<EnergyWorkout[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const cols = "date, type, distance_km, duration_seconds, elevation_gain_m, avg_power_watts";
  const withSport = await sb.from("workouts").select(`${cols}, sport`).eq("user_id", userId).gte("date", since);
  if (!withSport.error) return (withSport.data ?? []) as unknown as EnergyWorkout[];
  const plain = await sb.from("workouts").select(cols).eq("user_id", userId).gte("date", since);
  return (plain.data ?? []) as unknown as EnergyWorkout[];
}

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { profile, migrated } = await fetchProfile(sb, user.id);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const body = {
    weightKg: profile.weight_kg ?? null, heightCm: profile.height_cm ?? null,
    age: profile.age ?? null, gender: profile.gender ?? null,
  };
  const eligibility = weightModeEligibility(body, profile.health_conditions);
  const logs = migrated ? await fetchLogs(sb, user.id) : null;
  const enabled = Boolean(profile.weight_mode_enabled);
  const goalKg = profile.weight_goal_kg != null ? Number(profile.weight_goal_kg) : null;

  // ── SUIVI vs DÉFICIT : deux choses distinctes ──────────────────────────────
  //
  // Tout était derrière l'unique interrupteur `enabled`. Conséquence : un coureur mince
  // qui voulait juste suivre son poids et connaître sa cible protéique devait activer un
  // mode de PERTE de poids ; et le désactiver lui retirait la pesée, la tendance, sa
  // dépense réelle ET ses protéines — précisément ce qui compte le plus en préparation.
  //
  // Désormais : la dépense, les protéines et le suivi de poids sont TOUJOURS calculés
  // dès que le profil le permet. Seul le DÉFICIT dépend d'une activation volontaire et
  // des garde-fous d'éligibilité.
  const applyDeficit = enabled && eligibility.ok;
  const workouts = await fetchWorkouts(sb, user.id);
  const plan = buildWeightPlan({ body, goalKg, logs: logs ?? [], workouts, applyDeficit });
  if (!plan) {
    return NextResponse.json({
      migrated, enabled, goalKg, plan: null, logs: logs ?? [],
      eligibility: { ok: false, reason: "donnees_manquantes", detail: "Âge, taille ou poids manquants : le métabolisme de base n'est pas calculable, et on ne va pas le supposer. Complète ton profil." },
    });
  }

  return NextResponse.json({
    migrated, enabled, eligibility, goalKg, plan, applyDeficit,
    verdict: trendVerdict(plan),
    // Les règles d'entraînement liées au poids n'ont de sens qu'en perte assumée.
    rules: applyDeficit ? weightTrainingRules(plan) : null,
    logs: logs ?? [],
  });
}

type PostBody = { weightKg?: unknown; date?: unknown; note?: unknown; enabled?: unknown; goalKg?: unknown };

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({})) as PostBody;

  // ── Activation / objectif ────────────────────────────────────────────────
  if (b.enabled !== undefined || b.goalKg !== undefined) {
    const patch: Record<string, unknown> = {};

    if (b.enabled !== undefined) {
      const enabled = b.enabled === true;
      if (enabled) {
        // Les garde-fous sont revérifiés SERVEUR : masquer un bouton dans l'interface
        // n'empêche personne d'appeler la route directement.
        const { profile } = await fetchProfile(sb, user.id);
        if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
        const el = weightModeEligibility(
          { weightKg: profile.weight_kg ?? null, heightCm: profile.height_cm ?? null, age: profile.age ?? null, gender: profile.gender ?? null },
          profile.health_conditions,
        );
        if (!el.ok) return NextResponse.json({ error: el.detail, reason: el.reason }, { status: 400 });
      }
      patch.weight_mode_enabled = enabled;
    }

    if (b.goalKg !== undefined) {
      if (b.goalKg === null) patch.weight_goal_kg = null;
      else {
        const g = Number(b.goalKg);
        if (!Number.isFinite(g) || g <= 30 || g >= 300) return NextResponse.json({ error: "Poids cible invalide (30-300 kg)" }, { status: 400 });
        // Un objectif sous IMC 20 est refusé, comme l'est l'activation du mode à IMC 20.
        // Sans cette symétrie, l'app refusait le mode à quelqu'un déjà mince mais acceptait
        // de projeter quelqu'un VERS cette même corpulence — et affichait une échéance pour
        // y arriver. Le garde-fou d'entrée ne servait alors à rien.
        const { profile } = await fetchProfile(sb, user.id);
        const h = profile?.height_cm ?? null;
        if (h) {
          const minKg = Math.ceil(20 * (h / 100) ** 2 * 10) / 10;
          if (g < minKg) {
            return NextResponse.json({
              error: `Pour ta taille (${h} cm), ${g} kg correspond à un IMC inférieur à 20. Le mode ne guide pas vers cette zone : en dessous, la perte se fait sur le muscle et l'os, pas sur la graisse. Le plus bas que l'on accompagne est ${minKg} kg.`,
            }, { status: 400 });
          }
        }
        patch.weight_goal_kg = Math.round(g * 10) / 10;
      }
    }

    const { error } = await sb.from("profiles").update(patch).eq("id", user.id);
    if (error) return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Pesée ────────────────────────────────────────────────────────────────
  const w = Number(b.weightKg);
  if (!Number.isFinite(w) || w <= 30 || w >= 300) {
    return NextResponse.json({ error: "Poids invalide (30-300 kg)" }, { status: 400 });
  }
  const today = aujourdhui(FUSEAU_DEFAUT);
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today;
  // Une pesée dans le futur fausserait la régression : on refuse plutôt que de la ranger
  // silencieusement à aujourd'hui.
  if (date > today) return NextResponse.json({ error: "Date de pesée dans le futur" }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) || null : null;
  const weightKg = Math.round(w * 10) / 10;

  const { error } = await sb.from("weight_logs")
    .upsert({ user_id: user.id, date, weight_kg: weightKg, note }, { onConflict: "user_id,date" });
  if (error) return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });

  // Le profil suit la dernière pesée du jour : c'est lui que lisent le calcul de charge,
  // les zones de puissance et la dépense des séances. Le laisser figé à la valeur de
  // l'inscription faussait toutes les calories des séances suivantes.
  // ⚠️ CET ÉCHEC ÉTAIT MUET, ALORS QUE LE COMMENTAIRE CI-DESSUS DIT CE QU'IL COÛTE :
  // la pesée serait enregistrée, le profil garderait l'ancien poids, et toutes les
  // dépenses de séance suivantes seraient fausses — sans que rien ne l'indique. On le
  // DIT, et on distingue les deux : la pesée du jour, elle, est bel et bien enregistrée.
  let profilAJour = true;
  if (date === today) {
    const { error: eProfil } = await sb.from("profiles").update({ weight_kg: weightKg }).eq("id", user.id);
    if (eProfil) {
      profilAJour = false;
      console.error("[poids] pesée enregistrée mais profil non mis à jour :", eProfil.message);
    }
  }

  return NextResponse.json({ ok: true, date, weightKg, profilAJour });
}

export async function DELETE(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });

  const { error } = await sb.from("weight_logs").delete().eq("user_id", user.id).eq("date", date);
  if (error) return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Une table ou colonne absente = migration 018 non exécutée. On le DIT, au lieu de
 *  laisser remonter un code PostgREST que personne ne sait interpréter. */
function migrationHint(msg: string): string {
  return /does not exist|42P01|42703|schema cache/i.test(msg)
    ? "Le mode perte de poids nécessite la migration 018 (supabase/migrations/018_perte_de_poids.sql), pas encore exécutée sur cette base."
    : msg;
}
