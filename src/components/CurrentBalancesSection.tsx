"use client";

import { AccountsSection } from "@/components/AccountsSection";
import type { AccountType } from "@/lib/account-types";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_HIDE = "j-wallet-hide-balances";
const STORAGE_KEY_ORDER_PREFIX = "j-wallet-account-order-";

type Account = {
  id: string;
  name: string;
  account_type: AccountType;
  initial_balance: number;
  current_balance: number;
  last_update: string | null;
};

type Props = {
  accounts: Account[];
  totalInitialBalance: number;
  totalBalance: number;
  currentWalletId: string | null;
};

function orderKey(walletId: string) {
  return `${STORAGE_KEY_ORDER_PREFIX}${walletId}`;
}

function loadOrder(walletId: string | null): string[] {
  if (!walletId) return [];
  try {
    const raw = localStorage.getItem(orderKey(walletId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function persistOrder(walletId: string | null, ids: string[]) {
  if (!walletId) return;
  try {
    localStorage.setItem(orderKey(walletId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

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
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
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
        width="20"
        height="20"
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
      width="20"
      height="20"
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

export function CurrentBalancesSection({
  accounts,
  totalInitialBalance,
  totalBalance,
  currentWalletId,
}: Props) {
  const [hideBalances, setHideBalances] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [orderEditing, setOrderEditing] = useState(false);
  const [editOrder, setEditOrder] = useState<string[] | null>(null);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HIDE);
      setHideBalances(raw === "true");
    } catch {
      setHideBalances(false);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const order = loadOrder(currentWalletId);
    setSavedOrder(order);
    if (!orderEditing) setEditOrder(null);
  }, [currentWalletId, orderEditing]);

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
    const order = loadOrder(currentWalletId);
    const ids = order.length
      ? order.filter((id) => accounts.some((a) => a.id === id))
      : accounts.map((a) => a.id);
    const extra = accounts.filter((a) => !ids.includes(a.id)).map((a) => a.id);
    setEditOrder([...ids, ...extra]);
    setOrderEditing(true);
  }, [currentWalletId, accounts]);

  const saveOrderClick = useCallback(() => {
    if (editOrder) {
      persistOrder(currentWalletId, editOrder);
      setSavedOrder(editOrder);
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

  const activeOrder = orderEditing && editOrder ? editOrder : savedOrder;
  const orderedAccounts = sortByOrder(accounts, activeOrder);

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-medium">Current balances</h2>
        {mounted && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleHide}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
              aria-label={hideBalances ? "Show balances" : "Hide balances"}
              title={hideBalances ? "Show balances" : "Hide balances"}
            >
              <EyeIcon hidden={hideBalances} />
            </button>
            {orderEditing ? (
              <>
                <button
                  type="button"
                  onClick={saveOrderClick}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                >
                  Save order
                </button>
                <button
                  type="button"
                  onClick={cancelReorder}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startReorder}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
                aria-label="Reorder accounts"
                title="Reorder accounts"
              >
                <DragHandleIcon />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <AccountsSection
          accounts={orderedAccounts}
          totalInitialBalance={totalInitialBalance}
          totalBalance={totalBalance}
          currentWalletId={currentWalletId}
          hideBalances={mounted ? hideBalances : false}
          orderEditing={orderEditing}
          onReorder={handleReorder}
        />
      </div>
    </section>
  );
}
