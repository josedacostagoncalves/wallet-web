"use client";

import { copyRecurringRule, deleteRecurringRule } from "@/app/actions/recurring";
import {
  formatCategorySubcategory,
  formatFromTo,
} from "@/lib/movement-labels";
import { movementRowBgClass } from "@/lib/movement-row-style";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCopy(ruleId: string) {
    setCopyingId(ruleId);
    const res = await copyRecurringRule(ruleId);
    setCopyingId(null);
    if (res.error) return;
    router.refresh();
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("Delete this recurring rule? No new runs will be created. Existing movements are kept.")) return;
    setDeletingId(ruleId);
    const res = await deleteRecurringRule(ruleId);
    setDeletingId(null);
    if (res.error) return;
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {recurring.length === 0 ? (
        <div className="p-6 text-slate-500 text-xs">
          No recurring movements.{" "}
          <Link href="/movements/new" className="underline">
            Add a movement
          </Link>{" "}
          and enable &quot;Make it recurring&quot;.
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse recurring" : "Expand recurring"}
          >
            <span className="text-lg font-medium text-slate-800">
              Recurring
            </span>
            <span
              className={`inline-block text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
              aria-hidden
            >
              ▶
            </span>
          </button>
          {expanded && (
            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Next run
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Category :: Subcategory
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      From → To
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Repeat
                    </th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recurring.map((r) => (
                    <tr
                      key={r.id}
                      className={`${movementRowBgClass(r.type)} ${!r.isActive || r.isStopped ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {r.isStopped ? (
                          <span
                            className="text-amber-700 dark:text-amber-400"
                            title={`End date ${r.endDate ?? ""} passed. Next run would be ${r.nextRunDate}.`}
                          >
                            Stopped (end date passed)
                          </span>
                        ) : (
                          r.nextRunDate
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                        {r.description}
                      </td>
                      <td className="px-4 py-3 capitalize">{r.type}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatCategorySubcategory(r.categoryLabel, r.subcategoryLabel)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatFromTo(r.accountFromName, r.accountToName)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          r.type === "income"
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
                        <span className="inline-flex flex-wrap gap-2">
                          {r.isActive && (
                            <button
                              type="button"
                              onClick={() => handleCopy(r.id)}
                              disabled={!!copyingId}
                              className="text-slate-500 hover:underline disabled:opacity-50"
                            >
                              {copyingId === r.id ? "Copying…" : "Copy"}
                            </button>
                          )}
                          <Link
                            href={`/recurring/${r.id}/edit`}
                            className="text-slate-500 hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            disabled={!!deletingId}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingId === r.id ? "Deleting…" : "Delete"}
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
    </div>
  );
}
