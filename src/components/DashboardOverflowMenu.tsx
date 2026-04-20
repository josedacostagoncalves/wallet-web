"use client";

import { logActivityAction } from "@/app/actions/auth";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { shouldShowAccounts, shouldShowUsers } from "@/lib/wallet-modes";
import { useTransactionModals } from "@/contexts/TransactionModalsContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** Open panel upward (sidebar footer) or downward (legacy header). */
  placement?: "up" | "down";
  /** Same as nav links: justify-center collapsed, justify-start expanded, group-hover in hover mode. */
  alignClass?: string;
  /** Footer row: same flex + padding as SidebarNav links. */
  compact?: boolean;
};

export function DashboardOverflowMenu({ placement = "down", alignClass = "justify-start", compact = false }: Props) {
  const tNav = useTranslations("navigation");
  const tAuth = useTranslations("auth");
  const { currentWalletId, wallets } = useWallet();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { openNewIncome, openNewExpense, openNewTransfer } = useTransactionModals();

  const currentWallet = wallets.find((w) => w.id === currentWalletId);
  const showAccounts = shouldShowAccounts(currentWallet);
  const showUsers = shouldShowUsers(currentWallet);

  async function handleLogout() {
    await logActivityAction({ action: "logout" });
    const supabase = createClient();
    await supabase.auth.signOut();
    showToast(tAuth("loggedOutSuccess"));
    router.push("/");
    router.refresh();
  }

  /** Anchor left so narrow sidebar panels extend right (avoids left-edge clipping). */
  const panelPosition =
    placement === "up"
      ? "absolute left-0 bottom-full mb-1 py-1 w-56 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50"
      : "absolute right-0 top-full mt-1 py-1 w-56 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50";

  const triggerClass = compact
    ? `w-full flex min-h-[2.25rem] items-center ${alignClass} gap-3 px-3 py-2 rounded-md text-lg font-medium leading-none text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]`
    : `w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`;

  return (
    <div className={compact ? "relative w-full" : "relative"}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={triggerClass}
        aria-label="Menu"
      >
        <span className="shrink-0">⋮</span>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className={panelPosition}>
            <Link
              href="/home"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M3 9l9-7 9 7" /><path d="M9 22V12h6v10" /></svg>
              {tNav("home")}
            </Link>
            <Link
              href="/portfolio"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M8 14h4" /></svg>
              {tNav("portfolio")}
            </Link>
            <hr className="my-1 border-slate-200 dark:border-slate-600" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openNewIncome();
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-green-700 dark:text-green-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 5v14" /><path d="M19 12H5" /></svg>
              {tNav("newIncome")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openNewExpense();
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-red-700 dark:text-red-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M5 12h14" /></svg>
              {tNav("newExpense")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openNewTransfer();
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-blue-700 dark:text-blue-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M7 7h10" /><path d="M7 7l4-4" /><path d="M7 7l4 4" /><path d="M17 17H7" /><path d="M17 17l-4-4" /><path d="M17 17l-4 4" /></svg>
              {tNav("newTransfer")}
            </button>
            <hr className="my-1 border-slate-200 dark:border-slate-600" />
            <Link
              href="/transactions"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /><path d="M12 20V4" /></svg>
              {tNav("transactions")}
            </Link>
            <Link
              href="/statements"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M10 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" /><path d="M14 4h6m0 0v6m0-6h-6" /><path d="M6 12h8" /><path d="M6 16h8" /></svg>
              {tNav("statements")}
            </Link>
            <Link
              href="/reports"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M3 3v18h18" /><path d="M7 15v3" /><path d="M12 11v7" /><path d="M17 7v11" /></svg>
              {tNav("reports")}
            </Link>
            <hr className="my-1 border-slate-200 dark:border-slate-600" />
            <Link
              href="/wallets"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
              {tNav("wallets")}
            </Link>
            {showAccounts && (
              <Link
                href="/accounts"
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><circle cx="16" cy="11" r="1" /></svg>
                {tNav("accounts")}
              </Link>
            )}
            {showUsers && (
              <Link
                href="/users"
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>
                {tNav("users")}
              </Link>
            )}
            <Link
              href="/categories"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
              {tNav("categories")}
            </Link>
            <Link
              href="/activity"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              {tNav("activityLog")}
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
              {tNav("settings")}
            </Link>
            <hr className="my-1 border-slate-200 dark:border-slate-600" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void handleLogout();
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              {tAuth("logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
