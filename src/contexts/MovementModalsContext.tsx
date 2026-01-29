"use client";

import { getMovement } from "@/app/actions/movements";
import { getRecurringRule } from "@/app/actions/recurring";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MovementModalType = "income" | "expense" | "transfer" | "recurring-edit";
export type MovementModalMode = "new" | "edit" | "copy";

type MovementModalsState = {
  which: MovementModalType | null;
  mode: MovementModalMode;
  movementId: string | null;
  copyFromMovementId: string | null;
  copyFromRecurringId: string | null;
  recurringEditId: string | null;
  opening: boolean;
};

const initialState: MovementModalsState = {
  which: null,
  mode: "new",
  movementId: null,
  copyFromMovementId: null,
  copyFromRecurringId: null,
  recurringEditId: null,
  opening: false,
};

type MovementModalsContextValue = {
  state: MovementModalsState;
  openNewIncome: () => void;
  openNewExpense: () => void;
  openNewTransfer: () => void;
  openEditMovement: (id: string) => void;
  openCopyMovement: (id: string) => void;
  openEditRecurring: (id: string) => void;
  openCopyRecurring: (id: string) => void;
  closeModals: () => void;
};

const MovementModalsContext = createContext<MovementModalsContextValue | null>(null);

export function useMovementModals() {
  const ctx = useContext(MovementModalsContext);
  if (!ctx) throw new Error("useMovementModals must be used within MovementModalsProvider");
  return ctx;
}

type Props = { children: ReactNode };

export function MovementModalsProvider({ children }: Props) {
  const [state, setState] = useState<MovementModalsState>(initialState);

  const closeModals = useCallback(() => {
    setState(initialState);
  }, []);

  const openNewIncome = useCallback(() => {
    setState({
      ...initialState,
      which: "income",
      mode: "new",
    });
  }, []);

  const openNewExpense = useCallback(() => {
    setState({
      ...initialState,
      which: "expense",
      mode: "new",
    });
  }, []);

  const openNewTransfer = useCallback(() => {
    setState({
      ...initialState,
      which: "transfer",
      mode: "new",
    });
  }, []);

  const openEditMovement = useCallback(async (id: string) => {
    setState((s) => ({ ...s, opening: true }));
    const m = await getMovement(id);
    setState((s) => ({ ...s, opening: false }));
    if (!m) return;
    const which = m.type as "income" | "expense" | "transfer";
    setState({
      ...initialState,
      which,
      mode: "edit",
      movementId: id,
    });
  }, []);

  const openCopyMovement = useCallback(async (id: string) => {
    setState((s) => ({ ...s, opening: true }));
    const m = await getMovement(id);
    setState((s) => ({ ...s, opening: false }));
    if (!m) return;
    const which = m.type as "income" | "expense" | "transfer";
    setState({
      ...initialState,
      which,
      mode: "copy",
      copyFromMovementId: id,
    });
  }, []);

  const openEditRecurring = useCallback((id: string) => {
    setState({
      ...initialState,
      which: "recurring-edit",
      mode: "edit",
      recurringEditId: id,
    });
  }, []);

  const openCopyRecurring = useCallback(async (id: string) => {
    setState((s) => ({ ...s, opening: true }));
    const r = await getRecurringRule(id);
    setState((s) => ({ ...s, opening: false }));
    if (!r) return;
    const which = r.type as "income" | "expense" | "transfer";
    setState({
      ...initialState,
      which,
      mode: "copy",
      copyFromRecurringId: id,
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      openNewIncome,
      openNewExpense,
      openNewTransfer,
      openEditMovement,
      openCopyMovement,
      openEditRecurring,
      openCopyRecurring,
      closeModals,
    }),
    [
      state,
      openNewIncome,
      openNewExpense,
      openNewTransfer,
      openEditMovement,
      openCopyMovement,
      openEditRecurring,
      openCopyRecurring,
      closeModals,
    ]
  );

  return (
    <MovementModalsContext.Provider value={value}>
      {children}
    </MovementModalsContext.Provider>
  );
}
