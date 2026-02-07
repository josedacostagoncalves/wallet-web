import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ensureRecurringGenerated } from "@/app/actions/movements";
import { CurrentBalancesSection } from "@/components/CurrentBalancesSection";
import { NewExpenseTrigger } from "@/components/NewExpenseTrigger";
import { NewIncomeTrigger } from "@/components/NewIncomeTrigger";
import { NewTransferTrigger } from "@/components/NewTransferTrigger";
import type { AccountType } from "@/lib/account-types";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const cookie = await getWalletCookie();

  const { data: wallets } = await supabase
    .from("wallets")
    .select("id")
    .eq("is_active", true);
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

  if (currentWalletId) {
    await ensureRecurringGenerated(currentWalletId);
    const { data } = await supabase
      .from("accounts")
      .select("id, name, account_type, initial_balance, current_balance, plafond")
      .eq("wallet_id", currentWalletId)
      .eq("is_active", true);
    
    const accountIds = (data ?? []).map((a) => a.id);
    
    // Get last update date for each account from transactions
    const lastUpdates: Record<string, string | null> = {};
    if (accountIds.length > 0) {
      const { data: movementsFrom } = await supabase
        .from("transactions")
        .select("account_from_id, date")
        .in("account_from_id", accountIds)
        .order("date", { ascending: false });
      
      const { data: movementsTo } = await supabase
        .from("transactions")
        .select("account_to_id, date")
        .in("account_to_id", accountIds)
        .order("date", { ascending: false });
      
      // Combine and find latest date for each account
      for (const accId of accountIds) {
        const fromDates = (movementsFrom ?? [])
          .filter((m) => m.account_from_id === accId)
          .map((m) => m.date);
        const toDates = (movementsTo ?? [])
          .filter((m) => m.account_to_id === accId)
          .map((m) => m.date);
        const allDates = [...fromDates, ...toDates].sort().reverse();
        lastUpdates[accId] = allDates.length > 0 ? allDates[0] : null;
      }
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Home</h1>

      {!currentWalletId ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Create a wallet to start tracking your finances.
          </p>
          <Link
            href="/wallets"
            className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            Create wallet
          </Link>
        </div>
      ) : (
        <>
          <section className="flex flex-wrap gap-4">
            <NewIncomeTrigger
              className="inline-flex flex-col items-center justify-center w-40 h-28 rounded-xl border-2 border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-100/50 dark:hover:bg-green-900/30"
            >
              <span className="text-2xl mb-1">↓</span>
              <span className="font-medium">New Income</span>
            </NewIncomeTrigger>
            <NewExpenseTrigger
              className="inline-flex flex-col items-center justify-center w-40 h-28 rounded-xl border-2 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-100/50 dark:hover:bg-red-900/30"
            >
              <span className="text-2xl mb-1">↑</span>
              <span className="font-medium">New Expense</span>
            </NewExpenseTrigger>
            <NewTransferTrigger
              className="inline-flex flex-col items-center justify-center w-40 h-28 rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
            >
              <span className="text-2xl mb-1">⇄</span>
              <span className="font-medium">New Transfer</span>
            </NewTransferTrigger>
            <Link
              href="/dashboard"
              className="inline-flex flex-col items-center justify-center w-40 h-28 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="text-2xl mb-1">📊</span>
              <span className="font-medium">Dashboard</span>
            </Link>
            <Link
              href="/reports"
              className="inline-flex flex-col items-center justify-center w-40 h-28 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="text-2xl mb-1">📈</span>
              <span className="font-medium">Reports</span>
            </Link>
          </section>

          <CurrentBalancesSection
            accounts={accounts}
            totalInitialBalance={totalInitialBalance}
            totalBalance={totalBalance}
            currentWalletId={currentWalletId}
          />
        </>
      )}
    </div>
  );
}
