"use client";

import { useTransactionModals } from "@/contexts/TransactionModalsContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function NewTransferTrigger({ className, children }: Props) {
  const { openNewTransfer } = useTransactionModals();

  return (
    <button type="button" onClick={openNewTransfer} className={className}>
      {children}
    </button>
  );
}
