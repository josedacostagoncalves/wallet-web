"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import {
  nextRunDate,
  type RecurrenceType,
  workDayDateInMonth,
} from "@/lib/recurrence";

async function getWalletShareFlags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  walletId: string
): Promise<{ isSplitOnly: boolean }> {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("shared_option, split_type")
    .eq("id", walletId)
    .single();

  let sharedOption = wallet?.shared_option ?? null;
  if (typeof sharedOption === "string") {
    const normalized = sharedOption.trim().toLowerCase();
    if (normalized === "control") sharedOption = "track";
    else if (normalized === "split_equal") sharedOption = "split";
    else if (normalized === "split_income") sharedOption = "track_and_split";
    else sharedOption = normalized;
  }

  const hasSplitType = !!wallet?.split_type;
  const isSplitOnly = sharedOption === "split" || (!sharedOption && hasSplitType);
  return { isSplitOnly };
}

async function updateBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  delta: number
): Promise<{ error?: string }> {
  const { data: acc } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", accountId)
    .single();
  if (!acc) return { error: "Account not found" };
  const next = Number(acc.current_balance) + delta;
  const { error: up } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId);
  return up ? { error: up.message } : {};
}

export async function getAccounts(walletId: string | null) {
  if (!walletId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, current_balance")
    .eq("wallet_id", walletId)
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    current_balance: Number(a.current_balance),
  }));
}

