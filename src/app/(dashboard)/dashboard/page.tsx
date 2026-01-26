import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ExpenseChart } from "@/components/ExpenseChart";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const cookie = await getWalletCookie();

  const { data: wallets } = await supabase
    .from("wallets")
    .select("id")
    .eq("is_active", true);
  const walletIds = (wallets ?? []).map((w) => w.id);
  const currentWalletId =
    cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;

  type CategoryRow = { name: string; parent_id: string | null };
  let transactions: {
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string | null;
    category: CategoryRow | null;
    categoryLabel: string;
    subcategoryLabel: string;
    accountFromName: string;
    accountToName: string;
  }[] = [];
  let chartData: { name: string; value: number }[] = [];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  if (currentWalletId) {
    const [
      { data: accs },
      { data: cats },
      { data: tx },
    ] = await Promise.all([
      supabase.from("accounts").select("id, name").eq("wallet_id", currentWalletId),
      supabase.from("categories").select("id, name, parent_id").eq("wallet_id", currentWalletId),
      supabase
        .from("transactions")
        .select(
          "id, date, type, amount, description, account_from_id, account_to_id, " +
            "category:categories(name, parent_id)"
        )
        .eq("wallet_id", currentWalletId)
        .order("date", { ascending: false })
        .limit(200),
    ]);
    const accountsMap = new Map((accs ?? []).map((a) => [a.id, a.name]));
    const catIdToName = new Map((cats ?? []).map((c) => [c.id, c.name]));
    const cat = (c: unknown): CategoryRow | null => (c as CategoryRow | null) ?? null;
    transactions = (tx ?? []).map((t) => {
      const c = cat(t.category);
      const categoryLabel = c?.parent_id
        ? (catIdToName.get(c.parent_id) ?? "—")
        : (c?.name ?? "—");
      const subcategoryLabel = c?.parent_id ? (c?.name ?? "—") : "—";
      const raw = t as { account_from_id?: string | null; account_to_id?: string | null };
      const accountFromName = raw.account_from_id ? (accountsMap.get(raw.account_from_id) ?? "—") : "—";
      const accountToName = raw.account_to_id ? (accountsMap.get(raw.account_to_id) ?? "—") : "—";
      return {
        id: t.id,
        date: t.date,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        category: c,
        categoryLabel,
        subcategoryLabel,
        accountFromName,
        accountToName,
      };
    });

    const expenseTx = transactions.filter(
      (t) => t.type === "expense" && t.date >= thisMonthStart
    );
    const byCategory: Record<string, number> = {};
    for (const t of expenseTx) {
      const n = t.categoryLabel !== "—" ? t.categoryLabel : "Uncategorized";
      byCategory[n] = (byCategory[n] ?? 0) + t.amount;
    }
    chartData = Object.entries(byCategory).map(([name, value]) => ({
      name,
      value,
    }));
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet to see the dashboard.
        </p>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-medium mb-3">Expenses by category (this month)</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <ExpenseChart data={chartData} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">All movements</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {transactions.length === 0 ? (
                <div className="p-6 text-slate-500">
                  No movements yet.{" "}
                  <Link href="/movements/new" className="underline">
                    Add one
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50">
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                          Description
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                          Category
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                          Subcategory
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">
                          From → To
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">
                          Amount
                        </th>
                        <th className="px-3 py-2 w-24" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {transactions.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-3 py-2">{t.date}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                            {t.description || "—"}
                          </td>
                          <td className="px-3 py-2 capitalize">{t.type}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {t.categoryLabel}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {t.subcategoryLabel}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {t.accountFromName} → {t.accountToName}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${
                              t.type === "income"
                                ? "text-green-600 dark:text-green-400"
                                : t.type === "expense"
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                            }`}
                          >
                            {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                            {t.amount.toLocaleString("pt-PT", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            €
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex gap-2">
                              <Link
                                href={`/movements/new?copy=${t.id}`}
                                className="text-slate-500 hover:underline text-xs"
                              >
                                Copy
                              </Link>
                              <Link
                                href={`/movements/${t.id}/edit`}
                                className="text-slate-500 hover:underline text-xs"
                              >
                                Edit
                              </Link>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
