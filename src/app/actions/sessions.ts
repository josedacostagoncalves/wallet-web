"use server";

/** Device/session listing and revocation for the signed-in user. */

import { createClient } from "@/lib/supabase/server";

export type SessionRow = {
  session_id: string;
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip: string | null;
};

/**
 * List all active sessions for the current user.
 * Also returns the current session ID so the UI can highlight "this device".
 */
export async function listMySessions(): Promise<{
  sessions: SessionRow[];
  currentSessionId: string | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { sessions: [], currentSessionId: null, error: "Not authenticated" };

  // Decode session_id from the JWT access token
  let currentSessionId: string | null = null;
  try {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64").toString()
    );
    currentSessionId = payload.session_id ?? null;
  } catch {
    // ignore
  }

  const { data, error } = await supabase.rpc("list_my_sessions");
  if (error) return { sessions: [], currentSessionId, error: error.message };

  const sessions: SessionRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    session_id: String(r.session_id),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    user_agent: r.user_agent != null ? String(r.user_agent) : null,
    ip: r.ip != null ? String(r.ip) : null,
  }));

  return { sessions, currentSessionId };
}

/**
 * Revoke (delete) a specific session. Returns success/failure.
 */
export async function revokeSession(
  sessionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_my_session", {
    p_session_id: sessionId,
  });
  if (error) return { error: error.message };
  return {};
}

/**
 * Revoke all sessions except the current one.
 */
export async function revokeAllOtherSessions(): Promise<{
  revoked: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { revoked: 0, error: "Not authenticated" };

  let currentSessionId: string | null = null;
  try {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64").toString()
    );
    currentSessionId = payload.session_id ?? null;
  } catch {
    // ignore
  }

  const { data, error } = await supabase.rpc("revoke_all_my_sessions", {
    p_keep_session_id: currentSessionId,
  });
  if (error) return { revoked: 0, error: error.message };
  return { revoked: typeof data === "number" ? data : 0 };
}
