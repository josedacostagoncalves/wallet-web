"use server";

import { createClient } from "@/lib/supabase/server";

const ACCOUNT_ORDER_KEY = "account_order";
const BALANCE_DISPLAY_KEY = "balance_display_options";

/**
 * Load the saved account order for the current user + wallet.
 * Returns an array of account IDs in order, or [] if none saved.
 */
export async function getAccountOrder(
  walletId: string
): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", user.id)
    .eq("wallet_id", walletId)
    .eq("key", ACCOUNT_ORDER_KEY)
    .maybeSingle();

  if (!data) return [];

  const val = data.value;
  if (Array.isArray(val)) {
    return val.filter((x: unknown) => typeof x === "string") as string[];
  }
  return [];
}

/**
 * Save the account order for the current user + wallet.
 * Uses upsert on the unique (user_id, wallet_id, key) constraint.
 */
export async function saveAccountOrder(
  walletId: string,
  order: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        wallet_id: walletId,
        key: ACCOUNT_ORDER_KEY,
        value: order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,wallet_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

/* ---------- Balance display options ---------- */

export type BalanceDisplayOptions = {
  showInitialBalance: boolean;
  showPlafond: boolean;
};

const DEFAULT_DISPLAY: BalanceDisplayOptions = {
  showInitialBalance: true,
  showPlafond: true,
};

export async function getBalanceDisplayOptions(
  walletId: string
): Promise<BalanceDisplayOptions> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_DISPLAY;

  const { data } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", user.id)
    .eq("wallet_id", walletId)
    .eq("key", BALANCE_DISPLAY_KEY)
    .maybeSingle();

  if (!data || typeof data.value !== "object" || data.value === null || Array.isArray(data.value))
    return DEFAULT_DISPLAY;

  const v = data.value as Record<string, unknown>;
  return {
    showInitialBalance: typeof v.showInitialBalance === "boolean" ? v.showInitialBalance : true,
    showPlafond: typeof v.showPlafond === "boolean" ? v.showPlafond : true,
  };
}

export async function saveBalanceDisplayOptions(
  walletId: string,
  options: BalanceDisplayOptions
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        wallet_id: walletId,
        key: BALANCE_DISPLAY_KEY,
        value: options,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,wallet_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}
