"use client";

import { useTransactionModals } from "@/contexts/TransactionModalsContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function NewExpenseTrigger({ className, children }: Props) {
  const { openNewExpense } = useTransactionModals();

  return (
    <button type="button" onClick={openNewExpense} className={className}>
      {children}
    </button>
  );
}
