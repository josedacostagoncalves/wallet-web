"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export async function logActivityAction(args: {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  wallet_id?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const supabase = await createClient();
  await logActivity(supabase, args);
}
