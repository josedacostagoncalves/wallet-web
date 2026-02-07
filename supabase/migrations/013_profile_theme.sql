-- Add theme preference to profiles. Values: 'light', 'dark', 'system' (default).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';
