"use client";

import { useState, useRef, useEffect, useCallback , useId } from "react";
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from "framer-motion";
import {
  Shield, Heart, Utensils, Stethoscope, AlertTriangle,
  Phone, CheckCircle2, Zap, Droplets, BookOpen, Send, Loader2, Sparkles, Scale, Camera, X, Activity,
  MapPin, ListChecks, ClipboardList, CalendarPlus, RotateCcw, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { SmartJournal } from "@/components/journal/SmartJournal";
import { WeightMode } from "@/components/health/WeightMode";
import { useT } from "@/lib/i18n/LanguageProvider";
import { RichText } from "@/components/ui/RichText";
import type { SuiviZone, Tendance } from "@/lib/health/douleurs";
import type { Bilan } from "@/lib/health/bilan";

// ── i18n local (5 langues) — la page Santé naît traduite. ───────────────────────
type Tr = (k: string, p?: Record<string, string | number>) => string;
function fill(s: string, p?: Record<string, string | number>) {
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s;
}
const H: Record<string, Record<string, string>> = {
  fr: {
    "h.enPanne": "Tes douleurs déclarées n'ont pas pu être chargées. Cet historique paraît vide, mais rien n'est perdu — réessaie dans un instant.", "h.title": "Santé & Performance", "h.subtitle": "Votre kiné IA, votre journal, votre sécurité et votre nutrition — au même endroit.",
    "tab.kine": "Kiné IA", "tab.journal": "Journal", "tab.guardian": "Sécurité", "tab.nutrition": "Nutrition", "tab.poids": "Poids",
    "k.where": "Où as-tu mal ?", "view.face": "Face", "view.dos": "Dos",
    "k.hint": "Touche une zone sur le corps ou dans la liste, ajuste la douleur, puis demande au kiné.",
    "k.pain": "Douleur", "k.painLight": "Gêne légère", "k.painHard": "Très douloureux",
    "k.ask": "Demander au kiné IA", "k.noZone": "Aucune zone sélectionnée",
    "k.protoExpress": "Protocole express", "k.protoWait": "Protocole d'attente — pour un plan précis, décris ta douleur au kiné IA ci-contre.",
    "k.suivi": "Suivi de tes douleurs", "k.suiviNone": "Aucune douleur déclarée ces 60 derniers jours.", "k.suiviSince": "depuis {n} j", "k.suiviToday": "aujourd'hui", "k.suiviAgo": "il y a {n} j", "trend.amelioration": "en amélioration", "trend.aggravation": "en aggravation", "trend.stable": "stable", "trend.inconnue": "1re déclaration", "chat.starters": "Pour démarrer", "chat.s1": "J'ai une douleur qui revient à chaque sortie longue.", "chat.s2": "Comment adapter ma semaine avec cette douleur ?", "chat.s3": "Quels exercices de prévention pour mes tendons ?",
    "chat.title": "Kiné IA", "chat.sub": "Réponses personnalisées selon ta charge & ta récup",
    "chat.seed": "Bonjour ! Je suis votre kiné du sport. Décrivez-moi ce que vous ressentez — zone, depuis quand, à l'effort ou au repos — ou cliquez une zone sur le schéma, et je vous aide.",
    "chat.thinking": "Le kiné réfléchit…", "chat.placeholder": "Ex : douleur au genou après mes sorties longues…", "chat.photoAdd": "Ajouter une photo", "chat.photoRemove": "Retirer la photo", "chat.photoReady": "Photo prête. Elle est analysée puis oubliée : rien n'est enregistré. Cadre serré sur la zone, en pleine lumière.", "chat.photoBadType": "Image illisible. Formats acceptés : JPEG, PNG, WebP, GIF.", "chat.photoOnly": "Peux-tu regarder cette photo ?",
    "chat.disclaimer": "⚕️ Conseils informatifs — ne remplacent pas un avis médical. Douleur forte / persistante → consultez.",
    "chat.errNoReply": "Je n'ai pas pu répondre, réessayez.", "chat.errConn": "Connexion impossible au kiné IA. Réessayez.",
    "k.askPrompt": "J'ai une douleur au niveau : {zone} (intensité {n}/10). Qu'est-ce que ça peut être, et que dois-je faire concrètement ?",
    "sec.title": "Sécurité en course", "sec.sub": "Ce que Pacevo fait vraiment pour ta sécurité — et ce qui reste entre tes mains.",
    "sec.live": "Partage ta position en direct", "sec.liveDesc": "Depuis la Carte, un lien de suivi envoie ta position en temps réel à un proche — sans compte ni installation de son côté.", "sec.liveBtn": "Ouvrir la Carte",
    "sec.contact": "Contact d'urgence", "sec.contactDesc": "Enregistré dans tes réglages et affiché ici. Pacevo n'appelle et n'écrit à personne : en cas de problème, c'est toi — ou un témoin — qui appelle.",
    "gd.name": "Prénom Nom", "gd.namePh": "Jean Dupont", "gd.phone": "Téléphone", "gd.saveContact": "Enregistrer le contact", "gd.savedContact": "Contact enregistré.", "sec.saveFail": "Contact non enregistré — réessaie.", "sec.call": "Appeler",
    "sec.honest": "Pacevo ne détecte pas les chutes et n'alerte personne automatiquement : aucune application ne le fait sans le matériel dédié. La détection d'incident de ta montre (Garmin, Apple, Coros…) reste la référence — active-la là-bas.",
    "sec.kit": "Avant une sortie en montagne", "sec.k1": "Dis à quelqu'un où tu vas et quand tu rentres.", "sec.k2": "Téléphone chargé, sifflet, couverture de survie, veste imperméable.", "sec.k3": "Eau et sel sur les longues sorties par chaleur ; boire à la soif.", "sec.k4": "Numéros d'urgence : 112 (Europe), 15 SAMU, 18 pompiers.", "sec.k5": "Lampe et vêtement réfléchissant dès la pénombre.",
    "k.etatQ": "{z} — où en es-tu ?", "k.mieux": "Ça va mieux", "k.pire": "Ça empire", "k.passe": "C'est passé", "k.etatOk": "C'est noté — ton coach en tient compte.", "k.etatPasse": "Noté : cette douleur ne bride plus ton plan.", "k.etatErr": "Mise à jour impossible. Réessaie.",
    "chat.new": "Nouvelle consultation", "chat.newConfirm": "Effacer la conversation ? Tes douleurs déclarées restent dans ton suivi.", "chat.resumed": "Consultation précédente reprise — le kiné se souvient de vos échanges.", "chat.newFail": "Effacement impossible, réessaie.",
    "k.mapOpen": "Où as-tu mal ? Montrer le schéma", "k.mapClose": "Masquer le schéma", "k.zoneChip": "{zone} · {n}/10",
    "bilan.title": "Bilan de la consultation", "bilan.hyp": "Hypothèses", "bilan.urgent": "Drapeau rouge : consulte rapidement un médecin. Le kiné IA ne remplace pas un avis médical.", "bilan.exos": "Exercices", "bilan.charge": "Charge", "bilan.reprise": "Reprise",
    "bilan.plan": "Programmer 2 semaines dans mon calendrier", "bilan.planned": "{n} séances ajoutées au calendrier (un jour sur deux).", "bilan.planFail": "Le calendrier n'a pas pu être écrit.", "bilan.voirCal": "Voir le calendrier",
    "bilan.proba.haute": "probable", "bilan.proba.moyenne": "possible", "bilan.proba.faible": "peu probable",
    "n.title": "Nutrition Lab — Stratégie de course", "n.duration": "Durée de l'épreuve (heures)", "n.temp": "Température prévue (°C)",
    "n.carbs": "g glucides/h", "n.water": "ml eau/h", "n.sodium": "mg sodium/h", "n.caffeine": "mg caféine total", "n.plan": "Plan de ravitaillement", "n.total": "Total course",
    "n.food1": "Gel énergétique + eau", "n.food2": "Barre + compote + eau", "n.food3": "Gel + eau + électrolytes",
    "grp.upper": "Haut du corps", "grp.trunk": "Tronc", "grp.pelvis": "Bassin", "grp.thighs": "Cuisses", "grp.knees": "Genoux", "grp.legs": "Jambes", "grp.feet": "Pieds",
    "zf.head": "Tête", "zf.neck": "Cou / cervicales", "zf.shoulderL": "Épaule gauche", "zf.shoulderR": "Épaule droite", "zf.armL": "Bras gauche", "zf.armR": "Bras droit", "zf.chest": "Poitrine", "zf.abs": "Abdominaux / core", "zf.hipL": "Hanche / aine gauche", "zf.hipR": "Hanche / aine droite", "zf.thighL": "Quadriceps gauche", "zf.thighR": "Quadriceps droit", "zf.kneeL": "Genou gauche", "zf.kneeR": "Genou droit", "zf.shinL": "Tibia gauche", "zf.shinR": "Tibia droit", "zf.ankleL": "Cheville gauche", "zf.ankleR": "Cheville droite", "zf.footL": "Pied gauche", "zf.footR": "Pied droit",
    "zd.head": "Nuque", "zd.neck": "Cervicales", "zd.shoulderL": "Trapèze gauche", "zd.shoulderR": "Trapèze droit", "zd.armL": "Triceps gauche", "zd.armR": "Triceps droit", "zd.chest": "Haut du dos", "zd.abs": "Bas du dos / lombaires", "zd.hipL": "Fessier gauche", "zd.hipR": "Fessier droit", "zd.thighL": "Ischio-jambier gauche", "zd.thighR": "Ischio-jambier droit", "zd.kneeL": "Arrière-genou gauche", "zd.kneeR": "Arrière-genou droit", "zd.shinL": "Mollet gauche", "zd.shinR": "Mollet droit", "zd.ankleL": "Tendon d'Achille gauche", "zd.ankleR": "Tendon d'Achille droit", "zd.footL": "Talon gauche", "zd.footR": "Talon droit",
    "ex.knee.1n": "Squat isométrique au mur", "ex.knee.1d": "Dos au mur, cuisses ~parallèles — maintien 45 s", "ex.knee.2n": "Pont fessier + abduction", "ex.knee.2d": "Bridge au sol, ouvre les genoux en haut", "ex.knee.3n": "Step-down contrôlé", "ex.knee.3d": "Descente lente d'une marche, genou aligné",
    "ex.shin.1n": "Relevés de pointes (tibial ant.)", "ex.shin.1d": "Monte les pointes lentement, talons au sol", "ex.shin.2n": "Étirement mollet au mur", "ex.shin.2d": "Jambe arrière tendue, talon au sol — 30 s", "ex.shin.3n": "Automassage du tibia", "ex.shin.3d": "Foam roller doux le long du tibia (60 s/côté)",
    "ex.calf.1n": "Mollets excentriques (marche)", "ex.calf.1d": "Montée 2 pieds, descente lente sur 1 pied", "ex.calf.2n": "Isométrie sur pointe", "ex.calf.2d": "Sur la pointe de pied, maintien 30 s", "ex.calf.3n": "Étirement soléaire genou fléchi", "ex.calf.3d": "Au mur, genou légèrement plié — 30 s",
    "ex.ischio.1n": "Nordic hamstring (assisté)", "ex.ischio.1d": "Descente lente contrôlée, freine la chute", "ex.ischio.2n": "Pont fessier 1 jambe", "ex.ischio.2d": "Bascule le bassin, jambe libre tendue", "ex.ischio.3n": "Étirement ischios doux", "ex.ischio.3d": "Jambe tendue, dos droit, sans à-coup",
    "ex.back.1n": "Cat-Cow", "ex.back.1d": "À quatre pattes, enroule puis cambre en douceur", "ex.back.2n": "Gainage frontal", "ex.back.2d": "Planche — dos neutre, 30 s", "ex.back.3n": "Étirement psoas (fente basse)", "ex.back.3d": "Bascule le bassin — 30 s par côté",
    "ex.foot.1n": "Roulage voûte plantaire", "ex.foot.1d": "Balle / bouteille froide sous le pied — 60 s", "ex.foot.2n": "Renfo pieds (towel curls)", "ex.foot.2d": "Attrape une serviette avec les orteils", "ex.foot.3n": "Mollets excentriques", "ex.foot.3d": "Descente lente sur une marche",
    "ex.hip.1n": "Clamshell (coquille)", "ex.hip.1d": "Sur le côté, ouvre le genou, bassin stable", "ex.hip.2n": "Abduction debout (élastique)", "ex.hip.2d": "Écarte la jambe, gainage actif", "ex.hip.3n": "Étirement fléchisseurs / adducteurs", "ex.hip.3d": "30 s par côté, sans douleur",
    "ex.quad.1n": "Squat tempo", "ex.quad.1d": "Descente lente 3 s, remontée contrôlée", "ex.quad.2n": "Étirement quadriceps debout", "ex.quad.2d": "Talon vers la fesse, bassin rétroversé", "ex.quad.3n": "Fentes avant", "ex.quad.3d": "Genou aligné — 10 par jambe",
    "ex.def.1n": "Mobilité articulaire douce", "ex.def.1d": "Amplitudes progressives, sans douleur", "ex.def.2n": "Protocole PEACE & LOVE", "ex.def.2d": "Protège, élève, charge progressive, vascularise",
  },
  en: {
    "h.enPanne": "Your reported pains could not be loaded. This history looks empty, but nothing is lost — try again in a moment.", "h.title": "Health & Performance", "h.subtitle": "Your AI physio, your journal, your safety and your nutrition — all in one place.",
    "tab.kine": "AI Physio", "tab.journal": "Journal", "tab.guardian": "Safety", "tab.nutrition": "Nutrition", "tab.poids": "Weight",
    "k.where": "Where does it hurt?", "view.face": "Front", "view.dos": "Back",
    "k.hint": "Tap a zone on the body or in the list, adjust the pain, then ask the physio.",
    "k.pain": "Pain", "k.painLight": "Mild discomfort", "k.painHard": "Very painful",
    "k.ask": "Ask the AI physio", "k.noZone": "No zone selected",
    "k.protoExpress": "Express protocol", "k.protoWait": "Stopgap protocol — for a precise plan, describe your pain to the AI physio on the right.",
    "k.suivi": "Your pain history", "k.suiviNone": "No pain reported in the last 60 days.", "k.suiviSince": "for {n} d", "k.suiviToday": "today", "k.suiviAgo": "{n} d ago", "trend.amelioration": "improving", "trend.aggravation": "worsening", "trend.stable": "stable", "trend.inconnue": "1st report", "chat.starters": "Get started", "chat.s1": "I get a recurring pain on every long run.", "chat.s2": "How should I adjust my week with this pain?", "chat.s3": "Which prevention exercises for my tendons?",
    "chat.title": "AI Physio", "chat.sub": "Answers tailored to your load & recovery",
    "chat.seed": "Hello! I'm your sports physio. Tell me what you feel — area, since when, on exertion or at rest — or click a zone on the diagram, and I'll help.",
    "chat.thinking": "The physio is thinking…", "chat.placeholder": "E.g. knee pain after my long runs…", "chat.photoAdd": "Add a photo", "chat.photoRemove": "Remove photo", "chat.photoReady": "Photo ready. It is analysed then forgotten: nothing is stored. Frame the area closely, in good light.", "chat.photoBadType": "Unreadable image. Accepted: JPEG, PNG, WebP, GIF.", "chat.photoOnly": "Could you look at this photo?",
    "chat.disclaimer": "⚕️ Informational advice — not a substitute for medical care. Severe / persistent pain → see a doctor.",
    "chat.errNoReply": "I couldn't reply, please try again.", "chat.errConn": "Couldn't connect to the AI physio. Try again.",
    "k.askPrompt": "I have pain in: {zone} (intensity {n}/10). What could it be, and what should I concretely do?",
    "sec.title": "Safety on the run", "sec.sub": "What Pacevo really does for your safety — and what stays in your hands.",
    "sec.live": "Share your live position", "sec.liveDesc": "From the Map, a tracking link sends your real-time position to someone close — no account or install on their side.", "sec.liveBtn": "Open the Map",
    "sec.contact": "Emergency contact", "sec.contactDesc": "Saved in your settings and shown here. Pacevo calls or messages nobody: if something happens, you — or a witness — make the call.",
    "gd.name": "First & last name", "gd.namePh": "John Smith", "gd.phone": "Phone", "gd.saveContact": "Save contact", "gd.savedContact": "Contact saved.", "sec.saveFail": "Contact not saved — try again.", "sec.call": "Call",
    "sec.honest": "Pacevo doesn't detect falls and alerts nobody automatically: no app does without dedicated hardware. Your watch's incident detection (Garmin, Apple, Coros…) remains the reference — enable it there.",
    "sec.kit": "Before a mountain outing", "sec.k1": "Tell someone where you go and when you'll be back.", "sec.k2": "Charged phone, whistle, survival blanket, waterproof jacket.", "sec.k3": "Water and salt on long hot runs; drink to thirst.", "sec.k4": "Emergency numbers: 112 (Europe).", "sec.k5": "Light and reflective clothing from dusk.",
    "k.etatQ": "{z} — how is it now?", "k.mieux": "Getting better", "k.pire": "Getting worse", "k.passe": "It's gone", "k.etatOk": "Noted — your coach takes it into account.", "k.etatPasse": "Noted: this pain no longer holds your plan back.", "k.etatErr": "Couldn't update. Try again.",
    "chat.new": "New consultation", "chat.newConfirm": "Clear the conversation? Your reported pains stay in your history.", "chat.resumed": "Previous consultation resumed — the physio remembers your exchanges.", "chat.newFail": "Couldn't clear, try again.",
    "k.mapOpen": "Where does it hurt? Show the body map", "k.mapClose": "Hide the body map", "k.zoneChip": "{zone} · {n}/10",
    "bilan.title": "Consultation summary", "bilan.hyp": "Hypotheses", "bilan.urgent": "Red flag: see a doctor promptly. The AI physio is no substitute for medical advice.", "bilan.exos": "Exercises", "bilan.charge": "Load", "bilan.reprise": "Return",
    "bilan.plan": "Schedule 2 weeks in my calendar", "bilan.planned": "{n} sessions added to the calendar (every other day).", "bilan.planFail": "The calendar couldn't be written.", "bilan.voirCal": "See the calendar",
    "bilan.proba.haute": "likely", "bilan.proba.moyenne": "possible", "bilan.proba.faible": "unlikely",
    "n.title": "Nutrition Lab — Race strategy", "n.duration": "Race duration (hours)", "n.temp": "Expected temperature (°C)",
    "n.carbs": "g carbs/h", "n.water": "ml water/h", "n.sodium": "mg sodium/h", "n.caffeine": "mg caffeine total", "n.plan": "Fueling plan", "n.total": "Race total",
    "n.food1": "Energy gel + water", "n.food2": "Bar + fruit purée + water", "n.food3": "Gel + water + electrolytes",
    "grp.upper": "Upper body", "grp.trunk": "Trunk", "grp.pelvis": "Pelvis", "grp.thighs": "Thighs", "grp.knees": "Knees", "grp.legs": "Legs", "grp.feet": "Feet",
    "zf.head": "Head", "zf.neck": "Neck / cervical", "zf.shoulderL": "Left shoulder", "zf.shoulderR": "Right shoulder", "zf.armL": "Left arm", "zf.armR": "Right arm", "zf.chest": "Chest", "zf.abs": "Abs / core", "zf.hipL": "Left hip / groin", "zf.hipR": "Right hip / groin", "zf.thighL": "Left quadriceps", "zf.thighR": "Right quadriceps", "zf.kneeL": "Left knee", "zf.kneeR": "Right knee", "zf.shinL": "Left shin", "zf.shinR": "Right shin", "zf.ankleL": "Left ankle", "zf.ankleR": "Right ankle", "zf.footL": "Left foot", "zf.footR": "Right foot",
    "zd.head": "Nape", "zd.neck": "Cervical", "zd.shoulderL": "Left trapezius", "zd.shoulderR": "Right trapezius", "zd.armL": "Left triceps", "zd.armR": "Right triceps", "zd.chest": "Upper back", "zd.abs": "Lower back / lumbar", "zd.hipL": "Left glute", "zd.hipR": "Right glute", "zd.thighL": "Left hamstring", "zd.thighR": "Right hamstring", "zd.kneeL": "Left popliteal", "zd.kneeR": "Right popliteal", "zd.shinL": "Left calf", "zd.shinR": "Right calf", "zd.ankleL": "Left Achilles tendon", "zd.ankleR": "Right Achilles tendon", "zd.footL": "Left heel", "zd.footR": "Right heel",
    "ex.knee.1n": "Wall isometric squat", "ex.knee.1d": "Back to wall, thighs ~parallel — hold 45 s", "ex.knee.2n": "Glute bridge + abduction", "ex.knee.2d": "Bridge on floor, open knees at top", "ex.knee.3n": "Controlled step-down", "ex.knee.3d": "Slow step-down, knee aligned",
    "ex.shin.1n": "Toe raises (tibialis ant.)", "ex.shin.1d": "Raise toes slowly, heels on the ground", "ex.shin.2n": "Wall calf stretch", "ex.shin.2d": "Back leg straight, heel down — 30 s", "ex.shin.3n": "Shin self-massage", "ex.shin.3d": "Gentle foam roller along the shin (60 s/side)",
    "ex.calf.1n": "Eccentric calf raises (step)", "ex.calf.1d": "Up on 2 feet, slow down on 1 foot", "ex.calf.2n": "Isometric on toes", "ex.calf.2d": "On tiptoes, hold 30 s", "ex.calf.3n": "Soleus stretch, knee bent", "ex.calf.3d": "At the wall, knee slightly bent — 30 s",
    "ex.ischio.1n": "Nordic hamstring (assisted)", "ex.ischio.1d": "Slow controlled descent, brake the fall", "ex.ischio.2n": "Single-leg glute bridge", "ex.ischio.2d": "Tilt the pelvis, free leg straight", "ex.ischio.3n": "Gentle hamstring stretch", "ex.ischio.3d": "Leg straight, back tall, no jerking",
    "ex.back.1n": "Cat-Cow", "ex.back.1d": "On all fours, round then arch gently", "ex.back.2n": "Front plank", "ex.back.2d": "Plank — neutral back, 30 s", "ex.back.3n": "Psoas stretch (low lunge)", "ex.back.3d": "Tilt the pelvis — 30 s per side",
    "ex.foot.1n": "Arch rolling", "ex.foot.1d": "Ball / cold bottle under the foot — 60 s", "ex.foot.2n": "Foot strengthening (towel curls)", "ex.foot.2d": "Grab a towel with your toes", "ex.foot.3n": "Eccentric calf raises", "ex.foot.3d": "Slow descent on a step",
    "ex.hip.1n": "Clamshell", "ex.hip.1d": "On your side, open the knee, pelvis stable", "ex.hip.2n": "Standing abduction (band)", "ex.hip.2d": "Move the leg out, active core", "ex.hip.3n": "Hip flexor / adductor stretch", "ex.hip.3d": "30 s per side, pain-free",
    "ex.quad.1n": "Tempo squat", "ex.quad.1d": "Slow descent 3 s, controlled rise", "ex.quad.2n": "Standing quad stretch", "ex.quad.2d": "Heel to glute, pelvis tucked", "ex.quad.3n": "Forward lunges", "ex.quad.3d": "Knee aligned — 10 per leg",
    "ex.def.1n": "Gentle joint mobility", "ex.def.1d": "Progressive range of motion, pain-free", "ex.def.2n": "PEACE & LOVE protocol", "ex.def.2d": "Protect, elevate, progressive load, perfuse",
  },
  de: {
    "h.enPanne": "Deine gemeldeten Schmerzen konnten nicht geladen werden. Der Verlauf wirkt leer, es ist aber nichts verloren — versuch es gleich nochmal.", "h.title": "Gesundheit & Leistung", "h.subtitle": "Dein KI-Physio, dein Tagebuch, deine Sicherheit und deine Ernährung — alles an einem Ort.",
    "tab.kine": "KI-Physio", "tab.journal": "Tagebuch", "tab.guardian": "Sicherheit", "tab.nutrition": "Ernährung", "tab.poids": "Gewicht",
    "k.where": "Wo tut es weh?", "view.face": "Vorne", "view.dos": "Hinten",
    "k.hint": "Tippe eine Zone am Körper oder in der Liste an, stelle die Schmerzen ein und frage den Physio.",
    "k.pain": "Schmerz", "k.painLight": "Leichtes Unbehagen", "k.painHard": "Sehr schmerzhaft",
    "k.ask": "KI-Physio fragen", "k.noZone": "Keine Zone ausgewählt",
    "k.protoExpress": "Express-Protokoll", "k.protoWait": "Überbrückungs-Protokoll — für einen genauen Plan beschreibe deine Schmerzen rechts dem KI-Physio.",
    "k.suivi": "Verlauf deiner Schmerzen", "k.suiviNone": "In den letzten 60 Tagen keine Schmerzen gemeldet.", "k.suiviSince": "seit {n} T", "k.suiviToday": "heute", "k.suiviAgo": "vor {n} T", "trend.amelioration": "bessert sich", "trend.aggravation": "verschlechtert sich", "trend.stable": "stabil", "trend.inconnue": "1. Meldung", "chat.starters": "Zum Einstieg", "chat.s1": "Bei jedem langen Lauf kommt derselbe Schmerz zurück.", "chat.s2": "Wie passe ich meine Woche mit diesem Schmerz an?", "chat.s3": "Welche Präventionsübungen für meine Sehnen?",
    "chat.title": "KI-Physio", "chat.sub": "Antworten passend zu deiner Belastung & Erholung",
    "chat.seed": "Hallo! Ich bin dein Sportphysio. Beschreibe mir, was du spürst — Bereich, seit wann, bei Belastung oder in Ruhe — oder klicke eine Zone im Schema an, und ich helfe dir.",
    "chat.thinking": "Der Physio überlegt…", "chat.placeholder": "Z. B. Knieschmerzen nach langen Läufen…", "chat.photoAdd": "Foto hinzufügen", "chat.photoRemove": "Foto entfernen", "chat.photoReady": "Foto bereit. Es wird analysiert und dann verworfen: nichts wird gespeichert. Bereich nah und gut ausgeleuchtet aufnehmen.", "chat.photoBadType": "Bild nicht lesbar. Erlaubt: JPEG, PNG, WebP, GIF.", "chat.photoOnly": "Kannst du dir dieses Foto ansehen?",
    "chat.disclaimer": "⚕️ Informative Hinweise — kein Ersatz für ärztlichen Rat. Starke / anhaltende Schmerzen → zum Arzt.",
    "chat.errNoReply": "Ich konnte nicht antworten, bitte erneut versuchen.", "chat.errConn": "Keine Verbindung zum KI-Physio. Versuche es erneut.",
    "k.askPrompt": "Ich habe Schmerzen im Bereich: {zone} (Intensität {n}/10). Was könnte es sein, und was soll ich konkret tun?",
    "sec.title": "Sicherheit beim Laufen", "sec.sub": "Was Pacevo wirklich für deine Sicherheit tut — und was in deiner Hand bleibt.",
    "sec.live": "Teile deine Live-Position", "sec.liveDesc": "Von der Karte aus sendet ein Tracking-Link deine Echtzeit-Position an eine nahestehende Person — ohne Konto oder Installation auf ihrer Seite.", "sec.liveBtn": "Karte öffnen",
    "sec.contact": "Notfallkontakt", "sec.contactDesc": "In deinen Einstellungen gespeichert und hier angezeigt. Pacevo ruft niemanden an und schreibt niemandem: Passiert etwas, rufst du — oder ein Zeuge — an.",
    "gd.name": "Vor- & Nachname", "gd.namePh": "Max Mustermann", "gd.phone": "Telefon", "gd.saveContact": "Kontakt speichern", "gd.savedContact": "Kontakt gespeichert.", "sec.saveFail": "Kontakt nicht gespeichert — bitte erneut versuchen.", "sec.call": "Anrufen",
    "sec.honest": "Pacevo erkennt keine Stürze und alarmiert niemanden automatisch: Das tut keine App ohne spezielle Hardware. Die Unfallerkennung deiner Uhr (Garmin, Apple, Coros…) bleibt die Referenz — aktiviere sie dort.",
    "sec.kit": "Vor einer Bergtour", "sec.k1": "Sag jemandem, wohin du gehst und wann du zurück bist.", "sec.k2": "Geladenes Handy, Pfeife, Rettungsdecke, wasserdichte Jacke.", "sec.k3": "Wasser und Salz auf langen Läufen bei Hitze; nach Durst trinken.", "sec.k4": "Notrufnummern: 112 (Europa).", "sec.k5": "Lampe und reflektierende Kleidung ab der Dämmerung.",
    "k.etatQ": "{z} — wie ist es jetzt?", "k.mieux": "Wird besser", "k.pire": "Wird schlimmer", "k.passe": "Ist weg", "k.etatOk": "Notiert — dein Coach berücksichtigt es.", "k.etatPasse": "Notiert: dieser Schmerz bremst deinen Plan nicht mehr.", "k.etatErr": "Aktualisierung nicht möglich. Versuch es nochmal.",
    "chat.new": "Neue Konsultation", "chat.newConfirm": "Gespräch löschen? Deine gemeldeten Schmerzen bleiben in deinem Verlauf.", "chat.resumed": "Vorherige Konsultation fortgesetzt — der Physio erinnert sich an eure Gespräche.", "chat.newFail": "Löschen nicht möglich, bitte erneut versuchen.",
    "k.mapOpen": "Wo tut es weh? Körperschema zeigen", "k.mapClose": "Körperschema ausblenden", "k.zoneChip": "{zone} · {n}/10",
    "bilan.title": "Bilanz der Konsultation", "bilan.hyp": "Hypothesen", "bilan.urgent": "Rote Flagge: Geh zeitnah zum Arzt. Der KI-Physio ersetzt keinen ärztlichen Rat.", "bilan.exos": "Übungen", "bilan.charge": "Belastung", "bilan.reprise": "Wiedereinstieg",
    "bilan.plan": "2 Wochen in meinen Kalender eintragen", "bilan.planned": "{n} Einheiten in den Kalender eingetragen (jeden zweiten Tag).", "bilan.planFail": "Der Kalender konnte nicht geschrieben werden.", "bilan.voirCal": "Kalender ansehen",
    "bilan.proba.haute": "wahrscheinlich", "bilan.proba.moyenne": "möglich", "bilan.proba.faible": "unwahrscheinlich",
    "n.title": "Nutrition Lab — Renn-Strategie", "n.duration": "Renndauer (Stunden)", "n.temp": "Erwartete Temperatur (°C)",
    "n.carbs": "g KH/h", "n.water": "ml Wasser/h", "n.sodium": "mg Natrium/h", "n.caffeine": "mg Koffein gesamt", "n.plan": "Verpflegungsplan", "n.total": "Renn-Gesamt",
    "n.food1": "Energie-Gel + Wasser", "n.food2": "Riegel + Fruchtmus + Wasser", "n.food3": "Gel + Wasser + Elektrolyte",
    "grp.upper": "Oberkörper", "grp.trunk": "Rumpf", "grp.pelvis": "Becken", "grp.thighs": "Oberschenkel", "grp.knees": "Knie", "grp.legs": "Unterschenkel", "grp.feet": "Füße",
    "zf.head": "Kopf", "zf.neck": "Hals / Nacken", "zf.shoulderL": "Linke Schulter", "zf.shoulderR": "Rechte Schulter", "zf.armL": "Linker Arm", "zf.armR": "Rechter Arm", "zf.chest": "Brust", "zf.abs": "Bauch / Core", "zf.hipL": "Linke Hüfte / Leiste", "zf.hipR": "Rechte Hüfte / Leiste", "zf.thighL": "Linker Quadrizeps", "zf.thighR": "Rechter Quadrizeps", "zf.kneeL": "Linkes Knie", "zf.kneeR": "Rechtes Knie", "zf.shinL": "Linkes Schienbein", "zf.shinR": "Rechtes Schienbein", "zf.ankleL": "Linker Knöchel", "zf.ankleR": "Rechter Knöchel", "zf.footL": "Linker Fuß", "zf.footR": "Rechter Fuß",
    "zd.head": "Nacken", "zd.neck": "Halswirbelsäule", "zd.shoulderL": "Linker Trapezius", "zd.shoulderR": "Rechter Trapezius", "zd.armL": "Linker Trizeps", "zd.armR": "Rechter Trizeps", "zd.chest": "Oberer Rücken", "zd.abs": "Unterer Rücken / Lende", "zd.hipL": "Linker Gesäßmuskel", "zd.hipR": "Rechter Gesäßmuskel", "zd.thighL": "Linker hinterer Oberschenkel", "zd.thighR": "Rechter hinterer Oberschenkel", "zd.kneeL": "Linke Kniekehle", "zd.kneeR": "Rechte Kniekehle", "zd.shinL": "Linke Wade", "zd.shinR": "Rechte Wade", "zd.ankleL": "Linke Achillessehne", "zd.ankleR": "Rechte Achillessehne", "zd.footL": "Linke Ferse", "zd.footR": "Rechte Ferse",
    "ex.knee.1n": "Isometrische Wand-Kniebeuge", "ex.knee.1d": "Rücken zur Wand, Oberschenkel ~parallel — 45 s halten", "ex.knee.2n": "Glute Bridge + Abduktion", "ex.knee.2d": "Bridge am Boden, Knie oben öffnen", "ex.knee.3n": "Kontrollierter Step-down", "ex.knee.3d": "Langsam von einer Stufe, Knie ausgerichtet",
    "ex.shin.1n": "Fußspitzen heben (Tibialis ant.)", "ex.shin.1d": "Spitzen langsam heben, Fersen am Boden", "ex.shin.2n": "Waden-Dehnung an der Wand", "ex.shin.2d": "Hinteres Bein gestreckt, Ferse am Boden — 30 s", "ex.shin.3n": "Schienbein-Selbstmassage", "ex.shin.3d": "Sanfte Foam-Roller entlang des Schienbeins (60 s/Seite)",
    "ex.calf.1n": "Exzentrische Wadenheber (Stufe)", "ex.calf.1d": "Auf 2 Füßen hoch, langsam auf 1 Fuß runter", "ex.calf.2n": "Isometrie auf Zehenspitzen", "ex.calf.2d": "Auf Zehenspitzen, 30 s halten", "ex.calf.3n": "Soleus-Dehnung, Knie gebeugt", "ex.calf.3d": "An der Wand, Knie leicht gebeugt — 30 s",
    "ex.ischio.1n": "Nordic Hamstring (unterstützt)", "ex.ischio.1d": "Langsam kontrolliert absenken, Fall bremsen", "ex.ischio.2n": "Einbeinige Glute Bridge", "ex.ischio.2d": "Becken kippen, freies Bein gestreckt", "ex.ischio.3n": "Sanfte Hamstring-Dehnung", "ex.ischio.3d": "Bein gestreckt, Rücken gerade, ohne Ruck",
    "ex.back.1n": "Cat-Cow", "ex.back.1d": "Im Vierfüßlerstand, sanft rund und hohl", "ex.back.2n": "Frontaler Unterarmstütz", "ex.back.2d": "Plank — neutraler Rücken, 30 s", "ex.back.3n": "Psoas-Dehnung (tiefer Ausfallschritt)", "ex.back.3d": "Becken kippen — 30 s pro Seite",
    "ex.foot.1n": "Fußgewölbe ausrollen", "ex.foot.1d": "Ball / kalte Flasche unter dem Fuß — 60 s", "ex.foot.2n": "Fußkräftigung (Handtuch-Curls)", "ex.foot.2d": "Mit den Zehen ein Handtuch greifen", "ex.foot.3n": "Exzentrische Wadenheber", "ex.foot.3d": "Langsam von einer Stufe absenken",
    "ex.hip.1n": "Clamshell (Muschel)", "ex.hip.1d": "Seitlich, Knie öffnen, Becken stabil", "ex.hip.2n": "Stehende Abduktion (Band)", "ex.hip.2d": "Bein nach außen, aktiver Core", "ex.hip.3n": "Hüftbeuger- / Adduktoren-Dehnung", "ex.hip.3d": "30 s pro Seite, schmerzfrei",
    "ex.quad.1n": "Tempo-Kniebeuge", "ex.quad.1d": "Langsam runter 3 s, kontrolliert hoch", "ex.quad.2n": "Stehende Quadrizeps-Dehnung", "ex.quad.2d": "Ferse zum Gesäß, Becken gekippt", "ex.quad.3n": "Ausfallschritte nach vorn", "ex.quad.3d": "Knie ausgerichtet — 10 pro Bein",
    "ex.def.1n": "Sanfte Gelenkmobilität", "ex.def.1d": "Progressive Bewegungsamplitude, schmerzfrei", "ex.def.2n": "PEACE & LOVE Protokoll", "ex.def.2d": "Schützen, hochlagern, progressiv belasten, durchbluten",
  },
  es: {
    "h.enPanne": "Tus dolores declarados no se han podido cargar. Este historial parece vacío, pero no se ha perdido nada — inténtalo de nuevo en un momento.", "h.title": "Salud y Rendimiento", "h.subtitle": "Tu fisio IA, tu diario, tu seguridad y tu nutrición — todo en un solo lugar.",
    "tab.kine": "Fisio IA", "tab.journal": "Diario", "tab.guardian": "Seguridad", "tab.nutrition": "Nutrición", "tab.poids": "Peso",
    "k.where": "¿Dónde te duele?", "view.face": "Frente", "view.dos": "Espalda",
    "k.hint": "Toca una zona del cuerpo o de la lista, ajusta el dolor y pregunta al fisio.",
    "k.pain": "Dolor", "k.painLight": "Molestia leve", "k.painHard": "Muy doloroso",
    "k.ask": "Preguntar al fisio IA", "k.noZone": "Ninguna zona seleccionada",
    "k.protoExpress": "Protocolo exprés", "k.protoWait": "Protocolo de espera — para un plan preciso, describe tu dolor al fisio IA a la derecha.",
    "k.suivi": "Seguimiento de tus dolores", "k.suiviNone": "Ningún dolor declarado en los últimos 60 días.", "k.suiviSince": "desde hace {n} d", "k.suiviToday": "hoy", "k.suiviAgo": "hace {n} d", "trend.amelioration": "mejorando", "trend.aggravation": "empeorando", "trend.stable": "estable", "trend.inconnue": "1.ª declaración", "chat.starters": "Para empezar", "chat.s1": "Tengo un dolor que vuelve en cada tirada larga.", "chat.s2": "¿Cómo adapto mi semana con este dolor?", "chat.s3": "¿Qué ejercicios de prevención para mis tendones?",
    "chat.title": "Fisio IA", "chat.sub": "Respuestas adaptadas a tu carga y recuperación",
    "chat.seed": "¡Hola! Soy tu fisio del deporte. Cuéntame qué sientes — zona, desde cuándo, en esfuerzo o en reposo — o haz clic en una zona del esquema, y te ayudo.",
    "chat.thinking": "El fisio está pensando…", "chat.placeholder": "Ej.: dolor de rodilla tras mis tiradas largas…", "chat.photoAdd": "Añadir una foto", "chat.photoRemove": "Quitar la foto", "chat.photoReady": "Foto lista. Se analiza y se descarta: no se guarda nada. Encuadra la zona de cerca y con buena luz.", "chat.photoBadType": "Imagen ilegible. Formatos: JPEG, PNG, WebP, GIF.", "chat.photoOnly": "¿Puedes mirar esta foto?",
    "chat.disclaimer": "⚕️ Consejos informativos — no sustituyen un consejo médico. Dolor fuerte / persistente → consulta.",
    "chat.errNoReply": "No he podido responder, inténtalo de nuevo.", "chat.errConn": "No se pudo conectar con el fisio IA. Inténtalo de nuevo.",
    "k.askPrompt": "Tengo dolor en: {zone} (intensidad {n}/10). ¿Qué puede ser y qué debo hacer concretamente?",
    "sec.title": "Seguridad en carrera", "sec.sub": "Lo que Pacevo hace de verdad por tu seguridad — y lo que queda en tus manos.",
    "sec.live": "Comparte tu posición en directo", "sec.liveDesc": "Desde el Mapa, un enlace de seguimiento envía tu posición en tiempo real a alguien cercano — sin cuenta ni instalación por su parte.", "sec.liveBtn": "Abrir el Mapa",
    "sec.contact": "Contacto de emergencia", "sec.contactDesc": "Guardado en tus ajustes y mostrado aquí. Pacevo no llama ni escribe a nadie: si pasa algo, eres tú — o un testigo — quien llama.",
    "gd.name": "Nombre y apellidos", "gd.namePh": "Juan Pérez", "gd.phone": "Teléfono", "gd.saveContact": "Guardar contacto", "gd.savedContact": "Contacto guardado.", "sec.saveFail": "Contacto no guardado — inténtalo de nuevo.", "sec.call": "Llamar",
    "sec.honest": "Pacevo no detecta caídas ni avisa a nadie automáticamente: ninguna aplicación lo hace sin el material dedicado. La detección de incidentes de tu reloj (Garmin, Apple, Coros…) sigue siendo la referencia — actívala allí.",
    "sec.kit": "Antes de una salida de montaña", "sec.k1": "Di a alguien adónde vas y cuándo vuelves.", "sec.k2": "Móvil cargado, silbato, manta térmica, chaqueta impermeable.", "sec.k3": "Agua y sal en las tiradas largas con calor; bebe según la sed.", "sec.k4": "Números de emergencia: 112 (Europa).", "sec.k5": "Luz y ropa reflectante desde el anochecer.",
    "k.etatQ": "{z}: ¿cómo va?", "k.mieux": "Va mejor", "k.pire": "Va peor", "k.passe": "Ya pasó", "k.etatOk": "Anotado: tu entrenador lo tiene en cuenta.", "k.etatPasse": "Anotado: este dolor ya no frena tu plan.", "k.etatErr": "No se pudo actualizar. Reinténtalo.",
    "chat.new": "Nueva consulta", "chat.newConfirm": "¿Borrar la conversación? Tus dolores declarados siguen en tu historial.", "chat.resumed": "Consulta anterior retomada — el fisio recuerda vuestros intercambios.", "chat.newFail": "No se pudo borrar, inténtalo de nuevo.",
    "k.mapOpen": "¿Dónde te duele? Mostrar el esquema", "k.mapClose": "Ocultar el esquema", "k.zoneChip": "{zone} · {n}/10",
    "bilan.title": "Balance de la consulta", "bilan.hyp": "Hipótesis", "bilan.urgent": "Bandera roja: consulta pronto a un médico. El fisio IA no sustituye un consejo médico.", "bilan.exos": "Ejercicios", "bilan.charge": "Carga", "bilan.reprise": "Vuelta",
    "bilan.plan": "Programar 2 semanas en mi calendario", "bilan.planned": "{n} sesiones añadidas al calendario (un día sí, otro no).", "bilan.planFail": "No se pudo escribir en el calendario.", "bilan.voirCal": "Ver el calendario",
    "bilan.proba.haute": "probable", "bilan.proba.moyenne": "posible", "bilan.proba.faible": "poco probable",
    "n.title": "Nutrition Lab — Estrategia de carrera", "n.duration": "Duración de la prueba (horas)", "n.temp": "Temperatura prevista (°C)",
    "n.carbs": "g carbohidratos/h", "n.water": "ml agua/h", "n.sodium": "mg sodio/h", "n.caffeine": "mg cafeína total", "n.plan": "Plan de avituallamiento", "n.total": "Total carrera",
    "n.food1": "Gel energético + agua", "n.food2": "Barrita + compota + agua", "n.food3": "Gel + agua + electrolitos",
    "grp.upper": "Tren superior", "grp.trunk": "Tronco", "grp.pelvis": "Pelvis", "grp.thighs": "Muslos", "grp.knees": "Rodillas", "grp.legs": "Piernas", "grp.feet": "Pies",
    "zf.head": "Cabeza", "zf.neck": "Cuello / cervicales", "zf.shoulderL": "Hombro izquierdo", "zf.shoulderR": "Hombro derecho", "zf.armL": "Brazo izquierdo", "zf.armR": "Brazo derecho", "zf.chest": "Pecho", "zf.abs": "Abdominales / core", "zf.hipL": "Cadera / ingle izquierda", "zf.hipR": "Cadera / ingle derecha", "zf.thighL": "Cuádriceps izquierdo", "zf.thighR": "Cuádriceps derecho", "zf.kneeL": "Rodilla izquierda", "zf.kneeR": "Rodilla derecha", "zf.shinL": "Espinilla izquierda", "zf.shinR": "Espinilla derecha", "zf.ankleL": "Tobillo izquierdo", "zf.ankleR": "Tobillo derecho", "zf.footL": "Pie izquierdo", "zf.footR": "Pie derecho",
    "zd.head": "Nuca", "zd.neck": "Cervicales", "zd.shoulderL": "Trapecio izquierdo", "zd.shoulderR": "Trapecio derecho", "zd.armL": "Tríceps izquierdo", "zd.armR": "Tríceps derecho", "zd.chest": "Espalda alta", "zd.abs": "Espalda baja / lumbares", "zd.hipL": "Glúteo izquierdo", "zd.hipR": "Glúteo derecho", "zd.thighL": "Isquiotibial izquierdo", "zd.thighR": "Isquiotibial derecho", "zd.kneeL": "Hueco poplíteo izquierdo", "zd.kneeR": "Hueco poplíteo derecho", "zd.shinL": "Gemelo izquierdo", "zd.shinR": "Gemelo derecho", "zd.ankleL": "Tendón de Aquiles izquierdo", "zd.ankleR": "Tendón de Aquiles derecho", "zd.footL": "Talón izquierdo", "zd.footR": "Talón derecho",
    "ex.knee.1n": "Sentadilla isométrica en pared", "ex.knee.1d": "Espalda en la pared, muslos ~paralelos — mantén 45 s", "ex.knee.2n": "Puente de glúteo + abducción", "ex.knee.2d": "Puente en el suelo, abre las rodillas arriba", "ex.knee.3n": "Step-down controlado", "ex.knee.3d": "Bajada lenta de un escalón, rodilla alineada",
    "ex.shin.1n": "Elevación de puntas (tibial ant.)", "ex.shin.1d": "Sube las puntas despacio, talones en el suelo", "ex.shin.2n": "Estiramiento de gemelo en pared", "ex.shin.2d": "Pierna atrás estirada, talón en el suelo — 30 s", "ex.shin.3n": "Automasaje de la espinilla", "ex.shin.3d": "Foam roller suave a lo largo de la espinilla (60 s/lado)",
    "ex.calf.1n": "Gemelos excéntricos (escalón)", "ex.calf.1d": "Sube con 2 pies, baja lento con 1 pie", "ex.calf.2n": "Isometría en puntas", "ex.calf.2d": "De puntillas, mantén 30 s", "ex.calf.3n": "Estiramiento de sóleo, rodilla flexionada", "ex.calf.3d": "En la pared, rodilla ligeramente doblada — 30 s",
    "ex.ischio.1n": "Nordic hamstring (asistido)", "ex.ischio.1d": "Bajada lenta controlada, frena la caída", "ex.ischio.2n": "Puente de glúteo a una pierna", "ex.ischio.2d": "Bascula la pelvis, pierna libre estirada", "ex.ischio.3n": "Estiramiento suave de isquios", "ex.ischio.3d": "Pierna estirada, espalda recta, sin tirones",
    "ex.back.1n": "Cat-Cow (gato-vaca)", "ex.back.1d": "A cuatro patas, redondea y arquea con suavidad", "ex.back.2n": "Plancha frontal", "ex.back.2d": "Plancha — espalda neutra, 30 s", "ex.back.3n": "Estiramiento de psoas (zancada baja)", "ex.back.3d": "Bascula la pelvis — 30 s por lado",
    "ex.foot.1n": "Rodar el arco plantar", "ex.foot.1d": "Pelota / botella fría bajo el pie — 60 s", "ex.foot.2n": "Fortalecer pies (towel curls)", "ex.foot.2d": "Agarra una toalla con los dedos del pie", "ex.foot.3n": "Gemelos excéntricos", "ex.foot.3d": "Bajada lenta en un escalón",
    "ex.hip.1n": "Clamshell (almeja)", "ex.hip.1d": "De lado, abre la rodilla, pelvis estable", "ex.hip.2n": "Abducción de pie (banda)", "ex.hip.2d": "Separa la pierna, core activo", "ex.hip.3n": "Estiramiento de flexores / aductores", "ex.hip.3d": "30 s por lado, sin dolor",
    "ex.quad.1n": "Sentadilla tempo", "ex.quad.1d": "Bajada lenta 3 s, subida controlada", "ex.quad.2n": "Estiramiento de cuádriceps de pie", "ex.quad.2d": "Talón al glúteo, pelvis retroversa", "ex.quad.3n": "Zancadas frontales", "ex.quad.3d": "Rodilla alineada — 10 por pierna",
    "ex.def.1n": "Movilidad articular suave", "ex.def.1d": "Amplitudes progresivas, sin dolor", "ex.def.2n": "Protocolo PEACE & LOVE", "ex.def.2d": "Protege, eleva, carga progresiva, vasculariza",
  },
  pt: {
    "h.enPanne": "As tuas dores declaradas não puderam ser carregadas. Este histórico parece vazio, mas nada se perdeu — tenta novamente daqui a pouco.", "h.title": "Saúde e Desempenho", "h.subtitle": "O teu fisio IA, o teu diário, a tua segurança e a tua nutrição — tudo no mesmo sítio.",
    "tab.kine": "Fisio IA", "tab.journal": "Diário", "tab.guardian": "Segurança", "tab.nutrition": "Nutrição", "tab.poids": "Peso",
    "k.where": "Onde te dói?", "view.face": "Frente", "view.dos": "Costas",
    "k.hint": "Toca numa zona do corpo ou na lista, ajusta a dor e pergunta ao fisio.",
    "k.pain": "Dor", "k.painLight": "Desconforto ligeiro", "k.painHard": "Muito doloroso",
    "k.ask": "Perguntar ao fisio IA", "k.noZone": "Nenhuma zona selecionada",
    "k.protoExpress": "Protocolo expresso", "k.protoWait": "Protocolo de espera — para um plano preciso, descreve a tua dor ao fisio IA à direita.",
    "k.suivi": "Acompanhamento das tuas dores", "k.suiviNone": "Nenhuma dor declarada nos últimos 60 dias.", "k.suiviSince": "há {n} d", "k.suiviToday": "hoje", "k.suiviAgo": "há {n} d", "trend.amelioration": "a melhorar", "trend.aggravation": "a piorar", "trend.stable": "estável", "trend.inconnue": "1.ª declaração", "chat.starters": "Para começar", "chat.s1": "Tenho uma dor que volta em cada treino longo.", "chat.s2": "Como adapto a minha semana com esta dor?", "chat.s3": "Que exercícios de prevenção para os meus tendões?",
    "chat.title": "Fisio IA", "chat.sub": "Respostas adaptadas à tua carga e recuperação",
    "chat.seed": "Olá! Sou o teu fisio do desporto. Conta-me o que sentes — zona, desde quando, em esforço ou em repouso — ou clica numa zona no esquema, e eu ajudo.",
    "chat.thinking": "O fisio está a pensar…", "chat.placeholder": "Ex.: dor no joelho após os meus treinos longos…", "chat.photoAdd": "Adicionar uma foto", "chat.photoRemove": "Remover a foto", "chat.photoReady": "Foto pronta. É analisada e depois descartada: nada é guardado. Enquadra a zona de perto e com boa luz.", "chat.photoBadType": "Imagem ilegível. Formatos: JPEG, PNG, WebP, GIF.", "chat.photoOnly": "Podes olhar para esta foto?",
    "chat.disclaimer": "⚕️ Conselhos informativos — não substituem aconselhamento médico. Dor forte / persistente → consulta.",
    "chat.errNoReply": "Não consegui responder, tenta novamente.", "chat.errConn": "Não foi possível ligar ao fisio IA. Tenta novamente.",
    "k.askPrompt": "Tenho dor em: {zone} (intensidade {n}/10). O que pode ser e o que devo fazer concretamente?",
    "sec.title": "Segurança em prova", "sec.sub": "O que a Pacevo faz mesmo pela tua segurança — e o que fica nas tuas mãos.",
    "sec.live": "Partilha a tua posição em direto", "sec.liveDesc": "A partir do Mapa, uma ligação de seguimento envia a tua posição em tempo real a alguém próximo — sem conta nem instalação do lado dele.", "sec.liveBtn": "Abrir o Mapa",
    "sec.contact": "Contacto de emergência", "sec.contactDesc": "Guardado nas tuas definições e mostrado aqui. A Pacevo não liga nem escreve a ninguém: se algo acontecer, és tu — ou uma testemunha — quem liga.",
    "gd.name": "Nome completo", "gd.namePh": "João Silva", "gd.phone": "Telefone", "gd.saveContact": "Guardar contacto", "gd.savedContact": "Contacto guardado.", "sec.saveFail": "Contacto não guardado — tenta de novo.", "sec.call": "Ligar",
    "sec.honest": "A Pacevo não deteta quedas nem alerta ninguém automaticamente: nenhuma aplicação o faz sem o material dedicado. A deteção de incidentes do teu relógio (Garmin, Apple, Coros…) continua a ser a referência — ativa-a lá.",
    "sec.kit": "Antes de uma saída de montanha", "sec.k1": "Diz a alguém para onde vais e quando voltas.", "sec.k2": "Telemóvel carregado, apito, manta térmica, casaco impermeável.", "sec.k3": "Água e sal nas saídas longas com calor; bebe pela sede.", "sec.k4": "Números de emergência: 112 (Europa).", "sec.k5": "Luz e roupa refletora desde o anoitecer.",
    "k.etatQ": "{z} — como está agora?", "k.mieux": "Está melhor", "k.pire": "Está pior", "k.passe": "Já passou", "k.etatOk": "Registado — o teu treinador tem isso em conta.", "k.etatPasse": "Registado: esta dor já não trava o teu plano.", "k.etatErr": "Não foi possível atualizar. Tenta de novo.",
    "chat.new": "Nova consulta", "chat.newConfirm": "Apagar a conversa? As tuas dores declaradas ficam no teu histórico.", "chat.resumed": "Consulta anterior retomada — o fisio lembra-se das vossas trocas.", "chat.newFail": "Não foi possível apagar, tenta de novo.",
    "k.mapOpen": "Onde te dói? Mostrar o esquema", "k.mapClose": "Esconder o esquema", "k.zoneChip": "{zone} · {n}/10",
    "bilan.title": "Balanço da consulta", "bilan.hyp": "Hipóteses", "bilan.urgent": "Bandeira vermelha: consulta rapidamente um médico. O fisio IA não substitui um parecer médico.", "bilan.exos": "Exercícios", "bilan.charge": "Carga", "bilan.reprise": "Retoma",
    "bilan.plan": "Programar 2 semanas no meu calendário", "bilan.planned": "{n} sessões adicionadas ao calendário (dia sim, dia não).", "bilan.planFail": "Não foi possível escrever no calendário.", "bilan.voirCal": "Ver o calendário",
    "bilan.proba.haute": "provável", "bilan.proba.moyenne": "possível", "bilan.proba.faible": "pouco provável",
    "n.title": "Nutrition Lab — Estratégia de prova", "n.duration": "Duração da prova (horas)", "n.temp": "Temperatura prevista (°C)",
    "n.carbs": "g hidratos/h", "n.water": "ml água/h", "n.sodium": "mg sódio/h", "n.caffeine": "mg cafeína total", "n.plan": "Plano de abastecimento", "n.total": "Total da corrida",
    "n.food1": "Gel energético + água", "n.food2": "Barra + compota + água", "n.food3": "Gel + água + eletrólitos",
    "grp.upper": "Tronco superior", "grp.trunk": "Tronco", "grp.pelvis": "Bacia", "grp.thighs": "Coxas", "grp.knees": "Joelhos", "grp.legs": "Pernas", "grp.feet": "Pés",
    "zf.head": "Cabeça", "zf.neck": "Pescoço / cervicais", "zf.shoulderL": "Ombro esquerdo", "zf.shoulderR": "Ombro direito", "zf.armL": "Braço esquerdo", "zf.armR": "Braço direito", "zf.chest": "Peito", "zf.abs": "Abdominais / core", "zf.hipL": "Anca / virilha esquerda", "zf.hipR": "Anca / virilha direita", "zf.thighL": "Quadríceps esquerdo", "zf.thighR": "Quadríceps direito", "zf.kneeL": "Joelho esquerdo", "zf.kneeR": "Joelho direito", "zf.shinL": "Canela esquerda", "zf.shinR": "Canela direita", "zf.ankleL": "Tornozelo esquerdo", "zf.ankleR": "Tornozelo direito", "zf.footL": "Pé esquerdo", "zf.footR": "Pé direito",
    "zd.head": "Nuca", "zd.neck": "Cervicais", "zd.shoulderL": "Trapézio esquerdo", "zd.shoulderR": "Trapézio direito", "zd.armL": "Tríceps esquerdo", "zd.armR": "Tríceps direito", "zd.chest": "Parte superior das costas", "zd.abs": "Lombar / parte inferior das costas", "zd.hipL": "Glúteo esquerdo", "zd.hipR": "Glúteo direito", "zd.thighL": "Isquiotibial esquerdo", "zd.thighR": "Isquiotibial direito", "zd.kneeL": "Cavado poplíteo esquerdo", "zd.kneeR": "Cavado poplíteo direito", "zd.shinL": "Gémeo esquerdo", "zd.shinR": "Gémeo direito", "zd.ankleL": "Tendão de Aquiles esquerdo", "zd.ankleR": "Tendão de Aquiles direito", "zd.footL": "Calcanhar esquerdo", "zd.footR": "Calcanhar direito",
    "ex.knee.1n": "Agachamento isométrico na parede", "ex.knee.1d": "Costas na parede, coxas ~paralelas — mantém 45 s", "ex.knee.2n": "Ponte de glúteo + abdução", "ex.knee.2d": "Ponte no chão, abre os joelhos em cima", "ex.knee.3n": "Step-down controlado", "ex.knee.3d": "Descida lenta de um degrau, joelho alinhado",
    "ex.shin.1n": "Elevação de pontas (tibial ant.)", "ex.shin.1d": "Sobe as pontas devagar, calcanhares no chão", "ex.shin.2n": "Alongamento de gémeo na parede", "ex.shin.2d": "Perna de trás esticada, calcanhar no chão — 30 s", "ex.shin.3n": "Automassagem da canela", "ex.shin.3d": "Foam roller suave ao longo da canela (60 s/lado)",
    "ex.calf.1n": "Gémeos excêntricos (degrau)", "ex.calf.1d": "Sobe com 2 pés, desce devagar com 1 pé", "ex.calf.2n": "Isometria em pontas", "ex.calf.2d": "Em bicos de pés, mantém 30 s", "ex.calf.3n": "Alongamento do sóleo, joelho fletido", "ex.calf.3d": "Na parede, joelho ligeiramente dobrado — 30 s",
    "ex.ischio.1n": "Nordic hamstring (assistido)", "ex.ischio.1d": "Descida lenta controlada, trava a queda", "ex.ischio.2n": "Ponte de glúteo a uma perna", "ex.ischio.2d": "Báscula a bacia, perna livre esticada", "ex.ischio.3n": "Alongamento suave de isquiotibiais", "ex.ischio.3d": "Perna esticada, costas direitas, sem solavancos",
    "ex.back.1n": "Cat-Cow (gato-vaca)", "ex.back.1d": "De quatro apoios, arredonda e arqueia com suavidade", "ex.back.2n": "Prancha frontal", "ex.back.2d": "Prancha — costas neutras, 30 s", "ex.back.3n": "Alongamento do psoas (afundo baixo)", "ex.back.3d": "Báscula a bacia — 30 s por lado",
    "ex.foot.1n": "Rolar o arco plantar", "ex.foot.1d": "Bola / garrafa fria sob o pé — 60 s", "ex.foot.2n": "Reforço dos pés (towel curls)", "ex.foot.2d": "Agarra uma toalha com os dedos do pé", "ex.foot.3n": "Gémeos excêntricos", "ex.foot.3d": "Descida lenta num degrau",
    "ex.hip.1n": "Clamshell (concha)", "ex.hip.1d": "De lado, abre o joelho, bacia estável", "ex.hip.2n": "Abdução em pé (elástico)", "ex.hip.2d": "Afasta a perna, core ativo", "ex.hip.3n": "Alongamento de flexores / adutores", "ex.hip.3d": "30 s por lado, sem dor",
    "ex.quad.1n": "Agachamento tempo", "ex.quad.1d": "Descida lenta 3 s, subida controlada", "ex.quad.2n": "Alongamento de quadríceps em pé", "ex.quad.2d": "Calcanhar ao glúteo, bacia em retroversão", "ex.quad.3n": "Afundos frontais", "ex.quad.3d": "Joelho alinhado — 10 por perna",
    "ex.def.1n": "Mobilidade articular suave", "ex.def.1d": "Amplitudes progressivas, sem dor", "ex.def.2n": "Protocolo PEACE & LOVE", "ex.def.2d": "Protege, eleva, carga progressiva, vasculariza",
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

// Protocole de rééducation express — match sur le libellé FR (stable), exos en clés i18n.
type Exo = { nameKey: string; sets: number; reps: number; descKey: string };
function protocolFor(frLabel: string): Exo[] {
  const l = frLabel.toLowerCase();
  const ex = (cat: string, specs: [number, number][]) => specs.map(([sets, reps], i) => ({ nameKey: `ex.${cat}.${i + 1}n`, sets, reps, descKey: `ex.${cat}.${i + 1}d` }));
  if (/genou|poplit|rotul/.test(l)) return ex("knee", [[4, 45], [3, 15], [3, 12]]);
  if (/tibia|périost|periost/.test(l)) return ex("shin", [[3, 20], [3, 30], [2, 60]]);
  if (/mollet|achille/.test(l)) return ex("calf", [[3, 15], [4, 30], [3, 30]]);
  if (/ischio/.test(l)) return ex("ischio", [[3, 6], [3, 12], [3, 30]]);
  if (/dos|lombaire/.test(l)) return ex("back", [[3, 10], [3, 30], [2, 30]]);
  if (/fascia|pied|talon/.test(l)) return ex("foot", [[2, 60], [3, 15], [3, 15]]);
  if (/hanche|fessier|aine|adduct/.test(l)) return ex("hip", [[3, 15], [3, 15], [2, 30]]);
  if (/quadriceps/.test(l)) return ex("quad", [[3, 12], [3, 30], [3, 10]]);
  return ex("def", [[2, 10], [1, 1]]);
}

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

type Tab = "kine" | "journal" | "guardian" | "nutrition" | "poids";
type ChatMsg = { role: "user" | "model"; text: string; photo?: string };

// Nombre qui s'anime en douceur quand sa valeur change (cartes nutrition).
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = fmAnimate(mv, value, { duration: 0.5, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

export function HealthCenter({ suivi = [], etats = [], enPanne = false, filInitial = [], contactInitial = { nom: "", tel: "" } }: {
  suivi?: SuiviZone[];
  /** Pour chaque zone, la déclaration la plus récente et son état déclaré. */
  etats?: { cle: string; id: string; etat: string }[];
  /** La lecture des douleurs a ÉCHOUÉ : l'historique est vide par accident. */
  enPanne?: boolean;
  /** La consultation précédente, relue côté serveur (type `kine_chat`). */
  filInitial?: { role: "user" | "model"; text: string }[];
  /** Le contact d'urgence enregistré dans les réglages. */
  contactInitial?: { nom: string; tel: string };
}) {
  // Chaque libellé est relié à son champ : sans cela, un lecteur d'écran annonce
  // le placeholder — ou rien — à la place du texte affiché.
  const cid = useId();
  const { lang } = useT();
  const tr: Tr = (k, p) => fill(H[lang]?.[k] ?? H.fr[k] ?? k, p);
  const [tab, setTab] = useState<Tab>("kine");
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
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [painLevel, setPainLevel] = useState(5);
  const [emergencyName, setEmergencyName] = useState(contactInitial.nom);
  const [emergencyPhone, setEmergencyPhone] = useState(contactInitial.tel);
  const [contactEnCours, setContactEnCours] = useState(false);
  const [raceHours, setRaceHours] = useState(6);
  const [raceTemp, setRaceTemp] = useState(15);

  // ── Chat kiné IA ──────────────────────────────────────────────
  // ⚠️ LA CONSULTATION REPREND OÙ ELLE S'EST ARRÊTÉE (22/09/2026). Avant, le fil vivait
  // dans l'état du composant : changer d'onglet suffisait à faire « oublier » au kiné
  // tout ce qu'on venait de lui décrire. Le serveur rend les 40 derniers messages.
  const [messages, setMessages] = useState<ChatMsg[]>(
    filInitial.length > 0 ? filInitial : [{ role: "model", text: tr("chat.seed") }],
  );
  /** Le dernier bilan structuré rendu par le kiné (hypothèses, exercices, charge). */
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [planEnCours, setPlanEnCours] = useState(false);
  /** Sur téléphone, le schéma corporel s'ouvre à la demande : il prenait tout l'écran. */
  const [schemaOuvert, setSchemaOuvert] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Photo en attente, en data-URL. Elle ne quitte le navigateur qu'à l'envoi, et n'est
   *  jamais stockée côté serveur — voir le commentaire de /api/ai/physio. */
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Redimensionne la photo AVANT tout envoi : une photo de téléphone pèse 3 à 8 Mo, ce
   * qui ferait un corps de requête de 10 Mo en base64 pour aucun gain — au-delà de
   * ~1280 px, un modèle de vision ne voit rien de plus. On tombe à ~200 Ko.
   * Le redimensionnement passe par un canvas, ce qui SUPPRIME au passage les métadonnées
   * EXIF de la photo d'origine : sur une image de santé, la géolocalisation du cliché
   * n'a aucune raison de partir avec.
   */
  const attachPhoto = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error(tr("chat.photoBadType")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { toast.error(tr("chat.photoBadType")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => toast.error(tr("chat.photoBadType"));
      img.src = String(reader.result);
    };
    reader.onerror = () => toast.error(tr("chat.photoBadType"));
    reader.readAsDataURL(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const zoneMap = VIEW_ZONES[view];
  const selectedZone = selectedSlot ? zoneMap[selectedSlot] : null;
  // Match du protocole sur le libellé FR (stable, quelle que soit la langue d'affichage).
  const rehabProtocol = selectedZone ? protocolFor(H.fr[selectedZone.labelKey] ?? "") : [];

  const carbsPerHour = Math.round(40 + (raceHours > 3 ? (raceHours - 3) * 5 : 0));
  const hydrationPerHour = Math.round(500 + (raceTemp - 15) * 20);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    // Une photo seule est un message valable : « regarde ça » se passe de mots.
    if ((!msg && !photo) || sending) return;
    const history = messages;
    const sentPhoto = photo;
    setMessages((m) => [...m, { role: "user", text: msg, photo: sentPhoto ?? undefined }]);
    setInput("");
    setPhoto(null);
    setSending(true);
    try {
      const res = await fetch("/api/ai/physio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg || (sentPhoto ? tr("chat.photoOnly") : ""),
          zone: selectedSlot ? tr(VIEW_ZONES[view][selectedSlot]?.labelKey ?? "") || null : null,
          // Le libellé part pour être lu par le modèle et réaffiché ; la CLÉ part pour
          // être la seule chose sur laquelle on regroupe l'historique.
          // ⚠️ LA VUE FAIT PARTIE DE LA CLÉ. Le même repère désigne deux parties du corps
          // selon la face : `kneeL` est le genou de face et le creux poplité de dos
          // (`zf.kneeL` / `zd.kneeL`). Une clé sans la vue aurait confondu les deux et
          // surligné la mauvaise zone sur la silhouette.
          zoneKey: selectedSlot ? `${view}:${selectedSlot}` : null,
          painLevel: selectedSlot ? painLevel : null,
          // L'historique n'emporte que du texte : les photos ne sont pas rejouées à
          // chaque tour (poids inutile, et rien n'est conservé côté serveur).
          history: history.map((h) => ({ role: h.role, text: h.text })),
          photo: sentPhoto ? { data: sentPhoto } : null,
        }),
      });
      const json = await res.json();
      if (json.reply) { setMessages((m) => [...m, { role: "model", text: json.reply }]); setBilan(json.bilan ?? null); }
      else setMessages((m) => [...m, { role: "model", text: "⚠️ " + (json.error || tr("chat.errNoReply")) }]);
    } catch {
      setMessages((m) => [...m, { role: "model", text: "⚠️ " + tr("chat.errConn") }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, selectedSlot, view, painLevel, lang, photo]);

  /** Le contact d'urgence : ÉCRIT dans les réglages, et l'échec est dit. */
  async function enregistrerContact() {
    setContactEnCours(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactUrgenceNom: emergencyName.trim(), contactUrgenceTel: emergencyPhone.trim() }),
      });
      if (r.ok) toast.success(tr("gd.savedContact"));
      else toast.error(tr("sec.saveFail"));
    } catch { toast.error(tr("sec.saveFail")); }
    setContactEnCours(false);
  }

  /** « Nouvelle consultation » : le fil est effacé côté serveur AVANT l'écran. */
  async function nouvelleConsultation() {
    if (!window.confirm(tr("chat.newConfirm"))) return;
    try {
      const r = await fetch("/api/health/consultation", { method: "DELETE" });
      if (!r.ok) { toast.error(tr("chat.newFail")); return; }
      setMessages([{ role: "model", text: tr("chat.seed") }]);
      setBilan(null);
    } catch { toast.error(tr("chat.newFail")); }
  }

  /** Le protocole du bilan → six notes dans le calendrier (deux semaines). */
  async function programmerProtocole() {
    if (!bilan?.exercices.length || planEnCours) return;
    setPlanEnCours(true);
    try {
      const r = await fetch("/api/health/protocole", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: selectedZone ? tr(selectedZone.labelKey) : null, exercices: bilan.exercices }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast.success(tr("bilan.planned", { n: j.n ?? 0 }));
      else toast.error(j.error || tr("bilan.planFail"));
    } catch { toast.error(tr("bilan.planFail")); }
    setPlanEnCours(false);
  }

  const askAboutZone = () => {
    if (!selectedZone) return;
    send(tr("k.askPrompt", { zone: tr(selectedZone.labelKey), n: painLevel }));
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
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white sm:h-12 sm:w-12 shadow-[0_10px_26px_-10px_rgba(16,185,129,0.65)]">
          <Heart className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">{tr("h.title")}</h1>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500 sm:text-sm">{tr("h.subtitle")}</p>
        </div>
      </div>

      {/* Onglets — pastille active qui glisse en douceur */}
      {/* Défilement horizontal sur téléphone : cinq onglets à icône ne tiennent pas dans
          375 px, et `flex-wrap` les cassait sur deux lignes au-dessus du contenu. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100/80 p-1 ring-1 ring-zinc-200/60 [scrollbar-width:none] sm:mx-0 sm:w-fit sm:overflow-visible">
        {([
          { v: "kine", l: tr("tab.kine"), icon: Stethoscope },
          { v: "journal", l: tr("tab.journal"), icon: BookOpen },
          { v: "guardian", l: tr("tab.guardian"), icon: Shield },
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
                          className: "cursor-pointer transition-all hover:opacity-70",
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
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1">{tr(g)}</div>
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
                    <label htmlFor={`${cid}-r0`} className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("k.pain")} — <span className="font-semibold text-zinc-800">{tr(selectedZone.labelKey)}</span> : <span className="font-bold" style={{ color: teinteDouleur(painLevel) }}>{painLevel}/10</span></label>
                    {/* Le curseur porte la MÊME couleur que la zone sur la silhouette : deux
                        barèmes différents pour une seule douleur se contrediraient à l'écran. */}
                    <input id={`${cid}-r0`} type="range" min={1} max={10} value={painLevel} onChange={(e) => setPainLevel(+e.target.value)}
                      className="w-full" style={{ accentColor: teinteDouleur(painLevel) }} />
                    <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5"><span>{tr("k.painLight")}</span><span>{tr("k.painHard")}</span></div>
                    <button onClick={askAboutZone} className="btn-brand w-full justify-center mt-3 text-sm">
                      <Sparkles className="w-4 h-4" /> {tr("k.ask")}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 text-center mt-3 pt-3 border-t border-zinc-100">{tr("k.noZone")}</p>
                )}
              </div>

              {/* ── SUIVI DES DOULEURS ────────────────────────────────────────────
                  Ce que le kiné IA relit désormais avant de répondre. L'afficher n'est
                  pas décoratif : si l'athlète voit « 7/10 → 4/10 » et que le modèle
                  repart de zéro, l'un des deux se trompe et rien ne dit lequel. Les deux
                  lisent le MÊME calcul (`suiviParZone`). */}
              <div className="bento-card">
                <div className="mb-2.5 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-zinc-900">{tr("k.suivi")}</h3>
                </div>
                {suivi.length === 0 ? (
                  <p className="text-xs text-zinc-400">{tr("k.suiviNone")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {suivi.slice(0, 5).map((z) => {
                      const ton = TON_TENDANCE;
                      return (
                        <div key={z.zone} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-2.5 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-zinc-900">{z.zone}</div>
                            <div className="text-[11px] text-zinc-400">
                              {z.derniereIlYaJours <= 0 ? tr("k.suiviToday") : tr("k.suiviAgo", { n: z.derniereIlYaJours })}
                              {z.depuisJours > 0 && ` · ${tr("k.suiviSince", { n: z.depuisJours })}`}
                            </div>
                          </div>
                          {/* ⚠️ On montre « 7 → 4 » seulement s'il y a DEUX déclarations.
                              Avec une seule, une flèche laisserait croire à une évolution
                              qui n'a jamais été mesurée. */}
                          <div className="flex items-center gap-1 text-[13px] font-bold tabular-nums text-zinc-700">
                            {z.signalements > 1 && <><span className="text-zinc-400">{z.premier}</span><span className="text-zinc-300">→</span></>}
                            <span>{z.dernier}</span><span className="text-[11px] font-medium text-zinc-400">/10</span>
                          </div>
                          <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${ton[z.tendance]}`}>
                            {tr("trend." + z.tendance)}
                          </span>
                        </div>
                      );
                    })}
                    {/* ══ CE QUE L'ATHLÈTE PEUT EN DIRE ═══════════════════════════════
                        ⚠️ Une douleur déclarée ne pouvait pas être retirée : elle ne
                        s'éteignait QUE par péremption, au bout de 14 jours, en retirant de
                        l'intensité à chaque replanification. Cyprien en avait déclaré une
                        POUR TESTER (23/09/2026) et son plan a été allégé pour rien.
                        « Ça va mieux » NE L'EFFACE PAS : une gêne qui s'améliore reste une
                        gêne, et la faire disparaître du budget de qualité rendrait la
                        séance dure le jour même. Seul « c'est passé » l'éteint. */}
                    {suivi.slice(0, 5).map((z) => {
                      const e = etats.find((x) => x.cle === z.cle);
                      if (!e) return null;
                      const courant = majEtats[e.id] ?? e.etat;
                      if (courant === "resolu") return null;
                      return (
                        <div key={`etat-${e.id}`} className="-mt-0.5 flex flex-wrap items-center gap-1.5 px-2.5 pb-1">
                          <span className="text-[11px] text-zinc-400">{tr("k.etatQ", { z: z.zone })}</span>
                          {([["mieux", "k.mieux"], ["pire", "k.pire"], ["resolu", "k.passe"]] as const).map(([val, cle]) => (
                            <button key={val} type="button" disabled={enCours === e.id}
                              onClick={() => majEtatDouleur(e.id, val)}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-colors disabled:opacity-50 ${
                                courant === val ? "bg-zinc-900 text-white ring-zinc-900"
                                : val === "resolu" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                                : val === "pire" ? "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100"
                                : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}>
                              {tr(cle)}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Protocole express */}
              {selectedZone && (
                <div className="bento-card">
                  <h3 className="font-semibold text-zinc-900 mb-3 text-sm">{tr("k.protoExpress")} — {tr(selectedZone.labelKey)}</h3>
                  <div className="space-y-2">
                    {rehabProtocol.map((ex, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 bg-zinc-50 rounded-xl">
                        <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-zinc-900 text-sm">{tr(ex.nameKey)}</div>
                          <div className="text-xs text-zinc-500">{tr(ex.descKey)}</div>
                          <div className="flex gap-1.5 mt-1">
                            <span className="text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{ex.sets} × {ex.reps}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-3">{tr("k.protoWait")}</p>
                </div>
              )}
            </div>

            {/* Chat kiné IA */}
            <div className="order-1 bento-card flex flex-col lg:order-none lg:col-span-7" style={{ minHeight: 520 }}>
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><Stethoscope className="w-5 h-5 text-emerald-600" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-zinc-900 text-sm">{tr("chat.title")}</div>
                  <div className="truncate text-xs text-zinc-400">{tr("chat.sub")}</div>
                </div>
                {/* La consultation est mémorisée : il faut donc pouvoir en ouvrir une neuve. */}
                {messages.length > 1 && (
                  <button type="button" onClick={nouvelleConsultation} title={tr("chat.new")} aria-label={tr("chat.new")}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                    <RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tr("chat.new")}</span>
                  </button>
                )}
              </div>
              {/* Dire que le fil vient d'avant évite de croire à un bug d'affichage. */}
              {filInitial.length > 0 && messages.length > 1 && (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-800">{tr("chat.resumed")}</p>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3" style={{ maxHeight: 440 }}>
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] overflow-hidden rounded-2xl text-sm leading-relaxed ${
                      m.role === "user" ? "bg-zinc-900 text-white rounded-br-md" : "bg-zinc-100 text-zinc-800 rounded-bl-md"
                    }`}>
                      {/* La photo n'est affichée QUE localement : elle n'a été ni stockée
                          ni renvoyée par le serveur, elle vit dans l'état du composant. */}
                      {m.photo && <img src={m.photo} alt="" className="max-h-52 w-full object-cover" />}
                      {/* ⚠️ LA RÉPONSE DU MODÈLE EST STRUCTURÉE, ON L'AFFICHAIT BRUTE. L'invite
                          du kiné demande « titres courts / puces » ; sondé le 02/09/2026,
                          le modèle renvoie bien du gras, des titres et des puces. En
                          `whitespace-pre-wrap`, l'athlète lisait « ### Pour mieux
                          comprendre » et « *   **Déclencheur :** ». Le message de
                          l'athlète, lui, reste brut : il a tapé du texte, pas du balisage. */}
                      {m.text && (m.role === "model"
                        ? <RichText texte={m.text} className="px-3.5 py-2.5 text-zinc-800" />
                        : <div className="whitespace-pre-wrap px-3.5 py-2.5">{m.text}</div>)}
                    </div>
                  </div>
                ))}
                {/* Une consultation commence par une phrase, pas par une page blanche. */}
                {messages.length <= 1 && !sending && (
                  <div className="pt-1">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{tr("chat.starters")}</div>
                    <div className="flex flex-wrap gap-2">
                      {(["chat.s1", "chat.s2", "chat.s3"] as const).map((k) => (
                        <button key={k} onClick={() => send(tr(k))}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-[13px] text-zinc-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-zinc-900">
                          {tr(k)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 text-zinc-500 px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> {tr("chat.thinking")}
                    </div>
                  </div>
                )}
              </div>

              {/* Photo en attente d'envoi */}
              {photo && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                  <img src={photo} alt="" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
                  <p className="flex-1 text-xs leading-relaxed text-emerald-900">{tr("chat.photoReady")}</p>
                  <button type="button" onClick={() => setPhoto(null)} aria-label={tr("chat.photoRemove")}
                    className="flex-shrink-0 rounded-lg p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                {/* `capture` fait ouvrir l'appareil photo directement sur mobile. */}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment"
                  className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) attachPhoto(f); e.target.value = ""; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} title={tr("chat.photoAdd")} aria-label={tr("chat.photoAdd")}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-40">
                  <Camera className="h-4 w-4" />
                </button>
                <input value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}
                  placeholder={tr("chat.placeholder")}
                  className="flex-1 px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400" />
                <button type="submit" disabled={sending || (!input.trim() && !photo)}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[11px] text-zinc-400 mt-2">{tr("chat.disclaimer")}</p>

              {/* ── LE BILAN DE LA CONSULTATION ──────────────────────────────────
                  Une consultation se terminait par un mur de texte : hypothèses,
                  exercices et consignes se perdaient dedans, et rien n'en sortait. Le
                  modèle rend désormais un bilan structuré (bloc ```bilan, validé champ
                  par champ côté serveur) — affiché ici, et surtout PROGRAMMABLE : le
                  protocole part dans le calendrier, six séances sur deux semaines. */}
              {bilan && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-emerald-700" aria-hidden />
                    <h4 className="text-sm font-bold text-emerald-900">{tr("bilan.title")}</h4>
                  </div>
                  {bilan.urgence && (
                    <p className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-rose-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />{tr("bilan.urgent")}
                    </p>
                  )}
                  {bilan.hypotheses.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-800/70">{tr("bilan.hyp")}</div>
                      <ul className="mt-1 space-y-1">
                        {bilan.hypotheses.map((h) => (
                          <li key={h.nom} className="flex items-center gap-2 text-[13px] text-zinc-800">
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${h.probabilite === "haute" ? "bg-emerald-600 text-white" : h.probabilite === "moyenne" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
                              {tr(`bilan.proba.${h.probabilite}`)}
                            </span>
                            {h.nom}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {bilan.exercices.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-800/70">{tr("bilan.exos")}</div>
                      <ul className="mt-1 space-y-1">
                        {bilan.exercices.map((e) => (
                          <li key={e.nom} className="text-[13px] text-zinc-800">
                            <b className="font-semibold">{e.nom}</b> — {e.dosage}{e.frequence ? ` · ${e.frequence}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(bilan.charge || bilan.reprise) && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {bilan.charge && <p className="rounded-xl bg-white/70 px-3 py-2 text-[13px] leading-relaxed text-zinc-700"><b className="text-emerald-800">{tr("bilan.charge")} : </b>{bilan.charge}</p>}
                      {bilan.reprise && <p className="rounded-xl bg-white/70 px-3 py-2 text-[13px] leading-relaxed text-zinc-700"><b className="text-emerald-800">{tr("bilan.reprise")} : </b>{bilan.reprise}</p>}
                    </div>
                  )}
                  {bilan.exercices.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={programmerProtocole} disabled={planEnCours} className="btn-brand justify-center text-sm disabled:opacity-60">
                        {planEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}{tr("bilan.plan")}
                      </button>
                      <Link href="/dashboard/calendrier" className="text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline">{tr("bilan.voirCal")}</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── JOURNAL ── */}
        {tab === "journal" && (
          <motion.div key="journal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <SmartJournal />
          </motion.div>
        )}

        {/* ── GUARDIAN ── */}
        {/* ── SÉCURITÉ ──────────────────────────────────────────────────────────
            ⚠️ CET ONGLET ANNONÇAIT CE QUI N'EXISTE PAS (22/09/2026) : « détection de
            chute (accéléromètre + gyroscope) », « arrêt cardiaque via la montre »,
            « alerte automatique SMS + appel », et un bouton « Enregistrer le contact »
            qui affichait un succès sans rien écrire. Aucune de ces quatre choses n'était
            implémentée — sur une fonction de SÉCURITÉ, c'est la promesse la plus
            dangereuse qu'une application puisse faire : quelqu'un part seul en montagne
            en croyant être surveillé. Ce qui reste est ce qui marche vraiment : le
            partage de position en direct (Carte), un contact d'urgence réellement
            enregistré et appelable, et la check-list avant une sortie. */}
        {tab === "guardian" && (
          <motion.div key="guardian" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid gap-4 lg:grid-cols-2">

            <div className="bento-card lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Shield className="h-6 w-6" /></span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-zinc-900">{tr("sec.title")}</h3>
                  <p className="text-sm text-zinc-500">{tr("sec.sub")}</p>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden />{tr("sec.honest")}
              </p>
            </div>

            {/* Ce qui existe : le partage de position en direct, depuis la Carte. */}
            <div className="bento-card flex flex-col">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><MapPin className="h-[18px] w-[18px]" /></span>
                <h3 className="font-semibold text-zinc-900">{tr("sec.live")}</h3>
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{tr("sec.liveDesc")}</p>
              <Link href="/dashboard/trail" className="btn-brand mt-3 w-full justify-center"><MapPin className="h-4 w-4" />{tr("sec.liveBtn")}</Link>
            </div>

            {/* Le contact d'urgence — ENREGISTRÉ pour de bon (api/settings), et appelable. */}
            <div className="bento-card">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Phone className="h-[18px] w-[18px]" /></span>
                <h3 className="font-semibold text-zinc-900">{tr("sec.contact")}</h3>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{tr("sec.contactDesc")}</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor={`${cid}-c0`} className="mb-1 block text-xs font-medium text-zinc-500">{tr("gd.name")}</label>
                  <input id={`${cid}-c0`} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder={tr("gd.namePh")}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm transition-colors focus:border-emerald-400 focus:bg-white focus:outline-none" />
                </div>
                <div>
                  <label htmlFor={`${cid}-c1`} className="mb-1 block text-xs font-medium text-zinc-500">{tr("gd.phone")}</label>
                  <input id={`${cid}-c1`} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+33 6 12 34 56 78" type="tel"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm transition-colors focus:border-emerald-400 focus:bg-white focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={enregistrerContact} disabled={contactEnCours} className="btn-brand flex-1 justify-center disabled:opacity-60">
                    {contactEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{tr("gd.saveContact")}
                  </button>
                  {emergencyPhone.trim() && (
                    <a href={`tel:${emergencyPhone.replace(/[^0-9+]/g, "")}`}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50">
                      <Phone className="h-4 w-4" />{tr("sec.call")}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* La check-list — ce qui sauve vraiment, et qui ne dépend d'aucune technologie. */}
            <div className="bento-card lg:col-span-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"><ListChecks className="h-[18px] w-[18px]" /></span>
                <h3 className="font-semibold text-zinc-900">{tr("sec.kit")}</h3>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {(["sec.k1", "sec.k2", "sec.k3", "sec.k4", "sec.k5"] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" aria-hidden />{tr(k)}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* ── NUTRITION ── */}
        {tab === "nutrition" && (
          <motion.div key="nutrition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <div className="bento-card">
              <div className="mb-5 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Utensils className="h-[18px] w-[18px]" /></span>
                <h3 className="font-semibold text-zinc-900">{tr("n.title")}</h3>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Réglages + total */}
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <label htmlFor={`${cid}-r1`} className="text-xs font-medium uppercase tracking-wide text-zinc-400">{tr("n.duration")}</label>
                      <span className="text-lg font-bold tabular-nums text-zinc-900">{raceHours}<span className="ml-0.5 text-sm font-semibold text-zinc-400">h</span></span>
                    </div>
                    <input id={`${cid}-r1`} type="range" min={1} max={24} step={0.5} value={raceHours} onChange={(e) => setRaceHours(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <label htmlFor={`${cid}-r2`} className="text-xs font-medium uppercase tracking-wide text-zinc-400">{tr("n.temp")}</label>
                      <span className="text-lg font-bold tabular-nums text-zinc-900">{raceTemp}<span className="ml-0.5 text-sm font-semibold text-zinc-400">°C</span></span>
                    </div>
                    <input id={`${cid}-r2`} type="range" min={0} max={40} step={1} value={raceTemp} onChange={(e) => setRaceTemp(parseInt(e.target.value))} className="w-full accent-orange-500" />
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{tr("n.total")}</div>
                    <div className="mt-2 flex items-center gap-6">
                      <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-orange-500" /><span className="text-xl font-bold tabular-nums text-zinc-900">{Math.round(carbsPerHour * raceHours).toLocaleString()}</span><span className="text-xs font-medium text-zinc-400">g</span></span>
                      <span className="flex items-center gap-1.5"><Droplets className="h-4 w-4 text-blue-500" /><span className="text-xl font-bold tabular-nums text-zinc-900">{(hydrationPerHour * raceHours / 1000).toFixed(1)}</span><span className="text-xs font-medium text-zinc-400">L</span></span>
                    </div>
                  </div>
                </div>

                {/* Métriques par heure (comptage animé) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-4 text-center transition-transform hover:-translate-y-0.5">
                    <Zap className="mx-auto mb-2 h-5 w-5 text-orange-500" />
                    <div className="text-3xl font-bold tabular-nums text-orange-600"><AnimatedNumber value={carbsPerHour} /></div>
                    <div className="mt-1 text-xs text-zinc-500">{tr("n.carbs")}</div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-4 text-center transition-transform hover:-translate-y-0.5">
                    <Droplets className="mx-auto mb-2 h-5 w-5 text-blue-500" />
                    <div className="text-3xl font-bold tabular-nums text-blue-600"><AnimatedNumber value={hydrationPerHour} /></div>
                    <div className="mt-1 text-xs text-zinc-500">{tr("n.water")}</div>
                  </div>
                  <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 text-center transition-transform hover:-translate-y-0.5">
                    <div className="mb-1 text-xl">🧂</div>
                    <div className="text-3xl font-bold tabular-nums text-purple-600"><AnimatedNumber value={Math.round(500 + raceTemp * 10)} /></div>
                    <div className="mt-1 text-xs text-zinc-500">{tr("n.sodium")}</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-50 p-4 text-center transition-transform hover:-translate-y-0.5">
                    <div className="mb-1 text-xl">☕</div>
                    <div className="text-3xl font-bold tabular-nums text-emerald-600">{raceHours >= 3 ? <AnimatedNumber value={Math.round(raceHours * 20)} /> : "—"}</div>
                    <div className="mt-1 text-xs text-zinc-500">{tr("n.caffeine")}</div>
                  </div>
                </div>
              </div>

              {/* Plan de ravitaillement — timeline */}
              <div className="mt-6">
                <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{tr("n.plan")}</div>
                <div className="relative">
                  <span className="absolute bottom-5 left-6 top-5 w-px bg-zinc-200" aria-hidden="true" />
                  <div className="space-y-2">
                    {Array.from({ length: Math.min(Math.ceil(raceHours), 8) }, (_, i) => ({
                      h: i + 1, carbs: carbsPerHour, water: hydrationPerHour,
                      food: i === 0 ? tr("n.food1") : i % 2 === 0 ? tr("n.food2") : tr("n.food3"),
                    })).map((cp) => (
                      <div key={cp.h} className="relative flex items-center gap-3">
                        <span className="z-10 flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">H+{cp.h}</span>
                        <div className="flex flex-1 items-center gap-3 rounded-2xl bg-zinc-50 px-3.5 py-2.5">
                          <span className="flex-1 text-sm text-zinc-700">{cp.food}</span>
                          <span className="text-xs font-semibold text-orange-600">{cp.carbs} g</span>
                          <span className="text-xs font-semibold text-blue-600">{cp.water} ml</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PERTE DE POIDS ── */}
        {tab === "poids" && <WeightMode key="poids" />}
      </AnimatePresence>
    </div>
  );
}
