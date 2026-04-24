"use client";

import {
  getAccountOrder,
  getBalanceDisplayOptions,
  saveAccountOrder,
  saveBalanceDisplayOptions,
  type BalanceDisplayOptions,
} from "@/app/actions/preferences";
import { AccountsSection } from "@/components/AccountsSection";
import {
  balanceSheetToolbarIconButtonClass,
  balanceSheetToolbarIconButtonOpenClass,
} from "@/lib/balance-sheet-toolbar-icons";
import type { AccountType } from "@/lib/account-types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY_HIDE = "j-wallet-hide-balances";
const STORAGE_KEY_ACCOUNTS_LAYOUT = "j-wallet-portfolio-accounts-layout";

type Account = {
  id: string;
  name: string;
  account_type: AccountType;
  initial_balance: number;
  current_balance: number;
  last_update: string | null;
  plafond: number | null;
};

type Props = {
  accounts: Account[];
  totalInitialBalance: number;
  totalBalance: number;
  currentWalletId: string | null;
  walletName?: string | null;
  pendingAmounts?: Record<string, number>;
  headerControl?: ReactNode;
};

function sortByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return [...items];
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? 1e9 : i;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id));
}

function DragHandleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden
    >
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="16" y1="6" x2="16" y2="18" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.576 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-4.963" />
        <path d="m2 2 20 20" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TableLayoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="5" width="16" height="5" rx="1" />
      <rect x="4" y="13" width="16" height="7" rx="1" />
    </svg>
  );
}

function CardLayoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

const DEFAULT_DISPLAY: BalanceDisplayOptions = {
  showInitialBalance: true,
  showPlafond: true,
};

