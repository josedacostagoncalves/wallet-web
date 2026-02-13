-- Add shared_option column to wallets and update create_wallet RPC

ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS shared_option TEXT;

-- Backfill: convert old keys to new keys and set default for unset shared wallets
-- Do this BEFORE adding the constraint so values are valid
BEGIN;

UPDATE public.wallets
SET shared_option = 'track'
WHERE shared_option = 'control';

UPDATE public.wallets
SET shared_option = 'split'
WHERE shared_option = 'split_equal';

UPDATE public.wallets
SET shared_option = 'track_and_split'
WHERE shared_option = 'split_income';

UPDATE public.wallets
SET shared_option = 'track'
WHERE is_shared = true AND shared_option IS NULL;

COMMIT;

-- Force drop any existing constraint (ignore if doesn't exist)
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_shared_option_check CASCADE;

-- Add the correct constraint with new allowed values
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_shared_option_check CHECK (
  shared_option IS NULL OR shared_option IN ('track','split','track_and_split')
);

-- Replace create_wallet RPC to accept shared option
CREATE OR REPLACE FUNCTION public.create_wallet(p_name TEXT, p_is_shared BOOLEAN, p_shared_option TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.wallets (name, is_shared, shared_option, created_by, is_active)
  VALUES (p_name, p_is_shared, p_shared_option, v_uid, true)
  RETURNING id INTO v_id;
  INSERT INTO public.wallet_members (wallet_id, user_id, role)
  VALUES (v_id, v_uid, 'owner');
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wallet(TEXT, BOOLEAN, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_wallet(TEXT, BOOLEAN, TEXT) TO authenticated;
