"use client";
import { useT } from "@/lib/i18n/LanguageProvider";
import { ATTRIBUTION_GARMIN } from "./attributionI18n";

/**
 * ATTRIBUTION GARMIN — une OBLIGATION, pas une politesse.
 *
 * Pacevo lit ses données via l'API d'intervals.icu, dont les conditions (publiées le
 * 23/10/2025 sur forum.intervals.icu, sujet 114087) autorisent explicitement l'usage
 * commercial — et posent UNE contrepartie, à l'article 1.1 :
 *
 *   « if your application displays information derived from Garmin-sourced data, you
 *     must display attribution to Garmin in the form and manner required by Garmin's
 *     brand guidelines. »
 *
 * Or presque toute activité affichée par Pacevo vient d'une Garmin, et rien ne
 * l'attribuait nulle part. C'était donc une utilisation en dehors des conditions du seul
 * service dont dépend tout le produit — le genre de manquement qu'un acheteur relève.
 *
 * ── POURQUOI CETTE FORMULATION EXACTEMENT ────────────────────────────────────
 * Elle n'est pas de moi. Interrogé sur le cas des données de bien-être, dont on ne peut
 * pas toujours savoir si elles viennent de Garmin, David (l'auteur d'intervals.icu) a
 * répondu que son propre site affiche « Charts may include data from Garmin devices »
 * « regardless of the source of the data », et que c'est ce qu'il recommande. On reprend
 * donc mot pour mot une mention validée par l'éditeur de l'API, plutôt que d'en inventer
 * une qui aurait l'air juste.
 *
 * ⚠️ La mention doit rester sur TOUTE vue qui affiche des activités ou du bien-être. Un
 * test (`tests/chiffres.test.ts`) vérifie que les pages concernées l'importent encore.
 */
export function AttributionGarmin({ className = "" }: { className?: string }) {
  const { lang } = useT();
  return (
    <p className={`text-center text-[11px] leading-relaxed text-zinc-400 ${className}`}>
      {ATTRIBUTION_GARMIN[lang] ?? ATTRIBUTION_GARMIN.fr}
    </p>
  );
}
