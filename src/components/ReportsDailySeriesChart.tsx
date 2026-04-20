"use client";

import type { CalendarTransaction } from "@/components/DashboardCalendar";
import { formatReportsMonthTitle } from "@/lib/reports-month-title";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  transactions: CalendarTransaction[];
  selectedMonth: { year: number; month: number } | undefined;
  variant: "income" | "expense";
};

type DayRow = {
  day: number;
  label: string;
  value: number;
  avg: number;
};

function monthDayCount(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function buildDailySeries(
  transactions: CalendarTransaction[],
  year: number,
  month: number,
  variant: "income" | "expense"
): { rows: DayRow[]; total: number; dim: number; avgDaily: number } {
  const dim = monthDayCount(year, month);
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const byDay = new Array<number>(dim + 1).fill(0);
  let total = 0;
  const txType = variant === "income" ? "income" : "expense";

  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    if (tx.date.slice(0, 7) !== prefix) continue;
    if (tx.type !== txType) continue;
    const day = Number.parseInt(tx.date.slice(8, 10), 10);
    if (!Number.isFinite(day) || day < 1 || day > dim) continue;
    const amt = Math.abs(Number(tx.amount));
    byDay[day] += amt;
    total += amt;
  }

  const avgDaily = dim > 0 ? total / dim : 0;
  const mm = String(month + 1).padStart(2, "0");
  const rows: DayRow[] = [];
  for (let d = 1; d <= dim; d++) {
    rows.push({
      day: d,
      label: `${String(d).padStart(2, "0")}.${mm}`,
      value: byDay[d],
      avg: avgDaily,
    });
  }
  return { rows, total, dim, avgDaily };
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 360×360 — daily amounts vs flat daily average for the month (income or expenses only). */
export function ReportsDailySeriesChart({ transactions, selectedMonth, variant }: Props) {
  const t = useTranslations("reports.daily");
  const tComp = useTranslations("reports.comparison");
  const tAvg = useTranslations("reports.radar");
  const tCal = useTranslations("calendar");
  const locale = useLocale();

  const isIncome = variant === "income";
  const stroke = isIncome ? "#16a34a" : "#dc2626";
  const avgStroke = isIncome ? "#86efac" : "#fca5a5";
  const gradientId = isIncome ? "repDailyIncomeGrad" : "repDailyExpenseGrad";
  const amountClass = isIncome ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const avgAmountClass = isIncome ? "text-green-600/90 dark:text-green-400/90" : "text-red-600/90 dark:text-red-400/90";
  const amountPrefix = isIncome ? "+" : "−";

  const { rows, monthTitle, total, dim, avgDaily, hasAny } = useMemo(() => {
    if (!selectedMonth) {
      return { rows: [] as DayRow[], monthTitle: "", total: 0, dim: 0, avgDaily: 0, hasAny: false };
    }
    const { year, month } = selectedMonth;
    const { rows, total, dim, avgDaily } = buildDailySeries(transactions, year, month, variant);
    const monthTitle = formatReportsMonthTitle(month, year, (key) => tCal(key));
    return { rows, monthTitle, total, dim, avgDaily, hasAny: total > 0 };
  }, [transactions, selectedMonth, variant, tCal]);

  if (!selectedMonth) {
    return null;
  }

  const seriesLabel = isIncome ? tComp("income") : tComp("expenses");
  const title = isIncome ? t("titleIncome") : t("titleExpense");
  const empty = isIncome ? t("emptyIncome") : t("emptyExpense");

  return (
    <div className="w-[360px] h-[360px] shrink-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-sm dark:shadow-none">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
          {title}
        </h2>
        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
          {monthTitle}
        </p>
      </div>
      {!hasAny ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {empty}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full p-1 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-slate-200 dark:stroke-slate-700"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "currentColor" }}
                className="text-slate-500 dark:text-slate-400"
                interval="preserveStartEnd"
                tickMargin={4}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "currentColor" }}
                className="text-slate-500 dark:text-slate-400"
                width={36}
                tickFormatter={(v) =>
                  `${Number(v).toLocaleString(locale, { maximumFractionDigits: 0 })}`
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg max-w-[220px]">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
                      <ul className="space-y-0.5">
                        {payload.map((p) => (
                          <li key={String(p.dataKey)} className="flex justify-between gap-4 tabular-nums">
                            <span className="text-slate-600 dark:text-slate-400">{p.name}</span>
                            <span style={{ color: p.color }}>
                              {formatCurrency(Number(p.value ?? 0), locale)} €
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={seriesLabel}
                stroke={stroke}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                name={tAvg("statementsAverage")}
                stroke={avgStroke}
                strokeWidth={1.25}
                strokeDasharray="4 3"
                dot={false}
              />
            </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium px-3 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {seriesLabel}
                </p>
                <p className={`text-xs font-bold tabular-nums mt-0.5 ${amountClass}`}>
                  {amountPrefix}
                  {formatCurrency(total, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {tAvg("statementsAverage")}
                </p>
                <p className={`text-xs font-bold tabular-nums mt-0.5 ${avgAmountClass}`}>
                  {amountPrefix}
                  {formatCurrency(avgDaily, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("footerDaysLabel")}
                </p>
                <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                  {dim}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
