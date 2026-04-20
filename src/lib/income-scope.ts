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

/**
 * PostgREST `.or()` filter: rows in this wallet OR user-scoped incomes **received by** any of the given users (any wallet).
 * Expenses/transfers only match the wallet branch (second branch requires `type.eq.income`).
 */
export function transactionsForWalletOrReceiverUserIncomes(walletId: string, receiverUserIds: string[]): string {
  const ids = Array.from(
    new Set(receiverUserIds.map((id) => String(id).trim()).filter(Boolean))
  );
  if (ids.length === 0) {
    return `wallet_id.eq.${walletId}`;
  }
  if (ids.length === 1) {
    return `wallet_id.eq.${walletId},and(type.eq.income,income_scope.eq.user,received_by_member_id.eq.${ids[0]})`;
  }
  return `wallet_id.eq.${walletId},and(type.eq.income,income_scope.eq.user,received_by_member_id.in.(${ids.join(",")}))`;
}

/** PostgREST `.or()` filter: rows in this wallet OR user-scoped incomes **received by** this user (any wallet). */
export function transactionsForWalletOrUserIncomes(walletId: string, userId: string): string {
  return transactionsForWalletOrReceiverUserIncomes(walletId, [userId]);
}

/** DB value for new/edited income when the client sends a scope choice. */
export function incomeScopeForInsert(type: string, scope: IncomeScope | null | undefined): IncomeScope | null {
  if (type !== "income") return null;
  return scope === "wallet" ? "wallet" : "user";
}
