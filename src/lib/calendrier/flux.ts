/**
 * Le flux d'un abonnement de calendrier : du jeton au texte iCalendar.
 *
 * ⚠️ UNE LECTURE RATÉE NE SERT JAMAIS UN CALENDRIER VIDE. Pour Apple ou Google, un flux vide
 * veut dire « plus aucune séance » : ils effaceraient tout l'agenda du coureur jusqu'à la
 * relecture suivante. Sur une erreur de base, on répond 503 : l'application garde ce qu'elle
 * avait et réessaie plus tard. L'échec est écrit dans `error_logs`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { construireIcs, type SeanceFlux } from "./ics";
import { empreinteJeton, jetonDuChemin } from "./jeton";
import { normLang } from "@/lib/i18n/base";
import { journaliserEchec, journaliserEchecUneFois } from "@/lib/journal/echecServeur";

/** Jours passés gardés dans l'agenda : l'historique récent ne disparaît pas d'un coup. */
export const JOURS_PASSES = 60;

type Ligne = { title?: string | null; body?: string | null; data?: Record<string, unknown> | null };

/**
 * Une ligne `coach_session` → la séance du calcul, en FRANÇAIS (le texte canonique). Aucun de ces
 * textes n'est écrit dans le calendrier (lib/calendrier/ics : liste blanche). Le « pourquoi » du
 * coach et les traductions ne sont même pas lus.
 */
export function versSeanceFlux(ligne: Ligne): SeanceFlux {
  const d = (ligne.data ?? {}) as { date?: string; moment?: string; sessionType?: string; subtitle?: string; tags?: string[] };
  return {
    date: String(d.date ?? ""),
    moment: d.moment === "matin" || d.moment === "soir" ? d.moment : null,
    type: String(d.sessionType ?? ""),
    titre: String(ligne.title ?? ""),
    texte: String(d.subtitle || ligne.body || ""),
    tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
  };
}

export type ReponseFlux = { statut: 200; ics: string } | { statut: 404 | 503 };

function jourIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function lireFlux(admin: SupabaseClient, segment: string, maintenant: Date): Promise<ReponseFlux> {
  const jeton = jetonDuChemin(segment);
  if (!jeton) return { statut: 404 };

  const { data: abo, error: eAbo } = await admin.from("calendrier_abonnements")
    .select("user_id, derniere_lecture").eq("jeton_empreinte", empreinteJeton(jeton)).maybeSingle();
  // Table absente (migration 042 pas encore passée) : aucun lien n'a pu être créé, donc rien à
  // servir — un 404 silencieux, pas une alerte par agenda et par heure.
  if (eAbo && (eAbo.code === "42P01" || eAbo.code === "PGRST205")) return { statut: 404 };
  if (eAbo) {
    await journaliserEchec(admin, { source: "calendrier", url: "/api/calendrier/flux", message: `Abonnement illisible : ${eAbo.code ?? "?"} ${eAbo.message}` });
    return { statut: 503 };
  }
  if (!abo) return { statut: 404 };
  const userId = String((abo as { user_id: string }).user_id);

  // La langue des LIBELLÉS (« Footing », « Easy run ») : illisible, on écrit en français.
  const { data: profil, error: eProfil } = await admin.from("profiles").select("preferred_language").eq("id", userId).maybeSingle();
  if (eProfil) await journaliserEchec(admin, { source: "calendrier", userId, url: "/api/calendrier/flux", message: `Langue illisible, flux en français : ${eProfil.code ?? "?"} ${eProfil.message}` });
  const lang = normLang((profil as { preferred_language?: string } | null)?.preferred_language ?? "fr");

  const depuis = jourIso(new Date(maintenant.getTime() - JOURS_PASSES * 86400000));
  const { data: lignes, error: eSeances } = await admin.from("notifications")
    .select("title, body, data, created_at")
    .eq("user_id", userId).eq("type", "coach_session").gte("data->>date", depuis)
    // Les plus RÉCENTES d'abord : une borne qui couperait couperait l'ancien, pas le plan à venir.
    .order("created_at", { ascending: false }).limit(500);
  if (eSeances) {
    await journaliserEchec(admin, { source: "calendrier", userId, url: "/api/calendrier/flux", message: `Séances illisibles, flux non servi : ${eSeances.code ?? "?"} ${eSeances.message}` });
    return { statut: 503 };
  }

  // Dernière lecture, au plus une écriture par heure : elle dit au coureur que son agenda
  // relit bien le flux. Au mieux : un échec ici ne prive pas l'agenda de ses séances.
  const derniere = (abo as { derniere_lecture?: string | null }).derniere_lecture;
  if (!derniere || maintenant.getTime() - new Date(derniere).getTime() > 3600000) {
    const { error: eLecture } = await admin.from("calendrier_abonnements").update({ derniere_lecture: maintenant.toISOString() }).eq("user_id", userId);
    // Une fois par jour au plus : l'agenda relit toutes les heures, et l'échec n'empêche rien.
    if (eLecture) await journaliserEchecUneFois(admin, { source: "calendrier", userId, url: "/api/calendrier/flux", message: `Dernière lecture non écrite : ${eLecture.code ?? "?"} ${eLecture.message}` });
  }

  // ⚠️ La réécriture du plan (lib/ai/autoCoach) purge l'avenir PUIS réinsère, sans transaction :
  // une relecture tombée entre les deux verrait un avenir vide. La fenêtre dure le temps d'un
  // aller-retour en base, et l'agenda se corrige à la relecture suivante ; on ne la ferme pas ici
  // (un 503 sur « aucune séance à venir » bloquerait pour de bon un coureur sans plan).
  // Remis dans l'ordre d'écriture : à doublon `date#moment`, la dernière écrite l'emporte.
  const seances = (lignes ?? []).slice().reverse().map((l) => versSeanceFlux(l as Ligne));
  return { statut: 200, ics: construireIcs(seances, { graine: userId, lang, maintenant }) };
}
