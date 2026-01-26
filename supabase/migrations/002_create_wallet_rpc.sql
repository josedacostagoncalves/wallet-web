-- RPC to create a wallet and add the creator as owner in one go.
-- Uses SECURITY DEFINER so it bypasses RLS for the inserts, while still
-- requiring auth.uid() to be set (JWT must be sent). Called from the
-- client so the session is available and auth.uid() is set.

CREATE OR REPLACE FUNCTION public.create_wallet(p_name TEXT, p_is_shared BOOLEAN)
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
  INSERT INTO public.wallets (name, is_shared, created_by, is_active)
  VALUES (p_name, p_is_shared, v_uid, true)
  RETURNING id INTO v_id;
  INSERT INTO public.wallet_members (wallet_id, user_id, role)
  VALUES (v_id, v_uid, 'owner');
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wallet(TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.create_wallet(TEXT, BOOLEAN) TO authenticated;

-- RPC to get or generate wallet share code
-- Verifies membership and returns/generates share code
CREATE OR REPLACE FUNCTION public.get_wallet_share_code(p_wallet_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_member BOOLEAN;
  v_is_shared BOOLEAN;
  v_share_code TEXT;
  v_new_code TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Check if user is a member
  SELECT EXISTS(
    SELECT 1 FROM public.wallet_members
    WHERE wallet_id = p_wallet_id AND user_id = v_uid
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'not a member of this wallet';
  END IF;

  -- Get wallet info
  SELECT is_shared, share_code INTO v_is_shared, v_share_code
  FROM public.wallets
  WHERE id = p_wallet_id;

  IF v_is_shared IS NULL THEN
    RAISE EXCEPTION 'wallet not found';
  END IF;

  IF NOT v_is_shared THEN
    RAISE EXCEPTION 'wallet is not shared';
  END IF;

  -- Generate share code if it doesn't exist
  IF v_share_code IS NULL OR v_share_code = '' THEN
    -- Generate 8-character uppercase hex code using built-in functions
    -- Use md5 hash of random value + timestamp, then take first 8 chars
    v_new_code := UPPER(SUBSTRING(
      MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT || p_wallet_id::TEXT),
      1, 8
    ));
    
    UPDATE public.wallets
    SET share_code = v_new_code
    WHERE id = p_wallet_id;
    
    RETURN v_new_code;
  END IF;

  RETURN v_share_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_share_code(UUID) TO authenticated;

-- RPC to join a wallet by share code
-- Bypasses RLS to allow non-members to find and join shared wallets
CREATE OR REPLACE FUNCTION public.join_wallet_by_code(p_share_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_wallet_id UUID;
  v_wallet_name TEXT;
  v_is_shared BOOLEAN;
  v_is_active BOOLEAN;
  v_existing_member BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Find wallet by share code (bypassing RLS)
  SELECT id, name, is_shared, is_active
  INTO v_wallet_id, v_wallet_name, v_is_shared, v_is_active
  FROM public.wallets
  WHERE share_code = UPPER(TRIM(p_share_code))
    AND is_shared = true
    AND is_active = true;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'invalid share code or wallet not found';
  END IF;

  -- Check if user is already a member
  SELECT EXISTS(
    SELECT 1 FROM public.wallet_members
    WHERE wallet_id = v_wallet_id AND user_id = v_uid
  ) INTO v_existing_member;

  IF v_existing_member THEN
    RAISE EXCEPTION 'you are already a member of this wallet';
  END IF;

  -- Add user as member
  INSERT INTO public.wallet_members (wallet_id, user_id, role)
  VALUES (v_wallet_id, v_uid, 'member');

  -- Return wallet info
  RETURN jsonb_build_object(
    'wallet_id', v_wallet_id,
    'wallet_name', v_wallet_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_wallet_by_code(TEXT) TO authenticated;

-- RPC to get wallet members with their emails
-- Returns members of a wallet that the user has access to
CREATE OR REPLACE FUNCTION public.get_wallet_members(p_wallet_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_member BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Check if user is a member
  SELECT EXISTS(
    SELECT 1 FROM public.wallet_members
    WHERE wallet_id = p_wallet_id AND user_id = v_uid
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'not a member of this wallet';
  END IF;

  -- Return members with their emails from auth.users
  -- Using SECURITY DEFINER allows us to access auth.users
  -- Direct JOIN should work with SECURITY DEFINER
  RETURN QUERY
  SELECT 
    wm.user_id,
    wm.role,
    au.email::TEXT
  FROM public.wallet_members wm
  LEFT JOIN auth.users au ON au.id = wm.user_id
  WHERE wm.wallet_id = p_wallet_id
  ORDER BY 
    CASE wm.role 
      WHEN 'owner' THEN 1 
      WHEN 'member' THEN 2 
      ELSE 3 
    END,
    COALESCE(au.email, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_members(UUID) TO authenticated;
