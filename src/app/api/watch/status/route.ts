export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { montreDe } from "@/lib/watch/intervals";

const BASE = "https://intervals.icu/api/v1";
const auth = (k: string) => ({ Authorization: "Basic " + Buffer.from(`API_KEY:${k}`).toString("base64") });

/**
 * GET /api/watch/status
 * Renvoie l'état de la connexion montre (intervals.icu → montre du client).
 *  - connected : identifiants intervals.icu valides
 *  - pushReady : « envoyer les entraînements planifiés » est activé pour au moins une montre
 *  - device    : la montre prête
 *
 * ⚠️ SUUNTO MANQUAIT, et ça se voyait à l'écran. Le Ghost Runner allume une pastille VERTE
 * quand `pushReady` est vrai, ORANGE sinon avec une invitation à configurer sa montre. Un
 * porteur de Suunto ayant activé l'envoi côté intervals.icu voyait donc orange, et un
 * message lui demandant de faire une chose déjà faite.
 *
 * LA LISTE EST CELLE DE L'API intervals.icu, relevée sur un compte réel le 17/08/2026 :
 * les champs `*_upload_workouts` existent pour garmin, coros, wahoo, suunto et zwift.
 *  · POLAR N'EN A PAS — cohérent avec la réponse du développeur d'intervals.icu (23/12/2023,
 *    « l'API Polar ne permet pas d'envoyer des séances planifiées »), encore vraie fin 2025.
 *  · STRAVA N'EN A PAS non plus : c'est un journal d'activités, pas une montre.
 *  · ZWIFT en a un, mais est délibérément absent ici : ce n'est pas une montre, et Pacevo
 *    prescrit de la course à pied. L'ajouter ferait dire « ta montre est prête » à
 *    quelqu'un qui n'en porte pas.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false, pushReady: false, device: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();
  const ATHLETE_ID = profile?.intervals_athlete_id || process.env.INTERVALS_ICU_ATHLETE_ID;
  const API_KEY = profile?.intervals_api_key || process.env.INTERVALS_ICU_API_KEY;
  if (!ATHLETE_ID || !API_KEY) return NextResponse.json({ connected: false, pushReady: false, device: null });

  try {
    const res = await fetch(`${BASE}/athlete/${ATHLETE_ID}`, { headers: auth(API_KEY), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ connected: false, pushReady: false, device: null });
    const a = await res.json();
    // La table des destinations vit dans `lib/watch/intervals.ts` : la MÊME sert à décider
    // du format de la séance envoyée. Deux copies auraient divergé — c'est précisément
    // comme ça que Suunto était annoncé sur la landing et absent d'ici.
    const ready = montreDe(a);
    return NextResponse.json({
      connected: true,
      pushReady: !!ready,
      device: ready?.nom ?? null,
      lastUpload: ready?.dernier ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false, pushReady: false, device: null });
  }
}
