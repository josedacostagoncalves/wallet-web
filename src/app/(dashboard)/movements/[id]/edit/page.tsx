"use client";

import {
  getMovement,
  getAccounts,
  getCategories,
  getSubcategories,
  updateMovement,
  deleteMovement,
  confirmMovement,
} from "@/app/actions/movements";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
} from "@/lib/recurrence";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MovementType = "income" | "expense" | "transfer";

export default function EditMovementPage() {
  const params = useParams();
  const id = String(params.id);
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("monthly");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [workDayIndex, setWorkDayIndex] = useState("");

  const [status, setStatus] = useState<"confirmed" | "pending" | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    getMovement(id).then((m) => {
      setLoading(false);
      if (!m) return;
      setStatus(m.status);
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

  function validateForm(): string | null {
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) return "Amount must be a positive number";
    const catId = subcategoryId || categoryId;
    if (!catId) return "Please select a category";
    if (type === "expense" && subcategories.length > 0 && !subcategoryId)
      return "Please select a subcategory";
    if (!description.trim()) return "Description is required";
    if (!status) return null;
    if (status === "confirmed" && isRecurring && recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) return "Please enter a valid number of months (1 or more)";
    }
    if (status === "confirmed" && isRecurring && recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) return "Please enter a valid number of days (1 or more)";
    }
    if (status === "confirmed") {
      const isWorkDay =
        isRecurring &&
        (recurrenceType === "monthly_nth_work_day" ||
          recurrenceType === "monthly_nth_last_work_day");
      if (isWorkDay) {
        const x = parseInt(workDayIndex, 10);
        if (isNaN(x) || x < 1 || x > 31)
          return "Work day index must be 1–31 (e.g. 3 for 3rd or 3rd last)";
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWalletId || !type) return;
    setError(null);
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    const num = parseFloat(amount.replace(",", "."));
    const catId = subcategoryId || categoryId;
    const isWorkDay =
      status === "confirmed" &&
      isRecurring &&
      (recurrenceType === "monthly_nth_work_day" ||
        recurrenceType === "monthly_nth_last_work_day");
    const res = await updateMovement(id, {
      type,
      category_id: catId,
      date,
      amount: num,
      account_from_id: type === "income" ? null : accountFromId || null,
      account_to_id: type === "expense" ? null : accountToId || null,
      description: description.trim(),
      is_recurring: status === "confirmed" ? isRecurring : false,
      recurrence_type: status === "confirmed" && isRecurring ? recurrenceType : undefined,
      interval_months:
        status === "confirmed" &&
        isRecurring &&
        recurrenceType === "interval_months" &&
        intervalMonths.trim()
          ? parseInt(intervalMonths, 10)
          : null,
      interval_days:
        status === "confirmed" &&
        isRecurring &&
        recurrenceType === "interval_days" &&
        intervalDays.trim()
          ? parseInt(intervalDays, 10)
          : null,
      work_day_index:
        isWorkDay && workDayIndex.trim() ? parseInt(workDayIndex, 10) : null,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast("Movement updated.");
    router.push("/dashboard");
    router.refresh();
  }

  async function handleConfirmClick() {
    if (!currentWalletId || !type) return;
    setError(null);
    const err = validateForm();
    if (err) {
      setError(err);
      setConfirmDialogOpen(false);
      showToast(err, "error");
      return;
    }
    setConfirming(true);
    const num = parseFloat(amount.replace(",", "."));
    const catId = subcategoryId || categoryId;
    const res = await updateMovement(id, {
      type,
      category_id: catId,
      date,
      amount: num,
      account_from_id: type === "income" ? null : accountFromId || null,
      account_to_id: type === "expense" ? null : accountToId || null,
      description: description.trim(),
      is_recurring: false,
    });
    if (res.error) {
      setError(res.error);
      setConfirming(false);
      setConfirmDialogOpen(false);
      showToast(res.error, "error");
      return;
    }
    const confirmRes = await confirmMovement(id);
    setConfirming(false);
    if (confirmRes.error) {
      setError(confirmRes.error);
      setConfirmDialogOpen(false);
      showToast(confirmRes.error, "error");
      return;
    }
    setConfirmDialogOpen(false);
    showToast("Movement confirmed.");
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
      showToast(res.error, "error");
      return;
    }
    showToast("Movement deleted.");
    router.push("/dashboard");
    router.refresh();
  }

  async function handleCancelPending() {
    setDeleting(true);
    setError(null);
    const res = await deleteMovement(id);
    setDeleting(false);
    if (res.error) {
      setError(res.error);
      setCancelDialogOpen(false);
      showToast(res.error, "error");
    } else {
      setCancelDialogOpen(false);
      showToast("Pending movement cancelled.");
      router.push("/dashboard");
      router.refresh();
    }
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
      <h1 className="text-2xl font-semibold">
        {status === "pending" ? "Edit pending movement" : "Edit movement"}
      </h1>

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
        {status !== "pending" && (
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <label htmlFor="isRecurring" className="text-sm font-medium">
              Make it recurring
            </label>
          </div>
          {isRecurring && (
            <div className="space-y-3 pl-6">
              <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <select
                  value={recurrenceType}
                  onChange={(e) => {
                    const v = e.target.value as RecurrenceType;
                    if (v) setRecurrenceType(v);
                  }}
                  className="w-full max-w-xs px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                >
                  {RECURRENCE_OPTIONS.map((o, i) =>
                    isRecurrenceOptionSeparator(o) ? (
                      <option key={`sep-${i}`} disabled>
                        {o.label}
                      </option>
                    ) : (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    )
                  )}
                </select>
              </div>
              {recurrenceType === "interval_days" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Every how many days?</label>
                  <input
                    type="number"
                    min={1}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    placeholder="e.g. 14"
                    className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>
              )}
              {recurrenceType === "interval_months" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Every how many months?</label>
                  <input
                    type="number"
                    min={1}
                    value={intervalMonths}
                    onChange={(e) => setIntervalMonths(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>
              )}
              {(recurrenceType === "monthly_nth_work_day" ||
                recurrenceType === "monthly_nth_last_work_day") && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {recurrenceType === "monthly_nth_last_work_day"
                      ? "Nth last work day (e.g. 3 = 3rd last)"
                      : "Nth work day (e.g. 3 = 3rd work day of month)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={workDayIndex}
                    onChange={(e) => setWorkDayIndex(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Future occurrences will be created on the selected date and shown as Pending until you confirm or cancel them.
              </p>
            </div>
          )}
        </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => setConfirmDialogOpen(true)}
                disabled={confirming}
                className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
              >
                {confirming ? "Confirming…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setCancelDialogOpen(true)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {deleting ? "Cancelling…" : "Cancel"}
              </button>
              <ConfirmDialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
                onConfirm={handleConfirmClick}
                title="Confirm movement"
                message="Confirm this pending movement? It will be applied and balances updated."
                confirmLabel="Confirm"
                cancelLabel="Go back"
                variant="confirm"
                loading={confirming}
              />
              <ConfirmDialog
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onConfirm={handleCancelPending}
                title="Cancel pending movement"
                message="Cancel this pending movement? It will be deleted."
                confirmLabel="Yes, cancel"
                cancelLabel="Keep"
                variant="cancel"
                loading={deleting}
              />
            </>
          )}
          {status !== "pending" && (
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
            >
              Cancel
            </Link>
          )}
          {status !== "pending" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto px-4 py-2 rounded-lg border border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
        </div>
      </form>
    </div>
  );
}
