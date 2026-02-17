-- Add language preference to profiles. Values: 'en', 'pt', 'es', 'fr' (default).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
