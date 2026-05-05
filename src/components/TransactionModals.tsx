"use client";

import dynamic from "next/dynamic";
import { useTransactionModals } from "@/contexts/TransactionModalsContext";

const IncomeFormModal = dynamic(
  () => import("@/components/IncomeFormModal").then((m) => ({ default: m.IncomeFormModal })),
  { loading: () => null }
);
const ExpenseFormModal = dynamic(
  () => import("@/components/ExpenseFormModal").then((m) => ({ default: m.ExpenseFormModal })),
  { loading: () => null }
);
const TransferFormModal = dynamic(
  () => import("@/components/TransferFormModal").then((m) => ({ default: m.TransferFormModal })),
  { loading: () => null }
);
const RecurringEditModal = dynamic(
  () => import("@/components/RecurringEditModal").then((m) => ({ default: m.RecurringEditModal })),
  { loading: () => null }
);

/** Global transaction modals (income / expense / transfer / recurring). Code-split per modal. */
export function TransactionModals() {
  const { state, closeModals } = useTransactionModals();
  const {
    which,
    mode,
    transactionId,
    copyFromTransactionId,
    copyFromRecurringId,
    recurringEditId,
    opening,
    prefetchedTransaction,
    prefetchedRecurringRule,
  } = state;

  return (
    <>
      {opening && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/20"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="rounded-lg bg-white dark:bg-slate-800 px-5 py-4 shadow-lg">
            <div
              className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin"
              aria-hidden
            />
          </div>
        </div>
      )}

      {which === "income" && (
        <IncomeFormModal
          open
          onClose={closeModals}
          mode={mode}
          transactionId={transactionId ?? undefined}
          copyFromTransactionId={copyFromTransactionId ?? undefined}
          copyFromRecurringId={copyFromRecurringId ?? undefined}
          prefetchedTransaction={prefetchedTransaction ?? undefined}
          prefetchedRecurringRule={prefetchedRecurringRule ?? undefined}
        />
      )}

      {which === "expense" && (
        <ExpenseFormModal
          open
          onClose={closeModals}
          mode={mode}
          transactionId={transactionId ?? undefined}
          copyFromTransactionId={copyFromTransactionId ?? undefined}
          copyFromRecurringId={copyFromRecurringId ?? undefined}
          prefetchedTransaction={prefetchedTransaction ?? undefined}
          prefetchedRecurringRule={prefetchedRecurringRule ?? undefined}
        />
      )}

      {which === "transfer" && (
        <TransferFormModal
          open
          onClose={closeModals}
          mode={mode}
          transactionId={transactionId ?? undefined}
          copyFromTransactionId={copyFromTransactionId ?? undefined}
          copyFromRecurringId={copyFromRecurringId ?? undefined}
          prefetchedTransaction={prefetchedTransaction ?? undefined}
          prefetchedRecurringRule={prefetchedRecurringRule ?? undefined}
        />
      )}

      {which === "recurring-edit" && recurringEditId && (
        <RecurringEditModal open onClose={closeModals} ruleId={recurringEditId} />
      )}
    </>
  );
}
