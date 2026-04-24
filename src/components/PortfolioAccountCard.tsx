"use client";

import type { AccountBalancePoint } from "@/app/actions/transactions";
import type { AccountType } from "@/lib/account-types";
import type { ReactNode } from "react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const MASK = "••••••";

function fmt(amount: number, hide: boolean) {
  if (hide) return MASK;
  return amount.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Split "12 345,67" into integer part and ",67" for superscript cents. */
function splitBalanceDisplay(formatted: string) {
  const idx = formatted.lastIndexOf(",");
  if (idx === -1) return { main: formatted, decimals: "" };
  return { main: formatted.slice(0, idx), decimals: formatted.slice(idx) };
}

function pctChangeFromSeries(points: AccountBalancePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].balance;
  const last = points[points.length - 1].balance;
  if (Math.abs(first) < 1e-9) {
    if (Math.abs(last) < 1e-9) return 0;
    return null;
  }
  return ((last - first) / Math.abs(first)) * 100;
}

function downsampleSeries(points: AccountBalancePoint[], max = 48): AccountBalancePoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: AccountBalancePoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    out.push(points[i]);
  }
  const last = points[points.length - 1];
  if (out[out.length - 1]?.date !== last.date) out.push(last);
  return out;
}

export type PortfolioAccountCardAccount = {
  id: string;
  name: string;
  account_type: AccountType;
  initial_balance: number;
  current_balance: number;
  last_update: string | null;
  plafond: number | null;
};

type Props = {
  account: PortfolioAccountCardAccount;
  hideBalances: boolean;
  showInitialBalance: boolean;
  showPlafond: boolean;
  pendingAmount?: number;
  sparklineSeries: AccountBalancePoint[] | null;
  sparklineLoading: boolean;
  orderEditing: boolean;
  isExpanded: boolean;
  isDragOver: boolean;
  onOpenChart: () => void;
  onToggleExpand: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  labels: {
    currentBalance: string;
    initialBalance: string;
    lastUpdate: string;
    pending: string;
    plafondInfo: (p: { available: string; total: string }) => string;
    viewBalanceEvolution: string;
    expand: string;
    collapse: string;
    dragToReorder: string;
    last30Days: string;
  };
  expandedContent?: ReactNode;
};

