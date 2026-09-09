BEGIN;
ALTER TABLE member ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE member DROP CONSTRAINT IF EXISTS member_birth_year_check;
ALTER TABLE member ADD CONSTRAINT member_birth_year_check CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100);
COMMIT;
