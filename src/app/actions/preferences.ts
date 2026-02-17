"use server";

import { createClient } from "@/lib/supabase/server";

const ACCOUNT_ORDER_KEY = "account_order";
const BALANCE_DISPLAY_KEY = "balance_display_options";
const STATEMENTS_ORDER_PREFIX = "statements_order_";

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

/* ─── Accounts table display options ─── */

const ACCOUNTS_DISPLAY_KEY = "accounts_table_display";

export type AccountsTableDisplayOptions = {
  showInitialBalance: boolean;
  showPlafond: boolean;
};

const DEFAULT_ACCOUNTS_DISPLAY: AccountsTableDisplayOptions = {
  showInitialBalance: true,
  showPlafond: true,
};

export async function getAccountsTableDisplayOptions(
  walletId: string
): Promise<AccountsTableDisplayOptions> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_ACCOUNTS_DISPLAY;

  const { data } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", user.id)
    .eq("wallet_id", walletId)
    .eq("key", ACCOUNTS_DISPLAY_KEY)
    .maybeSingle();

  if (!data || typeof data.value !== "object" || data.value === null || Array.isArray(data.value))
    return DEFAULT_ACCOUNTS_DISPLAY;

  const v = data.value as Record<string, unknown>;
  return {
    showInitialBalance: typeof v.showInitialBalance === "boolean" ? v.showInitialBalance : true,
    showPlafond: typeof v.showPlafond === "boolean" ? v.showPlafond : true,
  };
}

export async function saveAccountsTableDisplayOptions(
  walletId: string,
  options: AccountsTableDisplayOptions
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: err } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        wallet_id: walletId,
        key: ACCOUNTS_DISPLAY_KEY,
        value: options,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,wallet_id,key" }
    );

  if (err) return { error: err.message };
  return {};
}

/* ---------- Statements table order ---------- */

export type StatementsTableOrderKey = "income" | "expense";

function statementsOrderKey(tableKey: StatementsTableOrderKey) {
  return `${STATEMENTS_ORDER_PREFIX}${tableKey}`;
}

export async function getStatementsTableOrder(
  walletId: string,
  tableKey: StatementsTableOrderKey
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
    .eq("key", statementsOrderKey(tableKey))
    .maybeSingle();

  if (!data) return [];

  const val = data.value;
  if (Array.isArray(val)) {
    return val.filter((x: unknown) => typeof x === "string") as string[];
  }
  return [];
}

export async function saveStatementsTableOrder(
  walletId: string,
  tableKey: StatementsTableOrderKey,
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
        key: statementsOrderKey(tableKey),
        value: order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,wallet_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}