export async function getCategories(
  walletId: string | null,
  type: "income" | "expense" | "transfer"
) {
  if (!walletId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("wallet_id", walletId)
    .eq("type", type)
    .is("parent_id", null)
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export async function getSubcategories(parentId: string | null) {
  if (!parentId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export type RecentSimilarRow = {
  id: string;
  date: string;
  description: string | null;
  amount: number;
};

export type TransactionByAccountRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromId: string | null;
  accountFromName: string;
  accountToId: string | null;
  accountToName: string;
  balanceAfter: number;
  status: "confirmed" | "pending";
  holdBalance?: boolean;
};

export type AccountBalancePoint = {
  date: string;
  balance: number;
};

export async function getTransactionsByAccount(
  walletId: string,
  accountId: string,
  options?: { limit?: number; fromDate?: string; toDate?: string }
): Promise<TransactionByAccountRow[]> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("initial_balance")
    .eq("id", accountId)
    .single();

  let q = supabase
    .from("transactions")
    .select(
      "id, date, type, amount, description, account_from_id, account_to_id, status, hold_balance, " +
      "category:categories(name, parent_id)"
    )
    .eq("wallet_id", walletId)
    .or(`account_from_id.eq.${accountId},account_to_id.eq.${accountId}`)
    .order("date", { ascending: false });

  if (options?.fromDate) {
    q = q.gte("date", options.fromDate);
  }
  if (options?.toDate) {
    q = q.lte("date", options.toDate);
  }
  if (options?.limit != null && options.limit > 0) {
    q = q.limit(options.limit);
  }
  const { data: tx } = await q;

  const [
    { data: accs },
    { data: cats },
  ] = await Promise.all([
    supabase.from("accounts").select("id, name").eq("wallet_id", walletId),
    supabase.from("categories").select("id, name, parent_id").eq("wallet_id", walletId),
  ]);
  const accountsMap = new Map((accs ?? []).map((a) => [a.id, a.name]));
  const catIdToName = new Map((cats ?? []).map((c) => [c.id, c.name]));

  type CatRow = { name: string; parent_id: string | null };
  type TxRow = {
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string | null;
    account_from_id: string | null;
    account_to_id: string | null;
    status?: string | null;
    hold_balance?: boolean;
    category: CatRow | null;
  };
  const rows = (tx ?? []) as unknown as TxRow[];

  const balanceQuery = supabase
    .from("transactions")
    .select("id, date, amount, account_from_id, account_to_id, status, hold_balance")
    .eq("wallet_id", walletId)
    .or(`account_from_id.eq.${accountId},account_to_id.eq.${accountId}`)
    .order("date", { ascending: true });

  const { data: balanceTx } = options?.toDate
    ? await balanceQuery.lte("date", options.toDate)
    : await balanceQuery;

  type BalanceTxRow = {
    id: string;
    date: string;
    amount: number;
    account_from_id: string | null;
    account_to_id: string | null;
    status?: string | null;
    hold_balance?: boolean;
  };
  const balanceRows = (balanceTx ?? []) as unknown as BalanceTxRow[];

  const balanceAfterById = new Map<string, number>();
  let runningBalance = Number(account?.initial_balance ?? 0);
  for (const t of balanceRows) {
    const statusConfirmed = t.status === "confirmed" || !t.status;
    const includePending = t.status === "pending" && !t.hold_balance;
    const amount = Math.abs(Number(t.amount));

    if (statusConfirmed || includePending) {
      if (t.account_from_id === accountId) runningBalance -= amount;
      if (t.account_to_id === accountId) runningBalance += amount;
    }

    balanceAfterById.set(t.id, runningBalance);
  }

  return rows.map((t) => {
    const c = t.category;
    const categoryLabel = c?.parent_id
      ? (catIdToName.get(c.parent_id) ?? "—")
      : (c?.name ?? "—");
    const subcategoryLabel = c?.parent_id ? (c?.name ?? "—") : "—";
    const accountFromName = t.account_from_id
      ? (accountsMap.get(t.account_from_id) ?? "—")
      : "—";
    const accountToName = t.account_to_id
      ? (accountsMap.get(t.account_to_id) ?? "—")
      : "—";
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      categoryLabel,
      subcategoryLabel,
      accountFromId: t.account_from_id,
      accountFromName,
      accountToId: t.account_to_id,
      accountToName,
      balanceAfter: balanceAfterById.get(t.id) ?? runningBalance,
      status: (t.status === "pending" ? "pending" : "confirmed") as "confirmed" | "pending",
      holdBalance: !!t.hold_balance,
    };
  });
}

export async function getAccountBalanceSeries(
  walletId: string,
  accountId: string,
  fromDate?: string | null,
  toDate?: string | null
): Promise<{ series: AccountBalancePoint[]; oldestDate: string | null }> {
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, initial_balance")
    .eq("id", accountId)
    .single();

  const q = supabase
    .from("transactions")
    .select(
      "id, date, type, amount, account_from_id, account_to_id, status, hold_balance"
    )
    .eq("wallet_id", walletId)
    .or(`account_from_id.eq.${accountId},account_to_id.eq.${accountId}`)
    .order("date", { ascending: true });

  const { data: tx } = toDate ? await q.lte("date", toDate) : await q;

  type TxRow = {
    id: string;
    date: string;
    type: string;
    amount: number;
    account_from_id: string | null;
    account_to_id: string | null;
    status?: string | null;
    hold_balance?: boolean;
  };

  const rows = (tx ?? []) as unknown as TxRow[];
  if (!rows.length) return { series: [], oldestDate: null };

  const oldestDate = rows[0].date.slice(0, 10);
  const startDate = (fromDate ?? oldestDate).slice(0, 10);
  const endDate = (toDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

  if (startDate > endDate) return { series: [], oldestDate };

  let balance = Number(account?.initial_balance ?? 0);
  let balanceAtStart = balance;
  const dayBalance = new Map<string, number>();

  for (const t of rows) {
    const dateKey = t.date.slice(0, 10);
    if (dateKey > endDate) break;
    const statusConfirmed = t.status === "confirmed" || !t.status;
    const includePending = t.status === "pending" && !t.hold_balance;
    if (!statusConfirmed && !includePending) continue;

    const amount = Math.abs(Number(t.amount));
    if (t.account_from_id === accountId) balance -= amount;
    if (t.account_to_id === accountId) balance += amount;

    if (dateKey < startDate) {
      balanceAtStart = balance;
      continue;
    }
    dayBalance.set(dateKey, balance);
  }

  const series: AccountBalancePoint[] = [];
  let cursor = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  let currentBalance = balanceAtStart;

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    if (dayBalance.has(key)) currentBalance = dayBalance.get(key)!;
    series.push({ date: key, balance: currentBalance });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { series, oldestDate };
}

export async function getRecentTransactionsByType(
  walletId: string,
  transactionType: "income" | "expense" | "transfer",
  limit = 20
): Promise<RecentSimilarRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, date, description, amount")
    .eq("wallet_id", walletId)
    .eq("type", transactionType)
    .order("date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
  }));
}

