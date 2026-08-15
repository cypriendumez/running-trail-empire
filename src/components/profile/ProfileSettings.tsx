"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { languageOptions } from "@/i18n/config";
import { useT } from "@/lib/i18n/LanguageProvider";
import { vo2maxEstimate, vo2maxLabel, racePredictions, vmaFromVo2max, predictRaceSec } from "@/lib/running/fitness";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthLabel } from "@/data/healthCatalog";
import { TERRAINS, terrainLabel } from "@/data/terrainCatalog";
import type { Lang } from "@/lib/i18n/translations";
import {
  User, Activity, Footprints, CreditCard, Target, Bell,
  Flame, TrendingUp, Zap, Trophy, Calendar, Plus, Trash2,
  Shield, ChevronRight, Heart, Wind, Clock, BarChart2,
  CheckCircle, X, Save, AlertCircle, Star, Camera, Loader2, Download,
} from "lucide-react";

// ── i18n local (5 langues) — la page Profil naît traduite. ──────────────────────
type Tr = (k: string, p?: Record<string, string | number>) => string;
function fill(s: string, p?: Record<string, string | number>) {
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s;
}
const P: Record<string, Record<string, string>> = {
  fr: {
    "tab.profile": "Profil", "tab.goals": "Objectifs", "tab.performance": "Performance", "tab.shoes": "Chaussures", "tab.subscription": "Abonnement",
    "common.save": "Enregistrer", "common.saving": "Sauvegarde…", "common.cancel": "Annuler", "common.add": "Ajouter",
    "hero.myProfile": "Mon profil", "hero.score": "Score {n}/100", "hero.streak": "{n} jour de suite", "hero.streakP": "{n} jours de suite",
    "stat.kmYear": "Km courus cette année", "stat.kmMonth": "Km courus ce mois", "stat.sessions": "Séances de course", "stat.longest": "Plus longue course",
    "split.title": "Répartition par discipline", "split.year": "cette année", "split.road": "Course route", "split.trail": "Trail", "split.bike": "Vélo", "split.hike": "Randonnée / marche",
    "split.note": "Les compteurs ci-dessus ne comptent que la course à pied — c'est aussi ce que le coach utilise pour dimensionner tes séances. Le vélo et la randonnée comptent dans ta fatigue, pas dans ton volume de course.",
    "pi.title": "Informations personnelles",
    "photo.title": "Photo de profil", "photo.hint": "JPG, PNG, WebP · max 5 Mo", "photo.uploading": "Upload…", "photo.change": "Changer la photo",
    "f.name": "Nom complet", "f.age": "Âge", "f.height": "Taille (cm)", "f.weight": "Poids (kg)", "f.lang": "Langue", "f.bio": "Bio courte", "f.bioPh": "Coureur trail passionné, objectif UTMB 2027…", "f.warmup": "⏱️ Échauffement habituel", "f.cooldown": "🧊 Retour au calme habituel", "f.wcHint": "Cale l'échauffement et le retour au calme (fréquence cardiaque douce, Z1) des séances envoyées à ta montre. Le corps de séance garde ses allures précises.", "f.longMode": "Sorties longues", "f.longRun": "🏃 En course", "f.longBike": "🚴 En vélo", "f.longHint": "Beaucoup de pros remplacent la sortie longue par du vélo : même volume aérobie, sans l'impact. Ton coach et l'IA s'adaptent automatiquement.",
    "f.exp": "🗓️ Ancienneté en course à pied", "f.exp0": "< 1 an", "f.exp1": "1 an", "f.exp2": "2 ans", "f.exp4": "3-5 ans", "f.exp8": "6-10 ans", "f.exp12": "10 ans +", "f.expHint": "Ton cœur progresse en semaines, tes tendons en années. Le coach IA s'en sert pour plafonner la charge et éviter la blessure du coureur qui va trop vite.", "f.terr": "🗺️ Terrain habituel", "f.terrHint": "Sur sable ou en montagne, l'allure au km ne veut plus rien dire : le coach bascule sur la fréquence cardiaque et la durée.", "f.elev": "⛰️ Rapport au dénivelé", "f.elevEvite": "Je l'évite", "f.elevModere": "Modéré", "f.elevAime": "J'aime ça", "f.elevSpec": "Mon terrain", "f.elevHint": "Détermine la place des côtes et du D+ dans tes semaines.",
    "f.dpw": "📆 Séances de course par semaine", "f.dpwHint": "Un plan qu'on ne peut pas suivre ne sert à rien : le coach ne dépassera jamais ce nombre.", "f.days": "Jours disponibles", "f.daysHint": "Décoche les jours où courir est impossible.", "f.dayShort": "D,L,M,M,J,V,S",
    "h.title": "Santé & antécédents", "h.sub": "Privé. Sert à ton coach IA pour ne jamais te prescrire une séance qui te mettrait en danger.", "h.cond": "Pathologies", "h.inj": "Zones de blessure récurrentes", "h.notes": "Autre chose à signaler ?", "h.notesPh": "Traitement en cours, opération, contre-indication du médecin…", "h.disc": "Pacevo ne remplace pas un avis médical. En cas de doute, consulte un professionnel de santé.",
    "h.none": "Rien à signaler, je suis en bonne santé",
    "f.terrMulti": "plusieurs choix possibles",
    "notif.title": "Notifications", "notif.workout": "Rappels de séance", "notif.goal": "Objectifs atteints", "notif.league": "Classement ligue", "notif.coach": "Conseils du coach IA", "notif.save": "Sauvegarder les préférences",
    "double.title": "Deux séances par jour", "double.hint": "Le coach pourra scinder une sortie facile en deux (matin + soir) quand ton volume le justifie. Même volume, mieux absorbé — il te dira ce qui manque tant qu'il ne le fait pas.", "privacy.private": "Compte privé", "privacy.privateHint": "Seuls tes amis (vous vous suivez tous les deux) peuvent commenter tes publications.", "privacy.publicHint": "N'importe qui peut commenter les publications que tu rends visibles.",
    "guard.title": "Mode Guardian", "guard.desc": "Bloque automatiquement les séances à haute intensité en cas de surentraînement détecté par l'IA (HRV, fatigue mentale).", "guard.active": "Actif — votre santé est protégée",
    "gdpr.title": "Données & confidentialité", "gdpr.desc": "Conformément au RGPD, tu peux récupérer toutes tes données à tout moment.", "gdpr.export": "Exporter mes données (JSON)", "gdpr.exporting": "Export…", "gdpr.privacy": "Politique de confidentialité", "gdpr.delPre": "Pour supprimer ton compte et toutes tes données, écris à ", "gdpr.delPost": " — suppression sous 30 jours.",
    "goals.title": "Mes objectifs", "goals.summary": "{a} en cours · {b} atteints", "goals.new": "Nouvel objectif", "goals.type": "Type", "goals.name": "Nom", "goals.namePhRace": "Marathon de Paris 2027", "goals.namePhOther": "Objectif hebdo", "goals.targetVal": "Valeur cible ({unit})", "goals.targetValPh": "42.2", "goals.targetDate": "Date cible", "goals.create": "Créer l'objectif", "goals.emptyTitle": "Aucun objectif défini", "goals.emptyDesc": "Fixez-vous une course cible, un volume hebdo…", "goals.achieved": "Atteint ✓", "goals.past": "Passé", "goals.context": "Contexte actuel", "goals.ctxMonth": "km ce mois", "goals.ctxYear": "km cette année", "goals.ctxStreak": "jours de suite",
    "gt.race": "Course cible", "gt.weekly": "Km hebdo", "gt.monthly": "Km mensuel", "gt.pace": "Allure cible", "gt.weight": "Poids cible",
    "perf.title": "Données de performance", "perf.vma": "VMA", "perf.maxHr": "FC Max", "perf.restHr": "FC Repos", "perf.lt": "Seuil lactique",
    "perf.vmaWarn": "VMA estimée depuis tes meilleures séances (pas de test enregistré). Fais un test VMA pour des allures et prédictions exactes.",
    "perf.vo2est": "VO2max estimé", "perf.vo2from": "D'après {sources}", "perf.emptyTitle": "Aucune donnée de performance", "perf.emptyDesc": "Fais le test VMA (à l'inscription ou dans Paramètres) pour tout calibrer",
    "perf.predTitle": "Prédictions de chrono", "perf.vo2trend": "Tendance VO2max", "perf.predGraph": "Tendance des allures prédites", "perf.predDescTest": "Estimées depuis ta VMA (test). Un test VMA récent = des prédictions plus justes.", "perf.predDescSess": "Estimées depuis ta VMA (tes séances récentes). Un test VMA récent = des prédictions plus justes.", "perf.predDescGarmin": "Calées sur ta VO2max Garmin (mesurée par ta montre) — bien plus fiable qu'une estimation.",
    "perf.zonesTitle": "Zones de fréquence cardiaque", "perf.maxHrLabel": "FC max : {n} bpm", "perf.pacesTitle": "Allures de référence",
    "perf.loadTitle": "Forme & charge", "perf.fitness": "Condition", "perf.fatigue": "Fatigue", "perf.form": "Forme", "perf.loadHint": "Condition = forme de fond · Fatigue = charge récente · Forme = fraîcheur (positif = frais).", "perf.thresholdPace": "Allure seuil",
    "zone.z1": "Récupération", "zone.z1d": "Récupération active, ultra-endurance", "zone.z2": "Aérobie", "zone.z2d": "Base aérobie, sorties longues", "zone.z3": "Tempo", "zone.z3d": "Seuil aérobie, tempo", "zone.z4": "Seuil", "zone.z4d": "Seuil lactique, intervalles", "zone.z5": "VO2max", "zone.z5d": "Effort maximal, VMA",
    "pace.z2": "Z2 (endurance)", "pace.tempo": "Tempo (Z3-Z4)", "pace.seuil": "Seuil (Z4)", "pace.vma": "VMA (Z5)",
    "shoes.title": "Mon Garage", "shoes.count": "{n} paire active", "shoes.countP": "{n} paires actives", "shoes.new": "Nouvelle paire", "shoes.brand": "Marque", "shoes.brandPh": "Nike, Hoka, Salomon…", "shoes.model": "Modèle", "shoes.modelPh": "Vaporfly 3, Speedgoat…", "shoes.life": "Durée de vie (km)", "shoes.buyDate": "Date d'achat", "shoes.addGarage": "Ajouter au garage", "shoes.suggestHint": "Commence à taper la marque puis le modèle — on te suggère les modèles populaires.", "shoes.emptyTitle": "Aucune chaussure dans le garage", "shoes.emptyDesc": "Ajoutez vos paires pour suivre leur kilométrage", "shoes.replace": "À remplacer", "shoes.watch": "Surveiller", "shoes.good": "Bon état", "shoes.km": "{cur} km parcourus · {rem} km restants",
    "sub.title": "Abonnement actuel", "sub.plan": "Plan {tier}", "sub.freeDesc": "Accès limité aux fonctionnalités de base", "sub.proDesc": "Accès complet à toutes les fonctionnalités", "sub.active": "✓ Actif", "sub.free": "Gratuit", "sub.pro": "Pro",
    "feat.dash": "Dashboard & statistiques", "feat.journal": "Journal intelligent (NLP)", "feat.plans3": "Plans d'entraînement (3 max)", "feat.plansUnli": "Plans d'entraînement illimités", "feat.coach": "Coach IA personnalisé (Claude)", "feat.ghost": "Ghost Runner IA", "feat.vma": "Analyses VMA & zones cardiaques", "feat.sync": "Sync montres GPS (Garmin, Polar…)", "feat.shop": "Shopping Hub & recommandations", "feat.leagues": "Ligues & classements",
    "sub.goPro": "Passer à Pro", "sub.unlock": "Débloquez toutes les fonctionnalités", "sub.perMonth": "/mois", "sub.yearly": "ou 84€/an (-30%)", "sub.trial": "Commencer l'essai gratuit 14 jours",
    "t.saveErr": "Erreur lors de la sauvegarde", "t.saveOk": "Profil mis à jour !", "t.uploadErr": "Erreur lors de l'upload", "t.photoOk": "Photo de profil mise à jour !", "t.netErr": "Erreur réseau", "t.goalsSql": "Objectifs pas encore activés — lance le SQL fourni dans Supabase.", "t.createErr": "Erreur lors de la création", "t.goalAdd": "Objectif ajouté !", "t.goalDel": "Objectif supprimé", "t.addErr": "Erreur lors de l'ajout", "t.shoeAdd": "Chaussure ajoutée !", "t.shoeDel": "Chaussure retirée du garage", "t.exportOk": "Tes données ont été exportées (JSON).", "t.exportErr": "Export impossible, réessaie.",
  },
  en: {
    "tab.profile": "Profile", "tab.goals": "Goals", "tab.performance": "Performance", "tab.shoes": "Shoes", "tab.subscription": "Subscription",
    "common.save": "Save", "common.saving": "Saving…", "common.cancel": "Cancel", "common.add": "Add",
    "hero.myProfile": "My profile", "hero.score": "Score {n}/100", "hero.streak": "{n} day in a row", "hero.streakP": "{n} days in a row",
    "stat.kmYear": "Km run this year", "stat.kmMonth": "Km run this month", "stat.sessions": "Runs this month", "stat.longest": "Longest run",
    "split.title": "By discipline", "split.year": "this year", "split.road": "Road running", "split.trail": "Trail", "split.bike": "Cycling", "split.hike": "Hiking / walking",
    "split.note": "The counters above only include running — the same figure your coach uses to size your sessions. Cycling and hiking count towards fatigue, not towards running volume.",
    "pi.title": "Personal information",
    "photo.title": "Profile photo", "photo.hint": "JPG, PNG, WebP · max 5 MB", "photo.uploading": "Uploading…", "photo.change": "Change photo",
    "f.name": "Full name", "f.age": "Age", "f.height": "Height (cm)", "f.weight": "Weight (kg)", "f.lang": "Language", "f.bio": "Short bio", "f.bioPh": "Passionate trail runner, UTMB 2027 goal…", "f.warmup": "⏱️ Usual warm-up", "f.cooldown": "🧊 Usual cool-down", "f.wcHint": "Sets the warm-up and cool-down (easy heart rate, Z1) of the sessions sent to your watch. The main set keeps its exact paces.", "f.longMode": "Long sessions", "f.longRun": "🏃 Running", "f.longBike": "🚴 Cycling", "f.longHint": "Many pros swap the long run for cycling: same aerobic volume, no impact. Your coach and the AI adapt automatically.",
    "f.exp": "🗓️ Running experience", "f.exp0": "< 1 year", "f.exp1": "1 year", "f.exp2": "2 years", "f.exp4": "3-5 years", "f.exp8": "6-10 years", "f.exp12": "10+ years", "f.expHint": "Your heart adapts in weeks, your tendons in years. The AI coach uses this to cap training load and prevent overuse injuries.", "f.terr": "🗺️ Usual terrain", "f.terrHint": "On sand or in the mountains, pace per km means nothing: your coach switches to heart rate and duration.", "f.elev": "⛰️ Relationship with elevation", "f.elevEvite": "I avoid it", "f.elevModere": "Moderate", "f.elevAime": "I enjoy it", "f.elevSpec": "My terrain", "f.elevHint": "Sets how much hill work and vertical gain your weeks contain.",
    "f.dpw": "📆 Runs per week", "f.dpwHint": "A plan you can't follow is worthless: your coach will never exceed this number.", "f.days": "Available days", "f.daysHint": "Untick the days when running is impossible.", "f.dayShort": "S,M,T,W,T,F,S",
    "h.title": "Health & history", "h.sub": "Private. Used by your AI coach to never prescribe a session that could put you at risk.", "h.cond": "Conditions", "h.inj": "Recurring injury areas", "h.notes": "Anything else we should know?", "h.notesPh": "Current medication, surgery, doctor's restriction…", "h.disc": "Pacevo is not a substitute for medical advice. When in doubt, consult a healthcare professional.",
    "h.none": "Nothing to report, I'm in good health",
    "f.terrMulti": "select all that apply",
    "notif.title": "Notifications", "notif.workout": "Workout reminders", "notif.goal": "Goals achieved", "notif.league": "League ranking", "notif.coach": "AI coach tips", "notif.save": "Save preferences",
    "double.title": "Two sessions a day", "double.hint": "The coach may split an easy run in two (morning + evening) when your volume justifies it. Same volume, better absorbed — it will tell you what is missing until then.", "privacy.private": "Private account", "privacy.privateHint": "Only your friends (you follow each other) can comment on your posts.", "privacy.publicHint": "Anyone can comment on the posts you make visible.",
    "guard.title": "Guardian Mode", "guard.desc": "Automatically blocks high-intensity sessions when the AI detects overtraining (HRV, mental fatigue).", "guard.active": "Active — your health is protected",
    "gdpr.title": "Data & privacy", "gdpr.desc": "Under GDPR, you can retrieve all your data at any time.", "gdpr.export": "Export my data (JSON)", "gdpr.exporting": "Exporting…", "gdpr.privacy": "Privacy policy", "gdpr.delPre": "To delete your account and all your data, email ", "gdpr.delPost": " — deletion within 30 days.",
    "goals.title": "My goals", "goals.summary": "{a} ongoing · {b} achieved", "goals.new": "New goal", "goals.type": "Type", "goals.name": "Name", "goals.namePhRace": "Paris Marathon 2027", "goals.namePhOther": "Weekly goal", "goals.targetVal": "Target value ({unit})", "goals.targetValPh": "42.2", "goals.targetDate": "Target date", "goals.create": "Create goal", "goals.emptyTitle": "No goal set", "goals.emptyDesc": "Set yourself a target race, a weekly volume…", "goals.achieved": "Achieved ✓", "goals.past": "Past", "goals.context": "Current context", "goals.ctxMonth": "km this month", "goals.ctxYear": "km this year", "goals.ctxStreak": "days in a row",
    "gt.race": "Target race", "gt.weekly": "Weekly km", "gt.monthly": "Monthly km", "gt.pace": "Target pace", "gt.weight": "Target weight",
    "perf.title": "Performance data", "perf.vma": "vVO2max", "perf.maxHr": "Max HR", "perf.restHr": "Resting HR", "perf.lt": "Lactate threshold",
    "perf.vmaWarn": "vVO2max estimated from your best sessions (no test on record). Take a vVO2max test for exact paces and predictions.",
    "perf.vo2est": "Estimated VO2max", "perf.vo2from": "From {sources}", "perf.emptyTitle": "No performance data", "perf.emptyDesc": "Take the vVO2max test (at sign-up or in Settings) to calibrate everything",
    "perf.predTitle": "Time predictions", "perf.vo2trend": "VO2max trend", "perf.predGraph": "Predicted pace trend", "perf.predDescTest": "Estimated from your vVO2max (test). A recent test = sharper predictions.", "perf.predDescSess": "Estimated from your vVO2max (your recent sessions). A recent test = sharper predictions.", "perf.predDescGarmin": "Based on your Garmin VO2max (measured by your watch) — far more reliable than an estimate.",
    "perf.zonesTitle": "Heart rate zones", "perf.maxHrLabel": "Max HR: {n} bpm", "perf.pacesTitle": "Reference paces",
    "perf.loadTitle": "Form & load", "perf.fitness": "Fitness", "perf.fatigue": "Fatigue", "perf.form": "Form", "perf.loadHint": "Fitness = long-term form · Fatigue = recent load · Form = freshness (positive = fresh).", "perf.thresholdPace": "Threshold pace",
    "zone.z1": "Recovery", "zone.z1d": "Active recovery, ultra-endurance", "zone.z2": "Aerobic", "zone.z2d": "Aerobic base, long runs", "zone.z3": "Tempo", "zone.z3d": "Aerobic threshold, tempo", "zone.z4": "Threshold", "zone.z4d": "Lactate threshold, intervals", "zone.z5": "VO2max", "zone.z5d": "Maximal effort, vVO2max",
    "pace.z2": "Z2 (endurance)", "pace.tempo": "Tempo (Z3-Z4)", "pace.seuil": "Threshold (Z4)", "pace.vma": "vVO2max (Z5)",
    "shoes.title": "My Garage", "shoes.count": "{n} active pair", "shoes.countP": "{n} active pairs", "shoes.new": "New pair", "shoes.brand": "Brand", "shoes.brandPh": "Nike, Hoka, Salomon…", "shoes.model": "Model", "shoes.modelPh": "Vaporfly 3, Speedgoat…", "shoes.life": "Lifespan (km)", "shoes.buyDate": "Purchase date", "shoes.addGarage": "Add to garage", "shoes.suggestHint": "Start typing the brand then the model — we suggest popular models.", "shoes.emptyTitle": "No shoes in the garage", "shoes.emptyDesc": "Add your pairs to track their mileage", "shoes.replace": "Replace", "shoes.watch": "Watch", "shoes.good": "Good", "shoes.km": "{cur} km run · {rem} km left",
    "sub.title": "Current subscription", "sub.plan": "{tier} plan", "sub.freeDesc": "Limited access to basic features", "sub.proDesc": "Full access to all features", "sub.active": "✓ Active", "sub.free": "Free", "sub.pro": "Pro",
    "feat.dash": "Dashboard & stats", "feat.journal": "Smart journal (NLP)", "feat.plans3": "Training plans (3 max)", "feat.plansUnli": "Unlimited training plans", "feat.coach": "Personalized AI coach (Claude)", "feat.ghost": "AI Ghost Runner", "feat.vma": "vVO2max & HR-zone analysis", "feat.sync": "GPS watch sync (Garmin, Polar…)", "feat.shop": "Shopping Hub & recommendations", "feat.leagues": "Leagues & rankings",
    "sub.goPro": "Go Pro", "sub.unlock": "Unlock all features", "sub.perMonth": "/mo", "sub.yearly": "or €84/yr (-30%)", "sub.trial": "Start the 14-day free trial",
    "t.saveErr": "Error while saving", "t.saveOk": "Profile updated!", "t.uploadErr": "Upload error", "t.photoOk": "Profile photo updated!", "t.netErr": "Network error", "t.goalsSql": "Goals not enabled yet — run the provided SQL in Supabase.", "t.createErr": "Error while creating", "t.goalAdd": "Goal added!", "t.goalDel": "Goal deleted", "t.addErr": "Error while adding", "t.shoeAdd": "Shoe added!", "t.shoeDel": "Shoe removed from garage", "t.exportOk": "Your data has been exported (JSON).", "t.exportErr": "Export failed, try again.",
  },
  de: {
    "tab.profile": "Profil", "tab.goals": "Ziele", "tab.performance": "Leistung", "tab.shoes": "Schuhe", "tab.subscription": "Abo",
    "common.save": "Speichern", "common.saving": "Speichern…", "common.cancel": "Abbrechen", "common.add": "Hinzufügen",
    "hero.myProfile": "Mein Profil", "hero.score": "Score {n}/100", "hero.streak": "{n} Tag in Folge", "hero.streakP": "{n} Tage in Folge",
    "stat.kmYear": "Gelaufene km dieses Jahr", "stat.kmMonth": "Gelaufene km diesen Monat", "stat.sessions": "Läufe diesen Monat", "stat.longest": "Längster Lauf",
    "split.title": "Nach Disziplin", "split.year": "dieses Jahr", "split.road": "Straßenlauf", "split.trail": "Trail", "split.bike": "Radfahren", "split.hike": "Wandern / Gehen",
    "split.note": "Die Zähler oben berücksichtigen nur das Laufen — genau der Wert, mit dem dein Coach deine Einheiten bemisst. Rad und Wandern zählen zur Ermüdung, nicht zum Laufumfang.",
    "pi.title": "Persönliche Daten",
    "photo.title": "Profilbild", "photo.hint": "JPG, PNG, WebP · max. 5 MB", "photo.uploading": "Hochladen…", "photo.change": "Bild ändern",
    "f.name": "Vollständiger Name", "f.age": "Alter", "f.height": "Größe (cm)", "f.weight": "Gewicht (kg)", "f.lang": "Sprache", "f.bio": "Kurz-Bio", "f.bioPh": "Begeisterter Trailrunner, Ziel UTMB 2027…", "f.warmup": "⏱️ Übliches Aufwärmen", "f.cooldown": "🧊 Übliches Auslaufen", "f.wcHint": "Legt Aufwärmen und Auslaufen (lockere Herzfrequenz, Z1) der an deine Uhr gesendeten Einheiten fest. Der Hauptteil behält seine genauen Tempi.", "f.longMode": "Lange Einheiten", "f.longRun": "🏃 Laufen", "f.longBike": "🚴 Radfahren", "f.longHint": "Viele Profis ersetzen den langen Lauf durch Radfahren: gleiches aerobes Volumen, ohne Belastung. Dein Coach und die KI passen sich automatisch an.",
    "f.exp": "🗓️ Lauferfahrung", "f.exp0": "< 1 Jahr", "f.exp1": "1 Jahr", "f.exp2": "2 Jahre", "f.exp4": "3-5 Jahre", "f.exp8": "6-10 Jahre", "f.exp12": "10+ Jahre", "f.expHint": "Dein Herz passt sich in Wochen an, deine Sehnen in Jahren. Der KI-Coach begrenzt damit die Belastung und beugt Überlastungsverletzungen vor.", "f.terr": "🗺️ Übliches Terrain", "f.terrHint": "Auf Sand oder im Gebirge sagt das Tempo pro km nichts aus: Dein Coach steuert über Herzfrequenz und Dauer.", "f.elev": "⛰️ Verhältnis zu Höhenmetern", "f.elevEvite": "Ich meide sie", "f.elevModere": "Moderat", "f.elevAime": "Mag ich", "f.elevSpec": "Mein Terrain", "f.elevHint": "Bestimmt den Anteil an Bergläufen und Höhenmetern in deinen Wochen.",
    "f.dpw": "📆 Läufe pro Woche", "f.dpwHint": "Ein Plan, dem du nicht folgen kannst, ist wertlos: Dein Coach überschreitet diese Zahl nie.", "f.days": "Verfügbare Tage", "f.daysHint": "Hake die Tage ab, an denen Laufen unmöglich ist.", "f.dayShort": "S,M,D,M,D,F,S",
    "h.title": "Gesundheit & Vorgeschichte", "h.sub": "Privat. Dein KI-Coach nutzt dies, um dir nie eine riskante Einheit zu verordnen.", "h.cond": "Erkrankungen", "h.inj": "Wiederkehrende Verletzungsbereiche", "h.notes": "Sonst noch etwas?", "h.notesPh": "Laufende Medikation, Operation, ärztliche Einschränkung…", "h.disc": "Pacevo ersetzt keine ärztliche Beratung. Im Zweifel wende dich an medizinisches Fachpersonal.",
    "h.none": "Nichts zu melden, ich bin gesund",
    "f.terrMulti": "Mehrfachauswahl möglich",
    "notif.title": "Benachrichtigungen", "notif.workout": "Trainings-Erinnerungen", "notif.goal": "Erreichte Ziele", "notif.league": "Liga-Ranking", "notif.coach": "Tipps des KI-Coachs", "notif.save": "Einstellungen speichern",
    "double.title": "Zwei Einheiten pro Tag", "double.hint": "Der Coach kann einen lockeren Lauf teilen (morgens + abends), wenn dein Umfang es rechtfertigt. Gleicher Umfang, besser verkraftet — bis dahin sagt er dir, was fehlt.", "privacy.private": "Privates Konto", "privacy.privateHint": "Nur deine Freunde (ihr folgt euch gegenseitig) können deine Beiträge kommentieren.", "privacy.publicHint": "Jede Person kann die Beiträge kommentieren, die du sichtbar machst.",
    "guard.title": "Guardian-Modus", "guard.desc": "Blockiert automatisch intensive Einheiten, wenn die KI Übertraining erkennt (HRV, mentale Ermüdung).", "guard.active": "Aktiv — deine Gesundheit ist geschützt",
    "gdpr.title": "Daten & Datenschutz", "gdpr.desc": "Gemäß DSGVO kannst du jederzeit alle deine Daten abrufen.", "gdpr.export": "Meine Daten exportieren (JSON)", "gdpr.exporting": "Export…", "gdpr.privacy": "Datenschutzerklärung", "gdpr.delPre": "Um dein Konto und alle Daten zu löschen, schreibe an ", "gdpr.delPost": " — Löschung innerhalb von 30 Tagen.",
    "goals.title": "Meine Ziele", "goals.summary": "{a} laufend · {b} erreicht", "goals.new": "Neues Ziel", "goals.type": "Typ", "goals.name": "Name", "goals.namePhRace": "Marathon Paris 2027", "goals.namePhOther": "Wochenziel", "goals.targetVal": "Zielwert ({unit})", "goals.targetValPh": "42.2", "goals.targetDate": "Zieldatum", "goals.create": "Ziel erstellen", "goals.emptyTitle": "Kein Ziel festgelegt", "goals.emptyDesc": "Setze dir ein Zielrennen, ein Wochenvolumen…", "goals.achieved": "Erreicht ✓", "goals.past": "Vorbei", "goals.context": "Aktueller Kontext", "goals.ctxMonth": "km diesen Monat", "goals.ctxYear": "km dieses Jahr", "goals.ctxStreak": "Tage in Folge",
    "gt.race": "Zielrennen", "gt.weekly": "Wochen-km", "gt.monthly": "Monats-km", "gt.pace": "Zieltempo", "gt.weight": "Zielgewicht",
    "perf.title": "Leistungsdaten", "perf.vma": "vVO2max", "perf.maxHr": "Max. Puls", "perf.restHr": "Ruhepuls", "perf.lt": "Laktatschwelle",
    "perf.vmaWarn": "vVO2max aus deinen besten Einheiten geschätzt (kein Test gespeichert). Mach einen vVO2max-Test für exakte Tempi und Prognosen.",
    "perf.vo2est": "Geschätzte VO2max", "perf.vo2from": "Aus {sources}", "perf.emptyTitle": "Keine Leistungsdaten", "perf.emptyDesc": "Mach den vVO2max-Test (bei der Anmeldung oder in den Einstellungen) zum Kalibrieren",
    "perf.predTitle": "Zeitprognosen", "perf.vo2trend": "VO2max-Verlauf", "perf.predGraph": "Tempo-Prognose-Verlauf", "perf.predDescTest": "Geschätzt aus deiner vVO2max (Test). Ein aktueller Test = genauere Prognosen.", "perf.predDescSess": "Geschätzt aus deiner vVO2max (deine letzten Einheiten). Ein aktueller Test = genauere Prognosen.", "perf.predDescGarmin": "Basierend auf deiner Garmin-VO2max (von deiner Uhr gemessen) — viel zuverlässiger als eine Schätzung.",
    "perf.zonesTitle": "Herzfrequenzzonen", "perf.maxHrLabel": "Max. Puls: {n} bpm", "perf.pacesTitle": "Referenz-Tempi",
    "perf.loadTitle": "Form & Belastung", "perf.fitness": "Fitness", "perf.fatigue": "Ermüdung", "perf.form": "Form", "perf.loadHint": "Fitness = langfristige Form · Ermüdung = jüngste Belastung · Form = Frische (positiv = frisch).", "perf.thresholdPace": "Schwellentempo",
    "zone.z1": "Erholung", "zone.z1d": "Aktive Erholung, Ultra-Ausdauer", "zone.z2": "Aerob", "zone.z2d": "Aerobe Basis, lange Läufe", "zone.z3": "Tempo", "zone.z3d": "Aerobe Schwelle, Tempo", "zone.z4": "Schwelle", "zone.z4d": "Laktatschwelle, Intervalle", "zone.z5": "VO2max", "zone.z5d": "Maximale Belastung, vVO2max",
    "pace.z2": "Z2 (Ausdauer)", "pace.tempo": "Tempo (Z3-Z4)", "pace.seuil": "Schwelle (Z4)", "pace.vma": "vVO2max (Z5)",
    "shoes.title": "Meine Garage", "shoes.count": "{n} aktives Paar", "shoes.countP": "{n} aktive Paare", "shoes.new": "Neues Paar", "shoes.brand": "Marke", "shoes.brandPh": "Nike, Hoka, Salomon…", "shoes.model": "Modell", "shoes.modelPh": "Vaporfly 3, Speedgoat…", "shoes.life": "Lebensdauer (km)", "shoes.buyDate": "Kaufdatum", "shoes.addGarage": "Zur Garage hinzufügen", "shoes.suggestHint": "Tippe Marke und Modell — wir schlagen beliebte Modelle vor.", "shoes.emptyTitle": "Keine Schuhe in der Garage", "shoes.emptyDesc": "Füge deine Paare hinzu, um die Kilometer zu verfolgen", "shoes.replace": "Ersetzen", "shoes.watch": "Beobachten", "shoes.good": "Guter Zustand", "shoes.km": "{cur} km gelaufen · {rem} km übrig",
    "sub.title": "Aktuelles Abo", "sub.plan": "{tier}-Plan", "sub.freeDesc": "Eingeschränkter Zugang zu Basisfunktionen", "sub.proDesc": "Voller Zugang zu allen Funktionen", "sub.active": "✓ Aktiv", "sub.free": "Kostenlos", "sub.pro": "Pro",
    "feat.dash": "Dashboard & Statistiken", "feat.journal": "Intelligentes Tagebuch (NLP)", "feat.plans3": "Trainingspläne (max. 3)", "feat.plansUnli": "Unbegrenzte Trainingspläne", "feat.coach": "Personalisierter KI-Coach (Claude)", "feat.ghost": "KI Ghost Runner", "feat.vma": "vVO2max- & HF-Zonen-Analyse", "feat.sync": "GPS-Uhr-Sync (Garmin, Polar…)", "feat.shop": "Shopping-Hub & Empfehlungen", "feat.leagues": "Ligen & Ranglisten",
    "sub.goPro": "Auf Pro upgraden", "sub.unlock": "Alle Funktionen freischalten", "sub.perMonth": "/Monat", "sub.yearly": "oder 84€/Jahr (-30%)", "sub.trial": "14 Tage kostenlos testen",
    "t.saveErr": "Fehler beim Speichern", "t.saveOk": "Profil aktualisiert!", "t.uploadErr": "Upload-Fehler", "t.photoOk": "Profilbild aktualisiert!", "t.netErr": "Netzwerkfehler", "t.goalsSql": "Ziele noch nicht aktiviert — führe das bereitgestellte SQL in Supabase aus.", "t.createErr": "Fehler beim Erstellen", "t.goalAdd": "Ziel hinzugefügt!", "t.goalDel": "Ziel gelöscht", "t.addErr": "Fehler beim Hinzufügen", "t.shoeAdd": "Schuh hinzugefügt!", "t.shoeDel": "Schuh aus der Garage entfernt", "t.exportOk": "Deine Daten wurden exportiert (JSON).", "t.exportErr": "Export fehlgeschlagen, versuche es erneut.",
  },
  es: {
    "tab.profile": "Perfil", "tab.goals": "Objetivos", "tab.performance": "Rendimiento", "tab.shoes": "Zapatillas", "tab.subscription": "Suscripción",
    "common.save": "Guardar", "common.saving": "Guardando…", "common.cancel": "Cancelar", "common.add": "Añadir",
    "hero.myProfile": "Mi perfil", "hero.score": "Puntuación {n}/100", "hero.streak": "{n} día seguido", "hero.streakP": "{n} días seguidos",
    "stat.kmYear": "Km corridos este año", "stat.kmMonth": "Km corridos este mes", "stat.sessions": "Carreras este mes", "stat.longest": "Carrera más larga",
    "split.title": "Por disciplina", "split.year": "este año", "split.road": "Carrera en ruta", "split.trail": "Trail", "split.bike": "Ciclismo", "split.hike": "Senderismo / marcha",
    "split.note": "Los contadores de arriba solo incluyen la carrera a pie — la misma cifra que usa tu entrenador para dimensionar tus sesiones. El ciclismo y el senderismo cuentan para la fatiga, no para el volumen de carrera.",
    "pi.title": "Información personal",
    "photo.title": "Foto de perfil", "photo.hint": "JPG, PNG, WebP · máx. 5 MB", "photo.uploading": "Subiendo…", "photo.change": "Cambiar foto",
    "f.name": "Nombre completo", "f.age": "Edad", "f.height": "Altura (cm)", "f.weight": "Peso (kg)", "f.lang": "Idioma", "f.bio": "Bio corta", "f.bioPh": "Corredor de trail apasionado, objetivo UTMB 2027…", "f.warmup": "⏱️ Calentamiento habitual", "f.cooldown": "🧊 Vuelta a la calma habitual", "f.wcHint": "Fija el calentamiento y la vuelta a la calma (frecuencia cardíaca suave, Z1) de las sesiones enviadas a tu reloj. La parte principal mantiene sus ritmos exactos.", "f.longMode": "Sesiones largas", "f.longRun": "🏃 Corriendo", "f.longBike": "🚴 En bici", "f.longHint": "Muchos pros sustituyen la tirada larga por bici: mismo volumen aeróbico, sin impacto. Tu entrenador y la IA se adaptan automáticamente.",
    "f.exp": "🗓️ Antigüedad corriendo", "f.exp0": "< 1 año", "f.exp1": "1 año", "f.exp2": "2 años", "f.exp4": "3-5 años", "f.exp8": "6-10 años", "f.exp12": "10+ años", "f.expHint": "Tu corazón se adapta en semanas, tus tendones en años. El entrenador IA lo usa para limitar la carga y evitar lesiones por exceso.", "f.terr": "🗺️ Terreno habitual", "f.terrHint": "En arena o en montaña, el ritmo por km no significa nada: tu entrenador pasa a frecuencia cardíaca y duración.", "f.elev": "⛰️ Relación con el desnivel", "f.elevEvite": "Lo evito", "f.elevModere": "Moderado", "f.elevAime": "Me gusta", "f.elevSpec": "Mi terreno", "f.elevHint": "Define cuántas cuestas y desnivel tendrán tus semanas.",
    "f.dpw": "📆 Carreras por semana", "f.dpwHint": "Un plan que no puedes seguir no sirve: tu entrenador nunca superará este número.", "f.days": "Días disponibles", "f.daysHint": "Desmarca los días en que correr es imposible.", "f.dayShort": "D,L,M,X,J,V,S",
    "h.title": "Salud y antecedentes", "h.sub": "Privado. Tu entrenador IA lo usa para no prescribirte nunca una sesión que te ponga en riesgo.", "h.cond": "Patologías", "h.inj": "Zonas de lesión recurrentes", "h.notes": "¿Algo más que debamos saber?", "h.notesPh": "Tratamiento en curso, operación, contraindicación médica…", "h.disc": "Pacevo no sustituye el consejo médico. Ante la duda, consulta a un profesional sanitario.",
    "h.none": "Nada que señalar, estoy bien de salud",
    "f.terrMulti": "varias opciones posibles",
    "notif.title": "Notificaciones", "notif.workout": "Recordatorios de sesión", "notif.goal": "Objetivos logrados", "notif.league": "Clasificación de liga", "notif.coach": "Consejos del entrenador IA", "notif.save": "Guardar preferencias",
    "double.title": "Dos sesiones al día", "double.hint": "El entrenador podrá dividir una tirada suave en dos (mañana + tarde) cuando tu volumen lo justifique. Mismo volumen, mejor asimilado — hasta entonces te dirá qué falta.", "privacy.private": "Cuenta privada", "privacy.privateHint": "Solo tus amigos (os seguís mutuamente) pueden comentar tus publicaciones.", "privacy.publicHint": "Cualquiera puede comentar las publicaciones que hagas visibles.",
    "guard.title": "Modo Guardian", "guard.desc": "Bloquea automáticamente las sesiones de alta intensidad cuando la IA detecta sobreentrenamiento (VFC, fatiga mental).", "guard.active": "Activo — tu salud está protegida",
    "gdpr.title": "Datos y privacidad", "gdpr.desc": "Conforme al RGPD, puedes recuperar todos tus datos en cualquier momento.", "gdpr.export": "Exportar mis datos (JSON)", "gdpr.exporting": "Exportando…", "gdpr.privacy": "Política de privacidad", "gdpr.delPre": "Para eliminar tu cuenta y todos tus datos, escribe a ", "gdpr.delPost": " — eliminación en 30 días.",
    "goals.title": "Mis objetivos", "goals.summary": "{a} en curso · {b} logrados", "goals.new": "Nuevo objetivo", "goals.type": "Tipo", "goals.name": "Nombre", "goals.namePhRace": "Maratón de París 2027", "goals.namePhOther": "Objetivo semanal", "goals.targetVal": "Valor objetivo ({unit})", "goals.targetValPh": "42.2", "goals.targetDate": "Fecha objetivo", "goals.create": "Crear objetivo", "goals.emptyTitle": "Ningún objetivo definido", "goals.emptyDesc": "Fíjate una carrera objetivo, un volumen semanal…", "goals.achieved": "Logrado ✓", "goals.past": "Pasado", "goals.context": "Contexto actual", "goals.ctxMonth": "km este mes", "goals.ctxYear": "km este año", "goals.ctxStreak": "días seguidos",
    "gt.race": "Carrera objetivo", "gt.weekly": "Km semanal", "gt.monthly": "Km mensual", "gt.pace": "Ritmo objetivo", "gt.weight": "Peso objetivo",
    "perf.title": "Datos de rendimiento", "perf.vma": "VAM", "perf.maxHr": "FC Máx", "perf.restHr": "FC Reposo", "perf.lt": "Umbral láctico",
    "perf.vmaWarn": "VAM estimada a partir de tus mejores sesiones (sin test registrado). Haz un test de VAM para ritmos y predicciones exactas.",
    "perf.vo2est": "VO2máx estimado", "perf.vo2from": "Según {sources}", "perf.emptyTitle": "Sin datos de rendimiento", "perf.emptyDesc": "Haz el test de VAM (al registrarte o en Ajustes) para calibrarlo todo",
    "perf.predTitle": "Predicciones de tiempo", "perf.vo2trend": "Tendencia VO2máx", "perf.predGraph": "Tendencia de ritmos previstos", "perf.predDescTest": "Estimadas a partir de tu VAM (test). Un test reciente = predicciones más exactas.", "perf.predDescSess": "Estimadas a partir de tu VAM (tus sesiones recientes). Un test reciente = predicciones más exactas.", "perf.predDescGarmin": "Basadas en tu VO2máx de Garmin (medida por tu reloj) — mucho más fiable que una estimación.",
    "perf.zonesTitle": "Zonas de frecuencia cardíaca", "perf.maxHrLabel": "FC máx: {n} ppm", "perf.pacesTitle": "Ritmos de referencia",
    "perf.loadTitle": "Forma y carga", "perf.fitness": "Condición", "perf.fatigue": "Fatiga", "perf.form": "Forma", "perf.loadHint": "Condición = forma de fondo · Fatiga = carga reciente · Forma = frescura (positivo = fresco).", "perf.thresholdPace": "Ritmo umbral",
    "zone.z1": "Recuperación", "zone.z1d": "Recuperación activa, ultra-resistencia", "zone.z2": "Aeróbico", "zone.z2d": "Base aeróbica, tiradas largas", "zone.z3": "Tempo", "zone.z3d": "Umbral aeróbico, tempo", "zone.z4": "Umbral", "zone.z4d": "Umbral láctico, intervalos", "zone.z5": "VO2máx", "zone.z5d": "Esfuerzo máximo, VAM",
    "pace.z2": "Z2 (resistencia)", "pace.tempo": "Tempo (Z3-Z4)", "pace.seuil": "Umbral (Z4)", "pace.vma": "VAM (Z5)",
    "shoes.title": "Mi Garaje", "shoes.count": "{n} par activo", "shoes.countP": "{n} pares activos", "shoes.new": "Nuevo par", "shoes.brand": "Marca", "shoes.brandPh": "Nike, Hoka, Salomon…", "shoes.model": "Modelo", "shoes.modelPh": "Vaporfly 3, Speedgoat…", "shoes.life": "Vida útil (km)", "shoes.buyDate": "Fecha de compra", "shoes.addGarage": "Añadir al garaje", "shoes.suggestHint": "Empieza a escribir la marca y el modelo — te sugerimos modelos populares.", "shoes.emptyTitle": "Ninguna zapatilla en el garaje", "shoes.emptyDesc": "Añade tus pares para seguir su kilometraje", "shoes.replace": "Reemplazar", "shoes.watch": "Vigilar", "shoes.good": "Buen estado", "shoes.km": "{cur} km recorridos · {rem} km restantes",
    "sub.title": "Suscripción actual", "sub.plan": "Plan {tier}", "sub.freeDesc": "Acceso limitado a las funciones básicas", "sub.proDesc": "Acceso completo a todas las funciones", "sub.active": "✓ Activo", "sub.free": "Gratis", "sub.pro": "Pro",
    "feat.dash": "Panel y estadísticas", "feat.journal": "Diario inteligente (NLP)", "feat.plans3": "Planes de entrenamiento (máx. 3)", "feat.plansUnli": "Planes de entrenamiento ilimitados", "feat.coach": "Entrenador IA personalizado (Claude)", "feat.ghost": "Ghost Runner IA", "feat.vma": "Análisis de VAM y zonas cardíacas", "feat.sync": "Sync relojes GPS (Garmin, Polar…)", "feat.shop": "Shopping Hub y recomendaciones", "feat.leagues": "Ligas y clasificaciones",
    "sub.goPro": "Pasar a Pro", "sub.unlock": "Desbloquea todas las funciones", "sub.perMonth": "/mes", "sub.yearly": "o 84€/año (-30%)", "sub.trial": "Empezar la prueba gratuita de 14 días",
    "t.saveErr": "Error al guardar", "t.saveOk": "¡Perfil actualizado!", "t.uploadErr": "Error al subir", "t.photoOk": "¡Foto de perfil actualizada!", "t.netErr": "Error de red", "t.goalsSql": "Objetivos aún no activados — ejecuta el SQL proporcionado en Supabase.", "t.createErr": "Error al crear", "t.goalAdd": "¡Objetivo añadido!", "t.goalDel": "Objetivo eliminado", "t.addErr": "Error al añadir", "t.shoeAdd": "¡Zapatilla añadida!", "t.shoeDel": "Zapatilla retirada del garaje", "t.exportOk": "Tus datos se han exportado (JSON).", "t.exportErr": "Exportación fallida, inténtalo de nuevo.",
  },
  pt: {
    "tab.profile": "Perfil", "tab.goals": "Objetivos", "tab.performance": "Desempenho", "tab.shoes": "Ténis", "tab.subscription": "Subscrição",
    "common.save": "Guardar", "common.saving": "A guardar…", "common.cancel": "Cancelar", "common.add": "Adicionar",
    "hero.myProfile": "O meu perfil", "hero.score": "Pontuação {n}/100", "hero.streak": "{n} dia seguido", "hero.streakP": "{n} dias seguidos",
    "stat.kmYear": "Km corridos este ano", "stat.kmMonth": "Km corridos este mês", "stat.sessions": "Corridas este mês", "stat.longest": "Corrida mais longa",
    "split.title": "Por modalidade", "split.year": "este ano", "split.road": "Corrida de estrada", "split.trail": "Trail", "split.bike": "Ciclismo", "split.hike": "Caminhada",
    "split.note": "Os contadores acima incluem apenas a corrida — o mesmo valor que o teu treinador usa para dimensionar as sessões. Ciclismo e caminhada contam para a fadiga, não para o volume de corrida.",
    "pi.title": "Informações pessoais",
    "photo.title": "Foto de perfil", "photo.hint": "JPG, PNG, WebP · máx. 5 MB", "photo.uploading": "A enviar…", "photo.change": "Mudar foto",
    "f.name": "Nome completo", "f.age": "Idade", "f.height": "Altura (cm)", "f.weight": "Peso (kg)", "f.lang": "Idioma", "f.bio": "Bio curta", "f.bioPh": "Corredor de trail apaixonado, objetivo UTMB 2027…", "f.warmup": "⏱️ Aquecimento habitual", "f.cooldown": "🧊 Retorno à calma habitual", "f.wcHint": "Define o aquecimento e o retorno à calma (frequência cardíaca fácil, Z1) das sessões enviadas para o teu relógio. A parte principal mantém os ritmos exatos.", "f.longMode": "Sessões longas", "f.longRun": "🏃 A correr", "f.longBike": "🚴 De bicicleta", "f.longHint": "Muitos profissionais trocam a saída longa por bicicleta: mesmo volume aeróbio, sem impacto. O teu treinador e a IA adaptam-se automaticamente.",
    "f.exp": "🗓️ Experiência a correr", "f.exp0": "< 1 ano", "f.exp1": "1 ano", "f.exp2": "2 anos", "f.exp4": "3-5 anos", "f.exp8": "6-10 anos", "f.exp12": "10+ anos", "f.expHint": "O teu coração adapta-se em semanas, os teus tendões em anos. O treinador IA usa isto para limitar a carga e evitar lesões por excesso.", "f.terr": "🗺️ Terreno habitual", "f.terrHint": "Na areia ou na montanha, o ritmo por km não diz nada: o treinador passa para frequência cardíaca e duração.", "f.elev": "⛰️ Relação com o desnível", "f.elevEvite": "Evito-o", "f.elevModere": "Moderado", "f.elevAime": "Gosto", "f.elevSpec": "O meu terreno", "f.elevHint": "Define o peso das subidas e do desnível nas tuas semanas.",
    "f.dpw": "📆 Corridas por semana", "f.dpwHint": "Um plano que não consegues seguir não serve: o treinador nunca ultrapassa este número.", "f.days": "Dias disponíveis", "f.daysHint": "Desmarca os dias em que correr é impossível.", "f.dayShort": "D,S,T,Q,Q,S,S",
    "h.title": "Saúde e antecedentes", "h.sub": "Privado. O teu treinador IA usa isto para nunca te prescrever uma sessão que te ponha em risco.", "h.cond": "Patologias", "h.inj": "Zonas de lesão recorrentes", "h.notes": "Mais alguma coisa a assinalar?", "h.notesPh": "Medicação em curso, operação, contraindicação médica…", "h.disc": "A Pacevo não substitui aconselhamento médico. Na dúvida, consulta um profissional de saúde.",
    "h.none": "Nada a assinalar, estou de boa saúde",
    "f.terrMulti": "várias opções possíveis",
    "notif.title": "Notificações", "notif.workout": "Lembretes de sessão", "notif.goal": "Objetivos alcançados", "notif.league": "Classificação da liga", "notif.coach": "Conselhos do treinador IA", "notif.save": "Guardar preferências",
    "double.title": "Duas sessões por dia", "double.hint": "O treinador pode dividir um treino leve em dois (manhã + tarde) quando o teu volume o justificar. Mesmo volume, melhor absorvido — até lá dir-te-á o que falta.", "privacy.private": "Conta privada", "privacy.privateHint": "Só os teus amigos (seguem-se mutuamente) podem comentar as tuas publicações.", "privacy.publicHint": "Qualquer pessoa pode comentar as publicações que tornares visíveis.",
    "guard.title": "Modo Guardian", "guard.desc": "Bloqueia automaticamente as sessões de alta intensidade quando a IA deteta excesso de treino (VFC, fadiga mental).", "guard.active": "Ativo — a tua saúde está protegida",
    "gdpr.title": "Dados e privacidade", "gdpr.desc": "Em conformidade com o RGPD, podes recuperar todos os teus dados a qualquer momento.", "gdpr.export": "Exportar os meus dados (JSON)", "gdpr.exporting": "A exportar…", "gdpr.privacy": "Política de privacidade", "gdpr.delPre": "Para eliminar a tua conta e todos os dados, escreve para ", "gdpr.delPost": " — eliminação em 30 dias.",
    "goals.title": "Os meus objetivos", "goals.summary": "{a} em curso · {b} alcançados", "goals.new": "Novo objetivo", "goals.type": "Tipo", "goals.name": "Nome", "goals.namePhRace": "Maratona de Paris 2027", "goals.namePhOther": "Objetivo semanal", "goals.targetVal": "Valor-alvo ({unit})", "goals.targetValPh": "42.2", "goals.targetDate": "Data-alvo", "goals.create": "Criar objetivo", "goals.emptyTitle": "Nenhum objetivo definido", "goals.emptyDesc": "Define uma prova-alvo, um volume semanal…", "goals.achieved": "Alcançado ✓", "goals.past": "Passado", "goals.context": "Contexto atual", "goals.ctxMonth": "km este mês", "goals.ctxYear": "km este ano", "goals.ctxStreak": "dias seguidos",
    "gt.race": "Prova-alvo", "gt.weekly": "Km semanal", "gt.monthly": "Km mensal", "gt.pace": "Ritmo-alvo", "gt.weight": "Peso-alvo",
    "perf.title": "Dados de desempenho", "perf.vma": "VAM", "perf.maxHr": "FC Máx", "perf.restHr": "FC Repouso", "perf.lt": "Limiar de lactato",
    "perf.vmaWarn": "VAM estimada a partir das tuas melhores sessões (sem teste registado). Faz um teste de VAM para ritmos e previsões exatas.",
    "perf.vo2est": "VO2máx estimado", "perf.vo2from": "Segundo {sources}", "perf.emptyTitle": "Sem dados de desempenho", "perf.emptyDesc": "Faz o teste de VAM (no registo ou nas Definições) para calibrar tudo",
    "perf.predTitle": "Previsões de tempo", "perf.vo2trend": "Tendência VO2máx", "perf.predGraph": "Tendência dos ritmos previstos", "perf.predDescTest": "Estimadas a partir da tua VAM (teste). Um teste recente = previsões mais exatas.", "perf.predDescSess": "Estimadas a partir da tua VAM (as tuas sessões recentes). Um teste recente = previsões mais exatas.", "perf.predDescGarmin": "Baseadas na tua VO2máx Garmin (medida pelo teu relógio) — muito mais fiável que uma estimativa.",
    "perf.zonesTitle": "Zonas de frequência cardíaca", "perf.maxHrLabel": "FC máx: {n} bpm", "perf.pacesTitle": "Ritmos de referência",
    "perf.loadTitle": "Forma e carga", "perf.fitness": "Condição", "perf.fatigue": "Fadiga", "perf.form": "Forma", "perf.loadHint": "Condição = forma de fundo · Fadiga = carga recente · Forma = frescura (positivo = fresco).", "perf.thresholdPace": "Ritmo limiar",
    "zone.z1": "Recuperação", "zone.z1d": "Recuperação ativa, ultra-resistência", "zone.z2": "Aeróbico", "zone.z2d": "Base aeróbica, treinos longos", "zone.z3": "Tempo", "zone.z3d": "Limiar aeróbico, tempo", "zone.z4": "Limiar", "zone.z4d": "Limiar de lactato, intervalos", "zone.z5": "VO2máx", "zone.z5d": "Esforço máximo, VAM",
    "pace.z2": "Z2 (resistência)", "pace.tempo": "Tempo (Z3-Z4)", "pace.seuil": "Limiar (Z4)", "pace.vma": "VAM (Z5)",
    "shoes.title": "A minha Garagem", "shoes.count": "{n} par ativo", "shoes.countP": "{n} pares ativos", "shoes.new": "Novo par", "shoes.brand": "Marca", "shoes.brandPh": "Nike, Hoka, Salomon…", "shoes.model": "Modelo", "shoes.modelPh": "Vaporfly 3, Speedgoat…", "shoes.life": "Vida útil (km)", "shoes.buyDate": "Data de compra", "shoes.addGarage": "Adicionar à garagem", "shoes.suggestHint": "Começa a escrever a marca e o modelo — sugerimos modelos populares.", "shoes.emptyTitle": "Nenhum ténis na garagem", "shoes.emptyDesc": "Adiciona os teus pares para seguir a quilometragem", "shoes.replace": "Substituir", "shoes.watch": "Vigiar", "shoes.good": "Bom estado", "shoes.km": "{cur} km percorridos · {rem} km restantes",
    "sub.title": "Subscrição atual", "sub.plan": "Plano {tier}", "sub.freeDesc": "Acesso limitado às funcionalidades básicas", "sub.proDesc": "Acesso completo a todas as funcionalidades", "sub.active": "✓ Ativo", "sub.free": "Gratuito", "sub.pro": "Pro",
    "feat.dash": "Painel e estatísticas", "feat.journal": "Diário inteligente (NLP)", "feat.plans3": "Planos de treino (máx. 3)", "feat.plansUnli": "Planos de treino ilimitados", "feat.coach": "Treinador IA personalizado (Claude)", "feat.ghost": "Ghost Runner IA", "feat.vma": "Análise de VAM e zonas cardíacas", "feat.sync": "Sync relógios GPS (Garmin, Polar…)", "feat.shop": "Shopping Hub e recomendações", "feat.leagues": "Ligas e classificações",
    "sub.goPro": "Passar a Pro", "sub.unlock": "Desbloqueia todas as funcionalidades", "sub.perMonth": "/mês", "sub.yearly": "ou 84€/ano (-30%)", "sub.trial": "Começar o teste gratuito de 14 dias",
    "t.saveErr": "Erro ao guardar", "t.saveOk": "Perfil atualizado!", "t.uploadErr": "Erro no envio", "t.photoOk": "Foto de perfil atualizada!", "t.netErr": "Erro de rede", "t.goalsSql": "Objetivos ainda não ativados — executa o SQL fornecido no Supabase.", "t.createErr": "Erro ao criar", "t.goalAdd": "Objetivo adicionado!", "t.goalDel": "Objetivo eliminado", "t.addErr": "Erro ao adicionar", "t.shoeAdd": "Ténis adicionado!", "t.shoeDel": "Ténis removido da garagem", "t.exportOk": "Os teus dados foram exportados (JSON).", "t.exportErr": "Exportação falhou, tenta novamente.",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
/** Kilomètres par discipline. Le trail est de la COURSE, mais séparé de la route :
 *  l'effort n'est pas comparable, et les additionner masque les deux. */
export interface SportSplit { road: number; trail: number; bike: number; hike: number }

interface Stats {
  /** Course à pied uniquement (route + trail) — le chiffre qu'utilise aussi le coach. */
  kmYear: number;
  kmMonth: number;
  sessionsMonth: number;
  /** Plus longue COURSE : une sortie vélo de 62 km n'est pas un record de coureur. */
  longestRun: number;
  streak: number;
  bySport?: { year: SportSplit; month: SportSplit };
}

interface Goal {
  id: string;
  user_id: string;
  type: "race" | "weekly_km" | "monthly_km" | "pace" | "weight";
  label: string;
  target_value: number;
  current_value: number;
  target_date?: string;
  achieved: boolean;
  created_at: string;
}

interface Shoe {
  id: string;
  brand: string;
  model: string;
  current_km: number;
  max_km: number;
  purchase_date?: string;
  notes?: string;
}

// ── HR Zone calculator ────────────────────────────────────────────────────────
function calcZones(maxHr: number, tr: Tr) {
  return [
    { z: "Z1", name: tr("zone.z1"), min: Math.round(maxHr * 0.50), max: Math.round(maxHr * 0.60), color: "bg-blue-400", textColor: "text-blue-700", desc: tr("zone.z1d") },
    { z: "Z2", name: tr("zone.z2"), min: Math.round(maxHr * 0.60), max: Math.round(maxHr * 0.70), color: "bg-green-400", textColor: "text-green-700", desc: tr("zone.z2d") },
    { z: "Z3", name: tr("zone.z3"), min: Math.round(maxHr * 0.70), max: Math.round(maxHr * 0.80), color: "bg-yellow-400", textColor: "text-yellow-700", desc: tr("zone.z3d") },
    { z: "Z4", name: tr("zone.z4"), min: Math.round(maxHr * 0.80), max: Math.round(maxHr * 0.90), color: "bg-orange-500", textColor: "text-orange-700", desc: tr("zone.z4d") },
    { z: "Z5", name: tr("zone.z5"), min: Math.round(maxHr * 0.90), max: maxHr, color: "bg-red-500", textColor: "text-red-700", desc: tr("zone.z5d") },
  ];
}

// ── Goal types config (label traduit via labelKey) ─────────────────────────────
const GOAL_TYPES = [
  { value: "race", labelKey: "gt.race", icon: "🏁", unit: "km" },
  { value: "weekly_km", labelKey: "gt.weekly", icon: "📅", unit: "km" },
  { value: "monthly_km", labelKey: "gt.monthly", icon: "📆", unit: "km" },
  { value: "pace", labelKey: "gt.pace", icon: "⚡", unit: "min/km" },
  { value: "weight", labelKey: "gt.weight", icon: "⚖️", unit: "kg" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${color} flex flex-col gap-1`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">{icon}{label}</div>
      <div className="text-2xl font-black text-zinc-900">
        {value}<span className="text-sm font-medium text-zinc-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function ProgressRing({ pct, size = 80, stroke = 8, color = "#16a34a" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-700">{label}</span>
      <button onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

// Marques + modèles populaires (autocomplétion du garage) — clés en minuscules.
const SHOE_BRANDS = ["Nike", "Hoka", "Adidas", "Asics", "Saucony", "Brooks", "New Balance", "Salomon", "On", "Puma", "Mizuno", "Altra"];
const SHOE_MODELS: Record<string, string[]> = {
  nike: ["Vaporfly 3", "Alphafly 3", "Pegasus 41", "Pegasus Plus", "Vomero 18", "Structure 25", "Invincible 3", "Zoom Fly 6", "Streakfly", "Pegasus Trail 5", "Ultrafly", "Kiger 10"],
  hoka: ["Mach 6", "Clifton 9", "Bondi 9", "Rocket X 2", "Speedgoat 6", "Mafate 4", "Challenger 7", "Arahi 7", "Skyward X", "Cielo X1", "Torrent 3", "Tecton X 2"],
  adidas: ["Adizero Adios Pro 4", "Adizero Boston 12", "Adizero SL", "Supernova Rise", "Ultraboost Light", "Takumi Sen 10", "Terrex Agravic Speed", "Terrex Speed Ultra"],
  asics: ["Metaspeed Sky Paris", "Metaspeed Edge Paris", "Novablast 4", "Gel-Nimbus 26", "Gel-Kayano 31", "Gel-Cumulus 26", "Magic Speed 4", "Superblast 2", "Trabuco Max 3", "Fuji Lite 4"],
  saucony: ["Endorphin Speed 4", "Endorphin Pro 4", "Endorphin Elite", "Kinvara 15", "Ride 17", "Triumph 22", "Guide 17", "Peregrine 14", "Xodus Ultra 3"],
  brooks: ["Ghost 16", "Glycerin 21", "Hyperion Max 2", "Hyperion Elite 4", "Launch 10", "Adrenaline GTS 23", "Caldera 7", "Cascadia 18", "Catamount 3"],
  "new balance": ["FuelCell SC Elite v4", "FuelCell Rebel v4", "SuperComp Trainer v3", "Fresh Foam X 1080v14", "Fresh Foam More v5", "Hierro v8", "SC Trail"],
  salomon: ["S/Lab Genesis", "Sense Ride 5", "Speedcross 6", "Pulsar Trail Pro 2", "Ultra Glide 2", "S/Lab Pulsar 3", "Thundercross", "Aero Glide 2"],
  on: ["Cloudmonster 2", "Cloudboom Strike", "Cloudsurfer 2", "Cloudeclipse", "Cloudultra 2", "Cloudvista 2"],
  puma: ["Deviate Nitro 3", "Deviate Nitro Elite 3", "Velocity Nitro 3", "ForeverRun Nitro 2", "Fast-R Nitro Elite 2"],
  mizuno: ["Wave Rebellion Pro 2", "Wave Neo Ultra", "Wave Sky 8", "Wave Rider 28", "Wave Inspire 20", "Wave Mujin 10"],
  altra: ["Escalante 4", "Torin 8", "Lone Peak 8", "Olympus 6", "Mont Blanc Carbon", "Vanish Carbon"],
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function ProfileSettings({ profile, baseline, shoes, goals: initialGoals, stats, fitness, userId }: {
  profile: Record<string, unknown> | null;
  baseline: Record<string, unknown> | null;
  shoes: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  stats: Stats;
  fitness?: { estimatedVma: number | null; obsMaxHr: number | null; garminVo2max?: number | null;
    garmin?: { vo2max?: number | null; restingHR?: number | null; lthr?: number | null; thresholdPaceSecPerKm?: number | null; ctl?: number | null; atl?: number | null; vo2maxHistory?: { date: string; v: number }[] | null } | null };
  userId: string;
}) {
  const { lang, setLang } = useT();
  const tr: Tr = (k, p) => fill(P[lang]?.[k] ?? P.fr[k] ?? k, p);
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<Goal[]>(initialGoals as unknown as Goal[]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingShoe, setAddingShoe] = useState(false);
  const [shoeList, setShoeList] = useState<Shoe[]>(shoes as unknown as Shoe[]);
  const [avatarUrl, setAvatarUrl] = useState<string>(String(profile?.avatar_url ?? ""));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: String(profile?.full_name ?? ""),
    age: String(profile?.age ?? ""),
    height_cm: String(profile?.height_cm ?? ""),
    weight_kg: String(profile?.weight_kg ?? ""),
    preferred_language: String(profile?.preferred_language ?? "fr"),
    bio: String(profile?.bio ?? ""),
    warmup_min: Number(profile?.warmup_min) || 15,
    cooldown_min: Number(profile?.cooldown_min) || 10,
    long_run_mode: String(profile?.long_run_mode ?? "run") === "bike" ? "bike" : "run",
    // Pas de valeur de repli : afficher « plat » comme sélectionné alors que rien n'est
    // enregistré ferait croire à l'athlète qu'il a répondu. Aucune puce active = pas de réponse.
    running_years: profile?.running_years == null ? null : Number(profile.running_years),
    main_terrains: (Array.isArray(profile?.main_terrains) ? profile.main_terrains.map(String)
      : profile?.main_terrain ? [String(profile.main_terrain)] : []) as string[],
    elevation_pref: String(profile?.elevation_pref ?? ""),
    health_conditions: (Array.isArray(profile?.health_conditions) ? profile.health_conditions.map(String) : []) as string[],
    injury_zones: (Array.isArray(profile?.injury_zones) ? profile.injury_zones.map(String) : []) as string[],
    health_notes: String(profile?.health_notes ?? ""),
    // A répondu à la question santé (y compris « rien à signaler »).
    health_declared: Boolean(profile?.health_declared),
    days_per_week: profile?.days_per_week == null ? null : Number(profile.days_per_week),
    available_days: (Array.isArray(profile?.available_days) && profile.available_days.length
      ? profile.available_days.map(Number) : [0, 1, 2, 3, 4, 5, 6]) as number[],
    guardian_mode_enabled: Boolean(profile?.guardian_mode_enabled),
    notif_workout: Boolean(profile?.notif_workout ?? true),
    notif_goal: Boolean(profile?.notif_goal ?? true),
    notif_league: Boolean(profile?.notif_league ?? true),
    notif_coach: Boolean(profile?.notif_coach ?? false),
    // Compte privé : défaut FAUX, comme en base. Un profil chargé avant la migration
    // 021 n'a pas la colonne — il vaut donc « public », c'est-à-dire le comportement
    // actuel, et non un compte verrouillé par surprise.
    is_private: Boolean(profile?.is_private ?? false),
    // Deux séances par jour : OPTION, pas automatisme. Le coach ne l'applique que si le
    // volume, la fraîcheur et l'absence de douleur le permettent — et il DIT ce qui
    // manque le cas échéant (une case cochée sans effet est un mensonge silencieux).
    double_sessions: Boolean(profile?.double_sessions ?? false),
  });

  const [newGoal, setNewGoal] = useState({ type: "race", label: "", target_value: "", target_date: "" });
  const [newShoe, setNewShoe] = useState({ brand: "", model: "", max_km: "800", purchase_date: "" });
  const [brandFocus, setBrandFocus] = useState(false);
  const [modelFocus, setModelFocus] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    // Colonnes garanties (présentes en base) → cette sauvegarde réussit toujours.
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name,
      age: parseInt(form.age) || null,
      height_cm: parseInt(form.height_cm) || null,
      weight_kg: parseFloat(form.weight_kg) || null,
      preferred_language: form.preferred_language,
      guardian_mode_enabled: form.guardian_mode_enabled,
    }).eq("id", userId);
    // Colonnes optionnelles (bio + préférences de notif) — best-effort : prises en compte
    // une fois ajoutées en base (voir SQL). Une erreur ici n'empêche pas la sauvegarde du reste.
    await supabase.from("profiles").update({
      bio: form.bio,
      warmup_min: form.warmup_min,
      cooldown_min: form.cooldown_min,
      long_run_mode: form.long_run_mode,
      running_years: form.running_years,
      elevation_pref: form.elevation_pref || null,
      health_conditions: form.health_conditions,
      injury_zones: form.injury_zones,
      health_notes: form.health_notes.trim() || null,
      health_declared: form.health_declared,
      notif_workout: form.notif_workout,
      notif_goal: form.notif_goal,
      notif_league: form.notif_league,
      notif_coach: form.notif_coach,
    }).eq("id", userId);
    // Confidentialité — écriture ISOLÉE : `is_private` vient de la migration 021, qui
    // peut être en retard sur le code déployé. PostgREST rejette TOUT l'update pour une
    // seule colonne inconnue (42703) : groupée, elle emporterait la sauvegarde entière
    // du profil, et en silence. Même piège que les terrains et les disponibilités.
    await supabase.from("profiles").update({ is_private: form.is_private }).eq("id", userId);
    // Écriture ISOLÉE aussi : `double_sessions` vient de la migration 026.
    await supabase.from("profiles").update({ double_sessions: form.double_sessions }).eq("id", userId);
    // Disponibilités — écriture ISOLÉE (colonnes de la migration 011, cf. terrains).
    await supabase.from("profiles").update({
      days_per_week: form.days_per_week,
      available_days: form.available_days,
    }).eq("id", userId);

    // Terrains multiples — écriture ISOLÉE : si `main_terrains` n'existe pas encore en base,
    // seule cette ligne échoue au lieu d'emporter toute la sauvegarde du profil.
    await supabase.from("profiles").update({ main_terrains: form.main_terrains }).eq("id", userId);
    await supabase.from("profiles").update({ main_terrain: form.main_terrains[0] ?? null }).eq("id", userId);
    setSaving(false);
    if (error) toast.error(tr("t.saveErr"));
    else toast.success(tr("t.saveOk"));
  }

  async function uploadAvatar(file: File) {
    if (!file) return;
    setUploadingAvatar(true);

    const fd = new FormData();
    fd.append("avatar", file);

    try {
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? tr("t.uploadErr"));
        return;
      }
      setAvatarUrl(json.url);
      toast.success(tr("t.photoOk"));
    } catch {
      toast.error(tr("t.netErr"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function addGoal() {
    if (!newGoal.label || !newGoal.target_value) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("user_goals").insert({
      user_id: userId,
      type: newGoal.type,
      label: newGoal.label,
      target_value: parseFloat(newGoal.target_value),
      current_value: 0,
      target_date: newGoal.target_date || null,
      achieved: false,
    }).select().single();
    if (error) { toast.error(error.code === "42P01" ? tr("t.goalsSql") : tr("t.createErr")); return; }
    setGoals(g => [data as unknown as Goal, ...g]);
    setNewGoal({ type: "race", label: "", target_value: "", target_date: "" });
    setAddingGoal(false);
    toast.success(tr("t.goalAdd"));
  }

  async function deleteGoal(id: string) {
    const supabase = createClient();
    await supabase.from("user_goals").delete().eq("id", id);
    setGoals(g => g.filter(x => x.id !== id));
    toast.success(tr("t.goalDel"));
  }

  async function toggleGoalAchieved(goal: Goal) {
    const supabase = createClient();
    await supabase.from("user_goals").update({ achieved: !goal.achieved }).eq("id", goal.id);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, achieved: !x.achieved } : x));
  }

  async function addShoe() {
    if (!newShoe.brand || !newShoe.model) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("shoes").insert({
      user_id: userId,
      brand: newShoe.brand,
      model: newShoe.model,
      max_km: parseFloat(newShoe.max_km) || 800,
      current_km: 0,
      purchase_date: newShoe.purchase_date || null,
      is_active: true,
    }).select().single();
    if (error) { toast.error(tr("t.addErr")); return; }
    setShoeList(s => [...s, data as unknown as Shoe]);
    setNewShoe({ brand: "", model: "", max_km: "800", purchase_date: "" });
    setAddingShoe(false);
    toast.success(tr("t.shoeAdd"));
  }

  async function deleteShoe(id: string) {
    const supabase = createClient();
    await supabase.from("shoes").update({ is_active: false }).eq("id", id);
    setShoeList(s => s.filter(x => x.id !== id));
    toast.success(tr("t.shoeDel"));
  }

  // RGPD : l'utilisateur télécharge toutes ses données (profil, séances, baselines, objectifs) en JSON.
  async function exportData() {
    setExporting(true);
    try {
      const supabase = createClient();
      const [prof, wk, base, gl] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("workouts").select("*").eq("user_id", userId),
        supabase.from("performance_baselines").select("*").eq("user_id", userId),
        supabase.from("user_goals").select("*").eq("user_id", userId),
      ]);
      const payload = { exported_at: new Date().toISOString(), profile: stripProfileSecrets(prof.data ?? null), workouts: wk.data ?? [], baselines: base.data ?? [], goals: gl.data ?? [] };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mes-donnees-pacevo.json"; a.click();
      URL.revokeObjectURL(url);
      toast.success(tr("t.exportOk"));
    } catch { toast.error(tr("t.exportErr")); }
    finally { setExporting(false); }
  }

  const maxHr = Number(baseline?.max_hr ?? 0) || (fitness?.obsMaxHr ?? 0);
  const zones = maxHr > 0 ? calcZones(maxHr, tr) : null;

  // VO2max = mesure Garmin (montre) ; métriques riches Garmin (FC repos, seuil, forme).
  const g = fitness?.garmin ?? null;
  const garminVo2 = Number(fitness?.garminVo2max ?? g?.vo2max ?? 0) || null;
  // VMA, par fiabilité : test > efforts réels (reflète l'allure de course → colle au prédicteur Garmin)
  // > dérivée de la VO2max (repli). NE PAS dériver la VMA de la VO2max en priorité : ça sous-estime l'allure.
  const baselineVma = Number(baseline?.vma_kmh ?? 0);
  const effVma = baselineVma > 0 ? baselineVma : (fitness?.estimatedVma ?? 0) || (garminVo2 ? vmaFromVo2max(garminVo2) : 0);
  const vmaSource: "test" | "séances" | "garmin" | null = baselineVma > 0 ? "test" : (fitness?.estimatedVma ?? 0) > 0 ? "séances" : garminVo2 ? "garmin" : null;
  const vma = effVma; // utilisé par les "allures de référence"
  const restHr = Number(baseline?.resting_hr ?? 0) || Number(g?.restingHR ?? 0) || null;
  const ltHrEff = Number(baseline?.lt_hr ?? 0) || Number(g?.lthr ?? 0) || null;
  const vo2 = garminVo2 || effVma > 0 || maxHr > 0 ? vo2maxEstimate({ vma: effVma || null, maxHr: maxHr || null, restHr, garmin: garminVo2 }) : null;
  const vo2max = vo2?.value ?? null;
  const predictions = effVma > 0 ? racePredictions(effVma) : [];

  // Autocomplétion chaussures : filtre la marque puis les modèles de cette marque selon la saisie.
  const shoeBrandQ = newShoe.brand.trim().toLowerCase();
  const shoeBrandOpts = SHOE_BRANDS.filter(b => b.toLowerCase().includes(shoeBrandQ) && b.toLowerCase() !== shoeBrandQ).slice(0, 8);
  const shoeModelPool = SHOE_MODELS[shoeBrandQ] ?? Array.from(new Set(Object.values(SHOE_MODELS).flat()));
  const shoeModelQ = newShoe.model.trim().toLowerCase();
  const shoeModelOpts = shoeModelPool.filter(m => m.toLowerCase().includes(shoeModelQ) && m.toLowerCase() !== shoeModelQ).slice(0, 10);

  // ── Graphiques façon Garmin : tendance VO2max + prédicteur de course (allures) ──
  const vo2Hist = Array.isArray(g?.vo2maxHistory) ? g!.vo2maxHistory! : [];
  const fmtD = (s: string) => new Date(s + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" });
  const secToPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
  const vo2ChartData = vo2Hist.map(p => ({ d: fmtD(p.date), v: p.v }));
  const latestVo2pt = vo2Hist.length ? vo2Hist[vo2Hist.length - 1].v : (garminVo2 ?? 0);
  const PRED_LINES = [
    { km: 5, key: "p5", label: "5 km", color: "#2563eb" },
    { km: 10, key: "p10", label: "10 km", color: "#16a34a" },
    { km: 21.1, key: "p21", label: "Semi", color: "#ea580c" },
    { km: 42.2, key: "p42", label: "Marathon", color: "#dc2626" },
  ] as const;
  // Allure prédite par distance, projetée sur l'historique VO2max (ancrée sur l'allure actuelle).
  const paceChartData = (effVma > 0 && latestVo2pt > 0)
    ? vo2Hist.map(p => {
        const factor = latestVo2pt / p.v; // VO2max plus haute dans le passé → allure plus rapide
        const row: Record<string, number | string> = { d: fmtD(p.date) };
        for (const ln of PRED_LINES) row[ln.key] = Math.round((predictRaceSec(effVma, ln.km) / ln.km) * factor);
        return row;
      })
    : [];

  const tabs = [
    { v: "profile", l: tr("tab.profile"), icon: User },
    { v: "goals", l: tr("tab.goals"), icon: Target },
    { v: "performance", l: tr("tab.performance"), icon: Activity },
    { v: "shoes", l: tr("tab.shoes"), icon: Footprints },
    { v: "subscription", l: tr("tab.subscription"), icon: CreditCard },
  ];

  const leagueColors: Record<string, string> = {
    bronze: "bg-orange-100 text-orange-700",
    silver: "bg-slate-100 text-slate-700",
    gold: "bg-yellow-100 text-yellow-700",
    platinum: "bg-cyan-100 text-cyan-700",
    diamond: "bg-violet-100 text-violet-700",
  };
  const league = String(profile?.league ?? "bronze");
  const leagueStyle = leagueColors[league] ?? "bg-zinc-100 text-zinc-600";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">

      {/* ── Hero card ── */}
      <div className="bento-card flex items-center gap-5">
        {/* Avatar with upload */}
        <div className="relative shrink-0 group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg relative focus:outline-none"
            title={tr("photo.change")}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-3xl font-black">
                {String(form.full_name)[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
              {uploadingAvatar
                ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                : <Camera className="w-6 h-6 text-white" />
              }
            </div>
          </button>
          {/* Online dot */}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-white" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-zinc-900">{form.full_name || tr("hero.myProfile")}</h1>
          {form.bio && <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{form.bio}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold capitalize ${leagueStyle}`}>
              {league.charAt(0).toUpperCase()}{league.slice(1)}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              {tr("hero.score", { n: Math.round(Number(profile?.discipline_score ?? 0)) })}
            </span>
            {stats.streak > 0 && (
              <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {tr(stats.streak > 1 ? "hero.streakP" : "hero.streak", { n: stats.streak })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={tr("stat.kmYear")} value={Math.round(stats.kmYear)} unit="km" icon={<TrendingUp className="w-3.5 h-3.5" />} color="bg-emerald-50" />
        <StatCard label={tr("stat.kmMonth")} value={Math.round(stats.kmMonth)} unit="km" icon={<Calendar className="w-3.5 h-3.5" />} color="bg-blue-50" />
        <StatCard label={tr("stat.sessions")} value={stats.sessionsMonth} icon={<Zap className="w-3.5 h-3.5" />} color="bg-violet-50" />
        <StatCard label={tr("stat.longest")} value={Math.round(stats.longestRun)} unit="km" icon={<Trophy className="w-3.5 h-3.5" />} color="bg-orange-50" />
      </div>

      {/* ── Répartition par discipline ──
          Les compteurs ci-dessus ne comptent que la COURSE. Le reste de l'activité
          n'est pas effacé pour autant : il est montré à part, là où il ne fausse rien. */}
      {stats.bySport && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{tr("split.title")}</span>
            <span className="text-[11px] text-zinc-400">{tr("split.year")}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ["split.road", stats.bySport.year.road, "bg-emerald-500"],
              ["split.trail", stats.bySport.year.trail, "bg-lime-600"],
              ["split.bike", stats.bySport.year.bike, "bg-sky-500"],
              ["split.hike", stats.bySport.year.hike, "bg-amber-500"],
            ] as const).map(([key, value, dot]) => (
              <div key={key} className="rounded-xl bg-zinc-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="text-[11px] font-medium text-zinc-600">{tr(key)}</span>
                </div>
                <div className="text-lg font-black text-zinc-900 tabular-nums">
                  {Math.round(value)}<span className="text-xs font-semibold text-zinc-400 ml-0.5">km</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">{tr("split.note")}</p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.l}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── PROFIL tab ── */}
        {tab === "profile" && (
          <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bento-card space-y-4">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><User className="w-4 h-4" /> {tr("pi.title")}</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Avatar quick-change inside form */}
                <div className="col-span-2 flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xl font-black">
                        {String(form.full_name)[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-700 mb-1">{tr("photo.title")}</div>
                    <div className="text-xs text-zinc-400 mb-2">{tr("photo.hint")}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-50"
                    >
                      {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      {uploadingAvatar ? tr("photo.uploading") : tr("photo.change")}
                    </button>
                  </div>
                </div>
              <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("f.name")}</label>
                  <input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {[{k:"age",l:tr("f.age")},{k:"height_cm",l:tr("f.height")},{k:"weight_kg",l:tr("f.weight")}].map(({k,l}) => (
                  <div key={k}>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{l}</label>
                    <input type="number" value={(form as unknown as Record<string,string>)[k]}
                      onChange={e => setForm(f => ({...f, [k]: e.target.value}))}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("f.lang")}</label>
                  <select value={lang} onChange={e => { const l = e.target.value as Lang; setLang(l); setForm(f => ({ ...f, preferred_language: l })); }}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {languageOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("f.bio")}</label>
                  <textarea value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))}
                    placeholder={tr("f.bioPh")}
                    rows={3} maxLength={200}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  <div className="text-right text-xs text-zinc-400 mt-1">{form.bio.length}/200</div>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.warmup")}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[5,10,15,20,25,30].map(m => (
                        <button key={m} type="button" onClick={() => setForm(f => ({...f, warmup_min: m}))}
                          className={`py-2 rounded-xl text-sm font-medium border transition-all ${form.warmup_min === m ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.cooldown")}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[5,10,15,20,25,30].map(m => (
                        <button key={m} type="button" onClick={() => setForm(f => ({...f, cooldown_min: m}))}
                          className={`py-2 rounded-xl text-sm font-medium border transition-all ${form.cooldown_min === m ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="col-span-2 text-[11px] text-zinc-400">{tr("f.wcHint")}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.longMode")}</label>
                  <div className="flex gap-2">
                    {([["run", "f.longRun"], ["bike", "f.longBike"]] as const).map(([v, k]) => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, long_run_mode: v }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${form.long_run_mode === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {tr(k)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("f.longHint")}</p>
                </div>

                {/* Ancienneté — plafonne la charge que le coach IA se permet de prescrire. */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.exp")}</label>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {([[0, "f.exp0"], [1, "f.exp1"], [2, "f.exp2"], [4, "f.exp4"], [8, "f.exp8"], [12, "f.exp12"]] as const).map(([v, k]) => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, running_years: v }))}
                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${form.running_years === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {tr(k)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("f.expHint")}</p>
                </div>

                {/* Disponibilités — le plan n'a de valeur que s'il est tenable. */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.dpw")}</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[2, 3, 4, 5, 6, 7].map(n => (
                      <button key={n} type="button" onClick={() => setForm(f => ({ ...f, days_per_week: n }))}
                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${form.days_per_week === n ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {n}×
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("f.dpwHint")}</p>
                </div>

                {/* DEUX SÉANCES PAR JOUR — placé ici, à côté du nombre de séances par
                    semaine, et non dans les Notifications : c'est un réglage
                    D'ENTRAÎNEMENT. Rangé au milieu des rappels et des classements, il
                    se lisait comme une préférence d'alerte. */}
                <div className="col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3">
                  <Toggle enabled={form.double_sessions} onToggle={() => setForm(f => ({ ...f, double_sessions: !f.double_sessions }))} label={tr("double.title")} />
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("double.hint")}</p>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.days")}</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map(d => {
                      const on = form.available_days.includes(d);
                      return (
                        <button key={d} type="button"
                          onClick={() => setForm(f => ({ ...f, available_days: on ? f.available_days.filter(x => x !== d) : [...f.available_days, d] }))}
                          className={`py-2 rounded-xl text-sm font-medium border transition-all ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50"}`}>
                          {tr("f.dayShort").split(",")[d]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("f.daysHint")}</p>
                </div>

                {/* Terrains — CHOIX MULTIPLE : décide si les séances se pilotent à l'allure ou à la FC. */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.terr")} <span className="font-normal text-zinc-400">· {tr("f.terrMulti")}</span></label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {TERRAINS.map(t => {
                      const on = form.main_terrains.includes(t.slug);
                      return (
                        <button key={t.slug} type="button"
                          onClick={() => setForm(f => ({ ...f, main_terrains: on ? f.main_terrains.filter(s => s !== t.slug) : [...f.main_terrains, t.slug] }))}
                          className={`py-2 px-1.5 rounded-xl text-xs font-medium border transition-all ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                          {terrainLabel(t, lang)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("f.terrHint")}</p>
                </div>

                {/* Dénivelé — dose les côtes et le D+ hebdomadaire. */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("f.elev")}</label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {([["evite", "f.elevEvite"], ["modere", "f.elevModere"], ["aime", "f.elevAime"], ["specialiste", "f.elevSpec"]] as const).map(([v, k]) => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, elevation_pref: v }))}
                        className={`py-2 rounded-xl text-xs font-medium border transition-all ${form.elevation_pref === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {tr(k)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("f.elevHint")}</p>
                </div>

                {/* Santé — contraint la prescription du coach IA. « Rien » est une réponse valable. */}
                <div className="col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">🩺 {tr("h.title")}</div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{tr("h.sub")}</p>
                  </div>
                  {([["health_conditions", "h.cond", HEALTH_CONDITIONS], ["injury_zones", "h.inj", INJURY_ZONES]] as const).map(([key, titleKey, catalog]) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr(titleKey)}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {catalog.map(item => {
                          const on = form[key].includes(item.slug);
                          return (
                            <button key={item.slug} type="button"
                              onClick={() => setForm(f => ({ ...f, health_declared: true, [key]: on ? f[key].filter(s => s !== item.slug) : [...f[key], item.slug] }))}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                              {healthLabel(item, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Réponse explicite « rien à signaler » : sans elle, un athlète en bonne
                      santé resterait indistinguable de quelqu'un qui n'a pas répondu. */}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, health_declared: true, health_conditions: [], injury_zones: [] }))}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${form.health_declared && form.health_conditions.length === 0 && form.injury_zones.length === 0 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                    {form.health_declared && form.health_conditions.length === 0 && form.injury_zones.length === 0 ? "✓ " : ""}{tr("h.none")}
                  </button>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("h.notes")}</label>
                    <textarea value={form.health_notes} onChange={e => setForm(f => ({ ...f, health_notes: e.target.value }))}
                      placeholder={tr("h.notesPh")} rows={2} maxLength={500}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">⚕️ {tr("h.disc")}</p>
                </div>
              </div>
              <button onClick={save} disabled={saving} className="btn-brand">
                <Save className="w-4 h-4" />
                {saving ? tr("common.saving") : tr("common.save")}
              </button>
            </div>

            {/* Notifications */}
            <div className="bento-card space-y-1">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4" /> {tr("notif.title")}
              </h3>
              <Toggle enabled={form.notif_workout} onToggle={() => setForm(f => ({...f, notif_workout: !f.notif_workout}))} label={tr("notif.workout")} />
              <Toggle enabled={form.notif_goal} onToggle={() => setForm(f => ({...f, notif_goal: !f.notif_goal}))} label={tr("notif.goal")} />
              <Toggle enabled={form.notif_league} onToggle={() => setForm(f => ({...f, notif_league: !f.notif_league}))} label={tr("notif.league")} />
              <Toggle enabled={form.notif_coach} onToggle={() => setForm(f => ({...f, notif_coach: !f.notif_coach}))} label={tr("notif.coach")} />
              {/* CONFIDENTIALITÉ DU COMPTE — placée ici parce que c'est le même
                  geste : « qui peut m'atteindre ». La conséquence est écrite en
                  toutes lettres sous la bascule : un réglage dont on ne comprend
                  pas l'effet ne se touche jamais. */}
              <div className="mt-3 border-t border-zinc-200 pt-3">
                <Toggle enabled={form.is_private} onToggle={() => setForm(f => ({...f, is_private: !f.is_private}))} label={tr("privacy.private")} />
                <p className="mt-1 text-xs text-zinc-500">
                  {form.is_private ? tr("privacy.privateHint") : tr("privacy.publicHint")}
                </p>
              </div>
              <div className="pt-3">
                <button onClick={save} disabled={saving} className="text-sm text-emerald-600 font-semibold hover:underline">
                  {tr("notif.save")}
                </button>
              </div>
            </div>

            {/* Guardian mode */}
            <div className={`bento-card border-2 transition-colors ${form.guardian_mode_enabled ? "border-violet-300 bg-violet-50" : "border-zinc-200"}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl ${form.guardian_mode_enabled ? "bg-violet-100" : "bg-zinc-100"}`}>
                  <Shield className={`w-6 h-6 ${form.guardian_mode_enabled ? "text-violet-600" : "text-zinc-400"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-900">{tr("guard.title")}</h3>
                    <button
                      onClick={() => { setForm(f => ({...f, guardian_mode_enabled: !f.guardian_mode_enabled})); }}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.guardian_mode_enabled ? "bg-violet-500" : "bg-zinc-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.guardian_mode_enabled ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    {tr("guard.desc")}
                  </p>
                  {form.guardian_mode_enabled && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-violet-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> {tr("guard.active")}
                    </div>
                  )}
                </div>
              </div>
              {form.guardian_mode_enabled && (
                <div className="mt-3 pt-3 border-t border-violet-200">
                  <button onClick={save} disabled={saving} className="text-sm text-violet-600 font-semibold hover:underline">
                    {tr("common.save")}
                  </button>
                </div>
              )}
            </div>

            {/* Données & confidentialité (RGPD) */}
            <div className="bento-card space-y-3">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Shield className="w-4 h-4 text-zinc-500" /> {tr("gdpr.title")}</h3>
              <p className="text-sm text-zinc-500">{tr("gdpr.desc")}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportData} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-50">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting ? tr("gdpr.exporting") : tr("gdpr.export")}
                </button>
                <a href="/confidentialite" className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-zinc-400 transition-all">
                  {tr("gdpr.privacy")}
                </a>
              </div>
              <p className="text-xs text-zinc-400">{tr("gdpr.delPre")}<b>cypriendumez@outlook.fr</b>{tr("gdpr.delPost")}</p>
            </div>
          </motion.div>
        )}

        {/* ── OBJECTIFS tab ── */}
        {tab === "goals" && (
          <motion.div key="goals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">{tr("goals.title")}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{tr("goals.summary", { a: goals.filter(g => !g.achieved).length, b: goals.filter(g => g.achieved).length })}</p>
              </div>
              <button onClick={() => setAddingGoal(true)}
                className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all">
                <Plus className="w-4 h-4" /> {tr("common.add")}
              </button>
            </div>

            {/* Add goal form */}
            <AnimatePresence>
              {addingGoal && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="bento-card border-2 border-emerald-200 bg-emerald-50 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-zinc-900">{tr("goals.new")}</h4>
                    <button onClick={() => setAddingGoal(false)}><X className="w-4 h-4 text-zinc-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("goals.type")}</label>
                      <div className="flex gap-2 flex-wrap">
                        {GOAL_TYPES.map(gt => (
                          <button key={gt.value} onClick={() => setNewGoal(g => ({...g, type: gt.value}))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                              newGoal.type === gt.value ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-zinc-600 border-zinc-200 hover:border-emerald-300"
                            }`}>
                            {gt.icon} {tr(gt.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("goals.name")}</label>
                      <input value={newGoal.label} onChange={e => setNewGoal(g => ({...g, label: e.target.value}))}
                        placeholder={newGoal.type === "race" ? tr("goals.namePhRace") : tr("goals.namePhOther")}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">
                        {tr("goals.targetVal", { unit: GOAL_TYPES.find(g => g.value === newGoal.type)?.unit ?? "" })}
                      </label>
                      <input type="number" value={newGoal.target_value} onChange={e => setNewGoal(g => ({...g, target_value: e.target.value}))}
                        placeholder={tr("goals.targetValPh")}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    </div>
                    {newGoal.type === "race" && (
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("goals.targetDate")}</label>
                        <input type="date" value={newGoal.target_date} onChange={e => setNewGoal(g => ({...g, target_date: e.target.value}))}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={addGoal} className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-all">
                      {tr("goals.create")}
                    </button>
                    <button onClick={() => setAddingGoal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-zinc-600 border border-zinc-200">
                      {tr("common.cancel")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Goals list */}
            {goals.length === 0 && !addingGoal ? (
              <div className="bento-card text-center py-12">
                <Target className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">{tr("goals.emptyTitle")}</p>
                <p className="text-zinc-300 text-xs mt-1">{tr("goals.emptyDesc")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map(goal => {
                  const pct = goal.target_value > 0 ? goal.current_value / goal.target_value : 0;
                  const daysLeft = goal.target_date
                    ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000)
                    : null;
                  const gt = GOAL_TYPES.find(g => g.value === goal.type);
                  return (
                    <motion.div key={goal.id} layout
                      className={`bento-card flex gap-4 transition-all ${goal.achieved ? "opacity-60" : ""}`}>
                      <div className="shrink-0">
                        <ProgressRing pct={pct} size={64} stroke={6} color={goal.achieved ? "#16a34a" : "#3b82f6"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{gt?.icon}</span>
                              <span className="font-semibold text-zinc-900 text-sm">{goal.label}</span>
                              {goal.achieved && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{tr("goals.achieved")}</span>}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {goal.current_value} / {goal.target_value} {gt?.unit}
                              {daysLeft !== null && (
                                <span className={`ml-2 font-medium ${daysLeft < 30 ? "text-orange-500" : "text-zinc-400"}`}>
                                  · {daysLeft > 0 ? `J-${daysLeft}` : tr("goals.past")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => toggleGoalAchieved(goal)}
                              className={`p-1.5 rounded-lg transition-all ${goal.achieved ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-400 hover:text-emerald-500"}`}>
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteGoal(goal.id)}
                              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-400 hover:text-red-500 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div className={`h-full rounded-full ${goal.achieved ? "bg-emerald-500" : "bg-blue-500"}`}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(pct * 100, 100)}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }} />
                        </div>
                        <div className="text-right text-xs text-zinc-400 mt-1">{Math.round(pct * 100)}%</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Quick stats for goals context */}
            <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
              <div className="text-sm font-semibold mb-3 text-zinc-300">{tr("goals.context")}</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-black">{Math.round(stats.kmMonth)}</div>
                  <div className="text-xs text-zinc-400 mt-1">{tr("goals.ctxMonth")}</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{Math.round(stats.kmYear)}</div>
                  <div className="text-xs text-zinc-400 mt-1">{tr("goals.ctxYear")}</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{stats.streak}</div>
                  <div className="text-xs text-zinc-400 mt-1">{tr("goals.ctxStreak")}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PERFORMANCE tab ── */}
        {tab === "performance" && (
          <motion.div key="performance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Key metrics */}
            <div className="bento-card space-y-4">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><BarChart2 className="w-4 h-4" /> {tr("perf.title")}</h3>
              {(baseline || effVma > 0) ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: tr("perf.vma"), value: effVma > 0 ? `${effVma}` : "—", unit: "km/h", icon: <Wind className="w-4 h-4 text-blue-500" />, bg: "bg-blue-50" },
                      { label: tr("perf.maxHr"), value: maxHr > 0 ? `${maxHr}` : "—", unit: "bpm", icon: <Heart className="w-4 h-4 text-red-500" />, bg: "bg-red-50" },
                      { label: tr("perf.restHr"), value: restHr ? `${restHr}` : "—", unit: restHr ? "bpm" : "", icon: <Heart className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-50" },
                      { label: tr("perf.lt"), value: ltHrEff ? `${ltHrEff}` : "—", unit: ltHrEff ? "bpm" : "", icon: <Zap className="w-4 h-4 text-orange-500" />, bg: "bg-orange-50" },
                    ].map(m => (
                      <div key={m.label} className={`${m.bg} rounded-2xl p-4`}>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">{m.icon}{m.label}</div>
                        <div className="text-xl font-black text-zinc-900">{String(m.value)}<span className="text-xs font-medium text-zinc-400 ml-1">{m.unit}</span></div>
                      </div>
                    ))}
                  </div>

                  {vmaSource === "séances" && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{tr("perf.vmaWarn")}</span>
                    </div>
                  )}

                  {/* VO2max — multi-sources (façon Garmin) + échelle de niveau visuelle */}
                  {vo2max && (
                    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-violet-100">
                          <div className="text-2xl font-black leading-none text-violet-700">{vo2max}</div>
                          <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-zinc-400">ml/kg/min</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-900">{tr("perf.vo2est")}</div>
                          <div className="truncate text-xs text-zinc-500">{tr("perf.vo2from", { sources: vo2?.sources.join(" + ") ?? "" })}</div>
                          <div className={`mt-0.5 text-xs font-bold ${vo2max >= 56 ? "text-emerald-600" : vo2max >= 46 ? "text-blue-600" : vo2max >= 36 ? "text-orange-500" : "text-zinc-500"}`}>{vo2maxLabel(vo2max)}</div>
                        </div>
                      </div>
                      {/* Position sur l'échelle 30 → 72 ml/kg/min (moyen → élite) */}
                      <div className="relative mt-3.5 h-2 rounded-full" style={{ background: "linear-gradient(90deg,#d4d4d8,#fdba74,#93c5fd,#86efac,#8b5cf6)" }}>
                        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 shadow-md"
                          style={{ left: `${Math.min(100, Math.max(0, ((vo2max - 30) / 42) * 100))}%` }} />
                      </div>
                      {vo2ChartData.length > 1 && (
                        <div className="mt-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">{tr("perf.vo2trend")}</div>
                          <ResponsiveContainer width="100%" height={130}>
                            <LineChart data={vo2ChartData} margin={{ top: 6, right: 10, bottom: 0, left: -22 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#a1a1aa" }} interval="preserveStartEnd" minTickGap={32} axisLine={false} tickLine={false} />
                              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: "#a1a1aa" }} width={30} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e4e4e7" }} formatter={(v: number | string) => [`${v} ml/kg/min`, "VO2max"]} />
                              <Line type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10">
                  <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">{tr("perf.emptyTitle")}</p>
                  <p className="text-zinc-300 text-xs mt-1">{tr("perf.emptyDesc")}</p>
                </div>
              )}
            </div>

            {/* Forme & charge (Garmin : Condition/Fatigue/Forme = CTL/ATL/TSB) */}
            {g && g.ctl != null && (
              <div className="bento-card space-y-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Activity className="w-4 h-4 text-violet-500" /> {tr("perf.loadTitle")}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: tr("perf.fitness"), value: g.ctl != null ? `${g.ctl}` : "—", color: "text-blue-600", bg: "bg-blue-50" },
                    { label: tr("perf.fatigue"), value: g.atl != null ? `${g.atl}` : "—", color: "text-orange-600", bg: "bg-orange-50" },
                    { label: tr("perf.form"), value: (g.ctl != null && g.atl != null) ? (g.ctl - g.atl > 0 ? `+${g.ctl - g.atl}` : `${g.ctl - g.atl}`) : "—", color: "text-emerald-600", bg: "bg-emerald-50" },
                  ].map(m => (
                    <div key={m.label} className={`${m.bg} rounded-2xl p-4 text-center`}>
                      <div className="text-xs text-zinc-500 mb-1">{m.label}</div>
                      <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-400">{tr("perf.loadHint")}</p>
              </div>
            )}

            {/* Prédictions de chrono par distance */}
            {predictions.length > 0 && (
              <div className="bento-card space-y-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {tr("perf.predTitle")}</h3>
                <p className="text-xs text-zinc-400 -mt-1">{tr(vmaSource === "test" ? "perf.predDescTest" : vmaSource === "garmin" ? "perf.predDescGarmin" : "perf.predDescSess")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {predictions.map((p, i) => (
                    <div key={p.label} className="rounded-2xl bg-zinc-50 p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400">
                        <span className="h-2 w-2 rounded-full" style={{ background: PRED_LINES[i]?.color ?? "#71717a" }} />{p.label}
                      </div>
                      <div className="text-xl font-black text-zinc-900 mt-1">{p.time}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{p.pace}</div>
                    </div>
                  ))}
                </div>
                {paceChartData.length > 1 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">{tr("perf.predGraph")}</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={paceChartData} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#a1a1aa" }} interval="preserveStartEnd" minTickGap={32} axisLine={false} tickLine={false} />
                        <YAxis reversed domain={["dataMin - 8", "dataMax + 8"]} tickFormatter={(s: number) => secToPace(s)} tick={{ fontSize: 10, fill: "#a1a1aa" }} width={42} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e4e4e7" }} formatter={(v: number | string, n) => [`${secToPace(Number(v))}/km`, n]} />
                        {PRED_LINES.map(ln => (
                          <Line key={ln.key} type="monotone" dataKey={ln.key} name={ln.label} stroke={ln.color} strokeWidth={2.2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1">
                      {PRED_LINES.map(ln => (
                        <span key={ln.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                          <span className="h-2 w-2 rounded-full" style={{ background: ln.color }} />{ln.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HR Zones */}
            {zones && (
              <div className="bento-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> {tr("perf.zonesTitle")}</h3>
                  <span className="text-xs text-zinc-400">{tr("perf.maxHrLabel", { n: maxHr })}</span>
                </div>
                <div className="space-y-3">
                  {zones.map(zone => (
                    <div key={zone.z} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl ${zone.color} flex items-center justify-center text-white text-xs font-black shrink-0`}>
                        {zone.z}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-zinc-700">{zone.name}</span>
                          <span className={`text-xs font-mono font-semibold ${zone.textColor}`}>{zone.min}–{zone.max} bpm</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${zone.color}`}
                            style={{ width: `${((zone.max - zone.min) / maxHr) * 100 + zone.min / maxHr * 80}%` }}
                            initial={{ width: 0 }} animate={{ width: `${((zone.max - zone.min) / maxHr) * 100 + zone.min / maxHr * 80}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: zones.indexOf(zone) * 0.1 }} />
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{zone.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allures de référence */}
            {vma > 0 && (
              <div className="bento-card space-y-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Clock className="w-4 h-4" /> {tr("perf.pacesTitle")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: tr("pace.z2"), pct: 0.65, color: "text-emerald-600" },
                    { label: tr("pace.tempo"), pct: 0.80, color: "text-yellow-600" },
                    { label: tr("pace.seuil"), pct: 0.88, color: "text-orange-600" },
                    { label: tr("pace.vma"), pct: 1.00, color: "text-red-600" },
                  ].map(({ label, pct, color }) => {
                    const speedKmh = vma * pct;
                    const secsPerKm = 3600 / speedKmh;
                    const mins = Math.floor(secsPerKm / 60);
                    const secs = Math.round(secsPerKm % 60);
                    return (
                      <div key={label} className="bg-zinc-50 rounded-2xl p-3">
                        <div className="text-xs text-zinc-500 mb-1">{label}</div>
                        <div className={`text-lg font-black ${color}`}>{mins}:{String(secs).padStart(2,"0")}<span className="text-xs font-normal text-zinc-400 ml-1">min/km</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── CHAUSSURES tab ── */}
        {tab === "shoes" && (
          <motion.div key="shoes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">{tr("shoes.title")}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{tr(shoeList.length > 1 ? "shoes.countP" : "shoes.count", { n: shoeList.length })}</p>
              </div>
              <button onClick={() => setAddingShoe(true)}
                className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all">
                <Plus className="w-4 h-4" /> {tr("common.add")}
              </button>
            </div>

            {/* Add shoe form */}
            <AnimatePresence>
              {addingShoe && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="flex items-center gap-2 font-semibold text-zinc-900"><Footprints className="h-4 w-4 text-emerald-600" /> {tr("shoes.new")}</h4>
                    <button onClick={() => setAddingShoe(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <label className="mb-1 block text-xs font-semibold text-zinc-500">{tr("shoes.brand")}</label>
                      <input value={newShoe.brand} onChange={e => setNewShoe(s => ({...s, brand: e.target.value, model: "" }))}
                        onFocus={() => setBrandFocus(true)} onBlur={() => setTimeout(() => setBrandFocus(false), 150)}
                        placeholder={tr("shoes.brandPh")} autoComplete="off"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                      {brandFocus && shoeBrandOpts.length > 0 && (
                        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
                          {shoeBrandOpts.map(b => (
                            <button key={b} type="button" onMouseDown={e => e.preventDefault()}
                              onClick={() => { setNewShoe(s => ({ ...s, brand: b, model: "" })); setBrandFocus(false); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50">
                              <Footprints className="h-3.5 w-3.5 flex-shrink-0 text-zinc-300" /> {b}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <label className="mb-1 block text-xs font-semibold text-zinc-500">{tr("shoes.model")}</label>
                      <input value={newShoe.model} onChange={e => setNewShoe(s => ({...s, model: e.target.value}))}
                        onFocus={() => setModelFocus(true)} onBlur={() => setTimeout(() => setModelFocus(false), 150)}
                        placeholder={tr("shoes.modelPh")} autoComplete="off"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                      {modelFocus && shoeModelOpts.length > 0 && (
                        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
                          {shoeModelOpts.map(m => (
                            <button key={m} type="button" onMouseDown={e => e.preventDefault()}
                              onClick={() => { setNewShoe(s => ({ ...s, model: m })); setModelFocus(false); }}
                              className="block w-full px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50">
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-500">{tr("shoes.life")}</label>
                      <input type="number" value={newShoe.max_km} onChange={e => setNewShoe(s => ({...s, max_km: e.target.value}))}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-500">{tr("shoes.buyDate")}</label>
                      <input type="date" value={newShoe.purchase_date} onChange={e => setNewShoe(s => ({...s, purchase_date: e.target.value}))}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">💡 {tr("shoes.suggestHint")}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={addShoe} disabled={!newShoe.brand.trim() || !newShoe.model.trim()}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                      {tr("shoes.addGarage")}
                    </button>
                    <button onClick={() => setAddingShoe(false)} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50">
                      {tr("common.cancel")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {shoeList.length === 0 && !addingShoe ? (
              <div className="bento-card text-center py-12">
                <Footprints className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">{tr("shoes.emptyTitle")}</p>
                <p className="text-zinc-300 text-xs mt-1">{tr("shoes.emptyDesc")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shoeList.map(shoe => {
                  const pct = Number(shoe.current_km) / Number(shoe.max_km) * 100;
                  const status = pct >= 90 ? { color: "bg-red-500", text: tr("shoes.replace"), badge: "bg-red-100 text-red-700" }
                    : pct >= 70 ? { color: "bg-orange-500", text: tr("shoes.watch"), badge: "bg-orange-100 text-orange-700" }
                    : { color: "bg-emerald-500", text: tr("shoes.good"), badge: "bg-emerald-100 text-emerald-700" };
                  const remaining = Number(shoe.max_km) - Number(shoe.current_km);
                  return (
                    <motion.div key={shoe.id} layout className="bento-card">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-zinc-900">{shoe.brand} {shoe.model}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {tr("shoes.km", { cur: Number(shoe.current_km).toFixed(0), rem: remaining.toFixed(0) })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.badge}`}>{status.text}</span>
                          <button onClick={() => deleteShoe(shoe.id)} className="p-1.5 rounded-lg bg-zinc-100 text-zinc-400 hover:text-red-500 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${status.color}`}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-400">
                        <span>0 km</span>
                        <span className="font-semibold text-zinc-600">{Math.round(pct)}%</span>
                        <span>{Number(shoe.max_km)} km</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── ABONNEMENT tab ── */}
        {tab === "subscription" && (
          <motion.div key="subscription" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bento-card">
              <h3 className="font-semibold text-zinc-900 mb-4">{tr("sub.title")}</h3>
              <div className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-zinc-900 text-lg">
                    {tr("sub.plan", { tier: profile?.subscription_tier === "free" || !profile?.subscription_tier ? tr("sub.free") : String(profile.subscription_tier).charAt(0).toUpperCase() + String(profile.subscription_tier).slice(1) })}
                  </div>
                  <div className="text-sm text-zinc-400 mt-0.5">
                    {profile?.subscription_tier === "free" ? tr("sub.freeDesc") : tr("sub.proDesc")}
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${
                  profile?.subscription_tier !== "free" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
                }`}>
                  {profile?.subscription_tier !== "free" ? tr("sub.active") : tr("sub.free")}
                </span>
              </div>

              {/* Feature comparison */}
              <div className="space-y-2">
                {[
                  { label: tr("feat.dash"), free: true, pro: true },
                  { label: tr("feat.journal"), free: true, pro: true },
                  { label: tr("feat.plans3"), free: true, pro: true },
                  { label: tr("feat.plansUnli"), free: false, pro: true },
                  { label: tr("feat.coach"), free: false, pro: true },
                  { label: tr("feat.ghost"), free: false, pro: true },
                  { label: tr("feat.vma"), free: false, pro: true },
                  { label: tr("feat.sync"), free: false, pro: true },
                  { label: tr("feat.shop"), free: false, pro: true },
                  { label: tr("feat.leagues"), free: false, pro: true },
                ].map(feat => (
                  <div key={feat.label} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                    <span className="text-sm text-zinc-700">{feat.label}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs w-12 text-center ${feat.free ? "text-emerald-600" : "text-zinc-300"}`}>
                        {feat.free ? "✓" : "✗"}
                      </span>
                      <span className={`text-xs w-12 text-center font-semibold ${feat.pro ? "text-emerald-600" : "text-zinc-300"}`}>
                        {feat.pro ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-8 mt-2 text-xs font-semibold text-zinc-400">
                <span>{tr("sub.free")}</span><span className="text-emerald-600">{tr("sub.pro")}</span>
              </div>
            </div>

            {profile?.subscription_tier === "free" && (
              <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/10 rounded-xl"><Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /></div>
                  <div>
                    <div className="font-bold text-lg">{tr("sub.goPro")}</div>
                    <div className="text-zinc-400 text-sm">{tr("sub.unlock")}</div>
                  </div>
                </div>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-4xl font-black">10€</span>
                  <span className="text-zinc-400 mb-1">{tr("sub.perMonth")}</span>
                  <span className="ml-3 text-sm text-emerald-400 font-semibold">{tr("sub.yearly")}</span>
                </div>
                <a href="/pricing" className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-semibold transition-all">
                  {tr("sub.trial")} <ChevronRight className="w-4 h-4 inline" />
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
