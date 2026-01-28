import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ExpenseChart } from "@/components/ExpenseChart";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const cookie = await getWalletCookie();

  const { data: wallets } = await supabase
    .from("wallets")
    .select("id")
    .eq("is_active", true);
  const walletIds = (wallets ?? []).map((w) => w.id);
  const currentWalletId =
    cookie && walletIds.includes(cookie) ? cookie : walletIds[0] ?? null;

  let chartData: { name: string; value: number }[] = [];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  if (currentWalletId) {
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, type, amount, category_id, date, status")
      .eq("wallet_id", currentWalletId)
      .eq("type", "expense")
      .gte("date", thisMonthStart)
      .eq("status", "confirmed");

    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("wallet_id", currentWalletId);
    const catIdToName = new Map((cats ?? []).map((c) => [c.id, c.name]));

    const byCategory: Record<string, number> = {};
    for (const t of tx ?? []) {
      const catId = (t as { category_id?: string }).category_id;
      const c = cats?.find((c) => c.id === catId);
      const categoryLabel = c
        ? (c.parent_id ? (catIdToName.get(c.parent_id) ?? c.name) : c.name)
        : "Uncategorized";
      const n = categoryLabel !== "—" ? categoryLabel : "Uncategorized";
      byCategory[n] = (byCategory[n] ?? 0) + Number(t.amount);
    }
    chartData = Object.entries(byCategory).map(([name, value]) => ({
      name,
      value,
    }));
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Reports</h1>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet to see reports.
        </p>
      ) : (
        <section>
          <h2 className="text-lg font-medium mb-3">Expenses by category (this month)</h2>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <ExpenseChart data={chartData} />
          </div>
        </section>
      )}
    </div>
  );
}
