import type { SupabaseClient } from "@supabase/supabase-js";
import { expenseIsEffectivelyEssential } from "@/lib/expense-essential";

export const TRANSACTIONS_HUB_CONFIRMED_PAGE_SIZE = 600;

export type HubCategoryRow = {
  id?: string;
  name: string;
  parent_id: string | null;
  is_essential?: boolean | null;
};

export type HubTxRow = {
  id: string;
  wallet_id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  observations: string | null;
  is_essential?: boolean | null;
  account_from_id: string | null;
  account_to_id: string | null;
  paid_by_member_id: string | null;
  received_by_member_id: string | null;
  split_method_override: "equally" | "by_income" | "manual" | null;
  status?: string | null;
  hold_balance?: boolean;
  category: HubCategoryRow | null;
};

export type HubTxDisplay = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  observations: string | null;
  category: HubCategoryRow | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
  paidByMemberName: string | null;
  paidByMemberAvatar: string | null;
  receivedByMemberName: string | null;
  receivedByMemberAvatar: string | null;
  splitMethod: "equally" | "by_income" | "manual" | null;
  status: "confirmed" | "pending";
  holdBalance: boolean;
  hasAttachment: boolean;
  isEssential: boolean;
  postedFromWalletName: string | null;
};

type WalletInfoRow = {
  shared_option: string | null;
  split_type: string | null;
  default_split_method: string | null;
};

type MemberRow = { user_id: string; member_name: string | null };

/**
 * Maps raw transaction rows to hub display rows (accounts, categories, profiles, attachments).
 * Used by the transactions RSC page and by `loadMoreHubConfirmedTransactions`.
 */
