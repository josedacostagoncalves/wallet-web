"use client";

import { Fragment, useState } from "react";

type CategoryData = {
    category: string;
    subcategory?: string | null;
    total: number;
    monthlyBreakdown?: Record<string, number>;
    monthlyTransactions?: Record<
        string,
        { id: string; date: string; description: string | null; amount: number }[]
    >;
    subcategories?: CategoryData[];
};

type Props = {
    data: CategoryData[];
    type: "income" | "expense";
    dateRange: { start: string; end: string } | null;
};

export function StatementsTable({ data, type, dateRange }: Props) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [hoverPreview, setHoverPreview] = useState<{
        title: string;
        monthLabel: string;
        transactions: { id: string; date: string; description: string | null; amount: number }[];
        x: number;
        y: number;
    } | null>(null);

    const toggleCategory = (category: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
        }
        setExpandedCategories(newExpanded);
    };

    // Generate date columns from dateRange
    const getDateColumns = () => {
        if (!dateRange) return [];
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const columns = [];

        let current = new Date(start);
        while (current <= end) {
            const monthKey = current.toISOString().slice(0, 7); // YYYY-MM
            const monthLabel = current.toLocaleDateString("pt-PT", {
                month: "short",
                year: "2-digit",
            });
            columns.push({ key: monthKey, label: monthLabel, date: new Date(current) });
            current.setMonth(current.getMonth() + 1);
        }

        return columns;
    };

    const dateColumns = getDateColumns();

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatShortDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
        });
    };

    const renderValueCell = (
        value: number,
        monthKey: string,
        monthLabel: string,
        row: CategoryData
    ) => {
        const transactions = row.monthlyTransactions?.[monthKey] ?? [];
        const textClass = value > 0
            ? type === "income"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            : "text-slate-500 dark:text-slate-400";

        if (value <= 0) {
            return <span className={textClass}>—</span>;
        }

        if (transactions.length === 0) {
            return <span className={textClass}>{formatCurrency(value)}</span>;
        }

        return (
            <span
                className={textClass}
                onMouseEnter={(event) => {
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top;
                    setHoverPreview({
                        title: row.subcategory || row.category,
                        monthLabel,
                        transactions,
                        x,
                        y,
                    });
                }}
                onMouseLeave={() => setHoverPreview(null)}
            >
                {formatCurrency(value)}
            </span>
        );
    };

    if (data.length === 0) {
        return (
            <div className="p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                No {type === "income" ? "income" : "expense"} data for this period
            </div>
        );
    }

    const tableWidth = 160 + (dateColumns.length + 1) * 96;
    const monthlyTotals = dateColumns.reduce<Record<string, number>>((acc, col) => {
        acc[col.key] = data.reduce((sum, row) => sum + (row.monthlyBreakdown?.[col.key] ?? 0), 0);
        return acc;
    }, {});
    const grandTotal = data.reduce((sum, row) => sum + row.total, 0);

    return (
        <div className="relative" onMouseLeave={() => setHoverPreview(null)}>
            {hoverPreview && (
                <div
                    className="pointer-events-none fixed z-40 w-80 -translate-x-1/2 -translate-y-2 rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
                    style={{ left: hoverPreview.x, top: hoverPreview.y }}
                >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>{hoverPreview.title}</span>
                        <span>{hoverPreview.monthLabel}</span>
                    </div>
                    <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                        {hoverPreview.transactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="truncate text-slate-600 dark:text-slate-300">
                                    {formatShortDate(tx.date)} · {tx.description || "(Sem descrição)"}
                                </span>
                                <span className={`shrink-0 font-mono ${type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                    {formatCurrency(tx.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="text-xs bg-white dark:bg-slate-950 border-collapse" style={{ width: `${tableWidth}px`, tableLayout: "fixed", borderCollapse: "collapse" }}>
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                        <tr style={{ display: "table-row" }}>
                            <th className="px-3 py-3 text-left font-medium text-slate-600 dark:text-slate-300" style={{ width: "160px", boxSizing: "border-box" }}>
                                Category
                            </th>
                            {dateColumns.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-3 py-3 text-right font-medium text-slate-600 dark:text-slate-300"
                                    style={{ width: "96px", boxSizing: "border-box" }}
                                >
                                    {col.label}
                                </th>
                            ))}
                            <th className="px-3 py-3 text-right font-medium text-slate-600 dark:text-slate-300" style={{ width: "96px", boxSizing: "border-box" }}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.map((row) => {
                            const isExpanded = expandedCategories.has(row.category);
                            const hasSubcategories =
                                row.subcategories && row.subcategories.length > 0;

                            return (
                                <Fragment key={row.category}>
                                    <tr
                                        className={`${type === "income"
                                            ? "hover:bg-green-50 dark:hover:bg-green-900/10"
                                            : "hover:bg-red-50 dark:hover:bg-red-900/10"
                                            } transition-colors ${hasSubcategories ? "cursor-pointer" : ""}`}
                                        onClick={() =>
                                            hasSubcategories && toggleCategory(row.category)
                                        }
                                    >
                                        <td className="px-3 py-3 text-left font-medium text-slate-900 dark:text-slate-100" style={{ width: "160px", boxSizing: "border-box" }}>
                                            <div className="flex items-center gap-2">
                                                {hasSubcategories && (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className={`transition-transform ${isExpanded ? "rotate-90" : ""
                                                            }`}
                                                    >
                                                        <path d="m9 18 6-6-6-6" />
                                                    </svg>
                                                )}
                                                {row.category || "(Uncategorized)"}
                                            </div>
                                        </td>
                                        {dateColumns.map((col) => {
                                            const value = row.monthlyBreakdown?.[col.key] ?? 0;
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-3 text-right font-mono ${value > 0
                                                        ? type === "income"
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-600 dark:text-red-400"
                                                        : "text-slate-500 dark:text-slate-400"
                                                        }`}
                                                    style={{ width: "96px", boxSizing: "border-box" }}
                                                >
                                                    {renderValueCell(value, col.key, col.label, row)}
                                                </td>
                                            );
                                        })}
                                        <td
                                            className={`px-3 py-3 text-right font-mono font-semibold ${type === "income"
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                                }`}
                                            style={{ width: "96px", boxSizing: "border-box" }}
                                        >
                                            {formatCurrency(row.total)}
                                        </td>
                                    </tr>
                                    {isExpanded &&
                                        hasSubcategories &&
                                        row.subcategories?.map((subcategory) => (
                                            <tr
                                                key={`${row.category}-${subcategory.subcategory}`}
                                                className="bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <td className="px-3 py-2 text-left text-slate-700 dark:text-slate-300 pl-12" style={{ width: "160px", boxSizing: "border-box" }}>
                                                    {subcategory.subcategory || "(No subcategory)"}
                                                </td>
                                                {dateColumns.map((col) => {
                                                    const value = subcategory.monthlyBreakdown?.[col.key] ?? 0;
                                                    return (
                                                        <td
                                                            key={col.key}
                                                            className={`px-3 py-2 text-right font-mono text-xs ${value > 0
                                                                ? type === "income"
                                                                    ? "text-green-600 dark:text-green-400"
                                                                    : "text-red-600 dark:text-red-400"
                                                                : "text-slate-500 dark:text-slate-400"
                                                                }`}
                                                            style={{ width: "96px", boxSizing: "border-box" }}
                                                        >
                                                            {renderValueCell(value, col.key, col.label, subcategory)}
                                                        </td>
                                                    );
                                                })}
                                                <td
                                                    className={`px-3 py-2 text-right font-mono text-xs font-semibold ${type === "income"
                                                        ? "text-green-600 dark:text-green-400"
                                                        : "text-red-600 dark:text-red-400"
                                                        }`}
                                                    style={{ width: "96px", boxSizing: "border-box" }}
                                                >
                                                    {formatCurrency(subcategory.total)}
                                                </td>
                                            </tr>
                                        ))}
                                </Fragment>
                            );
                        })}
                    </tbody>
                    <tfoot className="border-t border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <td className="px-3 py-3 text-left font-semibold text-slate-900 dark:text-slate-100" style={{ width: "160px", boxSizing: "border-box" }}>
                                Total
                            </td>
                            {dateColumns.map((col) => {
                                const value = monthlyTotals[col.key] ?? 0;
                                return (
                                    <td
                                        key={col.key}
                                        className={`px-3 py-3 text-right font-mono font-semibold ${value > 0
                                            ? type === "income"
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                            : "text-slate-500 dark:text-slate-400"
                                            }`}
                                        style={{ width: "96px", boxSizing: "border-box" }}
                                    >
                                        {value > 0 ? formatCurrency(value) : "—"}
                                    </td>
                                );
                            })}
                            <td
                                className={`px-3 py-3 text-right font-mono font-bold ${type === "income"
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-red-700 dark:text-red-300"
                                    }`}
                                style={{ width: "96px", boxSizing: "border-box" }}
                            >
                                {formatCurrency(grandTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
