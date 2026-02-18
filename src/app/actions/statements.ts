"use server";

import { createClient } from "@/lib/supabase/server";

type StatementRow = {
    category: string;
    subcategory: string | null;
    total: number;
    monthlyBreakdown: Record<string, number>;
    monthlyTransactions: Record<
        string,
        { id: string; date: string; description: string | null; amount: number }[]
    >;
    subcategories?: StatementRow[];
};

type StatementsResult = {
    income: StatementRow[];
    expenses: StatementRow[];
};

export async function getStatementsByCategory(
    walletId: string,
    startDate: string,
    endDate: string
): Promise<StatementsResult> {
    const supabase = await createClient();

    // Fetch all transactions for the wallet in the date range with category info
    // Exclude transfers - only show income and expense
    const { data: transactions, error } = await supabase
        .from("transactions")
        .select("id, date, type, amount, description, category_id, category:categories(id, name, parent_id)")
        .eq("wallet_id", walletId)
        .eq("status", "confirmed")
        .in("type", ["income", "expense"])
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

    if (error) {
        console.error("Error fetching transactions:", error);
        return { income: [], expenses: [] };
    }

    console.log(`[Statements] Fetched ${transactions?.length || 0} transactions for wallet ${walletId} from ${startDate} to ${endDate}`);
    if (transactions && transactions.length > 0) {
        console.log("[Statements] Sample transaction:", transactions[0]);
    }

    // Group by type and category
    type TransactionWithCategory = {
        id: string;
        date: string;
        type: string;
        amount: number;
        description: string | null;
        category?: { id: string; name: string; parent_id: string | null } | null;
    };

    const incomeMap = new Map<string, StatementRow>();
    const expenseMap = new Map<string, StatementRow>();

    // Also fetch parent categories to build subcategory map
    const { data: allCategories } = await supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("wallet_id", walletId);

    const categoryMap = new Map<string, { name: string; parent_id: string | null }>();
    (allCategories || []).forEach((cat) => {
        categoryMap.set(cat.id, { name: cat.name, parent_id: cat.parent_id });
    });

    (transactions as any as TransactionWithCategory[]).forEach((transaction) => {
        const categoryId = transaction.category?.id;
        const categoryName = transaction.category?.name || "(Uncategorized)";
        const category = categoryMap.get(categoryId || "");
        let parentCategoryName = categoryName;
        let isSubcategory = false;

        // If this category has a parent, get parent name for grouping
        if (category?.parent_id) {
            const parentCat = categoryMap.get(category.parent_id);
            if (parentCat) {
                parentCategoryName = parentCat.name;
                isSubcategory = true;
            }
        }

        const monthKey = transaction.date.slice(0, 7); // YYYY-MM
        const map = transaction.type === "income" ? incomeMap : expenseMap;
        const key = isSubcategory ? `${parentCategoryName}|${categoryName}` : categoryName;

        if (!map.has(key)) {
            map.set(key, {
                category: parentCategoryName,
                subcategory: isSubcategory ? categoryName : null,
                total: 0,
                monthlyBreakdown: {},
                monthlyTransactions: {},
            });
        }

        const row = map.get(key)!;
        row.total += transaction.amount;
        row.monthlyBreakdown[monthKey] = (row.monthlyBreakdown[monthKey] || 0) + transaction.amount;
        if (!row.monthlyTransactions[monthKey]) {
            row.monthlyTransactions[monthKey] = [];
        }
        row.monthlyTransactions[monthKey].push({
            id: transaction.id,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
        });
    });

    // Format output with subcategories grouped under categories
    const formatStatements = (map: Map<string, StatementRow>) => {
        const result: StatementRow[] = [];
        const processedCategories = new Set<string>();

        // First pass: collect all parent categories
        const parentCategories = new Map<string, StatementRow>();
        map.forEach((row) => {
            if (!row.subcategory && !processedCategories.has(row.category)) {
                parentCategories.set(row.category, row);
                processedCategories.add(row.category);
            }
        });

        // Add all parent categories and their subcategories
        parentCategories.forEach((parentRow, categoryName) => {
            const subcats: StatementRow[] = [];
            map.forEach((subRow) => {
                if (subRow.category === categoryName && subRow.subcategory) {
                    subcats.push(subRow);
                }
            });

            if (subcats.length > 0) {
                (parentRow as any).subcategories = subcats;
            }
            result.push(parentRow);
        });

        // Handle orphaned subcategories (categories that only exist as subcategories)
        map.forEach((row) => {
            if (row.subcategory && !parentCategories.has(row.category)) {
                const orphanedParent: any = {
                    category: row.category,
                    subcategory: null,
                    total: 0,
                    monthlyBreakdown: {},
                    monthlyTransactions: {},
                    subcategories: []
                };

                // Find all rows for this orphaned parent
                map.forEach((subRow) => {
                    if (subRow.category === row.category && subRow.subcategory) {
                        (orphanedParent as any).subcategories.push(subRow);
                        orphanedParent.total += subRow.total;
                        Object.keys(subRow.monthlyBreakdown).forEach((month) => {
                            orphanedParent.monthlyBreakdown[month] = (orphanedParent.monthlyBreakdown[month] || 0) + subRow.monthlyBreakdown[month];
                        });
                        Object.keys(subRow.monthlyTransactions).forEach((month) => {
                            if (!orphanedParent.monthlyTransactions[month]) {
                                orphanedParent.monthlyTransactions[month] = [];
                            }
                            orphanedParent.monthlyTransactions[month].push(
                                ...subRow.monthlyTransactions[month]
                            );
                        });
                    }
                });

                if (!processedCategories.has(row.category)) {
                    result.push(orphanedParent);
                    processedCategories.add(row.category);
                }
            }
        });

        return result;
    };

    return {
        income: formatStatements(incomeMap),
        expenses: formatStatements(expenseMap),
    };
}
export async function getAvailableYears(walletId: string): Promise<number[]> {
    const supabase = await createClient();

    // Fetch all transactions to get distinct years
    const { data: transactions, error } = await supabase
        .from("transactions")
        .select("date")
        .eq("wallet_id", walletId)
        .eq("status", "confirmed")
        .in("type", ["income", "expense"])
        .order("date", { ascending: true });

    if (error || !transactions) {
        console.error("Error fetching transactions for years:", error);
        return [new Date().getFullYear()];
    }

    // Extract unique years from transactions
    const yearsSet = new Set<number>();
    transactions.forEach((transaction) => {
        const year = new Date(transaction.date).getFullYear();
        yearsSet.add(year);
    });

    // Return sorted years in descending order
    return Array.from(yearsSet).sort((a, b) => b - a);
}