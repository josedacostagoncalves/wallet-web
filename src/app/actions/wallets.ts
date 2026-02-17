"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export async function createWallet(params: {
  name: string;
  is_shared: boolean;
  shared_option?: string | null;
  split_type?: string | null;
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
      shared_option: params.shared_option ?? null,
      split_type: params.split_type ?? null,
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
    payload: { name: params.name, is_shared: params.is_shared, shared_option: params.shared_option ?? null, split_type: params.split_type ?? null },
  });
  return {};
}

export async function updateWallet(
  id: string,
  params: { name?: string; is_shared?: boolean; is_active?: boolean; shared_option?: string | null; split_type?: string | null }
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
  if (params.shared_option !== undefined) updates.shared_option = params.shared_option;
  if (params.split_type !== undefined) updates.split_type = params.split_type;
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

/**
 * Check whether a wallet has any accounts or transactions.
 */
export async function getWalletUsage(
  walletId: string
): Promise<{ hasData: boolean; accountCount: number; transactionCount: number; error?: string }> {
  const supabase = await createClient();
  const { count: acctCount, error: e1 } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", walletId);
  if (e1) return { hasData: false, accountCount: 0, transactionCount: 0, error: e1.message };

  const { count: txCount, error: e2 } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", walletId);
  if (e2) return { hasData: false, accountCount: 0, transactionCount: 0, error: e2.message };

  const ac = acctCount ?? 0;
  const tc = txCount ?? 0;
  return { hasData: ac > 0 || tc > 0, accountCount: ac, transactionCount: tc };
}

/**
 * Soft-delete a wallet.
 * - If the wallet has no data (accounts/transactions), hard-delete immediately.
 * - If it has data, mark deleted_at + delete_after (30 days), keeping data for undo.
 */
export async function softDeleteWallet(
  walletId: string
): Promise<{ hardDeleted?: boolean; softDeleted?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: member } = await supabase
    .from("wallet_members")
    .select("role")
    .eq("wallet_id", walletId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { error: "Not a member of this wallet" };
  if (member.role !== "owner") return { error: "Only the wallet owner can delete it" };

  const usage = await getWalletUsage(walletId);
  if (usage.error) return { error: usage.error };

  if (!usage.hasData) {
    // No data — hard delete immediately
    const { error: delErr } = await supabase
      .from("wallets")
      .delete()
      .eq("id", walletId);
    if (delErr) return { error: delErr.message };

    await logActivity(supabase, {
      action: "wallet_delete",
      entity_type: "wallet",
      entity_id: walletId,
      wallet_id: walletId,
      payload: { mode: "hard" },
    });
    return { hardDeleted: true };
  }

  // Has data — soft delete (30-day grace period)
  const now = new Date();
  const deleteAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: updErr } = await supabase
    .from("wallets")
    .update({
      deleted_at: now.toISOString(),
      delete_after: deleteAfter.toISOString(),
      is_active: false,
    })
    .eq("id", walletId);
  if (updErr) return { error: updErr.message };

  await logActivity(supabase, {
    action: "wallet_delete",
    entity_type: "wallet",
    entity_id: walletId,
    wallet_id: walletId,
    payload: { mode: "soft", delete_after: deleteAfter.toISOString() },
  });
  return { softDeleted: true };
}

/**
 * Undo a soft-delete (restore the wallet).
 */
export async function undoDeleteWallet(
  walletId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: updErr } = await supabase
    .from("wallets")
    .update({ deleted_at: null, delete_after: null, is_active: true })
    .eq("id", walletId);
  if (updErr) return { error: updErr.message };

  await logActivity(supabase, {
    action: "wallet_restore",
    entity_type: "wallet",
    entity_id: walletId,
    wallet_id: walletId,
    payload: {},
  });
  return {};
}

export type WalletDetailMember = {
  user_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type WalletDetails = {
  owner: WalletDetailMember | null;
  created_at: string;
  accountCount: number;
  transactionCount: number;
  members: WalletDetailMember[];
  is_shared: boolean;
};

/**
 * Fetch wallet details: owner, creation date, counts, and members with profile info.
 */
export async function getWalletDetails(
  walletId: string
): Promise<{ details?: WalletDetails; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch wallet info
  const { data: wallet, error: wErr } = await supabase
    .from("wallets")
    .select("created_at, created_by, is_shared")
    .eq("id", walletId)
    .single();
  if (wErr || !wallet) return { error: wErr?.message ?? "Wallet not found" };

  // Fetch members
  const { data: memberRows } = await supabase
    .from("wallet_members")
    .select("user_id, role")
    .eq("wallet_id", walletId);
  const rawMembers = memberRows ?? [];

  // Fetch profiles for all members
  const userIds = rawMembers.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["__none__"]);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const members: WalletDetailMember[] = rawMembers.map((m) => {
    const prof = profileMap.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      first_name: prof?.first_name ?? null,
      last_name: prof?.last_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
    };
  });

  const owner = members.find((m) => m.role === "owner") ?? null;

  // Count accounts and transactions
  const { count: acctCount } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", walletId);
  const { count: txCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", walletId);

  return {
    details: {
      owner,
      created_at: wallet.created_at,
      accountCount: acctCount ?? 0,
      transactionCount: txCount ?? 0,
      members,
      is_shared: wallet.is_shared,
    },
  };
}

