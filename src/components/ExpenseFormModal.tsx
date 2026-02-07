"use client";

import {
  getAccounts,
  getCategories,
  getSubcategories,
  getMovement,
  getRecentMovementsByType,
  getRecentMovementsByCategory,
  createMovement,
  updateMovement,
  confirmMovement,
  deleteMovement,
} from "@/app/actions/movements";
import { getCategory } from "@/app/actions/categories";
import { BalanceHint } from "@/components/BalanceHint";
import { getRecurringRule } from "@/app/actions/recurring";
import { CopyIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
} from "@/lib/recurrence";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MovementModalMode } from "@/contexts/MovementModalsContext";

type Props = {
  open: boolean;
  onClose: () => void;
  mode?: MovementModalMode;
  movementId?: string;
  copyFromMovementId?: string;
  copyFromRecurringId?: string;
};

const inputClass =
  "w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800";

export function ExpenseFormModal({
  open,
  onClose,
  mode = "new",
  movementId,
  copyFromMovementId,
  copyFromRecurringId,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { currentWalletId } = useWallet();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [accounts, setAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [accountFromId, setAccountFromId] = useState("");
  const [saveAsPending, setSaveAsPending] = useState(false);
  const [holdBalance, setHoldBalance] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("monthly");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [workDayIndex, setWorkDayIndex] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [status, setStatus] = useState<"confirmed" | "pending">("confirmed");
  const [dialog, setDialog] = useState<"confirm" | "cancel" | "delete" | null>(null);
  const [recentSimilar, setRecentSimilar] = useState<
    { id: string; date: string; description: string | null; amount: number }[]
  >([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [copyingSimilarId, setCopyingSimilarId] = useState<string | null>(null);
  const skipNextSubcategoryReset = useRef(false);
  const editOriginal = useRef<{ amount: number; accountFromId: string; holdBalance: boolean } | null>(null);
  const isEdit = mode === "edit" && !!movementId;
  const isCopy = mode === "copy";

  useEffect(() => {
    if (!open || !currentWalletId) return;
    getAccounts(currentWalletId).then(setAccounts);
    getCategories(currentWalletId, "expense").then(setCategories);
  }, [open, currentWalletId]);

  useEffect(() => {
    if (!open || !currentWalletId) return;
    if (isEdit && movementId) {
      setLoadingData(true);
      getMovement(movementId).then((m) => {
        setLoadingData(false);
        if (!m) return;
        setStatus(m.status);
        editOriginal.current = {
          amount: m.amount,
          accountFromId: m.account_from_id ?? "",
          holdBalance: m.hold_balance,
        };
        const parentId = m.parent_id ?? null;
        const catId = parentId || m.category_id;
        const subId = parentId ? m.category_id : "";
        setDate(m.date);
        setAmount(String(m.amount));
        setDescription(m.description ?? "");
        setAccountFromId(m.account_from_id ?? "");
        setCategoryId(catId);
        setSubcategoryId(subId);
        skipNextSubcategoryReset.current = true;
        getSubcategories(catId).then(setSubcategories);
      });
      return;
    }
    if (isCopy && copyFromMovementId) {
      setLoadingData(true);
      getMovement(copyFromMovementId).then((m) => {
        setLoadingData(false);
        if (!m) return;
        const parentId = m.parent_id ?? null;
        const catId = parentId || m.category_id;
        const subId = parentId ? m.category_id : "";
        setDate(new Date().toISOString().slice(0, 10));
        setAmount(String(m.amount));
        setDescription(m.description ?? "");
        setAccountFromId(m.account_from_id ?? "");
        setCategoryId(catId);
        setSubcategoryId(subId);
        setSaveAsPending(m.status === "pending");
        skipNextSubcategoryReset.current = true;
        getSubcategories(catId).then(setSubcategories);
      });
      return;
    }
    if (isCopy && copyFromRecurringId) {
      setLoadingData(true);
      getRecurringRule(copyFromRecurringId).then(async (r) => {
        if (!r) {
          setLoadingData(false);
          return;
        }
        const cat = await getCategory(r.category_id);
        let catId = r.category_id;
        let subId = "";
        if (cat) {
          if (cat.parent_id) {
            catId = cat.parent_id;
            subId = r.category_id;
          }
        }
        setLoadingData(false);
        setDate(new Date().toISOString().slice(0, 10));
        setAmount(String(r.amount));
        setDescription(r.description ?? "");
        setAccountFromId(r.account_from_id ?? "");
        setCategoryId(catId);
        setSubcategoryId(subId);
        setIsRecurring(true);
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
        skipNextSubcategoryReset.current = true;
        getSubcategories(catId).then(setSubcategories);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [open, currentWalletId, isEdit, isCopy, movementId, copyFromMovementId, copyFromRecurringId]);

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
    if (!open || !currentWalletId) {
      if (!currentWalletId) setRecentSimilar([]);
      return;
    }
    setLoadingSimilar(true);
    if (!categoryId) {
      getRecentMovementsByType(currentWalletId, "expense", 20)
        .then(setRecentSimilar)
        .finally(() => setLoadingSimilar(false));
    } else {
      getRecentMovementsByCategory(
        currentWalletId,
        "expense",
        categoryId,
        subcategoryId || null,
        20
      )
        .then(setRecentSimilar)
        .finally(() => setLoadingSimilar(false));
    }
  }, [open, currentWalletId, categoryId, subcategoryId]);

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
    setCategoryId(catId);
    setSubcategoryId(subId);
    getSubcategories(catId).then(setSubcategories);
    setError(null);
  }

  const resetForm = useCallback(() => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setCategoryId("");
    setSubcategoryId("");
    setAmount("");
    setAccountFromId("");
    setSaveAsPending(false);
    setHoldBalance(true);
    setIsRecurring(false);
    setRecurrenceType("monthly");
    setIntervalMonths("");
    setIntervalDays("");
    setWorkDayIndex("");
    setError(null);
    editOriginal.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "new" && !movementId && !copyFromMovementId && !copyFromRecurringId) {
      resetForm();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading && !loadingData) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening new
  }, [open, onClose, loading, loadingData, resetForm, mode, movementId, copyFromMovementId, copyFromRecurringId]);

  function validate(): string | null {
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) return "Amount must be a positive number";
    const catId = subcategoryId || categoryId;
    if (!catId) return "Please select a category";
    if (subcategories.length > 0 && !subcategoryId) return "Please select a subcategory";
    if (!description.trim()) return "Description is required";
    if (!accountFromId) return "Account (pay from) is required";
    if (isRecurring && recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) return "Please enter a valid number of months (1 or more)";
    }
    if (isRecurring && recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) return "Please enter a valid number of days (1 or more)";
    }
    const isWorkDay =
      isRecurring &&
      (recurrenceType === "monthly_nth_work_day" ||
        recurrenceType === "monthly_nth_last_work_day");
    if (isWorkDay) {
      const x = parseInt(workDayIndex, 10);
      if (isNaN(x) || x < 1 || x > 31) return "Work day index must be 1–31";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWalletId) return;
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    const num = parseFloat(amount.replace(",", "."));
    const catId = subcategoryId || categoryId;
    const isWorkDay =
      isRecurring &&
      (recurrenceType === "monthly_nth_work_day" ||
        recurrenceType === "monthly_nth_last_work_day");

    if (isEdit && movementId) {
      const useRecurring = status === "confirmed" && isRecurring;
      const res = await updateMovement(movementId, {
        type: "expense",
        category_id: catId,
        date,
        amount: num,
        account_from_id: accountFromId,
        account_to_id: null,
        description: description.trim(),
        is_recurring: useRecurring,
        recurrence_type: useRecurring ? recurrenceType : undefined,
        interval_months:
          useRecurring && recurrenceType === "interval_months" && intervalMonths.trim()
            ? parseInt(intervalMonths, 10)
            : null,
        interval_days:
          useRecurring && recurrenceType === "interval_days" && intervalDays.trim()
            ? parseInt(intervalDays, 10)
            : null,
        work_day_index: isWorkDay && workDayIndex.trim() ? parseInt(workDayIndex, 10) : null,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      showToast("Movement updated.");
      onClose();
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const res = await createMovement({
      wallet_id: currentWalletId,
      type: "expense",
      category_id: catId,
      date,
      amount: num,
      account_from_id: accountFromId,
      account_to_id: null,
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
        isWorkDay && workDayIndex.trim() ? parseInt(workDayIndex, 10) : null,
      status: saveAsPending ? "pending" : "confirmed",
      hold_balance: saveAsPending ? holdBalance : false,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast("Movement added.");
    onClose();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleConfirm() {
    if (!currentWalletId || !movementId) return;
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      setDialog(null);
      showToast(err, "error");
      return;
    }
    setLoading(true);
    const num = parseFloat(amount.replace(",", "."));
    const catId = subcategoryId || categoryId;
    const up = await updateMovement(movementId, {
      type: "expense",
      category_id: catId,
      date,
      amount: num,
      account_from_id: accountFromId,
      account_to_id: null,
      description: description.trim(),
      is_recurring: false,
    });
    if (up.error) {
      setError(up.error);
      setLoading(false);
      setDialog(null);
      showToast(up.error, "error");
      return;
    }
    const cr = await confirmMovement(movementId);
    setLoading(false);
    setDialog(null);
    if (cr.error) {
      setError(cr.error);
      showToast(cr.error, "error");
      return;
    }
    showToast("Movement confirmed.");
    onClose();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleDelete() {
    if (!movementId) return;
    setLoading(true);
    const res = await deleteMovement(movementId);
    setLoading(false);
    setDialog(null);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    showToast(status === "pending" ? "Pending movement cancelled." : "Movement deleted.");
    onClose();
    router.push("/dashboard");
    router.refresh();
  }

  if (!open) return null;

  if (!currentWalletId) {
    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 bg-black/40"
          aria-hidden
          onClick={onClose}
        />
        <div className="relative rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl p-6 max-w-sm">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Select or create a wallet first.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={() => !loading && !loadingData && onClose()}
      />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 pt-6 pb-2 border-b border-slate-200 dark:border-slate-700">
          <h2 id="expense-modal-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {isEdit
              ? status === "pending"
                ? "Edit pending expense"
                : "Edit expense"
              : "New expense"}
          </h2>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col min-h-0 flex-1 overflow-y-auto"
        >
          {loadingData && (
            <div className="px-6 py-4 text-sm text-slate-500">Loading…</div>
          )}
          <div className="p-6 flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch">
            <div className="w-full sm:min-w-0 sm:w-1/2 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  required
                  placeholder="e.g. Groceries"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className={inputClass}
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
                  <label className="block text-sm font-medium mb-1">Subcategory *</label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Select…</option>
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
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account (pay from) *</label>
                <select
                  value={accountFromId}
                  onChange={(e) => setAccountFromId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {(() => {
                  const num = parseFloat(amount.replace(",", "."));
                  if (isNaN(num) || num <= 0) return null;
                  const orig = editOriginal.current;
                  const accountChanged =
                    isEdit && orig && !orig.holdBalance && orig.accountFromId && orig.accountFromId !== accountFromId;
                  return (
                    <>
                      {/* Original account reversal when account changed */}
                      {accountChanged && (() => {
                        const oldAcc = accounts.find((a) => a.id === orig.accountFromId);
                        if (!oldAcc) return null;
                        return (
                          <BalanceHint
                            label={oldAcc.name}
                            currentBalance={oldAcc.current_balance}
                            afterBalance={oldAcc.current_balance + orig.amount}
                          />
                        );
                      })()}
                      {/* Selected account */}
                      {(() => {
                        const acc = accounts.find((a) => a.id === accountFromId);
                        if (!acc) return null;
                        const sameAccount = isEdit && orig && !orig.holdBalance && orig.accountFromId === accountFromId;
                        const afterBalance = sameAccount
                          ? acc.current_balance - (num - orig.amount)
                          : acc.current_balance - num;
                        return (
                          <BalanceHint
                            label={accountChanged ? acc.name : undefined}
                            currentBalance={acc.current_balance}
                            afterBalance={afterBalance}
                          />
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
              {(!isEdit || status !== "pending") && (
              <div className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                {!isEdit && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAsPending}
                        onChange={(e) => {
                          setSaveAsPending(e.target.checked);
                          if (!e.target.checked) setHoldBalance(true);
                        }}
                      />
                      <span className="text-sm font-medium">Save as pending</span>
                    </label>
                    {saveAsPending && (
                      <label className="flex items-center gap-2 cursor-pointer pl-6 -mt-1">
                        <input
                          type="checkbox"
                          checked={holdBalance}
                          onChange={(e) => setHoldBalance(e.target.checked)}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Do not update balances until confirm
                        </span>
                      </label>
                    )}
                  </>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                  <span className="text-sm font-medium">Make it recurring</span>
                </label>
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
                            ? "Nth last work day (e.g. 3)"
                            : "Nth work day (e.g. 3)"}
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
                )}
              </div>
              )}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
            <div className="w-full sm:min-w-0 sm:w-1/2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
              <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {!categoryId
                    ? "Similar expenses"
                    : subcategoryId
                      ? "Similar expenses (subcategory)"
                      : "Similar expenses (category)"}
                </h3>
              </div>
              <div className="p-4 min-h-[140px] max-h-[480px] overflow-y-auto">
                {loadingSimilar ? (
                  <p className="text-xs text-slate-500">Loading…</p>
                ) : recentSimilar.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {!categoryId ? "No expenses yet" : "No similar transactions"}
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium min-w-0">Description</th>
                        <th className="pb-2 pr-3 font-medium text-right">Amount</th>
                        <th className="pb-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSimilar.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                          <td className="py-2 pr-3 min-w-0 max-w-[180px] sm:max-w-[240px] truncate text-slate-700 dark:text-slate-300">
                            {r.description || "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-red-600 dark:text-red-400">
                            −{r.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
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
          </div>
          <div className="shrink-0 flex flex-wrap gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || loadingData}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            {isEdit && status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => setDialog("confirm")}
                  disabled={loading || loadingData}
                  className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? "Confirming…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog("cancel")}
                  disabled={loading || loadingData}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-600 dark:border-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  {loading ? "Cancelling…" : "Cancel pending"}
                </button>
              </>
            )}
            {isEdit && status === "confirmed" && (
              <button
                type="button"
                onClick={() => setDialog("delete")}
                disabled={loading || loadingData}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-600 dark:border-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={dialog === "confirm"}
        onClose={() => setDialog(null)}
        onConfirm={handleConfirm}
        title="Confirm movement"
        message="Confirm this pending movement? It will be applied and balances updated."
        confirmLabel="Confirm"
        cancelLabel="Go back"
        variant="confirm"
        loading={loading}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        onConfirm={handleDelete}
        title="Cancel pending movement"
        message="Cancel this pending movement? It will be deleted."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep"
        variant="cancel"
        loading={loading}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={handleDelete}
        title="Delete movement"
        message="Delete this movement? Balances will be updated."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="cancel"
        loading={loading}
      />
    </div>
  );
}
