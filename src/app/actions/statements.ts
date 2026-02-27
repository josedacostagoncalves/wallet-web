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

export type StatementsViewMode = "incomeExpenses" | "savingsInvestments";

type TransactionWithCategory = {
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string | null;
    category_id?: string | null;
    category?: { id: string; name: string; parent_id: string | null } | null;
};

const SAVINGS_INVESTMENTS_CATEGORY_ALIASES = new Set([
    "savings",
    "saving",
    "investments",
    "investment",
    "poupancas",
    "poupanca",
    "investimentos",
    "investimento",
    "ahorros",
    "ahorro",
    "inversiones",
    "inversion",
    "epargne",
    "investissement",
    "investissements",
]);

function normalizeCategoryName(name: string | null | undefined): string {
    return (name || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function buildCategoryMap(categories: { id: string; name: string; parent_id: string | null }[]) {
    const categoryMap = new Map<string, { name: string; parent_id: string | null }>();
    categories.forEach((cat) => {
        categoryMap.set(cat.id, { name: cat.name, parent_id: cat.parent_id });
    });
    return categoryMap;
}

function getCategoryContext(
    transaction: TransactionWithCategory,
    categoryMap: Map<string, { name: string; parent_id: string | null }>
) {
    const categoryId = transaction.category?.id || transaction.category_id || "";
    const categoryName = transaction.category?.name || categoryMap.get(categoryId)?.name || "(Uncategorized)";
    const category = categoryMap.get(categoryId);
    let parentCategoryName = categoryName;
    let isSubcategory = false;

    if (category?.parent_id) {
        const parentCat = categoryMap.get(category.parent_id);
        if (parentCat) {
            parentCategoryName = parentCat.name;
            isSubcategory = true;
        }
    }

    return {
        categoryName,
        parentCategoryName,
        isSubcategory,
    };
}

function formatStatements(map: Map<string, StatementRow>) {
    const result: StatementRow[] = [];
    const processedCategories = new Set<string>();

    const parentCategories = new Map<string, StatementRow>();
    map.forEach((row) => {
        if (!row.subcategory && !processedCategories.has(row.category)) {
            parentCategories.set(row.category, row);
            processedCategories.add(row.category);
        }
    });

    parentCategories.forEach((parentRow, categoryName) => {
        const subcats: StatementRow[] = [];
        map.forEach((subRow) => {
            if (subRow.category === categoryName && subRow.subcategory) {
                subcats.push(subRow);
            }
        });

        if (subcats.length > 0) {
            (parentRow as StatementRow).subcategories = subcats;
        }
        result.push(parentRow);
    });

    map.forEach((row) => {
        if (row.subcategory && !parentCategories.has(row.category)) {
            const orphanedParent: StatementRow = {
                category: row.category,
                subcategory: null,
                total: 0,
                monthlyBreakdown: {},
                monthlyTransactions: {},
                subcategories: [],
            };

            map.forEach((subRow) => {
                if (subRow.category === row.category && subRow.subcategory) {
                    orphanedParent.subcategories?.push(subRow);
                    orphanedParent.total += subRow.total;
                    Object.keys(subRow.monthlyBreakdown).forEach((month) => {
                        orphanedParent.monthlyBreakdown[month] =
                            (orphanedParent.monthlyBreakdown[month] || 0) + subRow.monthlyBreakdown[month];
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
}

function isSavingsOrInvestmentsCategory(
    transaction: TransactionWithCategory,
    categoryMap: Map<string, { name: string; parent_id: string | null }>
) {
    const { categoryName, parentCategoryName } = getCategoryContext(transaction, categoryMap);
    const normalizedCategory = normalizeCategoryName(categoryName);
    const normalizedParent = normalizeCategoryName(parentCategoryName);
    return (
        SAVINGS_INVESTMENTS_CATEGORY_ALIASES.has(normalizedCategory) ||
        SAVINGS_INVESTMENTS_CATEGORY_ALIASES.has(normalizedParent)
    );
}

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

    const incomeMap = new Map<string, StatementRow>();
    const expenseMap = new Map<string, StatementRow>();

    // Also fetch parent categories to build subcategory map
    const { data: allCategories } = await supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("wallet_id", walletId);

    const categoryMap = buildCategoryMap(allCategories || []);

    (transactions as any as TransactionWithCategory[]).forEach((transaction) => {
        const { categoryName, parentCategoryName, isSubcategory } = getCategoryContext(transaction, categoryMap);

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

    return {
        income: formatStatements(incomeMap),
        expenses: formatStatements(expenseMap),
    };
}

export async function getSavingsInvestmentStatements(
    walletId: string,
    startDate: string,
    endDate: string
): Promise<StatementRow[]> {
    const supabase = await createClient();
    const { data: transactions, error } = await supabase
        .from("transactions")
        .select("id, date, type, amount, description, category_id, category:categories(id, name, parent_id)")
        .eq("wallet_id", walletId)
        .eq("status", "confirmed")
        .eq("type", "transfer")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

    if (error) {
        console.error("Error fetching savings/investments transactions:", error);
        return [];
    }

    const { data: allCategories } = await supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("wallet_id", walletId);
    const categoryMap = buildCategoryMap(allCategories || []);
    const filtered = (transactions as unknown as TransactionWithCategory[]).filter((transaction) =>
        isSavingsOrInvestmentsCategory(transaction, categoryMap)
    );

    const transferMap = new Map<string, StatementRow>();
    filtered.forEach((transaction) => {
        const { categoryName, parentCategoryName, isSubcategory } = getCategoryContext(transaction, categoryMap);
        const monthKey = transaction.date.slice(0, 7);
        const key = isSubcategory ? `${parentCategoryName}|${categoryName}` : categoryName;

        if (!transferMap.has(key)) {
            transferMap.set(key, {
                category: parentCategoryName,
                subcategory: isSubcategory ? categoryName : null,
                total: 0,
                monthlyBreakdown: {},
                monthlyTransactions: {},
            });
        }

        const row = transferMap.get(key)!;
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

    return formatStatements(transferMap);
}

export async function getAvailableYears(
    walletId: string,
    mode: StatementsViewMode = "incomeExpenses"
): Promise<number[]> {
    const supabase = await createClient();

    let transactions: { date: string }[] = [];
    let error: { message: string } | null = null;

    if (mode === "incomeExpenses") {
        const res = await supabase
            .from("transactions")
            .select("date")
            .eq("wallet_id", walletId)
            .eq("status", "confirmed")
            .in("type", ["income", "expense"])
            .order("date", { ascending: true });
        transactions = (res.data as { date: string }[] | null) || [];
        error = res.error;
    } else {
        const [txRes, catRes] = await Promise.all([
            supabase
                .from("transactions")
                .select("date, category_id")
                .eq("wallet_id", walletId)
                .eq("status", "confirmed")
                .eq("type", "transfer")
                .order("date", { ascending: true }),
            supabase
                .from("categories")
                .select("id, name, parent_id")
                .eq("wallet_id", walletId),
        ]);

        error = txRes.error || catRes.error;
        if (!error) {
            const categoryMap = buildCategoryMap((catRes.data || []) as { id: string; name: string; parent_id: string | null }[]);
            transactions = ((txRes.data || []) as { date: string; category_id: string | null }[])
                .filter((transaction) =>
                    isSavingsOrInvestmentsCategory(
                        {
                            id: "",
                            date: transaction.date,
                            type: "transfer",
                            amount: 0,
                            description: null,
                            category_id: transaction.category_id,
                        },
                        categoryMap
                    )
                )
                .map((transaction) => ({ date: transaction.date }));
        }
    }

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

    if (yearsSet.size === 0) {
        return [new Date().getFullYear()];
    }

    // Return sorted years in descending order
    return Array.from(yearsSet).sort((a, b) => b - a);
}