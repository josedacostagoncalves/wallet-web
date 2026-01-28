"use client";

import { getMovementsByAccount, type MovementByAccountRow } from "@/app/actions/movements";
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
import { Fragment, useState } from "react";

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

type MovementsState = {
  movements: MovementByAccountRow[];
  full: boolean;
  loading: boolean;
};

export function AccountsSection({
  accounts,
  totalInitialBalance,
  totalBalance,
  currentWalletId,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movementsByAccount, setMovementsByAccount] = useState<Record<string, MovementsState>>({});

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
          <th className="px-4 py-3 text-right font-medium text-slate-700">
            Initial balance
          </th>
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
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(a.id);
                  }
                }}
                className="hover:bg-slate-50/50 cursor-pointer"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                <td className="px-4 py-3 text-right font-mono">
                  {a.initial_balance.toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  €
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {a.current_balance.toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  €
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {a.last_update
                    ? new Date(a.last_update).toLocaleDateString("pt-PT")
                    : "—"}
                </td>
              </tr>
              {isExpanded && (
                <tr key={`${a.id}-movements`} className="bg-slate-50/80">
                  <td colSpan={5} className="px-4 py-3">
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
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Date
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Description
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Type
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
                                    className={movementRowBgClass(m.type)}
                                  >
                                    <td className="px-3 py-2">{m.date}</td>
                                    <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">
                                      {m.description || "—"}
                                    </td>
                                    <td className="px-3 py-2 capitalize">{m.type}</td>
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
                                      {m.type === "income" ? "+" : m.type === "expense" ? "−" : ""}
                                      {m.amount.toLocaleString("pt-PT", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      €
                                    </td>
                                    <td className="px-3 py-2">
                                      <MovementRowActions
                                        id={m.id}
                                        status={m.status}
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
          <td className="px-4 py-3 text-right font-mono">
            {totalInitialBalance.toLocaleString("pt-PT", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            €
          </td>
          <td className="px-4 py-3 text-right font-mono">
            {totalBalance.toLocaleString("pt-PT", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            €
          </td>
          <td className="px-4 py-3" />
        </tr>
      </tbody>
    </table>
  );
}
