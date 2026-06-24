import type { Lang } from "@/lib/i18n/translations";

export type PricingDict = {
  eyebrow: string; title: string; subtitle: string;
  monthly: string; yearly: string; securedNote: string;
  perMonth: string; perYear: string; billedYearly: string; forever: string; custom: string; eliteSub: string;
  free: { name: string; cta: string; features: string[] };
  pro: { name: string; badge: string; ctaTrial: string; ctaYearly: string; features: string[] };
  elite: { name: string; cta: string; features: string[] };
};

export const PRICING: Record<Lang, PricingDict> = {
  fr: {
    eyebrow: "Tarification", title: "Simple et transparent", subtitle: "Commence gratuitement. Passe au Pro quand tu es prêt à performer. Sans engagement, annulable à tout moment.",
    monthly: "Mensuel", yearly: "Annuel", securedNote: "Paiement sécurisé par Stripe · Données hébergées en Europe · Conforme RGPD",
    perMonth: "/mois", perYear: "/an", billedYearly: "facturé 80€ par an", forever: "pour toujours", custom: "Sur mesure", eliteSub: "Clubs & athlètes pro",
    free: { name: "Gratuit", cta: "Commencer gratuitement", features: ["Dashboard basique", "5 séances IA / mois", "Hub courses France (lecture)", "Mode Ludique", "1 parcours Trail Builder"] },
    pro: { name: "Pro", badge: "Populaire", ctaTrial: "Essai 30 jours gratuit", ctaYearly: "S'abonner (80€/an)", features: ["Tout le gratuit", "Plans IA illimités", "Trail Builder complet + Mapbox", "Analyse biomécanique avancée", "Sync Garmin / Coros / Strava", "Guardian Mode", "Shopping Hub + Score Bio-Compat", "Ligues & Gamification", "Nutrition Lab", "Coaching IA", "Ghost Runner", "Smart Journaling"] },
    elite: { name: "Elite", cta: "Nous contacter", features: ["Tout le Pro", "Posture Lab (IA Vision caméra)", "IA Tapering avancé (TSB +15)", "API Access (Terra / Webhooks)", "Dashboard équipe", "Rapport mensuel PDF", "Support prioritaire", "Intégration Google Agenda", "Life Stress Sync"] },
  },
  en: {
    eyebrow: "Pricing", title: "Simple and transparent", subtitle: "Start for free. Go Pro when you're ready to perform. No commitment, cancel anytime.",
    monthly: "Monthly", yearly: "Annual", securedNote: "Secure payment by Stripe · Data hosted in Europe · GDPR compliant",
    perMonth: "/month", perYear: "/year", billedYearly: "billed €80 per year", forever: "forever", custom: "Custom", eliteSub: "Clubs & pro athletes",
    free: { name: "Free", cta: "Start for free", features: ["Basic dashboard", "5 AI sessions / month", "France race hub (read-only)", "Playful mode", "1 Trail Builder route"] },
    pro: { name: "Pro", badge: "Popular", ctaTrial: "30-day free trial", ctaYearly: "Subscribe (€80/yr)", features: ["Everything in Free", "Unlimited AI plans", "Full Trail Builder + Mapbox", "Advanced biomechanics analysis", "Garmin / Coros / Strava sync", "Guardian Mode", "Shopping Hub + Bio-Compat score", "Leagues & gamification", "Nutrition Lab", "AI Coaching", "Ghost Runner", "Smart Journaling"] },
    elite: { name: "Elite", cta: "Contact us", features: ["Everything in Pro", "Posture Lab (AI camera vision)", "Advanced AI tapering (TSB +15)", "API access (Terra / Webhooks)", "Team dashboard", "Monthly PDF report", "Priority support", "Google Calendar integration", "Life Stress Sync"] },
  },
  de: {
    eyebrow: "Preise", title: "Einfach und transparent", subtitle: "Starte kostenlos. Wechsle zu Pro, wenn du bereit bist zu performen. Keine Bindung, jederzeit kündbar.",
    monthly: "Monatlich", yearly: "Jährlich", securedNote: "Sichere Zahlung über Stripe · Daten in Europa gehostet · DSGVO-konform",
    perMonth: "/Monat", perYear: "/Jahr", billedYearly: "80€ jährlich abgerechnet", forever: "für immer", custom: "Individuell", eliteSub: "Vereine & Profi-Athleten",
    free: { name: "Gratis", cta: "Kostenlos starten", features: ["Basis-Dashboard", "5 KI-Einheiten / Monat", "Rennen-Hub Frankreich (Lesen)", "Spielerischer Modus", "1 Trail-Builder-Route"] },
    pro: { name: "Pro", badge: "Beliebt", ctaTrial: "30 Tage gratis testen", ctaYearly: "Abonnieren (80€/Jahr)", features: ["Alles aus Gratis", "Unbegrenzte KI-Pläne", "Voller Trail Builder + Mapbox", "Erweiterte Biomechanik-Analyse", "Garmin- / Coros- / Strava-Sync", "Guardian Mode", "Shopping Hub + Bio-Compat-Score", "Ligen & Gamification", "Nutrition Lab", "KI-Coaching", "Ghost Runner", "Smart Journaling"] },
    elite: { name: "Elite", cta: "Kontakt aufnehmen", features: ["Alles aus Pro", "Posture Lab (KI-Kamera-Vision)", "Erweitertes KI-Tapering (TSB +15)", "API-Zugang (Terra / Webhooks)", "Team-Dashboard", "Monatlicher PDF-Bericht", "Priorisierter Support", "Google-Kalender-Integration", "Life Stress Sync"] },
  },
  es: {
    eyebrow: "Precios", title: "Simple y transparente", subtitle: "Empieza gratis. Pasa a Pro cuando estés listo para rendir. Sin compromiso, cancela cuando quieras.",
    monthly: "Mensual", yearly: "Anual", securedNote: "Pago seguro con Stripe · Datos alojados en Europa · Conforme al RGPD",
    perMonth: "/mes", perYear: "/año", billedYearly: "facturado 80€ al año", forever: "para siempre", custom: "A medida", eliteSub: "Clubes y atletas pro",
    free: { name: "Gratis", cta: "Empezar gratis", features: ["Dashboard básico", "5 sesiones IA / mes", "Hub de carreras Francia (lectura)", "Modo lúdico", "1 ruta Trail Builder"] },
    pro: { name: "Pro", badge: "Popular", ctaTrial: "Prueba 30 días gratis", ctaYearly: "Suscribirse (80€/año)", features: ["Todo lo gratis", "Planes IA ilimitados", "Trail Builder completo + Mapbox", "Análisis biomecánico avanzado", "Sync Garmin / Coros / Strava", "Guardian Mode", "Shopping Hub + Score Bio-Compat", "Ligas y gamificación", "Nutrition Lab", "Coaching con IA", "Ghost Runner", "Smart Journaling"] },
    elite: { name: "Elite", cta: "Contáctanos", features: ["Todo lo de Pro", "Posture Lab (IA visión cámara)", "Afinamiento IA avanzado (TSB +15)", "Acceso API (Terra / Webhooks)", "Dashboard de equipo", "Informe mensual PDF", "Soporte prioritario", "Integración Google Calendar", "Life Stress Sync"] },
  },
  pt: {
    eyebrow: "Preços", title: "Simples e transparente", subtitle: "Começa grátis. Passa para Pro quando estiveres pronto para performar. Sem compromisso, cancela quando quiseres.",
    monthly: "Mensal", yearly: "Anual", securedNote: "Pagamento seguro por Stripe · Dados alojados na Europa · Conforme RGPD",
    perMonth: "/mês", perYear: "/ano", billedYearly: "faturado 80€ por ano", forever: "para sempre", custom: "Sob medida", eliteSub: "Clubes e atletas pro",
    free: { name: "Grátis", cta: "Começar grátis", features: ["Dashboard básico", "5 sessões IA / mês", "Hub de provas França (leitura)", "Modo lúdico", "1 percurso Trail Builder"] },
    pro: { name: "Pro", badge: "Popular", ctaTrial: "Teste 30 dias grátis", ctaYearly: "Subscrever (80€/ano)", features: ["Tudo do grátis", "Planos IA ilimitados", "Trail Builder completo + Mapbox", "Análise biomecânica avançada", "Sync Garmin / Coros / Strava", "Guardian Mode", "Shopping Hub + Score Bio-Compat", "Ligas e gamificação", "Nutrition Lab", "Coaching com IA", "Ghost Runner", "Smart Journaling"] },
    elite: { name: "Elite", cta: "Fala connosco", features: ["Tudo do Pro", "Posture Lab (IA visão câmara)", "Afinamento IA avançado (TSB +15)", "Acesso API (Terra / Webhooks)", "Dashboard de equipa", "Relatório mensal PDF", "Suporte prioritário", "Integração Google Calendar", "Life Stress Sync"] },
  },
};
