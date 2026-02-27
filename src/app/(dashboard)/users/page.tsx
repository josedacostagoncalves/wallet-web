"use client";

import {
  addWalletMemberByName,
  ensureCurrentWalletMemberName,
  getWalletSettlements,
  linkWalletUserToJoinedMember,
  removeWalletMember,
} from "@/app/actions/wallets";
import { getOrEnsureProfile } from "@/app/actions/profiles";
import { AvatarImage } from "@/components/AvatarImage";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/contexts/ToastContext";
import { shouldShowUsers } from "@/lib/wallet-modes";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type UserRow = {
  user_id: string;
  role: string;
  display_name: string;
  balance: number;
  has_profile: boolean;
  avatar_url: string | null;
};

export default function UsersPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const { currentWalletId, wallets, user } = useWallet();
  const { showToast } = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkTargets, setLinkTargets] = useState<Record<string, string>>({});
  const [isOwner, setIsOwner] = useState(false);
  const currentWallet = wallets.find((w) => w.id === currentWalletId);
  const enabled = shouldShowUsers(currentWallet);

  const hasOwnerRow = useMemo(() => rows.some((r) => r.user_id === user?.id && r.role === "owner"), [rows, user?.id]);
  const canManageUsers = isOwner || hasOwnerRow;

  async function loadUsers() {
    if (!currentWalletId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const [ownerCheck, settlementsRes, selfProfile] = await Promise.all([
      supabase
        .from("wallet_members")
        .select("role")
        .eq("wallet_id", currentWalletId)
        .eq("user_id", user?.id ?? "")
        .maybeSingle(),
      getWalletSettlements(currentWalletId),
      user?.id
        ? getOrEnsureProfile(
          user.id,
          user.user_metadata as { first_name?: string | null; last_name?: string | null } | undefined
        )
        : Promise.resolve(null),
    ]);
    await ensureCurrentWalletMemberName(currentWalletId);
    setIsOwner(ownerCheck.data?.role === "owner");

    const membersQuery = await supabase
      .from("wallet_members")
      .select("user_id, role, member_name")
      .eq("wallet_id", currentWalletId);
    if (membersQuery.error) {
      showToast(membersQuery.error.message, "error");
      setRows([]);
      setLoading(false);
      return;
    }

    const members = membersQuery.data;
    const memberIds = (members ?? []).map((m: any) => m.user_id);
    const profilesQuery = memberIds.length
      ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", memberIds)
      : { data: [], error: null };
    if (profilesQuery.error) {
      showToast(profilesQuery.error.message, "error");
    }
    const profilesById = new Map((profilesQuery.data ?? []).map((p: any) => [p.id, p]));
    const settlements = settlementsRes.settlements;
    const balanceMap = new Map((settlements ?? []).map((s) => [s.member_id, s.balance / 100]));
    const mapped = (members ?? []).map((m: any) => {
      const profile = profilesById.get(m.user_id);
      const selfFullName = `${selfProfile?.first_name ?? ""} ${selfProfile?.last_name ?? ""}`.trim() ||
        `${(user?.user_metadata as any)?.first_name ?? ""} ${(user?.user_metadata as any)?.last_name ?? ""}`.trim();
      const selfFallback =
        m.user_id === user?.id
          ? selfFullName || (typeof user?.email === "string" ? user.email.split("@")[0] : "")
          : "";
      const selfAvatar = m.user_id === user?.id ? selfProfile?.avatar_url ?? null : null;
      const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
      const displayName =
        fullName ||
        selfFallback ||
        m.member_name ||
        m.user_id;
      return {
        user_id: m.user_id,
        role: m.role,
        display_name: displayName,
        balance: balanceMap.get(m.user_id) ?? 0,
        has_profile: !!profile || !!selfAvatar,
        avatar_url: profile?.avatar_url ?? selfAvatar ?? null,
      };
    });
    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWalletId]);

  async function onAdd() {
    if (!currentWalletId) return;
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const res = await addWalletMemberByName(currentWalletId, name);
    setAdding(false);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    setNewName("");
    await loadUsers();
    showToast(t("toasts.added"));
  }

  async function onRemove(memberId: string) {
    if (!currentWalletId) return;
    setRemovingId(memberId);
    const res = await removeWalletMember(currentWalletId, memberId);
    setRemovingId(null);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    await loadUsers();
    showToast(t("toasts.removed"));
  }

  async function onLink(walletUserId: string) {
    if (!currentWalletId) return;
    const joinedMemberId = linkTargets[walletUserId];
    if (!joinedMemberId) return;
    setLinkingId(walletUserId);
    const res = await linkWalletUserToJoinedMember(currentWalletId, walletUserId, joinedMemberId);
    setLinkingId(null);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    await loadUsers();
    showToast("User linked");
  }

  if (loading) return <p className="text-slate-500">{tCommon("loading")}</p>;
  const joinedCandidates = rows.filter((r) => r.role !== "owner" && r.has_profile);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>
      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">{t("page.noWallet")}</p>
      ) : !enabled ? (
        <p className="text-slate-600 dark:text-slate-400">{t("page.onlySplitWallets")}</p>
      ) : (
        <>
          {canManageUsers && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("page.namePlaceholder")}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm"
              />
              <button
                type="button"
                onClick={onAdd}
                disabled={adding || !newName.trim()}
                className="px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                {adding ? t("page.adding") : t("addUser")}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {rows.length === 0 ? (
              <div className="p-6 text-slate-500">{t("noUsers")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left p-3">{t("table.name")}</th>
                    <th className="text-left p-3">{t("table.role")}</th>
                    <th className="text-right p-3">{t("table.balance")}</th>
                    <th className="text-left p-3 w-24">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.user_id} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          <AvatarImage
                            src={r.avatar_url}
                            size={24}
                            className="h-6 w-6 rounded-full object-cover"
                            fallback={
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M20 21a8 8 0 0 0-16 0" />
                                  <circle cx="12" cy="8" r="4" />
                                </svg>
                              </span>
                            }
                          />
                          <span>{r.display_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {r.role === "owner" ? t("roles.owner") : t("roles.member")}
                      </td>
                      <td className={"p-3 text-right font-mono " + (r.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {r.balance >= 0 ? "+" : ""}
                        {r.balance.toFixed(2)} €
                      </td>
                      <td className="p-3">
                        {canManageUsers && r.role !== "owner" ? (
                          <div className="flex items-center gap-2">
                            {!r.has_profile && joinedCandidates.length > 0 ? (
                              <>
                                <select
                                  value={linkTargets[r.user_id] ?? ""}
                                  onChange={(e) => setLinkTargets((prev) => ({ ...prev, [r.user_id]: e.target.value }))}
                                  className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                >
                                  <option value="">Link to...</option>
                                  {joinedCandidates
                                    .filter((c) => c.user_id !== r.user_id)
                                    .map((c) => (
                                      <option key={c.user_id} value={c.user_id}>
                                        {c.display_name}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => onLink(r.user_id)}
                                  disabled={!linkTargets[r.user_id] || linkingId === r.user_id}
                                  className="px-2 py-1 text-xs border border-blue-300 text-blue-700 dark:border-blue-500 dark:text-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                                >
                                  {linkingId === r.user_id ? "Linking..." : "Link"}
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onRemove(r.user_id)}
                              disabled={removingId === r.user_id}
                              className="px-2 py-1 text-xs border border-red-300 text-red-600 dark:border-red-500 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                            >
                              {removingId === r.user_id ? t("page.removing") : tCommon("delete")}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

