"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import { ReportsWidgets } from "@/components/ReportsWidgets";
import { getReportsData } from "@/app/actions/reports";
import { useTranslations } from "next-intl";

type MonthlyPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

type CalendarTransaction = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
  status: "confirmed" | "pending";
};

type CalendarRecurringNextRun = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
};

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
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{t("description")}</p>
        </div>
        <p className="text-slate-600 dark:text-slate-400">{t("loading")}</p>
      </div>
    );
  }

  if (!data.currentWalletId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{t("description")}</p>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          {t("noWallet")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">{t("description")}</p>
      </div>

      <section>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar */}
          <div className="flex-1">
            <DashboardCalendar
              transactions={data.calendarTransactions}
              recurringNextRuns={data.recurringNextRuns}
              onMonthChange={handleMonthChange}
            />
          </div>
          <div className="lg:w-[520px]">
            <ReportsWidgets
              monthlySeries={data.monthlySeries}
              incomeTotal={data.totalIncome}
              expenseTotal={data.totalExpenses}
              netTotal={data.netTotal}
              avgDailySpend={data.avgDailySpend}
              pendingVsConfirmed={data.pendingVsConfirmed}
              categories={data.chartData}
              defaultPeriodMonths={data.defaultPeriodMonths}
              selectedMonth={selectedMonth}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
