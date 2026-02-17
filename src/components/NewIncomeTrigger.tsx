"use client";

import { useTransactionModals } from "@/contexts/TransactionModalsContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function NewIncomeTrigger({ className, children }: Props) {
  const { openNewIncome } = useTransactionModals();

  return (
    <button type="button" onClick={openNewIncome} className={className}>
      {children}
    </button>
  );
}
