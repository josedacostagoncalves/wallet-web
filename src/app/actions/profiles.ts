"use server";

import { createClient } from "@/lib/supabase/server";

export type Profile = { first_name: string | null; last_name: string | null };

/**
 * Fetch profile for user. If missing, create from metadata (or empty) and return.
 */
export async function getOrEnsureProfile(
  userId: string,
  metadata?: { first_name?: string | null; last_name?: string | null } | null
): Promise<Profile> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();

  if (existing) {
    return {
      first_name: existing.first_name ?? null,
      last_name: existing.last_name ?? null,
    };
  }

  const first_name = (metadata?.first_name ?? "")?.trim() || null;
  const last_name = (metadata?.last_name ?? "")?.trim() || null;
  await supabase.from("profiles").insert({ id: userId, first_name, last_name });

  return { first_name, last_name };
}
