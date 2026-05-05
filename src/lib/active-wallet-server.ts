import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the active wallet for dashboard/report pages: cookie if valid, else first active wallet.
 * Uses a single `wallets` read with `tracking_mode` so callers can branch chart behavior.
 */
export async function getActiveWalletContext(
  supabase: SupabaseClient,
  cookieWalletId: string | null
): Promise<{
  currentWalletId: string | null;
  walletTracksBalances: boolean;
}> {
  const { data: wallets } = await supabase
    .from("wallets")
    .select("id, tracking_mode")
    .eq("is_active", true)
    .is("deleted_at", null);
  const list = wallets ?? [];
  const walletIds = list.map((w) => w.id);
  const currentWalletId =
    cookieWalletId && walletIds.includes(cookieWalletId) ? cookieWalletId : list[0]?.id ?? null;
  const currentWallet = list.find((w) => w.id === currentWalletId);
  return {
    currentWalletId,
    walletTracksBalances: currentWallet?.tracking_mode !== "basic",
  };
}
