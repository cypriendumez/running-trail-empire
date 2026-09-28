-- ─────────────────────────────────────────────────────────────────────────────
--  032 — COURSES : inscription directe, classements, heure de départ, date sûre
--
--  Demandé par Cyprien le 28/09/2026 : « les liens pour s'inscrire directement, et voir
--  les classements après les courses juste en cliquant ». Relevé le même jour : 78 % des
--  liens « S'inscrire » menaient à une page de CALENDRIER (finishers.com), pas au site de
--  l'organisateur ; aucune colonne ne pouvait porter un lien de classement ni l'heure
--  de départ d'une course.
--
--  Ces colonnes sont remplies par `scripts/finishers-appliquer.ts` à partir des fiches
--  finishers.com (site officiel, lien d'inscription, page de résultats et lien du
--  classement complet chez le chronométreur, heure, statut de la date). Toutes
--  facultatives : une course sans ces informations s'affiche comme avant.
--
--  ⚠️ PAS DE DROP, pas même « if exists » (l'éditeur Supabase le signale comme
--  destructif et un test du projet l'interdit). Rejouer ce fichier ne fait rien.
-- ─────────────────────────────────────────────────────────────────────────────

-- Site de l'organisateur, et lien d'inscription DIRECT quand la source le donne.
alter table public.races add column if not exists site_officiel text;
alter table public.races add column if not exists inscription_url text;

-- Classement complet (chronométreur) quand il est connu, sinon la page de résultats.
alter table public.races add column if not exists resultats_url text;
-- Année de l'édition à laquelle ces résultats se rapportent (« Classement 2026 »).
alter table public.races add column if not exists resultats_annee integer;

-- Heure de départ « HH:MM », quand la source la publie.
alter table public.races add column if not exists heure_depart text;

-- La date vient-elle d'une édition CONFIRMÉE par l'organisateur ? Faux = date estimée
-- par la source (affichée « à confirmer ») ; null = inconnu (lignes antérieures).
alter table public.races add column if not exists date_confirmee boolean;

-- Identifiant du FORMAT chez la source : il rend les mises à jour exactes (un format se
-- retrouve par son identifiant, plus par sa distance approchée).
alter table public.races add column if not exists source_id text;
alter table public.races add column if not exists source_maj_at timestamptz;

create index if not exists races_source_id_idx on public.races (source_id);
