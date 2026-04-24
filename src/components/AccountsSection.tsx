"use client";

import {
  getAccountBalanceSeries,
  getTransactionsByAccount,
  type AccountBalancePoint,
  type TransactionByAccountRow,
} from "@/app/actions/transactions";
import { TransactionTypeIcon } from "@/components/ActionIcons";
import { PortfolioAccountCard } from "@/components/PortfolioAccountCard";
import { TransactionListIndicators } from "@/components/TransactionListIndicators";
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
import { useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

function buildFlatSparkline(from: string, to: string, balance: number): AccountBalancePoint[] {
  const result: AccountBalancePoint[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    result.push({ date: cursor.toISOString().slice(0, 10), balance });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

type RangeKey = "thisMonth" | "thisYear" | "custom";

const RANGE_OPTIONS: { key: RangeKey; labelKey: string }[] = [
  { key: "thisYear", labelKey: "thisYear" },
  { key: "thisMonth", labelKey: "thisMonth" },
  { key: "custom", labelKey: "custom" },
];

const evolutionFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:focus-visible:ring-slate-500/50";

function evolutionSegmentToggleClass(selected: boolean) {
  return (
    "rounded-lg px-3 py-1.5 text-[11px] border " +
    evolutionFocusRing +
    " " +
    (selected
      ? "border-slate-700 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-800"
      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-white/[0.06]")
  );
}

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
  /** Portfolio: table (default) or card grid */
  layout?: "table" | "cards";
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
  layout = "table",
}: Props) {
  const t = useTranslations("home.accountsTable");
  const portfolioCardLabels = useMemo(
    () => ({
      currentBalance: t("currentBalance"),
      initialBalance: t("initialBalance"),
      lastUpdate: t("lastUpdate"),
      pending: t("pending"),
      plafondInfo: (p: { available: string; total: string }) => t("plafondInfo", p),
      viewBalanceEvolution: t("viewBalanceEvolution"),
      expand: t("expand"),
      collapse: t("collapse"),
      dragToReorder: t("dragToReorder"),
      last30Days: t("last30Days"),
    }),
    [t]
  );
  /** Table layout: at most one expanded row (accordion). */
  const [expandedTableAccountId, setExpandedTableAccountId] = useState<string | null>(null);
  /** Card layout: any number of accounts may be expanded at once. */
  const [expandedCardAccountIds, setExpandedCardAccountIds] = useState<Set<string>>(() => new Set());
  const [transactionsByAccount, setTransactionsByAccount] = useState<Record<string, TransactionsState>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [chartAccountId, setChartAccountId] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<RangeKey>("thisYear");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [balanceSeries, setBalanceSeries] = useState<AccountBalancePoint[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [modalTransactions, setModalTransactions] = useState<TransactionByAccountRow[]>([]);
  const [modalTransactionsLoading, setModalTransactionsLoading] = useState(false);
  const [showModalTransactions, setShowModalTransactions] = useState(false);
  const [modalFilter, setModalFilter] = useState<"day" | "period" | "all">("period");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [chartAllOpen, setChartAllOpen] = useState(false);
  const [chartAllLoading, setChartAllLoading] = useState(false);
  const [chartAllData, setChartAllData] = useState<Array<Record<string, number | string>>>([]);
  const [chartAllVisibleAccountIds, setChartAllVisibleAccountIds] = useState<Set<string>>(new Set());
  const [cardSparklines, setCardSparklines] = useState<
    Record<string, AccountBalancePoint[] | "loading">
  >({});

  const chartAccount = useMemo(
    () => accounts.find((a) => a.id === chartAccountId) ?? null,
    [accounts, chartAccountId]
  );

  const resolveRangeDates = useCallback(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const fromDate = (d: Date) => d.toISOString().slice(0, 10);

    switch (chartRange) {
      case "thisMonth": {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: fromDate(d), to: end };
      }
      case "thisYear": {
        const d = new Date(today.getFullYear(), 0, 1);
        return { from: fromDate(d), to: end };
      }
      case "custom":
        if (!customFrom || !customTo) return null;
        return { from: customFrom, to: customTo };
      default:
        return { from: undefined, to: undefined };
    }
  }, [chartRange, customFrom, customTo]);

  const activePeriod = useMemo(() => resolveRangeDates(), [resolveRangeDates]);
  const displaySeries = useMemo(() => {
    if (balanceSeries.length === 0) return [];
    if (!activePeriod?.from || !activePeriod?.to) return balanceSeries;

    const sorted = [...balanceSeries].sort((a, b) => a.date.localeCompare(b.date));
    const byDate = new Map(sorted.map((point) => [point.date, point.balance]));
    const firstBalance = sorted[0]?.balance ?? 0;

    let carryBalance = firstBalance;
    for (const point of sorted) {
      if (point.date <= activePeriod.from) {
        carryBalance = point.balance;
      } else {
        break;
      }
    }

    const result: AccountBalancePoint[] = [];
    const cursor = new Date(activePeriod.from);
    const end = new Date(activePeriod.to);

    while (cursor <= end) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const balance = byDate.get(dateKey);
      if (balance != null) carryBalance = balance;
      result.push({ date: dateKey, balance: carryBalance });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }, [balanceSeries, activePeriod]);
  const xAxisMonthTicks = useMemo(() => {
    if (displaySeries.length === 0) return [];
    const monthStarts: string[] = [];
    const seen = new Set<string>();

    for (const point of displaySeries) {
      const monthKey = point.date.slice(0, 7);
      if (!seen.has(monthKey) && point.date.endsWith("-01")) {
        seen.add(monthKey);
        monthStarts.push(point.date);
      }
    }

    // If the selected range starts mid-month, ensure first visible month is represented.
    const firstDate = displaySeries[0]?.date;
    if (firstDate) {
      const firstMonthKey = firstDate.slice(0, 7);
      if (!seen.has(firstMonthKey)) monthStarts.unshift(firstDate);
    }

    return monthStarts;
  }, [displaySeries]);

  const allXAxisMonthTicks = useMemo(() => {
    if (chartAllData.length === 0) return [];
    const monthStarts: string[] = [];
    const seen = new Set<string>();

    for (const point of chartAllData) {
      const dateKey = String(point.date);
      const monthKey = dateKey.slice(0, 7);
      if (!seen.has(monthKey) && dateKey.endsWith("-01")) {
        seen.add(monthKey);
        monthStarts.push(dateKey);
      }
    }

    const firstDate = String(chartAllData[0]?.date ?? "");
    if (firstDate) {
      const firstMonthKey = firstDate.slice(0, 7);
      if (!seen.has(firstMonthKey)) monthStarts.unshift(firstDate);
    }

    return monthStarts;
  }, [chartAllData]);

  const periodMinBalance = useMemo(() => {
    if (displaySeries.length === 0) return null;
    return displaySeries.reduce((min, p) => Math.min(min, p.balance), displaySeries[0].balance);
  }, [displaySeries]);
  const periodMaxBalance = useMemo(() => {
    if (displaySeries.length === 0) return null;
    return displaySeries.reduce((max, p) => Math.max(max, p.balance), displaySeries[0].balance);
  }, [displaySeries]);

  useEffect(() => {
    if (orderEditing) {
      setExpandedTableAccountId(null);
      setExpandedCardAccountIds(new Set());
    }
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
      setModalTransactionsLoading(false);
    },
    [currentWalletId]
  );

  const openChart = useCallback(
    (accountId: string) => {
      setChartAccountId(accountId);
      setChartAllOpen(false);
      setChartRange("thisYear");
      setCustomFrom("");
      setCustomTo("");
      setBalanceSeries([]);
      setShowModalTransactions(true);
      setModalFilter("all");
      setSelectedDay(null);
      setModalTransactions([]);
      setModalTransactionsLoading(false);
    },
    []
  );

  const openAllAccountsChart = useCallback(() => {
    setChartAllOpen(true);
    setChartAccountId(null);
    setChartAllLoading(false);
    setChartAllData([]);
    // Default to none selected; we'll set defaults after we know tx presence.
    setChartAllVisibleAccountIds(new Set());
    setChartRange("thisYear");
    setCustomFrom("");
    setCustomTo("");
  }, []);

  useEffect(() => {
    if (!chartAllOpen || !currentWalletId) return;
    const dates = resolveRangeDates();
    if (!dates?.from || !dates?.to) return;

    let cancelled = false;
    setChartAllLoading(true);
    setChartAllData([]);

    Promise.all(
      accounts.map(async (a) => {
        const res = await getAccountBalanceSeries(currentWalletId, a.id, dates.from, dates.to);
        return {
          id: a.id,
          initialBalance: a.initial_balance,
          series: res.series,
          hasTxInRange: res.hasTransactionsInRange,
        };
      })
    )
      .then((perAccount) => {
        if (cancelled) return;
        if (perAccount.length === 0) {
          setChartAllData([]);
          return;
        }

        const from = dates.from;
        const to = dates.to;

        // Build a continuous day-by-day timeline like the per-account chart does.
        const cursor = new Date(from);
        const end = new Date(to);
        const dateKeys: string[] = [];
        while (cursor <= end) {
          dateKeys.push(cursor.toISOString().slice(0, 10));
          cursor.setDate(cursor.getDate() + 1);
        }

        const data: Array<Record<string, number | string>> = dateKeys.map((d) => ({ date: d }));

        for (const { id, series, initialBalance } of perAccount) {
          if (!series.length) {
            // When an account has no transactions at all, the server returns an empty series.
            // In that case, keep a constant line at the account's initial balance.
            for (let i = 0; i < dateKeys.length; i += 1) {
              (data[i] as any)[id] = initialBalance;
            }
            continue;
          }

          const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
          const byDate = new Map(sorted.map((point) => [point.date, point.balance]));
          let carryBalance = sorted[0]?.balance ?? initialBalance;

          for (let i = 0; i < dateKeys.length; i += 1) {
            const dateKey = dateKeys[i];
            const nextBalance = byDate.get(dateKey);
            if (nextBalance != null) carryBalance = nextBalance;
            (data[i] as any)[id] = carryBalance;
          }
        }

        // Default selection:
        // - unchecked for accounts without any relevant transaction in the selected range
        const visible = new Set<string>(perAccount.filter((a) => a.hasTxInRange).map((a) => a.id));
        setChartAllVisibleAccountIds(visible);

        setChartAllData(data);
      })
      .finally(() => {
        if (cancelled) return;
        setChartAllLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when period/accounts change
  }, [chartAllOpen, currentWalletId, resolveRangeDates, accounts]);

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
      })
      .finally(() => setBalanceLoading(false));
  }, [chartAccountId, currentWalletId, resolveRangeDates]);

  useEffect(() => {
    if (layout !== "cards") {
      setCardSparklines({});
      return;
    }
    if (!currentWalletId || accounts.length === 0) return;

    let cancelled = false;
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    setCardSparklines(Object.fromEntries(accounts.map((a) => [a.id, "loading" as const])));

    Promise.all(
      accounts.map(async (a) => {
        const res = await getAccountBalanceSeries(currentWalletId, a.id, fromStr, toStr);
        let series = res.series;
        if (!series.length) {
          series = buildFlatSparkline(fromStr, toStr, a.current_balance);
        }
        return { id: a.id, series } as const;
      })
    ).then((rows) => {
      if (cancelled) return;
      setCardSparklines(Object.fromEntries(rows.map((r) => [r.id, r.series])));
    });

    return () => {
      cancelled = true;
    };
  }, [layout, currentWalletId, accounts]);

  useEffect(() => {
    if (!chartAccountId || !showModalTransactions || modalFilter !== "all") return;
    applyModalFilter("all", undefined, true);
  }, [chartAccountId, showModalTransactions, modalFilter, applyModalFilter]);

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
    if (layout === "cards") {
      const closing = expandedCardAccountIds.has(accountId);
      setExpandedCardAccountIds((prev) => {
        const next = new Set(prev);
        if (closing) next.delete(accountId);
        else next.add(accountId);
        return next;
      });
      if (!closing) {
        const state = transactionsByAccount[accountId];
        if (!state?.transactions?.length && !state?.loading) {
          void loadTransactions(accountId, 5);
        }
      }
      return;
    }
    if (expandedTableAccountId === accountId) {
      setExpandedTableAccountId(null);
      return;
    }
    setExpandedTableAccountId(accountId);
    const state = transactionsByAccount[accountId];
    if (!state?.transactions?.length && !state?.loading) {
      void loadTransactions(accountId, 5);
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

  function renderAccountExpandedSection(a: Account, variant: "table" | "card") {
    const state = transactionsByAccount[a.id];
    const loading = state?.loading ?? false;
    const transactions = state?.transactions ?? [];
    const full = state?.full ?? false;
    const isCard = variant === "card";
    const wrapClass = variant === "table" ? "pl-6 space-y-2" : "space-y-2";
    const tableText = isCard ? "text-[10px] leading-tight" : "text-xs";
    const thPad = isCard ? "px-2 py-1.5" : "px-3 py-2";
    const tdPad = isCard ? "px-2 py-1" : "px-3 py-2";
    const transferNote = isCard ? "text-[9px]" : "text-[11px]";
    const balanceAfterNote = isCard ? "text-[9px]" : "text-[11px]";
    const thWeight = isCard ? "font-semibold" : "font-medium";

    return (
      <div className={wrapClass}>
        <h3
          className={
            isCard
              ? "mb-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
              : "mb-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          }
        >
          {t("recentTransactions")}
        </h3>
        {loading && !transactions.length ? (
          <p className={`${isCard ? "text-[10px]" : "text-xs"} text-slate-500 dark:text-slate-400`}>{t("loading")}</p>
        ) : transactions.length === 0 ? (
          <p className={`${isCard ? "text-[10px]" : "text-xs"} text-slate-500 dark:text-slate-400`}>{t("noTransactionsForAccount")}</p>
        ) : isCard ? (
          <div className="rounded border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-950">
            <table className={`w-full ${tableText} table-fixed`}>
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[20%]" />
                <col className="w-[50%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300`}>{t("type")}</th>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{t("date")}</th>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300`}>{t("description")}</th>
                  <th className={`${thPad} text-right ${thWeight} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{t("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((m) => {
                  const transferLeg =
                    m.type === "transfer"
                      ? m.accountFromId === a.id
                        ? t("transferredTo", { account: m.accountToName })
                        : t("transferredFrom", { account: m.accountFromName })
                      : "";
                  const catLine =
                    m.type === "transfer"
                      ? `${formatCategorySubcategory(m.categoryLabel, m.subcategoryLabel)} — ${transferLeg}`
                      : formatCategorySubcategory(m.categoryLabel, m.subcategoryLabel);
                  return (
                    <tr key={m.id} className={transactionRowBgClass(m.type)}>
                      <td className={`${tdPad} align-top`}>
                        <TransactionTypeIcon type={m.type as "income" | "expense" | "transfer"} className="[&_svg]:h-3 [&_svg]:w-3" />
                      </td>
                      <td className={`${tdPad} align-top whitespace-nowrap text-slate-700 dark:text-slate-300`}>{m.date}</td>
                      <td className={`${tdPad} align-top min-w-0 text-slate-700 dark:text-slate-300`}>
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0 flex-1">
                            <span className="block break-words">{m.description || "—"}</span>
                            <span className={`mt-0.5 block break-words ${transferNote} text-slate-500 dark:text-slate-400`}>{catLine}</span>
                          </div>
                          {m.hasAttachment ? (
                            <div className="shrink-0 text-slate-600 dark:text-slate-400">
                              <TransactionListIndicators
                                hasAttachment
                                isEssential={m.isEssential}
                                ariaAttachment={t("hasAttachment")}
                                ariaEssential={t("essentialExpense")}
                                showEssential={false}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className={`${tdPad} align-top text-right tabular-nums whitespace-nowrap ${m.type === "income"
                          ? "text-green-600 dark:text-green-400"
                          : m.type === "expense"
                            ? "text-red-600 dark:text-red-400"
                            : m.type === "transfer"
                              ? m.accountFromId === a.id
                                ? "text-red-600 dark:text-red-400"
                                : m.accountToId === a.id
                                  ? "text-green-600 dark:text-green-400"
                                  : ""
                              : ""
                          }`}
                      >
                        <span className="block whitespace-nowrap">
                          {hideBalances
                            ? MASK
                            : `${m.type === "income"
                              ? "+"
                              : m.type === "expense"
                                ? "−"
                                : m.type === "transfer"
                                  ? m.accountFromId === a.id
                                    ? "−"
                                    : m.accountToId === a.id
                                      ? "+"
                                      : ""
                                  : ""
                              }${formatCurrency(m.amount)}`}{" "}
                          €
                        </span>
                        <span className={`mt-0.5 block whitespace-nowrap ${balanceAfterNote} text-slate-500 dark:text-slate-400 font-sans`}>
                          {hideBalances ? MASK : `${formatCurrency(m.balanceAfter)} €`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-950">
            <table className={`w-full ${tableText}`}>
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300 w-8`}>{t("type")}</th>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300`}>{t("date")}</th>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300`}>{t("description")}</th>
                  <th className={`${thPad} text-left ${thWeight} text-slate-600 dark:text-slate-300`}>{t("categorySubcategory")}</th>
                  <th className={`${thPad} text-center ${thWeight} text-slate-600 dark:text-slate-300 w-12`}>
                    <span className="sr-only">{t("symbolsColumn")}</span>
                  </th>
                  <th className={`${thPad} text-right ${thWeight} text-slate-600 dark:text-slate-300`}>{t("amount")}</th>
                  <th className={`${thPad} w-20`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((m) => (
                  <tr key={m.id} className={transactionRowBgClass(m.type)}>
                    <td className={tdPad}>
                      <TransactionTypeIcon type={m.type as "income" | "expense" | "transfer"} />
                    </td>
                    <td className={tdPad}>{m.date}</td>
                    <td className={`${tdPad} text-slate-700 dark:text-slate-300 max-w-[180px] truncate`}>
                      <span className="block truncate">{m.description || "—"}</span>
                      {m.type === "transfer" && (
                        <span className={`block ${transferNote} text-slate-500 dark:text-slate-400 truncate`}>
                          {m.accountFromId === a.id
                            ? t("transferredTo", { account: m.accountToName })
                            : t("transferredFrom", { account: m.accountFromName })}
                        </span>
                      )}
                    </td>
                    <td className={`${tdPad} text-slate-600 dark:text-slate-400 max-w-[180px] truncate`}>
                      {formatCategorySubcategory(m.categoryLabel, m.subcategoryLabel)}
                    </td>
                    <td className={`${tdPad} text-slate-600 dark:text-slate-400 align-middle`}>
                      <TransactionListIndicators
                        hasAttachment={m.hasAttachment}
                        isEssential={m.isEssential}
                        ariaAttachment={t("hasAttachment")}
                        ariaEssential={t("essentialExpense")}
                      />
                    </td>
                    <td
                      className={`${tdPad} text-right tabular-nums ${m.type === "income"
                        ? "text-green-600 dark:text-green-400"
                        : m.type === "expense"
                          ? "text-red-600 dark:text-red-400"
                          : m.type === "transfer"
                            ? m.accountFromId === a.id
                              ? "text-red-600 dark:text-red-400"
                              : m.accountToId === a.id
                                ? "text-green-600 dark:text-green-400"
                                : ""
                            : ""
                        }`}
                    >
                      {hideBalances
                        ? MASK
                        : `${m.type === "income"
                          ? "+"
                          : m.type === "expense"
                            ? "−"
                            : m.type === "transfer"
                              ? m.accountFromId === a.id
                                ? "−"
                                : m.accountToId === a.id
                                  ? "+"
                                  : ""
                              : ""
                        }${formatCurrency(m.amount)}`}{" "}
                      €
                      <span className={`block ${balanceAfterNote} text-slate-500 dark:text-slate-400 font-sans mt-0.5`}>
                        {hideBalances ? MASK : `${formatCurrency(m.balanceAfter)} €`}
                      </span>
                    </td>
                    <td className={tdPad}>
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
              className={
                isCard
                  ? "rounded border border-slate-300 px-2 py-1 text-[10px] hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  : "rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
              }
            >
              {full ? t("showLess") : t("seeAll")}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6 text-xs text-slate-500">
        {t("noAccounts")} {" "}
        <Link href="/accounts" className="underline">
          {t("accountsPage")}
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="w-full">
      {layout === "cards" ? (
        <div className="w-full space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
            {accounts.map((a) => {
              const isExpanded = expandedCardAccountIds.has(a.id);
              const spark = cardSparklines[a.id];
              const sparklineLoading = spark === "loading" || spark === undefined;
              const sparklineSeries = Array.isArray(spark) ? spark : null;
              return (
                <PortfolioAccountCard
                  key={a.id}
                  account={a}
                  hideBalances={hideBalances}
                  showInitialBalance={showInitialBalance}
                  showPlafond={showPlafond}
                  pendingAmount={pendingAmounts[a.id]}
                  sparklineSeries={sparklineSeries}
                  sparklineLoading={sparklineLoading}
                  orderEditing={orderEditing}
                  isExpanded={isExpanded}
                  isDragOver={dragOverId === a.id}
                  onOpenChart={() => openChart(a.id)}
                  onToggleExpand={() => toggleExpand(a.id)}
                  onDragStart={(e) => handleDragStart(e, a.id)}
                  onDragOver={(e) => handleDragOver(e, a.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, a.id)}
                  onDragEnd={handleDragEnd}
                  labels={portfolioCardLabels}
                  expandedContent={isExpanded ? renderAccountExpandedSection(a, "card") : undefined}
                />
              );
            })}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 font-medium text-xs text-slate-900 dark:text-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="text-base leading-none opacity-0" aria-hidden>
                  {accountTypeIcon("bank_account")}
                </span>
                {t("total")}
              </span>
              <div className="flex flex-wrap items-end justify-end gap-x-6 gap-y-1">
                {showInitialBalance && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-normal mb-0.5">
                      {t("initialBalance")}
                    </div>
                    <div className="tabular-nums">{fmt(totalInitialBalance, hideBalances)} €</div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-normal mb-0.5">
                    {t("currentBalance")}
                  </div>
                  <div className="tabular-nums">{fmt(totalBalance, hideBalances)} €</div>
                </div>
                {!orderEditing && (
                  <button
                    type="button"
                    onClick={openAllAccountsChart}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 self-center"
                    aria-label={t("viewBalanceEvolution")}
                    title={t("viewBalanceEvolution")}
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
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {orderEditing && <th className="px-4 py-3 w-8" />}
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">{t("account")}</th>
              {showInitialBalance && (
                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">{t("initialBalance")}</th>
              )}
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">{t("currentBalance")}</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">{t("lastUpdate")}</th>
              {!orderEditing && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {accounts.map((a) => {
              const isExpanded = expandedTableAccountId === a.id;

              return (
                <Fragment key={a.id}>
                  <tr
                    onClick={() => !orderEditing && toggleExpand(a.id)}
                    className={
                      orderEditing
                        ? `hover:bg-slate-50/50 dark:hover:bg-white/[0.06] ${dragOverId === a.id ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 ring-inset" : ""}`
                        : "hover:bg-slate-50/50 dark:hover:bg-white/[0.06] cursor-pointer"
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
                          aria-label={t("dragToReorder")}
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(a.initial_balance, hideBalances)} €
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        {showPlafond && a.account_type === "credit_card" && a.plafond != null && a.plafond > 0 && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans truncate">
                            {hideBalances
                              ? MASK
                              : t("plafondInfo", { available: `${fmt(a.plafond + a.current_balance, false)} €`, total: `${fmt(a.plafond, false)} €` })}
                          </span>
                        )}
                        <span className={`min-w-[72px] text-right ${a.current_balance < 0 ? "text-red-600" : ""}`}>
                          {fmt(a.current_balance, hideBalances)} €
                        </span>
                      </div>
                      {(() => {
                        const pending = pendingAmounts?.[a.id];
                        if (pending != null && pending !== 0) {
                          return (
                            <span className="block text-xs text-amber-600 dark:text-amber-400 font-sans mt-0.5">
                              {hideBalances ? MASK : `${fmt(pending, false)} € ${t("pending")}`}
                            </span>
                          );
                        }
                        return null;
                      })()}
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
                            aria-label={t("viewBalanceEvolution")}
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
                            aria-label={isExpanded ? t("collapse") : t("expand")}
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
                        {renderAccountExpandedSection(a, "table")}
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
                  <span>{t("total")}</span>
                </span>
              </td>
              {showInitialBalance && (
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totalInitialBalance, hideBalances)} €
                </td>
              )}
              <td className="px-4 py-3 text-right tabular-nums">
                {fmt(totalBalance, hideBalances)} €
              </td>
              <td className="px-4 py-3" />
              {!orderEditing && (
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={openAllAccountsChart}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                      aria-label={t("viewBalanceEvolution")}
                      title={t("viewBalanceEvolution")}
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
                  </div>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      )}
      {chartAccountId &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto friendly-scroll"
            role="dialog"
            aria-modal="true"
            onClick={() => setChartAccountId(null)}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto friendly-scroll rounded-2xl bg-white dark:bg-[#0b0b0b] border border-slate-200 dark:border-slate-800 p-6 text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{chartAccount?.name ?? t("accountEvolution")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("accountEvolutionSubtitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChartAccountId(null)}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t("close")}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChartRange(opt.key)}
                    className={evolutionSegmentToggleClass(chartRange === opt.key)}
                  >
                    {t(`ranges.${opt.labelKey}`)}
                  </button>
                ))}
                {chartRange === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] bg-white dark:bg-[#111111] text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t("to")}</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] bg-white dark:bg-[#111111] text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-[#0f0f0f]">
                {balanceLoading ? (
                  <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    {t("loadingEvolution")}
                  </div>
                ) : displaySeries.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    {t("noBalanceData")}
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={displaySeries}
                        margin={{ top: 8, right: 22, left: 14, bottom: 4 }}
                        onClick={(e) => {
                          const label = (e as { activeLabel?: string } | null)?.activeLabel;
                          if (label) applyModalFilter("day", label, true);
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          ticks={xAxisMonthTicks}
                          tickFormatter={(v) =>
                            new Date(`${String(v)}T00:00:00`).toLocaleDateString("pt-PT", {
                              month: "2-digit",
                              year: "2-digit",
                            })
                          }
                          tick={{ fontSize: 10 }}
                          interval={0}
                          minTickGap={24}
                          padding={{ left: 8, right: 8 }}
                        />
                        <YAxis
                          tickFormatter={(v: number) => `${formatCurrency(v)} €`}
                          width={80}
                          tick={{ fontSize: 10 }}
                        />
                        {periodMaxBalance != null && (
                          <ReferenceLine
                            y={periodMaxBalance}
                            stroke="#16a34a"
                            strokeDasharray="4 4"
                            ifOverflow="extendDomain"
                          />
                        )}
                        {periodMinBalance != null && (
                          <ReferenceLine
                            y={periodMinBalance}
                            stroke="#dc2626"
                            strokeDasharray="4 4"
                            ifOverflow="extendDomain"
                          />
                        )}
                        <Tooltip
                          formatter={(value: number) => [`${formatCurrency(value)} €`, t("balanceLabel")]}
                          labelFormatter={(label) => String(label)}
                          itemStyle={{ fontSize: 11 }}
                          labelStyle={{ fontSize: 11 }}
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
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t("transactions")}</h4>
                    {modalFilter === "day" && selectedDay && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("day", { date: new Date(selectedDay).toLocaleDateString("pt-PT") })}
                      </p>
                    )}
                    {modalFilter === "period" && showModalTransactions && activePeriod && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("period", { from: activePeriod.from ?? "—", to: activePeriod.to ?? "—" })}
                      </p>
                    )}
                    {modalFilter === "all" && showModalTransactions && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("allTransactions")}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyModalFilter("period", undefined, true)}
                      className={evolutionSegmentToggleClass(modalFilter === "period")}
                    >
                      {t("showPeriod")}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyModalFilter("all", undefined, true)}
                      className={evolutionSegmentToggleClass(modalFilter === "all")}
                    >
                      {t("showAll")}
                    </button>
                  </div>
                </div>

                {modalTransactionsLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("loading")}</p>
                ) : modalTransactions.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("noTransactionsForAccount")}</p>
                ) : (
                  <>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-[#0f0f0f]">
                      <table className="w-full text-[11px] min-w-[640px]">
                        <thead className="bg-slate-100 dark:bg-slate-900">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-10">{t("type")}</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">{t("date")}</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">{t("description")}</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">{t("categorySubcategory")}</th>
                            <th className="px-4 py-2 text-center font-medium text-slate-600 dark:text-slate-300 w-16">
                              <span className="sr-only">{t("symbolsColumn")}</span>
                            </th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">{t("amount")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {modalTransactions.map((m) => (
                            <tr key={m.id} className={transactionRowBgClass(m.type)}>
                              <td className="px-4 py-2">
                                <TransactionTypeIcon type={m.type as "income" | "expense" | "transfer"} />
                              </td>
                              <td className="px-4 py-2">{m.date}</td>
                              <td className="px-4 py-2 text-slate-700 dark:text-slate-300 max-w-[260px] truncate">
                                <span className="block truncate">{m.description || "—"}</span>
                                {m.type === "transfer" && (
                                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {m.accountFromId === chartAccountId
                                      ? t("transferredTo", { account: m.accountToName })
                                      : t("transferredFrom", { account: m.accountFromName })}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400 max-w-[220px] truncate">
                                {formatCategorySubcategory(m.categoryLabel, m.subcategoryLabel)}
                              </td>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400 align-middle">
                                <TransactionListIndicators
                                  hasAttachment={m.hasAttachment}
                                  isEssential={m.isEssential}
                                  ariaAttachment={t("hasAttachment")}
                                  ariaEssential={t("essentialExpense")}
                                />
                              </td>
                              <td
                                className={`px-4 py-2 text-right tabular-nums ${m.type === "income"
                                  ? "text-green-600"
                                  : m.type === "expense"
                                    ? "text-red-600"
                                    : m.type === "transfer"
                                      ? m.accountFromId === chartAccountId
                                        ? "text-red-600"
                                        : m.accountToId === chartAccountId
                                          ? "text-green-600"
                                          : ""
                                      : ""}`}
                              >
                                {hideBalances
                                  ? MASK
                                  : `${m.type === "income"
                                    ? "+"
                                    : m.type === "expense"
                                      ? "−"
                                      : m.type === "transfer"
                                        ? m.accountFromId === chartAccountId
                                          ? "−"
                                          : m.accountToId === chartAccountId
                                            ? "+"
                                            : ""
                                        : ""
                                  }${formatCurrency(m.amount)}`} {" "}
                                €
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                                  {hideBalances ? MASK : `${formatCurrency(m.balanceAfter)} €`}
                                </span>
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
      {chartAllOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto friendly-scroll"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setChartAllOpen(false);
              setChartAllLoading(false);
              setChartAllData([]);
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto friendly-scroll rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{t("accountEvolution")}</h3>
                  <p className="text-sm text-slate-500">{t("accountEvolutionSubtitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChartAllOpen(false);
                    setChartAllLoading(false);
                    setChartAllData([]);
                  }}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t("close")}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChartRange(opt.key)}
                    className={evolutionSegmentToggleClass(chartRange === opt.key)}
                  >
                    {t(`ranges.${opt.labelKey}`)}
                  </button>
                ))}
                {chartRange === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px]"
                    />
                    <span className="text-[11px] text-slate-500">{t("to")}</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px]"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                {chartAllLoading ? (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    {t("loadingEvolution")}
                  </div>
                ) : chartAllData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-500">{t("noBalanceData")}</div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartAllData}
                        margin={{ top: 8, right: 22, left: 14, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          ticks={allXAxisMonthTicks}
                          tickFormatter={(v) =>
                            new Date(`${String(v)}T00:00:00`).toLocaleDateString("pt-PT", {
                              month: "2-digit",
                              year: "2-digit",
                            })
                          }
                          tick={{ fontSize: 10 }}
                          interval={0}
                          minTickGap={24}
                          padding={{ left: 8, right: 8 }}
                        />
                        <YAxis
                          tickFormatter={(v: number) => `${formatCurrency(v)} €`}
                          width={80}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [`${formatCurrency(value)} €`, name]}
                          labelFormatter={(label) => String(label)}
                          itemStyle={{ fontSize: 11 }}
                          labelStyle={{ fontSize: 11 }}
                        />

                        {accounts.map((a, idx) => {
                          if (!chartAllVisibleAccountIds.has(a.id)) return null;
                          const palette = [
                            "#2563eb",
                            "#16a34a",
                            "#dc2626",
                            "#f59e0b",
                            "#8b5cf6",
                            "#0891b2",
                            "#ef4444",
                            "#22c55e",
                            "#a855f7",
                            "#06b6d4",
                          ];
                          const stroke = palette[idx % palette.length];
                          return (
                            <Line
                              key={a.id}
                              type="monotone"
                              dataKey={a.id}
                              stroke={stroke}
                              strokeWidth={2}
                              dot={false}
                              name={a.name}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mt-4">
                {accounts.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("noBalanceData")}</p>
                ) : (
                  <>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      {t("account")}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {accounts.map((a, idx) => {
                        const palette = [
                          "#2563eb",
                          "#16a34a",
                          "#dc2626",
                          "#f59e0b",
                          "#8b5cf6",
                          "#0891b2",
                          "#ef4444",
                          "#22c55e",
                          "#a855f7",
                          "#06b6d4",
                        ];
                        const color = palette[idx % palette.length];
                        const checked = chartAllVisibleAccountIds.has(a.id);
                        return (
                          <label
                            key={a.id}
                            className="inline-flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setChartAllVisibleAccountIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(a.id)) next.delete(a.id);
                                  else next.add(a.id);
                                  return next;
                                });
                              }}
                              className="accent-slate-700"
                            />
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                            <span className="max-w-[150px] truncate">{a.name}</span>
                          </label>
                        );
                      })}
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
