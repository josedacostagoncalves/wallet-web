"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NewExpenseTrigger } from "@/components/NewExpenseTrigger";
import { NewIncomeTrigger } from "@/components/NewIncomeTrigger";
import { NewTransferTrigger } from "@/components/NewTransferTrigger";
import { DashboardOverflowMenu } from "@/components/DashboardOverflowMenu";
import { WalletSwitcher } from "@/components/WalletSwitcher";
import { JWalletLogo } from "@/components/JWalletIcon";
import { useWallet } from "@/contexts/WalletContext";
import { shouldShowAccounts, shouldShowUsers } from "@/lib/wallet-modes";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

const SIDEBAR_MODE_KEY = "wallet.sidebarMode";

type SidebarMode = "expanded" | "collapsed" | "hover";

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Inactive: muted gray; active: Vercel-style pill (light bg / dark white/10) + strong text. */
function navLinkClass(active: boolean, alignClass: string): string {
  const row = `flex items-center ${alignClass} gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors`;
  if (active) {
    return `${row} bg-slate-200/90 dark:bg-white/10 text-slate-900 dark:text-white`;
  }
  return `${row} text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]`;
}

export function SidebarNav() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const { currentWalletId, wallets, firstName, avatarUrl } = useWallet();
  const [mode, setMode] = useState<SidebarMode>("hover");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const modeOptions: { key: SidebarMode; label: string }[] = [
    { key: "expanded", label: t("expanded") },
    { key: "collapsed", label: t("collapsed") },
    { key: "hover", label: t("expandOnHover") },
  ];

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_MODE_KEY) : null;
    if (stored === "expanded" || stored === "collapsed" || stored === "hover") {
      setMode(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_MODE_KEY, mode);
    }
  }, [mode]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [menuOpen]);

  const isExpanded = mode === "expanded";
  const isCollapsed = mode === "collapsed";
  const isHover = mode === "hover";

  const labelClass = isExpanded
    ? "opacity-100 w-auto"
    : isCollapsed
      ? "opacity-0 w-0 overflow-hidden"
      : "opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto group-hover:overflow-visible";
  const alignClass = isExpanded
    ? "justify-start"
    : isCollapsed
      ? "justify-center"
      : "justify-center group-hover:justify-start";
  const currentWallet = wallets.find((w) => w.id === currentWalletId);
  const showAccounts = shouldShowAccounts(currentWallet);
  const showUsers = shouldShowUsers(currentWallet);

  const sidebarSlotClass = isExpanded ? "w-56" : "w-14";

  const greeting = firstName ? `${tCommon("hello")}, ${firstName}` : tCommon("hello");

  return (
    <div className={`relative block z-40 shrink-0 transition-[width] duration-200 ${sidebarSlotClass}`}>
      <aside
        className={
          "group flex flex-col sticky top-0 h-[100dvh] min-h-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[var(--background)] transition-[width] duration-200 " +
          (isExpanded ? "w-56" : "w-14") +
          (isHover ? " hover:w-56" : "")
        }
      >
        <div className="shrink-0 px-2 pt-3 pb-2 space-y-2 border-b border-slate-200 dark:border-slate-800">
          <div className={`flex items-center gap-2 px-1 min-h-[2.25rem] ${alignClass}`}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile/OAuth URLs not in next/image config
              <img
                src={avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-600 shrink-0"
              />
            ) : (
              <span className="shrink-0 h-8 w-8 flex items-center justify-center" title={greeting}>
                <JWalletLogo className="w-8 h-8" variant="v2" />
              </span>
            )}
            <span
              className={`font-bold text-slate-800 dark:text-slate-100 truncate transition-all text-sm ${labelClass}`}
            >
              {greeting}
            </span>
          </div>
          <WalletSwitcher labelClass={labelClass} alignClass={alignClass} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-1">
          <Link
            href="/home"
            className={navLinkClass(isNavActive(pathname, "/home"), alignClass)}
            title={t("home")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 9l9-7 9 7" /><path d="M9 22V12h6v10" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("home")}</span>
          </Link>
          <Link
            href="/portfolio"
            className={navLinkClass(isNavActive(pathname, "/portfolio"), alignClass)}
            title={t("portfolio")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M8 14h4" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("portfolio")}</span>
          </Link>

          <div className="my-2 h-px bg-slate-200 dark:bg-white/[0.08]" />

          <NewIncomeTrigger className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-green-700 dark:text-green-200 hover:bg-green-50/70 dark:hover:bg-green-900/20 transition-colors`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 5v14" /><path d="M19 12H5" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("newIncome")}</span>
          </NewIncomeTrigger>
          <NewExpenseTrigger className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-50/70 dark:hover:bg-red-900/20 transition-colors`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M5 12h14" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("newExpense")}</span>
          </NewExpenseTrigger>
          <NewTransferTrigger className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-200 hover:bg-blue-50/70 dark:hover:bg-blue-900/20 transition-colors`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M7 7h10" /><path d="M7 7l4-4" /><path d="M7 7l4 4" /><path d="M17 17H7" /><path d="M17 17l-4-4" /><path d="M17 17l-4 4" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("newTransfer")}</span>
          </NewTransferTrigger>

          <div className="my-2 h-px bg-slate-200 dark:bg-white/[0.08]" />

          <Link
            href="/transactions"
            className={navLinkClass(isNavActive(pathname, "/transactions"), alignClass)}
            title={t("transactions")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /><path d="M12 20V4" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("transactions")}</span>
          </Link>
          <Link
            href="/statements"
            className={navLinkClass(isNavActive(pathname, "/statements"), alignClass)}
            title={t("statements")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" /><path d="M14 4h6m0 0v6m0-6h-6" /><path d="M6 12h8" /><path d="M6 16h8" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("statements")}</span>
          </Link>
          <Link
            href="/reports"
            className={navLinkClass(isNavActive(pathname, "/reports"), alignClass)}
            title={t("reports")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 3v18h18" /><path d="M7 15v3" /><path d="M12 11v7" /><path d="M17 7v11" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("reports")}</span>
          </Link>

          <div className="my-2 h-px bg-slate-200 dark:bg-white/[0.08]" />

          <Link
            href="/wallets"
            className={navLinkClass(isNavActive(pathname, "/wallets"), alignClass)}
            title={t("wallets")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("wallets")}</span>
          </Link>
          {showAccounts && (
            <Link
              href="/accounts"
              className={navLinkClass(isNavActive(pathname, "/accounts"), alignClass)}
              title={t("accounts")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><circle cx="16" cy="11" r="1" /></svg>
              <span className={`truncate transition-all ${labelClass}`}>{t("accounts")}</span>
            </Link>
          )}
          {showUsers && (
            <Link
              href="/users"
              className={navLinkClass(isNavActive(pathname, "/users"), alignClass)}
              title={t("users")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>
              <span className={`truncate transition-all ${labelClass}`}>{t("users")}</span>
            </Link>
          )}
          <Link
            href="/categories"
            className={navLinkClass(isNavActive(pathname, "/categories"), alignClass)}
            title={t("categories")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("categories")}</span>
          </Link>

          <div className="my-2 h-px bg-slate-200 dark:bg-white/[0.08]" />

          <Link
            href="/activity"
            className={navLinkClass(isNavActive(pathname, "/activity"), alignClass)}
            title={t("activityLog")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("activityLog")}</span>
          </Link>
          <Link
            href="/profile"
            className={navLinkClass(isNavActive(pathname, "/profile"), alignClass)}
            title={t("settings")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            <span className={`truncate transition-all ${labelClass}`}>{t("settings")}</span>
          </Link>
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-2 pb-3 pt-2">
          <div className="flex w-full flex-col gap-0.5">
            <DashboardOverflowMenu placement="up" compact alignClass={alignClass} />
            <div className="relative w-full">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className={`flex w-full min-h-[2.25rem] items-center ${alignClass} gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]`}
                title={t("sidebarControl")}
                aria-label={t("sidebarControl")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" /><line x1="21" x2="12" y1="12" y2="12" /><line x1="8" x2="3" y1="12" y2="12" /><line x1="21" x2="16" y1="20" y2="20" /><line x1="12" x2="3" y1="20" y2="20" /><line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="16" x2="16" y1="18" y2="22" /></svg>
              </button>
              {menuOpen && (
                <div
                  ref={menuRef}
                  className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50"
                >
                  <div className="p-1">
                    {modeOptions.map((opt) => {
                      const isActive = mode === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setMode(opt.key);
                            setMenuOpen(false);
                          }}
                          className={
                            "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors " +
                            (isActive
                              ? "bg-slate-200/90 dark:bg-white/10 text-slate-900 dark:text-white"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]")
                          }
                        >
                          <span>{opt.label}</span>
                          <span className={"h-2 w-2 rounded-full " + (isActive ? "bg-slate-700 dark:bg-white" : "bg-transparent")} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
