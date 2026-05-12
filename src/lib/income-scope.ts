import type { SupabaseClient } from "@supabase/supabase-js";

/** How income participates in wallet filters and cross-wallet totals. */
export type IncomeScope = "wallet" | "user";

/** PostgREST fragment: income rows that count as user-scoped (not "only this wallet"). */
const USER_SCOPED_INCOME_POSTGREST = "or(income_scope.eq.user,income_scope.is.null)";

/**
 * For shared wallets, all member `user_id`s (including placeholders) are used in the cross-wallet income OR filter.
 * For personal wallets, only the current user.
 */
export async function getIncomeReceiverMemberIdsForOrFilter(
  supabase: SupabaseClient,
  walletId: string,
  currentUserId: string
): Promise<string[]> {
  const [{ data: wallet }, { data: members }] = await Promise.all([
    supabase.from("wallets").select("is_shared").eq("id", walletId).maybeSingle(),
    supabase.from("wallet_members").select("user_id").eq("wallet_id", walletId),
  ]);
  const memberIds = Array.from(
    new Set(
      (members ?? [])
        .map((m: { user_id: string }) => m.user_id)
        .filter((id: string | null | undefined): id is string => !!id && String(id).trim().length > 0)
    )
  );
  const isShared = !!wallet?.is_shared || memberIds.length > 1;
  if (isShared && memberIds.length > 0) {
    return memberIds;
  }
  return [currentUserId];
}

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
    return `wallet_id.eq.${walletId},and(type.eq.income,${USER_SCOPED_INCOME_POSTGREST},received_by_member_id.eq.${ids[0]})`;
  }
  return `wallet_id.eq.${walletId},and(type.eq.income,${USER_SCOPED_INCOME_POSTGREST},received_by_member_id.in.(${ids.join(",")}))`;
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
