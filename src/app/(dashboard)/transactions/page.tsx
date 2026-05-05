/** Transactions hub: movements, pending confirmations, and recurring rules (RSC, force-dynamic). */
import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { getActiveWalletContext } from "@/lib/active-wallet-server";
import { ensureRecurringGenerated } from "@/app/actions/transactions";
import { PendingSection, type PendingRow } from "@/components/PendingSection";
import { RecurringSection, type RecurringRow } from "@/components/RecurringSection";
import { TransactionsTabs } from "@/components/TransactionsTabs";
import { expenseIsEffectivelyEssential } from "@/lib/expense-essential";
import { transactionsForWalletOrUserIncomes } from "@/lib/income-scope";
import { workDayDateInMonth } from "@/lib/recurrence";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
    const t = await getTranslations("transactions");
    const supabase = await createClient();
    const cookie = await getWalletCookie();
    const { currentWalletId } = await getActiveWalletContext(supabase, cookie);

    type CategoryRow = { id?: string; name: string; parent_id: string | null; is_essential?: boolean | null };
    type TxRow = {
        id: string;
        wallet_id: string;
        date: string;
        type: string;
        amount: number;
        description: string | null;
        observations: string | null;
        is_essential?: boolean | null;
        account_from_id: string | null;
        account_to_id: string | null;
        paid_by_member_id: string | null;
        received_by_member_id: string | null;
        split_method_override: "equally" | "by_income" | "manual" | null;
        status?: string | null;
        hold_balance?: boolean;
        category: CategoryRow | null;
    };

    type TxDisplay = {
        id: string;
        date: string;
        type: string;
        amount: number;
        description: string | null;
        observations: string | null;
        category: CategoryRow | null;
        categoryLabel: string;
        subcategoryLabel: string;
        accountFromName: string;
        accountToName: string;
        paidByMemberName: string | null;
        paidByMemberAvatar: string | null;
        receivedByMemberName: string | null;
        receivedByMemberAvatar: string | null;
        splitMethod: "equally" | "by_income" | "manual" | null;
        status: "confirmed" | "pending";
        holdBalance: boolean;
        hasAttachment: boolean;
        isEssential: boolean;
        /** When income is user-scoped and posted in another wallet, this is that wallet's display name. */
        postedFromWalletName: string | null;
    };
    let transactions: TxDisplay[] = [];
    let pending: PendingRow[] = [];
    let recurring: RecurringRow[] = [];
    let isSplitWallet = false;

    if (currentWalletId) {
        await ensureRecurringGenerated(currentWalletId);
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const txQuery = supabase
            .from("transactions")
            .select(
                "id, wallet_id, date, type, amount, description, observations, is_essential, account_from_id, account_to_id, paid_by_member_id, status, hold_balance, " +
                "received_by_member_id, split_method_override, " +
                "category:categories(id, name, parent_id, is_essential)"
            )
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });
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
            { data: walletInfo },
            { data: memberList },
        ] = await Promise.all([
            supabase.from("accounts").select("id, name").eq("wallet_id", currentWalletId),
            supabase.from("categories").select("id, name, parent_id").eq("wallet_id", currentWalletId),
            txQuery,
            supabase
                .from("recurring_rules")
                .select("id, type, amount, description, category_id, account_from_id, account_to_id, recurrence_type, interval_months, interval_days, work_day_index, next_run_date, is_active, end_date")
                .eq("wallet_id", currentWalletId)
                .order("next_run_date", { ascending: true }),
            supabase
                .from("wallets")
                .select("shared_option, split_type, default_split_method")
                .eq("id", currentWalletId)
                .single(),
            supabase
                .from("wallet_members")
                .select("user_id, member_name")
                .eq("wallet_id", currentWalletId),
        ]);
        const accountsMap = new Map((accs ?? []).map((a) => [a.id, a.name]));
        const catIdToName = new Map((cats ?? []).map((c) => [c.id, c.name]));
        const memberIds = (memberList ?? []).map((m: any) => m.user_id);
        let profileRows: any[] = [];
        if (memberIds.length) {
            const profilesRes = await supabase
                .from("profiles")
                .select("id, first_name, last_name, avatar_url")
                .in("id", memberIds);
            profileRows = profilesRes.data ?? [];
        }
        const profilesById = new Map((profileRows ?? []).map((p: any) => [p.id, p]));
        const membersMap = new Map<string, { name: string; avatar_url: string | null }>();
        for (const m of (memberList ?? []) as any[]) {
            const profile = profilesById.get(m.user_id) as any;
            const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
            const displayName =
                fullName ||
                m.member_name ||
                "Member";
            membersMap.set(m.user_id, { name: displayName, avatar_url: profile?.avatar_url ?? null });
        }
        let walletSharedOption = walletInfo?.shared_option ?? null;
        if (typeof walletSharedOption === "string") {
            const normalized = walletSharedOption.trim().toLowerCase();
            if (normalized === "control") walletSharedOption = "track";
            else if (normalized === "split_equal") walletSharedOption = "split";
            else if (normalized === "split_income") walletSharedOption = "track_and_split";
            else walletSharedOption = normalized;
        }
        isSplitWallet =
            walletSharedOption === "split" ||
            walletSharedOption === "track_and_split" ||
            (!walletSharedOption && !!walletInfo?.split_type);
        const defaultSplitMethod =
            walletInfo?.default_split_method === "manual" || walletInfo?.default_split_method === "by_income"
                ? walletInfo.default_split_method
                : walletInfo?.split_type === "by_income"
                    ? "by_income"
                    : "equally";
        const rows = (tx ?? []) as unknown as TxRow[];

        const receiverIdsForLookup = new Set<string>();
        for (const t of rows) {
            if (t.type === "income" && t.received_by_member_id && !membersMap.has(t.received_by_member_id)) {
                receiverIdsForLookup.add(t.received_by_member_id);
            }
        }
        if (receiverIdsForLookup.size > 0) {
            const { data: recvProfiles } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, avatar_url")
                .in("id", Array.from(receiverIdsForLookup));
            for (const p of recvProfiles ?? []) {
                const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
                membersMap.set(p.id, {
                    name: fullName || "Member",
                    avatar_url: p.avatar_url ?? null,
                });
            }
        }

        const catIdsNeeded = new Set<string>();
        const accountIdsNeeded = new Set<string>();
        for (const t of rows) {
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

        const distinctWalletIds = Array.from(new Set(rows.map((r) => r.wallet_id)));
        const walletNameById = new Map<string, string>();
        if (distinctWalletIds.length) {
            const { data: walletRows } = await supabase
                .from("wallets")
                .select("id, name")
                .in("id", distinctWalletIds);
            for (const w of walletRows ?? []) {
                walletNameById.set(w.id, w.name);
            }
        }

        const txIds = rows.map((r) => r.id);
        let txIdsWithAttachment = new Set<string>();
        if (txIds.length) {
            const { data: attachRows } = await supabase
                .from("transaction_attachments")
                .select("transaction_id")
                .in("transaction_id", txIds);
            txIdsWithAttachment = new Set(
                (attachRows ?? []).map((a: { transaction_id: string }) => a.transaction_id)
            );
        }
        const allTx = rows.map((t) => {
            const c = t.category;
            const categoryLabel = c?.parent_id
                ? (catIdToName.get(c.parent_id) ?? "—")
                : (c?.name ?? "—");
            const subcategoryLabel = c?.parent_id ? (c?.name ?? "—") : "—";
            const accountFromName = t.account_from_id ? (accountsMap.get(t.account_from_id) ?? "—") : "—";
            const accountToName = t.account_to_id ? (accountsMap.get(t.account_to_id) ?? "—") : "—";
            const paidBy = t.paid_by_member_id ? membersMap.get(t.paid_by_member_id) : null;
            const receivedBy = t.received_by_member_id ? membersMap.get(t.received_by_member_id) : null;
            const splitMethod =
                isSplitWallet && t.type === "expense"
                    ? (t.split_method_override ?? defaultSplitMethod)
                    : null;
            const status = (t.status === "pending" ? "pending" : "confirmed") as "confirmed" | "pending";
            const hasAttachment = txIdsWithAttachment.has(t.id);
            const isEssential = expenseIsEffectivelyEssential(t.type, t.is_essential, c);
            const postedFromWalletName =
                t.wallet_id !== currentWalletId ? (walletNameById.get(t.wallet_id) ?? null) : null;
            return {
                id: t.id,
                date: t.date,
                type: t.type,
                amount: Number(t.amount),
                description: t.description,
                observations: t.observations ?? null,
                category: c,
                categoryLabel,
                subcategoryLabel,
                accountFromName,
                accountToName,
                paidByMemberName: paidBy?.name ?? null,
                paidByMemberAvatar: paidBy?.avatar_url ?? null,
                receivedByMemberName: receivedBy?.name ?? null,
                receivedByMemberAvatar: receivedBy?.avatar_url ?? null,
                splitMethod,
                status,
                holdBalance: !!t.hold_balance,
                hasAttachment,
                isEssential,
                postedFromWalletName,
            };
        });
        transactions = allTx;
        pending = allTx
            .filter((t) => t.status === "pending")
            .map(
                ({
                    id,
                    date,
                    type,
                    amount,
                    description,
                    categoryLabel,
                    subcategoryLabel,
                    accountFromName,
                    accountToName,
                    holdBalance,
                    hasAttachment,
                    isEssential,
                    postedFromWalletName,
                }) => ({
                    id,
                    date,
                    type,
                    amount,
                    description,
                    categoryLabel,
                    subcategoryLabel,
                    accountFromName,
                    accountToName,
                    holdBalance,
                    hasAttachment,
                    isEssential,
                    postedFromWalletName,
                })
            );

        recurring = (rules ?? []).map((r) => {
            const cat = cats?.find((c) => c.id === r.category_id);
            const categoryLabel = cat
                ? (cat.parent_id ? (catIdToName.get(cat.parent_id) ?? cat.name) : cat.name)
                : "—";
            const subcategoryLabel = cat?.parent_id ? (cat.name ?? "—") : "—";
            const accountFromName = r.account_from_id ? (accountsMap.get(r.account_from_id) ?? "—") : "—";
            const accountToName = r.account_to_id ? (accountsMap.get(r.account_to_id) ?? "—") : "—";
            let repeatLabel: string;
            if (r.recurrence_type === "daily") repeatLabel = t("recurring.repeat.daily");
            else if (r.recurrence_type === "weekly") repeatLabel = t("recurring.repeat.weekly");
            else if (r.recurrence_type === "monthly") repeatLabel = t("recurring.repeat.monthly");
            else if (r.recurrence_type === "yearly") repeatLabel = t("recurring.repeat.yearly");
            else if (r.recurrence_type === "interval_days" && r.interval_days)
                repeatLabel = t("recurring.repeat.everyDays", { count: r.interval_days });
            else if (r.recurrence_type === "interval_months" && r.interval_months)
                repeatLabel = t("recurring.repeat.everyMonths", { count: r.interval_months });
            else if (r.recurrence_type === "monthly_nth_work_day" && r.work_day_index)
                repeatLabel = t("recurring.repeat.nthWorkDay", { count: r.work_day_index });
            else if (r.recurrence_type === "monthly_nth_last_work_day" && r.work_day_index)
                repeatLabel = t("recurring.repeat.nthLastWorkDay", { count: r.work_day_index });
            else repeatLabel = t("recurring.repeat.unknown", { value: String(r.recurrence_type) });
            const isWorkDay =
                r.recurrence_type === "monthly_nth_work_day" ||
                r.recurrence_type === "monthly_nth_last_work_day";
            let nextRunDate = String(r.next_run_date);
            if (isWorkDay && r.work_day_index) {
                const d = new Date(String(r.next_run_date) + "T12:00:00Z");
                const y = d.getUTCFullYear();
                const m = d.getUTCMonth();
                const wdType =
                    r.recurrence_type === "monthly_nth_work_day"
                        ? "monthly_nth_work_day"
                        : "monthly_nth_last_work_day";
                const computed = workDayDateInMonth(y, m, wdType, r.work_day_index);
                if (computed) nextRunDate = computed;
            }
            const endDate = r.end_date != null ? String(r.end_date) : null;
            const isStopped =
                !!endDate && String(r.next_run_date) > endDate;
            return {
                id: r.id,
                description: (r.description ?? "").trim() || "—",
                type: r.type,
                amount: Number(r.amount),
                categoryLabel,
                subcategoryLabel,
                accountFromName,
                accountToName,
                repeatLabel,
                nextRunDate,
                isActive: !!r.is_active,
                endDate,
                isStopped,
            };
        });
    }

    const confirmed = transactions
        .filter((t) => t.status === "confirmed")
        .map(
            ({
                id,
                date,
                type,
                amount,
                description,
                observations,
                categoryLabel,
                subcategoryLabel,
                accountFromName,
                accountToName,
                paidByMemberName,
                paidByMemberAvatar,
                receivedByMemberName,
                receivedByMemberAvatar,
                splitMethod,
                hasAttachment,
                isEssential,
                postedFromWalletName,
            }) => ({
                id,
                date,
                type,
                amount,
                description,
                observations,
                categoryLabel,
                subcategoryLabel,
                accountFromName,
                accountToName,
                paidByMemberName,
                paidByMemberAvatar,
                receivedByMemberName,
                receivedByMemberAvatar,
                splitMethod,
                hasAttachment,
                isEssential,
                postedFromWalletName,
            })
        );

    return (
        <div className="space-y-6">
            {!currentWalletId ? (
                <>
                    <DashboardPageHeader title={t("title")} description={t("subtitle")} />
                    <p className="text-slate-600 dark:text-slate-400">
                        {t("emptyWalletMessage")}
                    </p>
                </>
            ) : (
                <div className="space-y-8">
                    <DashboardPageHeader title={t("title")} description={t("subtitle")} />
                    <TransactionsTabs
                        confirmed={confirmed}
                        pending={pending}
                        recurring={recurring}
                        isSplitOnly={isSplitWallet}
                    />
                </div>
            )}
        </div>
    );
}
