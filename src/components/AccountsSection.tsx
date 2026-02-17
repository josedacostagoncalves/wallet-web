"use client";

import {
  getAccountBalanceSeries,
  getTransactionsByAccount,
  type AccountBalancePoint,
  type TransactionByAccountRow,
} from "@/app/actions/transactions";
import { TransactionTypeIcon } from "@/components/ActionIcons";
import { TransactionRowActions } from "@/components/TransactionRowActions";
import {
  accountTypeIcon,
  accountTypeLabel,
  type AccountType,
} from "@/lib/account-types";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/transaction-labels";
import { transactionRowBgClass } from "@/lib/transaction-row-style";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type RangeKey = "30d" | "3m" | "6m" | "1y" | "all" | "custom";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "1y", label: "Last year" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  /** Net pending amount per account (only for pending transactions that already updated balances, i.e. hold_balance=false) */
  pendingAmounts?: Record<string, number>;
};

type TransactionsState = {
  transactions: TransactionByAccountRow[];
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
  const [transactionsByAccount, setTransactionsByAccount] = useState<Record<string, TransactionsState>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [chartAccountId, setChartAccountId] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [balanceSeries, setBalanceSeries] = useState<AccountBalancePoint[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceOldest, setBalanceOldest] = useState<string | null>(null);
  const [modalTransactions, setModalTransactions] = useState<TransactionByAccountRow[]>([]);
  const [modalTransactionsFull, setModalTransactionsFull] = useState(false);
  const [modalTransactionsLoading, setModalTransactionsLoading] = useState(false);
  const [showModalTransactions, setShowModalTransactions] = useState(false);
  const [modalFilter, setModalFilter] = useState<"day" | "period" | "all">("period");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const chartAccount = useMemo(
    () => accounts.find((a) => a.id === chartAccountId) ?? null,
    [accounts, chartAccountId]
  );

  const resolveRangeDates = useCallback(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const fromDate = (d: Date) => d.toISOString().slice(0, 10);

    switch (chartRange) {
      case "30d": {
        const d = new Date(today);
        d.setDate(d.getDate() - 29);
        return { from: fromDate(d), to: end };
      }
      case "3m": {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 3);
        return { from: fromDate(d), to: end };
      }
      case "6m": {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 6);
        return { from: fromDate(d), to: end };
      }
      case "1y": {
        const d = new Date(today);
        d.setFullYear(d.getFullYear() - 1);
        return { from: fromDate(d), to: end };
      }
      case "all":
        return { from: undefined, to: undefined };
      case "custom":
        if (!customFrom || !customTo) return null;
        return { from: customFrom, to: customTo };
      default:
        return { from: undefined, to: undefined };
    }
  }, [chartRange, customFrom, customTo]);

  const activePeriod = useMemo(() => resolveRangeDates(), [resolveRangeDates]);

  useEffect(() => {
    if (orderEditing) setExpandedId(null);
  }, [orderEditing]);

  const loadModalTransactions = useCallback(
    async (accountId: string, full: boolean, fromDate?: string, toDate?: string) => {
      if (!currentWalletId) return;
      setModalTransactionsLoading(true);
      const list = await getTransactionsByAccount(currentWalletId, accountId, {
        limit: full ? 0 : 5,
        fromDate,
        toDate,
      });
      setModalTransactions(list);
      setModalTransactionsFull(full);
      setModalTransactionsLoading(false);
    },
    [currentWalletId]
  );

  const openChart = useCallback(
    (accountId: string) => {
      setChartAccountId(accountId);
      setChartRange("30d");
      setCustomFrom("");
      setCustomTo("");
      setBalanceSeries([]);
      setBalanceOldest(null);
      setShowModalTransactions(false);
      setModalFilter("period");
      setSelectedDay(null);
      setModalTransactions([]);
      setModalTransactionsFull(false);
      setModalTransactionsLoading(false);
    },
    []
  );

  const applyModalFilter = useCallback(
    async (filter: "day" | "period" | "all", day?: string, full = false) => {
      if (!chartAccountId) return;
      let fromDate: string | undefined;
      let toDate: string | undefined;

      if (filter === "day" && day) {
        fromDate = day;
        toDate = day;
      }
      if (filter === "period") {
        const dates = resolveRangeDates();
        if (!dates) return;
        fromDate = dates.from;
        toDate = dates.to;
      }

      setModalFilter(filter);
      setSelectedDay(filter === "day" ? day ?? null : null);
      setShowModalTransactions(true);
      await loadModalTransactions(chartAccountId, full, fromDate, toDate);
    },
    [chartAccountId, loadModalTransactions, resolveRangeDates]
  );

  useEffect(() => {
    if (!chartAccountId || !currentWalletId) return;
    const dates = resolveRangeDates();
    if (!dates) return;
    setBalanceLoading(true);
    getAccountBalanceSeries(
      currentWalletId,
      chartAccountId,
      dates.from,
      dates.to
    )
      .then((res) => {
        setBalanceSeries(res.series);
        setBalanceOldest(res.oldestDate);
      })
      .finally(() => setBalanceLoading(false));
  }, [chartAccountId, currentWalletId, resolveRangeDates]);

  async function loadTransactions(accountId: string, limit: number) {
    if (!currentWalletId) return;
    setTransactionsByAccount((prev) => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        loading: true,
        transactions: prev[accountId]?.transactions ?? [],
        full: limit === 0,
      },
    }));
    const list = await getTransactionsByAccount(currentWalletId, accountId, {
      limit: limit || undefined,
    });
    setTransactionsByAccount((prev) => ({
      ...prev,
      [accountId]: {
        transactions: list,
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
    const state = transactionsByAccount[accountId];
    if (!state?.transactions?.length && !state?.loading) {
      loadTransactions(accountId, 5);
    }
  }

  function handleSeeAll(accountId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const state = transactionsByAccount[accountId];
    if (state?.full) {
      loadTransactions(accountId, 5);
      return;
    }
    loadTransactions(accountId, 0);
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
    <div className="w-full">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {orderEditing && <th className="px-4 py-3 w-8" />}
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Account</th>
              {showInitialBalance && (
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Initial balance</th>
              )}
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Current balance</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Last update</th>
              {!orderEditing && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {accounts.map((a) => {
              const state = transactionsByAccount[a.id];
              const isExpanded = expandedId === a.id;
              const loading = state?.loading ?? false;
              const transactions = state?.transactions ?? [];
              const full = state?.full ?? false;

              return (
                <Fragment key={a.id}>
                  <tr
                    onClick={() => !orderEditing && toggleExpand(a.id)}
                    className={
                      orderEditing
                        ? `hover:bg-slate-50/50 dark:hover:bg-slate-900/50 ${dragOverId === a.id ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 ring-inset" : ""}`
                        : "hover:bg-slate-50/50 dark:hover:bg-slate-900/50 cursor-pointer"
                    }
                    onDragOver={orderEditing ? (e) => handleDragOver(e, a.id) : undefined}
                    onDragLeave={orderEditing ? handleDragLeave : undefined}
                    onDrop={orderEditing ? (e) => handleDrop(e, a.id) : undefined}
                    onDragEnd={orderEditing ? handleDragEnd : undefined}
                  >
                    {orderEditing && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, a.id)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-grab active:cursor-grabbing inline-flex touch-none"
                          aria-label="Drag to reorder"
                        >
                          <DragHandleIcon />
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium min-w-0">
                      <span
                        className="inline-flex items-center gap-2 min-w-0"
                        title={accountTypeLabel(a.account_type)}
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {accountTypeIcon(a.account_type)}
                        </span>
                        <span className="truncate max-w-[32ch]">{a.name}</span>
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
                        const pending = pendingAmounts?.[a.id];
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
                        <span className="block text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                          {hideBalances
                            ? MASK
                            : `${fmt(a.plafond + a.current_balance, false)} € available of ${fmt(a.plafond, false)} €`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                      {a.last_update
                        ? new Date(a.last_update).toLocaleDateString("pt-PT")
                        : "—"}
                    </td>
                    {!orderEditing && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openChart(a.id)}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                            aria-label="View balance evolution"
                          >
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
                              <path d="M3 3v18h18" />
                              <path d="m19 9-5 5-4-4-3 3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpand(a.id)}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
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
                              className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              aria-hidden
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr key={`${a.id}-transactions`} className="bg-slate-50/50 dark:bg-slate-900/50">
                      <td colSpan={(showInitialBalance ? 5 : 4) + (orderEditing ? 1 : 0) + (!orderEditing ? 1 : 0)} className="px-4 py-3">
                        <div className="pl-6 space-y-2">
                          <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Recent transactions</h3>
                          {loading && !transactions.length ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">Loading...</p>
                          ) : transactions.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No transactions for this account.</p>
                          ) : (
                            <div className="rounded border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-950">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-10">Type</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Date</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Description</th>
                                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Amount</th>
                                    <th className="px-3 py-2 w-20" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {transactions.map((m) => (
                                    <tr key={m.id} className={transactionRowBgClass(m.type)}>
                                      <td className="px-3 py-2">
                                        <TransactionTypeIcon type={m.type as "income" | "expense" | "transfer"} />
                                      </td>
                                      <td className="px-3 py-2">{m.date}</td>
                                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                                        {m.description || "—"}
                                      </td>
                                      <td
                                        className={`px-3 py-2 text-right font-mono ${m.type === "income"
                                          ? "text-green-600 dark:text-green-400"
                                          : m.type === "expense"
                                            ? "text-red-600 dark:text-red-400"
                                            : ""
                                          }`}
                                      >
                                        {hideBalances
                                          ? MASK
                                          : `${m.type === "income" ? "+" : m.type === "expense" ? "−" : ""}${formatCurrency(m.amount)}`}{" "}
                                        €
                                      </td>
                                      <td className="px-3 py-2">
                                        <TransactionRowActions id={m.id} status={m.status} holdBalance={m.holdBalance} onAfterAction={() => loadTransactions(a.id, full ? 0 : 5)} showEdit={m.status === "pending"} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {!loading && transactions.length > 0 && (
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={(e) => handleSeeAll(a.id, e)}
                                disabled={loading}
                                className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                {full ? "Show less" : "See all"}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="bg-slate-50 dark:bg-slate-900/50 font-medium">
              {orderEditing && <td className="px-4 py-3 w-8" />}
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none opacity-0" aria-hidden>
                    {accountTypeIcon("bank_account")}
                  </span>
                  <span>Total</span>
                </span>
              </td>
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
      </div>
      {chartAccountId &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={() => setChartAccountId(null)}
          >
            <div className="absolute inset-0 bg-slate-900/50" />
            <div
              className="relative w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Account evolution</h3>
                  {chartAccount && (
                    <p className="text-sm text-slate-500">{chartAccount.name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setChartAccountId(null)}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChartRange(opt.key)}
                    className={
                      "rounded-lg px-3 py-1.5 text-xs border " +
                      (chartRange === opt.key
                        ? "border-slate-700 bg-slate-900 text-white"
                        : "border-slate-200 dark:border-slate-700 text-slate-600")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
                {chartRange === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                    />
                  </div>
                )}
                {chartRange === "all" && balanceOldest && (
                  <span className="text-xs text-slate-500">
                    From {new Date(balanceOldest).toLocaleDateString("pt-PT")}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                {balanceLoading ? (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    Loading evolution…
                  </div>
                ) : balanceSeries.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No balance data for this period.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={balanceSeries}
                        onClick={(e) => {
                          const label = (e as { activeLabel?: string } | null)?.activeLabel;
                          if (label) applyModalFilter("day", label, true);
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => v.slice(5)}
                        />
                        <YAxis
                          tickFormatter={(v: number) => formatCurrency(v)}
                          width={80}
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            `${formatCurrency(value)} €`
                          }
                          labelFormatter={(label) =>
                            new Date(label).toLocaleDateString("pt-PT")
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="balance"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Transactions</h4>
                    {modalFilter === "day" && selectedDay && (
                      <p className="text-xs text-slate-500">
                        Day: {new Date(selectedDay).toLocaleDateString("pt-PT")}
                      </p>
                    )}
                    {modalFilter === "period" && showModalTransactions && activePeriod && (
                      <p className="text-xs text-slate-500">
                        Period: {activePeriod.from ?? "—"} to {activePeriod.to ?? "—"}
                      </p>
                    )}
                    {modalFilter === "all" && showModalTransactions && (
                      <p className="text-xs text-slate-500">All transactions</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyModalFilter("period")}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
                    >
                      Show period
                    </button>
                    <button
                      type="button"
                      onClick={() => applyModalFilter("all")}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
                    >
                      Show all
                    </button>
                    {showModalTransactions && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowModalTransactions(false);
                          setSelectedDay(null);
                          setModalFilter("period");
                          setModalTransactions([]);
                          setModalTransactionsFull(false);
                          setModalTransactionsLoading(false);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
                      >
                        Clear/Collapse
                      </button>
                    )}
                  </div>
                </div>

                {!showModalTransactions ? (
                  <p className="text-xs text-slate-500">
                    Select a day in the chart or use the buttons to show transactions.
                  </p>
                ) : modalTransactionsLoading ? (
                  <p className="text-xs text-slate-500">Loading…</p>
                ) : modalTransactions.length === 0 ? (
                  <p className="text-xs text-slate-500">No transactions for this account.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!chartAccountId) return;
                          applyModalFilter(
                            modalFilter,
                            selectedDay ?? undefined,
                            !modalTransactionsFull
                          );
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
                      >
                        {modalTransactionsFull ? "Show less" : "Show all transactions"}
                      </button>
                    </div>
                    <div className="rounded-lg border border-slate-200 overflow-x-auto">
                      <table className="w-full text-xs min-w-[640px]">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-slate-600 w-10">Type</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">Description</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalTransactions.map((m) => (
                            <tr key={m.id} className={transactionRowBgClass(m.type)}>
                              <td className="px-4 py-2">
                                <TransactionTypeIcon type={m.type as "income" | "expense" | "transfer"} />
                              </td>
                              <td className="px-4 py-2">{m.date}</td>
                              <td className="px-4 py-2 text-slate-700 max-w-[260px] truncate">
                                {m.description || "—"}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-mono ${m.type === "income"
                                  ? "text-green-600"
                                  : m.type === "expense"
                                    ? "text-red-600"
                                    : ""}`}
                              >
                                {hideBalances
                                  ? MASK
                                  : `${m.type === "income" ? "+" : m.type === "expense" ? "−" : ""}${formatCurrency(m.amount)}`} {" "}
                                €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}
