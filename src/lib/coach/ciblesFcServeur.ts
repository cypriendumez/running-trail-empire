/**
 * LES CIBLES DE FC D'UN ATHLÈTE, LUES EN BASE — pour les envois vers la montre qui ne passent
 * pas par le coach (séance attribuée, plan publié, re-push depuis l'admin).
 *
 * ⚠️ LES MÊMES RÈGLES QUE LE COACH (`buildAthleteContext`) : mêmes références (FC max réellement
 * atteinte en 6 mois, déclarée ou réglée sur la montre, FC de repos déclarée sinon celle de la montre, seuil mesuré), mêmes
 * footings (LA même lecture, `lireFootingsFc` + `fcDesFootings`), même calcul (`ciblesFcAthlete`). Sinon
 * une séance re-poussée depuis l'admin partirait avec d'autres battements que celle du coach.
 * Serveur uniquement : client service role.
 */
import { referencesFc, ciblesFcAthlete, premierJourFootingsFc, estTypeDur, maxDeReference, fcMaxSaison, airFroid, PIC_FC_JOURS, FENETRE_SAISON_JOURS, DEMI_FENETRE_AN_DERNIER_JOURS, type CiblesFc, type ReferencesFc, seuilMesure } from "@/lib/coach/fcCible";
import { isRun } from "@/lib/intervals/sport";
import { forecastWeek } from "@/lib/weather/openMeteo";
import { repereDuJourCoureur } from "@/lib/time/fuseau";

type Lecteur = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown): number | null => { const n = Number(v); return v != null && v !== "" && Number.isFinite(n) && n > 0 ? n : null; };

const jour = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Les colonnes d'une séance dont on a besoin pour les footings. */
export const COLONNES_FOOTINGS_FC = "date,type,sport,duration_seconds,avg_hr";
/**
 * LA lecture des footings qui calent les cibles de FC, pour le coach ET la montre : toutes les
 * séances de la fenêtre (`premierJourFootingsFc`, 60 jours), les plus récentes d'abord.
 * ⚠️ Le coach les prenait dans ses 60 DERNIÈRES SÉANCES tous sports : chez un coureur qui fait
 * aussi du vélo (62 sorties récentes), il n'en voyait plus aucun et retenait des cibles théoriques
 * (136-146 bpm) quand la montre, sur 60 jours, calait 119-129 sur ses vrais footings (@HeadCoach,
 * 17/11/2026). L'appelant lit `error` : une panne n'est pas « aucun footing ».
 */
export function lireFootingsFc(sb: Lecteur, userId: string, maintenant = repereDuJourCoureur()) {
  return sb.from("workouts").select(COLONNES_FOOTINGS_FC).eq("user_id", userId)
    .gte("date", premierJourFootingsFc(maintenant)).order("date", { ascending: false }).limit(200);
}
/**
 * La FC moyenne des footings retenus : course, au moins 20 minutes, type non dur (`estTypeDur`),
 * dans la fenêtre. Le filtre de date est rejoué ici, pour un appelant qui passe d'autres séances.
 */
export function fcDesFootings(
  seances: readonly { date?: string | null; type?: string | null; sport?: string | null; duration_seconds?: unknown; avg_hr?: unknown }[],
  maintenant = repereDuJourCoureur(),
): number[] {
  const debut = premierJourFootingsFc(maintenant);
  return seances
    .filter((w) => String(w.date ?? "").slice(0, 10) >= debut && isRun(w.sport ?? null) && !estTypeDur(w.type) && (num(w.duration_seconds) ?? 0) >= 20 * 60)
    .map((w) => num(w.avg_hr)).filter((v): v is number => v != null);
}

/**
 * Les deux pics de la FC max de saison (`fcMaxSaison`) : 6 dernières semaines, et les mêmes
 * semaines l'an dernier (± 3 semaines autour de la date d'il y a un an). `null` si une lecture
 * échoue — on garde alors la référence, jamais un pic à moitié lu.
 */
