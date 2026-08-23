export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { montreDe, lectureDe, type Lecture } from "@/lib/watch/intervals";
import { identifiantsDe } from "@/lib/intervals/identifiants";

const BASE = "https://intervals.icu/api/v1";
const auth = (k: string) => ({ Authorization: "Basic " + Buffer.from(`API_KEY:${k}`).toString("base64") });

/**
 * GET /api/watch/status
 * Renvoie l'état de la connexion montre (intervals.icu → montre du client).
 *  - connected : identifiants intervals.icu valides
 *  - pushReady : « envoyer les entraînements planifiés » est activé pour au moins une montre
 *  - device    : la montre prête
 *  - lecture   : ce qui ARRIVE quand rien ne peut recevoir (appareil, canal, date)
 *
 * ⚠️ `lecture` existe parce qu'une seule réponse couvrait DEUX situations opposées. Un
 * porteur d'Apple Watch ayant payé et installé HealthFit voyait « pastille orange,
 * configure ta montre » : on lui demandait de faire une chose déjà faite — et impossible,
 * Apple n'ayant aucun champ d'envoi chez intervals.icu. Idem pour Polar et Strava.
 * L'appel supplémentaire n'a lieu QUE si aucune montre ne peut recevoir.
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
 *  · ZWIFT en a un, et figure désormais dans la table — mais avec `montre: false`, si bien
 *    que `montreDe` le SAUTE. Il reçoit la séance (la page d'accueil l'annonce sur une
 *    ligne à part), il n'allume pas « ta montre est prête » : ce n'est pas une montre, et
 *    le dire à quelqu'un qui court sur tapis sans rien au poignet serait faux.
 *  · AMAZFIT (`zepp_*`) ET HUAWEI ont été AJOUTÉS le 21/08/2026 après relevé direct de
 *    l'API. Leur absence ne provoquait aucune erreur : la pastille restait orange et la
 *    séance partait au format Garmin, que ces montres ne savent pas lire.
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
  // ⚠️ AUCUN REPLI SUR LES VARIABLES D'ENVIRONNEMENT — voir `lib/intervals/identifiants`.
  // Le `|| process.env.INTERVALS_ICU_*` qui était ici donnait le compte de l'ÉDITEUR à
  // tout athlète qui n'a pas branché sa montre : ses séances partaient sur le poignet
  // de l'éditeur, et il lisait les sorties de l'éditeur comme les siennes.
  const ids = identifiantsDe(profile);
  const ATHLETE_ID = ids?.athleteId;
  const API_KEY = ids?.apiKey;
  if (!ATHLETE_ID || !API_KEY) return NextResponse.json({ connected: false, pushReady: false, device: null });

  try {
    const res = await fetch(`${BASE}/athlete/${ATHLETE_ID}`, { headers: auth(API_KEY), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ connected: false, pushReady: false, device: null });
    const a = await res.json();
    // La table des destinations vit dans `lib/watch/intervals.ts` : la MÊME sert à décider
    // du format de la séance envoyée. Deux copies auraient divergé — c'est précisément
    // comme ça que Suunto était annoncé sur la landing et absent d'ici.
    const ready = montreDe(a);

    // Rien ne peut recevoir : on va voir ce qui ARRIVE, pour ne pas réclamer un réglage
    // qui n'existe pas. Trois semaines suffisent — quelqu'un qui n'a rien synchronisé
    // depuis trois semaines n'a de toute façon pas de flux à décrire.
    let lecture: Lecture | null = null;
    if (!ready) {
      try {
        const jour = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
        const r = await fetch(
          `${BASE}/athlete/${ATHLETE_ID}/activities?oldest=${jour(-21)}&newest=${jour(1)}`,
          { headers: auth(API_KEY), cache: "no-store" },
        );
        if (r.ok) lecture = lectureDe(await r.json());
      } catch { /* l'état de base reste juste sans ce détail */ }
    }

    return NextResponse.json({
      connected: true,
      pushReady: !!ready,
      device: ready?.nom ?? null,
      lastUpload: ready?.dernier ?? null,
      lecture,
    });
  } catch {
    return NextResponse.json({ connected: false, pushReady: false, device: null });
  }
}
