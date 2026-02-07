"use client";

import { createAccount } from "@/app/actions/accounts";
import { AccountTypeSelect } from "@/components/AccountTypeSelect";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import type { AccountType } from "@/lib/account-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAccountPage() {
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank_account");
  const [initialBalance, setInitialBalance] = useState("0");
  const [plafond, setPlafond] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWalletId) return;
    setError(null);
    setLoading(true);
    const num = parseFloat(initialBalance.replace(",", ".")) || 0;
    const plafondNum =
      accountType === "credit_card" && plafond.trim()
        ? parseFloat(plafond.replace(",", ".")) || null
        : null;
    const res = await createAccount({
      wallet_id: currentWalletId,
      name: name.trim(),
      account_type: accountType,
      initial_balance: num,
      plafond: plafondNum,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast("Account added.");
    router.push("/accounts");
    router.refresh();
  }

  if (!currentWalletId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Add account</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet first.
        </p>
        <Link href="/wallets" className="underline">Wallets</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add account</h1>
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
        <AccountTypeSelect value={accountType} onChange={setAccountType} />
        {accountType === "credit_card" && (
          <div>
            <label className="block text-sm font-medium mb-1">Plafond / Credit limit (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={plafond}
              onChange={(e) => setPlafond(e.target.value)}
              placeholder="e.g. 2000"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            />
            <p className="text-xs text-slate-500 mt-1">
              The maximum amount allowed on this credit card.
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Initial balance (€) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <Link
            href="/accounts"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
