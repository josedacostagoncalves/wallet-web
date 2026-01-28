"use client";

import { updateAccount } from "@/app/actions/accounts";
import { AccountTypeSelect } from "@/components/AccountTypeSelect";
import type { AccountType } from "@/lib/account-types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditAccountPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank_account");
  const [initialBalance, setInitialBalance] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("accounts")
      .select("name, account_type, initial_balance, is_active")
      .eq("id", id)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false);
        if (e || !data) {
          setError(e?.message ?? "Not found");
          return;
        }
        setName(data.name);
        setAccountType(
          (data.account_type as AccountType) ?? "bank_account"
        );
        setInitialBalance(String(data.initial_balance));
        setIsActive(data.is_active);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const num = parseFloat(initialBalance.replace(",", "."));
    if (isNaN(num)) {
      setError("Invalid initial balance");
      setSaving(false);
      return;
    }
    const res = await updateAccount(id, {
      name: name.trim(),
      account_type: accountType,
      initial_balance: num,
      is_active: isActive,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/accounts");
    router.refresh();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/accounts" className="underline">← Accounts</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit account</h1>
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
        <div>
          <label className="block text-sm font-medium mb-1">Initial balance (€) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
          <p className="text-xs text-slate-500 mt-1">
            Changing this will adjust the current balance by the same difference.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="isActive">Active (shown in movement form)</label>
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
