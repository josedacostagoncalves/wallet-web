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
import { useToast } from "@/contexts/ToastContext";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
  WEEKDAY_LABELS,
} from "@/lib/recurrence";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type TransactionType = "income" | "expense" | "transfer";

export default function EditRecurringPage() {
  const tRecurring = useTranslations("transactions.recurring");
  const tForm = useTranslations("transactions.form");
  const tTransactions = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const params = useParams();
  const id = String(params.id);
  const { showToast } = useToast();
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
  const [endDate, setEndDate] = useState("");
  const [weekday, setWeekday] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [currentCategoryName, setCurrentCategoryName] = useState("");
  const [currentSubcategoryName, setCurrentSubcategoryName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function recurrenceOptionLabel(value: RecurrenceType) {
    switch (value) {
      case "daily":
        return tForm("options.scheduleTypes.daily");
      case "weekly":
        return tForm("options.scheduleTypes.weekly");
      case "monthly":
        return tForm("options.scheduleTypes.monthly");
      case "yearly":
        return tForm("options.scheduleTypes.yearly");
      case "interval_days":
        return tForm("options.scheduleTypes.intervalDays");
      case "interval_months":
        return tForm("options.scheduleTypes.intervalMonths");
      case "monthly_nth_work_day":
        return tForm("options.scheduleTypes.monthlyNthWorkDay");
      case "monthly_nth_last_work_day":
        return tForm("options.scheduleTypes.monthlyNthLastWorkDay");
      default:
        return value;
    }
  }

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
      setError(tForm("validation.amountPositive"));
      setSaving(false);
      return;
    }
    const catId = subcategoryId || categoryId;
    if (!catId) {
      setError(tForm("validation.categoryRequired"));
      setSaving(false);
      return;
    }
    if (
      rule.type === "expense" &&
      subcategories.length > 0 &&
      !subcategoryId
    ) {
      setError(tForm("validation.subcategoryRequired"));
      setSaving(false);
      return;
    }
    if (!description.trim()) {
      setError(tForm("validation.descriptionRequired"));
      setSaving(false);
      return;
    }
    if (recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) {
        setError(tForm("validation.intervalMonthsValid"));
        setSaving(false);
        return;
      }
    }
    if (recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) {
        setError(tForm("validation.intervalDaysValid"));
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
        setError(tForm("validation.workDayIndexValid"));
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
    showToast(tRecurring("editModal.updatedToast"));
    router.push("/transactions");
    router.refresh();
  }

  async function handleDelete() {
    if (!rule || !confirm(tRecurring("confirmDelete.message"))) return;
    setDeleting(true);
    setError(null);
    const res = await deleteRecurringRule(id);
    setDeleting(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast(tRecurring("deleteToast"));
    router.push("/transactions");
    router.refresh();
  }

  if (loading) return <p className="text-slate-500">{tCommon("loading")}</p>;
  if (!rule) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">{tRecurring("editModal.notFound")}</p>
        <Link href="/transactions" className="underline">
          ← {tTransactions("title")}
        </Link>
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{tRecurring("editModal.title")}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {tRecurring("editModal.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tRecurring("table.type")}</label>
          <p className="py-2 capitalize text-slate-600 dark:text-slate-400">
            {type === "income" ? tTransactions("income") : type === "expense" ? tTransactions("expense") : tTransactions("transfer")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{tForm("fields.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{tForm("fields.category")}</label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId("");
            }}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="">{tForm("fields.selectCategory")}</option>
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
              {type === "expense" ? tForm("fields.subcategoryRequired") : tForm("fields.subcategory")}
            </label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              required={type === "expense"}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">
                {type === "expense" ? tForm("fields.selectSubcategory") : tForm("fields.none")}
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
          <label className="block text-sm font-medium mb-1">{tForm("fields.amount")}</label>
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
              {tForm("fields.accountTo")}
            </label>
            <select
              value={accountToId}
              onChange={(e) => setAccountToId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">{tForm("fields.selectAccount")}</option>
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
              {tForm("fields.accountFrom")}
            </label>
            <select
              value={accountFromId}
              onChange={(e) => setAccountFromId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">{tForm("fields.selectAccount")}</option>
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
                {tForm("fields.accountTransferFrom")}
              </label>
              <select
                value={accountFromId}
                onChange={(e) => setAccountFromId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">{tForm("fields.selectAccount")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {tForm("fields.accountTransferTo")}
              </label>
              <select
                value={accountToId}
                onChange={(e) => setAccountToId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">{tForm("fields.selectAccount")}</option>
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
          <div className="text-sm font-medium">{tRecurring("table.repeat")}</div>
          <div className="space-y-3 pl-0">
            <div>
              <label className="block text-sm font-medium mb-1">{tForm("options.schedule")}</label>
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
                      {recurrenceOptionLabel(o.value)}
                    </option>
                  )
                )}
              </select>
            </div>
            {recurrenceType === "interval_days" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {tForm("options.intervalDays")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  placeholder={tForm("options.intervalDaysPlaceholder")}
                  className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                />
              </div>
            )}
            {recurrenceType === "interval_months" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {tForm("options.intervalMonths")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(e.target.value)}
                  placeholder={tForm("options.intervalMonthsPlaceholder")}
                  className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                />
              </div>
            )}
            {(recurrenceType === "monthly_nth_work_day" ||
              recurrenceType === "monthly_nth_last_work_day") && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {recurrenceType === "monthly_nth_last_work_day"
                      ? tForm("options.nthLastWorkDay")
                      : tForm("options.nthWorkDay")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={workDayIndex}
                    onChange={(e) => setWorkDayIndex(e.target.value)}
                    placeholder={tForm("options.workDayPlaceholder")}
                    className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  />
                </div>
              )}
            {recurrenceType === "weekly" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {tRecurring("editModal.dayOfWeek")}
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
                  {tRecurring("editModal.dayOfMonth")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  placeholder={tRecurring("editModal.dayOfMonthPlaceholder")}
                  className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                {tRecurring("editModal.endDate")}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">
                {tRecurring("editModal.endDateHint")}
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
                Next run {rule.next_run_date} is after end date {endDate}. No
                new runs will be created. Turn it active again or update the end
                date to continue.
              </p>
            </div>
          )}
        <div className="flex flex-col gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              {tRecurring("editModal.activeLabel")}
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
            {tRecurring("editModal.activeHint")}
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
            {saving ? tForm("buttons.saving") : tForm("buttons.save")}
          </button>
          <Link
            href="/transactions"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            {tCommon("cancel")}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? tForm("buttons.deleting") : tCommon("delete")}
          </button>
        </div>
      </form>
    </div>
  );
}
