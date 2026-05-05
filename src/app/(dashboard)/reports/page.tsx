"use client";

/** Reports: calendar and charts (staged data + code-split chart modules) for the active wallet. */
import dynamic from "next/dynamic";
import { useEffect, useState, startTransition } from "react";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import { getReportsDataStaged, type ReportsFullPayload } from "@/app/actions/reports";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations } from "next-intl";

const chartLoading = () => (
  <div className="min-h-[220px] w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 animate-pulse" />
);

const ReportsMonthIncomeExpenseComparison = dynamic(
  () =>
    import("@/components/ReportsMonthIncomeExpenseComparison").then((m) => ({
      default: m.ReportsMonthIncomeExpenseComparison,
    })),
  { loading: chartLoading }
);
const ReportsMonthRadarChart = dynamic(
  () =>
    import("@/components/ReportsMonthRadarChart").then((m) => ({
      default: m.ReportsMonthRadarChart,
    })),
  { loading: chartLoading }
);
const ReportsMonthlyPortfolioChart = dynamic(
  () =>
    import("@/components/ReportsMonthlyPortfolioChart").then((m) => ({
      default: m.ReportsMonthlyPortfolioChart,
    })),
  { loading: chartLoading }
);
const ReportsExpensesByUserEvolutionChart = dynamic(
  () =>
    import("@/components/ReportsExpensesByUserEvolutionChart").then((m) => ({
      default: m.ReportsExpensesByUserEvolutionChart,
    })),
  { loading: chartLoading }
);
const ReportsMonthEssentialExpenseDonut = dynamic(
  () =>
    import("@/components/ReportsMonthEssentialExpenseDonut").then((m) => ({
      default: m.ReportsMonthEssentialExpenseDonut,
    })),
  { loading: chartLoading }
);
const ReportsDailySeriesChart = dynamic(
  () =>
    import("@/components/ReportsDailySeriesChart").then((m) => ({
      default: m.ReportsDailySeriesChart,
    })),
  { loading: chartLoading }
);

export default function ReportsPage() {
  const t = useTranslations("reports");
  const { currentWalletId } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ReportsFullPayload | null>(null);
  const [chartsReady, setChartsReady] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | undefined>(undefined);
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setIsLoading(true);
      setChartsReady(false);
      const { primary, secondary } = await getReportsDataStaged();
      if (cancelled) return;
      setData({ ...primary, ...secondary } as ReportsFullPayload);
      setIsLoading(false);

      const now = new Date();
      setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() });
      setPeriodMode("month");

      startTransition(() => {
        if (!cancelled) setChartsReady(true);
      });
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
        <p className="text-slate-600 dark:text-slate-400">{t("noWallet")}</p>
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
          {chartsReady && selectedMonth != null && (
            <>
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
            </>
          )}
        </div>
        {chartsReady && selectedMonth != null && (
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
        )}
      </section>
    </div>
  );
}
