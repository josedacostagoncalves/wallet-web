"use client";

import { getMovementsByAccount, type MovementByAccountRow } from "@/app/actions/movements";
import { MovementTypeIcon } from "@/components/ActionIcons";
import { MovementRowActions } from "@/components/MovementRowActions";
import {
  accountTypeIcon,
  accountTypeLabel,
  type AccountType,
} from "@/lib/account-types";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/movement-labels";
import { movementRowBgClass } from "@/lib/movement-row-style";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  name: string;
  account_type: AccountType;
  initial_balance: number;
  current_balance: number;
  last_update: string | null;
  plafond: number | null;
};

const MASK = "••••••";

type Props = {
  accounts: Account[];
  totalInitialBalance: number;
  totalBalance: number;
  currentWalletId: string | null;
  hideBalances?: boolean;
  orderEditing?: boolean;
  onReorder?: (accountIds: string[]) => void;
  showInitialBalance?: boolean;
  showPlafond?: boolean;
  /** Net pending amount per account (only for pending movements that already updated balances, i.e. hold_balance=false) */
  pendingAmounts?: Record<string, number>;
};

type MovementsState = {
  movements: MovementByAccountRow[];
  full: boolean;
  loading: boolean;
};

function fmt(amount: number, hide: boolean) {
  if (hide) return MASK;
  return amount.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export function AccountsSection({
  accounts,
  totalInitialBalance,
  totalBalance,
  currentWalletId,
  hideBalances = false,
  orderEditing = false,
  onReorder,
  showInitialBalance = true,
  showPlafond = true,
  pendingAmounts = {},
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movementsByAccount, setMovementsByAccount] = useState<Record<string, MovementsState>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (orderEditing) setExpandedId(null);
  }, [orderEditing]);

  async function loadMovements(accountId: string, limit: number) {
    if (!currentWalletId) return;
    setMovementsByAccount((prev) => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        loading: true,
        movements: prev[accountId]?.movements ?? [],
        full: limit === 0,
      },
    }));
    const list = await getMovementsByAccount(currentWalletId, accountId, limit || undefined);
    setMovementsByAccount((prev) => ({
      ...prev,
      [accountId]: {
        movements: list,
        full: limit === 0,
        loading: false,
      },
    }));
  }

  function toggleExpand(accountId: string) {
    if (expandedId === accountId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(accountId);
    const state = movementsByAccount[accountId];
    if (!state?.movements?.length && !state?.loading) {
      loadMovements(accountId, 5);
    }
  }

  function handleSeeAll(accountId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const state = movementsByAccount[accountId];
    if (state?.full) {
      loadMovements(accountId, 5);
      return;
    }
    loadMovements(accountId, 0);
  }

  const handleDragStart = useCallback(
    (e: React.DragEvent, accountId: string) => {
      if (!orderEditing || !onReorder) return;
      e.dataTransfer.setData("text/plain", accountId);
      e.dataTransfer.effectAllowed = "move";
    },
    [orderEditing, onReorder]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, accountId: string) => {
      if (!orderEditing) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(accountId);
    },
    [orderEditing]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropTargetId: string) => {
      if (!orderEditing || !onReorder) return;
      e.preventDefault();
      setDragOverId(null);
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === dropTargetId) return;
      const ids = accounts.map((a) => a.id);
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(dropTargetId);
      if (from === -1 || to === -1) return;
      const next = [...ids];
      next.splice(from, 1);
      next.splice(next.indexOf(dropTargetId), 0, draggedId);
      onReorder(next);
    },
    [orderEditing, onReorder, accounts]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
  }, []);

  if (accounts.length === 0) {
    return (
      <div className="p-6 text-xs text-slate-500">
        No accounts yet. Create one from{" "}
        <Link href="/accounts" className="underline">
          Accounts
        </Link>
        .
      </div>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-4 py-3 text-left font-medium text-slate-700 w-8">
            {" "}
          </th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">
            Account
          </th>
          {showInitialBalance && (
            <th className="px-4 py-3 text-right font-medium text-slate-700">
              Initial balance
            </th>
          )}
          <th className="px-4 py-3 text-right font-medium text-slate-700">
            Current balance
          </th>
          <th className="px-4 py-3 text-right font-medium text-slate-700">
            Last Update
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {accounts.map((a) => {
          const isExpanded = expandedId === a.id;
          const state = movementsByAccount[a.id];
          const movements = state?.movements ?? [];
          const loading = state?.loading ?? false;
          const full = state?.full ?? false;

          return (
            <Fragment key={a.id}>
              <tr
                key={a.id}
                role={orderEditing ? undefined : "button"}
                tabIndex={orderEditing ? undefined : 0}
                onClick={orderEditing ? undefined : () => toggleExpand(a.id)}
                onKeyDown={
                  orderEditing
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(a.id);
                        }
                      }
                }
                className={
                  orderEditing
                    ? `hover:bg-slate-50/50 ${dragOverId === a.id ? "bg-slate-100 ring-1 ring-slate-300 ring-inset" : ""}`
                    : "hover:bg-slate-50/50 cursor-pointer"
                }
                onDragOver={orderEditing ? (e) => handleDragOver(e, a.id) : undefined}
                onDragLeave={orderEditing ? handleDragLeave : undefined}
                onDrop={orderEditing ? (e) => handleDrop(e, a.id) : undefined}
                onDragEnd={orderEditing ? handleDragEnd : undefined}
              >
                <td className="px-4 py-3" onClick={orderEditing ? undefined : (e) => e.stopPropagation()}>
                  {orderEditing ? (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, a.id)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-grab active:cursor-grabbing inline-flex touch-none"
                      aria-label="Drag to reorder"
                    >
                      <DragHandleIcon />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleExpand(a.id)}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-500"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <span
                        className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  <span
                    className="inline-flex items-center gap-2"
                    title={accountTypeLabel(a.account_type)}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {accountTypeIcon(a.account_type)}
                    </span>
                    {a.name}
                  </span>
                </td>
                {showInitialBalance && (
                  <td className="px-4 py-3 text-right font-mono">
                    {fmt(a.initial_balance, hideBalances)} €
                  </td>
                )}
                <td className="px-4 py-3 text-right font-mono">
                  <span className={a.current_balance < 0 ? "text-red-600" : ""}>
                    {fmt(a.current_balance, hideBalances)} €
                  </span>
                  {(() => {
                    const pending = pendingAmounts[a.id];
                    if (pending != null && pending !== 0) {
                      return (
                        <span className="block text-xs text-amber-600 dark:text-amber-400 font-sans mt-0.5">
                          {hideBalances ? MASK : `${fmt(pending, false)} € pending`}
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {showPlafond && a.account_type === "credit_card" && a.plafond != null && a.plafond > 0 && (
                    <span className="block text-xs text-slate-500 font-sans mt-0.5">
                      {hideBalances
                        ? MASK
                        : `${fmt(a.plafond + a.current_balance, false)} € available of ${fmt(a.plafond, false)} €`}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {a.last_update
                    ? new Date(a.last_update).toLocaleDateString("pt-PT")
                    : "—"}
                </td>
              </tr>
              {isExpanded && (
                <tr key={`${a.id}-movements`} className="bg-slate-50/80">
                  <td colSpan={showInitialBalance ? 5 : 4} className="px-4 py-3">
                    <div className="pl-6 space-y-2">
                      <h3 className="text-xs font-medium text-slate-700 mb-2">
                        Movements
                      </h3>
                      {loading && !movements.length ? (
                        <p className="text-xs text-slate-500">Loading…</p>
                      ) : movements.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No movements for this account.
                        </p>
                      ) : (
                        <>
                          <div className="rounded-lg border border-slate-200 overflow-x-auto">
                            <table className="w-full text-xs min-w-[640px]">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 w-10">Type</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Date
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Description
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Category :: Subcategory
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    From → To
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                                    Amount
                                  </th>
                                  <th className="px-3 py-2 w-24" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {[...movements]
                                  .sort((a, b) => {
                                    const aPending = a.status === "pending" ? 1 : 0;
                                    const bPending = b.status === "pending" ? 1 : 0;
                                    if (bPending !== aPending) return bPending - aPending;
                                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                                  })
                                  .map((m) => (
                                  <tr
                                    key={m.id}
                                    className={
                                      m.status === "pending"
                                        ? m.holdBalance
                                          ? "bg-amber-100 hover:bg-amber-200/80"
                                          : "bg-yellow-50 hover:bg-yellow-100/80"
                                        : movementRowBgClass(m.type)
                                    }
                                  >
                                    <td className="px-3 py-2">
                                      <MovementTypeIcon type={m.type as "income" | "expense" | "transfer"} />
                                    </td>
                                    <td className="px-3 py-2">{m.date}</td>
                                    <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">
                                      {m.description || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {formatCategorySubcategory(m.categoryLabel, m.subcategoryLabel)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {formatFromTo(m.accountFromName, m.accountToName)}
                                    </td>
                                    <td
                                      className={`px-3 py-2 text-right font-mono ${
                                        m.type === "income"
                                          ? "text-green-600"
                                          : m.type === "expense"
                                            ? "text-red-600"
                                            : ""
                                      }`}
                                    >
                                      {hideBalances
                                        ? MASK
                                        : `${m.type === "income" ? "+" : m.type === "expense" ? "−" : ""}${m.amount.toLocaleString("pt-PT", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}`}{" "}
                                      €
                                    </td>
                                    <td className="px-3 py-2">
                                      <MovementRowActions
                                        id={m.id}
                                        status={m.status}
                                        holdBalance={m.holdBalance}
                                        onAfterAction={() => loadMovements(a.id, full ? 0 : 5)}
                                        showEdit={m.status === "pending"}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleSeeAll(a.id, e)}
                              disabled={loading}
                              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {loading
                                ? "Loading…"
                                : full
                                  ? "Show less"
                                  : "See all movements"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        <tr className="bg-slate-50 font-medium">
          <td className="px-4 py-3 w-8" />
          <td className="px-4 py-3">Total</td>
          {showInitialBalance && (
            <td className="px-4 py-3 text-right font-mono">
              {fmt(totalInitialBalance, hideBalances)} €
            </td>
          )}
          <td className="px-4 py-3 text-right font-mono">
            {fmt(totalBalance, hideBalances)} €
          </td>
          <td className="px-4 py-3" />
        </tr>
      </tbody>
    </table>
  );
}
