"use client";

import { useState, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Utensils, AlertTriangle, Phone, Loader2, Scale, Activity, ChevronDown, Moon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SEUIL_DOULEUR_DECLAREE } from "@/lib/health/seuilDouleur";
import { NutritionCourse } from "@/components/health/NutritionCourse";
import type { CourseNutri } from "@/lib/health/coursesNutrition";
import { WeightMode } from "@/components/health/WeightMode";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { SuiviZone, Tendance } from "@/lib/health/douleurs";
import { fichesPour, ANNUAIRE_KINE } from "@/lib/health/fichesKine";
import { JOURS_AVANT_CONSULTER, type ChargeAvant, type DouleurUnifiee } from "@/lib/health/santeDouleurs";
import type { ConsignesKine } from "@/lib/health/consignesKine";
import Link from "next/link";
import { Recuperation } from "@/components/health/Recuperation";
import type { DonneesRecup } from "@/lib/health/recuperation";

// ── i18n local (5 langues) — la page Santé naît traduite. ───────────────────────
type Tr = (k: string, p?: Record<string, string | number>) => string;
function fill(s: string, p?: Record<string, string | number>) {
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s;
}
const H: Record<string, Record<string, string>> = {
  fr: {
    "h.enPanne": "Tes douleurs déclarées n'ont pas pu être chargées. Cet historique paraît vide, mais rien n'est perdu — réessaie dans un instant.", "h.title": "Santé et performance", "h.subtitle": "Tes douleurs suivies, ta nutrition de course et ton poids — au même endroit.",
    "tab.kine": "Douleurs", "k.declarer": "Enregistrer cette douleur", "k.seuil": "En dessous de 4/10, une gêne légère ne modifie pas ton plan : rien n'est enregistré.", "k.declOk": "Douleur enregistrée : ton plan réduit l'intensité.", "k.declErr": "Douleur non enregistrée, réessaie dans un instant.", "k.avisTitre": "Pacevo n'est pas un professionnel de santé", "k.pese": "Ce qui pèse sur ton plan aujourd'hui", "k.peseAucune": "Aucune douleur ne pèse sur ton plan. Si tu as mal, déclare-la sur le schéma ou dans ton ressenti d'après séance.", "k.srcSeance": "signalée après une séance", "k.effets": "Ce que ton coach a changé", "k.effetQualite": "{n} séance(s) de qualité retirée(s) cette semaine", "k.effetLongue": "Sortie longue réduite de {a} à {b} km", "k.effetLignes": "Footings sans accélérations ni lignes droites", "k.effetsAttente": "Ton plan sera recalculé avec cette douleur à la prochaine synchronisation.", "k.consulterDuree": "Cette douleur dure depuis {n} jours ou plus : fais-la voir à un médecin ou à un masseur-kinésithérapeute.", "k.consulterPire": "Tu indiques qu'elle s'aggrave : fais-la voir à un médecin ou à un masseur-kinésithérapeute.", "k.charge": "Les 2 semaines avant le début de cette douleur : {a} km courus, contre {b} km les 2 semaines d'avant ({p}).", "k.chargeSeule": "Les 2 semaines avant le début de cette douleur : {a} km courus.", "k.chargeArret": "Tu n'avais pas couru les 2 semaines avant le début de cette douleur ({b} km les 2 semaines d'avant) : elle est apparue à la reprise.", "k.chargeAide": "Un chiffre d'entraînement à montrer à ton kiné. Il n'explique pas à lui seul une douleur.", "k.consignes": "Les consignes de ton kiné", "k.consignesAide": "Ton kinésithérapeute t'a donné un cadre ? Recopie-le : ton plan s'y tient jusqu'à la date indiquée. Pacevo ne fixe pas ces consignes, il les applique.", "k.consDuree": "Durée maximale d'une sortie (min)", "k.consSeances": "Sorties de course par semaine, au maximum", "k.consSansIntensite": "Pas d'intensité (ni seuil, ni VMA, ni côtes)", "k.consJusqu": "Jusqu'au", "k.consEnregistrer": "Appliquer à mon plan", "k.consRetirer": "Retirer ces consignes", "k.consOk": "Consignes appliquées : ton plan a été recalculé.", "k.consRetirees": "Consignes retirées : ton plan a été recalculé.", "k.consActives": "En vigueur jusqu'au {d}.", "k.consAttente": "Consignes enregistrées : ton plan en tiendra compte à son prochain recalcul.", "k.consRetireesAttente": "Consignes retirées : ton plan en tiendra compte à son prochain recalcul.", "k.consErr.duree": "La durée doit être un nombre de minutes entre 15 et 240.", "k.consErr.seances": "Le nombre de sorties doit être entre 1 et 7.", "k.consErr.date": "Choisis une date de fin dans les 6 prochains mois.", "k.consErr.vide": "Indique au moins une consigne.", "k.carnet": "Préparer mon carnet pour le rendez-vous", "k.carnetAide": "Tes douleurs, ta charge et tes dernières séances sur une page, à imprimer ou à enregistrer en PDF.", "k.kineAnnuaire": "Trouver un masseur-kinésithérapeute en France (annuaire de l'Ordre)", "k.fiches": "Fiches de prévention", "k.ficheSignee": "Relue et signée en français par {nom}, masseur-kinésithérapeute (RPPS {rpps}), le {d}.", "k.ficheRemuneree": "Relecture rémunérée par Pacevo.", "k.ficheRegion": "Région que tu as signalée", "k.ficheAvert": "Information générale, la même pour tous les coureurs : elle ne remplace pas une consultation et n'est pas adaptée à ta douleur.", "k.avis": "Une douleur déclarée allège ton plan (moins d'intensité) le temps qu'elle passe. Pacevo ne pose aucun diagnostic et ne propose aucun soin : pour savoir ce que tu as et comment le soigner, consulte un médecin ou un masseur-kinésithérapeute.", "k.alerte": "Consulte sans attendre si la douleur t'empêche de marcher, te réveille la nuit, s'accompagne d'un gonflement, d'une rougeur ou de fièvre, ou s'aggrave malgré le repos. En cas d'urgence : 15 ou 112.", "tab.recup": "Récupération", "tab.nutrition": "Nutrition", "tab.poids": "Poids",
    "k.where": "Où as-tu mal ?", "view.face": "Face", "view.dos": "Dos",
    "k.hint": "Touche une zone sur le corps ou dans la liste, ajuste l'intensité, puis enregistre-la : ton plan s'adapte.",
    "k.pain": "Douleur", "k.painLight": "Gêne légère", "k.painHard": "Très douloureux",
    "k.noZone": "Aucune zone sélectionnée",
    "k.suivi": "Suivi de tes douleurs", "k.seance": "Signalées après tes séances", "k.seanceAide": "Cochées dans ton ressenti d'après séance. Le coach en tient compte 14 jours, ou jusqu'à ce que tu dises « c'est passé ».", "k.suiviNone": "Aucune douleur déclarée ces 60 derniers jours.", "k.suiviSince": "depuis {n} j", "k.suiviToday": "aujourd'hui", "k.suiviAgo": "il y a {n} j", "trend.amelioration": "en amélioration", "trend.aggravation": "en aggravation", "trend.stable": "stable", "trend.inconnue": "1re déclaration", "chat.s1": "J'ai une douleur qui revient à chaque sortie longue.", "chat.s2": "Comment adapter ma semaine avec cette douleur ?", "chat.s3": "Quels exercices de prévention pour mes tendons ?",
    "k.annuler": "Annuler", "k.etatQ": "{z} — où en es-tu ?", "k.mieux": "Ça va mieux", "k.pire": "Ça empire", "k.passe": "C'est passé", "k.etatOk": "C'est noté — ton coach en tient compte.", "k.etatPasse": "Noté : cette douleur ne bride plus ton plan.", "k.etatErr": "Mise à jour impossible. Réessaie.",
    "k.mapOpen": "Où as-tu mal ? Montrer le schéma", "k.mapClose": "Masquer le schéma", "k.zoneChip": "{zone} · {n}/10",
    "bilan.proba.haute": "probable", "bilan.proba.moyenne": "possible", "bilan.proba.faible": "peu probable",
    "grp.upper": "Haut du corps", "grp.trunk": "Tronc", "grp.pelvis": "Bassin", "grp.thighs": "Cuisses", "grp.knees": "Genoux", "grp.legs": "Jambes", "grp.feet": "Pieds",
    "zf.head": "Tête", "zf.neck": "Cou / cervicales", "zf.shoulderL": "Épaule gauche", "zf.shoulderR": "Épaule droite", "zf.armL": "Bras gauche", "zf.armR": "Bras droit", "zf.chest": "Poitrine", "zf.abs": "Abdominaux / core", "zf.hipL": "Hanche / aine gauche", "zf.hipR": "Hanche / aine droite", "zf.thighL": "Quadriceps gauche", "zf.thighR": "Quadriceps droit", "zf.kneeL": "Genou gauche", "zf.kneeR": "Genou droit", "zf.shinL": "Tibia gauche", "zf.shinR": "Tibia droit", "zf.ankleL": "Cheville gauche", "zf.ankleR": "Cheville droite", "zf.footL": "Pied gauche", "zf.footR": "Pied droit",
    "zd.head": "Nuque", "zd.neck": "Cervicales", "zd.shoulderL": "Trapèze gauche", "zd.shoulderR": "Trapèze droit", "zd.armL": "Triceps gauche", "zd.armR": "Triceps droit", "zd.chest": "Haut du dos", "zd.abs": "Bas du dos / lombaires", "zd.hipL": "Fessier gauche", "zd.hipR": "Fessier droit", "zd.thighL": "Ischio-jambier gauche", "zd.thighR": "Ischio-jambier droit", "zd.kneeL": "Arrière-genou gauche", "zd.kneeR": "Arrière-genou droit", "zd.shinL": "Mollet gauche", "zd.shinR": "Mollet droit", "zd.ankleL": "Tendon d'Achille gauche", "zd.ankleR": "Tendon d'Achille droit", "zd.footL": "Talon gauche", "zd.footR": "Talon droit",
    },
  en: {
    "h.enPanne": "Your reported pains could not be loaded. This history looks empty, but nothing is lost — try again in a moment.", "h.title": "Health and performance", "h.subtitle": "Your pain log, your race nutrition and your weight — all in one place.",
    "tab.kine": "Pain", "k.declarer": "Save this pain", "k.seuil": "Below 4/10, a slight discomfort doesn't change your plan: nothing is saved.", "k.declOk": "Pain saved: your plan lowers the intensity.", "k.declErr": "Pain not saved, try again in a moment.", "k.avisTitre": "Pacevo is not a health professional", "k.pese": "What is weighing on your plan today", "k.peseAucune": "No pain is weighing on your plan. If something hurts, report it on the body map or in your post-session feedback.", "k.srcSeance": "reported after a session", "k.effets": "What your coach changed", "k.effetQualite": "{n} quality session(s) removed this week", "k.effetLongue": "Long run cut from {a} to {b} km", "k.effetLignes": "Easy runs without strides or pick-ups", "k.effetsAttente": "Your plan will be recalculated with this pain at the next sync.", "k.consulterDuree": "This pain has lasted {n} days or more: have it checked by a doctor or a physiotherapist.", "k.consulterPire": "You say it is getting worse: have it checked by a doctor or a physiotherapist.", "k.charge": "The 2 weeks before this pain started: {a} km run, against {b} km the 2 weeks before ({p}).", "k.chargeSeule": "The 2 weeks before this pain started: {a} km run.", "k.chargeArret": "You hadn't run in the 2 weeks before this pain started ({b} km the 2 weeks before): it appeared when you started running again.", "k.chargeAide": "A training figure to show your physio. On its own, it does not explain a pain.", "k.consignes": "Your physio's instructions", "k.consignesAide": "Did your physiotherapist give you limits? Copy them here: your plan sticks to them until the date you set. Pacevo does not set these instructions, it applies them.", "k.consDuree": "Maximum duration of a run (min)", "k.consSeances": "Runs per week, at most", "k.consSansIntensite": "No intensity (no threshold, intervals or hills)", "k.consJusqu": "Until", "k.consEnregistrer": "Apply to my plan", "k.consRetirer": "Remove these instructions", "k.consOk": "Instructions applied: your plan has been recalculated.", "k.consRetirees": "Instructions removed: your plan has been recalculated.", "k.consActives": "In force until {d}.", "k.consAttente": "Instructions saved: your plan will take them into account at its next recalculation.", "k.consRetireesAttente": "Instructions removed: your plan will take this into account at its next recalculation.", "k.consErr.duree": "The duration must be a number of minutes between 15 and 240.", "k.consErr.seances": "The number of runs must be between 1 and 7.", "k.consErr.date": "Choose an end date within the next 6 months.", "k.consErr.vide": "Enter at least one instruction.", "k.carnet": "Prepare my log for the appointment", "k.carnetAide": "Your pains, your load and your latest sessions on one page, to print or save as PDF.", "k.kineAnnuaire": "Find a physiotherapist in France (official register)", "k.fiches": "Prevention guides", "k.ficheSignee": "Reviewed and signed in English by {nom}, physiotherapist (RPPS {rpps}), on {d}.", "k.ficheRemuneree": "Review paid for by Pacevo.", "k.ficheRegion": "Area you reported", "k.ficheAvert": "General information, the same for every runner: it does not replace a consultation and is not tailored to your pain.", "k.avis": "A declared pain lightens your plan (less intensity) while it lasts. Pacevo makes no diagnosis and offers no treatment: to know what you have and how to treat it, see a doctor or a physiotherapist.", "k.alerte": "See someone without delay if the pain stops you walking, wakes you at night, comes with swelling, redness or fever, or gets worse despite rest. Emergency: 112.", "tab.recup": "Recovery", "tab.nutrition": "Nutrition", "tab.poids": "Weight",
    "k.where": "Where does it hurt?", "view.face": "Front", "view.dos": "Back",
    "k.hint": "Tap a zone on the body or in the list, set the intensity, then save it: your plan adapts.",
    "k.pain": "Pain", "k.painLight": "Mild discomfort", "k.painHard": "Very painful",
    "k.noZone": "No zone selected",
    "k.suivi": "Your pain history", "k.seance": "Reported after your sessions", "k.seanceAide": "Ticked in your post-session feedback. The coach takes them into account for 14 days, or until you say “it's gone”.", "k.suiviNone": "No pain reported in the last 60 days.", "k.suiviSince": "for {n} d", "k.suiviToday": "today", "k.suiviAgo": "{n} d ago", "trend.amelioration": "improving", "trend.aggravation": "worsening", "trend.stable": "stable", "trend.inconnue": "1st report", "chat.s1": "I get a recurring pain on every long run.", "chat.s2": "How should I adjust my week with this pain?", "chat.s3": "Which prevention exercises for my tendons?",
    "k.annuler": "Undo", "k.etatQ": "{z} — how is it now?", "k.mieux": "Getting better", "k.pire": "Getting worse", "k.passe": "It's gone", "k.etatOk": "Noted — your coach takes it into account.", "k.etatPasse": "Noted: this pain no longer holds your plan back.", "k.etatErr": "Couldn't update. Try again.",
    "k.mapOpen": "Where does it hurt? Show the body map", "k.mapClose": "Hide the body map", "k.zoneChip": "{zone} · {n}/10",
    "bilan.proba.haute": "likely", "bilan.proba.moyenne": "possible", "bilan.proba.faible": "unlikely",
    "grp.upper": "Upper body", "grp.trunk": "Trunk", "grp.pelvis": "Pelvis", "grp.thighs": "Thighs", "grp.knees": "Knees", "grp.legs": "Legs", "grp.feet": "Feet",
    "zf.head": "Head", "zf.neck": "Neck / cervical", "zf.shoulderL": "Left shoulder", "zf.shoulderR": "Right shoulder", "zf.armL": "Left arm", "zf.armR": "Right arm", "zf.chest": "Chest", "zf.abs": "Abs / core", "zf.hipL": "Left hip / groin", "zf.hipR": "Right hip / groin", "zf.thighL": "Left quadriceps", "zf.thighR": "Right quadriceps", "zf.kneeL": "Left knee", "zf.kneeR": "Right knee", "zf.shinL": "Left shin", "zf.shinR": "Right shin", "zf.ankleL": "Left ankle", "zf.ankleR": "Right ankle", "zf.footL": "Left foot", "zf.footR": "Right foot",
    "zd.head": "Nape", "zd.neck": "Cervical", "zd.shoulderL": "Left trapezius", "zd.shoulderR": "Right trapezius", "zd.armL": "Left triceps", "zd.armR": "Right triceps", "zd.chest": "Upper back", "zd.abs": "Lower back / lumbar", "zd.hipL": "Left glute", "zd.hipR": "Right glute", "zd.thighL": "Left hamstring", "zd.thighR": "Right hamstring", "zd.kneeL": "Left popliteal", "zd.kneeR": "Right popliteal", "zd.shinL": "Left calf", "zd.shinR": "Right calf", "zd.ankleL": "Left Achilles tendon", "zd.ankleR": "Right Achilles tendon", "zd.footL": "Left heel", "zd.footR": "Right heel",
    },
  de: {
    "h.enPanne": "Deine gemeldeten Schmerzen konnten nicht geladen werden. Der Verlauf wirkt leer, es ist aber nichts verloren — versuch es gleich nochmal.", "h.title": "Gesundheit und Leistung", "h.subtitle": "Deine erfassten Schmerzen, deine Wettkampfernährung und dein Gewicht — alles an einem Ort.",
    "tab.kine": "Schmerzen", "k.declarer": "Diesen Schmerz speichern", "k.seuil": "Unter 4/10 ändert ein leichtes Ziehen deinen Plan nicht: Es wird nichts gespeichert.", "k.declOk": "Schmerz gespeichert: dein Plan senkt die Intensität.", "k.declErr": "Schmerz nicht gespeichert, versuche es gleich noch einmal.", "k.avisTitre": "Pacevo ist keine medizinische Fachkraft", "k.pese": "Was deinen Plan heute belastet", "k.peseAucune": "Kein Schmerz belastet deinen Plan. Wenn dir etwas wehtut, melde es auf der Körperkarte oder im Feedback nach der Einheit.", "k.srcSeance": "nach einer Einheit gemeldet", "k.effets": "Was dein Coach geändert hat", "k.effetQualite": "{n} Qualitätseinheit(en) diese Woche gestrichen", "k.effetLongue": "Langer Lauf von {a} auf {b} km verkürzt", "k.effetLignes": "Lockere Läufe ohne Steigerungen", "k.effetsAttente": "Dein Plan wird bei der nächsten Synchronisierung mit diesem Schmerz neu berechnet.", "k.consulterDuree": "Dieser Schmerz dauert seit {n} Tagen oder länger: Lass ihn von einer Ärztin, einem Arzt oder in der Physiotherapie anschauen.", "k.consulterPire": "Du gibst an, dass er schlimmer wird: Lass ihn von einer Ärztin, einem Arzt oder in der Physiotherapie anschauen.", "k.charge": "Die 2 Wochen vor Beginn dieses Schmerzes: {a} km gelaufen, gegenüber {b} km in den 2 Wochen davor ({p}).", "k.chargeSeule": "Die 2 Wochen vor Beginn dieses Schmerzes: {a} km gelaufen.", "k.chargeArret": "In den 2 Wochen vor Beginn dieses Schmerzes bist du nicht gelaufen ({b} km in den 2 Wochen davor): Er trat beim Wiedereinstieg auf.", "k.chargeAide": "Eine Trainingszahl für deine Physiotherapie. Allein erklärt sie keinen Schmerz.", "k.consignes": "Die Vorgaben deiner Physiotherapie", "k.consignesAide": "Hat dir deine Physiotherapie einen Rahmen gegeben? Trag ihn hier ein: Dein Plan hält sich bis zum gewählten Datum daran. Pacevo legt diese Vorgaben nicht fest, es wendet sie an.", "k.consDuree": "Maximale Dauer eines Laufs (Min.)", "k.consSeances": "Läufe pro Woche, höchstens", "k.consSansIntensite": "Keine Intensität (keine Schwelle, kein Intervall, keine Hügel)", "k.consJusqu": "Bis", "k.consEnregistrer": "Auf meinen Plan anwenden", "k.consRetirer": "Diese Vorgaben entfernen", "k.consOk": "Vorgaben angewendet: Dein Plan wurde neu berechnet.", "k.consRetirees": "Vorgaben entfernt: Dein Plan wurde neu berechnet.", "k.consActives": "Gültig bis {d}.", "k.consAttente": "Vorgaben gespeichert: Dein Plan berücksichtigt sie bei der nächsten Neuberechnung.", "k.consRetireesAttente": "Vorgaben entfernt: Dein Plan berücksichtigt das bei der nächsten Neuberechnung.", "k.consErr.duree": "Die Dauer muss eine Minutenzahl zwischen 15 und 240 sein.", "k.consErr.seances": "Die Anzahl der Läufe muss zwischen 1 und 7 liegen.", "k.consErr.date": "Wähle ein Enddatum in den nächsten 6 Monaten.", "k.consErr.vide": "Gib mindestens eine Vorgabe an.", "k.carnet": "Mein Protokoll für den Termin vorbereiten", "k.carnetAide": "Deine Schmerzen, deine Belastung und deine letzten Einheiten auf einer Seite, zum Drucken oder als PDF.", "k.kineAnnuaire": "Physiotherapie in Frankreich finden (offizielles Verzeichnis)", "k.fiches": "Präventionsblätter", "k.ficheSignee": "Auf Deutsch geprüft und unterzeichnet von {nom}, Physiotherapeut(in) (RPPS {rpps}), am {d}.", "k.ficheRemuneree": "Prüfung von Pacevo vergütet.", "k.ficheRegion": "Von dir gemeldeter Bereich", "k.ficheAvert": "Allgemeine Information, für alle Läufer gleich: Sie ersetzt keinen Arztbesuch und ist nicht auf deinen Schmerz zugeschnitten.", "k.avis": "Ein gemeldeter Schmerz macht deinen Plan leichter (weniger Intensität), solange er anhält. Pacevo stellt keine Diagnose und bietet keine Behandlung an: Um zu wissen, was du hast und wie es behandelt wird, geh zu einer Ärztin, einem Arzt oder in die Physiotherapie.", "k.alerte": "Geh sofort zum Arzt, wenn der Schmerz dich am Gehen hindert, dich nachts weckt, mit Schwellung, Rötung oder Fieber einhergeht oder trotz Ruhe schlimmer wird. Notfall: 112.", "tab.recup": "Erholung", "tab.nutrition": "Ernährung", "tab.poids": "Gewicht",
    "k.where": "Wo tut es weh?", "view.face": "Vorne", "view.dos": "Hinten",
    "k.hint": "Tippe eine Zone am Körper oder in der Liste an, stelle die Stärke ein und speichere sie: dein Plan passt sich an.",
    "k.pain": "Schmerz", "k.painLight": "Leichtes Unbehagen", "k.painHard": "Sehr schmerzhaft",
    "k.noZone": "Keine Zone ausgewählt",
    "k.suivi": "Verlauf deiner Schmerzen", "k.seance": "Nach deinen Einheiten gemeldet", "k.seanceAide": "In deinem Feedback nach der Einheit angekreuzt. Der Coach berücksichtigt sie 14 Tage lang oder bis du „Ist weg“ sagst.", "k.suiviNone": "In den letzten 60 Tagen keine Schmerzen gemeldet.", "k.suiviSince": "seit {n} T", "k.suiviToday": "heute", "k.suiviAgo": "vor {n} T", "trend.amelioration": "bessert sich", "trend.aggravation": "verschlechtert sich", "trend.stable": "stabil", "trend.inconnue": "1. Meldung", "chat.s1": "Bei jedem langen Lauf kommt derselbe Schmerz zurück.", "chat.s2": "Wie passe ich meine Woche mit diesem Schmerz an?", "chat.s3": "Welche Präventionsübungen für meine Sehnen?",
    "k.annuler": "Rückgängig", "k.etatQ": "{z} — wie ist es jetzt?", "k.mieux": "Wird besser", "k.pire": "Wird schlimmer", "k.passe": "Ist weg", "k.etatOk": "Notiert — dein Coach berücksichtigt es.", "k.etatPasse": "Notiert: dieser Schmerz bremst deinen Plan nicht mehr.", "k.etatErr": "Aktualisierung nicht möglich. Versuch es nochmal.",
    "k.mapOpen": "Wo tut es weh? Körperschema zeigen", "k.mapClose": "Körperschema ausblenden", "k.zoneChip": "{zone} · {n}/10",
    "bilan.proba.haute": "wahrscheinlich", "bilan.proba.moyenne": "möglich", "bilan.proba.faible": "unwahrscheinlich",
    "grp.upper": "Oberkörper", "grp.trunk": "Rumpf", "grp.pelvis": "Becken", "grp.thighs": "Oberschenkel", "grp.knees": "Knie", "grp.legs": "Unterschenkel", "grp.feet": "Füße",
    "zf.head": "Kopf", "zf.neck": "Hals / Nacken", "zf.shoulderL": "Linke Schulter", "zf.shoulderR": "Rechte Schulter", "zf.armL": "Linker Arm", "zf.armR": "Rechter Arm", "zf.chest": "Brust", "zf.abs": "Bauch / Core", "zf.hipL": "Linke Hüfte / Leiste", "zf.hipR": "Rechte Hüfte / Leiste", "zf.thighL": "Linker Quadrizeps", "zf.thighR": "Rechter Quadrizeps", "zf.kneeL": "Linkes Knie", "zf.kneeR": "Rechtes Knie", "zf.shinL": "Linkes Schienbein", "zf.shinR": "Rechtes Schienbein", "zf.ankleL": "Linker Knöchel", "zf.ankleR": "Rechter Knöchel", "zf.footL": "Linker Fuß", "zf.footR": "Rechter Fuß",
    "zd.head": "Nacken", "zd.neck": "Halswirbelsäule", "zd.shoulderL": "Linker Trapezius", "zd.shoulderR": "Rechter Trapezius", "zd.armL": "Linker Trizeps", "zd.armR": "Rechter Trizeps", "zd.chest": "Oberer Rücken", "zd.abs": "Unterer Rücken / Lende", "zd.hipL": "Linker Gesäßmuskel", "zd.hipR": "Rechter Gesäßmuskel", "zd.thighL": "Linker hinterer Oberschenkel", "zd.thighR": "Rechter hinterer Oberschenkel", "zd.kneeL": "Linke Kniekehle", "zd.kneeR": "Rechte Kniekehle", "zd.shinL": "Linke Wade", "zd.shinR": "Rechte Wade", "zd.ankleL": "Linke Achillessehne", "zd.ankleR": "Rechte Achillessehne", "zd.footL": "Linke Ferse", "zd.footR": "Rechte Ferse",
    },
  es: {
    "h.enPanne": "Tus dolores declarados no se han podido cargar. Este historial parece vacío, pero no se ha perdido nada — inténtalo de nuevo en un momento.", "h.title": "Salud y rendimiento", "h.subtitle": "Tus dolores registrados, tu nutrición de carrera y tu peso, en un mismo lugar.",
    "tab.kine": "Dolor", "k.declarer": "Guardar este dolor", "k.seuil": "Por debajo de 4/10, una molestia leve no cambia tu plan: no se guarda nada.", "k.declOk": "Dolor guardado: tu plan reduce la intensidad.", "k.declErr": "Dolor no guardado, inténtalo de nuevo en un momento.", "k.avisTitre": "Pacevo no es un profesional sanitario", "k.pese": "Lo que pesa hoy en tu plan", "k.peseAucune": "Ningún dolor pesa en tu plan. Si algo te duele, señálalo en el esquema corporal o en tu sensación tras la sesión.", "k.srcSeance": "señalado tras una sesión", "k.effets": "Lo que ha cambiado tu entrenador", "k.effetQualite": "{n} sesión(es) de calidad retirada(s) esta semana", "k.effetLongue": "Tirada larga reducida de {a} a {b} km", "k.effetLignes": "Rodajes sin progresivos ni rectas", "k.effetsAttente": "Tu plan se recalculará con este dolor en la próxima sincronización.", "k.consulterDuree": "Este dolor dura desde hace {n} días o más: consulta a un médico o a un fisioterapeuta.", "k.consulterPire": "Indicas que empeora: consulta a un médico o a un fisioterapeuta.", "k.charge": "Las 2 semanas antes de que empezara este dolor: {a} km corridos, frente a {b} km las 2 semanas anteriores ({p}).", "k.chargeSeule": "Las 2 semanas antes de que empezara este dolor: {a} km corridos.", "k.chargeArret": "No habías corrido en las 2 semanas antes de que empezara este dolor ({b} km las 2 semanas anteriores): apareció al retomar la carrera.", "k.chargeAide": "Una cifra de entrenamiento para enseñar a tu fisioterapeuta. Por sí sola no explica un dolor.", "k.consignes": "Las indicaciones de tu fisioterapeuta", "k.consignesAide": "¿Tu fisioterapeuta te ha dado un marco? Cópialo aquí: tu plan lo respeta hasta la fecha indicada. Pacevo no fija estas indicaciones, las aplica.", "k.consDuree": "Duración máxima de una salida (min)", "k.consSeances": "Salidas de carrera por semana, como máximo", "k.consSansIntensite": "Sin intensidad (ni umbral, ni VAM, ni cuestas)", "k.consJusqu": "Hasta el", "k.consEnregistrer": "Aplicar a mi plan", "k.consRetirer": "Quitar estas indicaciones", "k.consOk": "Indicaciones aplicadas: tu plan se ha recalculado.", "k.consRetirees": "Indicaciones quitadas: tu plan se ha recalculado.", "k.consActives": "Vigentes hasta el {d}.", "k.consAttente": "Indicaciones guardadas: tu plan las tendrá en cuenta en su próximo recálculo.", "k.consRetireesAttente": "Indicaciones quitadas: tu plan lo tendrá en cuenta en su próximo recálculo.", "k.consErr.duree": "La duración debe ser un número de minutos entre 15 y 240.", "k.consErr.seances": "El número de salidas debe estar entre 1 y 7.", "k.consErr.date": "Elige una fecha de fin dentro de los próximos 6 meses.", "k.consErr.vide": "Indica al menos una indicación.", "k.carnet": "Preparar mi registro para la cita", "k.carnetAide": "Tus dolores, tu carga y tus últimas sesiones en una página, para imprimir o guardar en PDF.", "k.kineAnnuaire": "Encontrar un fisioterapeuta en Francia (registro oficial)", "k.fiches": "Fichas de prevención", "k.ficheSignee": "Revisada y firmada en español por {nom}, fisioterapeuta (RPPS {rpps}), el {d}.", "k.ficheRemuneree": "Revisión remunerada por Pacevo.", "k.ficheRegion": "Zona que has señalado", "k.ficheAvert": "Información general, la misma para todos los corredores: no sustituye una consulta ni está adaptada a tu dolor.", "k.avis": "Un dolor declarado aligera tu plan (menos intensidad) mientras dure. Pacevo no hace ningún diagnóstico ni propone ningún tratamiento: para saber qué tienes y cómo tratarlo, consulta a un médico o a un fisioterapeuta.", "k.alerte": "Consulta sin esperar si el dolor te impide caminar, te despierta por la noche, va acompañado de hinchazón, enrojecimiento o fiebre, o empeora pese al reposo. Urgencias: 112.", "tab.recup": "Recuperación", "tab.nutrition": "Nutrición", "tab.poids": "Peso",
    "k.where": "¿Dónde te duele?", "view.face": "Frente", "view.dos": "Espalda",
    "k.hint": "Toca una zona en el cuerpo o en la lista, ajusta la intensidad y guárdala: tu plan se adapta.",
    "k.pain": "Dolor", "k.painLight": "Molestia leve", "k.painHard": "Muy doloroso",
    "k.noZone": "Ninguna zona seleccionada",
    "k.suivi": "Seguimiento de tus dolores", "k.seance": "Señalados tras tus sesiones", "k.seanceAide": "Marcados en tu sensación tras la sesión. El entrenador los tiene en cuenta 14 días, o hasta que digas «ya pasó».", "k.suiviNone": "Ningún dolor declarado en los últimos 60 días.", "k.suiviSince": "desde hace {n} d", "k.suiviToday": "hoy", "k.suiviAgo": "hace {n} d", "trend.amelioration": "mejorando", "trend.aggravation": "empeorando", "trend.stable": "estable", "trend.inconnue": "1.ª declaración", "chat.s1": "Tengo un dolor que vuelve en cada tirada larga.", "chat.s2": "¿Cómo adapto mi semana con este dolor?", "chat.s3": "¿Qué ejercicios de prevención para mis tendones?",
    "k.annuler": "Deshacer", "k.etatQ": "{z}: ¿cómo va?", "k.mieux": "Va mejor", "k.pire": "Va peor", "k.passe": "Ya pasó", "k.etatOk": "Anotado: tu entrenador lo tiene en cuenta.", "k.etatPasse": "Anotado: este dolor ya no frena tu plan.", "k.etatErr": "No se pudo actualizar. Reinténtalo.",
    "k.mapOpen": "¿Dónde te duele? Mostrar el esquema", "k.mapClose": "Ocultar el esquema", "k.zoneChip": "{zone} · {n}/10",
    "bilan.proba.haute": "probable", "bilan.proba.moyenne": "posible", "bilan.proba.faible": "poco probable",
    "grp.upper": "Tren superior", "grp.trunk": "Tronco", "grp.pelvis": "Pelvis", "grp.thighs": "Muslos", "grp.knees": "Rodillas", "grp.legs": "Piernas", "grp.feet": "Pies",
    "zf.head": "Cabeza", "zf.neck": "Cuello / cervicales", "zf.shoulderL": "Hombro izquierdo", "zf.shoulderR": "Hombro derecho", "zf.armL": "Brazo izquierdo", "zf.armR": "Brazo derecho", "zf.chest": "Pecho", "zf.abs": "Abdominales / core", "zf.hipL": "Cadera / ingle izquierda", "zf.hipR": "Cadera / ingle derecha", "zf.thighL": "Cuádriceps izquierdo", "zf.thighR": "Cuádriceps derecho", "zf.kneeL": "Rodilla izquierda", "zf.kneeR": "Rodilla derecha", "zf.shinL": "Espinilla izquierda", "zf.shinR": "Espinilla derecha", "zf.ankleL": "Tobillo izquierdo", "zf.ankleR": "Tobillo derecho", "zf.footL": "Pie izquierdo", "zf.footR": "Pie derecho",
    "zd.head": "Nuca", "zd.neck": "Cervicales", "zd.shoulderL": "Trapecio izquierdo", "zd.shoulderR": "Trapecio derecho", "zd.armL": "Tríceps izquierdo", "zd.armR": "Tríceps derecho", "zd.chest": "Espalda alta", "zd.abs": "Espalda baja / lumbares", "zd.hipL": "Glúteo izquierdo", "zd.hipR": "Glúteo derecho", "zd.thighL": "Isquiotibial izquierdo", "zd.thighR": "Isquiotibial derecho", "zd.kneeL": "Hueco poplíteo izquierdo", "zd.kneeR": "Hueco poplíteo derecho", "zd.shinL": "Gemelo izquierdo", "zd.shinR": "Gemelo derecho", "zd.ankleL": "Tendón de Aquiles izquierdo", "zd.ankleR": "Tendón de Aquiles derecho", "zd.footL": "Talón izquierdo", "zd.footR": "Talón derecho",
    },
  pt: {
    "h.enPanne": "As tuas dores declaradas não puderam ser carregadas. Este histórico parece vazio, mas nada se perdeu — tenta novamente daqui a pouco.", "h.title": "Saúde e desempenho", "h.subtitle": "As tuas dores registadas, a tua nutrição de prova e o teu peso, no mesmo sítio.",
    "tab.kine": "Dor", "k.declarer": "Guardar esta dor", "k.seuil": "Abaixo de 4/10, um incómodo ligeiro não altera o teu plano: nada é guardado.", "k.declOk": "Dor guardada: o teu plano reduz a intensidade.", "k.declErr": "Dor não guardada, tenta novamente daqui a pouco.", "k.avisTitre": "O Pacevo não é um profissional de saúde", "k.pese": "O que pesa hoje no teu plano", "k.peseAucune": "Nenhuma dor pesa no teu plano. Se te dói alguma coisa, assinala-a no esquema corporal ou na tua sensação depois do treino.", "k.srcSeance": "assinalada depois de um treino", "k.effets": "O que o teu treinador mudou", "k.effetQualite": "{n} sessão(ões) de qualidade retirada(s) esta semana", "k.effetLongue": "Treino longo reduzido de {a} para {b} km", "k.effetLignes": "Corridas fáceis sem acelerações nem retas", "k.effetsAttente": "O teu plano vai ser recalculado com esta dor na próxima sincronização.", "k.consulterDuree": "Esta dor dura há {n} dias ou mais: mostra-a a um médico ou a um fisioterapeuta.", "k.consulterPire": "Indicas que está a piorar: mostra-a a um médico ou a um fisioterapeuta.", "k.charge": "As 2 semanas antes do início desta dor: {a} km corridos, contra {b} km nas 2 semanas anteriores ({p}).", "k.chargeSeule": "As 2 semanas antes do início desta dor: {a} km corridos.", "k.chargeArret": "Não tinhas corrido nas 2 semanas antes do início desta dor ({b} km nas 2 semanas anteriores): apareceu ao retomares a corrida.", "k.chargeAide": "Um número de treino para mostrar ao teu fisioterapeuta. Sozinho, não explica uma dor.", "k.consignes": "As indicações do teu fisioterapeuta", "k.consignesAide": "O teu fisioterapeuta deu-te um enquadramento? Copia-o aqui: o teu plano respeita-o até à data indicada. O Pacevo não define estas indicações, aplica-as.", "k.consDuree": "Duração máxima de uma corrida (min)", "k.consSeances": "Corridas por semana, no máximo", "k.consSansIntensite": "Sem intensidade (nem limiar, nem VAM, nem subidas)", "k.consJusqu": "Até", "k.consEnregistrer": "Aplicar ao meu plano", "k.consRetirer": "Retirar estas indicações", "k.consOk": "Indicações aplicadas: o teu plano foi recalculado.", "k.consRetirees": "Indicações retiradas: o teu plano foi recalculado.", "k.consActives": "Em vigor até {d}.", "k.consAttente": "Indicações guardadas: o teu plano vai tê-las em conta no próximo recálculo.", "k.consRetireesAttente": "Indicações retiradas: o teu plano vai ter isso em conta no próximo recálculo.", "k.consErr.duree": "A duração deve ser um número de minutos entre 15 e 240.", "k.consErr.seances": "O número de corridas deve estar entre 1 e 7.", "k.consErr.date": "Escolhe uma data de fim nos próximos 6 meses.", "k.consErr.vide": "Indica pelo menos uma indicação.", "k.carnet": "Preparar o meu registo para a consulta", "k.carnetAide": "As tuas dores, a tua carga e os teus últimos treinos numa página, para imprimir ou guardar em PDF.", "k.kineAnnuaire": "Encontrar um fisioterapeuta em França (registo oficial)", "k.fiches": "Fichas de prevenção", "k.ficheSignee": "Revista e assinada em português por {nom}, fisioterapeuta (RPPS {rpps}), a {d}.", "k.ficheRemuneree": "Revisão remunerada pelo Pacevo.", "k.ficheRegion": "Zona que assinalaste", "k.ficheAvert": "Informação geral, igual para todos os corredores: não substitui uma consulta nem está adaptada à tua dor.", "k.avis": "Uma dor declarada alivia o teu plano (menos intensidade) enquanto durar. O Pacevo não faz nenhum diagnóstico nem propõe nenhum tratamento: para saberes o que tens e como tratar, consulta um médico ou um fisioterapeuta.", "k.alerte": "Consulta sem esperar se a dor te impedir de andar, te acordar à noite, vier com inchaço, vermelhidão ou febre, ou piorar apesar do repouso. Emergência: 112.", "tab.recup": "Recuperação", "tab.nutrition": "Nutrição", "tab.poids": "Peso",
    "k.where": "Onde te dói?", "view.face": "Frente", "view.dos": "Costas",
    "k.hint": "Toca numa zona do corpo ou da lista, ajusta a intensidade e guarda-a: o teu plano adapta-se.",
    "k.pain": "Dor", "k.painLight": "Desconforto ligeiro", "k.painHard": "Muito doloroso",
    "k.noZone": "Nenhuma zona selecionada",
    "k.suivi": "Acompanhamento das tuas dores", "k.seance": "Assinaladas depois dos teus treinos", "k.seanceAide": "Assinaladas na tua sensação depois do treino. O treinador tem-nas em conta 14 dias, ou até dizeres «já passou».", "k.suiviNone": "Nenhuma dor declarada nos últimos 60 dias.", "k.suiviSince": "há {n} d", "k.suiviToday": "hoje", "k.suiviAgo": "há {n} d", "trend.amelioration": "a melhorar", "trend.aggravation": "a piorar", "trend.stable": "estável", "trend.inconnue": "1.ª declaração", "chat.s1": "Tenho uma dor que volta em cada treino longo.", "chat.s2": "Como adapto a minha semana com esta dor?", "chat.s3": "Que exercícios de prevenção para os meus tendões?",
    "k.annuler": "Anular", "k.etatQ": "{z} — como está agora?", "k.mieux": "Está melhor", "k.pire": "Está pior", "k.passe": "Já passou", "k.etatOk": "Registado — o teu treinador tem isso em conta.", "k.etatPasse": "Registado: esta dor já não trava o teu plano.", "k.etatErr": "Não foi possível atualizar. Tenta de novo.",
    "k.mapOpen": "Onde te dói? Mostrar o esquema", "k.mapClose": "Esconder o esquema", "k.zoneChip": "{zone} · {n}/10",
    "bilan.proba.haute": "provável", "bilan.proba.moyenne": "possível", "bilan.proba.faible": "pouco provável",
    "grp.upper": "Tronco superior", "grp.trunk": "Tronco", "grp.pelvis": "Bacia", "grp.thighs": "Coxas", "grp.knees": "Joelhos", "grp.legs": "Pernas", "grp.feet": "Pés",
    "zf.head": "Cabeça", "zf.neck": "Pescoço / cervicais", "zf.shoulderL": "Ombro esquerdo", "zf.shoulderR": "Ombro direito", "zf.armL": "Braço esquerdo", "zf.armR": "Braço direito", "zf.chest": "Peito", "zf.abs": "Abdominais / core", "zf.hipL": "Anca / virilha esquerda", "zf.hipR": "Anca / virilha direita", "zf.thighL": "Quadríceps esquerdo", "zf.thighR": "Quadríceps direito", "zf.kneeL": "Joelho esquerdo", "zf.kneeR": "Joelho direito", "zf.shinL": "Canela esquerda", "zf.shinR": "Canela direita", "zf.ankleL": "Tornozelo esquerdo", "zf.ankleR": "Tornozelo direito", "zf.footL": "Pé esquerdo", "zf.footR": "Pé direito",
    "zd.head": "Nuca", "zd.neck": "Cervicais", "zd.shoulderL": "Trapézio esquerdo", "zd.shoulderR": "Trapézio direito", "zd.armL": "Tríceps esquerdo", "zd.armR": "Tríceps direito", "zd.chest": "Parte superior das costas", "zd.abs": "Lombar / parte inferior das costas", "zd.hipL": "Glúteo esquerdo", "zd.hipR": "Glúteo direito", "zd.thighL": "Isquiotibial esquerdo", "zd.thighR": "Isquiotibial direito", "zd.kneeL": "Cavado poplíteo esquerdo", "zd.kneeR": "Cavado poplíteo direito", "zd.shinL": "Gémeo esquerdo", "zd.shinR": "Gémeo direito", "zd.ankleL": "Tendão de Aquiles esquerdo", "zd.ankleR": "Tendão de Aquiles direito", "zd.footL": "Calcanhar esquerdo", "zd.footR": "Calcanhar direito",
    },
};

