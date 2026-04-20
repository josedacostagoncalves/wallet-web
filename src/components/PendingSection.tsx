"use client";

import { TransactionTypeIcon } from "@/components/ActionIcons";
import { TransactionListIndicators } from "@/components/TransactionListIndicators";
import { TransactionRowActions } from "@/components/TransactionRowActions";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/transaction-labels";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type PendingRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
  holdBalance?: boolean;
  hasAttachment: boolean;
  isEssential: boolean;
  postedFromWalletName: string | null;
};

type Props = { pending: PendingRow[] };

export function PendingSection({ pending }: Props) {
  const router = useRouter();
  const t = useTranslations("transactions.pending");
  const tType = useTranslations("transactions");
  const tAllTable = useTranslations("transactions.allMovements.table");
  const tAllMovements = useTranslations("transactions.allMovements");
  const hasAny = pending.length > 0;
  const [expanded, setExpanded] = useState(hasAny);
  const prevHasAny = useRef(hasAny);

  useEffect(() => {
    if (prevHasAny.current && !hasAny) setExpanded(false);
    prevHasAny.current = hasAny;
  }, [hasAny]);

  async function onAfterAction() {
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? t("collapse") : t("expand")}
      >
        <span className="text-lg font-medium text-slate-800 dark:text-slate-100">{t("title")}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-500 dark:text-slate-400 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          {pending.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">{t("empty")}</div>
          ) : (
            <table className="w-full text-xs min-w-[640px] bg-white dark:bg-slate-950 border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300 w-10">{t("table.type")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">{t("table.date")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">{t("table.description")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                    {t("table.categorySubcategory")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">{t("table.fromTo")}</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-300 w-16">
                    <span className="sr-only">{tAllTable("symbolsColumn")}</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">{t("table.amount")}</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pending.map((p) => (
                  <tr key={p.id} className={`${p.holdBalance ? "bg-amber-100 dark:bg-amber-900/30" : "bg-amber-50 dark:bg-amber-900/20"} hover:bg-amber-100/80 dark:hover:bg-amber-900/40`}>
                    <td className="px-4 py-3">
                      <TransactionTypeIcon
                        type={p.type as "income" | "expense" | "transfer"}
                        label={tType(p.type as "income" | "expense" | "transfer")}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.date}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-[180px] truncate">
                      <span className="block truncate">{p.description || "—"}</span>
                      {p.postedFromWalletName ? (
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {tAllMovements("postedInWallet", { wallet: p.postedFromWalletName })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatCategorySubcategory(p.categoryLabel, p.subcategoryLabel)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatFromTo(p.accountFromName, p.accountToName)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 align-middle">
                      <TransactionListIndicators
                        hasAttachment={p.hasAttachment}
                        isEssential={p.isEssential}
                        ariaAttachment={tAllTable("hasAttachment")}
                        ariaEssential={tAllTable("essentialExpense")}
                      />
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${p.type === "income"
                        ? "text-green-600 dark:text-green-400"
                        : p.type === "expense"
                          ? "text-red-600 dark:text-red-400"
                          : p.type === "transfer"
                            ? "text-blue-600 dark:text-blue-400"
                            : ""
                        }`}
                    >
                      {p.type === "income" ? "+" : p.type === "expense" ? "−" : ""}
                      {p.amount.toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </td>
                    <td className="px-4 py-3">
                      <TransactionRowActions
                        id={p.id}
                        status="pending"
                        holdBalance={p.holdBalance}
                        onAfterAction={onAfterAction}
                        showEdit
                      />
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
