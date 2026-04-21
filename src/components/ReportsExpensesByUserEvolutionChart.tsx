"use client";

import { formatReportsMonthTitle } from "@/lib/reports-month-title";
import { ReportDonutBarsToggle } from "@/components/reports/ReportDonutBarsToggle";
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

type UserExpensePoint = {
  date: string;
  year: number;
  month: number;
  day: number;
  label: string;
  userId: string;
  userName: string;
  amount: number;
};

type Props = {
  points: UserExpensePoint[];
  users: { userId: string; userName: string }[];
  selectedMonth: { year: number; month: number } | undefined;
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];
type ViewMode = "donut" | "bars";

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportsExpensesByUserEvolutionChart({ points, users, selectedMonth }: Props) {
  const t = useTranslations("reports.expensesByUser");
  const tComp = useTranslations("reports.comparison");
  const tRadar = useTranslations("reports.radar");
  const tDaily = useTranslations("reports.daily");
  const tCal = useTranslations("calendar");
  const locale = useLocale();
  const [view, setView] = useState<ViewMode>("bars");

  const { monthTitle, monthRows, donutData, total, daysWithExpenses } = useMemo(() => {
    if (!selectedMonth) {
      return {
        monthTitle: "",
        monthRows: [] as { id: string; name: string; value: number; average: number; fill: string; avgFill: string }[],
        donutData: [] as { name: string; value: number; pct: number; fill: string }[],
        total: 0,
        daysWithExpenses: 0,
      };
    }
    const monthPoints = points.filter((p) => p.year === selectedMonth.year && p.month === selectedMonth.month);
    const monthByUser = new Map<string, number>();
    for (const p of monthPoints) monthByUser.set(p.userId, (monthByUser.get(p.userId) ?? 0) + p.amount);
    const daysWithExpenses = new Set(monthPoints.map((p) => p.date)).size;
    const yearPoints = points.filter((p) => p.year === selectedMonth.year);
    const yearByUser = new Map<string, number>();
    for (const p of yearPoints) yearByUser.set(p.userId, (yearByUser.get(p.userId) ?? 0) + p.amount);
    const rangeStart = `${selectedMonth.year}-01-01`;
    const rangeEnd = `${selectedMonth.year}-12-31`;
    const elapsed = Math.max(1, statementsElapsedMonthCountForRange(rangeStart, rangeEnd));
    const monthRows = users.map((u, i) => ({
      id: u.userId,
      name: u.userName,
      value: monthByUser.get(u.userId) ?? 0,
      average: (yearByUser.get(u.userId) ?? 0) / elapsed,
      fill: COLORS[i % COLORS.length],
      avgFill: "#cbd5e1",
    }));
    const total = monthRows.reduce((sum, r) => sum + r.value, 0);
    const donutData = monthRows
      .filter((r) => r.value > 0)
      .map((r) => ({
        name: r.name,
        value: r.value,
        pct: total > 0 ? Math.round((r.value / total) * 100) : 0,
        fill: r.fill,
      }));
    const monthTitle = formatReportsMonthTitle(selectedMonth.month, selectedMonth.year, (key) => tCal(key));
    return { monthTitle, monthRows, donutData, total, daysWithExpenses };
  }, [points, users, selectedMonth, tCal]);

  if (!selectedMonth) return null;

  return (
    <div className="w-[360px] h-[360px] shrink-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-sm dark:shadow-none">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{t("title")}</h2>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">{monthTitle}</p>
          </div>
          <ReportDonutBarsToggle
            view={view}
            onViewChange={setView}
            labelDonut={tComp("viewDonut")}
            labelBars={tComp("viewBars")}
          />
        </div>
      </div>
      {monthRows.length === 0 || users.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-[11px] text-slate-500 dark:text-slate-400 px-4">
          {t("empty")}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 w-full p-1 pt-0">
            {view === "bars" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={monthRows}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  barCategoryGap={12}
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-slate-500 dark:text-slate-400"
                    tickFormatter={(v) => `${v.toLocaleString(locale, { maximumFractionDigits: 0 })}€`}
                  />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: "currentColor" }} className="text-slate-700 dark:text-slate-200" />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const label = String(payload[0].payload?.name ?? "");
                      const vMonth = Number(payload.find((p) => String(p.dataKey) === "value")?.value ?? 0);
                      const vAvg = Number(payload.find((p) => String(p.dataKey) === "average")?.value ?? 0);
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
                    {monthRows.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                  <Bar dataKey="average" name={tRadar("statementsAverage")} radius={[0, 4, 4, 0]} barSize={8}>
                    {monthRows.map((entry, index) => (
                      <Cell key={`avg-cell-${index}`} fill={entry.avgFill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : donutData.length > 0 ? (
              <div className="relative h-full w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="46%"
                      innerRadius="50%"
                      outerRadius="82%"
                      dataKey="value"
                      paddingAngle={1.5}
                      stroke="none"
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        const RAD = Math.PI / 180;
                        const r = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.52;
                        const x = Number(cx) + r * Math.cos(-Number(midAngle) * RAD);
                        const y = Number(cy) + r * Math.sin(-Number(midAngle) * RAD);
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="#111111"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={11}
                            fontWeight={700}
                          >
                            {`${Math.round((percent ?? 0) * 100)}%`}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`d-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as { name: string; value: number; pct: number };
                        return (
                          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{item.name}</p>
                            <p className="tabular-nums text-slate-600 dark:text-slate-300">
                              {formatCurrency(item.value, locale)} € ({item.pct}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute bottom-1 left-0 right-0 px-2">
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]">
                    {donutData.map((row, idx) => (
                      <div key={`${row.name}-${idx}`} className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.fill }} />
                        <span className="text-slate-700 dark:text-slate-200">{row.name}</span>
                      </div>
                    ))}
                  </div>
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
              <div>
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">{t("users")}</p>
                <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{users.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">{t("total")}</p>
                <p className="text-xs font-bold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
                  {formatCurrency(total, locale)} €
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">{tDaily("footerDaysLabel")}</p>
                <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{daysWithExpenses}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

