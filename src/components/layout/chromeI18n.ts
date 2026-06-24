import type { Lang } from "@/lib/i18n/translations";

// Chaînes du chrome public partagé (SiteHeader + SiteFooter) en 5 langues.
export type ChromeDict = {
  nav: { programs: string; features: string; pricing: string; blog: string; reviews: string; login: string; trial: string };
  footer: { badge: string; title: string; desc: string; legal: string; privacy: string; cgu: string; contact: string; rights: string };
};

export const CHROME: Record<Lang, ChromeDict> = {
  fr: {
    nav: { programs: "Programmes", features: "Fonctionnalités", pricing: "Tarifs", blog: "Blog", reviews: "Avis", login: "Connexion", trial: "Essai gratuit" },
    footer: { badge: "Newsletter", title: "Reçois nos conseils course chaque semaine", desc: "Entraînement, trail, matériel, nutrition — directement dans ta boîte mail. Désinscription en un clic.", legal: "Mentions légales", privacy: "Confidentialité", cgu: "CGU", contact: "Contact", rights: "© 2026 Pacevo. Fait avec ❤️ pour les coureurs." },
  },
  en: {
    nav: { programs: "Programs", features: "Features", pricing: "Pricing", blog: "Blog", reviews: "Reviews", login: "Log in", trial: "Free trial" },
    footer: { badge: "Newsletter", title: "Get our running tips every week", desc: "Training, trail, gear, nutrition — straight to your inbox. Unsubscribe in one click.", legal: "Legal notice", privacy: "Privacy", cgu: "Terms", contact: "Contact", rights: "© 2026 Pacevo. Made with ❤️ for runners." },
  },
  de: {
    nav: { programs: "Programme", features: "Funktionen", pricing: "Preise", blog: "Blog", reviews: "Bewertungen", login: "Anmelden", trial: "Gratis testen" },
    footer: { badge: "Newsletter", title: "Erhalte wöchentlich unsere Lauf-Tipps", desc: "Training, Trail, Ausrüstung, Ernährung — direkt in dein Postfach. Abmeldung mit einem Klick.", legal: "Impressum", privacy: "Datenschutz", cgu: "AGB", contact: "Kontakt", rights: "© 2026 Pacevo. Mit ❤️ für Läufer gemacht." },
  },
  es: {
    nav: { programs: "Programas", features: "Funciones", pricing: "Precios", blog: "Blog", reviews: "Opiniones", login: "Iniciar sesión", trial: "Prueba gratis" },
    footer: { badge: "Newsletter", title: "Recibe nuestros consejos de running cada semana", desc: "Entrenamiento, trail, material, nutrición — directo a tu correo. Cancela en un clic.", legal: "Aviso legal", privacy: "Privacidad", cgu: "Términos", contact: "Contacto", rights: "© 2026 Pacevo. Hecho con ❤️ para corredores." },
  },
  pt: {
    nav: { programs: "Programas", features: "Funcionalidades", pricing: "Preços", blog: "Blog", reviews: "Avaliações", login: "Entrar", trial: "Teste grátis" },
    footer: { badge: "Newsletter", title: "Recebe as nossas dicas de corrida todas as semanas", desc: "Treino, trail, equipamento, nutrição — direto no teu e-mail. Cancela num clique.", legal: "Aviso legal", privacy: "Privacidade", cgu: "Termos", contact: "Contacto", rights: "© 2026 Pacevo. Feito com ❤️ para corredores." },
  },
};
