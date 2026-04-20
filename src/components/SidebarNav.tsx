"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NewExpenseTrigger } from "@/components/NewExpenseTrigger";
import { NewIncomeTrigger } from "@/components/NewIncomeTrigger";
import { NewTransferTrigger } from "@/components/NewTransferTrigger";
import { useWallet } from "@/contexts/WalletContext";
import { shouldShowAccounts, shouldShowUsers } from "@/lib/wallet-modes";
import { useTranslations } from "next-intl";

const SIDEBAR_MODE_KEY = "wallet.sidebarMode";

type SidebarMode = "expanded" | "collapsed" | "hover";

export function SidebarNav() {
    const t = useTranslations('navigation');
    const { currentWalletId, wallets } = useWallet();
    const [mode, setMode] = useState<SidebarMode>("hover");
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const modeOptions: { key: SidebarMode; label: string }[] = [
        { key: "expanded", label: t('expanded') },
        { key: "collapsed", label: t('collapsed') },
        { key: "hover", label: t('expandOnHover') },
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
            ? "opacity-0 w-0"
            : "opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto";
    const alignClass = isExpanded
        ? "justify-start"
        : isCollapsed
            ? "justify-center"
            : "justify-center group-hover:justify-start";
    const currentWallet = wallets.find((w) => w.id === currentWalletId);
    const showAccounts = shouldShowAccounts(currentWallet);
    const showUsers = shouldShowUsers(currentWallet);

    const sidebarSlotClass = isExpanded ? "w-56" : "w-14";

    return (
        <div className={`relative hidden lg:block z-40 transition-[width] duration-200 ${sidebarSlotClass}`}>
            <aside
                className={
                    "group flex flex-col sticky top-14 h-[calc(100vh-56px)] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[var(--background)] transition-[width] duration-200 " +
                    (isExpanded ? "w-56" : "w-14") +
                    (isHover ? " hover:w-56" : "")
                }
            >
                <div className="flex-1 px-2 py-3 space-y-1">
                    <Link
                        href="/home"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('home')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 9l9-7 9 7" /><path d="M9 22V12h6v10" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('home')}</span>
                    </Link>
                    <Link
                        href="/portfolio"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('portfolio')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M8 14h4" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('portfolio')}</span>
                    </Link>

                    <div className="my-2 h-px bg-slate-200 dark:bg-slate-800" />

                    <NewIncomeTrigger className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-green-700 dark:text-green-200 hover:bg-green-50/70 dark:hover:bg-green-900/20 transition-colors`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 5v14" /><path d="M19 12H5" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('newIncome')}</span>
                    </NewIncomeTrigger>
                    <NewExpenseTrigger className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-50/70 dark:hover:bg-red-900/20 transition-colors`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M5 12h14" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('newExpense')}</span>
                    </NewExpenseTrigger>
                    <NewTransferTrigger className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-200 hover:bg-blue-50/70 dark:hover:bg-blue-900/20 transition-colors`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M7 7h10" /><path d="M7 7l4-4" /><path d="M7 7l4 4" /><path d="M17 17H7" /><path d="M17 17l-4-4" /><path d="M17 17l-4 4" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('newTransfer')}</span>
                    </NewTransferTrigger>

                    <div className="my-2 h-px bg-slate-200 dark:bg-slate-800" />

                    <Link
                        href="/transactions"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('transactions')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /><path d="M12 20V4" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('transactions')}</span>
                    </Link>
                    <Link
                        href="/statements"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('statements')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" /><path d="M14 4h6m0 0v6m0-6h-6" /><path d="M6 12h8" /><path d="M6 16h8" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('statements')}</span>
                    </Link>
                    <Link
                        href="/reports"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('reports')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M3 3v18h18" /><path d="M7 15v3" /><path d="M12 11v7" /><path d="M17 7v11" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('reports')}</span>
                    </Link>

                    <div className="my-2 h-px bg-slate-200 dark:bg-slate-800" />

                    <Link
                        href="/wallets"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('wallets')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('wallets')}</span>
                    </Link>
                    {showAccounts && (
                        <Link
                            href="/accounts"
                            className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                            title={t('accounts')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><circle cx="16" cy="11" r="1" /></svg>
                            <span className={`truncate transition-all ${labelClass}`}>{t('accounts')}</span>
                        </Link>
                    )}
                    {showUsers && (
                        <Link
                            href="/users"
                            className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                            title={t('users')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>
                            <span className={`truncate transition-all ${labelClass}`}>{t('users')}</span>
                        </Link>
                    )}
                    <Link
                        href="/categories"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('categories')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('categories')}</span>
                    </Link>

                    <div className="my-2 h-px bg-slate-200 dark:bg-slate-800" />

                    <Link
                        href="/activity"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('activityLog')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('activityLog')}</span>
                    </Link>
                    <Link
                        href="/profile"
                        className={`flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                        title={t('settings')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                        <span className={`truncate transition-all ${labelClass}`}>{t('settings')}</span>
                    </Link>
                </div>
                <div className="px-2 pb-3">
                    <div className="relative">
                        <button
                            ref={buttonRef}
                            type="button"
                            onClick={() => setMenuOpen((o) => !o)}
                            className={`w-full flex items-center ${alignClass} gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                            title={t('sidebarControl')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" /><line x1="21" x2="12" y1="12" y2="12" /><line x1="8" x2="3" y1="12" y2="12" /><line x1="21" x2="16" y1="20" y2="20" /><line x1="12" x2="3" y1="20" y2="20" /><line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="16" x2="16" y1="18" y2="22" /></svg>
                        </button>
                        {menuOpen && (
                            <div
                                ref={menuRef}
                                className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50"
                            >
                                <div className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                                    {t('sidebarControl')}
                                </div>
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
                                                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800")
                                                }
                                            >
                                                <span>{opt.label}</span>
                                                <span className={"h-2 w-2 rounded-full " + (isActive ? "bg-slate-600" : "bg-transparent")} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
