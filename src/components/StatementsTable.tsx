"use client";

import {
    getStatementsTableOrder,
    saveStatementsTableOrder,
    getStatementsHideBalances,
    saveStatementsHideBalances,
    type StatementsTableOrderKey,
} from "@/app/actions/preferences";
import { useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    Brush,
    Bar,
    BarChart,
    Cell,
    CartesianGrid,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

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
    type: "income" | "expense" | "transfer";
    dateRange: { start: string; end: string } | null;
    currentWalletId: string | null;
    tableKey: StatementsTableOrderKey;
    title: string;
};

const MASK = "••••••";

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

function EyeIcon({ hidden }: { hidden: boolean }) {
    if (hidden) {
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
                aria-hidden
            >
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.576 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-4.963" />
                <path d="m2 2 20 20" />
            </svg>
        );
    }
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
            aria-hidden
        >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function SortDirectionIcon({ direction }: { direction: "desc" | "asc" }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="inline-block"
        >
            {direction === "desc" ? <path d="m6 9 6 6 6-6" /> : <path d="m18 15-6-6-6 6" />}
        </svg>
    );
}

export function StatementsTable({ data, type, dateRange, currentWalletId, tableKey, title }: Props) {
    const t = useTranslations("statements");
    const tCommon = useTranslations("common");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [hideBalances, setHideBalances] = useState(false);
    const [orderEditing, setOrderEditing] = useState(false);
    const [editOrder, setEditOrder] = useState<{ categories: string[]; subcategories: Record<string, string[]> } | null>(null);
    const [savedOrder, setSavedOrder] = useState<{ categories: string[]; subcategories: Record<string, string[]> }>({
        categories: [],
        subcategories: {},
    });
    const [savingOrder, setSavingOrder] = useState(false);
    const [dragOverItem, setDragOverItem] = useState<{ type: "category" | "subcategory"; categoryName: string; subcategoryName?: string } | null>(null);
    const [hoverPreview, setHoverPreview] = useState<{
        title: string;
        monthLabel: string;
        transactions: { id: string; date: string; description: string | null; amount: number }[];
        x: number;
        y: number;
    } | null>(null);
    const [chartTarget, setChartTarget] = useState<{
        title: string;
        monthlyBreakdown: Record<string, number>;
    } | null>(null);
    const [chartTotalsOpen, setChartTotalsOpen] = useState(false);
    const [chartTotalsVisibleCategories, setChartTotalsVisibleCategories] = useState<Set<string>>(new Set());
    const [chartTotalsView, setChartTotalsView] = useState<"bar" | "pie">("bar");
    const [pieMonthKey, setPieMonthKey] = useState<string | null>(null);
    const [sortState, setSortState] = useState<{ key: string | null; direction: "desc" | "asc" | null }>({
        key: null,
        direction: null,
    });
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const rowHoverClass =
        type === "income"
            ? "hover:bg-green-50 dark:hover:bg-green-900/10"
            : type === "expense"
                ? "hover:bg-red-50 dark:hover:bg-red-900/10"
                : "hover:bg-blue-50 dark:hover:bg-blue-900/10";
    const valueColorClass = (value: number) =>
        value > 0
            ? type === "income"
                ? "text-green-600 dark:text-green-400"
                : type === "expense"
                    ? "text-red-600 dark:text-red-400"
                    : "text-blue-600 dark:text-blue-400"
            : "text-slate-500 dark:text-slate-400";
    const summaryColorClass =
        type === "income"
            ? "text-green-600 dark:text-green-400"
            : type === "expense"
                ? "text-red-600 dark:text-red-400"
                : "text-blue-600 dark:text-blue-400";
    const summaryStrongColorClass =
        type === "income"
            ? "text-green-700 dark:text-green-300"
            : type === "expense"
                ? "text-red-700 dark:text-red-300"
                : "text-blue-700 dark:text-blue-300";

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
        const startYear = Number(dateRange.start.slice(0, 4));
        const startMonth = Number(dateRange.start.slice(5, 7));
        const endYear = Number(dateRange.end.slice(0, 4));
        const endMonth = Number(dateRange.end.slice(5, 7));
        const columns: Array<{ key: string; label: string; date: Date }> = [];

        let year = startYear;
        let month = startMonth;
        while (year < endYear || (year === endYear && month <= endMonth)) {
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;
            const monthDate = new Date(Date.UTC(year, month - 1, 1));
            const monthLabel = monthDate.toLocaleDateString("pt-PT", {
                month: "short",
                year: "2-digit",
                timeZone: "UTC",
            });
            columns.push({ key: monthKey, label: monthLabel, date: monthDate });

            month += 1;
            if (month > 12) {
                month = 1;
                year += 1;
            }
        }

        return columns;
    };

    const dateColumns = getDateColumns();

    const openTotalsChart = useCallback(() => {
        // Default unchecked if a category has no monthly values in the selected range.
        const initial = new Set(
            data
                .filter((row) => dateColumns.some((col) => (row.monthlyBreakdown?.[col.key] ?? 0) > 0))
                .map((row) => row.category)
        );
        setChartTotalsVisibleCategories(initial);
        setChartTotalsView("bar");
        setPieMonthKey(dateColumns[0]?.key ?? null);
        setChartTotalsOpen(true);
    }, [data, dateColumns]);
    const elapsedMonthCount = (() => {
        if (!dateRange) return 1;
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const now = new Date();
        const effectiveEnd = now < end ? now : end;

        if (effectiveEnd < start) return 0;

        return (
            (effectiveEnd.getFullYear() - start.getFullYear()) * 12 +
            (effectiveEnd.getMonth() - start.getMonth()) +
            1
        );
    })();

    const setNextSort = useCallback(
        (key: string) => {
            if (orderEditing) return;
            setSortState((prev) => {
                if (prev.key !== key) return { key, direction: "desc" };
                if (prev.direction === "desc") return { key, direction: "asc" };
                return { key: null, direction: null };
            });
        },
        [orderEditing]
    );

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
            setSavedOrder({ categories: [], subcategories: {} });
            setHideBalances(false);
            setOrderEditing(false);
            setEditOrder(null);
            setPrefsLoaded(true);
            return;
        }
        let cancelled = false;
        setPrefsLoaded(false);
        Promise.all([
            getStatementsTableOrder(currentWalletId, tableKey),
            getStatementsHideBalances(currentWalletId),
        ]).then(([order, hidden]) => {
            if (cancelled) return;
            // Handle both old format (array of strings) and new format (nested object)
            if (Array.isArray(order)) {
                setSavedOrder({ categories: order, subcategories: {} });
            } else {
                setSavedOrder(
                    order as { categories: string[]; subcategories: Record<string, string[]> }
                );
            }
            setHideBalances(hidden);
            setEditOrder(null);
            setPrefsLoaded(true);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- load preferences when wallet/table changes
    }, [currentWalletId, tableKey]);

    useEffect(() => {
        setOrderEditing(false);
        setEditOrder(null);
        setSortState({ key: null, direction: null });
    }, [currentWalletId, tableKey]);

    useEffect(() => {
        if (!sortState.key || sortState.key === "average" || sortState.key === "total") return;
        const exists = dateColumns.some((col) => col.key === sortState.key);
        if (!exists) {
            setSortState({ key: null, direction: null });
        }
    }, [dateColumns, sortState.key]);

    const toggleHide = useCallback(async () => {
        if (!currentWalletId) return;
        const newValue = !hideBalances;
        setHideBalances(newValue);
        await saveStatementsHideBalances(currentWalletId, newValue);
    }, [hideBalances, currentWalletId]);

    const startReorder = useCallback(() => {
        const currentCategories = data.map((row) => row.category);
        const categoryOrder = savedOrder.categories.length
            ? savedOrder.categories.filter((id) => currentCategories.includes(id))
            : currentCategories;
        const extra = currentCategories.filter((id) => !categoryOrder.includes(id));
        const finalCategoryOrder = [...categoryOrder, ...extra];

        const newSubcategoryOrder: Record<string, string[]> = {};
        data.forEach((cat) => {
            const subcats = cat.subcategories?.map((s) => s.subcategory || "") ?? [];
            const savedSubs = savedOrder.subcategories[cat.category] ?? [];
            const orderedSubs = savedSubs.length
                ? savedSubs.filter((sub) => subcats.includes(sub))
                : subcats;
            const extra = subcats.filter((sub) => !orderedSubs.includes(sub));
            newSubcategoryOrder[cat.category] = [...orderedSubs, ...extra];
        });

        setEditOrder({
            categories: finalCategoryOrder,
            subcategories: newSubcategoryOrder,
        });
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
        setDragOverItem(null);
    }, []);

    const activeOrder = orderEditing && editOrder ? editOrder : savedOrder;
    const orderedData = useMemo(() => {
        const baseOrdered = [...data].sort((a, b) => {
            const aIdx = activeOrder.categories.indexOf(a.category);
            const bIdx = activeOrder.categories.indexOf(b.category);
            const aRank = aIdx === -1 ? 1e9 : aIdx;
            const bRank = bIdx === -1 ? 1e9 : bIdx;
            return aRank - bRank;
        });

        const withSortedSubcats = baseOrdered.map((cat) => ({
            ...cat,
            subcategories: cat.subcategories
                ? [...cat.subcategories].sort((a, b) => {
                    const subs = activeOrder.subcategories[cat.category] ?? [];
                    const aIdx = subs.indexOf(a.subcategory || "");
                    const bIdx = subs.indexOf(b.subcategory || "");
                    const aRank = aIdx === -1 ? 1e9 : aIdx;
                    const bRank = bIdx === -1 ? 1e9 : bIdx;
                    return aRank - bRank;
                })
                : [],
        }));

        if (!sortState.key || !sortState.direction || orderEditing) {
            return withSortedSubcats;
        }

        const sortKey = sortState.key;
        const valueFor = (row: CategoryData) => {
            if (sortKey === "total") return row.total;
            if (sortKey === "average") {
                return elapsedMonthCount > 0 ? row.total / elapsedMonthCount : 0;
            }
            return row.monthlyBreakdown?.[sortKey] ?? 0;
        };

        const factor = sortState.direction === "desc" ? -1 : 1;

        const sortedRows = [...withSortedSubcats].sort((a, b) => {
            const aValue = valueFor(a);
            const bValue = valueFor(b);
            if (aValue === bValue) return 0;
            return aValue > bValue ? factor : -factor;
        });

        return sortedRows.map((row) => ({
            ...row,
            subcategories: row.subcategories
                ? [...row.subcategories].sort((a, b) => {
                    const aValue = valueFor(a);
                    const bValue = valueFor(b);
                    if (aValue === bValue) return 0;
                    return aValue > bValue ? factor : -factor;
                })
                : [],
        }));
    }, [data, activeOrder, sortState, orderEditing, elapsedMonthCount]);

    const handleCategoryDragStart = useCallback(
        (e: React.DragEvent, category: string) => {
            if (!orderEditing) return;
            e.dataTransfer.setData("dragType", "category");
            e.dataTransfer.setData("category", category);
            e.dataTransfer.effectAllowed = "move";
        },
        [orderEditing]
    );

    const handleSubcategoryDragStart = useCallback(
        (e: React.DragEvent, category: string, subcategory: string) => {
            if (!orderEditing) return;
            e.dataTransfer.setData("dragType", "subcategory");
            e.dataTransfer.setData("category", category);
            e.dataTransfer.setData("subcategory", subcategory);
            e.dataTransfer.effectAllowed = "move";
        },
        [orderEditing]
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent, item: { type: "category" | "subcategory"; categoryName: string; subcategoryName?: string }) => {
            if (!orderEditing) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverItem(item);
        },
        [orderEditing]
    );

    const handleDragLeave = useCallback(() => {
        setDragOverItem(null);
    }, []);

    const handleDrop = useCallback(
        (
            e: React.DragEvent,
            dropTarget: { type: "category" | "subcategory"; categoryName: string; subcategoryName?: string }
        ) => {
            if (!orderEditing || !editOrder) return;
            e.preventDefault();
            setDragOverItem(null);

            const dragType = e.dataTransfer.getData("dragType");
            const dragCategory = e.dataTransfer.getData("category");
            const dragSubcategory = e.dataTransfer.getData("subcategory");

            if (dragType === "category" && dropTarget.type === "category") {
                // Reorder categories
                const categoryList = [...editOrder.categories];
                const from = categoryList.indexOf(dragCategory);
                const to = categoryList.indexOf(dropTarget.categoryName);
                if (from === -1 || to === -1 || from === to) return;

                categoryList.splice(from, 1);
                categoryList.splice(categoryList.indexOf(dropTarget.categoryName), 0, dragCategory);
                setEditOrder({ ...editOrder, categories: categoryList });
            } else if (dragType === "subcategory" && dropTarget.type === "subcategory" && dragCategory === dropTarget.categoryName) {
                // Reorder subcategories within the same category
                const subcatList = [...(editOrder.subcategories[dragCategory] ?? [])];
                const from = subcatList.indexOf(dragSubcategory);
                const to = subcatList.indexOf(dropTarget.subcategoryName || "");
                if (from === -1 || to === -1 || from === to) return;

                subcatList.splice(from, 1);
                subcatList.splice(subcatList.indexOf(dropTarget.subcategoryName || ""), 0, dragSubcategory);
                setEditOrder({
                    ...editOrder,
                    subcategories: {
                        ...editOrder.subcategories,
                        [dragCategory]: subcatList,
                    },
                });
            }
        },
        [orderEditing, editOrder]
    );

    const handleDragEnd = useCallback(() => {
        setDragOverItem(null);
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
        const textClass = valueColorClass(value);

        if (value <= 0) {
            return <span className={textClass}>—</span>;
        }

        const displayValue = hideBalances ? MASK : formatCurrency(value);

        if (transactions.length === 0) {
            return <span className={textClass}>{displayValue}</span>;
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
                {displayValue}
            </span>
        );
    };

    const chartData = useMemo(() => {
        if (!chartTarget) return [];
        return dateColumns.map((col) => ({
            key: col.key,
            label: col.label,
            value: chartTarget.monthlyBreakdown[col.key] ?? 0,
        }));
    }, [chartTarget, dateColumns]);

    if (!prefsLoaded) {
        return (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-56 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" aria-hidden />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                {t("noData", {
                    type: type === "income" ? t("income") : type === "expense" ? t("expenses") : t("savingsAndInvestments"),
                })}
            </div>
        );
    }

    const monthlyTotals = dateColumns.reduce<Record<string, number>>((acc, col) => {
        acc[col.key] = data.reduce((sum, row) => sum + (row.monthlyBreakdown?.[col.key] ?? 0), 0);
        return acc;
    }, {});
    const grandTotal = data.reduce((sum, row) => sum + row.total, 0);
    const monthWeight = 1.5;
    const summaryWeight = 2;
    const widthUnit = 70 / (dateColumns.length * monthWeight + summaryWeight * 2);
    const monthlyColumnWidth = `${widthUnit * monthWeight}%`;
    const summaryColumnWidth = `${widthUnit * summaryWeight}%`;
    const categoryWidth = orderEditing ? "calc(30% - 40px)" : "30%";

    return (
        <div className="relative" onMouseLeave={() => setHoverPreview(null)}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-medium text-slate-900 dark:text-white">{title}</h2>
                <div className="flex items-center gap-2">
                    {orderEditing && (
                        <>
                            <button
                                type="button"
                                onClick={saveOrderClick}
                                disabled={savingOrder}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 disabled:opacity-50"
                            >
                                {savingOrder ? `${tCommon("save")}…` : tCommon("save")}
                            </button>
                            <button
                                type="button"
                                onClick={cancelReorder}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            >
                                {tCommon("cancel")}
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={toggleHide}
                        disabled={!currentWalletId}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                        aria-label={hideBalances ? t("showValues") : t("hideValues")}
                        title={hideBalances ? t("showValues") : t("hideValues")}
                    >
                        <EyeIcon hidden={hideBalances} />
                    </button>
                    {!orderEditing && (
                        <button
                            type="button"
                            onClick={startReorder}
                            disabled={!currentWalletId}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                            aria-label={t("reorder")}
                            title={t("reorder")}
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
                                <span className={`shrink-0 font-mono ${summaryColorClass}`}>
                                    {hideBalances ? MASK : formatCurrency(tx.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full table-fixed text-xs bg-white dark:bg-slate-950 border-collapse">
                    <colgroup>
                        {orderEditing && <col style={{ width: "40px" }} />}
                        <col style={{ width: categoryWidth }} />
                        {dateColumns.map((col) => (
                            <col key={col.key} style={{ width: monthlyColumnWidth }} />
                        ))}
                        <col style={{ width: summaryColumnWidth }} />
                        <col style={{ width: summaryColumnWidth }} />
                    </colgroup>
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                        <tr>
                            {orderEditing && (
                                <th className="px-3 py-3 w-10" />
                            )}
                            <th className="px-3 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                                {t("category")}
                            </th>
                            {dateColumns.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-3 py-3 text-right font-medium text-slate-600 dark:text-slate-300 min-w-[65px]"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setNextSort(col.key)}
                                        disabled={orderEditing}
                                        className="inline-flex items-center gap-1 font-medium hover:underline disabled:no-underline disabled:cursor-default"
                                    >
                                        {col.label}
                                        {sortState.key === col.key && sortState.direction && (
                                            <SortDirectionIcon direction={sortState.direction} />
                                        )}
                                    </button>
                                </th>
                            ))}
                            <th className="px-3 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                                <button
                                    type="button"
                                    onClick={() => setNextSort("average")}
                                    disabled={orderEditing}
                                    className="inline-flex items-center gap-1 font-medium hover:underline disabled:no-underline disabled:cursor-default"
                                >
                                    {t("averageMonthlyValue")}
                                    {sortState.key === "average" && sortState.direction && (
                                        <SortDirectionIcon direction={sortState.direction} />
                                    )}
                                </button>
                            </th>
                            <th className="px-3 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                                <button
                                    type="button"
                                    onClick={() => setNextSort("total")}
                                    disabled={orderEditing}
                                    className="inline-flex items-center gap-1 font-medium hover:underline disabled:no-underline disabled:cursor-default"
                                >
                                    {t("total")}
                                    {sortState.key === "total" && sortState.direction && (
                                        <SortDirectionIcon direction={sortState.direction} />
                                    )}
                                </button>
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
                                        className={`${rowHoverClass} transition-colors ${orderEditing
                                                ? dragOverItem?.type === "category" && dragOverItem?.categoryName === row.category
                                                    ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 ring-inset"
                                                    : ""
                                                : ""
                                            } ${hasSubcategories ? "cursor-pointer" : ""}`}
                                        onClick={() =>
                                            hasSubcategories && toggleCategory(row.category)
                                        }
                                        onDragOver={orderEditing ? (e) => handleDragOver(e, { type: "category", categoryName: row.category }) : undefined}
                                        onDragLeave={orderEditing ? handleDragLeave : undefined}
                                        onDrop={orderEditing ? (e) => handleDrop(e, { type: "category", categoryName: row.category }) : undefined}
                                        onDragEnd={orderEditing ? handleDragEnd : undefined}
                                    >
                                        {orderEditing && (
                                            <td className="px-3 py-3" style={{ width: "40px", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleCategoryDragStart(e, row.category)}
                                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-grab active:cursor-grabbing inline-flex touch-none"
                                                    aria-label="Drag to reorder"
                                                >
                                                    <DragHandleIcon />
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-left font-medium text-slate-900 dark:text-slate-100 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
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
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleCategory(row.category);
                                                        }}
                                                        className={`transition-transform cursor-pointer ${isExpanded ? "rotate-90" : ""
                                                            } ${orderEditing ? "hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded" : ""}`}
                                                    >
                                                        <path d="m9 18 6-6-6-6" />
                                                    </svg>
                                                )}
                                                {row.category || "(Uncategorized)"}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setChartTarget({
                                                            title: row.category || "(Uncategorized)",
                                                            monthlyBreakdown: row.monthlyBreakdown ?? {},
                                                        });
                                                    }}
                                                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 shrink-0"
                                                    aria-label={t("viewCategoryMonthlyChart")}
                                                    title={t("viewCategoryMonthlyChart")}
                                                >
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
                                                        aria-hidden
                                                    >
                                                        <path d="M3 3v18h18" />
                                                        <path d="m19 9-5 5-4-4-3 3" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                        {dateColumns.map((col) => {
                                            const value = row.monthlyBreakdown?.[col.key] ?? 0;
                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-3 text-right font-mono ${valueColorClass(value)}`}
                                                >
                                                    {renderValueCell(value, col.key, col.label, row)}
                                                </td>
                                            );
                                        })}
                                        <td
                                            className={`px-3 py-3 text-right font-mono font-semibold ${summaryColorClass}`}
                                        >
                                            {elapsedMonthCount > 0
                                                ? (hideBalances ? MASK : formatCurrency(row.total / elapsedMonthCount))
                                                : "—"}
                                        </td>
                                        <td
                                            className={`px-3 py-3 text-right font-mono font-semibold ${summaryColorClass}`}
                                        >
                                            {hideBalances ? MASK : formatCurrency(row.total)}
                                        </td>
                                    </tr>
                                    {isExpanded &&
                                        hasSubcategories &&
                                        row.subcategories?.map((subcategory) => {
                                            const subcatName = subcategory.subcategory || "";
                                            return (
                                                <tr
                                                    key={`${row.category}-${subcatName}`}
                                                    className={`bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${orderEditing
                                                        ? dragOverItem?.type === "subcategory" &&
                                                            dragOverItem?.categoryName === row.category &&
                                                            dragOverItem?.subcategoryName === subcatName
                                                            ? "ring-1 ring-slate-300 dark:ring-slate-600 ring-inset"
                                                            : ""
                                                        : ""
                                                        }`}
                                                    onDragOver={orderEditing ? (e) => handleDragOver(e, { type: "subcategory", categoryName: row.category, subcategoryName: subcatName }) : undefined}
                                                    onDragLeave={orderEditing ? handleDragLeave : undefined}
                                                    onDrop={orderEditing ? (e) => handleDrop(e, { type: "subcategory", categoryName: row.category, subcategoryName: subcatName }) : undefined}
                                                    onDragEnd={orderEditing ? handleDragEnd : undefined}
                                                >
                                                    {orderEditing && (
                                                        <td className="px-3 py-2" style={{ width: "40px", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                                                            <div
                                                                draggable
                                                                onDragStart={(e) => handleSubcategoryDragStart(e, row.category, subcatName)}
                                                                className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 cursor-grab active:cursor-grabbing inline-flex touch-none"
                                                                aria-label="Drag to reorder"
                                                            >
                                                                <DragHandleIcon />
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-left text-slate-700 dark:text-slate-300 pl-12 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="truncate">{subcategory.subcategory || "(No subcategory)"}</span>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setChartTarget({
                                                                        title: `${row.category} · ${subcategory.subcategory || "(No subcategory)"}`,
                                                                        monthlyBreakdown: subcategory.monthlyBreakdown ?? {},
                                                                    });
                                                                }}
                                                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 shrink-0"
                                                                aria-label={t("viewCategoryMonthlyChart")}
                                                                title={t("viewCategoryMonthlyChart")}
                                                            >
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
                                                                    aria-hidden
                                                                >
                                                                    <path d="M3 3v18h18" />
                                                                    <path d="m19 9-5 5-4-4-3 3" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                    {dateColumns.map((col) => {
                                                        const value = subcategory.monthlyBreakdown?.[col.key] ?? 0;
                                                        return (
                                                            <td
                                                                key={col.key}
                                                                className={`px-3 py-2 text-right font-mono text-xs ${valueColorClass(value)}`}
                                                            >
                                                                {renderValueCell(value, col.key, col.label, subcategory)}
                                                            </td>
                                                        );
                                                    })}
                                                    <td
                                                        className={`px-3 py-2 text-right font-mono text-xs font-semibold ${summaryColorClass}`}
                                                    >
                                                        {elapsedMonthCount > 0
                                                            ? (hideBalances ? MASK : formatCurrency(subcategory.total / elapsedMonthCount))
                                                            : "—"}
                                                    </td>
                                                    <td
                                                        className={`px-3 py-2 text-right font-mono text-xs font-semibold ${summaryColorClass}`}
                                                    >
                                                        {hideBalances ? MASK : formatCurrency(subcategory.total)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </Fragment>
                            );
                        })}
                    </tbody>
                    <tfoot className="border-t border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            {orderEditing && <td className="px-3 py-3" />}
                            <td className="px-3 py-3 text-left font-semibold text-slate-900 dark:text-slate-100">
                                <div className="flex items-center justify-between gap-2">
                                    <span>{t("total")}</span>
                                    {!orderEditing && (
                                        <button
                                            type="button"
                                            onClick={openTotalsChart}
                                            disabled={!currentWalletId}
                                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 shrink-0 disabled:opacity-50"
                                            aria-label={t("viewCategoryMonthlyChart")}
                                            title={t("viewCategoryMonthlyChart")}
                                        >
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
                                                aria-hidden
                                            >
                                                <path d="M3 3v18h18" />
                                                <path d="m19 9-5 5-4-4-3 3" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </td>
                            {dateColumns.map((col) => {
                                const value = monthlyTotals[col.key] ?? 0;
                                return (
                                    <td
                                        key={col.key}
                                        className={`px-3 py-3 text-right font-mono font-semibold ${valueColorClass(value)}`}
                                    >
                                        {value > 0 ? (hideBalances ? MASK : formatCurrency(value)) : "—"}
                                    </td>
                                );
                            })}
                            <td
                                className={`px-3 py-3 text-right font-mono font-bold ${summaryStrongColorClass}`}
                            >
                                {elapsedMonthCount > 0
                                    ? (hideBalances ? MASK : formatCurrency(grandTotal / elapsedMonthCount))
                                    : "—"}
                            </td>
                            <td
                                className={`px-3 py-3 text-right font-mono font-bold ${summaryStrongColorClass}`}
                            >
                                {hideBalances ? MASK : formatCurrency(grandTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {chartTarget &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => setChartTarget(null)}
                    >
                        <div className="absolute inset-0 bg-slate-900/50" />
                        <div
                            className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">{chartTarget.title}</h3>
                                    <p className="text-sm text-slate-500">{t("categoryMonthlyValues")}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setChartTarget(null)}
                                    className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    {tCommon("close")}
                                </button>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                {chartData.length === 0 ? (
                                    <div className="h-72 flex items-center justify-center text-slate-500">
                                        {t("noCategoryChartData")}
                                    </div>
                                ) : (
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                                <YAxis
                                                    tickFormatter={(v: number) =>
                                                        `${v.toLocaleString("pt-PT", {
                                                            minimumFractionDigits: 0,
                                                            maximumFractionDigits: 0,
                                                        })}€`
                                                    }
                                                    tick={{ fontSize: 10 }}
                                                    width={70}
                                                />
                                                <Tooltip
                                                    formatter={(value: number) => [
                                                        `${value.toLocaleString("pt-PT", {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })} €`,
                                                        t("total"),
                                                    ]}
                                                />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={type === "income" ? "#16a34a" : type === "expense" ? "#dc2626" : "#2563eb"} />
                                                <Brush
                                                    dataKey="label"
                                                    height={20}
                                                    stroke="#64748b"
                                                    travellerWidth={10}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {chartTotalsOpen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => setChartTotalsOpen(false)}
                    >
                        <div className="absolute inset-0 bg-slate-900/50" />
                        <div
                            className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">{title}</h3>
                                    <p className="text-sm text-slate-500">{t("categoryMonthlyValues")}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setChartTotalsOpen(false)}
                                    className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    {tCommon("close")}
                                </button>
                            </div>

                            {data.length === 0 ? (
                                <div className="h-72 flex items-center justify-center text-slate-500">{t("noData", { type: title })}</div>
                            ) : (
                                (() => {
                                    const visibleOrdered = orderedData.filter((row) =>
                                        chartTotalsVisibleCategories.has(row.category)
                                    );
                                    const barsVisible = visibleOrdered.length > 0;
                                    const monthKey = pieMonthKey ?? dateColumns[0]?.key ?? "";

                                    const chartDataAll = dateColumns.map((col) => {
                                        const row: Record<string, number | string> = { label: col.label };
                                        for (const cat of visibleOrdered) {
                                            row[cat.category] = cat.monthlyBreakdown?.[col.key] ?? 0;
                                        }
                                        return row;
                                    });

                                    const pieData = visibleOrdered
                                        .map((row) => ({
                                            name: row.category,
                                            value: row.monthlyBreakdown?.[monthKey] ?? 0,
                                        }))
                                        .filter((d) => d.value > 0);

                                    const palette = ["#16a34a", "#dc2626", "#2563eb", "#f59e0b", "#8b5cf6", "#0891b2", "#ef4444", "#22c55e"];

                                    return (
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                            {chartTotalsView === "pie" ? (
                                                <div className="h-72 w-full">
                                                    {pieData.length === 0 ? (
                                                        <div className="h-72 flex items-center justify-center text-slate-500">
                                                            {t("noCategoryChartData")}
                                                        </div>
                                                    ) : (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Tooltip
                                                                    formatter={(value: number) => [
                                                                        `${value.toLocaleString("pt-PT", {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2,
                                                                        })} €`,
                                                                        "",
                                                                    ]}
                                                                />
                                                                <Pie
                                                                    data={pieData}
                                                                    dataKey="value"
                                                                    nameKey="name"
                                                                    outerRadius={110}
                                                                    labelLine={false}
                                                                    label={({ name, percent }) => `${name} (${Math.round((percent ?? 0) * 100)}%)`}
                                                                >
                                                                    {pieData.map((d, idx) => (
                                                                        <Cell key={`cell-${d.name}`} fill={palette[idx % palette.length]} />
                                                                    ))}
                                                                </Pie>
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-72 w-full">
                                                    {!barsVisible ? (
                                                        <div className="h-72 flex items-center justify-center text-slate-500">{t("noCategoryChartData")}</div>
                                                    ) : (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={chartDataAll} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                                                <YAxis
                                                                    tickFormatter={(v: number) =>
                                                                        `${v.toLocaleString("pt-PT", {
                                                                            minimumFractionDigits: 0,
                                                                            maximumFractionDigits: 0,
                                                                        })}€`
                                                                    }
                                                                    tick={{ fontSize: 10 }}
                                                                    width={70}
                                                                />
                                                                <Tooltip
                                                                    formatter={(value: number, name: string) => [
                                                                        `${value.toLocaleString("pt-PT", {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2,
                                                                        })} €`,
                                                                        name,
                                                                    ]}
                                                                />
                                                                {visibleOrdered.map((cat, idx) => (
                                                                    <Bar
                                                                        key={cat.category}
                                                                        dataKey={cat.category}
                                                                        radius={[4, 4, 0, 0]}
                                                                        fill={palette[idx % palette.length]}
                                                                    />
                                                                ))}
                                                                <Brush
                                                                    dataKey="label"
                                                                    height={20}
                                                                    stroke="#64748b"
                                                                    travellerWidth={10}
                                                                />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            )}

                            <div className="mt-4">
                                {data.length === 0 ? null : (
                                    <>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                {t("showHideCategories")}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setChartTotalsVisibleCategories(new Set(orderedData.map((r) => r.category)))
                                                    }
                                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                                                >
                                                    {t("selectAll")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setChartTotalsVisibleCategories(new Set())}
                                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                                                >
                                                    {t("clearAll")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setChartTotalsView((prev) => (prev === "bar" ? "pie" : "bar"))}
                                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                                                >
                                                    {chartTotalsView === "bar" ? t("showPieByMonth") : t("showBarChart")}
                                                </button>
                                            </div>
                                        </div>
                                        {chartTotalsView === "pie" && (
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                                    {t("selectMonth")}:
                                                </span>
                                                <select
                                                    value={pieMonthKey ?? ""}
                                                    onChange={(e) => setPieMonthKey(e.target.value || null)}
                                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                                                >
                                                    {dateColumns.map((col) => (
                                                        <option key={col.key} value={col.key}>
                                                            {col.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-3">
                                            {orderedData.map((row, idx) => {
                                                const checked = chartTotalsVisibleCategories.has(row.category);
                                                const palette = ["#16a34a", "#dc2626", "#2563eb", "#f59e0b", "#8b5cf6", "#0891b2", "#ef4444", "#22c55e"];
                                                const color = palette[idx % palette.length];

                                                return (
                                                    <label
                                                        key={row.category}
                                                        className="inline-flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer select-none"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setChartTotalsVisibleCategories((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(row.category)) next.delete(row.category);
                                                                    else next.add(row.category);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <span
                                                            className="inline-block w-2.5 h-2.5 rounded-full"
                                                            style={{ backgroundColor: color }}
                                                            aria-hidden
                                                        />
                                                        <span className="max-w-[160px] truncate">{row.category}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