export function CurrentBalancesSection({
  accounts,
  totalInitialBalance,
  totalBalance,
  currentWalletId,
  walletName,
  pendingAmounts = {},
  headerControl,
}: Props) {
  const t = useTranslations("home.currentBalances");
  const [hideBalances, setHideBalances] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [orderEditing, setOrderEditing] = useState(false);
  const [editOrder, setEditOrder] = useState<string[] | null>(null);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  /* ---------- Display options ---------- */
  const [displayOpts, setDisplayOpts] = useState<BalanceDisplayOptions>(DEFAULT_DISPLAY);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const optionsPopRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const [accountsLayout, setAccountsLayout] = useState<"table" | "cards">("table");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HIDE);
      setHideBalances(raw === "true");
      const layoutRaw = localStorage.getItem(STORAGE_KEY_ACCOUNTS_LAYOUT);
      if (layoutRaw === "cards") setAccountsLayout("cards");
    } catch {
      setHideBalances(false);
    }
    setMounted(true);
  }, []);

  const setAccountsLayoutPersisted = useCallback((next: "table" | "cards") => {
    setAccountsLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS_LAYOUT, next);
    } catch {
      /* ignore */
    }
  }, []);

  // Load preferences from DB
  useEffect(() => {
    if (!currentWalletId) {
      setSavedOrder([]);
      setDisplayOpts(DEFAULT_DISPLAY);
      setPrefsLoaded(true);
      return;
    }
    let cancelled = false;
    setPrefsLoaded(false);
    Promise.all([
      getAccountOrder(currentWalletId),
      getBalanceDisplayOptions(currentWalletId),
    ]).then(([order, opts]) => {
      if (cancelled) return;
      setSavedOrder(order);
      setEditOrder(null);
      setDisplayOpts(opts);
      setPrefsLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on wallet change
  }, [currentWalletId]);

  useEffect(() => {
    if (orderEditing) setOrderEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when wallet changes
  }, [currentWalletId]);

  const toggleHide = useCallback(() => {
    setHideBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_HIDE, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const startReorder = useCallback(() => {
    const ids = savedOrder.length
      ? savedOrder.filter((id) => accounts.some((a) => a.id === id))
      : accounts.map((a) => a.id);
    const extra = accounts.filter((a) => !ids.includes(a.id)).map((a) => a.id);
    setEditOrder([...ids, ...extra]);
    setOrderEditing(true);
  }, [savedOrder, accounts]);

  const saveOrderClick = useCallback(async () => {
    if (editOrder && currentWalletId) {
      setSavingOrder(true);
      await saveAccountOrder(currentWalletId, editOrder);
      setSavedOrder(editOrder);
      setSavingOrder(false);
    }
    setOrderEditing(false);
    setEditOrder(null);
  }, [currentWalletId, editOrder]);

  const cancelReorder = useCallback(() => {
    setOrderEditing(false);
    setEditOrder(null);
  }, []);

  const handleReorder = useCallback((accountIds: string[]) => {
    setEditOrder(accountIds);
  }, []);

  /* ---------- Options popover ---------- */
  const toggleOptions = useCallback(() => {
    setOptionsOpen((prev) => {
      if (!prev && optionsBtnRef.current) {
        const r = optionsBtnRef.current.getBoundingClientRect();
        setPopPos({ top: r.bottom + 6, left: r.right });
      }
      return !prev;
    });
  }, []);

  const toggleDisplayOpt = useCallback(
    (key: keyof BalanceDisplayOptions) => {
      setDisplayOpts((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        if (currentWalletId) saveBalanceDisplayOptions(currentWalletId, next);
        return next;
      });
    },
    [currentWalletId]
  );

  // Close on outside click
  useEffect(() => {
    if (!optionsOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        optionsBtnRef.current?.contains(e.target as Node) ||
        optionsPopRef.current?.contains(e.target as Node)
      )
        return;
      setOptionsOpen(false);
    }
    function handleScroll() {
      setOptionsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [optionsOpen]);

  const activeOrder = orderEditing && editOrder ? editOrder : savedOrder;
  const orderedAccounts = sortByOrder(accounts, activeOrder);

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-medium">{walletName || t("title")}</h2>
        </div>
        {mounted && prefsLoaded && (
          <div className="flex items-center gap-2">
            {headerControl}
            <button
              type="button"
              onClick={toggleHide}
              className={balanceSheetToolbarIconButtonClass}
              aria-label={hideBalances ? t("showBalances") : t("hideBalances")}
              title={hideBalances ? t("showBalances") : t("hideBalances")}
            >
              <EyeIcon hidden={hideBalances} />
            </button>
            {accounts.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setAccountsLayoutPersisted("table")}
                  className={accountsLayout === "table" ? balanceSheetToolbarIconButtonOpenClass : balanceSheetToolbarIconButtonClass}
                  aria-label={t("viewAsTable")}
                  title={t("viewAsTable")}
                  aria-pressed={accountsLayout === "table"}
                >
                  <TableLayoutIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setAccountsLayoutPersisted("cards")}
                  className={accountsLayout === "cards" ? balanceSheetToolbarIconButtonOpenClass : balanceSheetToolbarIconButtonClass}
                  aria-label={t("viewAsCards")}
                  title={t("viewAsCards")}
                  aria-pressed={accountsLayout === "cards"}
                >
                  <CardLayoutIcon />
                </button>
              </>
            )}
            {orderEditing ? (
              <>
                <button
                  type="button"
                  onClick={saveOrderClick}
                  disabled={savingOrder}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 disabled:opacity-50"
                >
                  {savingOrder ? t("saving") : t("saveOrder")}
                </button>
                <button
                  type="button"
                  onClick={cancelReorder}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startReorder}
                className={balanceSheetToolbarIconButtonClass}
                aria-label={t("reorderAccounts")}
                title={t("reorderAccounts")}
              >
                <DragHandleIcon />
              </button>
            )}
            <button
              ref={optionsBtnRef}
              type="button"
              onClick={toggleOptions}
              className={optionsOpen ? balanceSheetToolbarIconButtonOpenClass : balanceSheetToolbarIconButtonClass}
              aria-label={t("displayOptions")}
              title={t("displayOptions")}
            >
              <OptionsIcon />
            </button>
          </div>
        )}
      </div>
      <div
        className={
          accountsLayout === "cards"
            ? "overflow-visible"
            : "rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        }
      >
        {!prefsLoaded ? (
          <div className="h-48 flex items-center justify-center bg-white dark:bg-slate-900">
            <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" aria-hidden />
          </div>
        ) : (
          <AccountsSection
            accounts={orderedAccounts}
            totalInitialBalance={totalInitialBalance}
            totalBalance={totalBalance}
            currentWalletId={currentWalletId}
            hideBalances={mounted ? hideBalances : false}
            orderEditing={orderEditing}
            onReorder={handleReorder}
            showInitialBalance={displayOpts.showInitialBalance}
            showPlafond={displayOpts.showPlafond}
            pendingAmounts={pendingAmounts}
            layout={accountsLayout}
          />
        )}
      </div>

      {/* Options popover (portaled) */}
      {optionsOpen &&
        popPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={optionsPopRef}
            className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 w-64"
            style={{ top: popPos.top, left: popPos.left, transform: "translateX(-100%)" }}
          >
            <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">
              {t("displayOptions")}
            </h3>
            <label className="flex items-center gap-3 cursor-pointer py-1.5">
              <input
                type="checkbox"
                checked={displayOpts.showInitialBalance}
                onChange={() => toggleDisplayOpt("showInitialBalance")}
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {t("showInitialBalance")}
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-1.5">
              <input
                type="checkbox"
                checked={displayOpts.showPlafond}
                onChange={() => toggleDisplayOpt("showPlafond")}
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {t("showPlafondInfo")}
              </span>
            </label>
          </div>,
          document.body
        )}
    </section>
  );
}