export async function updateMemberIncome(
  walletId: string,
  memberId: string,
  incomeMonthly: number | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify user is member (owner) of this wallet
  const { data: member } = await supabase
    .from("wallet_members")
    .select("role")
    .eq("wallet_id", walletId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { error: "Not a member of this wallet" };
  if (member.role !== "owner") return { error: "Only wallet owner can update member info" };

  // Update member income
  const { error: err } = await supabase
    .from("wallet_members")
    .update({ income_monthly: incomeMonthly })
    .eq("wallet_id", walletId)
    .eq("user_id", memberId);

  if (err) return { error: err.message };

  await logActivity(supabase, {
    action: "wallet_member_update",
    entity_type: "wallet",
    entity_id: walletId,
    wallet_id: walletId,
    payload: { member_id: memberId, income_monthly: incomeMonthly },
  });

  return {};
}

export async function getWalletSettlements(
  walletId: string
): Promise<{
  settlements?: Array<{
    member_id: string;
    email: string;
    total_paid: number;
    total_share: number;
    balance: number;
  }>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify user is member of this wallet
  const { data: member } = await supabase
    .from("wallet_members")
    .select("role")
    .eq("wallet_id", walletId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { error: "Not a member of this wallet" };

  // Call the settlement calculation RPC function
  const { data, error: err } = await supabase.rpc(
    "calculate_wallet_settlement",
    { p_wallet_id: walletId }
  );

  if (err) return { error: err.message };

  return { settlements: data ?? [] };
}

export async function getWalletSplitInfo(
  walletId: string
): Promise<{
  shared_option?: string | null;
  split_type?: string | null;
  members?: Array<{
    id: string;
    user_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch wallet split_type and shared_option
  const { data: wallet, error: walletErr } = await supabase
    .from("wallets")
    .select("split_type, shared_option")
    .eq("id", walletId)
    .single();
  if (walletErr || !wallet) return { error: walletErr?.message ?? "Wallet not found" };

  // Fetch wallet members
  const { data: memberData, error: memberErr } = await supabase
    .from("wallet_members")
    .select("id, user_id, profiles(first_name, last_name, email, avatar_url)")
    .eq("wallet_id", walletId);

  const memberErrorMessage = memberErr ? memberErr.message : undefined;

  // Format members - use profile name or email as fallback
  let members = (memberData ?? []).map((m: any) => {
    const profile = m.profiles as any;
    const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
    const displayName = fullName || profile?.email || m.user_id;

    return {
      id: m.user_id,
      user_id: m.user_id,
      display_name: displayName,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });

  if (members.length === 0) {
    const { data: selfMember } = await supabase
      .from("wallet_members")
      .select("id, user_id")
      .eq("wallet_id", walletId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (selfMember) {
      const fallbackName = user.email ?? user.id;
      members = [
        {
          id: selfMember.user_id,
          user_id: selfMember.user_id,
          display_name: fallbackName,
          first_name: null,
          last_name: null,
          avatar_url: null,
        },
      ];
    }
  }

  // Infer shared_option from split_type if shared_option is not explicitly set
  let sharedOption = wallet.shared_option;
  if (typeof sharedOption === "string") {
    const normalized = sharedOption.trim().toLowerCase();
    if (normalized === "control") sharedOption = "track";
    else if (normalized === "split_equal") sharedOption = "split";
    else if (normalized === "split_income") sharedOption = "track_and_split";
    else sharedOption = normalized;
  }
  if (!sharedOption && wallet.split_type) {
    // If split_type is set but shared_option is not, infer it
    sharedOption = "split";
  }

  // If still no shared_option but wallet is shared, default to 'track'
  // This ensures non-null values for proper conditional rendering
  if (!sharedOption) {
    // Query to check if wallet is shared
    const { data: walletFull } = await supabase
      .from("wallets")
      .select("is_shared")
      .eq("id", walletId)
      .single();
    if (walletFull?.is_shared) {
      sharedOption = "track";
    }
  }

  return {
    shared_option: sharedOption,
    split_type: wallet.split_type,
    members,
    error: memberErrorMessage,
  };
}

export async function getCurrentUserId(): Promise<{ userId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  return { userId: user.id };
}
