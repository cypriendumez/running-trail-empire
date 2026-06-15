"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from "framer-motion";
import {
  Shield, Heart, Utensils, Stethoscope, AlertTriangle,
  Phone, CheckCircle2, Zap, Droplets, BookOpen, Send, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SmartJournal } from "@/components/journal/SmartJournal";
import { useT } from "@/lib/i18n/LanguageProvider";

// ── i18n local (5 langues) — la page Santé naît traduite. ───────────────────────
type Tr = (k: string, p?: Record<string, string | number>) => string;
function fill(s: string, p?: Record<string, string | number>) {
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s;
}
const H: Record<string, Record<string, string>> = {
  fr: {
    "h.title": "Santé & Performance", "h.subtitle": "Votre kiné IA, votre journal, votre sécurité et votre nutrition — au même endroit.",
    "tab.kine": "Kiné IA", "tab.journal": "Journal", "tab.guardian": "Guardian", "tab.nutrition": "Nutrition",
    "k.where": "Où as-tu mal ?", "view.face": "Face", "view.dos": "Dos",
    "k.hint": "Touche une zone sur le corps ou dans la liste, ajuste la douleur, puis demande au kiné.",
    "k.pain": "Douleur", "k.painLight": "Gêne légère", "k.painHard": "Très douloureux",
    "k.ask": "Demander au kiné IA", "k.noZone": "Aucune zone sélectionnée",
    "k.protoExpress": "Protocole express", "k.protoWait": "Protocole d'attente — pour un plan précis, décris ta douleur au kiné IA ci-contre.",
    "chat.title": "Kiné IA", "chat.sub": "Réponses personnalisées selon ta charge & ta récup",
    "chat.seed": "Bonjour 👋 Je suis votre kiné du sport. Décrivez-moi ce que vous ressentez — zone, depuis quand, à l'effort ou au repos — ou cliquez une zone sur le schéma, et je vous aide.",
    "chat.thinking": "Le kiné réfléchit…", "chat.placeholder": "Ex : douleur au genou après mes sorties longues…",
    "chat.disclaimer": "⚕️ Conseils informatifs — ne remplacent pas un avis médical. Douleur forte / persistante → consultez.",
    "chat.errNoReply": "Je n'ai pas pu répondre, réessayez.", "chat.errConn": "Connexion impossible au kiné IA. Réessayez.",
    "k.askPrompt": "J'ai une douleur au niveau : {zone} (intensité {n}/10). Qu'est-ce que ça peut être, et que dois-je faire concrètement ?",
    "gd.title": "Guardian Mode", "gd.sub": "Sécurité active en course", "gd.on": "Guardian activé !", "gd.off": "Guardian désactivé",
    "gd.active": "Guardian actif — surveillance en temps réel", "gd.activeDesc": "Détection de chute · Arrêt cardiaque · Alerte GPS automatique",
    "gd.f1": "Détection de chute", "gd.f1d": "Accéléromètre + gyroscope", "gd.f2": "Arrêt cardiaque", "gd.f2d": "Via montre connectée (HRV)",
    "gd.f3": "Position GPS live", "gd.f3d": "Partagée avec les contacts d'urgence", "gd.f4": "Alerte automatique", "gd.f4d": "SMS + appel si pas de réponse en 2 min",
    "gd.emergency": "Contact d'urgence", "gd.name": "Prénom Nom", "gd.namePh": "Jean Dupont", "gd.phone": "Téléphone",
    "gd.saveContact": "Enregistrer le contact", "gd.savedContact": "Contact sauvegardé !",
    "gd.testTitle": "Test de l'alerte", "gd.testBtn": "Envoyer un message test", "gd.testToast": "Test envoyé à votre contact d'urgence",
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
    "h.title": "Health & Performance", "h.subtitle": "Your AI physio, your journal, your safety and your nutrition — all in one place.",
    "tab.kine": "AI Physio", "tab.journal": "Journal", "tab.guardian": "Guardian", "tab.nutrition": "Nutrition",
    "k.where": "Where does it hurt?", "view.face": "Front", "view.dos": "Back",
    "k.hint": "Tap a zone on the body or in the list, adjust the pain, then ask the physio.",
    "k.pain": "Pain", "k.painLight": "Mild discomfort", "k.painHard": "Very painful",
    "k.ask": "Ask the AI physio", "k.noZone": "No zone selected",
    "k.protoExpress": "Express protocol", "k.protoWait": "Stopgap protocol — for a precise plan, describe your pain to the AI physio on the right.",
    "chat.title": "AI Physio", "chat.sub": "Answers tailored to your load & recovery",
    "chat.seed": "Hello 👋 I'm your sports physio. Tell me what you feel — area, since when, on exertion or at rest — or click a zone on the diagram, and I'll help.",
    "chat.thinking": "The physio is thinking…", "chat.placeholder": "E.g. knee pain after my long runs…",
    "chat.disclaimer": "⚕️ Informational advice — not a substitute for medical care. Severe / persistent pain → see a doctor.",
    "chat.errNoReply": "I couldn't reply, please try again.", "chat.errConn": "Couldn't connect to the AI physio. Try again.",
    "k.askPrompt": "I have pain in: {zone} (intensity {n}/10). What could it be, and what should I concretely do?",
    "gd.title": "Guardian Mode", "gd.sub": "Active safety during your run", "gd.on": "Guardian enabled!", "gd.off": "Guardian disabled",
    "gd.active": "Guardian active — real-time monitoring", "gd.activeDesc": "Fall detection · Cardiac arrest · Automatic GPS alert",
    "gd.f1": "Fall detection", "gd.f1d": "Accelerometer + gyroscope", "gd.f2": "Cardiac arrest", "gd.f2d": "Via connected watch (HRV)",
    "gd.f3": "Live GPS position", "gd.f3d": "Shared with emergency contacts", "gd.f4": "Automatic alert", "gd.f4d": "SMS + call if no reply within 2 min",
    "gd.emergency": "Emergency contact", "gd.name": "First & last name", "gd.namePh": "John Smith", "gd.phone": "Phone",
    "gd.saveContact": "Save contact", "gd.savedContact": "Contact saved!",
    "gd.testTitle": "Alert test", "gd.testBtn": "Send a test message", "gd.testToast": "Test sent to your emergency contact",
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
    "h.title": "Gesundheit & Leistung", "h.subtitle": "Dein KI-Physio, dein Tagebuch, deine Sicherheit und deine Ernährung — alles an einem Ort.",
    "tab.kine": "KI-Physio", "tab.journal": "Tagebuch", "tab.guardian": "Guardian", "tab.nutrition": "Ernährung",
    "k.where": "Wo tut es weh?", "view.face": "Vorne", "view.dos": "Hinten",
    "k.hint": "Tippe eine Zone am Körper oder in der Liste an, stelle die Schmerzen ein und frage den Physio.",
    "k.pain": "Schmerz", "k.painLight": "Leichtes Unbehagen", "k.painHard": "Sehr schmerzhaft",
    "k.ask": "KI-Physio fragen", "k.noZone": "Keine Zone ausgewählt",
    "k.protoExpress": "Express-Protokoll", "k.protoWait": "Überbrückungs-Protokoll — für einen genauen Plan beschreibe deine Schmerzen rechts dem KI-Physio.",
    "chat.title": "KI-Physio", "chat.sub": "Antworten passend zu deiner Belastung & Erholung",
    "chat.seed": "Hallo 👋 Ich bin dein Sportphysio. Beschreibe mir, was du spürst — Bereich, seit wann, bei Belastung oder in Ruhe — oder klicke eine Zone im Schema an, und ich helfe dir.",
    "chat.thinking": "Der Physio überlegt…", "chat.placeholder": "Z. B. Knieschmerzen nach langen Läufen…",
    "chat.disclaimer": "⚕️ Informative Hinweise — kein Ersatz für ärztlichen Rat. Starke / anhaltende Schmerzen → zum Arzt.",
    "chat.errNoReply": "Ich konnte nicht antworten, bitte erneut versuchen.", "chat.errConn": "Keine Verbindung zum KI-Physio. Versuche es erneut.",
    "k.askPrompt": "Ich habe Schmerzen im Bereich: {zone} (Intensität {n}/10). Was könnte es sein, und was soll ich konkret tun?",
    "gd.title": "Guardian-Modus", "gd.sub": "Aktive Sicherheit beim Laufen", "gd.on": "Guardian aktiviert!", "gd.off": "Guardian deaktiviert",
    "gd.active": "Guardian aktiv — Echtzeit-Überwachung", "gd.activeDesc": "Sturzerkennung · Herzstillstand · Automatischer GPS-Alarm",
    "gd.f1": "Sturzerkennung", "gd.f1d": "Beschleunigungssensor + Gyroskop", "gd.f2": "Herzstillstand", "gd.f2d": "Über verbundene Uhr (HRV)",
    "gd.f3": "Live-GPS-Position", "gd.f3d": "Mit Notfallkontakten geteilt", "gd.f4": "Automatischer Alarm", "gd.f4d": "SMS + Anruf, wenn keine Antwort in 2 Min.",
    "gd.emergency": "Notfallkontakt", "gd.name": "Vor- & Nachname", "gd.namePh": "Max Mustermann", "gd.phone": "Telefon",
    "gd.saveContact": "Kontakt speichern", "gd.savedContact": "Kontakt gespeichert!",
    "gd.testTitle": "Alarm-Test", "gd.testBtn": "Testnachricht senden", "gd.testToast": "Test an deinen Notfallkontakt gesendet",
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
    "h.title": "Salud y Rendimiento", "h.subtitle": "Tu fisio IA, tu diario, tu seguridad y tu nutrición — todo en un solo lugar.",
    "tab.kine": "Fisio IA", "tab.journal": "Diario", "tab.guardian": "Guardian", "tab.nutrition": "Nutrición",
    "k.where": "¿Dónde te duele?", "view.face": "Frente", "view.dos": "Espalda",
    "k.hint": "Toca una zona del cuerpo o de la lista, ajusta el dolor y pregunta al fisio.",
    "k.pain": "Dolor", "k.painLight": "Molestia leve", "k.painHard": "Muy doloroso",
    "k.ask": "Preguntar al fisio IA", "k.noZone": "Ninguna zona seleccionada",
    "k.protoExpress": "Protocolo exprés", "k.protoWait": "Protocolo de espera — para un plan preciso, describe tu dolor al fisio IA a la derecha.",
    "chat.title": "Fisio IA", "chat.sub": "Respuestas adaptadas a tu carga y recuperación",
    "chat.seed": "Hola 👋 Soy tu fisio del deporte. Cuéntame qué sientes — zona, desde cuándo, en esfuerzo o en reposo — o haz clic en una zona del esquema, y te ayudo.",
    "chat.thinking": "El fisio está pensando…", "chat.placeholder": "Ej.: dolor de rodilla tras mis tiradas largas…",
    "chat.disclaimer": "⚕️ Consejos informativos — no sustituyen un consejo médico. Dolor fuerte / persistente → consulta.",
    "chat.errNoReply": "No he podido responder, inténtalo de nuevo.", "chat.errConn": "No se pudo conectar con el fisio IA. Inténtalo de nuevo.",
    "k.askPrompt": "Tengo dolor en: {zone} (intensidad {n}/10). ¿Qué puede ser y qué debo hacer concretamente?",
    "gd.title": "Modo Guardian", "gd.sub": "Seguridad activa en carrera", "gd.on": "¡Guardian activado!", "gd.off": "Guardian desactivado",
    "gd.active": "Guardian activo — monitorización en tiempo real", "gd.activeDesc": "Detección de caídas · Paro cardíaco · Alerta GPS automática",
    "gd.f1": "Detección de caídas", "gd.f1d": "Acelerómetro + giroscopio", "gd.f2": "Paro cardíaco", "gd.f2d": "Mediante reloj conectado (VFC)",
    "gd.f3": "Posición GPS en vivo", "gd.f3d": "Compartida con los contactos de emergencia", "gd.f4": "Alerta automática", "gd.f4d": "SMS + llamada si no respondes en 2 min",
    "gd.emergency": "Contacto de emergencia", "gd.name": "Nombre y apellidos", "gd.namePh": "Juan Pérez", "gd.phone": "Teléfono",
    "gd.saveContact": "Guardar contacto", "gd.savedContact": "¡Contacto guardado!",
    "gd.testTitle": "Prueba de alerta", "gd.testBtn": "Enviar un mensaje de prueba", "gd.testToast": "Prueba enviada a tu contacto de emergencia",
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
    "h.title": "Saúde e Desempenho", "h.subtitle": "O teu fisio IA, o teu diário, a tua segurança e a tua nutrição — tudo no mesmo sítio.",
    "tab.kine": "Fisio IA", "tab.journal": "Diário", "tab.guardian": "Guardian", "tab.nutrition": "Nutrição",
    "k.where": "Onde te dói?", "view.face": "Frente", "view.dos": "Costas",
    "k.hint": "Toca numa zona do corpo ou na lista, ajusta a dor e pergunta ao fisio.",
    "k.pain": "Dor", "k.painLight": "Desconforto ligeiro", "k.painHard": "Muito doloroso",
    "k.ask": "Perguntar ao fisio IA", "k.noZone": "Nenhuma zona selecionada",
    "k.protoExpress": "Protocolo expresso", "k.protoWait": "Protocolo de espera — para um plano preciso, descreve a tua dor ao fisio IA à direita.",
    "chat.title": "Fisio IA", "chat.sub": "Respostas adaptadas à tua carga e recuperação",
    "chat.seed": "Olá 👋 Sou o teu fisio do desporto. Conta-me o que sentes — zona, desde quando, em esforço ou em repouso — ou clica numa zona no esquema, e eu ajudo.",
    "chat.thinking": "O fisio está a pensar…", "chat.placeholder": "Ex.: dor no joelho após os meus treinos longos…",
    "chat.disclaimer": "⚕️ Conselhos informativos — não substituem aconselhamento médico. Dor forte / persistente → consulta.",
    "chat.errNoReply": "Não consegui responder, tenta novamente.", "chat.errConn": "Não foi possível ligar ao fisio IA. Tenta novamente.",
    "k.askPrompt": "Tenho dor em: {zone} (intensidade {n}/10). O que pode ser e o que devo fazer concretamente?",
    "gd.title": "Modo Guardian", "gd.sub": "Segurança ativa em prova", "gd.on": "Guardian ativado!", "gd.off": "Guardian desativado",
    "gd.active": "Guardian ativo — monitorização em tempo real", "gd.activeDesc": "Deteção de quedas · Paragem cardíaca · Alerta GPS automático",
    "gd.f1": "Deteção de quedas", "gd.f1d": "Acelerómetro + giroscópio", "gd.f2": "Paragem cardíaca", "gd.f2d": "Via relógio ligado (VFC)",
    "gd.f3": "Posição GPS em direto", "gd.f3d": "Partilhada com os contactos de emergência", "gd.f4": "Alerta automático", "gd.f4d": "SMS + chamada se não responderes em 2 min",
    "gd.emergency": "Contacto de emergência", "gd.name": "Nome completo", "gd.namePh": "João Silva", "gd.phone": "Telefone",
    "gd.saveContact": "Guardar contacto", "gd.savedContact": "Contacto guardado!",
    "gd.testTitle": "Teste de alerta", "gd.testBtn": "Enviar uma mensagem de teste", "gd.testToast": "Teste enviado ao teu contacto de emergência",
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

type Tab = "kine" | "journal" | "guardian" | "nutrition";
type ChatMsg = { role: "user" | "model"; text: string };

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

export function HealthCenter() {
  const { lang } = useT();
  const tr: Tr = (k, p) => fill(H[lang]?.[k] ?? H.fr[k] ?? k, p);
  const [tab, setTab] = useState<Tab>("kine");
  const [view, setView] = useState<"face" | "dos">("face");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [painLevel, setPainLevel] = useState(5);
  const [guardianEnabled, setGuardianEnabled] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [raceHours, setRaceHours] = useState(6);
  const [raceTemp, setRaceTemp] = useState(15);

  // ── Chat kiné IA ──────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "model", text: tr("chat.seed") },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const zoneMap = VIEW_ZONES[view];
  const selectedZone = selectedSlot ? zoneMap[selectedSlot] : null;
  // Match du protocole sur le libellé FR (stable, quelle que soit la langue d'affichage).
  const rehabProtocol = selectedZone ? protocolFor(H.fr[selectedZone.labelKey] ?? "") : [];

  const carbsPerHour = Math.round(40 + (raceHours > 3 ? (raceHours - 3) * 5 : 0));
  const hydrationPerHour = Math.round(500 + (raceTemp - 15) * 20);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/ai/physio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, zone: selectedSlot ? tr(VIEW_ZONES[view][selectedSlot]?.labelKey ?? "") || null : null, painLevel: selectedSlot ? painLevel : null, history }),
      });
      const json = await res.json();
      if (json.reply) setMessages((m) => [...m, { role: "model", text: json.reply }]);
      else setMessages((m) => [...m, { role: "model", text: "⚠️ " + (json.error || tr("chat.errNoReply")) }]);
    } catch {
      setMessages((m) => [...m, { role: "model", text: "⚠️ " + tr("chat.errConn") }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, selectedSlot, view, painLevel, lang]);

  const askAboutZone = () => {
    if (!selectedZone) return;
    send(tr("k.askPrompt", { zone: tr(selectedZone.labelKey), n: painLevel }));
  };

  return (
    <div className="space-y-5">
      {/* En-tête — hero */}
      <div className="flex items-center gap-3.5">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-[0_10px_26px_-10px_rgba(16,185,129,0.65)]">
          <Heart className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{tr("h.title")}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{tr("h.subtitle")}</p>
        </div>
      </div>

      {/* Onglets — pastille active qui glisse en douceur */}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-zinc-100/80 p-1 w-fit ring-1 ring-zinc-200/60">
        {([
          { v: "kine", l: tr("tab.kine"), icon: Stethoscope },
          { v: "journal", l: tr("tab.journal"), icon: BookOpen },
          { v: "guardian", l: tr("tab.guardian"), icon: Shield },
          { v: "nutrition", l: tr("tab.nutrition"), icon: Utensils },
        ] as const).map((t) => {
          const active = tab === t.v;
          return (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors sm:px-5 ${active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}>
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
            className="grid grid-cols-12 gap-4">

            {/* Schéma corporel + sélection de zone */}
            <div className="col-span-12 lg:col-span-5 space-y-4">
              <div className="bento-card">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-zinc-900 text-sm">{tr("k.where")}</h3>
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
                        const common = {
                          fill: on ? "#ef4444" : "url(#bodyGrad)",
                          stroke: on ? "#dc2626" : "#cbd1d8",
                          strokeWidth: 1,
                          className: "cursor-pointer transition-opacity hover:opacity-70",
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
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${selectedSlot === slot ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                              {tr(z.labelKey)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedZone ? (
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("k.pain")} — <span className="font-semibold text-zinc-800">{tr(selectedZone.labelKey)}</span> : <span className="font-bold text-red-600">{painLevel}/10</span></label>
                    <input type="range" min={1} max={10} value={painLevel} onChange={(e) => setPainLevel(+e.target.value)} className="w-full accent-red-500" />
                    <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5"><span>{tr("k.painLight")}</span><span>{tr("k.painHard")}</span></div>
                    <button onClick={askAboutZone} className="btn-brand w-full justify-center mt-3 text-sm">
                      <Sparkles className="w-4 h-4" /> {tr("k.ask")}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 text-center mt-3 pt-3 border-t border-zinc-100">{tr("k.noZone")}</p>
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
            <div className="col-span-12 lg:col-span-7 bento-card flex flex-col" style={{ minHeight: 520 }}>
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center"><Stethoscope className="w-5 h-5 text-green-600" /></div>
                <div>
                  <div className="font-semibold text-zinc-900 text-sm">{tr("chat.title")}</div>
                  <div className="text-xs text-zinc-400">{tr("chat.sub")}</div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3" style={{ maxHeight: 440 }}>
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === "user" ? "bg-zinc-900 text-white rounded-br-md" : "bg-zinc-100 text-zinc-800 rounded-bl-md"
                    }`}>{m.text}</div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 text-zinc-500 px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> {tr("chat.thinking")}
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}
                  placeholder={tr("chat.placeholder")}
                  className="flex-1 px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400" />
                <button type="submit" disabled={sending || !input.trim()}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[11px] text-zinc-400 mt-2">{tr("chat.disclaimer")}</p>
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
        {tab === "guardian" && (
          <motion.div key="guardian" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid grid-cols-2 gap-4">

            {/* Console de sécurité */}
            <div className="bento-card col-span-2 md:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-colors duration-300 ${guardianEnabled ? "bg-green-100 text-green-600" : "bg-zinc-100 text-zinc-400"}`}>
                    <Shield className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{tr("gd.title")}</h3>
                    <p className="text-sm text-zinc-500">{tr("gd.sub")}</p>
                  </div>
                </div>
                <button onClick={() => { setGuardianEnabled(!guardianEnabled); toast.success(guardianEnabled ? tr("gd.off") : tr("gd.on")); }}
                  role="switch" aria-checked={guardianEnabled} aria-label={tr("gd.title")}
                  className={`relative h-7 w-14 flex-shrink-0 rounded-full transition-colors duration-300 ${guardianEnabled ? "bg-green-500" : "bg-zinc-200"}`}>
                  <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${guardianEnabled ? "translate-x-7" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Bannière d'état (apparition animée) */}
              <AnimatePresence initial={false}>
                {guardianEnabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="mt-4 rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                        </span>
                        {tr("gd.active")}
                      </div>
                      <p className="mt-1 text-xs text-green-600">{tr("gd.activeDesc")}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Capteurs */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { icon: "🤸", label: tr("gd.f1"), desc: tr("gd.f1d"), tile: "bg-amber-50 ring-amber-100" },
                  { icon: "❤️", label: tr("gd.f2"), desc: tr("gd.f2d"), tile: "bg-rose-50 ring-rose-100" },
                  { icon: "📍", label: tr("gd.f3"), desc: tr("gd.f3d"), tile: "bg-blue-50 ring-blue-100" },
                  { icon: "📞", label: tr("gd.f4"), desc: tr("gd.f4d"), tile: "bg-violet-50 ring-violet-100" },
                ].map((f) => (
                  <div key={f.label} className={`flex items-start gap-2.5 rounded-2xl border border-zinc-100 p-3 transition-colors ${guardianEnabled ? "bg-white" : "bg-zinc-50/60"}`}>
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base ring-1 ${f.tile}`}>{f.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-900">{f.label}</span>
                        <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${guardianEnabled ? "text-green-500" : "text-zinc-300"}`} />
                      </div>
                      <div className="text-xs leading-snug text-zinc-500">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact d'urgence */}
            <div className="bento-card col-span-2 md:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-600"><Phone className="h-[18px] w-[18px]" /></span>
                <h3 className="font-semibold text-zinc-900">{tr("gd.emergency")}</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">{tr("gd.name")}</label>
                  <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder={tr("gd.namePh")}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm transition-colors focus:border-green-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">{tr("gd.phone")}</label>
                  <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+33 6 12 34 56 78" type="tel"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm transition-colors focus:border-green-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                </div>
                <button onClick={() => toast.success(tr("gd.savedContact"))} className="btn-brand w-full justify-center">
                  <Phone className="h-4 w-4" /> {tr("gd.saveContact")}
                </button>
              </div>
              <div className="mt-6 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> {tr("gd.testTitle")}</div>
                <button onClick={() => toast(tr("gd.testToast"), { icon: "📱" })}
                  className="w-full rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 active:scale-[0.99]">
                  {tr("gd.testBtn")}
                </button>
              </div>
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
                      <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">{tr("n.duration")}</label>
                      <span className="text-lg font-bold tabular-nums text-zinc-900">{raceHours}<span className="ml-0.5 text-sm font-semibold text-zinc-400">h</span></span>
                    </div>
                    <input type="range" min={1} max={24} step={0.5} value={raceHours} onChange={(e) => setRaceHours(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">{tr("n.temp")}</label>
                      <span className="text-lg font-bold tabular-nums text-zinc-900">{raceTemp}<span className="ml-0.5 text-sm font-semibold text-zinc-400">°C</span></span>
                    </div>
                    <input type="range" min={0} max={40} step={1} value={raceTemp} onChange={(e) => setRaceTemp(parseInt(e.target.value))} className="w-full accent-orange-500" />
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
                  <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4 text-center transition-transform hover:-translate-y-0.5">
                    <div className="mb-1 text-xl">☕</div>
                    <div className="text-3xl font-bold tabular-nums text-green-600">{raceHours >= 3 ? <AnimatedNumber value={Math.round(raceHours * 20)} /> : "—"}</div>
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
      </AnimatePresence>
    </div>
  );
}
