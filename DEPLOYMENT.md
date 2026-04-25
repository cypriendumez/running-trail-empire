# 🚀 Guide de Déploiement — Running & Trail Empire

## Prérequis

- **Node.js 20+** — https://nodejs.org
- **Compte Supabase** — https://supabase.com (gratuit)
- **Compte Stripe** — https://stripe.com
- **Compte Mapbox** — https://mapbox.com
- **Clé OpenAI** — https://platform.openai.com

---

## 1. Installation

```bash
cd running-trail-empire
npm install
```

---

## 2. Configuration Supabase

1. Créez un projet sur https://supabase.com
2. Allez dans **SQL Editor** → collez le contenu de `supabase/migrations/001_initial_schema.sql`
3. Récupérez vos clés dans **Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### Activer OAuth (Google + Apple)
- **Authentication → Providers → Google** : suivez la doc Supabase
- **Authentication → Providers → Apple** : nécessite compte Apple Developer

### Seeder les courses de France
Après lancement du serveur, appelez :
```
GET http://localhost:3000/api/races/seed
```

---

## 3. Configuration Stripe

1. Créez deux produits dans le dashboard Stripe :
   - **Pro Mensuel** : 10€/mois → copiez le Price ID
   - **Pro Annuel** : 80€/an → copiez le Price ID
2. Configurez le webhook Stripe vers `https://votre-domaine.com/api/stripe/webhook`
   - Event : `customer.subscription.*`

---

## 4. Configuration Mapbox

1. Créez un token sur https://account.mapbox.com/access-tokens
2. Ajoutez `NEXT_PUBLIC_MAPBOX_TOKEN` dans `.env.local`

---

## 5. Configuration OpenAI

1. Créez une clé API sur https://platform.openai.com/api-keys
2. Ajoutez `OPENAI_API_KEY` dans `.env.local`

---

## 6. Configuration Terra API (sync montres)

1. Inscription sur https://tryterra.co
2. Configurez le webhook Terra vers `https://votre-domaine.com/api/terra/webhook`

---

## 7. Fichier .env.local complet

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_xxxxxxxx
STRIPE_PRICE_YEARLY=price_xxxxxxxx

NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

OPENAI_API_KEY=sk-proj-...

TERRA_API_KEY=your_terra_key
TERRA_DEV_ID=your_terra_dev_id

NEXT_PUBLIC_APP_URL=https://votre-domaine.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

---

## 8. Lancer en développement

```bash
npm run dev
```

→ Ouvrez http://localhost:3000

---

## 9. Déploiement Vercel (recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Configurer les variables d'environnement dans le dashboard Vercel
```

Ou connectez votre repo GitHub sur https://vercel.com/new

---

## 10. Application Mobile (Expo)

Le dossier `mobile/` contient l'application React Native (Expo) qui partage la même API Supabase.

```bash
cd mobile
npm install
npx expo start
```

### Publication App Store / Google Play

```bash
# Build iOS
npx eas build --platform ios

# Build Android
npx eas build --platform android

# Submit
npx eas submit
```

Nécessite :
- Compte Apple Developer (99€/an) pour App Store
- Compte Google Play Developer (25€ unique) pour Play Store

---

## Structure du projet

```
running-trail-empire/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Login, Signup
│   │   ├── api/                # API Routes
│   │   │   ├── ai/             # Coach IA, Plans
│   │   │   ├── stripe/         # Checkout, Webhook
│   │   │   ├── terra/          # Sync montres
│   │   │   └── races/          # Seed data
│   │   ├── dashboard/          # App principale
│   │   │   ├── races/          # Hub Courses France
│   │   │   ├── trail/          # Trail Builder Mapbox
│   │   │   ├── health/         # Physio + Guardian + Nutrition
│   │   │   ├── shop/           # Shopping Hub
│   │   │   ├── leagues/        # Gamification
│   │   │   ├── coaching/       # Chat IA
│   │   │   └── profile/        # Paramètres
│   │   ├── onboarding/         # Setup profil
│   │   └── pricing/            # Page tarifs Stripe
│   ├── components/             # Composants React
│   ├── lib/                    # Supabase, Stripe, utils
│   ├── types/                  # TypeScript types complets
│   └── i18n/                   # 6 langues (fr,en,de,es,it,pt)
├── supabase/
│   └── migrations/             # Schema SQL + RLS
├── public/
│   └── manifest.json           # PWA config
└── messages/                   # Traductions i18n
```

---

## Architecture Modules

| Module | Fichiers clés |
|--------|--------------|
| Dashboard Bento | `components/dashboard/BentoDashboard.tsx` |
| Hub Courses | `components/races/RacesHub.tsx` |
| Trail Builder | `components/trail/TrailBuilder.tsx` |
| Santé/Guardian | `components/health/HealthCenter.tsx` |
| Shopping Hub | `components/shop/ShoppingHub.tsx` |
| Gamification | `components/gamification/LeaguesHub.tsx` |
| Coaching IA | `app/dashboard/coaching/page.tsx` |
| Plan IA | `app/api/ai/training-plan/route.ts` |
| Stripe | `app/api/stripe/checkout/route.ts` |
| Terra/Wearables | `app/api/terra/webhook/route.ts` |

---

## Fonctionnalités à développer ensuite

- [ ] Ghost Runner (tracking live GPS + coaching vocal)
- [ ] Posture Lab (analyse caméra via TensorFlow.js)
- [ ] Comparateur prix live (web scraping / partenaires API)
- [ ] Life Stress Sync (Google/Outlook API)
- [ ] Notifications push (web push + mobile)
- [ ] Export PDF plan d'entraînement
- [ ] Analyse vocale post-course (Whisper API)
