"use client";

import { createCategory } from "@/app/actions/categories";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function NewCategoryPage() {
  const tCategories = useTranslations("categories.modal");
  const tTransactions = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tNavigation = useTranslations("navigation");
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
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
      showToast(res.error, "error");
      return;
    }
    showToast(parentId ? tCategories("subAddedToast") : tCategories("addedToast"));
    router.push("/categories");
    router.refresh();
  }

  if (!currentWalletId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{tCategories("titleAdd")}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {tCategories("noWallet")}
        </p>
        <Link href="/wallets" className="underline">{tNavigation("wallets")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{tCategories("titleAddOrSub")}</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tCategories("typeLabel")}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense" | "transfer")}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="income">{tTransactions("income")}</option>
            <option value="expense">{tTransactions("expense")}</option>
            <option value="transfer">{tTransactions("transfer")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{tCategories("parentOptionalLabel")}</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="">{tCategories("topLevelOption")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {tCategories("parentHint")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{tCategories("nameLabel")}</label>
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
            {loading ? tCategories("saving") : tCommon("save")}
          </button>
          <Link
            href="/categories"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