// Zones cliquables : mêmes emplacements en vue Face / Dos, libellés via clés i18n.
type Zone = { labelKey: string; groupKey: string };
const GROUP_ORDER = ["grp.upper", "grp.trunk", "grp.pelvis", "grp.thighs", "grp.knees", "grp.legs", "grp.feet"] as const;
const SLOTS: { slot: string; group: string }[] = [
  { slot: "head", group: "grp.upper" }, { slot: "neck", group: "grp.upper" },
  { slot: "shoulderL", group: "grp.upper" }, { slot: "shoulderR", group: "grp.upper" },
  { slot: "armL", group: "grp.upper" }, { slot: "armR", group: "grp.upper" },
  { slot: "chest", group: "grp.trunk" }, { slot: "abs", group: "grp.trunk" },
  { slot: "hipL", group: "grp.pelvis" }, { slot: "hipR", group: "grp.pelvis" },
  { slot: "thighL", group: "grp.thighs" }, { slot: "thighR", group: "grp.thighs" },
  { slot: "kneeL", group: "grp.knees" }, { slot: "kneeR", group: "grp.knees" },
  { slot: "shinL", group: "grp.legs" }, { slot: "shinR", group: "grp.legs" },
  { slot: "ankleL", group: "grp.feet" }, { slot: "ankleR", group: "grp.feet" },
  { slot: "footL", group: "grp.feet" }, { slot: "footR", group: "grp.feet" },
];
const VIEW_ZONES: Record<"face" | "dos", Record<string, Zone>> = {
  face: Object.fromEntries(SLOTS.map(({ slot, group }) => [slot, { labelKey: `zf.${slot}`, groupKey: group }])),
  dos: Object.fromEntries(SLOTS.map(({ slot, group }) => [slot, { labelKey: `zd.${slot}`, groupKey: group }])),
};

