"use client";

import {
  updateWallet,
  getWalletShareCode,
  updateMemberIncome,
  getWalletSettlements,
} from "@/app/actions/wallets";
import { useToast } from "@/contexts/ToastContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MemberRow = {
  user_id: string;
  display_name?: string;
  role?: string;
  income_monthly?: number | null;
  editingIncome?: boolean;
  balance?: number;
};

export default function EditWalletPage() {
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tWallets = useTranslations("wallets");
  const params = useParams();
  const id = String(params.id);
  const { showToast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [sharedOption, setSharedOption] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [loadingShareCode, setLoadingShareCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCodeError, setShareCodeError] = useState<string | null>(null);
  const [isSavedAsShared, setIsSavedAsShared] = useState(false);

  async function loadMembers(walletId: string) {
    const supabase = createClient();
    const { data: memberList, error: memberErr } = await supabase
      .from("wallet_members")
      .select("user_id, role, member_name, income_monthly")
      .eq("wallet_id", walletId);
    if (memberErr || !memberList) return;
    const memberIds = memberList.map((m: any) => m.user_id);
    let profileRows: any[] = [];
    if (memberIds.length) {
      const profilesRes = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", memberIds);
      profileRows = profilesRes.data ?? [];
    }
    const profilesById = new Map((profileRows ?? []).map((p: any) => [p.id, p]));

    const { settlements } = await getWalletSettlements(walletId);
    const balanceMap = new Map((settlements ?? []).map((s) => [s.member_id, s.balance / 100]));

    const membersWithEmail: MemberRow[] = memberList.map((m: any) => {
      const profile = profilesById.get(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        display_name:
          `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
          m.member_name ||
          "Member",
        income_monthly: m.income_monthly,
        editingIncome: false,
        balance: balanceMap.get(m.user_id) ?? 0,
      };
    });
    setMembers(membersWithEmail);
  }

  async function loadShareCode() {
    // Check if wallet needs to be saved as shared first
    if (isShared && !isSavedAsShared) {
      setShareCodeError(tWallets("page.edit.share.saveFirst"));
      return;
    }

    setLoadingShareCode(true);
    setShareCodeError(null);
    const res = await getWalletShareCode(id);
    setLoadingShareCode(false);
    if (res.error) {
      // Log error for debugging
      console.error("Failed to load share code:", res.error);
      setShareCode(null);
      // Show error message to user
      setShareCodeError(res.error);
    } else {
      setShareCode(res.shareCode ?? null);
      setShareCodeError(null);
    }
  }

  useEffect(() => {
    async function loadWallet() {
      const supabase = createClient();
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError(tAuth("notAuthenticated"));
        setLoading(false);
        return;
      }

      // Query wallet through membership to ensure user has access
      const { data, error: e } = await supabase
        .from("wallet_members")
        .select("wallet_id, role, wallets(name, is_shared, is_active, shared_option, split_type)")
        .eq("wallet_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      setLoading(false);
      if (e) {
        setError(e.message);
        return;
      }
      if (!data || !data.wallets) {
        setError(tWallets("page.edit.notFound"));
        return;
      }
      type WalletRow = { name: string; is_shared: boolean; is_active: boolean; shared_option?: string | null; split_type?: string | null };
      const raw = data.wallets as WalletRow | WalletRow[] | null;
      const wallet = Array.isArray(raw) ? raw[0] : raw;
      if (!wallet) {
        setError(tWallets("page.edit.notFound"));
        return;
      }
      setName(wallet.name);
      setIsShared(wallet.is_shared);
      setSharedOption(wallet.shared_option ?? null);
      setSplitType(wallet.split_type ?? null);
      setIsActive(wallet.is_active);
      setIsSavedAsShared(wallet.is_shared);
      await loadMembers(id);
      // Track if wallet is saved as shared in DB
      // Load share code if wallet is shared
      if (wallet.is_shared) {
        // Small delay to ensure wallet state is consistent
        setTimeout(() => {
          loadShareCode();
        }, 100);
      }
    }
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadShareCode intentionally excluded; we only run on mount/id change
  }, [id]);

  async function handleShareToggle(checked: boolean) {
    setIsShared(checked);
    if (!checked) {
      setShareCode(null);
      setSharedOption(null);
      setIsSavedAsShared(false);
    } else {
      // When enabling shared, default to 'track' if not already set
      if (!sharedOption) setSharedOption('track');
      // Mark as not saved yet
      setIsSavedAsShared(false);
    }
    // Note: Share code will be loaded after saving if sharing is enabled
  }

  function copyShareCode() {
    if (shareCode) {
      navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function copyShareLink() {
    if (shareCode) {
      const shareLink = `${window.location.origin}/wallets/join?code=${shareCode}`;
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function sendEmail() {
    if (shareCode) {
      const shareLink = `${window.location.origin}/wallets/join?code=${shareCode}`;
      const subject = encodeURIComponent(`Join my wallet: ${name}`);
      const body = encodeURIComponent(
        `I'd like to invite you to join my wallet "${name}".\n\n` +
        `Use this code to join: ${shareCode}\n\n` +
        `Or click this link: ${shareLink}`
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  }

  async function handleMemberIncomeUpdate(memberId: string, newIncome: number | null) {
    const res = await updateMemberIncome(id, memberId, newIncome);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    // Update local state
    setMembers(members.map((m) =>
      m.user_id === memberId
        ? { ...m, income_monthly: newIncome, editingIncome: false }
        : m
    ));
    showToast(tWallets("toasts.memberIncomeUpdated"));
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const isSplit = sharedOption === 'split' || sharedOption === 'track_and_split';
    const res = await updateWallet(id, {
      name: name.trim(),
      is_shared: isShared,
      is_active: isActive,
      shared_option: isShared ? sharedOption : null,
      split_type: isSplit ? splitType : null,
    });
    if (res.error) {
      setSaving(false);
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    // Mark as saved and reload share code if sharing was enabled (after wallet is saved)
    if (isShared) {
      setIsSavedAsShared(true);
      await loadShareCode();
    } else {
      setIsSavedAsShared(false);
    }
    setSaving(false);
    showToast(tWallets("toasts.updated"));
    router.push("/wallets");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title={tWallets("page.edit.title")} description={tWallets("page.edit.subtitle")} />
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/wallets" className="underline">← {tWallets("title")}</Link>
      </div>
    );
  }

  const isSplitWallet = sharedOption === "split" || sharedOption === "track_and_split";

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={tWallets("page.edit.title")} description={tWallets("page.edit.subtitle")} />
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tWallets("page.new.nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isShared"
            checked={isShared}
            onChange={(e) => handleShareToggle(e.target.checked)}
          />
          <label htmlFor="isShared">{tWallets("shared")}</label>
        </div>

        {isShared && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-3">{tWallets("page.edit.sharingType")}</label>
              <div className="space-y-2">
                {[
                  { key: 'track', label: tWallets("page.type.track"), desc: tWallets("page.new.type.trackDesc") },
                  { key: 'split', label: tWallets("page.type.split"), desc: tWallets("page.new.type.splitDesc") },
                  { key: 'track_and_split', label: tWallets("page.type.trackAndSplit"), desc: tWallets("page.new.type.trackAndSplitDesc") },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-start gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-white dark:hover:bg-slate-700/50" style={{ backgroundColor: sharedOption === opt.key ? 'rgba(51, 65, 85, 0.05)' : undefined }}>
                    <input
                      type="radio"
                      name="sharedOption"
                      value={opt.key}
                      checked={sharedOption === opt.key}
                      onChange={(e) => setSharedOption(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{tWallets("page.edit.share.codeLabel")}</label>
              {loadingShareCode ? (
                <p className="text-sm text-slate-500">{tCommon("loading")}</p>
              ) : shareCode ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg tabular-nums text-lg font-semibold">
                    {shareCode}
                  </code>
                  <button
                    type="button"
                    onClick={copyShareCode}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                  >
                    {copied ? tWallets("page.edit.share.copied") : tWallets("page.edit.share.copy")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {shareCodeError ? (
                    <div className="space-y-2">
                      <p className="text-sm text-red-600 dark:text-red-400">{shareCodeError}</p>
                      <button
                        type="button"
                        onClick={loadShareCode}
                        className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        {tWallets("page.edit.share.retry")}
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isSavedAsShared ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          {tWallets("page.edit.share.saveFirst")}
                        </p>
                      ) : (
                        <>
                          <p className="text-sm text-slate-500">{tWallets("page.edit.share.none")}</p>
                          <button
                            type="button"
                            onClick={loadShareCode}
                            disabled={loadingShareCode}
                            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
                          >
                            {loadingShareCode ? tWallets("page.edit.share.generating") : tWallets("page.edit.share.generate")}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyShareLink}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
              >
                {copied ? tWallets("page.edit.share.linkCopied") : tWallets("page.edit.share.copyLink")}
              </button>
              <button
                type="button"
                onClick={sendEmail}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
              >
                {tWallets("page.edit.share.sendEmail")}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {tWallets("page.edit.share.hint")}
            </p>

            {isSplitWallet && (
              <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-600 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-3">{tWallets("page.edit.split.method")}</label>
                  <div className="space-y-2">
                    {[
                      { key: 'equally', label: tWallets("page.edit.split.equallyLabel"), desc: tWallets("page.edit.split.equallyDesc") },
                      { key: 'by_income', label: tWallets("page.edit.split.byIncomeLabel"), desc: tWallets("page.edit.split.byIncomeDesc") },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-start gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-white dark:hover:bg-slate-700/50" style={{ backgroundColor: splitType === opt.key ? 'rgba(51, 65, 85, 0.05)' : undefined }}>
                        <input
                          type="radio"
                          name="splitMethod"
                          value={opt.key}
                          checked={splitType === opt.key}
                          onChange={(e) => setSplitType(e.target.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{opt.label}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {splitType === 'by_income' && members.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-200">{tWallets("page.edit.split.membersIncome")}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                        {tWallets("page.edit.split.membersIncomeHint")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.user_id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{m.display_name || tWallets("page.edit.split.unknownMember")}</p>
                          </div>
                          {m.editingIncome ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={m.income_monthly ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : null;
                                  setMembers(members.map(mm =>
                                    mm.user_id === m.user_id ? { ...mm, income_monthly: val } : mm
                                  ));
                                }}
                                className="w-24 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700"
                                placeholder="0.00"
                              />
                              <button
                                type="button"
                                onClick={() => handleMemberIncomeUpdate(m.user_id, m.income_monthly ?? null)}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                {tCommon("save")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setMembers(members.map(mm =>
                                  mm.user_id === m.user_id ? { ...mm, editingIncome: false } : mm
                                ))}
                                className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                {tCommon("cancel")}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">€{(m.income_monthly ?? 0).toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() => setMembers(members.map(mm =>
                                  mm.user_id === m.user_id ? { ...mm, editingIncome: true } : mm
                                ))}
                                className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                {tCommon("edit")}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="isActive">{tWallets("page.status.active")}</label>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? tWallets("page.edit.saving") : tCommon("save")}
          </button>
          <Link
            href="/wallets"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
