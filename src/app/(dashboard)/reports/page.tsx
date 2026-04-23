"use client";

import { useEffect, useState } from "react";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import { ReportsDailySeriesChart } from "@/components/ReportsDailySeriesChart";
import { ReportsMonthEssentialExpenseDonut } from "@/components/ReportsMonthEssentialExpenseDonut";
import { ReportsMonthIncomeExpenseComparison } from "@/components/ReportsMonthIncomeExpenseComparison";
import { ReportsExpensesByUserEvolutionChart } from "@/components/ReportsExpensesByUserEvolutionChart";
import { ReportsMonthlyPortfolioChart } from "@/components/ReportsMonthlyPortfolioChart";
import { ReportsMonthRadarChart } from "@/components/ReportsMonthRadarChart";
import { getReportsData } from "@/app/actions/reports";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations } from "next-intl";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const { currentWalletId } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | undefined>(undefined);
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setIsLoading(true);
      const result = await getReportsData();
      if (cancelled) return;
      setData(result);
      setIsLoading(false);

      // Set initial month to current month
      const now = new Date();
      setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() });
      setPeriodMode("month");
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [currentWalletId]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedMonth({ year, month });
    setPeriodMode("month");
  };
  const handlePeriodModeChange = (mode: "month" | "year", year: number, month: number) => {
    setPeriodMode(mode);
    setSelectedMonth({ year, month });
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title={t("title")} description={t("description")} />
        <p className="text-slate-600 dark:text-slate-400">{t("loading")}</p>
      </div>
    );
  }

  if (!data.currentWalletId) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title={t("title")} description={t("description")} />
        <p className="text-slate-600 dark:text-slate-400">
          {t("noWallet")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("title")} description={t("description")} />

      <section className="space-y-6">
        <div className="flex flex-col 2xl:flex-row flex-wrap gap-6 items-start">
          <DashboardCalendar
            transactions={data.calendarTransactions}
            recurringNextRuns={data.recurringNextRuns}
            onMonthChange={handleMonthChange}
            onPeriodModeChange={handlePeriodModeChange}
          />
          <ReportsMonthIncomeExpenseComparison
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
            periodMode={periodMode}
          />
          <ReportsMonthRadarChart
            variant="income"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
            periodMode={periodMode}
          />
          <ReportsMonthRadarChart
            variant="expense"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
            periodMode={periodMode}
          />
        </div>
        <div className="flex flex-col 2xl:flex-row flex-wrap gap-6 items-start">
          {data.walletTracksBalances ? (
            <ReportsMonthlyPortfolioChart
              dailySeries={data.portfolioDailySeries ?? []}
              currentTotalBalance={Number(data.currentPortfolioBalance ?? 0)}
              selectedMonth={selectedMonth}
              periodMode={periodMode}
            />
          ) : (
            <ReportsExpensesByUserEvolutionChart
              points={data.expenseByUserDaily ?? []}
              users={data.expenseUsers ?? []}
              selectedMonth={selectedMonth}
              periodMode={periodMode}
            />
          )}
          <ReportsMonthEssentialExpenseDonut
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
            periodMode={periodMode}
          />
          <ReportsDailySeriesChart
            variant="income"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
            periodMode={periodMode}
          />
          <ReportsDailySeriesChart
            variant="expense"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
            periodMode={periodMode}
          />
        </div>
      </section>
    </div>
  );
}