export function PortfolioAccountCard({
  account: a,
  hideBalances,
  showInitialBalance,
  showPlafond,
  pendingAmount,
  sparklineSeries,
  sparklineLoading,
  orderEditing,
  isExpanded,
  isDragOver,
  onOpenChart,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  labels,
  expandedContent,
}: Props) {
  const gradId = useId().replace(/:/g, "");
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartLeftMargin, setChartLeftMargin] = useState(32);

  useLayoutEffect(() => {
    const el = chartWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setChartLeftMargin(Math.max(8, Math.round(el.clientWidth * 0.4)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chartData = useMemo(() => {
    if (!sparklineSeries?.length) return [];
    return downsampleSeries(sparklineSeries);
  }, [sparklineSeries]);

  const pct = sparklineSeries?.length ? pctChangeFromSeries(sparklineSeries) : null;
  const formattedFull = fmt(a.current_balance, hideBalances);
  const { main: balanceMain, decimals: balanceDecimals } = splitBalanceDisplay(formattedFull);

  const minB = chartData.length ? Math.min(...chartData.map((d) => d.balance)) : 0;
  const maxB = chartData.length ? Math.max(...chartData.map((d) => d.balance)) : 1;
  const pad = Math.max((maxB - minB) * 0.15, 1);

  const plafondVal = a.plafond;
  const hasPlafond =
    showPlafond && a.account_type === "credit_card" && plafondVal != null && plafondVal > 0;
  const hasPending = pendingAmount != null && pendingAmount !== 0;

  const balanceColorClass = hideBalances ? "text-slate-900 dark:text-slate-100" : a.current_balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100";

  return (
    <article
      className={
        orderEditing
          ? `flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition-shadow dark:border-slate-600 dark:bg-slate-950 dark:shadow-none ${
              isDragOver ? "ring-2 ring-slate-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : ""
            }`
          : "flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:shadow-none"
      }
      onDragOver={orderEditing ? onDragOver : undefined}
      onDragLeave={orderEditing ? onDragLeave : undefined}
      onDrop={orderEditing ? onDrop : undefined}
      onDragEnd={orderEditing ? onDragEnd : undefined}
    >
      {/* Header — matches Reports / DashboardCalendar widget strip */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {orderEditing && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <div
                draggable
                onDragStart={onDragStart}
                className="inline-flex touch-none cursor-grab rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 active:cursor-grabbing dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={labels.dragToReorder}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <line x1="8" y1="6" x2="8" y2="18" />
                  <line x1="12" y1="6" x2="12" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="18" />
                </svg>
              </div>
            </div>
          )}
          <h2 className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100" title={a.name}>
            {a.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenChart}
            className="rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={labels.viewBalanceEvolution}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </button>
          {!orderEditing && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? labels.collapse : labels.expand}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden [perspective:1200px]">
        {/* Front — balance, pending/plafond, sparkline, % (DashboardCalendar-style flip) */}
        <div
          className={`absolute inset-0 flex min-h-0 flex-col bg-white px-3 pb-1.5 pt-2 transition-all duration-500 ease-out dark:bg-slate-950 ${
            isExpanded
              ? "pointer-events-none opacity-0 [transform:rotateY(-90deg)_scale(0.97)]"
              : "opacity-100 [transform:rotateY(0deg)_scale(1)]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{labels.currentBalance}</span>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{labels.last30Days}</span>
          </div>

          <div className={`mt-0.5 flex flex-wrap items-baseline gap-x-0.5 text-[2.24rem] font-semibold tabular-nums leading-none ${balanceColorClass}`}>
            {hideBalances ? (
              <span>{MASK}</span>
            ) : (
              <>
                <span>{balanceMain}</span>
                {balanceDecimals ? (
                  <sup className="ml-0.5 align-super text-[0.55em] font-semibold tabular-nums leading-none opacity-95">
                    {balanceDecimals} €
                  </sup>
                ) : (
                  <span className="text-[0.65em] font-semibold">€</span>
                )}
              </>
            )}
          </div>

          {/* Pending then available (plafond); fixed min-height keeps cards aligned (~20% shorter slot) */}
          <div className="mt-1.5 min-h-[2.2rem] space-y-0.5 text-[10px] leading-snug">
            {hasPending && pendingAmount != null && (
              <div className="text-amber-600 dark:text-amber-400/90">
                {hideBalances ? MASK : `${fmt(pendingAmount, false)} € ${labels.pending}`}
              </div>
            )}
            {hasPlafond && plafondVal != null && (
              <div className="text-slate-600 dark:text-slate-400">
                {hideBalances
                  ? MASK
                  : labels.plafondInfo({
                      available: `${fmt(plafondVal + a.current_balance, false)} €`,
                      total: `${fmt(plafondVal, false)} €`,
                    })}
              </div>
            )}
            {!hasPlafond && !hasPending ? <div className="text-transparent select-none">.</div> : null}
          </div>

          <div ref={chartWrapRef} className="relative mt-1 min-h-[5.2rem] flex-1">
            <div className="pointer-events-none absolute inset-0">
              {sparklineLoading || !chartData.length || hideBalances ? (
                <div className="flex h-full items-end pl-[40%]">
                  <div className="h-10 w-full animate-pulse rounded-sm bg-gradient-to-t from-violet-600/15 to-transparent dark:from-violet-500/20" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 6, right: 4, left: chartLeftMargin, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#1e1b4b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={[minB - pad, maxB + pad]} hide width={0} />
                    <XAxis dataKey="date" type="category" hide />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      fill={`url(#${gradId})`}
                      isAnimationActive={chartData.length < 80}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="relative z-[1] flex min-h-[1.4rem] items-end pt-3">
              {pct != null && !hideBalances && !sparklineLoading && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                    pct > 0.05
                      ? "bg-emerald-500/15 text-emerald-400"
                      : pct < -0.05
                        ? "bg-rose-500/15 text-rose-400"
                        : "bg-slate-700/50 text-slate-400"
                  }`}
                >
                  {pct > 0.05 ? (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                      <path d="M6 2 L10 9 H2 Z" />
                    </svg>
                  ) : pct < -0.05 ? (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                      <path d="M6 10 L10 3 H2 Z" />
                    </svg>
                  ) : null}
                  {pct > 0.05 ? "+" : ""}
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Back — transactions (collapse via header chevron only) */}
        <div
          className={`absolute inset-0 flex min-h-0 flex-col bg-white transition-all duration-500 ease-out dark:bg-slate-950 ${
            isExpanded
              ? "opacity-100 [transform:rotateY(0deg)_scale(1)]"
              : "pointer-events-none opacity-0 [transform:rotateY(90deg)_scale(0.97)]"
          }`}
        >
          <div className="friendly-scroll min-h-0 flex-1 overflow-y-auto p-3 text-slate-700 dark:text-slate-300">{expandedContent}</div>
        </div>
      </div>

      {!isExpanded && (
        <footer className="shrink-0 space-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          {showInitialBalance && (
            <div className="flex justify-between gap-2">
              <span>{labels.initialBalance}</span>
              <span className="tabular-nums text-slate-800 dark:text-slate-300">{fmt(a.initial_balance, hideBalances)} €</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span>{labels.lastUpdate}</span>
            <span className="tabular-nums text-slate-800 dark:text-slate-300">
              {a.last_update ? new Date(a.last_update).toLocaleDateString("pt-PT") : "—"}
            </span>
          </div>
        </footer>
      )}
    </article>
  );
}
