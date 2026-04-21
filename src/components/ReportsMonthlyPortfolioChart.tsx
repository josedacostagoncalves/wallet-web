"use client";

import { formatReportsMonthTitle } from "@/lib/reports-month-title";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DailyPoint = {
  date: string;
  year: number;
  month: number;
  day: number;
  label: string;
  totalBalance: number;
};

type Props = {
  dailySeries: DailyPoint[];
  selectedMonth: { year: number; month: number } | undefined;
  currentTotalBalance: number;
};

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ReportsMonthlyPortfolioChart({
  dailySeries,
  selectedMonth,
  currentTotalBalance,
}: Props) {
  const tPortfolio = useTranslations("reports.portfolio");
  const tDaily = useTranslations("reports.daily");
  const tPlaceholder = useTranslations("reports.placeholder");
  const tCal = useTranslations("calendar");
  const locale = useLocale();

  const { chartRows, monthTitle, beginBalance, endBalance, isCurrentMonth } = useMemo(() => {
    if (!selectedMonth || dailySeries.length === 0) {
      return {
        chartRows: [] as DailyPoint[],
        monthTitle: "",
        beginBalance: 0,
        endBalance: 0,
        isCurrentMonth: false,
      };
    }
    const chartRows = dailySeries.filter(
      (row) => row.year === selectedMonth.year && row.month === selectedMonth.month
    );
    const monthTitle = formatReportsMonthTitle(selectedMonth.month, selectedMonth.year, (key) => tCal(key));
    const beginBalance = chartRows[0]?.totalBalance ?? 0;
    const endBalance = chartRows[chartRows.length - 1]?.totalBalance ?? 0;
    const now = new Date();
    const isCurrentMonth =
      selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
    return { chartRows, monthTitle, beginBalance, endBalance, isCurrentMonth };
  }, [dailySeries, selectedMonth, tCal]);

  if (!selectedMonth) return null;

  return (
    <div className="w-[360px] h-[360px] shrink-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-sm dark:shadow-none">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
          {tPortfolio("title")}
        </h2>
        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
          {monthTitle}
        </p>
      </div>
      {chartRows.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {tPlaceholder("description")}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full p-1 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id="portfolioTotalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
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
                  width={52}
                  tickFormatter={(v) =>
                    `${Number(v).toLocaleString(locale, { maximumFractionDigits: 0 })}`
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const value = Number(payload[0]?.value ?? 0);
                    return (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{label}</p>
                        <p className="tabular-nums text-slate-600 dark:text-slate-300">
                          {tPortfolio("totalBalance")}:{" "}
                          {formatCurrency(value, locale)} €
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="totalBalance"
                  name={tPortfolio("totalBalance")}
                  fill="url(#portfolioTotalGrad)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={14}
                />
                <Line
                  type="monotone"
                  dataKey="totalBalance"
                  name={tPortfolio("totalBalance")}
                  stroke="#fbbf24"
                  strokeWidth={1.65}
                  dot={false}
                  activeDot={{ r: 2.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium px-3 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {tPortfolio("beginBalance")}
                </p>
                <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                  {formatCurrency(beginBalance, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {isCurrentMonth ? tPortfolio("currentBalance") : tPortfolio("endBalance")}
                </p>
                <p className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatCurrency(isCurrentMonth ? currentTotalBalance : endBalance, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {tDaily("footerDaysLabel")}
                </p>
                <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                  {chartRows.length}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

