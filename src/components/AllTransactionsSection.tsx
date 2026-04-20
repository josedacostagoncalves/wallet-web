"use client";

import { TransactionTypeIcon } from "@/components/ActionIcons";
import { AvatarImage } from "@/components/AvatarImage";
import { TransactionListIndicators } from "@/components/TransactionListIndicators";
import { TransactionRowActions } from "@/components/TransactionRowActions";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/transaction-labels";
import { transactionRowBgClass } from "@/lib/transaction-row-style";
import { UserIcon } from "@/components/UserIcon";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

export type ConfirmedRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  observations: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
  paidByMemberName: string | null;
  paidByMemberAvatar: string | null;
  receivedByMemberName: string | null;
  receivedByMemberAvatar: string | null;
  splitMethod: "equally" | "by_income" | "manual" | null;
  hasAttachment: boolean;
  isEssential: boolean;
  /** User-scoped income credited in another wallet (display hint). */
  postedFromWalletName: string | null;
};

type Props = { confirmed: ConfirmedRow[]; isSplitOnly: boolean };

type FilterState = {
  types: Set<string>;
  dateFrom: string;
  dateTo: string;
  category: string;
  subcategory: string;
  amountMin: string;
  amountMax: string;
};

const defaultFilter: FilterState = {
  types: new Set(),
  dateFrom: "",
  dateTo: "",
  category: "",
  subcategory: "",
  amountMin: "",
  amountMax: "",
};

function matchSearch(t: ConfirmedRow, q: string): boolean {
  const qq = q.trim().toLowerCase();
  if (!qq) return true;
  const s = (x: string | null | undefined) => (x ?? "").toLowerCase();
  const amountStr = t.amount.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    s(t.description).includes(qq) ||
    s(t.observations).includes(qq) ||
    s(t.categoryLabel).includes(qq) ||
    s(t.subcategoryLabel).includes(qq) ||
    s(t.accountFromName).includes(qq) ||
    s(t.accountToName).includes(qq) ||
    s(t.paidByMemberName).includes(qq) ||
    s(t.receivedByMemberName).includes(qq) ||
    s(t.splitMethod).includes(qq) ||
    s(t.type).includes(qq) ||
    s(t.date).includes(qq) ||
    amountStr.replace(/\s/g, "").toLowerCase().includes(qq.replace(/\s/g, ""))
  );
}

function filterValue(t: ConfirmedRow): number {
  return Math.abs(t.amount);
}

function matchFilter(t: ConfirmedRow, f: FilterState): boolean {
  if (f.types.size > 0 && !f.types.has(t.type)) return false;
  const d = t.date.slice(0, 10);
  if (f.dateFrom && d < f.dateFrom) return false;
  if (f.dateTo && d > f.dateTo) return false;
  const cat = t.categoryLabel || "—";
  const sub = t.subcategoryLabel || "—";
  if (f.category && cat !== f.category) return false;
  if (f.subcategory && sub !== f.subcategory) return false;
  const v = filterValue(t);
  const min = f.amountMin.trim() ? Number.parseFloat(f.amountMin) : NaN;
  const max = f.amountMax.trim() ? Number.parseFloat(f.amountMax) : NaN;
  if (!Number.isNaN(min) && v < min) return false;
  if (!Number.isNaN(max) && v > max) return false;
  return true;
}

function SortDirectionIcon({ direction }: { direction: "desc" | "asc" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="inline-block shrink-0"
    >
      {direction === "desc" ? <path d="m6 9 6 6 6-6" /> : <path d="m18 15-6-6-6 6" />}
    </svg>
  );
}

