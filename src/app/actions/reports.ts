"use server";

import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ensureRecurringGenerated } from "@/app/actions/transactions";
import { transactionsForWalletOrUserIncomes } from "@/lib/income-scope";
import { expenseIsEffectivelyEssential } from "@/lib/expense-essential";

export async function getReportsData() {
    const supabase = await createClient();
    const cookie = await getWalletCookie();

    const { data: wallets } = await supabase
        .from("wallets")
        .select("id")
        .eq("is_active", true)
        .is("deleted_at", null);
    const walletIds = (wallets ?? []).map((w) => w.id);
    const currentWalletId =
        cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;

    let chartData: { name: string; value: number }[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let netTotal = 0;
    let avgDailySpend = { current: 0, previous: 0 };
    let pendingVsConfirmed = { pending: 0, confirmed: 0 };
    let monthlySeries: any[] = [];
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
    const defaultPeriodMonths = 6;
    const maxPeriodMonths = 24;
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - (maxPeriodMonths - 1), 1);
    const seriesStartStr = seriesStart.toISOString().slice(0, 10);

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
        /** Effective essential flag for expenses (category + transaction override). */
        isExpenseEssential?: boolean;
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

    let calendarTransactions: CalendarTransaction[] = [];
    let recurringNextRuns: CalendarRecurringNextRun[] = [];

    if (currentWalletId) {
        await ensureRecurringGenerated(currentWalletId);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        type CategoryRow = { id: string; name: string; parent_id: string | null; is_essential?: boolean | null };
        type TxRow = {
            id: string;
            wallet_id: string;
            date: string;
            type: string;
            amount: number;
            description: string | null;
            account_from_id: string | null;
            account_to_id: string | null;
            category: CategoryRow | null;
            status?: string | null;
            is_essential?: boolean | null;
        };

        const txQuery = supabase
            .from("transactions")
            .select(
                "id, wallet_id, date, type, amount, description, account_from_id, account_to_id, status, is_essential, " +
                "category:categories(id, name, parent_id, is_essential)"
            )
            .gte("date", seriesStartStr)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(2000);
        if (user?.id) {
            txQuery.or(transactionsForWalletOrUserIncomes(currentWalletId, user.id));
        } else {
            txQuery.eq("wallet_id", currentWalletId);
        }

        const [
            { data: accs },
            { data: cats },
            { data: tx },
            { data: rules },
        ] = await Promise.all([
            supabase.from("accounts").select("id, name").eq("wallet_id", currentWalletId),
            supabase.from("categories").select("id, name, parent_id").eq("wallet_id", currentWalletId),
            txQuery,
            supabase
                .from("recurring_rules")
                .select("id, type, amount, description, category_id, account_from_id, account_to_id, recurrence_type, interval_months, interval_days, work_day_index, next_run_date, is_active, end_date")
                .eq("wallet_id", currentWalletId)
                .order("next_run_date", { ascending: true }),
        ]);

        const accountsMap = new Map((accs ?? []).map((a) => [a.id, a.name]));
        const catIdToName = new Map((cats ?? []).map((c) => [c.id, c.name]));
        const txRows = (tx ?? []) as unknown as TxRow[];

        const catIdsNeeded = new Set<string>();
        const accountIdsNeeded = new Set<string>();
        for (const t of txRows) {
            const c = t.category;
            if (c?.id) catIdsNeeded.add(c.id);
            if (c?.parent_id) catIdsNeeded.add(c.parent_id);
            if (t.account_from_id) accountIdsNeeded.add(t.account_from_id);
            if (t.account_to_id) accountIdsNeeded.add(t.account_to_id);
        }
        const missingCatIds = Array.from(catIdsNeeded).filter((id) => !catIdToName.has(id));
        if (missingCatIds.length) {
            const { data: extraCats } = await supabase
                .from("categories")
                .select("id, name, parent_id")
                .in("id", missingCatIds);
            for (const c of extraCats ?? []) {
                catIdToName.set(c.id, c.name);
            }
        }
        const missingAccIds = Array.from(accountIdsNeeded).filter((id) => !accountsMap.has(id));
        if (missingAccIds.length) {
            const { data: extraAccs } = await supabase.from("accounts").select("id, name").in("id", missingAccIds);
            for (const a of extraAccs ?? []) {
                accountsMap.set(a.id, a.name);
            }
        }
        const currentMonthKey = thisMonthStart.slice(0, 7);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
        const daysInCurrentMonth = now.getDate();
        const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        const monthItems: MonthlyPoint[] = [];
        for (let i = 0; i < maxPeriodMonths; i += 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - (maxPeriodMonths - 1 - i), 1);
            monthItems.push({
                key: d.toISOString().slice(0, 7),
                label: d.toLocaleString("en-US", { month: "short" }) + " " + String(d.getFullYear()).slice(2),
                income: 0,
                expense: 0,
                net: 0,
            });
        }
        const monthIndex = new Map(monthItems.map((m) => [m.key, m]));

        // Process transactions for calendar
        calendarTransactions = txRows.map((t) => {
            const cat = t.category as CategoryRow | null;
            const categoryLabel = cat?.parent_id
                ? (catIdToName.get(cat.parent_id) ?? cat.name ?? "—")
                : (cat?.name ?? "—");
            const subcategoryLabel = cat?.parent_id ? (cat?.name ?? "") : "";
            const accountFromName = accountsMap.get(t.account_from_id ?? "") ?? "";
            const accountToName = accountsMap.get(t.account_to_id ?? "") ?? "";

            return {
                id: t.id,
                date: t.date,
                type: t.type,
                amount: Number(t.amount),
                description: t.description,
                categoryLabel,
                subcategoryLabel,
                accountFromName,
                accountToName,
                status: (t.status as "confirmed" | "pending") ?? "confirmed",
                ...(t.type === "expense"
                    ? {
                          isExpenseEssential: expenseIsEffectivelyEssential(
                              t.type,
                              t.is_essential ?? null,
                              cat
                          ),
                      }
                    : {}),
            };
        });

        // Process recurring rules for calendar
        recurringNextRuns = (rules ?? [])
            .filter((r) => {
                if (!r.is_active) return false;
                const endDate = r.end_date;
                return !endDate || String(r.next_run_date) <= endDate;
            })
            .map((r) => {
                const cat = cats?.find((c) => c.id === r.category_id);
                const parentCat = cat?.parent_id ? cats?.find((c) => c.id === cat.parent_id) : null;
                const categoryLabel = parentCat?.name ?? cat?.name ?? "—";
                const subcategoryLabel = cat?.parent_id ? (cat?.name ?? "") : "";
                const accountFromName = accountsMap.get(r.account_from_id ?? "") ?? "";
                const accountToName = accountsMap.get(r.account_to_id ?? "") ?? "";

                return {
                    id: r.id,
                    date: r.next_run_date,
                    type: r.type,
                    amount: Number(r.amount),
                    description: r.description ?? "",
                    categoryLabel,
                    subcategoryLabel,
                    accountFromName,
                    accountToName,
                };
            });

        // Calculate total income and expenses for this month
        const thisMonthTx = txRows.filter(
            (t) =>
                t.date >= thisMonthStart &&
                (t.status === "confirmed" || !t.status) &&
                (t.type !== "expense" || t.wallet_id === currentWalletId)
        );

        for (const t of thisMonthTx) {
            const amount = Number(t.amount);
            if (t.type === "income") {
                totalIncome += amount;
            } else if (t.type === "expense" && t.wallet_id === currentWalletId) {
                totalExpenses += Math.abs(amount);
            }
        }

        let currentMonthExpense = 0;
        let lastMonthExpense = 0;
        let pendingTotal = 0;
        let confirmedTotal = 0;

        for (const t of txRows) {
            const statusConfirmed = t.status === "confirmed" || !t.status;
            const amount = Number(t.amount);
            const absAmount = Math.abs(amount);
            const monthKey = t.date.slice(0, 7);

            if (t.wallet_id === currentWalletId && monthKey === currentMonthKey) {
                if (statusConfirmed) confirmedTotal += absAmount;
                else pendingTotal += absAmount;
            }

            if (statusConfirmed && monthIndex.has(monthKey)) {
                const item = monthIndex.get(monthKey)!;
                if (t.type === "income") item.income += amount;
                if (t.type === "expense" && t.wallet_id === currentWalletId) item.expense += absAmount;
            }

            if (statusConfirmed && t.type === "expense" && t.wallet_id === currentWalletId) {
                if (monthKey === currentMonthKey) currentMonthExpense += absAmount;
                if (monthKey === lastMonthKey) lastMonthExpense += absAmount;
            }
        }

        monthlySeries = monthItems.map((m) => ({
            ...m,
            net: m.income - m.expense,
        }));
        pendingVsConfirmed = { pending: pendingTotal, confirmed: confirmedTotal };
        avgDailySpend = {
            current: daysInCurrentMonth ? currentMonthExpense / daysInCurrentMonth : 0,
            previous: daysInLastMonth ? lastMonthExpense / daysInLastMonth : 0,
        };
        netTotal = totalIncome - totalExpenses;

        // Calculate expenses by category for chart
        const byCategory: Record<string, number> = {};
        for (const t of thisMonthTx) {
            if (t.type !== "expense" || t.wallet_id !== currentWalletId) continue;
            const cat = t.category as CategoryRow | null;
            const categoryLabel = cat
                ? cat.parent_id
                    ? catIdToName.get(cat.parent_id) ?? cat.name
                    : cat.name
                : "Uncategorized";
            const n = categoryLabel !== "—" ? categoryLabel : "Uncategorized";
            byCategory[n] = (byCategory[n] ?? 0) + Math.abs(Number(t.amount));
        }
        chartData = Object.entries(byCategory).map(([name, value]) => ({
            name,
            value,
        }));
    }

    return {
        currentWalletId,
        calendarTransactions,
        recurringNextRuns,
        monthlySeries,
        totalIncome,
        totalExpenses,
        netTotal,
        avgDailySpend,
        pendingVsConfirmed,
        chartData,
        defaultPeriodMonths,
    };
}
