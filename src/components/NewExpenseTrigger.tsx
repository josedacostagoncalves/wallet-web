"use client";

import { useMovementModals } from "@/contexts/MovementModalsContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function NewExpenseTrigger({ className, children }: Props) {
  const { openNewExpense } = useMovementModals();

  return (
    <button type="button" onClick={openNewExpense} className={className}>
      {children}
    </button>
  );
}