function FilterIcon({ className = "" }: { className?: string }) {
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
      className={className}
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function AllTransactionsSection({ confirmed, isSplitOnly }: Props) {
  const t = useTranslations("transactions.allMovements");
  const tType = useTranslations("transactions");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");
  const [periodBlocks, setPeriodBlocks] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);
  const [sortState, setSortState] = useState<{
    key: "date" | "amount" | null;
    direction: "desc" | "asc" | null;
  }>({ key: null, direction: null });
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number } | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const POPOVER_W = 320;

  const { categories, categoryToSubs, maxAmount } = useMemo(() => {
    const cats = new Set<string>();
    const catToSub = new Map<string, Set<string>>();
    let max = 0;
    for (const t of confirmed) {
      const c = t.categoryLabel || "—";
      const s = t.subcategoryLabel || "—";
      cats.add(c);
      if (!catToSub.has(c)) catToSub.set(c, new Set());
      catToSub.get(c)!.add(s);
      const v = filterValue(t);
      if (v > max) max = v;
    }
    return {
      categories: Array.from(cats).sort(),
      categoryToSubs: catToSub,
      maxAmount: max,
    };
  }, [confirmed]);

  const subcategories = useMemo(() => {
    if (!filter.category) {
      const all = new Set<string>();
      for (const s of Array.from(categoryToSubs.values())) {
        for (const x of Array.from(s)) all.add(x);
      }
      return Array.from(all).sort();
    }
    return Array.from(categoryToSubs.get(filter.category) ?? []).sort();
  }, [filter.category, categoryToSubs]);

  const filtered = useMemo(
    () => {
      const query = search.trim();
      if (query) {
        return confirmed.filter((t) => matchSearch(t, query) && matchFilter(t, filter));
      }

      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const totalDays = Math.max(30, periodBlocks * 30);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (totalDays - 1));
      const startKey = start.toISOString().slice(0, 10);
      return confirmed.filter(
        (t) => t.date.slice(0, 10) >= startKey && matchFilter(t, filter)
      );
    },
    [confirmed, search, filter, periodBlocks]
  );

  const setNextSort = useCallback((key: "date" | "amount") => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: "desc" };
      if (prev.direction === "desc") return { key, direction: "asc" };
      return { key: null, direction: null };
    });
  }, []);

  const sortedFiltered = useMemo(() => {
    const rows = [...filtered];
    if (!sortState.key || !sortState.direction) return rows;
    const dir = sortState.direction === "desc" ? -1 : 1;
    if (sortState.key === "date") {
      rows.sort((a, b) => {
        const da = a.date.slice(0, 10);
        const db = b.date.slice(0, 10);
        const c = dir * da.localeCompare(db);
        if (c !== 0) return c;
        return a.id.localeCompare(b.id);
      });
      return rows;
    }
    rows.sort((a, b) => {
      const c = dir * (a.amount - b.amount);
      if (c !== 0) return c;
      return b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)) || a.id.localeCompare(b.id);
    });
    return rows;
  }, [filtered, sortState]);

  const filteredTypeTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;
    let nIncome = 0;
    let nExpense = 0;
    let nTransfer = 0;
    for (const row of filtered) {
      if (row.type === "income") {
        income += row.amount;
        nIncome += 1;
      } else if (row.type === "expense") {
        expense += row.amount;
        nExpense += 1;
      } else if (row.type === "transfer") {
        transfer += row.amount;
        nTransfer += 1;
      }
    }
    const net = income - expense + transfer;
    return { income, expense, transfer, net, nIncome, nExpense, nTransfer };
  }, [filtered]);

  const hasMoreByPeriod = useMemo(() => {
    if (search.trim()) return false;
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const totalDays = Math.max(30, periodBlocks * 30);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (totalDays - 1));
    const startKey = start.toISOString().slice(0, 10);
    return confirmed.some((t) => t.date.slice(0, 10) < startKey);
  }, [confirmed, search, periodBlocks]);

  useEffect(() => {
    if (!search.trim()) return;
    setPeriodBlocks(1);
  }, [search]);

  const hasActiveFilter =
    filter.types.size > 0 ||
    !!filter.dateFrom ||
    !!filter.dateTo ||
    !!filter.category ||
    !!filter.subcategory ||
    !!filter.amountMin.trim() ||
    !!filter.amountMax.trim();

  const showFilteredTotals = !!search.trim() || hasActiveFilter;

  const clearFilter = useCallback(() => {
    setFilter(defaultFilter);
    setFilterOpen(false);
  }, []);

  const updatePopoverPosition = useCallback(() => {
    const btn = filterButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    let left = rect.right - POPOVER_W;
    if (left < 8) left = 8;
    if (left + POPOVER_W > window.innerWidth - 8) left = window.innerWidth - POPOVER_W - 8;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= 400 ? rect.bottom + 4 : Math.max(8, rect.top - 400);
    setPopoverStyle({ top, left });
  }, []);

  useEffect(() => {
    if (!filterOpen) {
      setPopoverStyle(null);
      return;
    }
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [filterOpen, updatePopoverPosition]);

  const toggleType = useCallback((type: string) => {
    setFilter((prev) => {
      const next = new Set(prev.types);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, types: next };
    });
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (filterRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setFilterOpen(false);
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [filterOpen]);

  const splitMethodLabel = (method: ConfirmedRow["splitMethod"]) => {
    if (method === "manual") return "Manual";
    if (method === "by_income") return "By Income";
    if (method === "equally") return "Equal";
    return "—";
  };

  const fmtAmount = (n: number) =>
    n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const memberChip = (name: string | null, avatar: string | null) => {
    if (!name) return <span className="text-slate-400">—</span>;
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <AvatarImage
          src={avatar}
          size={24}
          className="h-6 w-6 rounded-full object-cover"
          fallback={
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <UserIcon className="w-4 h-4" />
            </span>
          }
        />
        <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{name}</span>
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? t("collapse") : t("expand")}
      >
        <span className="text-lg font-medium text-slate-800 dark:text-slate-100">{t("title")}</span>
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
          className={`text-slate-500 dark:text-slate-400 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {expanded && (
        <>
          {confirmed.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/30">
              <div className="flex gap-2 items-center">
                <label htmlFor="all-transactions-search" className="sr-only">
                  {t("searchLabel")}
                </label>
                <div className="relative flex-1 min-w-0">
                  <input
                    id="all-transactions-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 pl-9 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    aria-label={t("searchLabel")}
                  />
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </span>
                  {search.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label={t("clearSearch")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 items-center" ref={filterRef}>
                  <button
                    ref={filterButtonRef}
                    type="button"
                    onClick={() => setFilterOpen((o) => !o)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${hasActiveFilter
                      ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    aria-expanded={filterOpen}
                    aria-haspopup="dialog"
                    aria-label={t("filterLabel")}
                  >
                    <FilterIcon />
                    {t("filter")}
                  </button>
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={clearFilter}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {t("clearAllFilters")}
                    </button>
                  )}
                </div>
                {filterOpen &&
                  popoverStyle &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <div
                      ref={popoverRef}
                      role="dialog"
                      aria-label={t("filterLabel")}
                      className="fixed z-[200] w-80 max-h-[min(400px,calc(100vh-32px))] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-lg"
                      style={{ top: popoverStyle.top, left: popoverStyle.left }}
                    >
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{t("filterDialog.title")}</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">{t("filterDialog.type")}</p>
                          <div className="flex flex-wrap gap-3">
                            {(["income", "expense", "transfer"] as const).map((type) => (
                              <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filter.types.has(type)}
                                  onChange={() => toggleType(type)}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-200">{tType(type)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="filter-date-from" className="block text-xs font-medium text-slate-600 mb-1">{t("filterDialog.fromDate")}</label>
                            <input
                              id="filter-date-from"
                              type="date"
                              value={filter.dateFrom}
                              onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label htmlFor="filter-date-to" className="block text-xs font-medium text-slate-600 mb-1">{t("filterDialog.toDate")}</label>
                            <input
                              id="filter-date-to"
                              type="date"
                              value={filter.dateTo}
                              onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="filter-category" className="block text-xs font-medium text-slate-600 mb-1">{t("filterDialog.category")}</label>
                          <select
                            id="filter-category"
                            value={filter.category}
                            onChange={(e) =>
                              setFilter((f) => ({
                                ...f,
                                category: e.target.value,
                                subcategory: "",
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
                          >
                            <option value="">{t("filterDialog.all")}</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="filter-subcategory" className="block text-xs font-medium text-slate-600 mb-1">{t("filterDialog.subcategory")}</label>
                          <select
                            id="filter-subcategory"
                            value={filter.subcategory}
                            onChange={(e) => setFilter((f) => ({ ...f, subcategory: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
                          >
                            <option value="">{t("filterDialog.all")}</option>
                            {subcategories.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">{t("filterDialog.amountRange")}</p>
                          {(() => {
                            const cap = Math.max(1, maxAmount);
                            const minVal = filter.amountMin.trim()
                              ? Math.min(cap, Math.max(0, Number.parseFloat(filter.amountMin) || 0))
                              : 0;
                            const maxVal = filter.amountMax.trim()
                              ? Math.min(cap, Math.max(0, Number.parseFloat(filter.amountMax) || cap))
                              : cap;
                            const safeMin = Math.min(minVal, maxVal);
                            const safeMax = Math.max(minVal, maxVal);
                            const step = Math.max(0.01, cap / 500);
                            const fmt = (n: number) =>
                              n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            return (
                              <div className="space-y-4">
                                <div>
                                  <div className="flex justify-between items-center gap-2 mb-1">
                                    <label htmlFor="filter-amount-min" className="text-xs text-slate-600 dark:text-slate-300">{t("filterDialog.min")}</label>
                                    <span className="text-xs tabular-nums text-slate-700 dark:text-slate-200">{fmt(safeMin)} €</span>
                                  </div>
                                  <input
                                    id="filter-amount-min"
                                    type="range"
                                    min={0}
                                    max={cap}
                                    step={step}
                                    value={safeMin}
                                    onChange={(e) => {
                                      const v = Math.max(0, Math.min(cap, Number.parseFloat(e.target.value) || 0));
                                      setFilter((f) => {
                                        const curMax = f.amountMax.trim() ? Number.parseFloat(f.amountMax) : cap;
                                        const newMax = v > curMax ? v : curMax;
                                        return {
                                          ...f,
                                          amountMin: v > 0 ? String(v) : "",
                                          amountMax: newMax < cap ? String(newMax) : "",
                                        };
                                      });
                                    }}
                                    className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-700 accent-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:cursor-pointer"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between items-center gap-2 mb-1">
                                    <label htmlFor="filter-amount-max" className="text-xs text-slate-600 dark:text-slate-300">{t("filterDialog.max")}</label>
                                    <span className="text-xs tabular-nums text-slate-700 dark:text-slate-200">{fmt(safeMax)} €</span>
                                  </div>
                                  <input
                                    id="filter-amount-max"
                                    type="range"
                                    min={0}
                                    max={cap}
                                    step={step}
                                    value={safeMax}
                                    onChange={(e) => {
                                      const v = Math.max(0, Math.min(cap, Number.parseFloat(e.target.value) || cap));
                                      setFilter((f) => {
                                        const curMin = f.amountMin.trim() ? Number.parseFloat(f.amountMin) : 0;
                                        const newMin = v < curMin ? v : curMin;
                                        return {
                                          ...f,
                                          amountMin: newMin > 0 ? String(newMin) : "",
                                          amountMax: v < cap ? String(v) : "",
                                        };
                                      });
                                    }}
                                    className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-700 accent-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:cursor-pointer"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("filterDialog.amountHint")}</p>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
            {confirmed.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                {t.rich("empty", {
                  link: (chunks) => (
                    <Link href="/transactions/new" className="underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                {t("noMatch", {
                  criteria: [search.trim() && t("search"), hasActiveFilter && t("filters")]
                    .filter(Boolean)
                    .join(` ${t("searchOr")} `),
                })}
                {(search.trim() || hasActiveFilter) && (
                  <span className="ml-1">
                    {search.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="underline hover:no-underline"
                      >
                        {t("clearSearchLink")}
                      </button>
                    )}
                    {search.trim() && hasActiveFilter && " · "}
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={clearFilter}
                        className="underline hover:no-underline"
                      >
                        {t("clearFiltersLink")}
                      </button>
                    )}
                  </span>
                )}
              </div>
            ) : (
              <>
                <table className="w-full text-xs min-w-[640px] bg-white dark:bg-slate-950 border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-10">{t("table.type")}</th>
                      <th
                        scope="col"
                        aria-sort={
                          sortState.key === "date"
                            ? sortState.direction === "asc"
                              ? "ascending"
                              : sortState.direction === "desc"
                                ? "descending"
                                : "none"
                            : undefined
                        }
                        className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300"
                      >
                        <button
                          type="button"
                          onClick={() => setNextSort("date")}
                          className="inline-flex items-center gap-1 font-medium hover:underline text-left"
                          title={t("table.sortDate")}
                        >
                          {t("table.date")}
                          {sortState.key === "date" && sortState.direction && (
                            <SortDirectionIcon direction={sortState.direction} />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">{t("table.description")}</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        {t("table.categorySubcategory")}
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isSplitOnly ? "Paid by -> Received by" : t("table.fromTo")}
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-slate-600 dark:text-slate-300 w-16">
                        <span className="sr-only">{t("table.symbolsColumn")}</span>
                      </th>
                      {isSplitOnly && (
                        <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Splitting %</th>
                      )}
                      <th
                        scope="col"
                        aria-sort={
                          sortState.key === "amount"
                            ? sortState.direction === "asc"
                              ? "ascending"
                              : sortState.direction === "desc"
                                ? "descending"
                                : "none"
                            : undefined
                        }
                        className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300"
                      >
                        <button
                          type="button"
                          onClick={() => setNextSort("amount")}
                          className="inline-flex items-center justify-end gap-1 font-medium hover:underline w-full text-right"
                          title={t("table.sortAmount")}
                        >
                          {t("table.amount")}
                          {sortState.key === "amount" && sortState.direction && (
                            <SortDirectionIcon direction={sortState.direction} />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sortedFiltered.map((row) => (
                      <tr key={row.id} className={transactionRowBgClass(row.type)}>
                        <td className="px-4 py-2">
                          <TransactionTypeIcon
                            type={row.type as "income" | "expense" | "transfer"}
                            label={tType(row.type as "income" | "expense" | "transfer")}
                          />
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{row.date}</td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200 max-w-[180px] truncate">
                          <span className="block truncate">{row.description || "—"}</span>
                          {row.postedFromWalletName ? (
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {t("postedInWallet", { wallet: row.postedFromWalletName })}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                          {formatCategorySubcategory(row.categoryLabel, row.subcategoryLabel)}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                          {isSplitOnly ? (
                            <div className="flex items-center gap-2 min-w-0">
                              {row.type === "income" ? (
                                <>
                                  <span className="text-slate-400">-&gt;</span>
                                  {memberChip(row.receivedByMemberName, row.receivedByMemberAvatar)}
                                </>
                              ) : row.type === "expense" ? (
                                <>
                                  {memberChip(row.paidByMemberName, row.paidByMemberAvatar)}
                                  <span className="text-slate-400">-&gt;</span>
                                </>
                              ) : (
                                <>
                                  {memberChip(row.paidByMemberName, row.paidByMemberAvatar)}
                                  <span className="text-slate-400">-&gt;</span>
                                  {memberChip(row.receivedByMemberName, row.receivedByMemberAvatar)}
                                </>
                              )}
                            </div>
                          ) : (
                            formatFromTo(row.accountFromName, row.accountToName)
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 align-middle">
                          <TransactionListIndicators
                            hasAttachment={row.hasAttachment}
                            isEssential={row.isEssential}
                            ariaAttachment={t("table.hasAttachment")}
                            ariaEssential={t("table.essentialExpense")}
                          />
                        </td>
                        {isSplitOnly && (
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                            {row.type === "expense" ? splitMethodLabel(row.splitMethod) : "—"}
                          </td>
                        )}
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${row.type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : row.type === "expense"
                              ? "text-red-600 dark:text-red-400"
                              : row.type === "transfer"
                                ? "text-blue-600 dark:text-blue-400"
                                : ""
                            }`}
                        >
                          {row.type === "income" ? "+" : row.type === "expense" ? "−" : ""}
                          {fmtAmount(row.amount)} €
                        </td>
                        <td className="px-4 py-2">
                          <TransactionRowActions id={row.id} status="confirmed" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {showFilteredTotals && filtered.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 font-medium">
                        <td
                          colSpan={6 + (isSplitOnly ? 1 : 0)}
                          className="px-4 py-2.5 text-slate-800 dark:text-slate-100"
                        >
                          {t("table.totalsHeading")}
                          <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                            ({filtered.length})
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right align-top tabular-nums">
                          {(() => {
                            const { income, expense, transfer, net, nIncome, nExpense, nTransfer } = filteredTypeTotals;
                            const typeCount = (nIncome > 0 ? 1 : 0) + (nExpense > 0 ? 1 : 0) + (nTransfer > 0 ? 1 : 0);
                            const line = (label: string, value: string, className: string) => (
                              <div key={`${label}-${value}`} className={`text-xs tabular-nums ${className}`}>
                                <span className="text-slate-600 dark:text-slate-400 mr-1.5 font-sans">{label}</span>
                                <span className="tabular-nums">{value}</span>
                              </div>
                            );
                            if (typeCount <= 1) {
                              if (nIncome > 0) {
                                return (
                                  <div className="text-xs text-green-600 dark:text-green-400 tabular-nums">
                                    +{fmtAmount(income)} €
                                  </div>
                                );
                              }
                              if (nExpense > 0) {
                                return (
                                  <div className="text-xs text-red-600 dark:text-red-400 tabular-nums">
                                    −{fmtAmount(expense)} €
                                  </div>
                                );
                              }
                              if (nTransfer > 0) {
                                return (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 tabular-nums">
                                    {transfer < 0 ? "−" : ""}
                                    {fmtAmount(Math.abs(transfer))} €
                                  </div>
                                );
                              }
                              return null;
                            }
                            return (
                              <div className="space-y-1">
                                {nIncome > 0 &&
                                  line(
                                    `${t("table.totalsIncome")}:`,
                                    `+${fmtAmount(income)} €`,
                                    "text-green-600 dark:text-green-400"
                                  )}
                                {nExpense > 0 &&
                                  line(
                                    `${t("table.totalsExpense")}:`,
                                    `−${fmtAmount(expense)} €`,
                                    "text-red-600 dark:text-red-400"
                                  )}
                                {nTransfer > 0 &&
                                  line(
                                    `${t("table.totalsTransfer")}:`,
                                    `${transfer < 0 ? "−" : ""}${fmtAmount(Math.abs(transfer))} €`,
                                    "text-blue-600 dark:text-blue-400"
                                  )}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-1 mt-1 text-xs tabular-nums text-slate-800 dark:text-slate-100">
                                  <span className="text-slate-600 dark:text-slate-400 mr-1.5 font-sans">{t("table.totalsNet")}:</span>
                                  <span className="tabular-nums font-semibold">
                                    {net >= 0 ? "+" : "−"}
                                    {fmtAmount(Math.abs(net))} €
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
                {!search.trim() && hasMoreByPeriod && (
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setPeriodBlocks((prev) => prev + 1)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {t("showMore30Days")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