export async function getRecentTransactionsByCategory(
  walletId: string,
  transactionType: "income" | "expense" | "transfer",
  categoryId: string,
  subcategoryId?: string | null,
  limit = 20
): Promise<RecentSimilarRow[]> {
  const supabase = await createClient();
  let categoryIds: string[];
  if (subcategoryId) {
    categoryIds = [subcategoryId];
  } else {
    const { data: subs } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", categoryId);
    categoryIds = [categoryId, ...(subs ?? []).map((s) => s.id)];
  }
  const { data } = await supabase
    .from("transactions")
    .select("id, date, description, amount")
    .eq("wallet_id", walletId)
    .eq("type", transactionType)
    .in("category_id", categoryIds)
    .order("date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
  }));
}

export async function createTransaction(params: {
  wallet_id: string;
  type: "income" | "expense" | "transfer";
  category_id: string;
  date: string;
  amount: number;
  account_from_id?: string | null;
  account_to_id?: string | null;
  description?: string | null;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  interval_months?: number | null;
  interval_days?: number | null;
  work_day_index?: number | null;
  end_date?: string | null;
  weekday?: number | null;
  day_of_month?: number | null;
  status?: "confirmed" | "pending";
  hold_balance?: boolean;
  paid_by_member_id?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const {
    wallet_id,
    type,
    category_id,
    date,
    amount,
    account_from_id = null,
    account_to_id = null,
    description = null,
    is_recurring = false,
    recurrence_type = "monthly",
    interval_months = null,
    interval_days = null,
    work_day_index = null,
    end_date = null,
    weekday = null,
    day_of_month = null,
    status = "confirmed",
    hold_balance = false,
    paid_by_member_id = null,
  } = params;

  const normalizedAccountFromId = account_from_id && account_from_id.trim() ? account_from_id : null;
  const normalizedAccountToId = account_to_id && account_to_id.trim() ? account_to_id : null;

  const { isSplitOnly } = await getWalletShareFlags(supabase, wallet_id);
  if (!isSplitOnly && type === "income" && !normalizedAccountToId)
    return { error: "Account to receive is required for income" };
  if (!isSplitOnly && type === "expense" && !normalizedAccountFromId)
    return { error: "Account to pay from is required for expense" };
  if (type === "transfer" && (!normalizedAccountFromId || !normalizedAccountToId))
    return { error: "From and to accounts are required for transfer" };
  if (amount <= 0) return { error: "Amount must be positive" };
  const desc = description == null ? "" : String(description).trim();
  if (!desc) return { error: "Description is required" };
  if (is_recurring && recurrence_type === "interval_months" && (interval_months == null || interval_months < 1))
    return { error: "Interval months is required for 'every X months'" };
  if (is_recurring && recurrence_type === "interval_days" && (interval_days == null || interval_days < 1))
    return { error: "Interval days is required for 'every X days'" };
  const isWorkDay =
    recurrence_type === "monthly_nth_work_day" ||
    recurrence_type === "monthly_nth_last_work_day";
  if (is_recurring && isWorkDay && (work_day_index == null || work_day_index < 1 || work_day_index > 31))
    return { error: "Work day index (1–31) is required for work day recurrence" };

  let ruleId: string | null = null;
  if (is_recurring) {
    const next = nextRunDate(
      date,
      recurrence_type,
      recurrence_type === "interval_months" ? (interval_months ?? 1) : null,
      isWorkDay ? (work_day_index ?? 1) : null,
      recurrence_type === "interval_days" ? (interval_days ?? 1) : null
    );
    const { data: rule, error: ruleErr } = await supabase
      .from("recurring_rules")
      .insert({
        wallet_id,
        created_by: user.id,
        type,
        category_id,
        amount,
        account_from_id: normalizedAccountFromId,
        account_to_id: normalizedAccountToId,
        description: desc,
        recurrence_type,
        interval_months: recurrence_type === "interval_months" ? interval_months : null,
        interval_days: recurrence_type === "interval_days" ? interval_days : null,
        work_day_index: isWorkDay ? (work_day_index ?? 1) : null,
        anchor_date: date,
        next_run_date: next,
        is_active: true,
        end_date: end_date || null,
        weekday: weekday ?? null,
        day_of_month: day_of_month ?? null,
      })
      .select("id")
      .single();
    if (ruleErr) return { error: ruleErr.message };
    if (!rule) return { error: "Failed to create recurring rule" };
    ruleId = rule.id;
  }

  // hold_balance is only meaningful for pending transactions.
  // For confirmed transactions, balances are always updated.
  const effectiveHold = status === "pending" ? hold_balance : false;

  const { data: t, error: insertErr } = await supabase
    .from("transactions")
    .insert({
      wallet_id,
      type,
      category_id,
      date,
      amount,
      account_from_id: normalizedAccountFromId,
      account_to_id: normalizedAccountToId,
      description: desc,
      created_by: user.id,
      status,
      recurring_rule_id: ruleId,
      hold_balance: effectiveHold,
      paid_by_member_id,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!t) return { error: "Insert failed" };

  // Update balances if confirmed, or if pending but NOT holding balance
  const shouldUpdateBalance =
    !isSplitOnly && (status === "confirmed" || (status === "pending" && !effectiveHold));
  if (shouldUpdateBalance) {
    if (type === "income") {
      const e = await updateBalance(supabase, normalizedAccountToId!, amount);
      if (e.error) return e;
    } else if (type === "expense") {
      const e = await updateBalance(supabase, normalizedAccountFromId!, -amount);
      if (e.error) return e;
    } else {
      let e = await updateBalance(supabase, normalizedAccountFromId!, -amount);
      if (e.error) return e;
      e = await updateBalance(supabase, normalizedAccountToId!, amount);
      if (e.error) return e;
    }
  }

  await logActivity(supabase, {
    action: "transaction_create",
    entity_type: "transaction",
    entity_id: t.id,
    wallet_id,
    payload: { amount, type, date, category_id, account_from_id, account_to_id, is_recurring: !!ruleId, status },
  });

  return {};
}

function undoEffect(
  type: string,
  amount: number,
  from: string | null,
  to: string | null
): { id: string; delta: number }[] {
  const d: { id: string; delta: number }[] = [];
  if (type === "income" && to) d.push({ id: to, delta: -amount });
  if (type === "expense" && from) d.push({ id: from, delta: amount });
  if (type === "transfer" && from) d.push({ id: from, delta: amount });
  if (type === "transfer" && to) d.push({ id: to, delta: -amount });
  return d;
}

function applyEffect(
  type: string,
  amount: number,
  from: string | null,
  to: string | null
): { id: string; delta: number }[] {
  const d: { id: string; delta: number }[] = [];
  if (type === "income" && to) d.push({ id: to, delta: amount });
  if (type === "expense" && from) d.push({ id: from, delta: -amount });
  if (type === "transfer" && from) d.push({ id: from, delta: -amount });
  if (type === "transfer" && to) d.push({ id: to, delta: amount });
  return d;
}

export async function getTransaction(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(id, name, type, parent_id)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const c = data.category as { id: string; name: string; type: string; parent_id: string | null } | null;
  return {
    id: data.id,
    wallet_id: data.wallet_id,
    type: data.type,
    category_id: data.category_id,
    category_name: c?.name,
    category_type: c?.type,
    parent_id: c?.parent_id ?? null,
    date: data.date,
    amount: Number(data.amount),
    account_from_id: data.account_from_id,
    account_to_id: data.account_to_id,
    description: data.description,
    status: (data.status === "pending" ? "pending" : "confirmed") as "confirmed" | "pending",
    hold_balance: !!data.hold_balance,
  };
}

export async function updateTransaction(
  id: string,
  params: {
    type: "income" | "expense" | "transfer";
    category_id: string;
    date: string;
    amount: number;
    account_from_id?: string | null;
    account_to_id?: string | null;
    description?: string | null;
    is_recurring?: boolean;
    recurrence_type?: RecurrenceType;
    interval_months?: number | null;
    interval_days?: number | null;
    work_day_index?: number | null;
    paid_by_member_id?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: old } = await supabase
    .from("transactions")
    .select("wallet_id, type, amount, account_from_id, account_to_id, status, recurring_rule_id")
    .eq("id", id)
    .single();
  if (!old) return { error: "Transaction not found" };

  const {
    type,
    category_id,
    date,
    amount,
    account_from_id = null,
    account_to_id = null,
    description = null,
    is_recurring = false,
    recurrence_type = "monthly",
    interval_months = null,
    interval_days = null,
    work_day_index = null,
    paid_by_member_id = null,
  } = params;

  const normalizedAccountFromId = account_from_id && account_from_id.trim() ? account_from_id : null;
  const normalizedAccountToId = account_to_id && account_to_id.trim() ? account_to_id : null;

  const { isSplitOnly: isSplitOnlyForUpdate } = await getWalletShareFlags(
    supabase,
    old.wallet_id
  );
  if (!isSplitOnlyForUpdate && type === "income" && !normalizedAccountToId)
    return { error: "Account to receive is required for income" };
  if (!isSplitOnlyForUpdate && type === "expense" && !normalizedAccountFromId)
    return { error: "Account to pay from is required for expense" };
  if (type === "transfer" && (!normalizedAccountFromId || !normalizedAccountToId))
    return { error: "From and to accounts are required for transfer" };
  if (amount <= 0) return { error: "Amount must be positive" };
  const desc = description == null ? "" : String(description).trim();
  if (!desc) return { error: "Description is required" };

  const isPending = old.status === "pending";
  if (isPending) {
    const updatePayload = {
      type,
      category_id,
      date,
      amount,
      account_from_id: normalizedAccountFromId,
      account_to_id: normalizedAccountToId,
      description: desc,
      paid_by_member_id,
    };
    const { error: upErr } = await supabase
      .from("transactions")
      .update(updatePayload)
      .eq("id", id);
    if (upErr) return { error: upErr.message };
    await logActivity(supabase, {
      action: "transaction_edit",
      entity_type: "transaction",
      entity_id: id,
      wallet_id: old.wallet_id,
      payload: { was_pending: true, changes: { type, amount, account_from_id, account_to_id } },
    });
    return {};
  }

  if (is_recurring && recurrence_type === "interval_months" && (interval_months == null || interval_months < 1))
    return { error: "Interval months is required for 'every X months'" };
  if (is_recurring && recurrence_type === "interval_days" && (interval_days == null || interval_days < 1))
    return { error: "Interval days is required for 'every X days'" };
  const isWorkDay =
    is_recurring &&
    (recurrence_type === "monthly_nth_work_day" ||
      recurrence_type === "monthly_nth_last_work_day");
  if (isWorkDay && (work_day_index == null || work_day_index < 1 || work_day_index > 31))
    return { error: "Work day index (1–31) is required for work day recurrence" };

  let ruleId: string | null = null;
  if (is_recurring && !old.recurring_rule_id) {
    const next = nextRunDate(
      date,
      recurrence_type,
      recurrence_type === "interval_months" ? (interval_months ?? 1) : null,
      isWorkDay ? (work_day_index ?? 1) : null,
      recurrence_type === "interval_days" ? (interval_days ?? 1) : null
    );
    const { data: rule, error: ruleErr } = await supabase
      .from("recurring_rules")
      .insert({
        wallet_id: old.wallet_id,
        created_by: user.id,
        type,
        category_id,
        amount,
        account_from_id,
        account_to_id,
        description: desc,
        recurrence_type,
        interval_months: recurrence_type === "interval_months" ? interval_months : null,
        interval_days: recurrence_type === "interval_days" ? interval_days : null,
        work_day_index: isWorkDay ? (work_day_index ?? 1) : null,
        anchor_date: date,
        next_run_date: next,
        is_active: true,
      })
      .select("id")
      .single();
    if (ruleErr) return { error: ruleErr.message };
    if (!rule) return { error: "Failed to create recurring rule" };
    ruleId = rule.id;
  }

  const undo = undoEffect(
    old.type,
    Number(old.amount),
    old.account_from_id,
    old.account_to_id
  );
  for (const { id: aid, delta } of undo) {
    const e = await updateBalance(supabase, aid, delta);
    if (e.error) return e;
  }

  const apply = applyEffect(type, amount, account_from_id, account_to_id);
  for (const { id: aid, delta } of apply) {
    const e = await updateBalance(supabase, aid, delta);
    if (e.error) return e;
  }

  const updatePayload: {
    type: string;
    category_id: string;
    date: string;
    amount: number;
    account_from_id: string | null;
    account_to_id: string | null;
    description: string;
    recurring_rule_id?: string | null;
    paid_by_member_id: string | null;
  } = {
    type,
    category_id,
    date,
    amount,
    account_from_id,
    account_to_id,
    description: desc,
    paid_by_member_id,
  };
  if (ruleId != null) updatePayload.recurring_rule_id = ruleId;

  const { error: upErr } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", id);

  if (upErr) return { error: upErr.message };

  await logActivity(supabase, {
    action: "transaction_edit",
    entity_type: "transaction",
    entity_id: id,
    wallet_id: old.wallet_id,
    payload: {
      changes: {
        type: { old: old.type, new: type },
        amount: { old: Number(old.amount), new: amount },
        account_from_id: { old: old.account_from_id, new: account_from_id },
        account_to_id: { old: old.account_to_id, new: account_to_id },
      },
    },
  });
  return {};
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("transactions")
    .select("wallet_id, type, amount, account_from_id, account_to_id, status, hold_balance")
    .eq("id", id)
    .single();
  if (!t) return { error: "Transaction not found" };

  // Reverse balance if: confirmed (always updated), or pending with hold_balance=false (was already applied)
  const balanceWasApplied = t.status === "confirmed" || (t.status === "pending" && !t.hold_balance);
  if (balanceWasApplied) {
    const undo = undoEffect(
      t.type,
      Number(t.amount),
      t.account_from_id,
      t.account_to_id
    );
    for (const { id: aid, delta } of undo) {
      const e = await updateBalance(supabase, aid, delta);
      if (e.error) return e;
    }
  }

  const { error: delErr } = await supabase.from("transactions").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  await logActivity(supabase, {
    action: "transaction_delete",
    entity_type: "transaction",
    entity_id: id,
    wallet_id: t.wallet_id,
    payload: { amount: Number(t.amount), type: t.type, was_pending: t.status === "pending" },
  });
  return {};
}

export async function confirmTransaction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: t } = await supabase
    .from("transactions")
    .select("wallet_id, type, amount, account_from_id, account_to_id, status, hold_balance")
    .eq("id", id)
    .single();
  if (!t) return { error: "Transaction not found" };
  if (t.status !== "pending") return { error: "Transaction is not pending" };

  // Only update balances if they were held (not already applied)
  if (t.hold_balance) {
    const apply = applyEffect(
      t.type,
      Number(t.amount),
      t.account_from_id,
      t.account_to_id
    );
    for (const { id: aid, delta } of apply) {
      const e = await updateBalance(supabase, aid, delta);
      if (e.error) return e;
    }
  }

  const { error: upErr } = await supabase
    .from("transactions")
    .update({ status: "confirmed", hold_balance: false })
    .eq("id", id);
  if (upErr) return { error: upErr.message };

  await logActivity(supabase, {
    action: "transaction_confirm",
    entity_type: "transaction",
    entity_id: id,
    wallet_id: t.wallet_id,
    payload: { amount: Number(t.amount), type: t.type },
  });
  return {};
}

