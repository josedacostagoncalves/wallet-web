import { createClient } from "@/lib/supabase/server";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { ensureRecurringGenerated } from "@/app/actions/movements";
import { AllMovementsSection } from "@/components/AllMovementsSection";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import { PendingSection, type PendingRow } from "@/components/PendingSection";
import { NewExpenseTrigger } from "@/components/NewExpenseTrigger";
import { NewIncomeTrigger } from "@/components/NewIncomeTrigger";
import { NewTransferTrigger } from "@/components/NewTransferTrigger";
import { RecurringSection, type RecurringRow } from "@/components/RecurringSection";
import { workDayDateInMonth } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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

  type CategoryRow = { name: string; parent_id: string | null };
  type TxRow = {
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string | null;
    account_from_id: string | null;
    account_to_id: string | null;
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
    category: CategoryRow | null;
    categoryLabel: string;
    subcategoryLabel: string;
    accountFromName: string;
    accountToName: string;
    status: "confirmed" | "pending";
  };
  let transactions: TxDisplay[] = [];
  let pending: PendingRow[] = [];
  let recurring: RecurringRow[] = [];

  if (currentWalletId) {
    await ensureRecurringGenerated(currentWalletId);
    const [
      { data: accs },
      { data: cats },
      { data: tx },
      { data: rules },
    ] = await Promise.all([
      supabase.from("accounts").select("id, name").eq("wallet_id", currentWalletId),
      supabase.from("categories").select("id, name, parent_id").eq("wallet_id", currentWalletId),
      supabase
        .from("transactions")
        .select(
          "id, date, type, amount, description, account_from_id, account_to_id, status, hold_balance, " +
            "category:categories(name, parent_id)"
        )
        .eq("wallet_id", currentWalletId)
        .order("date", { ascending: false })
        .limit(200),
      supabase
        .from("recurring_rules")
        .select("id, type, amount, description, category_id, account_from_id, account_to_id, recurrence_type, interval_months, interval_days, work_day_index, next_run_date, is_active, end_date")
        .eq("wallet_id", currentWalletId)
        .order("next_run_date", { ascending: true }),
    ]);
    const accountsMap = new Map((accs ?? []).map((a) => [a.id, a.name]));
    const catIdToName = new Map((cats ?? []).map((c) => [c.id, c.name]));
    const rows = (tx ?? []) as unknown as TxRow[];
    const allTx = rows.map((t) => {
      const c = t.category;
      const categoryLabel = c?.parent_id
        ? (catIdToName.get(c.parent_id) ?? "—")
        : (c?.name ?? "—");
      const subcategoryLabel = c?.parent_id ? (c?.name ?? "—") : "—";
      const accountFromName = t.account_from_id ? (accountsMap.get(t.account_from_id) ?? "—") : "—";
      const accountToName = t.account_to_id ? (accountsMap.get(t.account_to_id) ?? "—") : "—";
      const status = (t.status === "pending" ? "pending" : "confirmed") as "confirmed" | "pending";
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
        status,
        holdBalance: !!t.hold_balance,
      };
    });
    transactions = allTx;
    pending = allTx
      .filter((t) => t.status === "pending")
      .map(({ id, date, type, amount, description, categoryLabel, subcategoryLabel, accountFromName, accountToName, holdBalance }) => ({
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
      }));

    recurring = (rules ?? []).map((r) => {
      const cat = cats?.find((c) => c.id === r.category_id);
      const categoryLabel = cat
        ? (cat.parent_id ? (catIdToName.get(cat.parent_id) ?? cat.name) : cat.name)
        : "—";
      const subcategoryLabel = cat?.parent_id ? (cat.name ?? "—") : "—";
      const accountFromName = r.account_from_id ? (accountsMap.get(r.account_from_id) ?? "—") : "—";
      const accountToName = r.account_to_id ? (accountsMap.get(r.account_to_id) ?? "—") : "—";
      let repeatLabel: string;
      if (r.recurrence_type === "daily") repeatLabel = "Daily";
      else if (r.recurrence_type === "weekly") repeatLabel = "Weekly";
      else if (r.recurrence_type === "monthly") repeatLabel = "Monthly";
      else if (r.recurrence_type === "yearly") repeatLabel = "Yearly";
      else if (r.recurrence_type === "interval_days" && r.interval_days)
        repeatLabel = `Every ${r.interval_days} days`;
      else if (r.recurrence_type === "interval_months" && r.interval_months)
        repeatLabel = `Every ${r.interval_months} months`;
      else if (r.recurrence_type === "monthly_nth_work_day" && r.work_day_index)
        repeatLabel = `${r.work_day_index}. work day of month`;
      else if (r.recurrence_type === "monthly_nth_last_work_day" && r.work_day_index)
        repeatLabel = `${r.work_day_index}. last work day of month`;
      else repeatLabel = String(r.recurrence_type);
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
    .map(({ id, date, type, amount, description, categoryLabel, subcategoryLabel, accountFromName, accountToName }) => ({
      id,
      date,
      type,
      amount,
      description,
      categoryLabel,
      subcategoryLabel,
      accountFromName,
      accountToName,
    }));

  const calendarMovements = transactions.map(
    ({ id, date, type, amount, description, categoryLabel, subcategoryLabel, accountFromName, accountToName, status }) => ({
      id,
      date,
      type,
      amount,
      description,
      categoryLabel,
      subcategoryLabel,
      accountFromName,
      accountToName,
      status: status as "confirmed" | "pending",
    })
  );

  const recurringNextRuns = recurring
    .filter((r) => r.isActive && !r.isStopped)
    .map((r) => ({
      id: r.id,
      date: r.nextRunDate,
      type: r.type,
      amount: r.amount,
      description: r.description,
      categoryLabel: r.categoryLabel,
      subcategoryLabel: r.subcategoryLabel,
      accountFromName: r.accountFromName,
      accountToName: r.accountToName,
    }));

  return (
    <div className="space-y-6">
      {!currentWalletId ? (
        <>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-slate-600">
            Select or create a wallet to see the dashboard.
          </p>
        </>
      ) : (
        <div className="relative">
          <aside className="mb-8 flex flex-col items-center gap-4 xl:mb-0 xl:absolute xl:right-full xl:top-0 xl:mr-4 xl:items-stretch xl:w-[360px]">
            <div className="flex flex-wrap justify-center gap-2 xl:justify-stretch">
              <NewIncomeTrigger
                className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg border-2 border-green-200 bg-green-50/50 px-3 py-2 text-sm font-medium text-green-800 hover:border-green-400 hover:bg-green-100/50 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200 dark:hover:border-green-600 dark:hover:bg-green-900/30"
              >
                <span aria-hidden>↓</span>
                <span>New Income</span>
              </NewIncomeTrigger>
              <NewExpenseTrigger
                className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg border-2 border-red-200 bg-red-50/50 px-3 py-2 text-sm font-medium text-red-800 hover:border-red-400 hover:bg-red-100/50 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200 dark:hover:border-red-600 dark:hover:bg-red-900/30"
              >
                <span aria-hidden>↑</span>
                <span>New Expense</span>
              </NewExpenseTrigger>
              <NewTransferTrigger
                className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-medium text-blue-800 hover:border-blue-400 hover:bg-blue-100/50 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
              >
                <span aria-hidden>⇄</span>
                <span>New Transfer</span>
              </NewTransferTrigger>
            </div>
            <div className="flex justify-center xl:block">
              <DashboardCalendar movements={calendarMovements} recurringNextRuns={recurringNextRuns} />
            </div>
          </aside>
          <div className="space-y-8">
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <section>
              <RecurringSection recurring={recurring} />
            </section>
            <section>
              <PendingSection pending={pending} />
            </section>
            <section>
              <AllMovementsSection confirmed={confirmed} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
