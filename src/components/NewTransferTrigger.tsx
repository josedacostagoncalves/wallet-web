"use client";

import { useMovementModals } from "@/contexts/MovementModalsContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function NewTransferTrigger({ className, children }: Props) {
  const { openNewTransfer } = useMovementModals();

  return (
    <button type="button" onClick={openNewTransfer} className={className}>
      {children}
    </button>
  );
}
