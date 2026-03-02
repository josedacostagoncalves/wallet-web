import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ensureRecurringGenerated } from "@/app/actions/transactions";
import { getWalletSettlements } from "@/app/actions/wallets";
import { CurrentBalancesSection } from "@/components/CurrentBalancesSection";
import { PortfolioPeriodSelector } from "@/components/PortfolioPeriodSelector";
import { SettlementsSection } from "@/components/SettlementsSection";
import type { AccountType } from "@/lib/account-types";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PortfolioPage({
    searchParams,
}: {
    searchParams?: { year?: string; month?: string; period?: string };
}) {
    const t = await getTranslations("portfolio");
    const supabase = await createClient();
    const cookie = await getWalletCookie();

    const { data: wallets } = await supabase
        .from("wallets")
        .select("id")
        .eq("is_active", true)
        .is("deleted_at", null);
    const walletIds = (wallets ?? []).map((w) => w.id);
    const currentWalletId = cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;

    let accounts: {
        id: string;
        name: string;
        account_type: AccountType;
        initial_balance: number;
        current_balance: number;
        last_update: string | null;
        plafond: number | null;
    }[] = [];
    let totalInitialBalance = 0;
    let totalBalance = 0;
    let pendingAmounts: Record<string, number> = {};
    let walletSharedOption: string | null = null;
    let walletSplitType: string | null = null;
    let walletName: string | null = null;
    let settlements: any[] = [];
    let availableYears: number[] = [new Date().getUTCFullYear()];

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const requestedYear = Number(searchParams?.year);
    const requestedMonth = Number(searchParams?.month);
    const periodType: "monthly" | "yearly" =
        searchParams?.period === "yearly" ? "yearly" : "monthly";
    let activeYear = Number.isInteger(requestedYear) ? requestedYear : currentYear;
    let activeMonth =
        Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
            ? requestedMonth
            : currentMonth;

    if (currentWalletId) {
        await ensureRecurringGenerated(currentWalletId);

        // Fetch wallet shared_option and split type
        const { data: walletData } = await supabase
            .from("wallets")
            .select("shared_option, split_type, name")
            .eq("id", currentWalletId)
            .single();
        walletSharedOption = walletData?.shared_option ?? null;
        walletSplitType = walletData?.split_type ?? null;
        walletName = walletData?.name ?? null;

        // Fetch settlements if wallet is split type
        if (walletSharedOption === "split" || walletSharedOption === "track_and_split") {
            const [{ data: minTx }, { data: maxTx }] = await Promise.all([
                supabase
                    .from("transactions")
                    .select("date")
                    .eq("wallet_id", currentWalletId)
                    .order("date", { ascending: true })
                    .limit(1),
                supabase
                    .from("transactions")
                    .select("date")
                    .eq("wallet_id", currentWalletId)
                    .order("date", { ascending: false })
                    .limit(1),
            ]);
            const minYear = minTx?.[0]?.date ? Number(String(minTx[0].date).slice(0, 4)) : currentYear;
            const maxYear = maxTx?.[0]?.date ? Number(String(maxTx[0].date).slice(0, 4)) : currentYear;
            availableYears = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => minYear + i);

            const selectedYearForWallet =
                Number.isInteger(requestedYear) && availableYears.includes(requestedYear)
                    ? requestedYear
                    : currentYear;
            const selectedMonthForWallet =
                Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
                    ? requestedMonth
                    : currentMonth;
            activeYear = selectedYearForWallet;
            activeMonth = selectedMonthForWallet;

            const { settlements: settle } = await getWalletSettlements(currentWalletId, {
                year: selectedYearForWallet,
                month: periodType === "monthly" ? selectedMonthForWallet : undefined,
                granularity: periodType === "yearly" ? "year" : "month",
            });
            if (settle) {
                settlements = settle;
            }
        }

        const { data } = await supabase
            .from("accounts")
            .select("id, name, account_type, initial_balance, current_balance, plafond")
            .eq("wallet_id", currentWalletId)
            .eq("is_active", true);

        const accountIds = (data ?? []).map((a) => a.id);

        // Get last update date for each account from transactions
        const lastUpdates: Record<string, string | null> = {};
        if (accountIds.length > 0) {
            const { data: transactionsFrom } = await supabase
                .from("transactions")
                .select("account_from_id, date")
                .in("account_from_id", accountIds)
                .order("date", { ascending: false });

            const { data: transactionsTo } = await supabase
                .from("transactions")
                .select("account_to_id, date")
                .in("account_to_id", accountIds)
                .order("date", { ascending: false });

            // Combine and find latest date for each account
            for (const accId of accountIds) {
                const fromDates = (transactionsFrom ?? [])
                    .filter((m) => m.account_from_id === accId)
                    .map((m) => m.date);
                const toDates = (transactionsTo ?? [])
                    .filter((m) => m.account_to_id === accId)
                    .map((m) => m.date);
                const allDates = [...fromDates, ...toDates].sort().reverse();
                lastUpdates[accId] = allDates.length > 0 ? allDates[0] : null;
            }
        }

        // Fetch pending transactions that did NOT hold balance (already applied to current_balance)
        if (accountIds.length > 0) {
            const { data: pendingTx } = await supabase
                .from("transactions")
                .select("type, amount, account_from_id, account_to_id")
                .eq("wallet_id", currentWalletId)
                .eq("status", "pending")
                .eq("hold_balance", false);

            const pa: Record<string, number> = {};
            for (const tx of pendingTx ?? []) {
                const amt = Number(tx.amount);
                if (tx.type === "income" && tx.account_to_id) {
                    pa[tx.account_to_id] = (pa[tx.account_to_id] ?? 0) + amt;
                } else if (tx.type === "expense" && tx.account_from_id) {
                    pa[tx.account_from_id] = (pa[tx.account_from_id] ?? 0) - amt;
                } else if (tx.type === "transfer") {
                    if (tx.account_from_id) pa[tx.account_from_id] = (pa[tx.account_from_id] ?? 0) - amt;
                    if (tx.account_to_id) pa[tx.account_to_id] = (pa[tx.account_to_id] ?? 0) + amt;
                }
            }
            pendingAmounts = pa;
        }

        accounts = (data ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            account_type: (a.account_type ?? "bank_account") as AccountType,
            initial_balance: Number(a.initial_balance),
            current_balance: Number(a.current_balance),
            last_update: lastUpdates[a.id] ?? null,
            plafond: a.plafond != null ? Number(a.plafond) : null,
        }));
        totalInitialBalance = accounts.reduce((s, a) => s + a.initial_balance, 0);
        totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
    }

    const periodStart =
        periodType === "yearly"
            ? `${activeYear}-01-01`
            : `${activeYear}-${String(activeMonth).padStart(2, "0")}-01`;
    const periodEnd =
        periodType === "yearly"
            ? `${activeYear}-12-31`
            : `${activeYear}-${String(activeMonth).padStart(2, "0")}-${String(
                new Date(Date.UTC(activeYear, activeMonth, 0)).getUTCDate()
            ).padStart(2, "0")}`;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold">{t("title")}</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">{t("subtitle")}</p>
            </div>

            {!currentWalletId ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        {t("emptyMessage")}
                    </p>
                    <Link
                        href="/wallets"
                        className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                    >
                        {t("createWallet")}
                    </Link>
                </div>
            ) : (
                <>
                    {(walletSharedOption === "track" || walletSharedOption === "track_and_split") && (
                        <CurrentBalancesSection
                            accounts={accounts}
                            totalInitialBalance={totalInitialBalance}
                            totalBalance={totalBalance}
                            currentWalletId={currentWalletId}
                            walletName={walletName}
                            pendingAmounts={pendingAmounts}
                        />
                    )}
                    {(walletSharedOption === "split" || walletSharedOption === "track_and_split") && (
                        <>
                            <div className="flex items-center justify-end">
                                <PortfolioPeriodSelector
                                    years={availableYears}
                                    periodType={periodType}
                                    selectedYear={
                                        Number.isInteger(requestedYear) && availableYears.includes(requestedYear)
                                            ? requestedYear
                                            : currentYear
                                    }
                                    selectedMonth={
                                        Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
                                            ? requestedMonth
                                            : currentMonth
                                    }
                                />
                            </div>
                            <SettlementsSection
                                settlements={settlements}
                                splitType={walletSplitType}
                                walletId={currentWalletId}
                                periodType={periodType}
                                periodStart={periodStart}
                                periodEnd={periodEnd}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
