"use client";

import {
  getAccounts,
  getCategories,
  getSubcategories,
  getMovement,
  createMovement,
  getRecentMovementsByCategory,
} from "@/app/actions/movements";
import { CopyIcon } from "@/components/ActionIcons";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
} from "@/lib/recurrence";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type MovementType = "income" | "expense" | "transfer";

export default function NewMovementPage() {
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams.get("copy");
  const typeParam = searchParams.get("type") as MovementType | null;

  // Initialize state based on URL params
  const isValidType = typeParam && ["income", "expense", "transfer"].includes(typeParam);
  const [step, setStep] = useState<"type" | "form">(isValidType ? "form" : "type");
  const [type, setType] = useState<MovementType | null>(isValidType ? typeParam : null);
  const [copyFrom, setCopyFrom] = useState<{
    category_id: string;
    parent_id: string | null;
    amount: number;
    account_from_id: string | null;
    account_to_id: string | null;
    description: string | null;
  } | null>(null);
  const skipNextSubcategoryReset = useRef(false);
  const didCopyFrom = useRef(false);

  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [accountFromId, setAccountFromId] = useState("");
  const [accountToId, setAccountToId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [recentSimilar, setRecentSimilar] = useState<
    { id: string; date: string; description: string | null; amount: number }[]
  >([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [copyingSimilarId, setCopyingSimilarId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("monthly");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [workDayIndex, setWorkDayIndex] = useState("");
  const [saveAsPending, setSaveAsPending] = useState(false);

  useEffect(() => {
    if (!currentWalletId) return;
    getAccounts(currentWalletId).then(setAccounts);
  }, [currentWalletId]);

  useEffect(() => {
    // Handle type param changes (e.g., if user navigates with different type)
    if (typeParam && ["income", "expense", "transfer"].includes(typeParam)) {
      setType(typeParam);
      setStep("form");
    } else if (!typeParam && !copyId) {
      // If type param is removed and no copy, go back to type selection
      setType(null);
      setStep("type");
    }
  }, [typeParam, copyId]);

  useEffect(() => {
    if (!copyId || !currentWalletId) return;
    setLoadingCopy(true);
    setCopyError(null);
    getMovement(copyId).then((m) => {
      setLoadingCopy(false);
      if (!m) {
        setCopyError("Could not load movement to copy.");
        return;
      }
      const parentId = m.parent_id ?? null;
      const catId = parentId || m.category_id;
      const subId = parentId ? m.category_id : "";
      setCopyFrom({
        category_id: m.category_id,
        parent_id: m.parent_id,
        amount: m.amount,
        account_from_id: m.account_from_id,
        account_to_id: m.account_to_id,
        description: m.description,
      });
      setType(m.type as MovementType);
      setStep("form");
      setDate(new Date().toISOString().slice(0, 10));
      setAmount(String(m.amount));
      setAccountFromId(m.account_from_id ?? "");
      setAccountToId(m.account_to_id ?? "");
      setDescription(m.description ?? "");
      setCategoryId(catId);
      setSubcategoryId(subId);
      skipNextSubcategoryReset.current = true;
      didCopyFrom.current = true;
    });
  }, [copyId, currentWalletId]);

  useEffect(() => {
    if (!currentWalletId || !type) return;
    getCategories(currentWalletId, type).then((data) => {
      setCategories(data);
      if (copyFrom) {
        setCategoryId(copyFrom.parent_id || copyFrom.category_id);
        setSubcategoryId(copyFrom.parent_id ? copyFrom.category_id : "");
        setCopyFrom(null);
      } else {
        setCategoryId("");
        setSubcategoryId("");
        setSubcategories([]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- copyFrom intentionally excluded to avoid reset loop after setCopyFrom(null)
  }, [currentWalletId, type]);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryId("");
      return;
    }
    if (skipNextSubcategoryReset.current) {
      skipNextSubcategoryReset.current = false;
      getSubcategories(categoryId).then(setSubcategories);
      return;
    }
    getSubcategories(categoryId).then(setSubcategories);
    setSubcategoryId("");
  }, [categoryId]);

  useEffect(() => {
    if (!type || !currentWalletId || !categoryId) {
      setRecentSimilar([]);
      return;
    }
    setLoadingSimilar(true);
    getRecentMovementsByCategory(
      currentWalletId,
      type,
      categoryId,
      subcategoryId || null
    )
      .then(setRecentSimilar)
      .finally(() => setLoadingSimilar(false));
  }, [type, currentWalletId, categoryId, subcategoryId]);

  function pickType(t: MovementType) {
    setType(t);
    setStep("form");
    setError(null);
  }

  async function handleCopyFromSimilar(id: string) {
    setCopyingSimilarId(id);
    const m = await getMovement(id);
    setCopyingSimilarId(null);
    if (!m) return;
    const parentId = m.parent_id ?? null;
    const catId = parentId || m.category_id;
    const subId = parentId ? m.category_id : "";
    skipNextSubcategoryReset.current = true;
    setAmount(String(m.amount));
    setDescription(m.description ?? "");
    setAccountFromId(m.account_from_id ?? "");
    setAccountToId(m.account_to_id ?? "");
    setCategoryId(catId);
    setSubcategoryId(subId);
    getSubcategories(catId).then(setSubcategories);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWalletId || !type) return;
    setError(null);
    setLoading(true);
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) {
      setError("Amount must be a positive number");
      setLoading(false);
      return;
    }
    const catId = subcategoryId || categoryId;
    if (!catId) {
      setError("Please select a category");
      setLoading(false);
      return;
    }
    if (type === "expense" && subcategories.length > 0 && !subcategoryId) {
      setError("Please select a subcategory");
      setLoading(false);
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      setLoading(false);
      return;
    }
    if (isRecurring && recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) {
        setError("Please enter a valid number of months (1 or more)");
        setLoading(false);
        return;
      }
    }
    if (isRecurring && recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) {
        setError("Please enter a valid number of days (1 or more)");
        setLoading(false);
        return;
      }
    }
    const isWorkDay =
      isRecurring &&
      (recurrenceType === "monthly_nth_work_day" ||
        recurrenceType === "monthly_nth_last_work_day");
    if (isWorkDay) {
      const x = parseInt(workDayIndex, 10);
      if (isNaN(x) || x < 1 || x > 31) {
        setError("Work day index must be 1–31 (e.g. 3 for 3rd or 3rd last)");
        setLoading(false);
        return;
      }
    }
    const res = await createMovement({
      wallet_id: currentWalletId,
      type,
      category_id: catId,
      date,
      amount: num,
      account_from_id: type === "income" ? null : accountFromId || null,
      account_to_id: type === "expense" ? null : accountToId || null,
      description: description.trim(),
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType : undefined,
      interval_months:
        isRecurring && recurrenceType === "interval_months" && intervalMonths.trim()
          ? parseInt(intervalMonths, 10)
          : null,
      interval_days:
        isRecurring && recurrenceType === "interval_days" && intervalDays.trim()
          ? parseInt(intervalDays, 10)
          : null,
      work_day_index:
        isWorkDay && workDayIndex.trim()
          ? parseInt(workDayIndex, 10)
          : null,
      status: saveAsPending ? "pending" : "confirmed",
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast("Movement added.");
    router.push("/dashboard");
    router.refresh();
  }

  if (!currentWalletId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">New movement</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet first.
        </p>
        <Link href="/wallets" className="text-slate-800 dark:text-slate-200 underline">
          Go to Wallets
        </Link>
      </div>
    );
  }

  if (copyId && (loadingCopy || step === "type")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">New movement</h1>
        <div className="w-full max-w-md space-y-4 animate-pulse">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <p className="text-sm text-slate-500">Loading movement to copy…</p>
      </div>
    );
  }

  if (copyId && copyError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">New movement</h1>
        <p className="text-slate-600 dark:text-slate-400">{copyError}</p>
        <div className="flex gap-3">
          <Link
            href="/movements/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            Choose type
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (step === "type") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">New movement</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Choose the type of movement.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => pickType("income")}
            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600"
          >
            <span className="text-2xl mb-2">↓</span>
            <span className="font-medium">Income</span>
          </button>
          <button
            onClick={() => pickType("expense")}
            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600"
          >
            <span className="text-2xl mb-2">↑</span>
            <span className="font-medium">Expense</span>
          </button>
          <button
            onClick={() => pickType("transfer")}
            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-600"
          >
            <span className="text-2xl mb-2">⇄</span>
            <span className="font-medium">Transfer</span>
          </button>
        </div>
        <Link href="/dashboard" className="text-slate-500 hover:underline">← Back to Transactions</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">New {type}</h1>
        <button
          type="button"
          onClick={() => {
            setStep("type");
            setType(null);
            setCopyFrom(null);
            setError(null);
            didCopyFrom.current = false;
          }}
          className="text-sm text-slate-500 hover:underline"
        >
          Change type
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
        <form onSubmit={handleSubmit} className="w-full lg:w-1/2 lg:min-w-0 space-y-4">
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
              onChange={(e) => {
                const v = e.target.value;
                if (didCopyFrom.current) {
                  didCopyFrom.current = false;
                  setDescription("");
                  setAmount("");
                  setAccountFromId("");
                  setAccountToId("");
                  setSubcategoryId("");
                  setError(null);
                }
                setCategoryId(v);
              }}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {subcategories.length > 0 && (
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
                {subcategories.map((c) => (
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
              placeholder="0,00"
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
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
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
                <label className="block text-sm font-medium mb-1">From account *</label>
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
                <label className="block text-sm font-medium mb-1">To account *</label>
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="saveAsPending"
                checked={saveAsPending}
                onChange={(e) => setSaveAsPending(e.target.checked)}
              />
              <label htmlFor="saveAsPending" className="text-sm font-medium">
                Save as pending
              </label>
            </div>
            {saveAsPending && (
              <p className="text-xs text-slate-500 dark:text-slate-400 pl-6 -mt-1">
                Balances will not change until you confirm. Confirm or cancel from Dashboard or Home.
              </p>
            )}
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
              href="/dashboard"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </form>

        {type && categoryId && (
          <div className="w-full lg:w-1/2 lg:min-w-0 rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-xs font-medium">
                Similar {type === "expense" ? "expenses" : type === "income" ? "income" : "transfers"}
                {subcategoryId ? " (subcategory)" : " (category)"}
              </h3>
            </div>
            <div className="p-4 min-h-[140px]">
              {loadingSimilar ? (
                <p className="text-xs text-slate-500">Loading…</p>
              ) : recentSimilar.length === 0 ? (
                <p className="text-xs text-slate-500">No similar transactions</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium min-w-0">Description</th>
                      <th className="pb-2 pr-3 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium w-14"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSimilar.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-slate-100"
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3 min-w-0 max-w-[240px] truncate text-slate-700">
                          {r.description || "—"}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${type === "income"
                              ? "text-green-600"
                              : type === "expense"
                                ? "text-red-600"
                                : ""
                            }`}
                        >
                          {type === "income" ? "+" : type === "expense" ? "−" : ""}
                          {r.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => handleCopyFromSimilar(r.id)}
                            disabled={!!copyingSimilarId}
                            className="p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 transition-colors"
                            title={copyingSimilarId === r.id ? "Copying…" : "Copy"}
                            aria-label={copyingSimilarId === r.id ? "Copying…" : "Copy"}
                          >
                            <CopyIcon aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
