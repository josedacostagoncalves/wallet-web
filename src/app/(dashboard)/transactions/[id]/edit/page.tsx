"use client";

import {
  getTransaction,
  getAccounts,
  getCategories,
  getCategoriesFlatForSearch,
  getSubcategories,
  updateTransaction,
  deleteTransaction,
  confirmTransaction,
  type CategoryFlatRow,
} from "@/app/actions/transactions";
import { CategorySubcategorySearchField } from "@/components/CategorySubcategorySearchField";
import { TransactionDateInput } from "@/components/TransactionDateInput";
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
import { useTranslations } from "next-intl";

type TransactionType = "income" | "expense" | "transfer";

export default function EditTransactionPage() {
  const tForm = useTranslations("transactions.form");
  const tTransactions = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const params = useParams();
  const id = String(params.id);
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const router = useRouter();

  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoriesFlat, setCategoriesFlat] = useState<CategoryFlatRow[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [type, setType] = useState<TransactionType | null>(null);
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
    getTransaction(id).then((m) => {
      setLoading(false);
      if (!m) return;
      setStatus(m.status);
      setType(m.type as TransactionType);
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
    Promise.all([
      getCategories(currentWalletId, type),
      getCategoriesFlatForSearch(currentWalletId, type),
    ]).then(([cats, flat]) => {
      setCategories(cats);
      setCategoriesFlat(flat);
    });
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
    if (isNaN(num) || num <= 0) return tForm("validation.amountPositive");
    const catId = subcategoryId || categoryId;
    if (!catId) return tForm("validation.categoryRequired");
    if (type === "expense" && subcategories.length > 0 && !subcategoryId)
      return tForm("validation.subcategoryRequired");
    if (!description.trim()) return tForm("validation.descriptionRequired");
    if (!status) return null;
    if (status === "confirmed" && isRecurring && recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) return tForm("validation.intervalMonthsValid");
    }
    if (status === "confirmed" && isRecurring && recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) return tForm("validation.intervalDaysValid");
    }
    if (status === "confirmed") {
      const isWorkDay =
        isRecurring &&
        (recurrenceType === "monthly_nth_work_day" ||
          recurrenceType === "monthly_nth_last_work_day");
      if (isWorkDay) {
        const x = parseInt(workDayIndex, 10);
        if (isNaN(x) || x < 1 || x > 31)
          return tForm("validation.workDayIndexValid");
      }
    }
    return null;
  }

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
    const res = await updateTransaction(id, {
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
    showToast(tForm("toasts.transactionUpdated"));
    router.push("/transactions");
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
    const res = await updateTransaction(id, {
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
    const confirmRes = await confirmTransaction(id);
    setConfirming(false);
    if (confirmRes.error) {
      setError(confirmRes.error);
      setConfirmDialogOpen(false);
      showToast(confirmRes.error, "error");
      return;
    }
    setConfirmDialogOpen(false);
    showToast(tForm("toasts.transactionConfirmed"));
    router.push("/transactions");
    router.refresh();
  }

  async function handleCancelPending() {
    setDeleting(true);
    setError(null);
    const res = await deleteTransaction(id);
    setDeleting(false);
    if (res.error) {
      setError(res.error);
      setCancelDialogOpen(false);
      showToast(res.error, "error");
    } else {
      setCancelDialogOpen(false);
      showToast(tForm("toasts.pendingTransactionCanceled"));
      router.push("/transactions");
      router.refresh();
    }
  }

  if (loading) return <p className="text-slate-500">{tCommon("loading")}</p>;
  if (!type) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">{tForm("page.notFound")}</p>
        <Link href="/transactions" className="underline">← {tTransactions("title")}</Link>
      </div>
    );
  }

  const categoryOpts = categories;
  const needsExtraCategory =
    categoryId && !categoryOpts.some((c) => c.id === categoryId);
  const subOpts = subcategories;
  const needsExtraSub =
    subcategoryId && !subOpts.some((s) => s.id === subcategoryId);

  function handleCategorySearchPick(parentId: string, subId: string) {
    setCategoryId(parentId);
    setSubcategoryId(subId);
    getSubcategories(parentId).then(setSubcategories);
    setCurrentCategoryName("");
    setCurrentSubcategoryName("");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        {status === "pending"
          ? type === "income"
            ? tForm("editPendingIncome")
            : type === "expense"
              ? tForm("editPendingExpense")
              : tForm("editPendingTransfer")
          : type === "income"
            ? tForm("editIncome")
            : type === "expense"
              ? tForm("editExpense")
              : tForm("editTransfer")}
      </h1>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tTransactions("pending.table.type")}</label>
          <p className="py-2 capitalize text-slate-600 dark:text-slate-400">
            {type === "income" ? tTransactions("income") : type === "expense" ? tTransactions("expense") : tTransactions("transfer")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{tForm("fields.date")}</label>
          <TransactionDateInput
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
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
        <CategorySubcategorySearchField
          flat={categoriesFlat}
          labelClassName="block text-sm font-medium mb-1"
          inputClassName="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm"
          onPick={handleCategorySearchPick}
        />
        <div>
          <label className="block text-sm font-medium mb-1">{tForm("fields.category")}</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          >
            <option value="">{tForm("fields.selectCategory")}</option>
            {needsExtraCategory && (
              <option value={categoryId}>{currentCategoryName || tForm("page.current")}</option>
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
              <option value="">{type === "expense" ? tForm("fields.selectSubcategory") : tForm("fields.none")}</option>
              {needsExtraSub && (
                <option value={subcategoryId}>
                  {currentSubcategoryName || tForm("page.current")}
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
            <label className="block text-sm font-medium mb-1">{tForm("fields.accountTo")}</label>
            <select
              value={accountToId}
              onChange={(e) => setAccountToId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">{tForm("fields.selectAccount")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        {type === "expense" && (
          <div>
            <label className="block text-sm font-medium mb-1">{tForm("fields.accountFrom")}</label>
            <select
              value={accountFromId}
              onChange={(e) => setAccountFromId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            >
              <option value="">{tForm("fields.selectAccount")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        {type === "transfer" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">{tForm("fields.accountTransferFrom")}</label>
              <select
                value={accountFromId}
                onChange={(e) => setAccountFromId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">{tForm("fields.selectAccount")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tForm("fields.accountTransferTo")}</label>
              <select
                value={accountToId}
                onChange={(e) => setAccountToId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">{tForm("fields.selectAccount")}</option>
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
                {tForm("options.makeRecurring")}
              </label>
            </div>
            {isRecurring && (
              <div className="space-y-3 pl-6">
                <div>
                  <label className="block text-sm font-medium mb-1">{tForm("options.schedule")}</label>
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
                          {recurrenceOptionLabel(o.value)}
                        </option>
                      )
                    )}
                  </select>
                </div>
                {recurrenceType === "interval_days" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{tForm("options.intervalDays")}</label>
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
                    <label className="block text-sm font-medium mb-1">{tForm("options.intervalMonths")}</label>
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tForm("page.recurringHint")}
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
            {saving ? tForm("buttons.saving") : tForm("buttons.save")}
          </button>
          {status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => setConfirmDialogOpen(true)}
                disabled={confirming}
                className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
              >
                {confirming ? tForm("buttons.confirming") : tForm("buttons.confirm")}
              </button>
              <button
                type="button"
                onClick={() => setCancelDialogOpen(true)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {deleting ? tForm("buttons.cancelling") : tForm("buttons.cancelPending")}
              </button>
              <ConfirmDialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
                onConfirm={handleConfirmClick}
                title={tForm("confirmDialogs.confirmTitle")}
                message={tForm("confirmDialogs.confirmMessage")}
                confirmLabel={tForm("confirmDialogs.confirmButton")}
                cancelLabel={tForm("confirmDialogs.goBack")}
                variant="confirm"
                loading={confirming}
              />
              <ConfirmDialog
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onConfirm={handleCancelPending}
                title={tForm("confirmDialogs.cancelTitle")}
                message={tForm("confirmDialogs.cancelMessage")}
                confirmLabel={tForm("confirmDialogs.cancelButton")}
                cancelLabel={tForm("confirmDialogs.keepButton")}
                variant="cancel"
                loading={deleting}
              />
            </>
          )}
          {status !== "pending" && (
            <Link
              href="/transactions"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
            >
              {tCommon("cancel")}
            </Link>
          )}
          <Link
            href="/transactions"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {tForm("confirmDialogs.goBack")}
          </Link>
        </div>
      </form>
    </div>
  );
}
