/** How income participates in wallet filters and cross-wallet totals. */
export type IncomeScope = "wallet" | "user";

export function normalizeIncomeScope(
  type: string,
  raw: string | null | undefined
): IncomeScope | null {
  if (type !== "income") return null;
  if (raw === "wallet") return "wallet";
  return "user";
}

/** PostgREST `.or()` filter: rows in this wallet OR user-scoped incomes **received by** this user (any wallet). */
export function transactionsForWalletOrUserIncomes(walletId: string, userId: string): string {
  return `wallet_id.eq.${walletId},and(type.eq.income,income_scope.eq.user,received_by_member_id.eq.${userId})`;
}

/** DB value for new/edited income when the client sends a scope choice. */
export function incomeScopeForInsert(type: string, scope: IncomeScope | null | undefined): IncomeScope | null {
  if (type !== "income") return null;
  return scope === "wallet" ? "wallet" : "user";
}
