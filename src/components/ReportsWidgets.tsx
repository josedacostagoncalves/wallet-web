"use client";

import { useMemo, useState } from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type MonthlyPoint = {
    key: string;
    label: string;
    income: number;
    expense: number;
    net: number;
};

type ReportsWidgetsProps = {
    monthlySeries: MonthlyPoint[];
    incomeTotal: number;
    expenseTotal: number;
    netTotal: number;
    avgDailySpend: { current: number; previous: number };
    pendingVsConfirmed: { pending: number; confirmed: number };
    categories: { name: string; value: number }[];
    defaultPeriodMonths: number;
};

type WidgetKey =
    | "income"
    | "expenses"
    | "net"
    | "avgDaily"
    | "pending"
    | "categories";

const PERIOD_OPTIONS = [6, 12, 24];

function formatCurrency(value: number) {
    return value.toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function WidgetCard({
    title,
    value,
    accent,
    className = "",
    onClick,
}: {
    title: string;
    value: string;
    accent: string;
    className?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                "text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400/40 " +
                className
            }
        >
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {title}
            </p>
            <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-semibold ${accent}`}>{value}</span>
            </div>
        </button>
    );
}

export function ReportsWidgets({
    monthlySeries,
    incomeTotal,
    expenseTotal,
    netTotal,
    avgDailySpend,
    pendingVsConfirmed,
    categories,
    defaultPeriodMonths,
}: ReportsWidgetsProps) {
    const [activeWidget, setActiveWidget] = useState<WidgetKey | null>(null);
    const [periodMonths, setPeriodMonths] = useState(defaultPeriodMonths);

    const topCategories = useMemo(
        () => [...categories].sort((a, b) => b.value - a.value).slice(0, 5),
        [categories]
    );

    const periodSeries = useMemo(
        () => monthlySeries.slice(-periodMonths),
        [monthlySeries, periodMonths]
    );

    const modalTitle = useMemo(() => {
        switch (activeWidget) {
            case "income":
                return "Income trend";
            case "expenses":
                return "Expense trend";
            case "net":
                return "Net savings trend";
            case "avgDaily":
                return "Average daily spend";
            case "pending":
                return "Pending vs confirmed";
            case "categories":
                return "Top categories";
            default:
                return "";
        }
    }, [activeWidget]);

    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                <WidgetCard
                    title="Income (This Month)"
                    value={`+${formatCurrency(incomeTotal)} €`}
                    accent="text-green-600"
                    onClick={() => setActiveWidget("income")}
                />
                <WidgetCard
                    title="Expenses (This Month)"
                    value={`−${formatCurrency(expenseTotal)} €`}
                    accent="text-red-600"
                    onClick={() => setActiveWidget("expenses")}
                />
                <WidgetCard
                    title="Net Savings"
                    value={`${netTotal >= 0 ? "+" : "−"}${formatCurrency(Math.abs(netTotal))} €`}
                    accent={netTotal >= 0 ? "text-emerald-600" : "text-rose-600"}
                    className="col-span-2"
                    onClick={() => setActiveWidget("net")}
                />
                <WidgetCard
                    title="Avg Daily Spend"
                    value={`${formatCurrency(avgDailySpend.current)} €`}
                    accent="text-slate-700"
                    onClick={() => setActiveWidget("avgDaily")}
                />
                <WidgetCard
                    title="Pending vs Confirmed"
                    value={`${formatCurrency(pendingVsConfirmed.pending)} €`}
                    accent="text-amber-600"
                    onClick={() => setActiveWidget("pending")}
                />
                <WidgetCard
                    title="Top Categories"
                    value={`${topCategories.length} categories`}
                    accent="text-slate-700"
                    className="col-span-2"
                    onClick={() => setActiveWidget("categories")}
                />
            </div>

            {activeWidget && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setActiveWidget(null)}
                >
                    <div className="absolute inset-0 bg-slate-900/50" />
                    <div
                        className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <h3 className="text-lg font-semibold">{modalTitle}</h3>
                            <button
                                type="button"
                                onClick={() => setActiveWidget(null)}
                                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Close
                            </button>
                        </div>

                        {(activeWidget === "income" ||
                            activeWidget === "expenses" ||
                            activeWidget === "net") && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        {PERIOD_OPTIONS.map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setPeriodMonths(m)}
                                                className={
                                                    "rounded-lg px-3 py-1.5 text-sm border " +
                                                    (periodMonths === m
                                                        ? "border-slate-700 bg-slate-900 text-white"
                                                        : "border-slate-200 dark:border-slate-700 text-slate-600")
                                                }
                                            >
                                                Last {m} months
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={periodSeries}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="label" />
                                                <YAxis />
                                                <Tooltip
                                                    formatter={(value: number) =>
                                                        `${formatCurrency(value)} €`
                                                    }
                                                />
                                                {activeWidget === "income" && (
                                                    <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} />
                                                )}
                                                {activeWidget === "expenses" && (
                                                    <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={2} />
                                                )}
                                                {activeWidget === "net" && (
                                                    <Line type="monotone" dataKey="net" stroke="#0f766e" strokeWidth={2} />
                                                )}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                        {activeWidget === "avgDaily" && (
                            <div className="space-y-2">
                                <p className="text-sm text-slate-600">
                                    Month-to-date average compared with last month.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                                        <p className="text-xs text-slate-500 mb-1">This month</p>
                                        <p className="text-lg font-semibold">
                                            {formatCurrency(avgDailySpend.current)} €
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                                        <p className="text-xs text-slate-500 mb-1">Last month</p>
                                        <p className="text-lg font-semibold">
                                            {formatCurrency(avgDailySpend.previous)} €
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeWidget === "pending" && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600">
                                    This month totals by status.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                                        <p className="text-xs text-slate-500 mb-1">Confirmed</p>
                                        <p className="text-lg font-semibold">
                                            {formatCurrency(pendingVsConfirmed.confirmed)} €
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                                        <p className="text-xs text-slate-500 mb-1">Pending</p>
                                        <p className="text-lg font-semibold">
                                            {formatCurrency(pendingVsConfirmed.pending)} €
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeWidget === "categories" && (
                            <div className="space-y-3">
                                {topCategories.length === 0 ? (
                                    <p className="text-sm text-slate-600">
                                        No expenses in the selected month.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {topCategories.map((c) => (
                                            <li
                                                key={c.name}
                                                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
                                            >
                                                <span className="text-sm text-slate-700 dark:text-slate-200">
                                                    {c.name}
                                                </span>
                                                <span className="text-sm font-semibold">
                                                    {formatCurrency(c.value)} €
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