export async function ensureRecurringGenerated(walletId: string): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all active rules whose next_run_date is due (one pass, no infinite loop)
  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("id, wallet_id, type, category_id, amount, description, account_from_id, account_to_id, recurrence_type, interval_months, interval_days, work_day_index, anchor_date, next_run_date, end_date, weekday, day_of_month")
    .eq("wallet_id", walletId)
    .eq("is_active", true)
    .lte("next_run_date", today);
  if (!rules || rules.length === 0) return;

  for (const r of rules) {
    const isWorkDay =
      r.recurrence_type === "monthly_nth_work_day" ||
      r.recurrence_type === "monthly_nth_last_work_day";
    const storedNext = r.next_run_date as string;
    const endDate = r.end_date as string | null;
    const dayOfMonth =
      r.recurrence_type === "monthly" && r.day_of_month != null
        ? Number(r.day_of_month)
        : null;

    // Compute the actual run date (may differ for work-day rules)
    let runDate: string;
    if (isWorkDay) {
      const n = (r.work_day_index as number | null) ?? 1;
      const wdType =
        r.recurrence_type === "monthly_nth_work_day"
          ? "monthly_nth_work_day"
          : "monthly_nth_last_work_day";
      const d = new Date(storedNext + "T12:00:00Z");
      const computed = workDayDateInMonth(d.getUTCFullYear(), d.getUTCMonth(), wdType, n);
      runDate = computed ?? storedNext;
    } else {
      runDate = storedNext;
    }

    if (endDate && runDate > endDate) {
      await supabase
        .from("recurring_rules")
        .update({ is_active: false })
        .eq("id", r.id);
      continue;
    }

    // Create exactly ONE pending transaction for this recurring rule
    const { error: insErr } = await supabase.from("transactions").insert({
      wallet_id: r.wallet_id,
      type: r.type,
      category_id: r.category_id,
      date: runDate,
      amount: r.amount,
      description: r.description ?? "",
      account_from_id: r.account_from_id,
      account_to_id: r.account_to_id,
      created_by: null,
      status: "pending",
      recurring_rule_id: r.id,
      hold_balance: true,
    });
    if (insErr) continue;

    // Advance next_run_date past today so only one pending is created
    let next = nextRunDate(
      runDate,
      r.recurrence_type as RecurrenceType,
      r.recurrence_type === "interval_months" ? (r.interval_months as number) : null,
      isWorkDay ? (r.work_day_index as number | null) ?? 1 : null,
      r.recurrence_type === "interval_days" ? (r.interval_days as number) ?? 1 : null,
      null,
      dayOfMonth
    );
    // Skip past all missed dates until next_run_date is in the future
    let safetyCounter = 0;
    while (next <= today && safetyCounter < 1000) {
      if (endDate && next > endDate) break;
      next = nextRunDate(
        next,
        r.recurrence_type as RecurrenceType,
        r.recurrence_type === "interval_months" ? (r.interval_months as number) : null,
        isWorkDay ? (r.work_day_index as number | null) ?? 1 : null,
        r.recurrence_type === "interval_days" ? (r.interval_days as number) ?? 1 : null,
        null,
        dayOfMonth
      );
      safetyCounter++;
    }

    if (endDate && next > endDate) {
      await supabase
        .from("recurring_rules")
        .update({ next_run_date: next, is_active: false })
        .eq("id", r.id);
    } else {
      await supabase
        .from("recurring_rules")
        .update({ next_run_date: next })
        .eq("id", r.id);
    }
  }
}

