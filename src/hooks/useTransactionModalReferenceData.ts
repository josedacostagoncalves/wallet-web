"use client";

import {
  getAccounts,
  getCategories,
  getCategoriesFlatForSearch,
  type CategoryFlatRow,
} from "@/app/actions/transactions";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type AccountRow = { id: string; name: string; current_balance: number };
type CategoryRow = { id: string; name: string };

/**
 * Loads accounts and category trees when a transaction modal opens.
 * Used by income, expense, and transfer modals to avoid duplicating the same effects.
 */
export function useTransactionModalReferenceData(
  open: boolean,
  currentWalletId: string | null,
  transactionType: "income" | "expense" | "transfer"
): {
  accounts: AccountRow[];
  categories: CategoryRow[];
  categoriesFlat: CategoryFlatRow[];
  setCategories: Dispatch<SetStateAction<CategoryRow[]>>;
  setCategoriesFlat: Dispatch<SetStateAction<CategoryFlatRow[]>>;
} {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoriesFlat, setCategoriesFlat] = useState<CategoryFlatRow[]>([]);

  useEffect(() => {
    if (!open || !currentWalletId) return;
    getAccounts(currentWalletId).then(setAccounts);
    Promise.all([
      getCategories(currentWalletId, transactionType),
      getCategoriesFlatForSearch(currentWalletId, transactionType),
    ]).then(([cats, flat]) => {
      setCategories(cats);
      setCategoriesFlat(flat);
    });
  }, [open, currentWalletId, transactionType]);

  return {
    accounts,
    categories,
    categoriesFlat,
    setCategories,
    setCategoriesFlat,
  };
}
