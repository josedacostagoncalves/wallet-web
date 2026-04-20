"use client";

import {
  getAccounts,
  getCategories,
  getCategoriesFlatForSearch,
  getSubcategories,
  getTransaction,
  createTransaction,
  getRecentTransactionsByCategory,
  type CategoryFlatRow,
  type RecentSimilarRow,
} from "@/app/actions/transactions";
import { uploadTransactionAttachment, type TransactionAttachmentRow } from "@/app/actions/transaction-attachments";
import { CopyIcon } from "@/components/ActionIcons";
import { CategorySubcategorySearchField } from "@/components/CategorySubcategorySearchField";
import { TransactionDateInput } from "@/components/TransactionDateInput";
import { TransactionObservationsAttachments } from "@/components/TransactionObservationsAttachments";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import { getWalletSplitInfo, getCurrentUserId } from "@/app/actions/wallets";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
} from "@/lib/recurrence";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  intlLocaleFromAppLocale,
  formatMoneyAmountTwoDecimals,
  normalizeMoneyInputString,
} from "@/lib/money-format";
import { incomeScopeForInsert, normalizeIncomeScope } from "@/lib/income-scope";

type TransactionType = "income" | "expense" | "transfer";

export default function NewTransactionPage() {
  const tForm = useTranslations("transactions.form");
  const tTransactions = useTranslations("transactions");
  const locale = useLocale();
  const localeTag = intlLocaleFromAppLocale(locale);
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams.get("copy");
  const typeParam = searchParams.get("type") as TransactionType | null;

  // Initialize state based on URL params
  const isValidType = typeParam && ["income", "expense", "transfer"].includes(typeParam);
  const [step, setStep] = useState<"type" | "form">(isValidType ? "form" : "type");
  const [type, setType] = useState<TransactionType | null>(isValidType ? typeParam : null);
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
  const [categoriesFlat, setCategoriesFlat] = useState<CategoryFlatRow[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [accountFromId, setAccountFromId] = useState("");
  const [accountToId, setAccountToId] = useState("");
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [attachments, setAttachments] = useState<TransactionAttachmentRow[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentFileError, setAttachmentFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [recentSimilar, setRecentSimilar] = useState<RecentSimilarRow[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [copyingSimilarId, setCopyingSimilarId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("monthly");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [workDayIndex, setWorkDayIndex] = useState("");
  const [saveAsPending, setSaveAsPending] = useState(false);
  const [incomeScopeWalletOnly, setIncomeScopeWalletOnly] = useState(false);
  const [walletIsShared, setWalletIsShared] = useState(false);
  const [incomeReceiverMemberId, setIncomeReceiverMemberId] = useState<string | null>(null);
  const [incomeReceiverOptions, setIncomeReceiverOptions] = useState<{ user_id: string; display_name: string }[]>([]);
  const incomeReceiverAutoSelected = useRef(false);

  useEffect(() => {
    if (!currentWalletId) return;
    getAccounts(currentWalletId).then(setAccounts);
  }, [currentWalletId]);

  useEffect(() => {
    incomeReceiverAutoSelected.current = false;
  }, [currentWalletId]);

  useEffect(() => {
    if (!currentWalletId || type !== "income") {
      setWalletIsShared(false);
      setIncomeReceiverOptions([]);
      setIncomeReceiverMemberId(null);
      incomeReceiverAutoSelected.current = false;
      return;
    }
    getWalletSplitInfo(currentWalletId).then((r) => {
      setWalletIsShared(!!r.is_shared);
      const opts = (r.members ?? []).map((m) => ({ user_id: m.user_id, display_name: m.display_name }));
      setIncomeReceiverOptions(opts);
      if (!r.is_shared) {
        setIncomeReceiverMemberId(null);
        return;
      }
      if (copyId) return;
      if (!incomeReceiverAutoSelected.current && opts.length > 0) {
        incomeReceiverAutoSelected.current = true;
        getCurrentUserId().then((res) => {
          if (res.userId && opts.some((o) => o.user_id === res.userId)) {
            setIncomeReceiverMemberId((prev) => prev ?? res.userId!);
          }
        });
      }
    });
  }, [currentWalletId, type, copyId]);

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
    getTransaction(copyId).then((m) => {
      setLoadingCopy(false);
      if (!m) {
        setCopyError(tForm("page.copyLoadError"));
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
      setType(m.type as TransactionType);
      setStep("form");
      setDate(new Date().toISOString().slice(0, 10));
      setAmount(formatMoneyAmountTwoDecimals(m.amount, localeTag));
      setAccountFromId(m.account_from_id ?? "");
      setAccountToId(m.account_to_id ?? "");
      setDescription(m.description ?? "");
      setObservations((m as { observations?: string | null }).observations ?? "");
      setAttachments([]);
      setPendingFiles([]);
      setAttachmentFileError(null);
      setCategoryId(catId);
      setSubcategoryId(subId);
      setIncomeScopeWalletOnly(
        m.type === "income" &&
          normalizeIncomeScope(m.type, (m as { income_scope?: string | null }).income_scope) === "wallet"
      );
      if (m.type === "income") {
        setIncomeReceiverMemberId((m as { received_by_member_id?: string | null }).received_by_member_id ?? null);
      }
      skipNextSubcategoryReset.current = true;
      didCopyFrom.current = true;
    });
  }, [copyId, currentWalletId, tForm, localeTag]);

  useEffect(() => {
    if (!currentWalletId || !type) return;
    Promise.all([
      getCategories(currentWalletId, type),
      getCategoriesFlatForSearch(currentWalletId, type),
    ]).then(([data, flat]) => {
      setCategories(data);
      setCategoriesFlat(flat);
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
    getRecentTransactionsByCategory(
      currentWalletId,
      type,
      categoryId,
      subcategoryId || null
    )
      .then(setRecentSimilar)
      .finally(() => setLoadingSimilar(false));
  }, [type, currentWalletId, categoryId, subcategoryId]);

  function pickType(next: TransactionType) {
    setType(next);
    setStep("form");
    setError(null);
    if (next !== "income") {
      setIncomeScopeWalletOnly(false);
      setIncomeReceiverMemberId(null);
      incomeReceiverAutoSelected.current = false;
    }
  }

  function handleCategorySearchPick(parentId: string, subId: string) {
    if (didCopyFrom.current) {
      didCopyFrom.current = false;
      setDescription("");
      setObservations("");
      setAttachments([]);
      setPendingFiles([]);
      setAttachmentFileError(null);
      setAmount("");
      setAccountFromId("");
      setAccountToId("");
      setError(null);
    }
    skipNextSubcategoryReset.current = true;
    setCategoryId(parentId);
    setSubcategoryId(subId);
    getSubcategories(parentId).then(setSubcategories);
  }

  async function handleCopyFromSimilar(id: string) {
    setCopyingSimilarId(id);
    const m = await getTransaction(id);
    setCopyingSimilarId(null);
    if (!m) return;
    const parentId = m.parent_id ?? null;
    const catId = parentId || m.category_id;
    const subId = parentId ? m.category_id : "";
    skipNextSubcategoryReset.current = true;
    setAmount(formatMoneyAmountTwoDecimals(m.amount, localeTag));
    setDescription(m.description ?? "");
    setObservations((m as { observations?: string | null }).observations ?? "");
    setAttachments([]);
    setPendingFiles([]);
    setAttachmentFileError(null);
    setAccountFromId(m.account_from_id ?? "");
    setAccountToId(m.account_to_id ?? "");
    if (m.type === "income") {
      setIncomeScopeWalletOnly(
        normalizeIncomeScope(m.type, (m as { income_scope?: string | null }).income_scope) === "wallet"
      );
      setIncomeReceiverMemberId((m as { received_by_member_id?: string | null }).received_by_member_id ?? null);
    }
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
      setError(tForm("validation.amountPositive"));
      setLoading(false);
      return;
    }
    const catId = subcategoryId || categoryId;
    if (!catId) {
      setError(tForm("validation.categoryRequired"));
      setLoading(false);
      return;
    }
    if (type === "expense" && subcategories.length > 0 && !subcategoryId) {
      setError(tForm("validation.subcategoryRequired"));
      setLoading(false);
      return;
    }
    if (!description.trim()) {
      setError(tForm("validation.descriptionRequired"));
      setLoading(false);
      return;
    }
    if (type === "income" && walletIsShared && !incomeReceiverMemberId) {
      setError(tForm("validation.memberReceivedRequired"));
      setLoading(false);
      return;
    }
    if (isRecurring && recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) {
        setError(tForm("validation.intervalMonthsValid"));
        setLoading(false);
        return;
      }
    }
    if (isRecurring && recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) {
        setError(tForm("validation.intervalDaysValid"));
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
        setError(tForm("validation.workDayIndexValid"));
        setLoading(false);
        return;
      }
    }
    const res = await createTransaction({
      wallet_id: currentWalletId,
      type,
      category_id: catId,
      date,
      amount: num,
      account_from_id: type === "income" ? null : accountFromId || null,
      account_to_id: type === "expense" ? null : accountToId || null,
      description: description.trim(),
      observations: observations.trim() || null,
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
      ...(type === "income"
        ? {
            income_scope: incomeScopeForInsert("income", incomeScopeWalletOnly ? "wallet" : "user"),
            received_by_member_id: incomeReceiverMemberId,
          }
        : {}),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    if (res.id && currentWalletId && pendingFiles.length > 0) {
      for (const f of pendingFiles) {
        const fd = new FormData();
        fd.set("file", f);
        const up = await uploadTransactionAttachment(currentWalletId, res.id, fd);
        if (up.error) showToast(up.error, "error");
      }
      setPendingFiles([]);
    }
    showToast(tForm("toasts.transactionAdded"));
    router.push("/transactions");
    router.refresh();
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

  function similarTitle() {
    if (!type) return "";
    if (type === "expense") {
      return subcategoryId ? tForm("similar.expensesSubcategory") : tForm("similar.expensesCategory");
    }
    if (type === "income") {
      return subcategoryId ? tForm("similar.incomeSubcategory") : tForm("similar.incomeCategory");
    }
    return subcategoryId ? tForm("similar.transfersSubcategory") : tForm("similar.transfersCategory");
  }

  if (!currentWalletId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{tForm("page.newTransaction")}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {tForm("noWallet")}
        </p>
        <Link href="/wallets" className="text-slate-800 dark:text-slate-200 underline">
          {tForm("page.goToWallets")}
        </Link>
      </div>
    );
  }

  if (copyId && (loadingCopy || step === "type")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{tForm("page.newTransaction")}</h1>
        <div className="w-full max-w-md space-y-4 animate-pulse">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <p className="text-sm text-slate-500">{tForm("page.loadingCopy")}</p>
      </div>
    );
  }

  if (copyId && copyError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{tForm("page.newTransaction")}</h1>
        <p className="text-slate-600 dark:text-slate-400">{copyError}</p>
        <div className="flex gap-3">
          <Link
            href="/transactions/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            {tForm("page.chooseType")}
          </Link>
          <Link
            href="/transactions"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {tForm("page.backToDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  if (step === "type") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{tForm("page.newTransaction")}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {tForm("page.chooseTypeSubtitle")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => pickType("income")}
            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600"
          >
            <span className="text-2xl mb-2">↓</span>
            <span className="font-medium">{tTransactions("income")}</span>
          </button>
          <button
            onClick={() => pickType("expense")}
            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600"
          >
            <span className="text-2xl mb-2">↑</span>
            <span className="font-medium">{tTransactions("expense")}</span>
          </button>
          <button
            onClick={() => pickType("transfer")}
            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-600"
          >
            <span className="text-2xl mb-2">⇄</span>
            <span className="font-medium">{tTransactions("transfer")}</span>
          </button>
        </div>
        <Link href="/transactions" className="text-slate-500 hover:underline">← {tForm("page.backToTransactions")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">
          {type === "income" ? tForm("newIncome") : type === "expense" ? tForm("newExpense") : tForm("newTransfer")}
        </h1>
        <button
          type="button"
          onClick={() => {
            setStep("type");
            setType(null);
            setCopyFrom(null);
            setObservations("");
            setAttachments([]);
            setPendingFiles([]);
            setAttachmentFileError(null);
            setError(null);
            didCopyFrom.current = false;
          }}
          className="text-sm text-slate-500 hover:underline"
        >
          {tForm("page.changeType")}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
        <form onSubmit={handleSubmit} className="w-full lg:w-1/2 lg:min-w-0 space-y-4">
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
          <TransactionObservationsAttachments
            observations={observations}
            onObservationsChange={setObservations}
            walletId={currentWalletId}
            transactionId={null}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            fileError={attachmentFileError}
            onFileError={setAttachmentFileError}
            disabled={loading}
            textareaClassName="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            labelClassName="block text-sm font-medium mb-1"
          />
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
              onChange={(e) => {
                const v = e.target.value;
                if (didCopyFrom.current) {
                  didCopyFrom.current = false;
                  setDescription("");
                  setObservations("");
                  setAttachments([]);
                  setPendingFiles([]);
                  setAttachmentFileError(null);
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
              <option value="">{tForm("fields.selectCategory")}</option>
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
                {type === "expense" ? tForm("fields.subcategoryRequired") : tForm("fields.subcategory")}
              </label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                required={type === "expense"}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="">{type === "expense" ? tForm("fields.selectSubcategory") : tForm("fields.none")}</option>
                {subcategories.map((c) => (
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
              onBlur={() => setAmount((a) => normalizeMoneyInputString(a, localeTag))}
              required
              placeholder={tForm("fields.amountPlaceholder")}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            />
          </div>
          {type === "income" && (
            <>
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
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {walletIsShared && (
                <div>
                  <label className="block text-sm font-medium mb-1">{tForm("fields.receivedByMemberRequired")}</label>
                  <select
                    value={incomeReceiverMemberId ?? ""}
                    onChange={(e) => setIncomeReceiverMemberId(e.target.value || null)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                  >
                    <option value="">{tForm("fields.selectIncomeReceiver")}</option>
                    {incomeReceiverOptions.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-3 py-2.5 space-y-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="income-scope-wallet-only-new"
                    checked={incomeScopeWalletOnly}
                    onChange={(e) => setIncomeScopeWalletOnly(e.target.checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {tForm("fields.incomeScopeWalletOnly")}
                  </span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                  {tForm("fields.incomeScopeHint")}
                </p>
              </div>
            </>
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
                <label className="block text-sm font-medium mb-1">{tForm("fields.accountTransferFrom")}</label>
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
                <label className="block text-sm font-medium mb-1">{tForm("fields.accountTransferTo")}</label>
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="saveAsPending"
                checked={saveAsPending}
                onChange={(e) => setSaveAsPending(e.target.checked)}
              />
              <label htmlFor="saveAsPending" className="text-sm font-medium">
                {tForm("options.saveAsPending")}
              </label>
            </div>
            {saveAsPending && (
              <p className="text-xs text-slate-500 dark:text-slate-400 pl-6 -mt-1">
                {tForm("page.pendingHint")}
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
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? tForm("buttons.saving") : tForm("buttons.save")}
            </button>
            <Link
              href="/transactions"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {tForm("buttons.cancel")}
            </Link>
          </div>
        </form>

        {type && categoryId && (
          <div className="w-full lg:w-1/2 lg:min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {similarTitle()}
              </h3>
            </div>
            <div className="p-4 min-h-[140px] max-h-[min(50vh,420px)] overflow-y-auto friendly-scroll">
              {loadingSimilar ? (
                <p className="text-xs text-slate-500">{tForm("similar.loading")}</p>
              ) : recentSimilar.length === 0 ? (
                <p className="text-xs text-slate-500">{tForm("similar.noSimilar")}</p>
              ) : (
                <div className="w-full min-w-0 text-xs">
                  <div className="flex items-center justify-between gap-6 pb-1.5 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                    <span className="font-medium min-w-0 max-w-[42%] truncate">{tForm("similar.tableDescription")}</span>
                    <span className="font-medium shrink-0">{tForm("similar.tableAmount")}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {recentSimilar.map((r) => (
                      <li key={r.id} className="py-1.5 min-w-0">
                        <div className="text-[10px] leading-tight text-slate-500 tabular-nums">{r.date}</div>
                        <div className="mt-0.5 flex items-start justify-between gap-4 min-w-0">
                          <div className="min-w-0 max-w-[38%] flex-none text-left sm:max-w-[40%]">
                            <p className="text-slate-700 dark:text-slate-200 break-words hyphens-auto">
                              {r.description || "—"}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400 break-words">
                              {type === "transfer"
                                ? `${r.account_from_name ?? "—"} → ${r.account_to_name ?? "—"}`
                                : type === "expense"
                                  ? (r.account_from_name ?? "—")
                                  : (r.account_to_name ?? "—")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-start gap-2">
                            <span
                              className={`tabular-nums text-right whitespace-nowrap pt-px ${type === "income"
                                ? "text-green-600 dark:text-green-400"
                                : type === "expense"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-blue-600 dark:text-blue-400"
                                }`}
                            >
                              {type === "income" ? "+" : type === "expense" ? "−" : ""}
                              {formatMoneyAmountTwoDecimals(r.amount, localeTag)}{" "}
                              €
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyFromSimilar(r.id)}
                              disabled={!!copyingSimilarId}
                              className="p-1 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 transition-colors shrink-0"
                              title={copyingSimilarId === r.id ? tForm("similar.copying") : tForm("similar.copy")}
                              aria-label={copyingSimilarId === r.id ? tForm("similar.copying") : tForm("similar.copy")}
                            >
                              <CopyIcon aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
