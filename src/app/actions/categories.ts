"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export async function getCategory(id: string | null) {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("id", id)
    .single();
  if (!data) return null;
  return { id: data.id, name: data.name, parent_id: data.parent_id as string | null };
}

export async function createCategory(params: {
  wallet_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id?: string | null;
}): Promise<{ error?: string; id?: string }> {
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
  return { id: data?.id };
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

/**
 * Returns the number of movements that reference this category
 * (and its subcategories, if it is a parent category).
 */
export async function getCategoryUsage(
  id: string
): Promise<{ movementCount: number; childCount: number }> {
  const supabase = await createClient();

  // Collect all category IDs to check (self + children)
  const { data: children } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", id);
  const childIds = (children ?? []).map((c) => c.id);
  const allIds = [id, ...childIds];

  // Count movements referencing any of those IDs
  let movementCount = 0;
  for (const catId of allIds) {
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("category_id", catId);
    movementCount += count ?? 0;
  }

  return { movementCount, childCount: childIds.length };
}

/**
 * Deletes a category (and its subcategories).
 * - If movements reference the category: deactivates instead of deleting
 *   so that confirmed movements maintain their category data.
 * - If no movements reference it: hard-deletes.
 */
export async function deleteCategory(id: string): Promise<{ error?: string; deactivated?: boolean }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("categories")
    .select("wallet_id, name, parent_id")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Category not found" };

  // Collect child IDs
  const { data: children } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", id);
  const childIds = (children ?? []).map((c) => c.id);
  const allIds = [id, ...childIds];

  // Count movements referencing this category or its subcategories
  let movementCount = 0;
  for (const catId of allIds) {
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("category_id", catId);
    movementCount += count ?? 0;
  }

  if (movementCount > 0) {
    // Deactivate instead of deleting to preserve movement data
    const { error: deactivateErr } = await supabase
      .from("categories")
      .update({ is_active: false })
      .in("id", allIds);
    if (deactivateErr) return { error: deactivateErr.message };

    await logActivity(supabase, {
      action: "category_deactivate",
      entity_type: "category",
      entity_id: id,
      wallet_id: existing.wallet_id,
      payload: { name: existing.name, reason: "has_movements", movementCount },
    });
    return { deactivated: true };
  }

  // No movements — safe to hard-delete
  if (childIds.length > 0) {
    const { error: childErr } = await supabase
      .from("categories")
      .delete()
      .eq("parent_id", id);
    if (childErr) return { error: childErr.message };
  }

  const { error: err } = await supabase.from("categories").delete().eq("id", id);
  if (err) return { error: err.message };

  await logActivity(supabase, {
    action: "category_delete",
    entity_type: "category",
    entity_id: id,
    wallet_id: existing.wallet_id,
    payload: { name: existing.name },
  });
  return {};
}
