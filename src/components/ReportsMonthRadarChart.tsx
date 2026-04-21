"use client";

import type { CalendarTransaction } from "@/components/DashboardCalendar";
import { ReportDonutBarsToggle } from "@/components/reports/ReportDonutBarsToggle";
import { formatReportsMonthTitle } from "@/lib/reports-month-title";
import { statementsElapsedMonthCountForRange } from "@/lib/statements-style-average";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MAX_CATEGORIES_INCOME = 10;
const MAX_CATEGORIES_EXPENSE = 5;

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
  txType: "income" | "expense",
  maxCategories: number
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
    .slice(0, maxCategories);

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

type ViewMode = "donut" | "bars";

/** 360×360 to match calendar. Average series uses same formula as Statements "Média" (range total ÷ elapsed months in year). */
export function ReportsMonthRadarChart({ transactions, selectedMonth, variant }: Props) {
  const t = useTranslations("reports.radar");
  const tComp = useTranslations("reports.comparison");
  const tCal = useTranslations("calendar");
  const locale = useLocale();
  const [view, setView] = useState<ViewMode>("bars");

  const isExpense = variant === "expense";
  const txType: "income" | "expense" = isExpense ? "expense" : "income";
  const maxCategories = isExpense ? MAX_CATEGORIES_EXPENSE : MAX_CATEGORIES_INCOME;

  const { rows, monthTitle, monthTypeTotal, peakMonth, categoryCount } = useMemo(() => {
    if (!selectedMonth) {
      return {
        rows: [] as Row[],
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

    const r = buildCategoryRadarRows(transactions, y, m, txType, maxCategories);
    const monthTitle = formatReportsMonthTitle(m, y, (key) => tCal(key));
    let max = 1;
    let peakMonth = 0;
    for (const x of r) {
      max = Math.max(max, x.month, x.average);
      peakMonth = Math.max(peakMonth, x.month);
    }
    return {
      rows: r,
      monthTitle,
      monthTypeTotal,
      peakMonth,
      categoryCount: r.length,
    };
  }, [transactions, selectedMonth, tCal, txType, maxCategories]);

  if (!selectedMonth) {
    return null;
  }

  const title = isExpense ? t("titleExpenses") : t("titleIncome");
  const empty = isExpense ? t("emptyExpenses") : t("emptyIncome");

  const palette = isExpense
    ? ["#ef4444", "#f87171", "#fb7185", "#f43f5e", "#dc2626", "#e11d48", "#b91c1c", "#fca5a5", "#be123c", "#fecaca"]
    : ["#22c55e", "#84cc16", "#14b8a6", "#16a34a", "#10b981", "#65a30d", "#4ade80", "#059669", "#bef264", "#2dd4bf"];
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {title}
            </h2>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
              {monthTitle}
            </p>
          </div>
          <ReportDonutBarsToggle
            view={view}
            onViewChange={setView}
            labelDonut={tComp("viewDonut")}
            labelBars={tComp("viewBars")}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {empty}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full p-1 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              {view === "bars" ? (
                <BarChart
                  layout="vertical"
                  data={rows}
                  margin={{ top: 8, right: 10, bottom: 8, left: 8 }}
                  barCategoryGap={12}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    className="stroke-slate-200 dark:stroke-slate-700"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-slate-500 dark:text-slate-400"
                    tickFormatter={(v) =>
                      `${v.toLocaleString(locale, { maximumFractionDigits: 0 })}€`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={100}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-slate-700 dark:text-slate-200"
                    tickFormatter={(v: string) => truncateAxisLabel(v, 16)}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const category = String(label ?? "");
                      const monthVal = Number(
                        payload.find((p) => String(p.dataKey) === "month")?.value ?? 0
                      );
                      const avgVal = Number(
                        payload.find((p) => String(p.dataKey) === "average")?.value ?? 0
                      );
                      return (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{category}</p>
                          <div className="space-y-0.5 tabular-nums">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600 dark:text-slate-400">{t("thisMonth")}</span>
                              <span>{formatCurrency(monthVal, locale)} €</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600 dark:text-slate-400">{t("statementsAverage")}</span>
                              <span>{formatCurrency(avgVal, locale)} €</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="month" name={t("thisMonth")} radius={[0, 6, 6, 0]} barSize={18}>
                    {rows.map((entry, index) => (
                      <Cell key={entry.category} fill={palette[index % palette.length]} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="average"
                    name={t("statementsAverage")}
                    radius={[0, 4, 4, 0]}
                    barSize={8}
                    fill={isExpense ? "#fca5a5" : "#86efac"}
                  />
                </BarChart>
              ) : (
                <PieChart margin={{ top: 4, right: 6, bottom: 4, left: 6 }}>
                  <Pie
                    data={rows}
                    dataKey="month"
                    nameKey="category"
                    cx="50%"
                    cy="48%"
                    innerRadius="42%"
                    outerRadius="70%"
                    paddingAngle={2}
                    stroke="none"
                    labelLine={false}
                    label={({ percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                      if (!percent || percent < 0.06) return null;
                      const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.58;
                      const x = Number(cx) + radius * Math.cos((-midAngle * Math.PI) / 180);
                      const y = Number(cy) + radius * Math.sin((-midAngle * Math.PI) / 180);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="#0a0a0a"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={10}
                          fontWeight={700}
                        >
                          {`${Math.round(percent * 100)}%`}
                        </text>
                      );
                    }}
                  >
                    {rows.map((entry, index) => (
                      <Cell key={entry.category} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const category = String(payload[0]?.name ?? label ?? "");
                      const value = Number(payload[0]?.value ?? 0);
                      const avg = rows.find((r) => r.category === category)?.average ?? 0;
                      return (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                            {category}
                          </p>
                          <div className="space-y-0.5 tabular-nums">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600 dark:text-slate-400">{t("thisMonth")}</span>
                              <span>{formatCurrency(value, locale)} €</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600 dark:text-slate-400">{t("statementsAverage")}</span>
                              <span>{formatCurrency(avg, locale)} €</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10 }}
                    formatter={legendFormatter}
                    iconType="circle"
                    payload={rows.map((r, i) => ({
                      id: r.category,
                      value: truncateAxisLabel(r.category, 18),
                      type: "circle",
                      color: palette[i % palette.length],
                    }))}
                  />
                </PieChart>
              )}
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
