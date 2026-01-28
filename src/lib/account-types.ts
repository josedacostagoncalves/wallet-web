export type AccountType =
  | "bank_account"
  | "cash"
  | "credit_card"
  | "savings"
  | "investments";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank_account", label: "Bank Account" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "savings", label: "Savings" },
  { value: "investments", label: "Investments" },
];

/** Minimalist, recognizable icon per account type (emoji). */
export const ACCOUNT_TYPE_ICON: Record<AccountType, string> = {
  bank_account: "🏦",
  cash: "💵",
  credit_card: "💳",
  savings: "🐷",
  investments: "📈",
};

export function accountTypeLabel(t: AccountType): string {
  return ACCOUNT_TYPES.find((o) => o.value === t)?.label ?? t;
}

export function accountTypeIcon(t: AccountType): string {
  return ACCOUNT_TYPE_ICON[t] ?? "○";
}
