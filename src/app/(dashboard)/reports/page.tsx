"use client";

import { useEffect, useState } from "react";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import { ReportsDailySeriesChart } from "@/components/ReportsDailySeriesChart";
import { ReportsMonthEssentialExpenseDonut } from "@/components/ReportsMonthEssentialExpenseDonut";
import { ReportsMonthIncomeExpenseComparison } from "@/components/ReportsMonthIncomeExpenseComparison";
import { ReportsMonthlyPortfolioChart } from "@/components/ReportsMonthlyPortfolioChart";
import { ReportsMonthRadarChart } from "@/components/ReportsMonthRadarChart";
import { getReportsData } from "@/app/actions/reports";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";
import { useTranslations } from "next-intl";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | undefined>(undefined);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const result = await getReportsData();
      setData(result);
      setIsLoading(false);

      // Set initial month to current month
      const now = new Date();
      setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() });
    }

    loadData();
  }, []);

  const handleMonthChange = (year: number, month: number) => {
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
          />
          <ReportsMonthIncomeExpenseComparison
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
          />
          <ReportsMonthRadarChart
            variant="income"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
          />
          <ReportsMonthRadarChart
            variant="expense"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
          />
        </div>
        <div className="flex flex-col 2xl:flex-row flex-wrap gap-6 items-start">
          <ReportsMonthlyPortfolioChart
            dailySeries={data.portfolioDailySeries ?? []}
            currentTotalBalance={Number(data.currentPortfolioBalance ?? 0)}
            selectedMonth={selectedMonth}
          />
          <ReportsMonthEssentialExpenseDonut
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
          />
          <ReportsDailySeriesChart
            variant="income"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
          />
          <ReportsDailySeriesChart
            variant="expense"
            transactions={data.calendarTransactions}
            selectedMonth={selectedMonth}
          />
        </div>
      </section>
    </div>
  );
}
