/** Activity log: recent actions with actor names and links to related entities when available (RSC). */
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";

type ActivityRow = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  wallet_id: string | null;
  payload: unknown;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type TransactionInfo = {
  id: string;
  date: string;
  type: "income" | "expense" | "transfer";
  amount: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getAmount(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default async function ActivityPage() {
  const t = await getTranslations("activity");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: rowsData } = await supabase
    .from("activity_log")
    .select("id, user_id, action, entity_type, entity_id, wallet_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = (rowsData ?? []) as ActivityRow[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profiles = (profilesData ?? []) as ProfileRow[];
  const userNameById = new Map(
    profiles.map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || t("unknownUser"),
    ])
  );

  const transactionIds = Array.from(
    new Set(
      rows
        .filter((r) => r.entity_type === "transaction" && r.entity_id)
        .map((r) => r.entity_id as string)
    )
  );
  const { data: txData } = await supabase
    .from("transactions")
    .select("id, date, type, amount")
    .in("id", transactionIds.length ? transactionIds : ["00000000-0000-0000-0000-000000000000"]);
  const txRows = (txData ?? []) as Array<{
    id: string;
    date: string;
    type: "income" | "expense" | "transfer";
    amount: number | string;
  }>;
  const txById = new Map<string, TransactionInfo>(
    txRows.map((tx) => [
      tx.id,
      {
        id: tx.id,
        date: tx.date,
        type: tx.type,
        amount: Number(tx.amount),
      },
    ])
  );

  const actionLabel = (action: string) => {
    switch (action) {
      case "transaction_create":
        return t("actions.transactionCreate");
      case "transaction_edit":
        return t("actions.transactionEdit");
      case "transaction_delete":
        return t("actions.transactionDelete");
      case "transaction_confirm":
        return t("actions.transactionConfirm");
      case "account_create":
        return t("actions.accountCreate");
      case "account_edit":
        return t("actions.accountEdit");
      case "category_create":
        return t("actions.categoryCreate");
      case "category_edit":
        return t("actions.categoryEdit");
      case "category_deactivate":
        return t("actions.categoryDeactivate");
      case "category_delete":
        return t("actions.categoryDelete");
      case "wallet_create":
        return t("actions.walletCreate");
      case "wallet_edit":
        return t("actions.walletEdit");
      case "wallet_join":
        return t("actions.walletJoin");
      case "wallet_delete":
        return t("actions.walletDelete");
      case "wallet_restore":
        return t("actions.walletRestore");
      case "wallet_member_update":
        return t("actions.walletMemberUpdate");
      default:
        return t("actions.generic");
    }
  };
  const actionBadge = (action: string): { label: string; className: string } => {
    switch (action) {
      case "transaction_create":
      case "account_create":
      case "category_create":
      case "wallet_create":
      case "wallet_join":
      case "wallet_restore":
        return {
          label: t("badges.created"),
          className:
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        };
      case "transaction_edit":
      case "account_edit":
      case "category_edit":
      case "wallet_edit":
      case "wallet_member_update":
        return {
          label: t("badges.edited"),
          className:
            "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        };
      case "transaction_confirm":
        return {
          label: t("badges.confirmed"),
          className:
            "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
        };
      case "transaction_delete":
      case "category_delete":
      case "wallet_delete":
        return {
          label: t("badges.deleted"),
          className:
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        };
      case "category_deactivate":
        return {
          label: t("badges.deactivated"),
          className:
            "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        };
      default:
        return {
          label: t("badges.updated"),
          className:
            "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
        };
    }
  };

  const typeLabel = (type: unknown) => {
    if (type === "income") return t("types.income");
    if (type === "expense") return t("types.expense");
    if (type === "transfer") return t("types.transfer");
    return t("types.transaction");
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const transactionSubject = (type: unknown, date: string | null) =>
    date ? t("descriptions.transactionOfDay", { type: typeLabel(type), date }) : typeLabel(type);

  const descriptionFor = (row: ActivityRow) => {
    const payload = asObject(row.payload) ?? {};
    const tx = row.entity_type === "transaction" && row.entity_id ? txById.get(row.entity_id) : null;
    const subject = transactionSubject(
      tx?.type ?? payload.type,
      tx?.date ?? (typeof payload.date === "string" ? payload.date : null)
    );

    if (row.action === "transaction_create") {
      const amount = getAmount(payload.amount) ?? tx?.amount;
      if (amount != null) return t("descriptions.transactionCreated", { subject, amount: formatAmount(amount) });
      return t("descriptions.transactionUpdated", { subject });
    }

    if (row.action === "transaction_edit") {
      const changes = asObject(payload.changes);
      const amountChange = changes ? asObject(changes.amount) : null;
      if (amountChange) {
        const oldAmount = getAmount(amountChange.old);
        const newAmount = getAmount(amountChange.new);
        if (oldAmount != null && newAmount != null) {
          return t("descriptions.transactionAmountChanged", {
            subject,
            from: formatAmount(oldAmount),
            to: formatAmount(newAmount),
          });
        }
      }
      const fallbackAmount = changes ? getAmount(changes.amount) : null;
      if (fallbackAmount != null) {
        return t("descriptions.transactionAmountUpdated", {
          subject,
          to: formatAmount(fallbackAmount),
        });
      }
      return t("descriptions.transactionUpdated", { subject });
    }

    if (row.action === "transaction_delete") {
      const amount = getAmount(payload.amount);
      if (amount != null) return t("descriptions.transactionDeleted", { subject, amount: formatAmount(amount) });
      return t("descriptions.transactionDeletedSimple", { subject });
    }

    if (row.action === "transaction_confirm") {
      const amount = getAmount(payload.amount) ?? tx?.amount;
      if (amount != null) return t("descriptions.transactionConfirmed", { subject, amount: formatAmount(amount) });
      return t("descriptions.transactionConfirmedSimple", { subject });
    }

    switch (row.action) {
      case "account_create":
        return t("descriptions.accountCreated");
      case "account_edit":
        return t("descriptions.accountEdited");
      case "category_create":
        return t("descriptions.categoryCreated");
      case "category_edit":
        return t("descriptions.categoryEdited");
      case "category_deactivate":
        return t("descriptions.categoryDeactivated");
      case "category_delete":
        return t("descriptions.categoryDeleted");
      case "wallet_create":
        return t("descriptions.walletCreated");
      case "wallet_edit":
        return t("descriptions.walletEdited");
      case "wallet_join":
        return t("descriptions.walletJoined");
      case "wallet_delete":
        return t("descriptions.walletDeleted");
      case "wallet_restore":
        return t("descriptions.walletRestored");
      case "wallet_member_update":
        return t("descriptions.walletMemberUpdated");
      default:
        return t("descriptions.generic");
    }
  };

  const list = rows;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-6 text-slate-500">{t("empty")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left p-3">{t("table.date")}</th>
                  <th className="text-left p-3">{t("table.activity")}</th>
                  <th className="text-left p-3">{t("table.description")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const badge = actionBadge(r.action);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 dark:border-slate-700/50"
                    >
                    <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {new Date(r.created_at).toLocaleString(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-3 font-medium min-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span>
                          {t("activityByUser", {
                            name: userNameById.get(r.user_id) ?? t("unknownUser"),
                            action: actionLabel(r.action),
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 min-w-[360px]">
                      {descriptionFor(r)}
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
