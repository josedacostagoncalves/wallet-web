"use client";

/** Statements by year: income/expense categories or savings/investments tables for the active wallet. */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@/contexts/WalletContext";
import {
  getStatementsByCategory,
  getSavingsInvestmentStatements,
  getAvailableYears,
  type StatementsViewMode,
} from "@/app/actions/statements";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";
import { StatementsTable } from "@/components/StatementsTable";

export default function StatementsPage() {
  const t = useTranslations("statements");
  const { currentWalletId } = useWallet();
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [viewMode, setViewMode] = useState<StatementsViewMode>("incomeExpenses");
  const [savingsInvestmentsData, setSavingsInvestmentsData] = useState<any[]>([]);

  useEffect(() => {
    if (!currentWalletId) {
      setLoading(false);
      setDateRange(null);
      return;
    }
    const walletId = currentWalletId as string;

    let cancelled = false;

    async function loadYearsAndStatements() {
      setLoading(true);
      setError(null);
      try {
        const years = await getAvailableYears(walletId, viewMode);
        if (cancelled) return;
        setAvailableYears(years);

        const currentYear = new Date().getFullYear();
        const effectiveYear = years.includes(selectedYear)
          ? selectedYear
          : years.includes(currentYear)
            ? currentYear
            : years[0] ?? currentYear;

        if (effectiveYear !== selectedYear) {
          setSelectedYear(effectiveYear);
          return;
        }

        const dr = {
          start: `${effectiveYear}-01-01`,
          end: `${effectiveYear}-12-31`,
        };
        setDateRange(dr);

        if (viewMode === "incomeExpenses") {
          const data = await getStatementsByCategory(walletId, dr.start, dr.end);
          if (cancelled) return;
          setIncomeData(data.income);
          setExpenseData(data.expenses);
          setSavingsInvestmentsData([]);
        } else {
          const data = await getSavingsInvestmentStatements(walletId, dr.start, dr.end);
          if (cancelled) return;
          setSavingsInvestmentsData(data);
          setIncomeData([]);
          setExpenseData([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorFailed"));
          setIncomeData([]);
          setExpenseData([]);
          setSavingsInvestmentsData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadYearsAndStatements();
    return () => {
      cancelled = true;
    };
  }, [currentWalletId, viewMode, selectedYear, t]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("title")} description={t("description")} />

      <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("year")}:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-2">{t("view")}:</label>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as StatementsViewMode)}
          className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
        >
          <option value="incomeExpenses">{t("viewModes.incomeExpenses")}</option>
          <option value="savingsInvestments">{t("viewModes.savingsInvestments")}</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">{t("loading")}</div>
      ) : viewMode === "incomeExpenses" ? (
        <div className="space-y-8">
          <div>
            <StatementsTable
              data={incomeData}
              type="income"
              tableKey="income"
              currentWalletId={currentWalletId}
              dateRange={dateRange}
              title={t("income")}
            />
          </div>
          <div>
            <StatementsTable
              data={expenseData}
              type="expense"
              tableKey="expense"
              currentWalletId={currentWalletId}
              dateRange={dateRange}
              title={t("expenses")}
            />
          </div>
        </div>
      ) : (
        <StatementsTable
          data={savingsInvestmentsData}
          type="transfer"
          tableKey="savings_investments"
          currentWalletId={currentWalletId}
          dateRange={dateRange}
          title={t("savingsAndInvestments")}
        />
      )}
    </div>
  );
}
