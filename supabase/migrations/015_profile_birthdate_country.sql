-- Add birth_date and country fields to profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;