export async function picsSaison(sb: Lecteur, userId: string, maintenant = repereDuJourCoureur()): Promise<{ recent: number | null; anDernier: number | null } | null> {
  try {
    const pic = (depuis: string, jusque?: string) => {
      let q = sb.from("workouts").select("max_hr").eq("user_id", userId).not("max_hr", "is", null).gte("date", depuis);
      if (jusque) q = q.lte("date", jusque);
      return q.order("max_hr", { ascending: false }).limit(1).maybeSingle();
    };
    const ilYaUnAn = maintenant - 365 * 86400000;
    const [recent, anDernier] = await Promise.all([
      pic(jour(maintenant - FENETRE_SAISON_JOURS * 86400000)),
      pic(jour(ilYaUnAn - DEMI_FENETRE_AN_DERNIER_JOURS * 86400000), jour(ilYaUnAn + DEMI_FENETRE_AN_DERNIER_JOURS * 86400000)),
    ]);
    if (recent.error || anDernier.error) return null;
    return { recent: num((recent.data as { max_hr?: unknown } | null)?.max_hr), anDernier: num((anDernier.data as { max_hr?: unknown } | null)?.max_hr) };
  } catch {
    return null;
  }
}

/** Les références, avec la FC max ramenée à celle de la SAISON quand on sait l'estimer. */
export function avecSaison(refs: ReferencesFc, pics: { recent: number | null; anDernier: number | null } | null, froid = false): ReferencesFc {
  if (refs.source !== "mesures" || !pics) return refs;
  const saison = fcMaxSaison(refs.max, pics.recent, pics.anDernier, froid);
  return saison != null && saison !== refs.max ? { ...refs, max: saison } : refs;
}

export async function ciblesFcPour(sb: Lecteur, userId: string, maintenant = repereDuJourCoureur()): Promise<CiblesFc | null> {
  try {
    const [profil, base, fcMax, footings] = await Promise.all([
      sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
      sb.from("performance_baselines").select("*").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("workouts").select("max_hr").eq("user_id", userId).not("max_hr", "is", null)
        .gte("date", new Date(maintenant - PIC_FC_JOURS * 86400000).toISOString().slice(0, 10))
        .order("max_hr", { ascending: false }).limit(1).maybeSingle(),
      // LA lecture des footings, la même que le coach (`lireFootingsFc`).
      lireFootingsFc(sb, userId, maintenant),
    ]);
    // Supabase RETOURNE son erreur : une lecture ratée ne doit pas fabriquer des cibles.
    if (profil.error || base.error || fcMax.error || footings.error) return null;
    const p = (profil.data ?? null) as Record<string, unknown> | null;
    const b = (base.data ?? null) as Record<string, unknown> | null;
    const garmin = (p?.garmin_metrics ?? null) as Record<string, unknown> | null;
    const refs0 = referencesFc({
      maxDeclaree: maxDeReference(num(b?.max_hr) ?? num(p?.max_hr), garmin?.maxHR),
      maxObservee: num((fcMax.data as { max_hr?: unknown } | null)?.max_hr),
      repos: num(b?.resting_hr) ?? num(p?.resting_hr) ?? num(garmin?.restingHR),
      // 12/11/2026 : la MÊME source de seuil que le coach (test, puis montre).
      seuil: seuilMesure(b?.lt_hr, garmin?.lthr),
    });
    const fcs = fcDesFootings((footings.data ?? []) as Parameters<typeof fcDesFootings>[0], maintenant);
    // La FC max de la SAISON (lib/coach/fcCible, `fcMaxSaison`) : en hiver, des zones calées
    // sur le pic de l'été sont trop hautes.
    // L'air froid chez lui (prévisions à sa dernière position) : sans hiver enregistré, −5 bpm.
    const lat = num(p?.last_lat), lon = num(p?.last_lon);
    const froid = lat != null && lon != null ? airFroid(await forecastWeek(lat, lon).catch(() => [])) : false;
    const refs = avecSaison(refs0, await picsSaison(sb, userId, maintenant), froid);
    return ciblesFcAthlete(refs, fcs);
  } catch {
    return null;
  }
}
