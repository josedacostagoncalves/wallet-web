"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@/contexts/WalletContext";
import {
    getStatementsByCategory,
    getSavingsInvestmentStatements,
    getAvailableYears,
    type StatementsViewMode,
} from "@/app/actions/statements";
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

    // Fetch available years based on selected view mode
    useEffect(() => {
        if (!currentWalletId) return;
        const walletId = currentWalletId;
        async function loadYears() {
            const years = await getAvailableYears(walletId, viewMode);
            setAvailableYears(years);
            const currentYear = new Date().getFullYear();
            setSelectedYear((prev) => {
                if (years.includes(prev)) return prev;
                if (years.includes(currentYear)) return currentYear;
                return years[0] ?? currentYear;
            });
        }
        loadYears();
    }, [currentWalletId, viewMode]);

    // Update date range when selected year changes
    useEffect(() => {
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        setDateRange({ start: yearStart, end: yearEnd });
    }, [selectedYear]);

    // Fetch data when wallet or date range changes
    useEffect(() => {
        if (!currentWalletId || !dateRange) {
            setLoading(false);
            return;
        }

        async function loadData() {
            setLoading(true);
            try {
                if (!currentWalletId || !dateRange) {
                    throw new Error(t("errorLoading"));
                }
                if (viewMode === "incomeExpenses") {
                    const data = await getStatementsByCategory(
                        currentWalletId,
                        dateRange.start,
                        dateRange.end
                    );
                    setIncomeData(data.income);
                    setExpenseData(data.expenses);
                    setSavingsInvestmentsData([]);
                } else {
                    const data = await getSavingsInvestmentStatements(
                        currentWalletId,
                        dateRange.start,
                        dateRange.end
                    );
                    setSavingsInvestmentsData(data);
                    setIncomeData([]);
                    setExpenseData([]);
                }
                setError(null);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : t("errorFailed")
                );
                setIncomeData([]);
                setExpenseData([]);
                setSavingsInvestmentsData([]);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [currentWalletId, dateRange, viewMode, t]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {t("title")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t("description")}
                </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t("year")}:
                </label>
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-2">
                    {t("view")}:
                </label>
                <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as StatementsViewMode)}
                    className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                >
                    <option value="incomeExpenses">{t("viewModes.incomeExpenses")}</option>
                    <option value="savingsInvestments">{t("viewModes.savingsInvestments")}</option>
                </select>
            </div>

            {/* Error Message */}
            {
                error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )
            }

            {/* Loading State */}
            {
                loading ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t("loading")}
                    </div>
                ) : (
                    viewMode === "incomeExpenses" ? (
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
                    )
                )
            }
        </div >
    );
}
