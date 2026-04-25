-- Add unique constraint on races (name, date) for upsert operations
ALTER TABLE races ADD CONSTRAINT races_name_date_unique UNIQUE (name, date);

-- Add city column if not exists (for imported races)
ALTER TABLE races ADD COLUMN IF NOT EXISTS city text;

-- Add is_itra_certified and itra_points if not exists (already in original schema, safety check)
ALTER TABLE races ADD COLUMN IF NOT EXISTS is_itra_certified boolean DEFAULT false;
ALTER TABLE races ADD COLUMN IF NOT EXISTS itra_points integer DEFAULT 0;
