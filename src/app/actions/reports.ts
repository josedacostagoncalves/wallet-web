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
        .select("id, tracking_mode")
        .eq("is_active", true)
        .is("deleted_at", null);
    const walletIds = (wallets ?? []).map((w) => w.id);
    const currentWalletId =
        cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;
    const currentWallet = (wallets ?? []).find((w) => w.id === currentWalletId);
    const walletTracksBalances = currentWallet?.tracking_mode !== "basic";

    let chartData: { name: string; value: number }[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let netTotal = 0;
    let avgDailySpend = { current: 0, previous: 0 };
    let pendingVsConfirmed = { pending: 0, confirmed: 0 };
    let monthlySeries: any[] = [];
    let portfolioDailySeries: { date: string; year: number; month: number; day: number; label: string; totalBalance: number }[] = [];
    let currentPortfolioBalance = 0;
    let expenseUsers: { userId: string; userName: string }[] = [];
    let expenseByUserDaily: { date: string; year: number; month: number; day: number; label: string; userId: string; userName: string; amount: number }[] = [];
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
            created_by?: string | null;
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
                "created_by, " +
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
            supabase.from("accounts").select("id, name, current_balance").eq("wallet_id", currentWalletId),
            supabase.from("categories").select("id, name, parent_id").eq("wallet_id", currentWalletId),
            txQuery,
            supabase
                .from("recurring_rules")
                .select("id, type, amount, description, category_id, account_from_id, account_to_id, recurrence_type, interval_months, interval_days, work_day_index, next_run_date, is_active, end_date")
                .eq("wallet_id", currentWalletId)
                .order("next_run_date", { ascending: true }),
        ]);
        const { data: walletMembers } = await supabase
            .from("wallet_members")
            .select("user_id, member_name")
            .eq("wallet_id", currentWalletId);
        const memberIds = Array.from(new Set((walletMembers ?? []).map((m) => m.user_id).filter(Boolean)));
        const { data: profiles } = memberIds.length
            ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", memberIds)
            : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] };
        const memberNameByWallet = new Map(
            (walletMembers ?? []).map((m) => [m.user_id, (m.member_name ?? "").trim()])
        );
        const memberNameById = new Map(
            (profiles ?? []).map((p) => [
                p.id,
                memberNameByWallet.get(p.id) ||
                    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
                    (p.email?.split("@")[0] ?? "") ||
                    p.id.slice(0, 8),
            ])
        );
        expenseUsers = memberIds.map((id) => ({
            userId: id,
            userName:
                memberNameById.get(id) ||
                memberNameByWallet.get(id) ||
                id.slice(0, 8),
        }));

        const accountsMap = new Map((accs ?? []).map((a) => [a.id, a.name]));
        currentPortfolioBalance = (accs ?? []).reduce(
            (sum, a: { current_balance?: number | string | null }) =>
                sum + Number(a.current_balance ?? 0),
            0
        );
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
        // Rebuild daily total-balance history from current total and daily net deltas.
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dailyNetByDate = new Map<string, number>();
        for (const t of txRows) {
            const statusConfirmed = t.status === "confirmed" || !t.status;
            if (!statusConfirmed) continue;
            if (t.wallet_id !== currentWalletId) continue;
            if (t.date < seriesStartStr) continue;

            let delta = 0;
            if (t.type === "income") {
                delta = Number(t.amount);
            } else if (t.type === "expense") {
                delta = -Math.abs(Number(t.amount));
            } else {
                continue;
            }
            dailyNetByDate.set(t.date, (dailyNetByDate.get(t.date) ?? 0) + delta);
        }

        let runningBalance = currentPortfolioBalance;
        const reverseDaily: { date: string; year: number; month: number; day: number; label: string; totalBalance: number }[] = [];
        for (
            let d = new Date(today);
            d >= seriesStart;
            d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
        ) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const key = `${yyyy}-${mm}-${dd}`;
            reverseDaily.push({
                date: key,
                year: yyyy,
                month: d.getMonth(),
                day: d.getDate(),
                label: `${dd}.${mm}`,
                totalBalance: runningBalance,
            });
            runningBalance -= dailyNetByDate.get(key) ?? 0;
        }
        portfolioDailySeries = reverseDaily.reverse();
        const expenseByUserMap = new Map<string, number>();
        for (const t of txRows) {
            const statusConfirmed = t.status === "confirmed" || !t.status;
            if (!statusConfirmed || t.type !== "expense" || t.wallet_id !== currentWalletId) continue;
            const uid = t.created_by ?? "unknown";
            const key = `${t.date}|${uid}`;
            expenseByUserMap.set(key, (expenseByUserMap.get(key) ?? 0) + Math.abs(Number(t.amount)));
        }
        expenseByUserDaily = Array.from(expenseByUserMap.entries()).map(([key, amount]) => {
            const [date, userId] = key.split("|");
            const yyyy = Number(date.slice(0, 4));
            const mm = Number(date.slice(5, 7)) - 1;
            const dd = Number(date.slice(8, 10));
            return {
                date,
                year: yyyy,
                month: mm,
                day: dd,
                label: `${String(dd).padStart(2, "0")}.${String(mm + 1).padStart(2, "0")}`,
                userId,
                userName:
                    memberNameById.get(userId) ||
                    memberNameByWallet.get(userId) ||
                    userId.slice(0, 8),
                amount,
            };
        });
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
        walletTracksBalances,
        portfolioDailySeries,
        currentPortfolioBalance,
        expenseUsers,
        expenseByUserDaily,
        defaultPeriodMonths,
    };
}