/* ---------- Balance preview for confirm / cancel dialogs ---------- */

export type BalancePreviewRow = {
  accountName: string;
  currentBalance: number;
  afterBalance: number;
};

/**
 * Returns the affected accounts with current and projected balances
 * for confirming, cancelling (pending), or deleting (confirmed) a transaction.
 */
export async function getBalancePreview(
  transactionId: string,
  action: "confirm" | "cancel"
): Promise<BalancePreviewRow[]> {
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("transactions")
    .select("type, amount, account_from_id, account_to_id, status, hold_balance")
    .eq("id", transactionId)
    .single();
  if (!t) return [];

  const amount = Number(t.amount);
  const holdBalance = !!t.hold_balance;
  const isPending = t.status === "pending";

  // Compute the delta per account for this action
  const deltas: { id: string; delta: number }[] = [];

  if (isPending && action === "confirm" && holdBalance) {
    // Confirming a held pending transaction → apply balance changes
    if (t.type === "income" && t.account_to_id) deltas.push({ id: t.account_to_id, delta: amount });
    if (t.type === "expense" && t.account_from_id) deltas.push({ id: t.account_from_id, delta: -amount });
    if (t.type === "transfer") {
      if (t.account_from_id) deltas.push({ id: t.account_from_id, delta: -amount });
      if (t.account_to_id) deltas.push({ id: t.account_to_id, delta: amount });
    }
  } else if (isPending && action === "cancel" && !holdBalance) {
    // Cancelling a non-held pending transaction → reverse balance changes
    if (t.type === "income" && t.account_to_id) deltas.push({ id: t.account_to_id, delta: -amount });
    if (t.type === "expense" && t.account_from_id) deltas.push({ id: t.account_from_id, delta: amount });
    if (t.type === "transfer") {
      if (t.account_from_id) deltas.push({ id: t.account_from_id, delta: amount });
      if (t.account_to_id) deltas.push({ id: t.account_to_id, delta: -amount });
    }
  } else if (!isPending && action === "cancel") {
    // Deleting a confirmed transaction → reverse balance changes
    if (t.type === "income" && t.account_to_id) deltas.push({ id: t.account_to_id, delta: -amount });
    if (t.type === "expense" && t.account_from_id) deltas.push({ id: t.account_from_id, delta: amount });
    if (t.type === "transfer") {
      if (t.account_from_id) deltas.push({ id: t.account_from_id, delta: amount });
      if (t.account_to_id) deltas.push({ id: t.account_to_id, delta: -amount });
    }
  }

  // Collect all affected account IDs
  const accountIds = new Set<string>();
  if (t.account_from_id) accountIds.add(t.account_from_id);
  if (t.account_to_id) accountIds.add(t.account_to_id);
  if (accountIds.size === 0) return [];

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, current_balance")
    .in("id", Array.from(accountIds));

  if (!accounts) return [];

  const deltaMap = new Map(deltas.map((d) => [d.id, d.delta]));

  return accounts.map((a) => {
    const current = Number(a.current_balance);
    const delta = deltaMap.get(a.id) ?? 0;
    return {
      accountName: a.name,
      currentBalance: current,
      afterBalance: current + delta,
    };
  });
}
