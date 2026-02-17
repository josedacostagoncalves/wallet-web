"use client";

import { getCategory } from "@/app/actions/categories";
import {
  getAccounts,
  getCategories,
  getSubcategories,
} from "@/app/actions/transactions";
import {
  getRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  type RecurringRuleRow,
} from "@/app/actions/recurring";
import { BalanceHint } from "@/components/BalanceHint";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
  WEEKDAY_LABELS,
} from "@/lib/recurrence";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = { open: boolean; onClose: () => void; ruleId: string };
type TransactionType = "income" | "expense" | "transfer";

const inputClass =
  "w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800";

export function RecurringEditModal({ open, onClose, ruleId }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [rule, setRule] = useState<RecurringRuleRow | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
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
  const [endDate, setEndDate] = useState("");
  const [weekday, setWeekday] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [currentCategoryName, setCurrentCategoryName] = useState("");
  const [currentSubcategoryName, setCurrentSubcategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!open || !ruleId) return;
    setLoading(true);
    setRule(null);
    getRecurringRule(ruleId).then(async (r) => {
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
      setEndDate(r.end_date ?? "");
      if (r.recurrence_type === "weekly") {
        setWeekday(
          r.weekday ?? new Date(r.next_run_date + "T12:00:00Z").getUTCDay()
        );
      } else {
        setWeekday(null);
      }
      if (r.recurrence_type === "monthly") {
        setDayOfMonth(
          r.day_of_month != null
            ? String(r.day_of_month)
            : String(new Date(r.next_run_date + "T12:00:00Z").getUTCDate())
        );
      } else {
        setDayOfMonth("");
      }
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
  }, [open, ruleId]);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !deleting) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving, deleting]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
      if (recurrenceType === "monthly" && dayOfMonth.trim()) {
        const x = parseInt(dayOfMonth, 10);
        if (isNaN(x) || x < 1 || x > 31) {
          setError("Day of month must be 1–31");
          setSaving(false);
          return;
        }
      }

      const res = await updateRecurringRule(ruleId, {
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
        end_date: endDate.trim() || null,
        weekday:
          recurrenceType === "weekly" && weekday != null ? weekday : null,
        day_of_month:
          recurrenceType === "monthly" && dayOfMonth.trim()
            ? parseInt(dayOfMonth, 10)
            : null,
      });
      setSaving(false);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      showToast("Recurring rule updated.");
      onClose();
      router.push("/dashboard");
      router.refresh();
    },
    [
      rule,
      ruleId,
      amount,
      categoryId,
      subcategoryId,
      subcategories.length,
      description,
      recurrenceType,
      intervalMonths,
      intervalDays,
      workDayIndex,
      dayOfMonth,
      isActive,
      endDate,
      weekday,
      accountFromId,
      accountToId,
      onClose,
      router,
      showToast,
    ]
  );

  const handleDelete = useCallback(async () => {
    if (!rule) return;
    setDeleting(true);
    setError(null);
    const res = await deleteRecurringRule(ruleId);
    setDeleting(false);
    setDeleteDialogOpen(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast("Recurring rule deleted.");
    onClose();
    router.push("/dashboard");
    router.refresh();
  }, [rule, ruleId, onClose, router, showToast]);

  if (!open) return null;

  if (loading) {
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
        <div className="relative rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl px-6 py-4">
          <p className="text-slate-600 dark:text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!rule) {
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
          <p className="text-slate-500 mb-4">Recurring rule not found.</p>
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

  const type = rule.type as TransactionType;
  const categoryOpts = categories;
  const needsExtraCategory =
    categoryId && !categoryOpts.some((c) => c.id === categoryId);
  const subOpts = subcategories;
  const needsExtraSub =
    subcategoryId && !subOpts.some((s) => s.id === subcategoryId);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-edit-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={() => !saving && !deleting && onClose()}
      />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 pt-6 pb-2 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="recurring-edit-modal-title"
            className="text-xl font-semibold text-slate-900 dark:text-slate-100"
          >
            Edit recurring
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Changes apply only to future runs. Existing pending or confirmed
            transactions are not modified.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col min-h-0 flex-1 overflow-y-auto"
        >
          <div className="p-6 space-y-4">
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
                className={inputClass}
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
                className={inputClass}
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
                  className={inputClass}
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
                className={inputClass}
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
                  const acc = accounts.find((a) => a.id === accountToId);
                  const num = parseFloat(amount.replace(",", "."));
                  if (acc && !isNaN(num) && num > 0)
                    return <BalanceHint currentBalance={acc.current_balance} afterBalance={acc.current_balance + num} />;
                  return null;
                })()}
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
                  const acc = accounts.find((a) => a.id === accountFromId);
                  const num = parseFloat(amount.replace(",", "."));
                  if (acc && !isNaN(num) && num > 0)
                    return <BalanceHint currentBalance={acc.current_balance} afterBalance={acc.current_balance - num} />;
                  return null;
                })()}
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
                    const acc = accounts.find((a) => a.id === accountFromId);
                    const num = parseFloat(amount.replace(",", "."));
                    if (acc && !isNaN(num) && num > 0)
                      return <BalanceHint currentBalance={acc.current_balance} afterBalance={acc.current_balance - num} />;
                    return null;
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    To account *
                  </label>
                  <select
                    value={accountToId}
                    onChange={(e) => setAccountToId(e.target.value)}
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
                    const acc = accounts.find((a) => a.id === accountToId);
                    const num = parseFloat(amount.replace(",", "."));
                    if (acc && !isNaN(num) && num > 0)
                      return <BalanceHint currentBalance={acc.current_balance} afterBalance={acc.current_balance + num} />;
                    return null;
                  })()}
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
                      if (!v) return;
                      setRecurrenceType(v);
                      if (v === "weekly") {
                        setDayOfMonth("");
                        setWeekday(
                          rule
                            ? new Date(
                              rule.next_run_date + "T12:00:00Z"
                            ).getUTCDay()
                            : 1
                        );
                      } else if (v === "monthly") {
                        setWeekday(null);
                        setDayOfMonth(
                          rule
                            ? String(
                              new Date(
                                rule.next_run_date + "T12:00:00Z"
                              ).getUTCDate()
                            )
                            : "1"
                        );
                      } else {
                        setWeekday(null);
                        setDayOfMonth("");
                      }
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
                {recurrenceType === "weekly" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Day of week
                    </label>
                    <select
                      value={weekday ?? ""}
                      onChange={(e) =>
                        setWeekday(
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value, 10)
                        )
                      }
                      className="w-full max-w-xs px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                    >
                      {WEEKDAY_LABELS.map((label, i) => (
                        <option key={i} value={i}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {recurrenceType === "monthly" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Day of month (1–31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      placeholder="e.g. 15"
                      className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    End date (optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Leave empty to run indefinitely. If set, recurring stops
                    after this date.
                  </p>
                </div>
              </div>
            </div>
            {rule &&
              endDate.trim() &&
              rule.next_run_date > endDate.trim() && (
                <div
                  role="alert"
                  className="p-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20"
                >
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    This recurring is stopped (end date passed).
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Next run {rule.next_run_date} is after end date {endDate}.
                    No new runs will be created. Turn it active again or update
                    the end date to continue.
                  </p>
                </div>
              )}
            <div className="flex flex-col gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring-isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label
                  htmlFor="recurring-isActive"
                  className="text-sm font-medium"
                >
                  Active (recurring runs automatically)
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                Uncheck to disable recurring. No new transactions will be created
                until you turn it back on.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-wrap gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <button
              type="submit"
              disabled={saving || deleting}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={saving || deleting}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete recurring rule"
        message="Delete this recurring rule? No new runs will be created. Existing transactions are kept."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="cancel"
        loading={deleting}
      />
    </div>
  );
}
