"use client";

import { useWallet } from "@/contexts/WalletContext";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  labelClass: string;
  alignClass: string;
};

export function WalletSwitcher({ labelClass, alignClass }: Props) {
  const tNav = useTranslations("navigation");
  const { currentWalletId, wallets, setCurrentWallet } = useWallet();
  const [walletOpen, setWalletOpen] = useState(false);

  const currentWallet = wallets.find((w) => w.id === currentWalletId);

  if (wallets.length === 0) return null;

  return (
    <div className="relative px-1">
      <button
        type="button"
        title={currentWallet?.name ?? tNav("selectWallet")}
        onClick={() => setWalletOpen((o) => !o)}
        className={`w-full flex items-center ${alignClass} gap-2 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[2.25rem]`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        </svg>
        <span className={`truncate transition-all ${labelClass}`}>
          {currentWallet?.name ?? tNav("selectWallet")} ▾
        </span>
      </button>
      {walletOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setWalletOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full mt-1 py-1 w-56 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  void setCurrentWallet(w.id);
                  setWalletOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  w.id === currentWalletId ? "font-medium bg-slate-50 dark:bg-slate-700/50" : ""
                }`}
              >
                {w.name} {w.is_shared ? ` (${tNav("walletShared")})` : ""}
              </button>
            ))}
            <Link
              href="/wallets"
              className="block px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 mt-1"
              onClick={() => setWalletOpen(false)}
            >
              {tNav("manageWallets")} →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
