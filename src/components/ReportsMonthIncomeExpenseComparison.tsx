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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  transactions: CalendarTransaction[];
  selectedMonth: { year: number; month: number } | undefined;
  periodMode?: "month" | "year";
};

type ViewMode = "donut" | "bars";

function monthIncomeExpenseNet(
  transactions: CalendarTransaction[],
  year: number,
  month: number
): { income: number; expense: number; net: number } {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    if (tx.date.slice(0, 7) !== prefix) continue;
    const amt = Math.abs(Number(tx.amount));
    if (tx.type === "income") income += amt;
    else if (tx.type === "expense") expense += amt;
  }
  return { income, expense, net: income - expense };
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 360×360 like radar cards. Toggle: donut (spent % of income) vs horizontal bars. */
export function ReportsMonthIncomeExpenseComparison({ transactions, selectedMonth, periodMode = "month" }: Props) {
  const t = useTranslations("reports.comparison");
  const tRadar = useTranslations("reports.radar");
  const tCal = useTranslations("calendar");
  const locale = useLocale();
  const [view, setView] = useState<ViewMode>("donut");

  const {
    chartData,
    net,
    monthTitle,
    hasAny,
    income,
    expense,
    donutData,
    centerPercent,
    showCenterPercent,
  } =
    useMemo(() => {
      if (!selectedMonth) {
        return {
          chartData: [] as { name: string; value: number; average: number; fill: string; avgFill: string }[],
          net: 0,
          monthTitle: "",
          hasAny: false,
          income: 0,
          expense: 0,
          donutData: [] as { name: string; value: number; fill: string }[],
          centerPercent: null as number | null,
          showCenterPercent: false,
        };
      }
      const { year, month } = selectedMonth;
      const now = new Date();
      const monthLimit =
        periodMode === "year" && year === now.getFullYear() ? now.getMonth() : 11;
      const monthMetrics =
        periodMode === "year"
          ? monthIncomeExpenseNet(transactions, year, 0)
          : monthIncomeExpenseNet(transactions, year, month);
      let income = monthMetrics.income;
      let expense = monthMetrics.expense;
      if (periodMode === "year") {
        income = 0;
        expense = 0;
        for (const tx of transactions) {
          if (tx.status !== "confirmed") continue;
          if (Number(tx.date.slice(0, 4)) !== year) continue;
          const txMonth = Number.parseInt(tx.date.slice(5, 7), 10) - 1;
          if (txMonth > monthLimit) continue;
          const amt = Math.abs(Number(tx.amount));
          if (tx.type === "income") income += amt;
          else if (tx.type === "expense") expense += amt;
        }
      }
      const net = income - expense;
      const monthTitle =
        periodMode === "year" ? String(year) : formatReportsMonthTitle(month, year, (key) => tCal(key));
      const hasAny = income > 0 || expense > 0;
      const elapsed =
        periodMode === "year"
          ? monthLimit + 1
          : Math.max(1, statementsElapsedMonthCountForRange(`${year}-01-01`, `${year}-12-31`));
      let yearIncome = 0;
      let yearExpense = 0;
      for (const tx of transactions) {
        if (tx.status !== "confirmed") continue;
        if (Number(tx.date.slice(0, 4)) !== year) continue;
        const txMonth = Number.parseInt(tx.date.slice(5, 7), 10) - 1;
        if (txMonth > monthLimit) continue;
        const amt = Math.abs(Number(tx.amount));
        if (tx.type === "income") yearIncome += amt;
        else if (tx.type === "expense") yearExpense += amt;
      }
      const avgIncome = yearIncome / elapsed;
      const avgExpense = yearExpense / elapsed;
      const chartData = [
        { name: t("income"), value: income, average: avgIncome, fill: "#16a34a", avgFill: "#86efac" },
        { name: t("expenses"), value: expense, average: avgExpense, fill: "#dc2626", avgFill: "#fca5a5" },
      ];

      let donutData: { name: string; value: number; fill: string }[] = [];
      let centerPercent: number | null = null;
      let showCenterPercent = false;

      if (income > 0) {
        const spentPct = Math.min(100, (expense / income) * 100);
        const remainingPct = Math.max(0, 100 - spentPct);
        centerPercent = Math.round(spentPct);
        showCenterPercent = true;
        if (remainingPct < 0.01) {
          donutData = [{ name: "spent", value: 100, fill: "#dc2626" }];
        } else if (spentPct < 0.01) {
          donutData = [{ name: "remaining", value: 100, fill: "#16a34a" }];
        } else {
          donutData = [
            { name: "spent", value: spentPct, fill: "#dc2626" },
            { name: "remaining", value: remainingPct, fill: "#16a34a" },
          ];
        }
      } else if (expense > 0) {
        donutData = [{ name: "spent", value: 100, fill: "#dc2626" }];
        showCenterPercent = false;
      }

      return {
        chartData,
        net,
        monthTitle,
        hasAny,
        income,
        expense,
        donutData,
        centerPercent,
        showCenterPercent,
      };
    }, [transactions, selectedMonth, t, tCal, periodMode]);

  if (!selectedMonth) {
    return null;
  }

  return (
    <div className="w-[360px] h-[360px] shrink-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-sm dark:shadow-none">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {t("title")}
            </h2>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
              {monthTitle}
            </p>
          </div>
          <ReportDonutBarsToggle
            view={view}
            onViewChange={setView}
            labelDonut={t("viewDonut")}
            labelBars={t("viewBars")}
          />
        </div>
      </div>

      {!hasAny ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {t("empty")}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full relative px-2 py-2">
            {view === "bars" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
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
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-slate-700 dark:text-slate-200"
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const label = String(payload[0].payload?.name ?? "");
                      const vMonth = Number(
                        payload.find((p) => String(p.dataKey) === "value")?.value ?? 0
                      );
                      const vAvg = Number(
                        payload.find((p) => String(p.dataKey) === "average")?.value ?? 0
                      );
                      return (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{label}</p>
                          <div className="space-y-0.5 tabular-nums text-slate-600 dark:text-slate-300">
                            <p>{tRadar("thisMonth")}: {formatCurrency(vMonth, locale)} €</p>
                            <p>{tRadar("statementsAverage")}: {formatCurrency(vAvg, locale)} €</p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" name={tRadar("thisMonth")} radius={[0, 6, 6, 0]} barSize={18}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                  <Bar dataKey="average" name={tRadar("statementsAverage")} radius={[0, 4, 4, 0]} barSize={8}>
                    {chartData.map((entry, index) => (
                      <Cell key={`avg-cell-${index}`} fill={entry.avgFill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : donutData.length > 0 ? (
              <div className="relative h-full w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="78%"
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={0}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`d-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as { name: string; value: number };
                        const label =
                          item.name === "spent" ? t("donutSpent") : t("donutRemaining");
                        const amt =
                          item.name === "spent"
                            ? expense
                            : Math.max(0, income - expense);
                        return (
                          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{label}</p>
                            <p className="tabular-nums text-slate-600 dark:text-slate-300">
                              {formatCurrency(amt, locale)} €
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
                  {showCenterPercent && centerPercent !== null ? (
                    <>
                      <span className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {centerPercent}%
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 text-center px-6 leading-tight">
                        {t("donutCenterHint")}
                      </span>
                    </>
                  ) : income <= 0 && expense > 0 ? (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 text-center px-4">
                      {t("donutNoIncome")}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-500 dark:text-slate-400 px-4 text-center">
                {t("empty")}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium px-3 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("income")}
                </p>
                <p className="text-xs font-bold tabular-nums text-green-600 dark:text-green-400 mt-0.5">
                  +{formatCurrency(income, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("expenses")}
                </p>
                <p className="text-xs font-bold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
                  −{formatCurrency(expense, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("net")}
                </p>
                <p
                  className={`text-xs font-bold tabular-nums mt-0.5 ${
                    net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {net >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(net), locale)} €
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
