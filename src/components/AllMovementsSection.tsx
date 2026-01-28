"use client";

import { MovementRowActions } from "@/components/MovementRowActions";
import { movementRowBgClass } from "@/lib/movement-row-style";
import Link from "next/link";
import { useState } from "react";

export type ConfirmedRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
};

type Props = { confirmed: ConfirmedRow[] };

export function AllMovementsSection({ confirmed }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse all movements" : "Expand all movements"}
      >
        <span className="text-lg font-medium text-slate-800">All movements</span>
        <span
          className={`inline-block text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
      </button>
      {expanded && (
        <div className="overflow-x-auto border-t border-slate-200">
          {confirmed.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No movements yet.{" "}
              <Link href="/movements/new" className="underline">
                Add one
              </Link>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Category → Subcategory
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">From → To</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {confirmed.map((t) => (
                  <tr key={t.id} className={movementRowBgClass(t.type)}>
                    <td className="px-4 py-3 text-slate-600">{t.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {t.description || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{t.type}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.categoryLabel} → {t.subcategoryLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.accountFromName} → {t.accountToName}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        t.type === "income"
                          ? "text-green-600"
                          : t.type === "expense"
                            ? "text-red-600"
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
                    <td className="px-4 py-3">
                      <MovementRowActions id={t.id} status="confirmed" />
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
