"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export async function createAccount(params: {
  wallet_id: string;
  name: string;
  initial_balance: number;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      wallet_id: params.wallet_id,
      name: params.name,
      initial_balance: params.initial_balance,
      current_balance: params.initial_balance,
      created_by: user.id,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await logActivity(supabase, {
    action: "account_create",
    entity_type: "account",
    entity_id: data?.id ?? undefined,
    wallet_id: params.wallet_id,
    payload: { name: params.name, initial_balance: params.initial_balance },
  });
  return {};
}

export async function updateAccount(
  id: string,
  params: {
    name?: string;
    initial_balance?: number;
    is_active?: boolean;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("accounts")
    .select("wallet_id, name, initial_balance, current_balance")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Account not found" };

  const updates: Record<string, unknown> = {};
  const payload: Record<string, { old?: unknown; new: unknown }> = {};

  if (params.name !== undefined) {
    updates.name = params.name;
    payload.name = { old: existing.name, new: params.name };
  }
  if (params.is_active !== undefined) {
    updates.is_active = params.is_active;
    // we don't have old is_active in existing; we could fetch it
    payload.is_active = { new: params.is_active };
  }
  if (params.initial_balance !== undefined) {
    const oldInit = Number(existing.initial_balance);
    const newInit = params.initial_balance;
    const delta = newInit - oldInit;
    updates.initial_balance = newInit;
    updates.current_balance = Number(existing.current_balance) + delta;
    payload.initial_balance = { old: oldInit, new: newInit };
  }

  if (Object.keys(updates).length === 0) return {};

  const { error: err } = await supabase.from("accounts").update(updates).eq("id", id);
  if (err) return { error: err.message };

  await logActivity(supabase, {
    action: "account_edit",
    entity_type: "account",
    entity_id: id,
    wallet_id: existing.wallet_id,
    payload: { changes: payload },
  });
  return {};
}
