"use client";

import {
    getStatementsTableOrder,
    saveStatementsTableOrder,
    type StatementsTableOrderKey,
} from "@/app/actions/preferences";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

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
    currentWalletId: string | null;
    tableKey: StatementsTableOrderKey;
    title: string;
};

function sortByOrder<T extends { category: string }>(items: T[], order: string[]): T[] {
    if (!order.length) return [...items];
    const rank = (category: string) => {
        const i = order.indexOf(category);
        return i === -1 ? 1e9 : i;
    };
    return [...items].sort((a, b) => rank(a.category) - rank(b.category));
}

function DragHandleIcon() {
    return (
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
            className="text-slate-400"
            aria-hidden
        >
            <line x1="8" y1="6" x2="8" y2="18" />
            <line x1="12" y1="6" x2="12" y2="18" />
            <line x1="16" y1="6" x2="16" y2="18" />
        </svg>
    );
}

export function StatementsTable({ data, type, dateRange, currentWalletId, tableKey, title }: Props) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [orderEditing, setOrderEditing] = useState(false);
    const [editOrder, setEditOrder] = useState<string[] | null>(null);
    const [savedOrder, setSavedOrder] = useState<string[]>([]);
    const [savingOrder, setSavingOrder] = useState(false);
    const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
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

    useEffect(() => {
        if (!currentWalletId) {
            setSavedOrder([]);
            setOrderEditing(false);
            setEditOrder(null);
            return;
        }
        let cancelled = false;
        getStatementsTableOrder(currentWalletId, tableKey).then((order) => {
            if (!cancelled) {
                setSavedOrder(order);
                if (!orderEditing) setEditOrder(null);
            }
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- load preferences when wallet/table changes
    }, [currentWalletId, tableKey]);

    useEffect(() => {
        setOrderEditing(false);
        setEditOrder(null);
    }, [currentWalletId, tableKey]);

    const startReorder = useCallback(() => {
        const currentCategories = data.map((row) => row.category);
        const ids = savedOrder.length
            ? savedOrder.filter((id) => currentCategories.includes(id))
            : currentCategories;
        const extra = currentCategories.filter((id) => !ids.includes(id));
        setEditOrder([...ids, ...extra]);
        setOrderEditing(true);
    }, [savedOrder, data]);

    const saveOrderClick = useCallback(async () => {
        if (editOrder && currentWalletId) {
            setSavingOrder(true);
            await saveStatementsTableOrder(currentWalletId, tableKey, editOrder);
            setSavedOrder(editOrder);
            setSavingOrder(false);
        }
        setOrderEditing(false);
        setEditOrder(null);
    }, [currentWalletId, tableKey, editOrder]);

    const cancelReorder = useCallback(() => {
        setOrderEditing(false);
        setEditOrder(null);
        setDragOverCategory(null);
    }, []);

    const activeOrder = orderEditing && editOrder ? editOrder : savedOrder;
    const orderedData = useMemo(() => sortByOrder(data, activeOrder), [data, activeOrder]);

    const handleDragStart = useCallback((e: React.DragEvent, category: string) => {
        if (!orderEditing) return;
        e.dataTransfer.setData("text/plain", category);
        e.dataTransfer.effectAllowed = "move";
    }, [orderEditing]);

    const handleDragOver = useCallback((e: React.DragEvent, category: string) => {
        if (!orderEditing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverCategory(category);
    }, [orderEditing]);

    const handleDragLeave = useCallback(() => {
        setDragOverCategory(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, dropTargetCategory: string) => {
        if (!orderEditing) return;
        e.preventDefault();
        setDragOverCategory(null);
        const draggedCategory = e.dataTransfer.getData("text/plain");
        if (!draggedCategory || draggedCategory === dropTargetCategory) return;

        const ids = orderedData.map((row) => row.category);
        const from = ids.indexOf(draggedCategory);
        const to = ids.indexOf(dropTargetCategory);
        if (from === -1 || to === -1) return;

        const next = [...ids];
        next.splice(from, 1);
        next.splice(next.indexOf(dropTargetCategory), 0, draggedCategory);
        setEditOrder(next);
    }, [orderEditing, orderedData]);

    const handleDragEnd = useCallback(() => {
        setDragOverCategory(null);
    }, []);

    const getPreviewPosition = (rect: DOMRect) => {
        const tooltipWidth = 320;
        const viewportPadding = 12;
        const sideOffset = 10;

        const preferredRight = rect.right + sideOffset;
        const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;

        let x = preferredRight;
        if (x > maxLeft) {
            x = rect.left - tooltipWidth - sideOffset;
        }
        x = Math.max(viewportPadding, Math.min(x, maxLeft));

        const y = Math.max(
            viewportPadding,
            Math.min(rect.top, window.innerHeight - viewportPadding)
        );

        return { x, y };
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
                    const { x, y } = getPreviewPosition(rect);
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
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-medium text-slate-900 dark:text-white">{title}</h2>
                <div className="flex items-center gap-2">
                    {orderEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={saveOrderClick}
                                disabled={savingOrder}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 disabled:opacity-50"
                            >
                                {savingOrder ? "Saving…" : "Save order"}
                            </button>
                            <button
                                type="button"
                                onClick={cancelReorder}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={startReorder}
                            disabled={!currentWalletId}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
                            aria-label="Reorder categories"
                            title="Reorder categories"
                        >
                            <DragHandleIcon />
                        </button>
                    )}
                </div>
            </div>
            {hoverPreview && (
                <div
                    className="pointer-events-none fixed z-40 w-80 rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
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
                            {orderEditing && (
                                <th className="px-3 py-3 w-10" style={{ width: "40px", boxSizing: "border-box" }} />
                            )}
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
                        {orderedData.map((row) => {
                            const isExpanded = expandedCategories.has(row.category);
                            const hasSubcategories =
                                row.subcategories && row.subcategories.length > 0;

                            return (
                                <Fragment key={row.category}>
                                    <tr
                                        className={`${type === "income"
                                            ? "hover:bg-green-50 dark:hover:bg-green-900/10"
                                            : "hover:bg-red-50 dark:hover:bg-red-900/10"
                                            } transition-colors ${orderEditing
                                                ? dragOverCategory === row.category
                                                    ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 ring-inset"
                                                    : ""
                                                : hasSubcategories
                                                    ? "cursor-pointer"
                                                    : ""
                                            }`}
                                        onClick={() =>
                                            !orderEditing && hasSubcategories && toggleCategory(row.category)
                                        }
                                        onDragOver={orderEditing ? (e) => handleDragOver(e, row.category) : undefined}
                                        onDragLeave={orderEditing ? handleDragLeave : undefined}
                                        onDrop={orderEditing ? (e) => handleDrop(e, row.category) : undefined}
                                        onDragEnd={orderEditing ? handleDragEnd : undefined}
                                    >
                                        {orderEditing && (
                                            <td className="px-3 py-3" style={{ width: "40px", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, row.category)}
                                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-grab active:cursor-grabbing inline-flex touch-none"
                                                    aria-label="Drag to reorder"
                                                >
                                                    <DragHandleIcon />
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-left font-medium text-slate-900 dark:text-slate-100" style={{ width: "160px", boxSizing: "border-box" }}>
                                            <div className="flex items-center gap-2">
                                                {!orderEditing && hasSubcategories && (
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
