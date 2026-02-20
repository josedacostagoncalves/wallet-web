"use client";

import { deleteRecurringRule } from "@/app/actions/recurring";
import { CopyIcon, DeleteIcon, EditIcon, TransactionTypeIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTransactionModals } from "@/contexts/TransactionModalsContext";
import { useToast } from "@/contexts/ToastContext";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/transaction-labels";
import { transactionRowBgClass } from "@/lib/transaction-row-style";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export type RecurringRow = {
  id: string;
  description: string;
  type: string;
  amount: number;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
  repeatLabel: string;
  nextRunDate: string;
  isActive: boolean;
  endDate: string | null;
  isStopped: boolean;
};

type Props = { recurring: RecurringRow[] };

export function RecurringSection({ recurring }: Props) {
  const router = useRouter();
  const t = useTranslations("transactions.recurring");
  const { showToast } = useToast();
  const { openEditRecurring, openCopyRecurring } = useTransactionModals();
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  async function handleDeleteConfirm(ruleId: string) {
    setDeletingId(ruleId);
    const res = await deleteRecurringRule(ruleId);
    setDeletingId(null);
    setDeleteDialogId(null);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    showToast(t("deleteToast"));
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {recurring.length === 0 ? (
        <div className="p-6 text-slate-500 text-xs">
          {t.rich("empty", {
            link: (chunks) => (
              <Link href="/transactions/new" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? t("collapse") : t("expand")}
          >
            <span className="text-lg font-medium text-slate-800">
              {t("title")}
            </span>
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
              className={`text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
              aria-hidden
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          {expanded && (
            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 w-10">{t("table.type")}</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      {t("table.nextRun")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      {t("table.description")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      {t("table.categorySubcategory")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      {t("table.fromTo")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      {t("table.amount")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      {t("table.repeat")}
                    </th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recurring.map((r) => (
                    <tr
                      key={r.id}
                      className={`${transactionRowBgClass(r.type)} ${!r.isActive || r.isStopped ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <TransactionTypeIcon type={r.type as "income" | "expense" | "transfer"} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.isStopped ? (
                          <span
                            className="text-amber-700 dark:text-amber-400"
                            title={t("stoppedTooltip", {
                              endDate: r.endDate ?? "",
                              nextRun: r.nextRunDate,
                            })}
                          >
                            {t("stopped")}
                          </span>
                        ) : (
                          r.nextRunDate
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                        {r.description}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatCategorySubcategory(r.categoryLabel, r.subcategoryLabel)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatFromTo(r.accountFromName, r.accountToName)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${r.type === "income"
                          ? "text-green-600"
                          : r.type === "expense"
                            ? "text-red-600"
                            : ""
                          }`}
                      >
                        {r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}
                        {r.amount.toLocaleString("pt-PT", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.repeatLabel}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          {r.isActive && (
                            <button
                              type="button"
                              onClick={() => openCopyRecurring(r.id)}
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                              title="Copy"
                              aria-label="Copy"
                            >
                              <CopyIcon aria-hidden />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditRecurring(r.id)}
                            className="p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                            title="Edit"
                            aria-label="Edit"
                          >
                            <EditIcon aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDialogId(r.id)}
                            disabled={!!deletingId}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <DeleteIcon aria-hidden />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {deleteDialogId && (
        <ConfirmDialog
          open={!!deleteDialogId}
          onClose={() => setDeleteDialogId(null)}
          onConfirm={() => handleDeleteConfirm(deleteDialogId)}
          title={t("confirmDelete.title")}
          message={t("confirmDelete.message")}
          confirmLabel={t("confirmDelete.confirm")}
          cancelLabel={t("confirmDelete.cancel")}
          variant="cancel"
          loading={!!deletingId}
        />
      )}
    </div>
  );
}
