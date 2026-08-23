import type { Lang } from "@/lib/i18n/translations";

// Chaînes du chrome public partagé (SiteHeader + SiteFooter) en 5 langues.
export type ChromeDict = {
  nav: { programs: string; features: string; pricing: string; blog: string; reviews: string; story: string; login: string; trial: string };
  footer: { badge: string; title: string; desc: string; legal: string; privacy: string; cgu: string; contact: string; rights: string };
};

export const CHROME: Record<Lang, ChromeDict> = {
  fr: {
    nav: { programs: "Programmes", features: "Fonctionnalités", pricing: "Tarifs", blog: "Blog", reviews: "Avis", story: "Notre histoire", login: "Connexion", trial: "Essai gratuit" },
    footer: { badge: "Newsletter", title: "L'essentiel du running, chaque lundi", desc: "L'actualité de la semaine résumée, le matériel qui sort et les courses qui approchent. Un seul e-mail, le lundi matin.", legal: "Mentions légales", privacy: "Confidentialité", cgu: "CGU", contact: "Contact", rights: "© 2026 Pacevo — coaching course à pied et trail." },
  },
  en: {
    nav: { programs: "Programs", features: "Features", pricing: "Pricing", blog: "Blog", reviews: "Reviews", story: "Our story", login: "Log in", trial: "Free trial" },
    footer: { badge: "Newsletter", title: "The running essentials, every Monday", desc: "The week's news summarised, the gear that's out, and the races coming up. One email, Monday morning.", legal: "Legal notice", privacy: "Privacy", cgu: "Terms", contact: "Contact", rights: "© 2026 Pacevo — running and trail coaching." },
  },
  de: {
    nav: { programs: "Programme", features: "Funktionen", pricing: "Preise", blog: "Blog", reviews: "Bewertungen", story: "Unsere Geschichte", login: "Anmelden", trial: "Gratis testen" },
    footer: { badge: "Newsletter", title: "Das Wichtigste zum Laufen, jeden Montag", desc: "Die Woche in Kürze, die Ausrüstung, die erscheint, und die Rennen, die anstehen. Eine E-Mail, Montagmorgen.", legal: "Impressum", privacy: "Datenschutz", cgu: "AGB", contact: "Kontakt", rights: "© 2026 Pacevo — Lauf- und Trail-Coaching." },
  },
  es: {
    nav: { programs: "Programas", features: "Funciones", pricing: "Precios", blog: "Blog", reviews: "Opiniones", story: "Nuestra historia", login: "Iniciar sesión", trial: "Prueba gratis" },
    footer: { badge: "Newsletter", title: "Lo esencial del running, cada lunes", desc: "La actualidad de la semana resumida, el material que sale y las carreras que se acercan. Un solo correo, el lunes por la mañana.", legal: "Aviso legal", privacy: "Privacidad", cgu: "Términos", contact: "Contacto", rights: "© 2026 Pacevo — entrenamiento de running y trail." },
  },
  pt: {
    nav: { programs: "Programas", features: "Funcionalidades", pricing: "Preços", blog: "Blog", reviews: "Avaliações", story: "A nossa história", login: "Entrar", trial: "Teste grátis" },
    footer: { badge: "Newsletter", title: "O essencial da corrida, todas as segundas", desc: "A atualidade da semana resumida, o equipamento que sai e as provas que se aproximam. Um só e-mail, segunda de manhã.", legal: "Aviso legal", privacy: "Privacidade", cgu: "Termos", contact: "Contacto", rights: "© 2026 Pacevo — treino de corrida e trail." },
  },
};