// Géométrie de la silhouette (viewBox 200×470, symétrique) — partagée Face/Dos.
const SHAPES: { slot: string; tag: "ellipse" | "rect"; p: Record<string, number> }[] = [
  { slot: "head", tag: "ellipse", p: { cx: 100, cy: 34, rx: 21, ry: 23 } },
  { slot: "neck", tag: "rect", p: { x: 91, y: 52, width: 18, height: 17, rx: 7 } },
  { slot: "shoulderL", tag: "ellipse", p: { cx: 60, cy: 90, rx: 18, ry: 13 } },
  { slot: "shoulderR", tag: "ellipse", p: { cx: 140, cy: 90, rx: 18, ry: 13 } },
  { slot: "chest", tag: "rect", p: { x: 74, y: 72, width: 52, height: 48, rx: 15 } },
  { slot: "abs", tag: "rect", p: { x: 80, y: 122, width: 40, height: 46, rx: 13 } },
  { slot: "armL", tag: "rect", p: { x: 40, y: 84, width: 15, height: 116, rx: 7 } },
  { slot: "armR", tag: "rect", p: { x: 145, y: 84, width: 15, height: 116, rx: 7 } },
  { slot: "hipL", tag: "ellipse", p: { cx: 82, cy: 180, rx: 15, ry: 14 } },
  { slot: "hipR", tag: "ellipse", p: { cx: 118, cy: 180, rx: 15, ry: 14 } },
  { slot: "thighL", tag: "rect", p: { x: 73, y: 190, width: 23, height: 86, rx: 11 } },
  { slot: "thighR", tag: "rect", p: { x: 104, y: 190, width: 23, height: 86, rx: 11 } },
  { slot: "kneeL", tag: "ellipse", p: { cx: 84, cy: 286, rx: 12, ry: 11 } },
  { slot: "kneeR", tag: "ellipse", p: { cx: 116, cy: 286, rx: 12, ry: 11 } },
  { slot: "shinL", tag: "rect", p: { x: 76, y: 298, width: 17, height: 80, rx: 8 } },
  { slot: "shinR", tag: "rect", p: { x: 107, y: 298, width: 17, height: 80, rx: 8 } },
  { slot: "ankleL", tag: "ellipse", p: { cx: 85, cy: 388, rx: 9, ry: 9 } },
  { slot: "ankleR", tag: "ellipse", p: { cx: 115, cy: 388, rx: 9, ry: 9 } },
  { slot: "footL", tag: "rect", p: { x: 72, y: 398, width: 22, height: 18, rx: 7 } },
  { slot: "footR", tag: "rect", p: { x: 106, y: 398, width: 22, height: 18, rx: 7 } },
];

