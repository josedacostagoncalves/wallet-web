"use client";

import { useEffect, useState } from "react";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { getStatementsByCategory } from "@/app/actions/statements";
import { StatementsTable } from "@/components/StatementsTable";

export default function StatementsPage() {
    const [currentWalletId, setCurrentWalletId] = useState<string | null>(null);
    const [incomeData, setIncomeData] = useState<any[]>([]);
    const [expenseData, setExpenseData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

    // Initialize wallet and set current year as default date range
    useEffect(() => {
        async function init() {
            const cookie = await getWalletCookie();
            setCurrentWalletId(cookie);

            // Default to current year
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
            const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
            setDateRange({ start: yearStart, end: yearEnd });
        }
        init();
    }, []);

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
                    throw new Error("Wallet or date range not loaded");
                }
                const data = await getStatementsByCategory(
                    currentWalletId,
                    dateRange.start,
                    dateRange.end
                );
                setIncomeData(data.income);
                setExpenseData(data.expenses);
                setError(null);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to load statements"
                );
                setIncomeData([]);
                setExpenseData([]);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [currentWalletId, dateRange]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Statements
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    View income and expenses organized by category
                </p>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Period:
                </label>
                <select
                    value={dateRange ? `${dateRange.start}|${dateRange.end}` : ""}
                    onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;

                        if (value === "fullYear") {
                            const now = new Date();
                            const yearStart = new Date(now.getFullYear(), 0, 1)
                                .toISOString()
                                .slice(0, 10);
                            const yearEnd = new Date(now.getFullYear(), 11, 31)
                                .toISOString()
                                .slice(0, 10);
                            setDateRange({ start: yearStart, end: yearEnd });
                        } else {
                            const [start, end] = value.split("|");
                            setDateRange({ start, end });
                        }
                    }}
                    className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                >
                    <option value="">Select period...</option>
                    {/* Monthly options for current year */}
                    {Array.from({ length: 12 }, (_, i) => {
                        const date = new Date(new Date().getFullYear(), i, 1);
                        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
                            .toISOString()
                            .slice(0, 10);
                        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
                            .toISOString()
                            .slice(0, 10);
                        const monthLabel = date.toLocaleDateString("pt-PT", {
                            month: "long",
                            year: "numeric",
                        });
                        return (
                            <option key={i} value={`${monthStart}|${monthEnd}`}>
                                {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
                            </option>
                        );
                    })}
                    <option value="fullYear">Full Year</option>
                </select>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    Loading statements...
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Income Table */}
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            Income
                        </h2>
                        <StatementsTable data={incomeData} type="income" dateRange={dateRange} />
                    </div>

                    {/* Expenses Table */}
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            Expenses
                        </h2>
                        <StatementsTable
                            data={expenseData}
                            type="expense"
                            dateRange={dateRange}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
