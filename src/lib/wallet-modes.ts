import type { Wallet } from "@/lib/types";

export function getWalletTrackingMode(wallet: Wallet | null | undefined): "full" | "basic" {
  if (!wallet) return "full";
  if (wallet.tracking_mode === "basic") return "basic";
  if (wallet.tracking_mode === "full") return "full";

  // Backward compatibility with legacy shared_option model.
  if (wallet.shared_option === "split") return "basic";
  return "full";
}

export function isFullTrackingWallet(wallet: Wallet | null | undefined): boolean {
  return getWalletTrackingMode(wallet) === "full";
}

export function isSharedSplitWallet(wallet: Wallet | null | undefined): boolean {
  if (!wallet?.is_shared) return false;
  if (wallet.split_mode === "split") return true;
  return wallet.shared_option === "split" || wallet.shared_option === "track_and_split";
}

export function shouldShowUsers(wallet: Wallet | null | undefined): boolean {
  return isSharedSplitWallet(wallet);
}

export function shouldShowAccounts(wallet: Wallet | null | undefined): boolean {
  if (!wallet) return false;
  if (wallet.is_shared && !isSharedSplitWallet(wallet)) return true;
  if (isSharedSplitWallet(wallet)) return isFullTrackingWallet(wallet);
  return isFullTrackingWallet(wallet);
}

