"use client";

import { logActivityAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { JWalletIcon } from "@/components/JWalletIcon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Header() {
  const { currentWalletId, wallets, setCurrentWallet, firstName } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const router = useRouter();

  const currentWallet = wallets.find((w) => w.id === currentWalletId);
  const greeting = firstName ? `Hello, ${firstName}` : "Hello";

  async function handleLogout() {
    await logActivityAction({ action: "logout" });
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <JWalletIcon className="w-8 h-8" />
          <span className="font-semibold text-slate-800 dark:text-white truncate">
            {greeting}
          </span>
          <nav className="hidden sm:flex items-center gap-2 shrink-0">
            <Link
              href="/home"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Dashboard
            </Link>
            <Link
              href="/reports"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Reports
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {wallets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setWalletOpen((o) => !o)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {currentWallet?.name ?? "Select wallet"} ▾
              </button>
              {walletOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setWalletOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute top-full right-0 mt-1 py-1 w-56 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50">
                    {wallets.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          setCurrentWallet(w.id);
                          setWalletOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                          w.id === currentWalletId ? "font-medium bg-slate-50 dark:bg-slate-700/50" : ""
                        }`}
                      >
                        {w.name} {w.is_shared ? " (shared)" : ""}
                      </button>
                    ))}
                    <Link
                      href="/wallets"
                      className="block px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 mt-1"
                      onClick={() => setWalletOpen(false)}
                    >
                      Manage wallets →
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Menu"
            >
              ⋮
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 py-1 w-48 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50">
                  <Link
                    href="/profile"
                    className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile settings
                  </Link>
                  <Link
                    href="/accounts"
                    className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Accounts
                  </Link>
                  <Link
                    href="/categories"
                    className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Categories
                  </Link>
                  <Link
                    href="/wallets"
                    className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Wallets
                  </Link>
                  <Link
                    href="/reports"
                    className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Reports
                  </Link>
                  <Link
                    href="/activity"
                    className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Activity log
                  </Link>
                  <hr className="my-1 border-slate-200 dark:border-slate-600" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
