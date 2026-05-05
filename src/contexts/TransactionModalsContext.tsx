"use client";

/**
 * Controls which global transaction modal is open. Edit/copy prefetch one server read so modals do not repeat it.
 */
import { getTransaction, type TransactionDetail } from "@/app/actions/transactions";
import { getRecurringRule, type RecurringRuleRow } from "@/app/actions/recurring";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TransactionModalType = "income" | "expense" | "transfer" | "recurring-edit";
export type TransactionModalMode = "new" | "edit" | "copy";

type TransactionModalsState = {
  which: TransactionModalType | null;
  mode: TransactionModalMode;
  transactionId: string | null;
  copyFromTransactionId: string | null;
  copyFromRecurringId: string | null;
  recurringEditId: string | null;
  opening: boolean;
  /** Fetched once when opening edit/copy transaction; modals reuse it instead of calling getTransaction again. */
  prefetchedTransaction: TransactionDetail | null;
  /** Fetched once when opening copy-from-recurring; modals reuse it instead of calling getRecurringRule again. */
  prefetchedRecurringRule: RecurringRuleRow | null;
};

const initialState: TransactionModalsState = {
  which: null,
  mode: "new",
  transactionId: null,
  copyFromTransactionId: null,
  copyFromRecurringId: null,
  recurringEditId: null,
  opening: false,
  prefetchedTransaction: null,
  prefetchedRecurringRule: null,
};

type TransactionModalsContextValue = {
  state: TransactionModalsState;
  openNewIncome: () => void;
  openNewExpense: () => void;
  openNewTransfer: () => void;
  openEditTransaction: (id: string) => void;
  openCopyTransaction: (id: string) => void;
  openEditRecurring: (id: string) => void;
  openCopyRecurring: (id: string) => void;
  closeModals: () => void;
};

const TransactionModalsContext = createContext<TransactionModalsContextValue | null>(null);

export function useTransactionModals() {
  const ctx = useContext(TransactionModalsContext);
  if (!ctx) throw new Error("useTransactionModals must be used within TransactionModalsProvider");
  return ctx;
}

type Props = { children: ReactNode };

export function TransactionModalsProvider({ children }: Props) {
  const [state, setState] = useState<TransactionModalsState>(initialState);

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

  const openEditTransaction = useCallback(async (id: string) => {
    setState((s) => ({ ...s, opening: true }));
    const m = await getTransaction(id);
    setState((s) => ({ ...s, opening: false }));
    if (!m) return;
    const which = m.type as "income" | "expense" | "transfer";
    setState({
      ...initialState,
      which,
      mode: "edit",
      transactionId: id,
      prefetchedTransaction: m,
    });
  }, []);

  const openCopyTransaction = useCallback(async (id: string) => {
    setState((s) => ({ ...s, opening: true }));
    const m = await getTransaction(id);
    setState((s) => ({ ...s, opening: false }));
    if (!m) return;
    const which = m.type as "income" | "expense" | "transfer";
    setState({
      ...initialState,
      which,
      mode: "copy",
      copyFromTransactionId: id,
      prefetchedTransaction: m,
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
      prefetchedRecurringRule: r,
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      openNewIncome,
      openNewExpense,
      openNewTransfer,
      openEditTransaction,
      openCopyTransaction,
      openEditRecurring,
      openCopyRecurring,
      closeModals,
    }),
    [
      state,
      openNewIncome,
      openNewExpense,
      openNewTransfer,
      openEditTransaction,
      openCopyTransaction,
      openEditRecurring,
      openCopyRecurring,
      closeModals,
    ]
  );

  return (
    <TransactionModalsContext.Provider value={value}>
      {children}
    </TransactionModalsContext.Provider>
  );
}
