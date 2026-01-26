"use client";

import { updateWallet, getWalletShareCode } from "@/app/actions/wallets";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditWalletPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [loadingShareCode, setLoadingShareCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCodeError, setShareCodeError] = useState<string | null>(null);
  const [isSavedAsShared, setIsSavedAsShared] = useState(false);

  async function loadShareCode() {
    // Check if wallet needs to be saved as shared first
    if (isShared && !isSavedAsShared) {
      setShareCodeError("Please save the wallet with 'Shared' enabled first");
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
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Query wallet through membership to ensure user has access
      const { data, error: e } = await supabase
        .from("wallet_members")
        .select("wallet_id, wallets(name, is_shared, is_active)")
        .eq("wallet_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      setLoading(false);
      if (e) {
        setError(e.message);
        return;
      }
      if (!data || !data.wallets) {
        setError("Wallet not found or you don't have access");
        return;
      }
      type WalletRow = { name: string; is_shared: boolean; is_active: boolean };
      const raw = data.wallets as WalletRow | WalletRow[] | null;
      const wallet = Array.isArray(raw) ? raw[0] : raw;
      if (!wallet) {
        setError("Wallet not found or you don't have access");
        return;
      }
      setName(wallet.name);
      setIsShared(wallet.is_shared);
      setIsActive(wallet.is_active);
      setIsSavedAsShared(wallet.is_shared); // Track if wallet is saved as shared in DB
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
      setIsSavedAsShared(false);
    } else {
      // When enabling shared, mark as not saved yet
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await updateWallet(id, {
      name: name.trim(),
      is_shared: isShared,
      is_active: isActive,
    });
    if (res.error) {
      setSaving(false);
      setError(res.error);
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
    router.push("/wallets");
    router.refresh();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/wallets" className="underline">← Wallets</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit wallet</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
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
          <label htmlFor="isShared">Shared</label>
        </div>
        
        {isShared && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Share Code</label>
              {loadingShareCode ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : shareCode ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-lg font-semibold">
                    {shareCode}
                  </code>
                  <button
                    type="button"
                    onClick={copyShareCode}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                  >
                    {copied ? "Copied!" : "Copy"}
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
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isSavedAsShared ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          Please save the wallet with &quot;Shared&quot; enabled first, then generate the share code.
                        </p>
                      ) : (
                        <>
                          <p className="text-sm text-slate-500">No share code available</p>
                          <button
                            type="button"
                            onClick={loadShareCode}
                            disabled={loadingShareCode}
                            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
                          >
                            {loadingShareCode ? "Generating..." : "Generate Share Code"}
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
                {copied ? "Link Copied!" : "Copy Share Link"}
              </button>
              <button
                type="button"
                onClick={sendEmail}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
              >
                Send Email
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Share this code or link with others. They can use it to join this wallet after signing up.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="isActive">Active</label>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href="/wallets"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
