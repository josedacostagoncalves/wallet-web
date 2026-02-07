import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ensureRecurringGenerated } from "@/app/actions/movements";
import { CurrentBalancesSection } from "@/components/CurrentBalancesSection";
import type { AccountType } from "@/lib/account-types";
import Link from "next/link";

export default async function HomePage() {
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
    
    // Fetch pending movements that did NOT hold balance (already applied to current_balance)
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
          <CurrentBalancesSection
            accounts={accounts}
            totalInitialBalance={totalInitialBalance}
            totalBalance={totalBalance}
            currentWalletId={currentWalletId}
            pendingAmounts={pendingAmounts}
          />
        </>
      )}
    </div>
  );
}
