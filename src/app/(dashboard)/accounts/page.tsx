import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { accountTypeLabel, accountTypeIcon, type AccountType } from "@/lib/account-types";
import Link from "next/link";

export default async function AccountsPage() {
  const supabase = await createClient();
  const cookie = await getWalletCookie();

  const { data: wallets } = await supabase
    .from("wallets")
    .select("id")
    .eq("is_active", true);
  const walletIds = (wallets ?? []).map((w) => w.id);
  const currentWalletId =
    cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;

  let accounts: {
    id: string;
    name: string;
    account_type: AccountType;
    initial_balance: number;
    current_balance: number;
    is_active: boolean;
  }[] = [];

  if (currentWalletId) {
    const { data } = await supabase
      .from("accounts")
      .select("id, name, account_type, initial_balance, current_balance, is_active")
      .eq("wallet_id", currentWalletId)
      .order("name");
    accounts = (data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      account_type: (a.account_type ?? "bank_account") as AccountType,
      initial_balance: Number(a.initial_balance),
      current_balance: Number(a.current_balance),
      is_active: a.is_active,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        {currentWalletId && (
          <Link
            href="/accounts/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            Add account
          </Link>
        )}
      </div>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet first.
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {accounts.length === 0 ? (
            <div className="p-6 text-slate-500">
              No accounts.{" "}
              <Link href="/accounts/new" className="underline">
                Add one
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-right p-3">Initial</th>
                  <th className="text-right p-3">Current</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className={`border-b border-slate-100 dark:border-slate-700/50 ${
                      !a.is_active ? "opacity-60" : ""
                    }`}
                  >
                    <td className="p-3 font-medium">
                      <span
                        className="inline-flex items-center gap-2"
                        title={accountTypeLabel(a.account_type)}
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {accountTypeIcon(a.account_type)}
                        </span>
                        {a.name}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {accountTypeLabel(a.account_type)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {a.initial_balance.toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </td>
                    <td className="p-3 text-right font-mono">
                      {a.current_balance.toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </td>
                    <td className="p-3">
                      {a.is_active ? (
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      ) : (
                        <span className="text-slate-500">Inactive</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/accounts/${a.id}/edit`}
                        className="text-slate-600 dark:text-slate-400 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
