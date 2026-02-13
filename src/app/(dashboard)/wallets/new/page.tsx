"use client";

import { setWalletCookie } from "@/app/actions/wallet-cookie";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewWalletPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [sharedOption, setSharedOption] = useState<"track" | "split" | "track_and_split">("track");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      showToast("Not authenticated", "error");
      return;
    }

    const { data: walletId, error: rpcErr } = await supabase.rpc("create_wallet", {
      p_name: name.trim(),
      p_is_shared: isShared,
      p_shared_option: isShared ? sharedOption : null,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setLoading(false);
      showToast(rpcErr.message, "error");
      return;
    }
    if (!walletId) {
      setError("Create failed");
      setLoading(false);
      showToast("Create failed", "error");
      return;
    }

    await supabase.from("activity_log").insert({
      user_id: user.id,
      wallet_id: walletId,
      action: "wallet_create",
      entity_type: "wallet",
      entity_id: walletId,
      payload: { name: name.trim(), is_shared: isShared, shared_option: isShared ? sharedOption : null },
    });

    // Automatically select the newly created wallet
    await setWalletCookie(walletId);

    setLoading(false);
    showToast("Wallet created.");
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create wallet</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Family, Personal"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isShared"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
          />
          <label htmlFor="isShared">Shared (e.g. with your spouse)</label>
        </div>
        <p className="text-sm text-slate-500">
          You can add members to a shared wallet later from the wallet settings.
        </p>
        {isShared && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Shared wallet type</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setSharedOption("track")}
                className={
                  "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                  (sharedOption === "track"
                    ? "border-slate-800 bg-slate-800/5"
                    : "border-slate-200 hover:border-slate-300")
                }
              >
                <div className="text-sm font-semibold mb-1">Shared: Track</div>
                <div className="text-xs text-slate-600">Register movements and account balances</div>
              </button>

              <button
                type="button"
                onClick={() => setSharedOption("split")}
                className={
                  "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                  (sharedOption === "split"
                    ? "border-slate-800 bg-slate-800/5"
                    : "border-slate-200 hover:border-slate-300")
                }
              >
                <div className="text-sm font-semibold mb-1">Shared: Split</div>
                <div className="text-xs text-slate-600">Register movements and split expenses among members</div>
              </button>

              <button
                type="button"
                onClick={() => setSharedOption("track_and_split")}
                className={
                  "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                  (sharedOption === "track_and_split"
                    ? "border-slate-800 bg-slate-800/5"
                    : "border-slate-200 hover:border-slate-300")
                }
              >
                <div className="text-sm font-semibold mb-1">Shared: Track and Split</div>
                <div className="text-xs text-slate-600">Register movements and split expenses (based on income)</div>
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create"}
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
