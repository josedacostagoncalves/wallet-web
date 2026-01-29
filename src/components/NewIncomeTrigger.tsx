"use client";

import { useMovementModals } from "@/contexts/MovementModalsContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function NewIncomeTrigger({ className, children }: Props) {
  const { openNewIncome } = useMovementModals();

  return (
    <button type="button" onClick={openNewIncome} className={className}>
      {children}
    </button>
  );
}
