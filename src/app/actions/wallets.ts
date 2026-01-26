"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export async function createWallet(params: {
  name: string;
  is_shared: boolean;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: w, error: wErr } = await supabase
    .from("wallets")
    .insert({
      name: params.name,
      is_shared: params.is_shared,
      created_by: user.id,
      is_active: true,
    })
    .select("id")
    .single();

  if (wErr) return { error: wErr.message };
  if (!w) return { error: "Insert failed" };

  const { error: mErr } = await supabase.from("wallet_members").insert({
    wallet_id: w.id,
    user_id: user.id,
    role: "owner",
  });
  if (mErr) return { error: mErr.message };

  await logActivity(supabase, {
    action: "wallet_create",
    entity_type: "wallet",
    entity_id: w.id,
    wallet_id: w.id,
    payload: { name: params.name, is_shared: params.is_shared },
  });
  return {};
}

export async function updateWallet(
  id: string,
  params: { name?: string; is_shared?: boolean; is_active?: boolean }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("wallets")
    .select("id")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Wallet not found" };

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.is_shared !== undefined) updates.is_shared = params.is_shared;
  if (params.is_active !== undefined) updates.is_active = params.is_active;

  if (Object.keys(updates).length === 0) return {};

  const { error: err } = await supabase.from("wallets").update(updates).eq("id", id);
  if (err) return { error: err.message };

  await logActivity(supabase, {
    action: "wallet_edit",
    entity_type: "wallet",
    entity_id: id,
    wallet_id: id,
    payload: { changes: params },
  });
  return {};
}

export async function getWalletShareCode(walletId: string): Promise<{ shareCode?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use RPC function to get share code (bypasses RLS while checking membership)
  const { data: shareCode, error: rpcErr } = await supabase.rpc(
    "get_wallet_share_code",
    { p_wallet_id: walletId }
  );

  if (rpcErr) {
    // Convert PostgreSQL error messages to user-friendly ones
    const errorMsg = rpcErr.message || rpcErr.details || "Failed to get share code";
    if (errorMsg.includes("not authenticated")) {
      return { error: "Not authenticated" };
    }
    if (errorMsg.includes("not a member")) {
      return { error: "Not a member of this wallet" };
    }
    if (errorMsg.includes("wallet not found")) {
      return { error: "Wallet not found" };
    }
    if (errorMsg.includes("wallet is not shared")) {
      return { error: "Wallet is not shared" };
    }
    return { error: errorMsg };
  }

  if (!shareCode) {
    return { error: "Failed to generate share code" };
  }

  return { shareCode };
}

export async function joinWalletByCode(shareCode: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use RPC function to join wallet (bypasses RLS while performing checks)
  const { data: result, error: rpcErr } = await supabase.rpc(
    "join_wallet_by_code",
    { p_share_code: shareCode }
  );

  if (rpcErr) {
    // Convert PostgreSQL error messages to user-friendly ones
    const errorMsg = rpcErr.message || rpcErr.details || "Failed to join wallet";
    if (errorMsg.includes("not authenticated")) {
      return { error: "Not authenticated" };
    }
    if (errorMsg.includes("invalid share code") || errorMsg.includes("wallet not found")) {
      return { error: "Invalid share code or wallet not found" };
    }
    if (errorMsg.includes("already a member")) {
      return { error: "You are already a member of this wallet" };
    }
    return { error: errorMsg };
  }

  if (!result) {
    return { error: "Failed to join wallet" };
  }

  // Log activity
  const walletId = result.wallet_id as string;
  const walletName = result.wallet_name as string;
  await logActivity(supabase, {
    action: "wallet_join",
    entity_type: "wallet",
    entity_id: walletId,
    wallet_id: walletId,
    payload: { wallet_name: walletName, share_code: shareCode },
  });

  return {};
}

function normalizeMembers(
  rows: unknown
): Array<{ user_id: string; role: string; email?: string }> {
  const arr = Array.isArray(rows) ? rows : rows != null ? [rows] : [];
  return arr.map((r: { user_id: string; role: string; email?: string | null }) => ({
    user_id: String(r.user_id),
    role: String(r.role),
    email: r.email ?? undefined,
  }));
}

export async function getWalletMembers(walletId: string): Promise<{ members?: Array<{ user_id: string; role: string; email?: string }>; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 1. Try RPC first (joins auth.users; works when DB can read auth schema).
  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_wallet_members", {
    p_wallet_id: walletId,
  });

  if (!rpcError && rpcRows != null) {
    const members = normalizeMembers(rpcRows);
    if (members.length > 0) return { members };
    return { members: [] };
  }

  // 2. Fallback: RPC failed (e.g. auth.users not readable) — use wallet_members + optional Admin API.
  const { data: membership } = await supabase
    .from("wallet_members")
    .select("id")
    .eq("wallet_id", walletId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Not a member of this wallet" };

  const { data: list, error: listErr } = await supabase
    .from("wallet_members")
    .select("user_id, role")
    .eq("wallet_id", walletId);

  if (listErr) return { error: listErr.message };
  if (!list || list.length === 0) return { members: [] };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );
    const withEmails = await Promise.all(
      list.map(async (m) => {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          email: u?.user?.email ?? undefined,
        };
      })
    );
    return { members: withEmails };
  }

  return {
    members: list.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      email: m.user_id === user.id ? user.email ?? undefined : undefined,
    })),
  };
}
