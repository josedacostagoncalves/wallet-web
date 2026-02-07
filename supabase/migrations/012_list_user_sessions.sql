-- RPC to list current user's active sessions from auth.sessions.
-- Uses SECURITY DEFINER to read auth schema; only returns rows for the calling user.

CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  session_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id          AS session_id,
    s.created_at  AS created_at,
    s.updated_at  AS updated_at,
    s.user_agent  AS user_agent,
    s.ip::TEXT     AS ip
  FROM auth.sessions s
  WHERE s.user_id = auth.uid()
  ORDER BY s.updated_at DESC;
END;
$$;

-- RPC to delete (revoke) a specific session for the calling user.
CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM auth.sessions
  WHERE id = p_session_id
    AND user_id = auth.uid();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- RPC to revoke ALL sessions for the calling user (except the current one).
CREATE OR REPLACE FUNCTION public.revoke_all_my_sessions(p_keep_session_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_keep_session_id IS NOT NULL THEN
    DELETE FROM auth.sessions
    WHERE user_id = auth.uid()
      AND id <> p_keep_session_id;
  ELSE
    DELETE FROM auth.sessions
    WHERE user_id = auth.uid();
  END IF;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
