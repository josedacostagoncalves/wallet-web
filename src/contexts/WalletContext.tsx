"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWalletCookie } from "@/app/actions/wallet-cookie";
import type { User } from "@supabase/supabase-js";
import type { Wallet } from "@/lib/types";

type WalletContextValue = {
  currentWalletId: string | null;
  wallets: Wallet[];
  user: User | null;
  firstName: string | null;
  setCurrentWallet: (id: string) => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({
  currentWalletId,
  wallets,
  user,
  firstName,
  children,
}: {
  currentWalletId: string | null;
  wallets: Wallet[];
  user: User | null;
  firstName: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const setCurrentWallet = useCallback(
    async (id: string) => {
      startTransition(async () => {
        await setWalletCookie(id);
        router.refresh();
      });
    },
    [router]
  );

  return (
    <WalletContext.Provider
      value={{
        currentWalletId,
        wallets,
        user,
        firstName,
        setCurrentWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
