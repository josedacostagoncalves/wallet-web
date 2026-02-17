"use client";

import { TransactionTypeIcon } from "@/components/ActionIcons";
import { TransactionRowActions } from "@/components/TransactionRowActions";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/transaction-labels";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
};

type Props = { pending: PendingRow[] };

export function PendingSection({ pending }: Props) {
  const router = useRouter();
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
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse pending" : "Expand pending"}
      >
        <span className="text-lg font-medium text-slate-800">Pending</span>
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
          {pending.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">No pending transactions.</div>
          ) : (
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 w-10">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Category :: Subcategory
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">From → To</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pending.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50/50 ${p.holdBalance ? "bg-amber-100" : "bg-amber-50"}`}>
                    <td className="px-4 py-3">
                      <TransactionTypeIcon type={p.type as "income" | "expense" | "transfer"} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {p.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatCategorySubcategory(p.categoryLabel, p.subcategoryLabel)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatFromTo(p.accountFromName, p.accountToName)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${p.type === "income"
                        ? "text-green-600"
                        : p.type === "expense"
                          ? "text-red-600"
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
