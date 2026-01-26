"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export async function createCategory(params: {
  wallet_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("categories")
    .insert({
      wallet_id: params.wallet_id,
      name: params.name,
      type: params.type,
      parent_id: params.parent_id ?? null,
      created_by: user.id,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await logActivity(supabase, {
    action: "category_create",
    entity_type: "category",
    entity_id: data?.id ?? undefined,
    wallet_id: params.wallet_id,
    payload: { name: params.name, type: params.type, parent_id: params.parent_id },
  });
  return {};
}

export async function updateCategory(
  id: string,
  params: { name?: string; is_active?: boolean }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("categories")
    .select("wallet_id, name")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Category not found" };

  const updates: Record<string, unknown> = {};
  const payload: Record<string, { old?: unknown; new: unknown }> = {};

  if (params.name !== undefined) {
    updates.name = params.name;
    payload.name = { old: existing.name, new: params.name };
  }
  if (params.is_active !== undefined) {
    updates.is_active = params.is_active;
    payload.is_active = { new: params.is_active };
  }

  if (Object.keys(updates).length === 0) return {};

  const { error: err } = await supabase.from("categories").update(updates).eq("id", id);
  if (err) return { error: err.message };

  await logActivity(supabase, {
    action: "category_edit",
    entity_type: "category",
    entity_id: id,
    wallet_id: existing.wallet_id,
    payload: { changes: payload },
  });
  return {};
}
