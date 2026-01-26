"use client";

import { createCategory } from "@/app/actions/categories";
import { useWallet } from "@/contexts/WalletContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NewCategoryPage() {
  const { currentWalletId } = useWallet();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [parentId, setParentId] = useState("");
  const [parents, setParents] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentWalletId) return;
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name")
      .eq("wallet_id", currentWalletId)
      .eq("type", type)
      .is("parent_id", null)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setParents((data ?? []).map((c) => ({ id: c.id, name: c.name })));
        setParentId("");
      });
  }, [currentWalletId, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWalletId) return;
    setError(null);
    setLoading(true);
    const res = await createCategory({
      wallet_id: currentWalletId,
      name: name.trim(),
      type,
      parent_id: parentId || null,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/categories");
    router.refresh();
  }

  if (!currentWalletId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Add category</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet first.
        </p>
        <Link href="/wallets" className="underline">Wallets</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add category or subcategory</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense" | "transfer")}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Parent (optional)</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="">— Top-level category —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Leave empty for a top-level category (e.g. Salary, Groceries). Pick one for a subcategory (e.g. Netflix under Streaming).
          </p>
        </div>
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
            href="/categories"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