/** Un seul barème de couleur pour la douleur : la silhouette et le curseur doivent dire la même chose. */
function teinteDouleur(n: number): string {
  return n <= 3 ? "#fbbf24" : n <= 6 ? "#fb923c" : n <= 8 ? "#ef4444" : "#b91c1c";
}

/** La silhouette et la carte de suivi lisent le même barème de tendance. */
const TEINTE_TENDANCE: Record<Tendance, { fond: string; trait: string }> = {
  aggravation: { fond: "#fca5a5", trait: "#dc2626" },
  amelioration: { fond: "#a7f3d0", trait: "#059669" },
  // ⚠️ « Pas de tendance mesurable » N'EST PAS « rien à signaler » : c'est une douleur
  // déclarée. En gris, elle se confondait avec le reste du corps et disparaissait de la
  // silhouette alors que la liste juste à côté la signalait en ambre.
  stable: { fond: "#fde68a", trait: "#f59e0b" },
  inconnue: { fond: "#fde68a", trait: "#f59e0b" },
};

const TON_TENDANCE: Record<Tendance, string> = {
  amelioration: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  aggravation: "bg-red-50 text-red-700 ring-red-200",
  stable: "bg-amber-50 text-amber-700 ring-amber-200",
  inconnue: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

// ⚠️ PLUS DE « JOURNAL » NI DE « SÉCURITÉ » (30/09/2026, Cyprien : « si c'est pas utile,
// enlève-le »). Le journal n'alimentait rien — ni le coach, ni le plan ; le ressenti de
// fin de séance le remplace. Le contact d'urgence a déménagé dans Paramètres › Sécurité,
// le partage de position en direct reste sur la Carte.
type Tab = "kine" | "recup" | "nutrition" | "poids";

export function HealthCenter({ suivi = [], douleurs = [], effets = null, consignes = null, charge = null, rappel = null, enPanne = false, coursesNutrition = [], poidsKg = null, recup = null }: {
  /** Santé, lot 1 : une seule liste des douleurs actives (déclarées + cochées après une séance). */
  douleurs?: (DouleurUnifiee & { libelle?: Partial<Record<string, string>>; zone?: string })[];
  /** Ce que la douleur a retiré au plan (état du coach) ; `null` s'il n'est pas encore recalculé. */
  effets?: { qualiteRetiree: number; sortieLongue: { prevueKm: number; reduiteKm: number } | null; lignesDroites: boolean } | null;
  /** Les consignes du kinésithérapeute en vigueur. */
  consignes?: ConsignesKine | null;
  /** La charge des deux semaines avant la douleur la plus ancienne. */
  charge?: ChargeAvant | null;
  /** Faut-il dire « consulte » (durée ou aggravation) ? */
  rappel?: { motif: "duree" | "pire"; cle: string } | null;
  suivi?: SuiviZone[];
  /** La lecture des douleurs a ÉCHOUÉ : l'historique est vide par accident. */
  enPanne?: boolean;
  /** La consultation précédente, relue côté serveur (type `kine_chat`). */
  /** Les prochaines courses et leur durée prédite, pour la nutrition (lib/health/coursesNutrition). */
  coursesNutrition?: CourseNutri[];
  poidsKg?: number | null;
  /** Santé › Récupération (lot 2) : bilan du matin et indicateurs, calculés côté serveur. */
  recup?: DonneesRecup | null;
}) {
  // Chaque libellé est relié à son champ : sans cela, un lecteur d'écran annonce
  // le placeholder — ou rien — à la place du texte affiché.
  const cid = useId();
  const { lang } = useT();
  const tr: Tr = (k, p) => fill(H[lang]?.[k] ?? H.fr[k] ?? k, p);
  const [tab, setTab] = useState<Tab>("kine");
  // Un lien peut ouvrir un onglet précis (« ?onglet=nutrition », depuis la page détaillée
  // de l'objectif). Lu après le montage : le rendu serveur reste celui de l'onglet par défaut.
  useEffect(() => {
    const o = new URLSearchParams(window.location.search).get("onglet");
    if (o === "nutrition" || o === "poids" || o === "kine") setTab(o);
  }, []);
  const [view, setView] = useState<"face" | "dos">("face");
  /** États mis à jour depuis cet écran, avant le prochain chargement de la page. */
  const [majEtats, setMajEtats] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  /**
   * « Ça va mieux », « ça empire », « c'est passé ».
   *
   * ⚠️ ON N'AFFICHE LE CHANGEMENT QU'UNE FOIS ÉCRIT. Une mise à jour optimiste
   * afficherait « c'est passé » alors que le serveur a refusé — et l'athlète croirait
   * que son plan va se rouvrir alors qu'il restera allégé.
   */
  async function majEtatDouleur(id: string, etat: string) {
    setEnCours(id);
    try {
      const r = await fetch("/api/health/douleur", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, etat }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) { toast.error(tr("k.etatErr")); return; }
      setMajEtats((m) => ({ ...m, [id]: etat }));
      toast.success(tr(etat === "resolu" ? "k.etatPasse" : "k.etatOk"));
    } catch {
      toast.error(tr("k.etatErr"));
    } finally {
      setEnCours(null);
    }
  }
  /**
   * « C'est passé » pour une douleur cochée après une séance (/api/health/douleur-seance).
   * Comme pour les douleurs déclarées : l'écran ne change qu'une fois l'écriture faite, et
   * un clic de trop se reprend (« Annuler ») tant qu'on reste sur l'écran.
   */
  const [seancePassees, setSeancePassees] = useState<Record<string, boolean>>({});
  async function majDouleurSeance(zone: string, passee: boolean) {
    setEnCours(`seance:${zone}`);
    try {
      const r = await fetch("/api/health/douleur-seance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone, annuler: !passee }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) { toast.error(tr("k.etatErr")); return; }
      setSeancePassees((m) => ({ ...m, [zone]: passee }));
      if (passee) toast.success(tr("k.etatPasse"));
    } catch {
      toast.error(tr("k.etatErr"));
    } finally {
      setEnCours(null);
    }
  }
  const fichesAffichees = fichesPour(douleurs.map((d) => d.cle), lang);

  // ── LES CONSIGNES DU KINÉSITHÉRAPEUTE (/api/health/consignes) ─────────────────────────
  // Comme partout ici : l'écran ne change qu'une fois l'écriture faite.
  const [cons, setCons] = useState({
    dureeMaxMin: consignes?.dureeMaxMin != null ? String(consignes.dureeMaxMin) : "",
    seancesMaxSemaine: consignes?.seancesMaxSemaine != null ? String(consignes.seancesMaxSemaine) : "",
    sansIntensite: consignes?.sansIntensite ?? false,
    jusquAu: consignes?.jusquAu ?? "",
  });
  const [consActives, setConsActives] = useState<string | null>(consignes?.jusquAu ?? null);
  async function envoyerConsignes(retirer: boolean) {
    setEnCours("consignes");
    try {
      const r = await fetch("/api/health/consignes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retirer ? { retirer: true } : {
          dureeMaxMin: cons.dureeMaxMin === "" ? null : Number(cons.dureeMaxMin),
          seancesMaxSemaine: cons.seancesMaxSemaine === "" ? null : Number(cons.seancesMaxSemaine),
          sansIntensite: cons.sansIntensite, jusquAu: cons.jusquAu,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        const motif = typeof j?.error === "string" && ["duree", "seances", "date", "vide"].includes(j.error) ? `k.consErr.${j.error}` : "k.etatErr";
        toast.error(tr(motif));
        return;
      }
      setConsActives(retirer ? null : cons.jusquAu);
      if (retirer) setCons({ dureeMaxMin: "", seancesMaxSemaine: "", sansIntensite: false, jusquAu: "" });
      // « Recalculé » seulement si la route l'a fait (essai expiré, contexte refusé : non).
      toast.success(tr(j.replanifie === true
        ? (retirer ? "k.consRetirees" : "k.consOk")
        : (retirer ? "k.consRetireesAttente" : "k.consAttente")));
      router.refresh();
    } catch {
      toast.error(tr("k.etatErr"));
    } finally {
      setEnCours(null);
    }
  }
  /** Une date AAAA-MM-JJ lisible, identique côté serveur et navigateur (fuseau UTC fixe). */
  const dateLisible = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang, { timeZone: "UTC", day: "numeric", month: "long" });
  /** Le libellé d'une douleur : traduit côté serveur (ressenti), ou la zone du schéma. */
  const libelleDouleur = (d: (typeof douleurs)[number]) => {
    if (d.source === "seance") return d.libelle?.[lang] ?? d.cle;
    const [vue, emplacement] = d.cle.split(":");
    return emplacement ? tr(`${vue === "dos" ? "zd" : "zf"}.${emplacement}`) : (d.zone ?? d.cle);
  };
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [painLevel, setPainLevel] = useState(5);

  /** Sur téléphone, le schéma corporel s'ouvre à la demande : il prenait tout l'écran. */
  const [schemaOuvert, setSchemaOuvert] = useState(false);

  const zoneMap = VIEW_ZONES[view];
  const selectedZone = selectedSlot ? zoneMap[selectedSlot] : null;


  // ── DÉCLARER UNE DOULEUR, SANS IA (09/11/2026, lib/health/kineIa) ─────────────────
  // La consultation du « kiné IA » est retirée ; la déclaration, elle, reste : c'est elle qui
  // allège le plan. Zone et intensité, rien d'autre — ni diagnostic, ni traitement.
  const router = useRouter();
  const [declEnCours, setDeclEnCours] = useState(false);
  const declarer = async () => {
    if (!selectedZone || !selectedSlot || declEnCours) return;
    setDeclEnCours(true);
    try {
      const r = await fetch("/api/health/declarer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: tr(selectedZone.labelKey), zoneKey: `${view}:${selectedSlot}`, painLevel }),
      });
      if (r.ok) { toast.success(tr("k.declOk")); router.refresh(); } else toast.error(tr("k.declErr"));
    } catch { toast.error(tr("k.declErr")); } finally { setDeclEnCours(false); }
  };

  return (
    <div className="space-y-5">
      {/* ⚠️ Un historique vide par accident se lit comme « l'app a oublié mes douleurs ». */}
      {enPanne && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
          <p className="text-rose-800">{tr("h.enPanne")}</p>
        </div>
      )}
      {/* En-tête — hero */}
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-500 sm:h-11 sm:w-11">
          <Heart className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">{tr("h.title")}</h1>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500 sm:text-sm">{tr("h.subtitle")}</p>
        </div>
      </div>

      {/* Onglets — pastille active qui glisse en douceur */}
      {/* Défilement horizontal sur téléphone : cinq onglets à icône ne tiennent pas dans
          375 px, et `flex-wrap` les cassait sur deux lignes au-dessus du contenu. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100/80 p-1 ring-1 ring-zinc-200/60 [scrollbar-width:none] sm:mx-0 sm:w-fit sm:overflow-visible">
        {([
          { v: "kine", l: tr("tab.kine"), icon: Activity },
          { v: "recup", l: tr("tab.recup"), icon: Moon },
          { v: "nutrition", l: tr("tab.nutrition"), icon: Utensils },
          { v: "poids", l: tr("tab.poids"), icon: Scale },
        ] as const).map((t) => {
          const active = tab === t.v;
          return (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`relative flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors sm:px-5 ${active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}>
              {active && (
                <motion.span layoutId="health-tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_16px_-8px_rgba(16,24,40,0.18)]" />
              )}
              <span className="relative flex items-center gap-2"><t.icon className="h-4 w-4" /> {t.l}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ── KINÉ IA ── */}
        {tab === "kine" && (
          <motion.div key="kine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}
            // ⚠️ SUR TÉLÉPHONE, LA CONSULTATION D'ABORD (22/09/2026). Le schéma corporel
            // et sa liste de 24 zones occupaient le premier écran entier : le chat — ce
            // pour quoi on ouvre l'onglet — commençait sous la ligne de flottaison.
            // `order` remet le chat en tête sous lg ; la grille à 12 colonnes n'existe
            // qu'à partir de lg (sinon 11 gouttières dans 287 px, cf. la page Cours).
            className="grid grid-cols-1 gap-4 lg:grid-cols-12">

            {/* Schéma corporel + sélection de zone */}
            <div className="order-2 space-y-4 lg:order-none lg:col-span-5">
              <div className="bento-card">
                <div className="flex items-center justify-between mb-1">
                  <button type="button" onClick={() => setSchemaOuvert((v) => !v)} aria-expanded={schemaOuvert}
                    className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 lg:pointer-events-none">
                    {tr("k.where")}
                    <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform lg:hidden ${schemaOuvert ? "rotate-180" : ""}`} />
                  </button>
                  <div className="flex gap-0.5 p-0.5 bg-zinc-100 rounded-lg text-xs font-semibold">
                    {(["face", "dos"] as const).map((v) => (
                      <button key={v} onClick={() => setView(v)}
                        className={`px-3 py-1 rounded-md transition-colors ${view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                        {v === "face" ? tr("view.face") : tr("view.dos")}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mb-2">{tr("k.hint")}</p>

                <div className={`${schemaOuvert ? "" : "hidden lg:block"}`}>
                <div className="grid grid-cols-12 gap-3 items-start">
                  {/* Silhouette interactive */}
                  <div className="col-span-5">
                    <svg viewBox="0 0 200 470" className="w-full" style={{ maxHeight: 430 }}>
                      <defs>
                        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#eef2f6" />
                          <stop offset="100%" stopColor="#dfe3e8" />
                        </linearGradient>
                      </defs>
                      {SHAPES.map(({ slot, tag, p }) => {
                        const on = selectedSlot === slot;
                        // La zone déjà déclarée reste visible sur le corps : c'est la même
                        // mémoire que celle du kiné, pas une seconde source.
                        const vu = suivi.find((z) => z.cle === `${view}:${slot}`);
                        // ⚠️ LA COULEUR DOIT DIRE CE QUE DIT LE SUIVI. Une zone en
                        // aggravation et une zone qui va mieux étaient peintes du même
                        // ambre : le corps affichait « il s'est passé quelque chose ici »
                        // là où la carte juste en dessous disait « ça empire ».
                        const teinteVue = vu ? TEINTE_TENDANCE[vu.tendance] : null;
                        const common = {
                          fill: on ? teinteDouleur(painLevel) : teinteVue ? teinteVue.fond : "url(#bodyGrad)",
                          stroke: on ? "#b91c1c" : teinteVue ? teinteVue.trait : "#cbd1d8",
                          strokeWidth: on || vu ? 1.5 : 1,
                          className: "cursor-pointer transition hover:opacity-70",
                          onClick: () => setSelectedSlot(on ? null : slot),
                        };
                        return tag === "ellipse"
                          ? <ellipse key={slot} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...common} />
                          : <rect key={slot} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...common} />;
                      })}
                    </svg>
                  </div>
                  {/* Liste des zones par région (sélection précise) */}
                  <div className="col-span-7 max-h-[430px] overflow-y-auto pr-1 space-y-2">
                    {GROUP_ORDER.map((g) => (
                      <div key={g}>
                        <div className="text-[11px] font-semibold text-zinc-400 mb-1 first-letter:uppercase">{tr(g)}</div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(zoneMap).filter(([, z]) => z.groupKey === g).map(([slot, z]) => (
                            <button key={slot} onClick={() => setSelectedSlot(selectedSlot === slot ? null : slot)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                selectedSlot === slot ? "bg-red-500 text-white"
                                  : suivi.some((v) => v.cle === `${view}:${slot}` && v.tendance === "aggravation") ? "bg-red-100 text-red-800 ring-1 ring-red-200 hover:bg-red-200"
                                  : suivi.some((v) => v.cle === `${view}:${slot}` && v.tendance === "amelioration") ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-200"
                                  : suivi.some((v) => v.cle === `${view}:${slot}`) ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-200"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                              {tr(z.labelKey)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                </div>
                {selectedZone ? (
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <label htmlFor={`${cid}-r0`} className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("k.pain")} — <span className="font-semibold text-zinc-800">{tr(selectedZone.labelKey)}</span> : <span className="font-semibold" style={{ color: teinteDouleur(painLevel) }}>{painLevel}/10</span></label>
                    {/* Le curseur porte la MÊME couleur que la zone sur la silhouette : deux
                        barèmes différents pour une seule douleur se contrediraient à l'écran. */}
                    <input id={`${cid}-r0`} type="range" min={1} max={10} value={painLevel} onChange={(e) => setPainLevel(+e.target.value)}
                      className="w-full" style={{ accentColor: teinteDouleur(painLevel) }} />
                    <div className="flex justify-between text-[11px] text-zinc-400 mt-0.5"><span>{tr("k.painLight")}</span><span>{tr("k.painHard")}</span></div>
                    <>
                      <button onClick={declarer} disabled={declEnCours || painLevel < SEUIL_DOULEUR_DECLAREE} className="btn-brand w-full justify-center mt-3 text-sm disabled:opacity-50">
                        {declEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" strokeWidth={1.5} />} {tr("k.declarer")}
                      </button>
                      {painLevel < SEUIL_DOULEUR_DECLAREE && <p className="mt-2 text-center text-[11px] text-zinc-500">{tr("k.seuil")}</p>}
                    </>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 text-center mt-3 pt-3 border-t border-zinc-100">{tr("k.noZone")}</p>
                )}
              </div>

              {/* ══ CE QUI PÈSE SUR TON PLAN AUJOURD'HUI (Santé, lot 1, 10/11/2026) ═══════════════
                  UNE seule liste : les douleurs déclarées sur le schéma ET celles cochées après une
                  séance (lib/health/santeDouleurs). Deux listes se contredisaient (« aucune douleur
                  déclarée » au-dessus d'un tibia signalé). Puis ce que le coach a changé, quand
                  consulter, et la charge des semaines d'avant — des faits, aucun diagnostic. */}
              <div className="bento-card space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-zinc-900">{tr("k.pese")}</h3>
                </div>
                {douleurs.length === 0 ? (
                  <p className="text-xs text-zinc-400">{tr("k.peseAucune")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {douleurs.map((d) => {
                      const cleBouton = d.source === "seance" ? `seance:${d.cle}` : d.id ?? d.cle;
                      const passeeSeance = d.source === "seance" && seancePassees[d.cle] === true;
                      const courant = d.id ? (majEtats[d.id] ?? d.etat) : undefined;
                      return (
                        <div key={`${d.source}:${d.cle}`} className="rounded-xl bg-zinc-50 px-2.5 py-2">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-medium text-zinc-900">{libelleDouleur(d)}</div>
                              <div className="text-[11px] text-zinc-400">
                                {d.depuisJours <= 0 ? tr("k.suiviToday") : tr("k.suiviSince", { n: d.depuisJours })}
                                {d.source === "seance" && ` · ${tr("k.srcSeance")}`}
                              </div>
                            </div>
                            {d.source === "declaree" && d.dernier != null && (
                              <div className="flex items-center gap-1 text-[13px] font-semibold tabular-nums text-zinc-700">
                                {(d.signalements ?? 0) > 1 && <><span className="text-zinc-400">{d.premier}</span><span className="text-zinc-300">→</span></>}
                                <span>{d.dernier}</span><span className="text-[11px] font-medium text-zinc-400">/10</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {d.source === "seance" ? (
                              passeeSeance ? (
                                <>
                                  <span className="text-[11px] font-medium text-emerald-700">{tr("k.etatPasse")}</span>
                                  <button type="button" disabled={enCours === cleBouton} onClick={() => majDouleurSeance(d.cle, false)}
                                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                                    {tr("k.annuler")}
                                  </button>
                                </>
                              ) : (
                                <button type="button" disabled={enCours === cleBouton} onClick={() => majDouleurSeance(d.cle, true)}
                                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 disabled:opacity-50">
                                  {tr("k.passe")}
                                </button>
                              )
                            ) : d.id && courant === "resolu" ? (
                              <>
                                <span className="text-[11px] font-medium text-emerald-700">{tr("k.etatPasse")}</span>
                                <button type="button" disabled={enCours === d.id} onClick={() => majEtatDouleur(d.id!, "actif")}
                                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                                  {tr("k.annuler")}
                                </button>
                              </>
                            ) : d.id ? (
                              ([["mieux", "k.mieux"], ["pire", "k.pire"], ["resolu", "k.passe"]] as const).map(([val, cle]) => (
                                <button key={val} type="button" disabled={enCours === d.id} onClick={() => majEtatDouleur(d.id!, val)}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-colors disabled:opacity-50 ${
                                    courant === val ? "bg-zinc-900 text-white ring-zinc-900"
                                    : val === "resolu" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                                    : val === "pire" ? "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100"
                                    : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}>
                                  {tr(cle)}
                                </button>
                              ))
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ce que le coach a changé : relu dans l'état du coach, jamais déduit du texte. */}
                {douleurs.length > 0 && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                    <div className="text-[12px] font-semibold text-emerald-900">{tr("k.effets")}</div>
                    {effets ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-emerald-900">
                        {effets.qualiteRetiree > 0 && <li>{tr("k.effetQualite", { n: effets.qualiteRetiree })}</li>}
                        {effets.sortieLongue && <li>{tr("k.effetLongue", { a: effets.sortieLongue.prevueKm, b: effets.sortieLongue.reduiteKm })}</li>}
                        {effets.lignesDroites && <li>{tr("k.effetLignes")}</li>}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[12px] text-emerald-900">{tr("k.effetsAttente")}</p>
                    )}
                  </div>
                )}

                {/* Quand consulter : un délai, ou ce qu'il déclare (« ça empire »). */}
                {rappel && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    <p>{rappel.motif === "pire" ? tr("k.consulterPire") : tr("k.consulterDuree", { n: JOURS_AVANT_CONSULTER })}</p>
                    <a href={ANNUAIRE_KINE} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold underline-offset-2 hover:underline">
                      {tr("k.kineAnnuaire")} →
                    </a>
                  </div>
                )}

                {/* La charge d'avant : un chiffre d'entraînement, sans conclusion. */}
                {charge && douleurs.length > 0 && (
                  <div className="text-[12px] text-zinc-600">
                    {/* Aucune course avant la douleur : « 0 km, -100 % » ne dit rien d'utile (capture de
                        Cyprien, 10/11/2026) ; le fait lisible est que la douleur est apparue à la reprise. */}
                    <p>{charge.kmAvant === 0 && charge.kmPrecedent > 0
                      ? tr("k.chargeArret", { b: charge.kmPrecedent })
                      : charge.variationPct != null
                      ? tr("k.charge", { a: charge.kmAvant, b: charge.kmPrecedent, p: `${charge.variationPct > 0 ? "+" : ""}${charge.variationPct} %` })
                      : tr("k.chargeSeule", { a: charge.kmAvant })}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{tr("k.chargeAide")}</p>
                  </div>
                )}
              </div>

              {/* ══ LES CONSIGNES DE TON KINÉ — il fixe le cadre, le plan s'y tient ══════════════ */}
              <div className="bento-card space-y-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-zinc-900">{tr("k.consignes")}</h3>
                </div>
                <p className="text-[11px] text-zinc-500">{tr("k.consignesAide")}</p>
                {consActives && <p className="text-[12px] font-medium text-emerald-700">{tr("k.consActives", { d: dateLisible(consActives) })}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <label htmlFor={`${cid}-duree`} className="text-[11px] text-zinc-600">{tr("k.consDuree")}
                    <input id={`${cid}-duree`} type="number" inputMode="numeric" min={15} max={240} value={cons.dureeMaxMin}
                      onChange={(e) => setCons((c) => ({ ...c, dureeMaxMin: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] text-zinc-900" />
                  </label>
                  <label htmlFor={`${cid}-seances`} className="text-[11px] text-zinc-600">{tr("k.consSeances")}
                    <input id={`${cid}-seances`} type="number" inputMode="numeric" min={1} max={7} value={cons.seancesMaxSemaine}
                      onChange={(e) => setCons((c) => ({ ...c, seancesMaxSemaine: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] text-zinc-900" />
                  </label>
                </div>
                <label htmlFor={`${cid}-intensite`} className="flex items-center gap-2 text-[12px] text-zinc-700">
                  <input id={`${cid}-intensite`} type="checkbox" checked={cons.sansIntensite}
                    onChange={(e) => setCons((c) => ({ ...c, sansIntensite: e.target.checked }))} className="h-4 w-4 rounded border-zinc-300" />
                  {tr("k.consSansIntensite")}
                </label>
                <label htmlFor={`${cid}-jusqu`} className="block text-[11px] text-zinc-600">{tr("k.consJusqu")}
                  <input id={`${cid}-jusqu`} type="date" value={cons.jusquAu}
                    onChange={(e) => setCons((c) => ({ ...c, jusquAu: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] text-zinc-900" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={enCours === "consignes"} onClick={() => envoyerConsignes(false)}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                    {tr("k.consEnregistrer")}
                  </button>
                  {consActives && (
                    <button type="button" disabled={enCours === "consignes"} onClick={() => envoyerConsignes(true)}
                      className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                      {tr("k.consRetirer")}
                    </button>
                  )}
                </div>
              </div>

              {/* ══ LE CARNET POUR LE RENDEZ-VOUS (page imprimable) ══════════════════════════════ */}
              <Link href="/dashboard/health/carnet" className="bento-card block transition-colors hover:bg-zinc-50">
                <div className="text-sm font-semibold text-zinc-900">{tr("k.carnet")} →</div>
                <p className="mt-1 text-[11px] text-zinc-500">{tr("k.carnetAide")}</p>
              </Link>

            {/* ══ LA BIBLIOTHÈQUE DE FICHES SIGNÉES (lib/health/fichesKine) ═══════════════════
                Ouverte à tous, identiques pour tous, chacune signée par un kinésithérapeute ;
                celles de la région signalée en tête. Aucune fiche sans signature ; aucune IA
                ne choisit ni ne modifie le texte publié. */}
            {fichesAffichees.length > 0 && (
              <div className="bento-card space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-zinc-900">{tr("k.fiches")}</h3>
                </div>
                <p className="text-[11px] text-zinc-500">{tr("k.ficheAvert")}</p>
                {fichesAffichees.map((f) => (
                  <details key={f.id} className="rounded-xl bg-zinc-50 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <summary className="cursor-pointer list-none text-[13px] font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
                      {f.titre}
                      {f.regionSignalee && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{tr("k.ficheRegion")}</span>}
                    </summary>
                    <p className="mt-1.5 text-[13px] text-zinc-600">{f.resume}</p>
                    {f.sections.map((sec) => (
                      <div key={sec.titre} className="mt-2">
                        <div className="text-[12px] font-semibold text-zinc-800">{sec.titre}</div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-zinc-600">
                          {sec.points.map((pt) => <li key={pt}>{pt}</li>)}
                        </ul>
                      </div>
                    ))}
                    <p className="mt-2 text-[11px] text-zinc-400">{tr("k.ficheSignee", { nom: f.signataire, rpps: f.rpps, d: new Date(`${f.relueLe}T12:00:00Z`).toLocaleDateString(lang, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }) })}{f.remuneree && ` ${tr("k.ficheRemuneree")}`}</p>
                  </details>
                ))}
              </div>
            )}

            </div>

            {/* Ce que Pacevo est et n'est pas : la consultation du « kiné IA » est retirée (lib/health/kineIa). */}
            <div className="order-1 bento-card space-y-3 lg:order-none lg:col-span-7">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100"><AlertTriangle className="h-5 w-5 text-amber-600" strokeWidth={1.5} /></span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900">{tr("k.avisTitre")}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{tr("k.avis")}</p>
                  {/* L'ORIENTATION, PAS LE SOIN (10/11/2026) : l'annuaire officiel de l'Ordre, sans
                      partenaire ni affiliation. Pacevo dirige vers un professionnel, il ne soigne pas. */}
                  <a href={ANNUAIRE_KINE} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline">
                    {tr("k.kineAnnuaire")} →
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{tr("k.alerte")}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── RÉCUPÉRATION ── (lot 2 : bilan du matin, forme, VFC, sommeil, FC de repos) */}
        {tab === "recup" && recup && (
          <motion.div key="recup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Recuperation d={recup} />
          </motion.div>
        )}

        {/* ── NUTRITION ── (lib/coach/nutritionCourse : les mêmes chiffres que le coach) */}
        {tab === "nutrition" && (
          <motion.div key="nutrition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <NutritionCourse courses={coursesNutrition} poidsKg={poidsKg} />
          </motion.div>
        )}

        {/* ── PERTE DE POIDS ── */}
        {tab === "poids" && <WeightMode key="poids" />}
      </AnimatePresence>
    </div>
  );
}
