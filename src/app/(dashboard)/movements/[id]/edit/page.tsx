"use client";

import {
  getMovement,
  getAccounts,
  getCategories,
  getSubcategories,
  updateMovement,
  deleteMovement,
} from "@/app/actions/movements";
import { useWallet } from "@/contexts/WalletContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MovementType = "income" | "expense" | "transfer";

export default function EditMovementPage() {
  const params = useParams();
  const id = String(params.id);
  const { currentWalletId } = useWallet();
  const router = useRouter();

  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [type, setType] = useState<MovementType | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [accountFromId, setAccountFromId] = useState("");
  const [accountToId, setAccountToId] = useState("");
  const [description, setDescription] = useState("");
  const [currentCategoryName, setCurrentCategoryName] = useState("");
  const [currentSubcategoryName, setCurrentSubcategoryName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMovement(id).then((m) => {
      setLoading(false);
      if (!m) return;
      setType(m.type as MovementType);
      setDate(m.date);
      setAmount(String(m.amount));
      setAccountFromId(m.account_from_id ?? "");
      setAccountToId(m.account_to_id ?? "");
      setDescription(m.description ?? "");
      if (m.parent_id) {
        setCategoryId(m.parent_id);
        setSubcategoryId(m.category_id);
        setCurrentSubcategoryName(m.category_name ?? "");
      } else {
        setCategoryId(m.category_id);
        setSubcategoryId("");
        setCurrentCategoryName(m.category_name ?? "");
      }
    });
  }, [id]);

  useEffect(() => {
    if (!currentWalletId) return;
    getAccounts(currentWalletId).then(setAccounts);
  }, [currentWalletId]);

  useEffect(() => {
    if (!currentWalletId || !type) return;
    getCategories(currentWalletId, type).then(setCategories);
  }, [currentWalletId, type]);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryId("");
      return;
    }
    getSubcategories(categoryId).then(setSubcategories);
  }, [categoryId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWalletId || !type) return;
    setError(null);
    setSaving(true);
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) {
      setError("Amount must be a positive number");
      setSaving(false);
      return;
    }
    const catId = subcategoryId || categoryId;
    if (!catId) {
      setError("Please select a category");
      setSaving(false);
      return;
    }
    if (type === "expense" && subcategories.length > 0 && !subcategoryId) {
      setError("Please select a subcategory");
      setSaving(false);
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      setSaving(false);
      return;
    }
    const res = await updateMovement(id, {
      type,
      category_id: catId,
      date,
      amount: num,
      account_from_id: type === "income" ? null : accountFromId || null,
      account_to_id: type === "expense" ? null : accountToId || null,
      description: description.trim(),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this movement? Balances will be updated.")) return;
    setError(null);
    setDeleting(true);
    const res = await deleteMovement(id);
    setDeleting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!type) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">Movement not found.</p>
        <Link href="/dashboard" className="underline">← Dashboard</Link>
      </div>
    );
  }

  const categoryOpts = categories;
  const needsExtraCategory =
    categoryId && !categoryOpts.some((c) => c.id === categoryId);
  const subOpts = subcategories;
  const needsExtraSub =
    subcategoryId && !subOpts.some((s) => s.id === subcategoryId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit movement</h1>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <p className="py-2 capitalize text-slate-600 dark:text-slate-400">{type}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="">Select…</option>
            {needsExtraCategory && (
              <option value={categoryId}>{currentCategoryName || "(current)"}</option>
            )}
            {categoryOpts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {subOpts.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Subcategory{type === "expense" ? " *" : ""}
            </label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              required={type === "expense"}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">{type === "expense" ? "Select…" : "None"}</option>
              {needsExtraSub && (
                <option value={subcategoryId}>
                  {currentSubcategoryName || "(current)"}
                </option>
              )}
              {subOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Amount (€) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        {type === "income" && (
          <div>
            <label className="block text-sm font-medium mb-1">Account (receive) *</label>
            <select
              value={accountToId}
              onChange={(e) => setAccountToId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        {type === "expense" && (
          <div>
            <label className="block text-sm font-medium mb-1">Account (pay from) *</label>
            <select
              value={accountFromId}
              onChange={(e) => setAccountFromId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        {type === "transfer" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">From account *</label>
              <select
                value={accountFromId}
                onChange={(e) => setAccountFromId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To account *</label>
              <select
                value={accountToId}
                onChange={(e) => setAccountToId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </form>
    </div>
  );
}
