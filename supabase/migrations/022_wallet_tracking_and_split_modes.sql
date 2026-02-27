-- Wallet mode redesign:
-- - tracking_mode: full | basic
-- - split_mode: none | split
-- - default_split_method: equally | by_income | manual
-- Keep legacy columns for compatibility (shared_option, split_type).

ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS tracking_mode TEXT;

ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS split_mode TEXT;

ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS default_split_method TEXT;

UPDATE public.wallets
SET tracking_mode = CASE
  WHEN shared_option = 'split' THEN 'basic'
  ELSE 'full'
END
WHERE tracking_mode IS NULL;

UPDATE public.wallets
SET split_mode = CASE
  WHEN is_shared = true AND shared_option IN ('split', 'track_and_split') THEN 'split'
  ELSE 'none'
END
WHERE split_mode IS NULL;

UPDATE public.wallets
SET default_split_method = CASE
  WHEN split_type = 'by_income' THEN 'by_income'
  WHEN split_mode = 'split' THEN 'equally'
  ELSE NULL
END
WHERE default_split_method IS NULL;

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_tracking_mode_check;
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_tracking_mode_check
CHECK (tracking_mode IN ('full', 'basic'));

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_split_mode_check;
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_split_mode_check
CHECK (split_mode IN ('none', 'split'));

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_default_split_method_check;
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_default_split_method_check
CHECK (
  default_split_method IS NULL
  OR default_split_method IN ('equally', 'by_income', 'manual')
);

-- Ensure split config is coherent.
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_split_consistency_check;
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_split_consistency_check
CHECK (
  (split_mode = 'none' AND default_split_method IS NULL)
  OR
  (split_mode = 'split' AND default_split_method IS NOT NULL)
);

-- Extend RPC to accept new wallet mode parameters while preserving legacy fields.
CREATE OR REPLACE FUNCTION public.create_wallet(
  p_name TEXT,
  p_is_shared BOOLEAN,
  p_shared_option TEXT,
  p_tracking_mode TEXT DEFAULT 'full',
  p_split_mode TEXT DEFAULT 'none',
  p_default_split_method TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_uid UUID := auth.uid();
  v_shared_option TEXT := p_shared_option;
  v_split_type TEXT := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Keep legacy columns populated for old application paths.
  IF p_is_shared IS NOT TRUE THEN
    v_shared_option := NULL;
    v_split_type := NULL;
  ELSE
    IF p_split_mode = 'none' THEN
      v_shared_option := 'track';
      v_split_type := NULL;
    ELSE
      IF p_tracking_mode = 'basic' THEN
        v_shared_option := 'split';
      ELSE
        v_shared_option := 'track_and_split';
      END IF;

      IF p_default_split_method = 'by_income' THEN
        v_split_type := 'by_income';
      ELSE
        v_split_type := 'equally';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.wallets (
    name,
    is_shared,
    shared_option,
    split_type,
    tracking_mode,
    split_mode,
    default_split_method,
    created_by,
    is_active
  )
  VALUES (
    p_name,
    p_is_shared,
    v_shared_option,
    v_split_type,
    p_tracking_mode,
    p_split_mode,
    CASE WHEN p_split_mode = 'split' THEN p_default_split_method ELSE NULL END,
    v_uid,
    true
  )
  RETURNING id INTO v_id;

  INSERT INTO public.wallet_members (wallet_id, user_id, role)
  VALUES (v_id, v_uid, 'owner');

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wallet(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_wallet(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO authenticated;

