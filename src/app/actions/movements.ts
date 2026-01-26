"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

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
    .select("id, name")
    .eq("wallet_id", walletId)
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((a) => ({ id: a.id, name: a.name }));
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

export type MovementByAccountRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
};

export async function getMovementsByAccount(
  walletId: string,
  accountId: string,
  limit?: number
): Promise<MovementByAccountRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select(
      "id, date, type, amount, description, account_from_id, account_to_id, " +
        "category:categories(name, parent_id)"
    )
    .eq("wallet_id", walletId)
    .or(`account_from_id.eq.${accountId},account_to_id.eq.${accountId}`)
    .order("date", { ascending: false });

  if (limit != null && limit > 0) {
    q = q.limit(limit);
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
    category: CatRow | null;
  };
  const rows = (tx ?? []) as unknown as TxRow[];

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
      accountFromName,
      accountToName,
    };
  });
}

export async function getRecentMovementsByCategory(
  walletId: string,
  movementType: "income" | "expense" | "transfer",
  categoryId: string,
  subcategoryId?: string | null
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
    .eq("type", movementType)
    .in("category_id", categoryIds)
    .order("date", { ascending: false })
    .limit(5);
  return (data ?? []).map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
  }));
}

export async function createMovement(params: {
  wallet_id: string;
  type: "income" | "expense" | "transfer";
  category_id: string;
  date: string;
  amount: number;
  account_from_id?: string | null;
  account_to_id?: string | null;
  description?: string | null;
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
  } = params;

  if (type === "income" && !account_to_id)
    return { error: "Account to receive is required for income" };
  if (type === "expense" && !account_from_id)
    return { error: "Account to pay from is required for expense" };
  if (type === "transfer" && (!account_from_id || !account_to_id))
    return { error: "From and to accounts are required for transfer" };
  if (amount <= 0) return { error: "Amount must be positive" };
  const desc = description == null ? "" : String(description).trim();
  if (!desc) return { error: "Description is required" };

  const { data: t, error: insertErr } = await supabase
    .from("transactions")
    .insert({
      wallet_id,
      type,
      category_id,
      date,
      amount,
      account_from_id,
      account_to_id,
      description: desc,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!t) return { error: "Insert failed" };

  if (type === "income") {
    const e = await updateBalance(supabase, account_to_id!, amount);
    if (e.error) return e;
  } else if (type === "expense") {
    const e = await updateBalance(supabase, account_from_id!, -amount);
    if (e.error) return e;
  } else {
    let e = await updateBalance(supabase, account_from_id!, -amount);
    if (e.error) return e;
    e = await updateBalance(supabase, account_to_id!, amount);
    if (e.error) return e;
  }

  await logActivity(supabase, {
    action: "transaction_create",
    entity_type: "transaction",
    entity_id: t.id,
    wallet_id,
    payload: { amount, type, date, category_id, account_from_id, account_to_id },
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

export async function getMovement(id: string) {
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
  };
}

export async function updateMovement(
  id: string,
  params: {
    type: "income" | "expense" | "transfer";
    category_id: string;
    date: string;
    amount: number;
    account_from_id?: string | null;
    account_to_id?: string | null;
    description?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: old } = await supabase
    .from("transactions")
    .select("wallet_id, type, amount, account_from_id, account_to_id")
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
  } = params;

  if (type === "income" && !account_to_id)
    return { error: "Account to receive is required for income" };
  if (type === "expense" && !account_from_id)
    return { error: "Account to pay from is required for expense" };
  if (type === "transfer" && (!account_from_id || !account_to_id))
    return { error: "From and to accounts are required for transfer" };
  if (amount <= 0) return { error: "Amount must be positive" };
  const desc = description == null ? "" : String(description).trim();
  if (!desc) return { error: "Description is required" };

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

  const { error: upErr } = await supabase
    .from("transactions")
    .update({
      type,
      category_id,
      date,
      amount,
      account_from_id,
      account_to_id,
      description: desc,
    })
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

export async function deleteMovement(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("transactions")
    .select("wallet_id, type, amount, account_from_id, account_to_id")
    .eq("id", id)
    .single();
  if (!t) return { error: "Transaction not found" };

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

  const { error: delErr } = await supabase.from("transactions").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  await logActivity(supabase, {
    action: "transaction_delete",
    entity_type: "transaction",
    entity_id: id,
    wallet_id: t.wallet_id,
    payload: { amount: Number(t.amount), type: t.type },
  });
  return {};
}
