"use server";

/** Persists selected wallet id in an HTTP-only cookie for server components and actions. */

import { cookies } from "next/headers";

const WALLET_COOKIE = "wallet_id";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setWalletCookie(walletId: string | null) {
  const c = await cookies();
  if (walletId) {
    c.set(WALLET_COOKIE, walletId, { path: "/", maxAge: MAX_AGE });
  } else {
    c.delete(WALLET_COOKIE);
  }
}

export async function getWalletCookie(): Promise<string | null> {
  const c = await cookies();
  return c.get(WALLET_COOKIE)?.value ?? null;
}
