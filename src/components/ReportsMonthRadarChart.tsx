"use client";

import type { CalendarTransaction } from "@/components/DashboardCalendar";
import { formatReportsMonthTitle } from "@/lib/reports-month-title";
import { statementsElapsedMonthCountForRange } from "@/lib/statements-style-average";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const MAX_CATEGORIES = 10;

type Row = { category: string; month: number; average: number };

function normalizeCategoryLabel(label: string): string {
  const s = (label ?? "").trim();
  if (!s || s === "—") return "Uncategorized";
  return s;
}

function buildCategoryRadarRows(
  transactions: CalendarTransaction[],
  year: number,
  month: number,
  txType: "income" | "expense"
): Row[] {
  const rangeStart = `${year}-01-01`;
  const rangeEnd = `${year}-12-31`;
  const elapsed = statementsElapsedMonthCountForRange(rangeStart, rangeEnd);
  const denom = Math.max(elapsed, 1);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthBy: Record<string, number> = {};
  const rangeTotalBy: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.status !== "confirmed" || tx.type !== txType) continue;
    const d = tx.date.slice(0, 10);
    if (d < rangeStart || d > rangeEnd) continue;
    const cat = normalizeCategoryLabel(tx.categoryLabel);
    const amount = Math.abs(Number(tx.amount));
    rangeTotalBy[cat] = (rangeTotalBy[cat] ?? 0) + amount;
    if (tx.date.slice(0, 7) === monthPrefix) {
      monthBy[cat] = (monthBy[cat] ?? 0) + amount;
    }
  }

  const ranked = Object.entries(monthBy)
    .map(([c, v]) => ({ c, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, MAX_CATEGORIES);

  if (ranked.length === 0) return [];

  return ranked.map(({ c }) => ({
    category: c,
    month: monthBy[c] ?? 0,
    average: (rangeTotalBy[c] ?? 0) / denom,
  }));
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncateAxisLabel(s: string, max = 14) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export type ReportsRadarVariant = "income" | "expense";

type Props = {
  transactions: CalendarTransaction[];
  selectedMonth: { year: number; month: number } | undefined;
  variant: ReportsRadarVariant;
};

/** 360×360 to match calendar. Average series uses same formula as Statements "Média" (range total ÷ elapsed months in year). */
export function ReportsMonthRadarChart({ transactions, selectedMonth, variant }: Props) {
  const t = useTranslations("reports.radar");
  const tComp = useTranslations("reports.comparison");
  const tCal = useTranslations("calendar");
  const locale = useLocale();

  const isExpense = variant === "expense";
  const txType: "income" | "expense" = isExpense ? "expense" : "income";

  const { rows, domainMax, monthTitle, monthTypeTotal, peakMonth, categoryCount } = useMemo(() => {
    if (!selectedMonth) {
      return {
        rows: [] as Row[],
        domainMax: 1,
        monthTitle: "",
        monthTypeTotal: 0,
        peakMonth: 0,
        categoryCount: 0,
      };
    }
    const y = selectedMonth.year;
    const m = selectedMonth.month;
    const monthPrefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    let monthTypeTotal = 0;
    for (const tx of transactions) {
      if (tx.status !== "confirmed" || tx.type !== txType) continue;
      if (tx.date.slice(0, 7) !== monthPrefix) continue;
      monthTypeTotal += Math.abs(Number(tx.amount));
    }

    const r = buildCategoryRadarRows(transactions, y, m, txType);
    const monthTitle = formatReportsMonthTitle(m, y, (key) => tCal(key));
    let max = 1;
    let peakMonth = 0;
    for (const x of r) {
      max = Math.max(max, x.month, x.average);
      peakMonth = Math.max(peakMonth, x.month);
    }
    return {
      rows: r,
      domainMax: max,
      monthTitle,
      monthTypeTotal,
      peakMonth,
      categoryCount: r.length,
    };
  }, [transactions, selectedMonth, tCal, txType]);

  if (!selectedMonth) {
    return null;
  }

  const title = isExpense ? t("titleExpenses") : t("titleIncome");
  const empty = isExpense ? t("emptyExpenses") : t("emptyIncome");

  const strokeStrong = isExpense ? "#dc2626" : "#16a34a";
  const fillStrong = isExpense ? "#dc2626" : "#16a34a";
  const strokeLight = isExpense ? "#fca5a5" : "#86efac";
  const fillLight = isExpense ? "#fca5a5" : "#86efac";
  const footerAmountClass = isExpense
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400";
  const footerPrefix = isExpense ? "−" : "+";

  const legendFormatter = (value: string) => (
    <span className="text-slate-600 dark:text-slate-300 text-[10px]">{value}</span>
  );

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
      {rows.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {empty}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full p-1 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
              cx="50%"
              cy="50%"
              outerRadius="68%"
              data={rows}
              margin={{ top: 4, right: 6, bottom: 4, left: 6 }}
            >
              <PolarGrid
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-600"
                strokeWidth={0.5}
              />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 9, fill: "currentColor" }}
                className="text-slate-600 dark:text-slate-400"
                tickFormatter={(v: string) => truncateAxisLabel(v, 13)}
              />
              <PolarRadiusAxis angle={90} domain={[0, domainMax]} tick={false} axisLine={false} />
              <Radar
                name={t("thisMonth")}
                dataKey="month"
                stroke={strokeStrong}
                fill={fillStrong}
                fillOpacity={0.42}
                strokeWidth={1.5}
              />
              <Radar
                name={t("statementsAverage")}
                dataKey="average"
                stroke={strokeLight}
                fill={fillLight}
                fillOpacity={0.28}
                strokeWidth={1.25}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
                      <ul className="space-y-0.5">
                        {payload.map((p) => (
                          <li key={String(p.name)} className="flex justify-between gap-4 tabular-nums">
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
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium px-3 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {isExpense ? tComp("expenses") : tComp("income")}
                </p>
                <p className={`text-xs font-bold tabular-nums mt-0.5 ${footerAmountClass}`}>
                  {footerPrefix}
                  {formatCurrency(monthTypeTotal, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("footerInChart")}
                </p>
                <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                  {categoryCount}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("footerPeak")}
                </p>
                <p className={`text-xs font-bold tabular-nums mt-0.5 ${footerAmountClass}`}>
                  {footerPrefix}
                  {formatCurrency(peakMonth, locale)} €
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
