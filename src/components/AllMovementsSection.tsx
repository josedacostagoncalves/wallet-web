"use client";

import { MovementTypeIcon } from "@/components/ActionIcons";
import { MovementRowActions } from "@/components/MovementRowActions";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/movement-labels";
import { movementRowBgClass } from "@/lib/movement-row-style";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ConfirmedRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
};

type Props = { confirmed: ConfirmedRow[] };

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
    s(t.categoryLabel).includes(qq) ||
    s(t.subcategoryLabel).includes(qq) ||
    s(t.accountFromName).includes(qq) ||
    s(t.accountToName).includes(qq) ||
    s(t.type).includes(qq) ||
    s(t.date).includes(qq) ||
    amountStr.replace(/\s/g, "").toLowerCase().includes(qq.replace(/\s/g, ""))
  );
}

function filterValue(t: ConfirmedRow): number {
  return t.type === "expense" ? Math.abs(t.amount) : t.amount;
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

function FilterIcon({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function AllMovementsSection({ confirmed }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);
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
    () =>
      confirmed.filter(
        (t) => matchSearch(t, search) && matchFilter(t, filter)
      ),
    [confirmed, search, filter]
  );

  const hasActiveFilter =
    filter.types.size > 0 ||
    !!filter.dateFrom ||
    !!filter.dateTo ||
    !!filter.category ||
    !!filter.subcategory ||
    !!filter.amountMin.trim() ||
    !!filter.amountMax.trim();

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
    const closeOnScroll = () => setFilterOpen(false);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", closeOnScroll, true);
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

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse all movements" : "Expand all movements"}
      >
        <span className="text-lg font-medium text-slate-800">All movements</span>
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
          className={`text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {expanded && (
        <>
          {confirmed.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-200 bg-slate-50/80">
              <div className="flex gap-2 items-center">
                <label htmlFor="all-movements-search" className="sr-only">
                  Search movements
                </label>
                <div className="relative flex-1 min-w-0">
                  <input
                    id="all-movements-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search movements…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    aria-label="Search movements"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                      aria-label="Clear search"
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
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      hasActiveFilter
                        ? "border-slate-500 bg-slate-100 text-slate-800"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    aria-expanded={filterOpen}
                    aria-haspopup="dialog"
                    aria-label="Filter movements"
                  >
                    <FilterIcon />
                    Filter
                  </button>
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={clearFilter}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50"
                    >
                      Clear all filters
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
                      aria-label="Filter movements"
                      className="fixed z-[200] w-80 max-h-[min(400px,calc(100vh-32px))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
                      style={{ top: popoverStyle.top, left: popoverStyle.left }}
                    >
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Filter</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-2">Type</p>
                          <div className="flex flex-wrap gap-3">
                            {(["income", "expense", "transfer"] as const).map((type) => (
                              <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filter.types.has(type)}
                                  onChange={() => toggleType(type)}
                                  className="rounded border-slate-300"
                                />
                                <span className="capitalize text-sm text-slate-700">{type}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="filter-date-from" className="block text-xs font-medium text-slate-600 mb-1">From date</label>
                            <input
                              id="filter-date-from"
                              type="date"
                              value={filter.dateFrom}
                              onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="filter-date-to" className="block text-xs font-medium text-slate-600 mb-1">To date</label>
                            <input
                              id="filter-date-to"
                              type="date"
                              value={filter.dateTo}
                              onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="filter-category" className="block text-xs font-medium text-slate-600 mb-1">Category</label>
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
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">All</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="filter-subcategory" className="block text-xs font-medium text-slate-600 mb-1">Subcategory</label>
                          <select
                            id="filter-subcategory"
                            value={filter.subcategory}
                            onChange={(e) => setFilter((f) => ({ ...f, subcategory: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">All</option>
                            {subcategories.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-2">Amount range (€)</p>
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
                                    <label htmlFor="filter-amount-min" className="text-xs text-slate-600">Min</label>
                                    <span className="text-xs font-mono text-slate-700">{fmt(safeMin)} €</span>
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
                                    className="w-full h-2 rounded-lg bg-slate-200 accent-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:cursor-pointer"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between items-center gap-2 mb-1">
                                    <label htmlFor="filter-amount-max" className="text-xs text-slate-600">Max</label>
                                    <span className="text-xs font-mono text-slate-700">{fmt(safeMax)} €</span>
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
                                    className="w-full h-2 rounded-lg bg-slate-200 accent-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:cursor-pointer"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                          <p className="text-xs text-slate-500 mt-1">Expenses use absolute values. Drag to set range.</p>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto border-t border-slate-200">
          {confirmed.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No movements yet.{" "}
              <Link href="/movements/new" className="underline">
                Add one
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No movements match your {[search.trim() && "search", hasActiveFilter && "filters"].filter(Boolean).join(" or ")}.
              {(search.trim() || hasActiveFilter) && (
                <span className="ml-1">
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="underline hover:no-underline"
                    >
                      Clear search
                    </button>
                  )}
                  {search.trim() && hasActiveFilter && " · "}
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={clearFilter}
                      className="underline hover:no-underline"
                    >
                      Clear filters
                    </button>
                  )}
                </span>
              )}
            </div>
          ) : (
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 w-10">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Category :: Subcategory
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">From → To</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((t) => (
                  <tr key={t.id} className={movementRowBgClass(t.type)}>
                    <td className="px-4 py-3">
                      <MovementTypeIcon type={t.type as "income" | "expense" | "transfer"} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {t.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatCategorySubcategory(t.categoryLabel, t.subcategoryLabel)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatFromTo(t.accountFromName, t.accountToName)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        t.type === "income"
                          ? "text-green-600"
                          : t.type === "expense"
                            ? "text-red-600"
                            : ""
                      }`}
                    >
                      {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                      {t.amount.toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </td>
                    <td className="px-4 py-3">
                      <MovementRowActions id={t.id} status="confirmed" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </>
      )}
    </div>
  );
}
