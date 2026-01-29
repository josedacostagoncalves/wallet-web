"use client";

import { useMovementModals } from "@/contexts/MovementModalsContext";
import { ExpenseFormModal } from "@/components/ExpenseFormModal";
import { IncomeFormModal } from "@/components/IncomeFormModal";
import { RecurringEditModal } from "@/components/RecurringEditModal";
import { TransferFormModal } from "@/components/TransferFormModal";

export function MovementModals() {
  const { state, closeModals } = useMovementModals();
  const { which, mode, movementId, copyFromMovementId, copyFromRecurringId, recurringEditId, opening } = state;

  return (
    <>
      {opening && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/20"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="rounded-lg bg-white dark:bg-slate-800 px-4 py-3 shadow-lg text-sm font-medium text-slate-700 dark:text-slate-200">
            Loading…
          </div>
        </div>
      )}

      {which === "income" && (
        <IncomeFormModal
          open
          onClose={closeModals}
          mode={mode}
          movementId={movementId ?? undefined}
          copyFromMovementId={copyFromMovementId ?? undefined}
          copyFromRecurringId={copyFromRecurringId ?? undefined}
        />
      )}

      {which === "expense" && (
        <ExpenseFormModal
          open
          onClose={closeModals}
          mode={mode}
          movementId={movementId ?? undefined}
          copyFromMovementId={copyFromMovementId ?? undefined}
          copyFromRecurringId={copyFromRecurringId ?? undefined}
        />
      )}

      {which === "transfer" && (
        <TransferFormModal
          open
          onClose={closeModals}
          mode={mode}
          movementId={movementId ?? undefined}
          copyFromMovementId={copyFromMovementId ?? undefined}
          copyFromRecurringId={copyFromRecurringId ?? undefined}
        />
      )}

      {which === "recurring-edit" && recurringEditId && (
        <RecurringEditModal
          open
          onClose={closeModals}
          ruleId={recurringEditId}
        />
      )}
    </>
  );
}
