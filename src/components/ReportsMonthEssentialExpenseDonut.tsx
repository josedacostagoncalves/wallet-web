"use client";

import type { CalendarTransaction } from "@/components/DashboardCalendar";
import { ReportDonutBarsToggle } from "@/components/reports/ReportDonutBarsToggle";
import {
  CATEGORY_ESSENTIAL_CHART_HEX_DARK,
  CATEGORY_ESSENTIAL_CHART_HEX_LIGHT,
} from "@/lib/category-essential-colors";
import { formatReportsMonthTitle } from "@/lib/reports-month-title";
import { statementsElapsedMonthCountForRange } from "@/lib/statements-style-average";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  transactions: CalendarTransaction[];
  selectedMonth: { year: number; month: number } | undefined;
};

type ViewMode = "donut" | "bars";

type PieRow = { name: string; value: number; fill: string };

const FILL_NON = "#fb7185";

function subscribeHtmlDarkClass(cb: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(cb);
  obs.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function getHtmlHasDarkClass() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 360×360 — monthly essential vs non-essential; donut or bars. */
export function ReportsMonthEssentialExpenseDonut({ transactions, selectedMonth }: Props) {
  const t = useTranslations("reports.essentialSplit");
  const tToggle = useTranslations("reports.comparison");
  const tRadar = useTranslations("reports.radar");
  const tCal = useTranslations("calendar");
  const locale = useLocale();
  const [view, setView] = useState<ViewMode>("donut");
  const isDark = useSyncExternalStore(subscribeHtmlDarkClass, getHtmlHasDarkClass, () => false);
  const fillEssential = isDark ? CATEGORY_ESSENTIAL_CHART_HEX_DARK : CATEGORY_ESSENTIAL_CHART_HEX_LIGHT;

  const metrics = useMemo(() => {
    if (!selectedMonth) {
      return {
        monthTitle: "",
        essential: 0,
        nonEssential: 0,
        total: 0,
        pctNonEssential: 0,
        avgEssential: 0,
        avgNonEssential: 0,
      };
    }
    const { year, month } = selectedMonth;
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    let essential = 0;
    let nonEssential = 0;

    for (const tx of transactions) {
      if (tx.status !== "confirmed" || tx.type !== "expense") continue;
      if (tx.date.slice(0, 7) !== prefix) continue;
      const amt = Math.abs(Number(tx.amount));
      const isEss = tx.isExpenseEssential === true;
      if (isEss) essential += amt;
      else nonEssential += amt;
    }

    const total = essential + nonEssential;
    const pctNonEssential = total > 0 ? Math.round((nonEssential / total) * 100) : 0;
    const monthTitle = formatReportsMonthTitle(month, year, (key) => tCal(key));
    const rangeStart = `${year}-01-01`;
    const rangeEnd = `${year}-12-31`;
    const elapsed = Math.max(1, statementsElapsedMonthCountForRange(rangeStart, rangeEnd));
    let yearEssential = 0;
    let yearNonEssential = 0;
    for (const tx of transactions) {
      if (tx.status !== "confirmed" || tx.type !== "expense") continue;
      const d = tx.date.slice(0, 10);
      if (d < rangeStart || d > rangeEnd) continue;
      const amt = Math.abs(Number(tx.amount));
      if (tx.isExpenseEssential === true) yearEssential += amt;
      else yearNonEssential += amt;
    }

    return {
      monthTitle,
      essential,
      nonEssential,
      total,
      pctNonEssential,
      avgEssential: yearEssential / elapsed,
      avgNonEssential: yearNonEssential / elapsed,
    };
  }, [transactions, selectedMonth, tCal]);

  const legEss = t("legendEssential");
  const legNon = t("legendNonEssential");

  const pieData = useMemo(() => {
    const rows: PieRow[] = [];
    if (metrics.essential > 0) {
      rows.push({ name: legEss, value: metrics.essential, fill: fillEssential });
    }
    if (metrics.nonEssential > 0) {
      rows.push({ name: legNon, value: metrics.nonEssential, fill: FILL_NON });
    }
    return rows;
  }, [metrics.essential, metrics.nonEssential, fillEssential, legEss, legNon]);

  const barChartData = useMemo(() => {
    if (metrics.total <= 0) return [];
    return [
      {
        name: legEss,
        value: metrics.essential,
        average: metrics.avgEssential,
        fill: fillEssential,
        avgFill: "#fde68a",
      },
      {
        name: legNon,
        value: metrics.nonEssential,
        average: metrics.avgNonEssential,
        fill: FILL_NON,
        avgFill: "#fecdd3",
      },
    ];
  }, [
    metrics.total,
    metrics.essential,
    metrics.nonEssential,
    metrics.avgEssential,
    metrics.avgNonEssential,
    fillEssential,
    legEss,
    legNon,
  ]);

  if (!selectedMonth) {
    return null;
  }

  const hasAny = metrics.total > 0;

  return (
    <div className="w-[360px] h-[360px] shrink-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-sm dark:shadow-none">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {t("title")}
            </h2>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
              {metrics.monthTitle}
            </p>
          </div>
          <ReportDonutBarsToggle
            view={view}
            onViewChange={setView}
            labelDonut={tToggle("viewDonut")}
            labelBars={tToggle("viewBars")}
          />
        </div>
      </div>

      {!hasAny ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {t("empty")}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full relative px-2 pt-1 pb-0">
            {view === "bars" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={barChartData}
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
                    width={100}
                    tick={{ fontSize: 10, fill: "currentColor" }}
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
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                  <Bar dataKey="average" name={tRadar("statementsAverage")} radius={[0, 4, 4, 0]} barSize={8}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`avg-cell-${index}`} fill={entry.avgFill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : pieData.length > 0 ? (
              <div className="relative h-full w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="54%"
                      outerRadius="74%"
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={pieData.length > 1 ? 1.5 : 0}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`d-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as PieRow;
                        return (
                          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{item.name}</p>
                            <p className="tabular-nums text-slate-600 dark:text-slate-300">
                              {formatCurrency(item.value, locale)} €
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
                  <span className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {metrics.pctNonEssential}%
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 text-center px-6 leading-tight">
                    {t("donutCenterHint")}
                  </span>
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
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">{legEss}</p>
                <p className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatCurrency(metrics.essential, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">{legNon}</p>
                <p className="text-xs font-bold tabular-nums text-rose-500 dark:text-rose-400 mt-0.5">
                  {formatCurrency(metrics.nonEssential, locale)} €
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t("footerMonthTotal")}
                </p>
                <p className="text-xs font-bold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
                  −{formatCurrency(metrics.total, locale)} €
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
