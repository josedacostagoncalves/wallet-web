"use server";

import { createClient } from "@/lib/supabase/server";
import { createMovement } from "@/app/actions/movements";
import {
  type RecurrenceType,
  workDayDateInMonth,
} from "@/lib/recurrence";

export type RecurringRuleRow = {
  id: string;
  wallet_id: string;
  type: "income" | "expense" | "transfer";
  category_id: string;
  amount: number;
  description: string;
  account_from_id: string | null;
  account_to_id: string | null;
  recurrence_type: string;
  interval_months: number | null;
  interval_days: number | null;
  work_day_index: number | null;
  anchor_date: string;
  next_run_date: string;
  is_active: boolean;
};

export async function getRecurringRule(
  id: string
): Promise<RecurringRuleRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_rules")
    .select(
      "id, wallet_id, type, category_id, amount, description, account_from_id, account_to_id, recurrence_type, interval_months, interval_days, work_day_index, anchor_date, next_run_date, is_active"
    )
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    wallet_id: data.wallet_id,
    type: data.type as "income" | "expense" | "transfer",
    category_id: data.category_id,
    amount: Number(data.amount),
    description: String(data.description ?? ""),
    account_from_id: data.account_from_id ?? null,
    account_to_id: data.account_to_id ?? null,
    recurrence_type: String(data.recurrence_type),
    interval_months: data.interval_months != null ? Number(data.interval_months) : null,
    interval_days: data.interval_days != null ? Number(data.interval_days) : null,
    work_day_index: data.work_day_index != null ? Number(data.work_day_index) : null,
    anchor_date: String(data.anchor_date),
    next_run_date: String(data.next_run_date),
    is_active: !!data.is_active,
  };
}

export async function updateRecurringRule(
  id: string,
  params: {
    type: "income" | "expense" | "transfer";
    category_id: string;
    amount: number;
    account_from_id?: string | null;
    account_to_id?: string | null;
    description?: string | null;
    recurrence_type?: RecurrenceType;
    interval_months?: number | null;
    interval_days?: number | null;
    work_day_index?: number | null;
    is_active?: boolean;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rule } = await supabase
    .from("recurring_rules")
    .select("id, wallet_id, next_run_date")
    .eq("id", id)
    .single();
  if (!rule) return { error: "Recurring rule not found" };

  const {
    type,
    category_id,
    amount,
    account_from_id = null,
    account_to_id = null,
    description = null,
    recurrence_type = "monthly",
    interval_months = null,
    interval_days = null,
    work_day_index = null,
    is_active,
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
  if (
    recurrence_type === "interval_months" &&
    (interval_months == null || interval_months < 1)
  )
    return { error: "Interval months is required for 'every X months'" };
  if (
    recurrence_type === "interval_days" &&
    (interval_days == null || interval_days < 1)
  )
    return { error: "Interval days is required for 'every X days'" };
  const isWorkDay =
    recurrence_type === "monthly_nth_work_day" ||
    recurrence_type === "monthly_nth_last_work_day";
  if (
    isWorkDay &&
    (work_day_index == null || work_day_index < 1 || work_day_index > 31)
  )
    return { error: "Work day index (1–31) is required for work day recurrence" };

  const updatePayload: Record<string, unknown> = {
    type,
    category_id,
    amount,
    account_from_id,
    account_to_id,
    description: desc,
    recurrence_type,
    interval_months:
      recurrence_type === "interval_months" ? interval_months : null,
    interval_days: recurrence_type === "interval_days" ? interval_days : null,
    work_day_index: isWorkDay ? (work_day_index ?? 1) : null,
    updated_at: new Date().toISOString(),
  };
  if (typeof is_active === "boolean") updatePayload.is_active = is_active;

  if (isWorkDay) {
    const n = work_day_index ?? 1;
    const wdType =
      recurrence_type === "monthly_nth_work_day"
        ? "monthly_nth_work_day"
        : "monthly_nth_last_work_day";
    const today = new Date().toISOString().slice(0, 10);
    const prev = String(rule.next_run_date ?? today);
    const d = new Date(prev + "T12:00:00Z");
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth();
    let candidate: string | null = workDayDateInMonth(y, m, wdType, n);
    while (candidate && candidate < today) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      candidate = workDayDateInMonth(y, m, wdType, n);
    }
    if (candidate) updatePayload.next_run_date = candidate;
  }

  const { error: upErr } = await supabase
    .from("recurring_rules")
    .update(updatePayload)
    .eq("id", id);

  if (upErr) return { error: upErr.message };
  return {};
}

/** Copy a recurring rule: create one new movement (pending) + new recurring rule. Changes apply only to the new rule. */
export async function copyRecurringRule(id: string): Promise<{ error?: string }> {
  const rule = await getRecurringRule(id);
  if (!rule) return { error: "Recurring rule not found" };

  return createMovement({
    wallet_id: rule.wallet_id,
    type: rule.type,
    category_id: rule.category_id,
    date: rule.next_run_date,
    amount: rule.amount,
    account_from_id: rule.account_from_id,
    account_to_id: rule.account_to_id,
    description: rule.description,
    is_recurring: true,
    recurrence_type: rule.recurrence_type as RecurrenceType,
    interval_months:
      rule.recurrence_type === "interval_months" ? rule.interval_months : null,
    interval_days:
      rule.recurrence_type === "interval_days" ? rule.interval_days : null,
    work_day_index: rule.work_day_index,
    status: "pending",
  });
}
