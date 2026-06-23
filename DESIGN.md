# Pacevo — Design System / Brief

Langue visuelle unique pour tout le site (vitrine + app). Objectif : **minimal premium, international, instinctif** — proche de Linear / Stripe / Vercel, avec une identité sport (émeraude + Anton).

## Principes
1. **Plat & net** — pas de mesh-gradient, pas de glow néon, pas d'ombres lourdes. Surfaces blanches, bords fins, beaucoup de blanc.
2. **Typographie d'abord** — la hiérarchie se fait par la taille/le poids/l'espacement, pas par la couleur.
3. **Une seule couleur d'accent** — l'émeraude, par petites touches (liens, focus, points, métriques, plan « Pro »). Jamais de fond émeraude plein sur de grandes zones.
4. **Cohérence** — toujours réutiliser les primitives `@/components/ui/*` et le `Container`. Pas de boutons/cartes réinventés par page.
5. **Instinctif** — un seul CTA primaire par écran, libellés clairs, états (hover/focus/loading/disabled) toujours présents.
6. **Rangé, pas de trou** — chaque page publique a le même header + footer ; chaque grille remplit ses lignes (pas de cellule vide).

## Tokens

### Typographie
- `font-sans` = **Inter** (texte, titres) — chargé via next/font.
- `font-sport` / `font-display` = **Anton** (wordmark, gros labels condensés) — chargé via next/font.
- Titres : `font-bold tracking-tight`. H1 hero `text-4xl→text-[3.4rem]`, H2 section `text-3xl→4xl`, leading serré (`leading-[1.05]`).
- Corps : `text-zinc-500/600`, `leading-relaxed`.
- Sur-titre (eyebrow) : `text-[11px] font-semibold uppercase tracking-[0.18em] text-[#059669]`.

### Couleurs
- Encre : `text-zinc-900` ; secondaire `text-zinc-500/600` ; ténu `text-zinc-400`.
- Bords : `ring-1 ring-inset ring-zinc-200` / `border-zinc-200`.
- Fonds : blanc `#fff`, section alterne `bg-zinc-50`, blocs sombres `bg-zinc-950`.
- Accent émeraude : `#059669` (texte/CTA brand), `#10b981` (vif), `#34d399` (sur fond sombre), tint `#ecfdf5`. Tuile marque `#1c6e56`.

### Rayons & ombres
- Rayons : cartes `rounded-2xl`, gros blocs `rounded-3xl`, contrôles `rounded-xl`, pills `rounded-full`.
- Ombres : aucune par défaut. Lift discret au survol des cartes (`hover:shadow-[0_18px_40px_-22px_rgba(16,24,40,.25)]`). Aperçus produit : ombre douce assumée.

### Rythme
- Largeur de contenu : `Container` (`max-w-6xl px-6 sm:px-8`). Prose : `max-w-3xl`.
- Sections : `Section` (`py-20 sm:py-28`).

## Composants (à réutiliser)
- `ui/Button` → `btnClass(variant, size, className)` et `<Button>`. Variants : `primary` (zinc-900), `secondary` (blanc + ring), `ghost`, `brand` (émeraude). Tailles `sm/md/lg`.
- `ui/Card` → carte surface + ring, option `hover`.
- `ui/Badge` → pastille `neutral` / `brand` / `dark`, option `dot`.
- `ui/Container` → `Container`, `Section`, `SectionHeading` (eyebrow + titre + sous-titre).
- `brand/Wordmark` → « Pacevo » Anton, V émeraude, prop `tone`.
- `brand/Logo` → tuile officielle.
- Chrome public : `layout/SiteHeader`, `layout/SiteFooter`.

## Patterns
- **Page publique** = `SiteHeader` + contenu en `Section`/`Container` + `SiteFooter`.
- **Hero** = sur-titre + H1 (1 mot en émeraude) + sous-texte + 1 CTA primaire + 1 secondaire.
- **Grille de features** = `Card hover` avec icône en carré `bg-[#ecfdf5] text-[#059669]` + titre + desc. Toujours remplir la dernière ligne.
- **Formulaire** = label `text-sm font-medium text-zinc-700` + input `rounded-xl ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#059669]`.
- **État vide / chargement** = jamais une zone vide muette ; spinner `Loader2 animate-spin` ou message.

## Do / Don't
- ✅ Inter + Anton, accent émeraude, bords fins, blanc, un CTA primaire.
- ✅ `tabular-nums` pour les chiffres/métriques.
- ❌ mesh-gradient, glow, dégradés flashy multi-couleurs, ombres dures.
- ❌ classes émeraude incohérentes : pour l'accent figé, `[#059669]` ; sinon `emerald-600`.
- ❌ recoder un bouton/carte à la main : passer par les primitives.