export async function mapHubTransactionRowsToDisplay(
  supabase: SupabaseClient,
  currentWalletId: string,
  rows: HubTxRow[],
  preloaded: {
    accs: { id: string; name: string }[];
    cats: { id: string; name: string; parent_id: string | null }[];
    walletInfo: WalletInfoRow | null;
    memberList: MemberRow[];
  }
): Promise<HubTxDisplay[]> {
  const accountsMap = new Map((preloaded.accs ?? []).map((a) => [a.id, a.name]));
  const catIdToName = new Map((preloaded.cats ?? []).map((c) => [c.id, c.name]));
  const memberIdsFromWallet = preloaded.memberList.map((m) => m.user_id);
  const memberIdSet = new Set(memberIdsFromWallet);

  const receiverIdsForLookup = new Set<string>();
  for (const t of rows) {
    if (t.type === "income" && t.received_by_member_id && !memberIdSet.has(t.received_by_member_id)) {
      receiverIdsForLookup.add(t.received_by_member_id);
    }
  }
  const profileIdSet = new Set<string>([...memberIdsFromWallet, ...Array.from(receiverIdsForLookup)]);
  let profileRows: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[] =
    [];
  if (profileIdSet.size > 0) {
    const profilesRes = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", Array.from(profileIdSet));
    profileRows = (profilesRes.data ?? []) as typeof profileRows;
  }
  const profilesById = new Map(profileRows.map((p) => [p.id, p]));
  const membersMap = new Map<string, { name: string; avatar_url: string | null }>();
  for (const m of preloaded.memberList) {
    const profile = profilesById.get(m.user_id);
    const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
    const displayName = fullName || m.member_name || "Member";
    membersMap.set(m.user_id, { name: displayName, avatar_url: profile?.avatar_url ?? null });
  }
  for (const rid of Array.from(receiverIdsForLookup)) {
    if (membersMap.has(rid)) continue;
    const profile = profilesById.get(rid);
    const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
    membersMap.set(rid, {
      name: fullName || "Member",
      avatar_url: profile?.avatar_url ?? null,
    });
  }

  let walletSharedOption = preloaded.walletInfo?.shared_option ?? null;
  if (typeof walletSharedOption === "string") {
    const normalized = walletSharedOption.trim().toLowerCase();
    if (normalized === "control") walletSharedOption = "track";
    else if (normalized === "split_equal") walletSharedOption = "split";
    else if (normalized === "split_income") walletSharedOption = "track_and_split";
    else walletSharedOption = normalized;
  }
  const isSplitWallet =
    walletSharedOption === "split" ||
    walletSharedOption === "track_and_split" ||
    (!walletSharedOption && !!preloaded.walletInfo?.split_type);
  const defaultSplitMethod =
    preloaded.walletInfo?.default_split_method === "manual" ||
    preloaded.walletInfo?.default_split_method === "by_income"
      ? preloaded.walletInfo.default_split_method
      : preloaded.walletInfo?.split_type === "by_income"
        ? "by_income"
        : "equally";

  const catIdsNeeded = new Set<string>();
  const accountIdsNeeded = new Set<string>();
  for (const t of rows) {
    const c = t.category;
    if (c?.id) catIdsNeeded.add(c.id);
    if (c?.parent_id) catIdsNeeded.add(c.parent_id);
    if (t.account_from_id) accountIdsNeeded.add(t.account_from_id);
    if (t.account_to_id) accountIdsNeeded.add(t.account_to_id);
  }
  const missingCatIds = Array.from(catIdsNeeded).filter((id) => !catIdToName.has(id));
  const missingAccIds = Array.from(accountIdsNeeded).filter((id) => !accountsMap.has(id));
  const distinctWalletIds = Array.from(new Set(rows.map((r) => r.wallet_id)));
  const txIds = rows.map((r) => r.id);
  const walletNameById = new Map<string, string>();
  let txIdsWithAttachment = new Set<string>();

  await Promise.all([
    missingCatIds.length
      ? supabase
          .from("categories")
          .select("id, name, parent_id")
          .in("id", missingCatIds)
          .then(({ data: extraCats }) => {
            for (const c of extraCats ?? []) {
              catIdToName.set(c.id, c.name);
            }
          })
      : Promise.resolve(),
    missingAccIds.length
      ? supabase
          .from("accounts")
          .select("id, name")
          .in("id", missingAccIds)
          .then(({ data: extraAccs }) => {
            for (const a of extraAccs ?? []) {
              accountsMap.set(a.id, a.name);
            }
          })
      : Promise.resolve(),
    distinctWalletIds.length
      ? supabase
          .from("wallets")
          .select("id, name")
          .in("id", distinctWalletIds)
          .then(({ data: walletRows }) => {
            for (const w of walletRows ?? []) {
              walletNameById.set(w.id, w.name);
            }
          })
      : Promise.resolve(),
    txIds.length
      ? supabase
          .from("transaction_attachments")
          .select("transaction_id")
          .in("transaction_id", txIds)
          .then(({ data: attachRows }) => {
            txIdsWithAttachment = new Set(
              (attachRows ?? []).map((a: { transaction_id: string }) => a.transaction_id)
            );
          })
      : Promise.resolve(),
  ]);

  return rows.map((t) => {
    const c = t.category;
    const categoryLabel = c?.parent_id ? (catIdToName.get(c.parent_id) ?? "—") : (c?.name ?? "—");
    const subcategoryLabel = c?.parent_id ? (c?.name ?? "—") : "—";
    const accountFromName = t.account_from_id ? (accountsMap.get(t.account_from_id) ?? "—") : "—";
    const accountToName = t.account_to_id ? (accountsMap.get(t.account_to_id) ?? "—") : "—";
    const paidBy = t.paid_by_member_id ? membersMap.get(t.paid_by_member_id) : null;
    const receivedBy = t.received_by_member_id ? membersMap.get(t.received_by_member_id) : null;
    const splitMethod =
      isSplitWallet && t.type === "expense" ? (t.split_method_override ?? defaultSplitMethod) : null;
    const status = (t.status === "pending" ? "pending" : "confirmed") as "confirmed" | "pending";
    const hasAttachment = txIdsWithAttachment.has(t.id);
    const isEssential = expenseIsEffectivelyEssential(t.type, t.is_essential, c);
    const postedFromWalletName =
      t.wallet_id !== currentWalletId ? (walletNameById.get(t.wallet_id) ?? null) : null;
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      observations: t.observations ?? null,
      category: c,
      categoryLabel,
      subcategoryLabel,
      accountFromName,
      accountToName,
      paidByMemberName: paidBy?.name ?? null,
      paidByMemberAvatar: paidBy?.avatar_url ?? null,
      receivedByMemberName: receivedBy?.name ?? null,
      receivedByMemberAvatar: receivedBy?.avatar_url ?? null,
      splitMethod,
      status,
      holdBalance: !!t.hold_balance,
      hasAttachment,
      isEssential,
      postedFromWalletName,
    };
  });
}

export function hubTxDisplayToConfirmedRow(t: HubTxDisplay) {
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    amount: t.amount,
    description: t.description,
    observations: t.observations,
    categoryLabel: t.categoryLabel,
    subcategoryLabel: t.subcategoryLabel,
    accountFromName: t.accountFromName,
    accountToName: t.accountToName,
    paidByMemberName: t.paidByMemberName,
    paidByMemberAvatar: t.paidByMemberAvatar,
    receivedByMemberName: t.receivedByMemberName,
    receivedByMemberAvatar: t.receivedByMemberAvatar,
    splitMethod: t.splitMethod,
    hasAttachment: t.hasAttachment,
    isEssential: t.isEssential,
    postedFromWalletName: t.postedFromWalletName,
  };
}
