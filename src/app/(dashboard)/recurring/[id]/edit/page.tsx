"use client";

import { getCategory } from "@/app/actions/categories";
import {
  getAccounts,
  getCategories,
  getSubcategories,
} from "@/app/actions/movements";
import {
  getRecurringRule,
  updateRecurringRule,
  type RecurringRuleRow,
} from "@/app/actions/recurring";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
} from "@/lib/recurrence";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MovementType = "income" | "expense" | "transfer";

export default function EditRecurringPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();

  const [rule, setRule] = useState<RecurringRuleRow | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [accountFromId, setAccountFromId] = useState("");
  const [accountToId, setAccountToId] = useState("");
  const [description, setDescription] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("monthly");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [workDayIndex, setWorkDayIndex] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [currentCategoryName, setCurrentCategoryName] = useState("");
  const [currentSubcategoryName, setCurrentSubcategoryName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecurringRule(id).then(async (r) => {
      setLoading(false);
      if (!r) return;
      setRule(r);
      setAmount(String(r.amount));
      setAccountFromId(r.account_from_id ?? "");
      setAccountToId(r.account_to_id ?? "");
      setDescription(r.description ?? "");
      setRecurrenceType((r.recurrence_type as RecurrenceType) || "monthly");
      setIntervalMonths(
        r.recurrence_type === "interval_months" && r.interval_months != null
          ? String(r.interval_months)
          : ""
      );
      setIntervalDays(
        r.recurrence_type === "interval_days" && r.interval_days != null
          ? String(r.interval_days)
          : ""
      );
      setWorkDayIndex(
        (r.recurrence_type === "monthly_nth_work_day" ||
          r.recurrence_type === "monthly_nth_last_work_day") &&
          r.work_day_index != null
          ? String(r.work_day_index)
          : ""
      );
      setIsActive(r.is_active);

      const cat = await getCategory(r.category_id);
      if (cat) {
        if (cat.parent_id) {
          setCategoryId(cat.parent_id);
          setSubcategoryId(cat.id);
          setCurrentSubcategoryName(cat.name);
        } else {
          setCategoryId(cat.id);
          setSubcategoryId("");
          setCurrentCategoryName(cat.name);
        }
      }
    });
  }, [id]);

  useEffect(() => {
    if (!rule?.wallet_id) return;
    getAccounts(rule.wallet_id).then(setAccounts);
  }, [rule?.wallet_id]);

  useEffect(() => {
    if (!rule?.wallet_id || !rule?.type) return;
    getCategories(rule.wallet_id, rule.type).then(setCategories);
  }, [rule?.wallet_id, rule?.type]);

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
    if (!rule) return;
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
    if (
      rule.type === "expense" &&
      subcategories.length > 0 &&
      !subcategoryId
    ) {
      setError("Please select a subcategory");
      setSaving(false);
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      setSaving(false);
      return;
    }
    if (recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) {
        setError("Please enter a valid number of months (1 or more)");
        setSaving(false);
        return;
      }
    }
    if (recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) {
        setError("Please enter a valid number of days (1 or more)");
        setSaving(false);
        return;
      }
    }
    const isWorkDay =
      recurrenceType === "monthly_nth_work_day" ||
      recurrenceType === "monthly_nth_last_work_day";
    if (isWorkDay) {
      const x = parseInt(workDayIndex, 10);
      if (isNaN(x) || x < 1 || x > 31) {
        setError("Work day index must be 1–31 (e.g. 3 for 3rd or 3rd last)");
        setSaving(false);
        return;
      }
    }

    const res = await updateRecurringRule(id, {
      type: rule.type,
      category_id: catId,
      amount: num,
      account_from_id: rule.type === "income" ? null : accountFromId || null,
      account_to_id: rule.type === "expense" ? null : accountToId || null,
      description: description.trim(),
      recurrence_type: recurrenceType,
      interval_months:
        recurrenceType === "interval_months" && intervalMonths.trim()
          ? parseInt(intervalMonths, 10)
          : null,
      interval_days:
        recurrenceType === "interval_days" && intervalDays.trim()
          ? parseInt(intervalDays, 10)
          : null,
      work_day_index:
        isWorkDay && workDayIndex.trim()
          ? parseInt(workDayIndex, 10)
          : null,
      is_active: isActive,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!rule) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">Recurring rule not found.</p>
        <Link href="/dashboard" className="underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  const type = rule.type as MovementType;
  const categoryOpts = categories;
  const needsExtraCategory =
    categoryId && !categoryOpts.some((c) => c.id === categoryId);
  const subOpts = subcategories;
  const needsExtraSub =
    subcategoryId && !subOpts.some((s) => s.id === subcategoryId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit recurring</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Changes apply only to future runs. Existing pending or confirmed
        movements are not modified.
      </p>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <p className="py-2 capitalize text-slate-600 dark:text-slate-400">
            {type}
          </p>
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
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId("");
            }}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="">Select…</option>
            {needsExtraCategory && (
              <option value={categoryId}>
                {currentCategoryName || "(current)"}
              </option>
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
              <option value="">
                {type === "expense" ? "Select…" : "None"}
              </option>
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
            <label className="block text-sm font-medium mb-1">
              Account (receive) *
            </label>
            <select
              value={accountToId}
              onChange={(e) => setAccountToId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === "expense" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Account (pay from) *
            </label>
            <select
              value={accountFromId}
              onChange={(e) => setAccountFromId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === "transfer" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                From account *
              </label>
              <select
                value={accountFromId}
                onChange={(e) => setAccountFromId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                To account *
              </label>
              <select
                value={accountToId}
                onChange={(e) => setAccountToId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="text-sm font-medium">Repeat</div>
          <div className="space-y-3 pl-0">
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
                <label className="block text-sm font-medium mb-1">
                  Every how many days?
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Every how many months?
                </label>
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
          </div>
        </div>
        <div className="flex flex-col gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Active (recurring runs automatically)
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
            Uncheck to disable recurring. No new movements will be created until
            you turn it back on.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex flex-wrap gap-3 items-center">
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
        </div>
      </form>
    </div>
  );
}
