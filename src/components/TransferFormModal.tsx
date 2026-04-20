"use client";

import {
  getAccounts,
  getCategories,
  getCategoriesFlatForSearch,
  getSubcategories,
  getTransaction,
  getRecentTransactionsByType,
  getRecentTransactionsByCategory,
  createTransaction,
  updateTransaction,
  confirmTransaction,
  deleteTransaction,
  type CategoryFlatRow,
  type RecentSimilarRow,
} from "@/app/actions/transactions";
import { uploadTransactionAttachment, type TransactionAttachmentRow } from "@/app/actions/transaction-attachments";
import { getWalletSplitInfo, getCurrentUserId } from "@/app/actions/wallets";
import { getCategory } from "@/app/actions/categories";
import { BalanceHint } from "@/components/BalanceHint";
import { CategorySubcategorySearchField } from "@/components/CategorySubcategorySearchField";
import { TransactionDateInput } from "@/components/TransactionDateInput";
import { TransactionObservationsAttachments } from "@/components/TransactionObservationsAttachments";
import { CategoryModal } from "@/components/CategoryModal";
import { getRecurringRule } from "@/app/actions/recurring";
import { CopyIcon, TransactionTypeIcon } from "@/components/ActionIcons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  type RecurrenceType,
  RECURRENCE_OPTIONS,
  isRecurrenceOptionSeparator,
} from "@/lib/recurrence";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TransactionModalMode } from "@/contexts/TransactionModalsContext";
import { useLocale, useTranslations } from "next-intl";
import {
  intlLocaleFromAppLocale,
  formatMoneyAmountTwoDecimals,
  normalizeMoneyInputString,
} from "@/lib/money-format";

type Props = {
  open: boolean;
  onClose: () => void;
  mode?: TransactionModalMode;
  transactionId?: string;
  copyFromTransactionId?: string;
  copyFromRecurringId?: string;
};

const inputClass =
  "w-full text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800";

export function TransferFormModal({
  open,
  onClose,
  mode = "new",
  transactionId,
  copyFromTransactionId,
  copyFromRecurringId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const localeTag = intlLocaleFromAppLocale(locale);
  const t = useTranslations("transactions.form");
  const { showToast } = useToast();
  const { currentWalletId } = useWallet();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [accounts, setAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoriesFlat, setCategoriesFlat] = useState<CategoryFlatRow[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [attachments, setAttachments] = useState<TransactionAttachmentRow[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentFileError, setAttachmentFileError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [accountFromId, setAccountFromId] = useState("");
  const [accountToId, setAccountToId] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null);
  const [receivedByMemberId, setReceivedByMemberId] = useState<string | null>(null);
  const [walletSharedOption, setWalletSharedOption] = useState<string | null>(null);
  const [walletSplitType, setWalletSplitType] = useState<string | null>(null);
  const [walletTrackingMode, setWalletTrackingMode] = useState<string | null>(null);
  const [walletMembers, setWalletMembers] = useState<
    {
      id: string;
      user_id: string;
      display_name: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }[]
  >([]);
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
  const [dialog, setDialog] = useState<"confirm" | "cancel" | null>(null);
  const [recentSimilar, setRecentSimilar] = useState<RecentSimilarRow[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [copyingSimilarId, setCopyingSimilarId] = useState<string | null>(null);
  const [catModal, setCatModal] = useState<
    | { kind: "add-category"; type: "income" | "expense" | "transfer" }
    | { kind: "add-subcategory"; type: "income" | "expense" | "transfer"; parentId: string; parentName: string }
    | null
  >(null);
  const skipNextSubcategoryReset = useRef(false);
  const editOriginal = useRef<{ amount: number; accountFromId: string; accountToId: string; holdBalance: boolean } | null>(null);
  const autoSelectedMember = useRef(false);
  const memberManuallyChanged = useRef(false);
  const isEdit = mode === "edit" && !!transactionId;
  const isCopy = mode === "copy" && !!copyFromTransactionId;
  const shouldBlockForm = loadingData && (isEdit || isCopy || !!copyFromRecurringId);
  const targetAfterSave = pathname?.startsWith("/portfolio") ? "/portfolio" : "/transactions";

  const recurrenceOptionLabel = (value: string, fallback: string) => {
    switch (value) {
      case "daily":
        return t("options.scheduleTypes.daily");
      case "weekly":
        return t("options.scheduleTypes.weekly");
      case "monthly":
        return t("options.scheduleTypes.monthly");
      case "yearly":
        return t("options.scheduleTypes.yearly");
      case "interval_days":
        return t("options.scheduleTypes.intervalDays");
      case "interval_months":
        return t("options.scheduleTypes.intervalMonths");
      case "monthly_nth_work_day":
        return t("options.scheduleTypes.monthlyNthWorkDay");
      case "monthly_nth_last_work_day":
        return t("options.scheduleTypes.monthlyNthLastWorkDay");
      default:
        return fallback;
    }
  };

  useEffect(() => {
    if (!open || !currentWalletId) {
      autoSelectedMember.current = false;
      memberManuallyChanged.current = false;
      return;
    }
    getAccounts(currentWalletId).then(setAccounts);
    Promise.all([
      getCategories(currentWalletId, "transfer"),
      getCategoriesFlatForSearch(currentWalletId, "transfer"),
    ]).then(([cats, flat]) => {
      setCategories(cats);
      setCategoriesFlat(flat);
    });
  }, [open, currentWalletId]);

  useEffect(() => {
    if (!open || !currentWalletId) return;
    if (isEdit && transactionId) {
      setLoadingData(true);
      getTransaction(transactionId).then(async (m) => {
        if (!m) return;
        setStatus(m.status);
        editOriginal.current = {
          amount: m.amount,
          accountFromId: m.account_from_id ?? "",
          accountToId: m.account_to_id ?? "",
          holdBalance: m.hold_balance,
        };
        const parentId = m.parent_id ?? null;
        const catId = parentId || m.category_id;
        const subId = parentId ? m.category_id : "";
        setDate(m.date);
        setAmount(formatMoneyAmountTwoDecimals(m.amount, localeTag));
        setDescription(m.description ?? "");
        setObservations((m as { observations?: string | null }).observations ?? "");
        setAttachments(
          Array.isArray((m as { attachments?: TransactionAttachmentRow[] }).attachments)
            ? ((m as { attachments: TransactionAttachmentRow[] }).attachments ?? [])
            : []
        );
        setPendingFiles([]);
        setAttachmentFileError(null);
        setAccountFromId(m.account_from_id ?? "");
        setAccountToId(m.account_to_id ?? "");
        setPaidByMemberId(m.paid_by_member_id ?? null);
        setReceivedByMemberId(m.received_by_member_id ?? null);
        setCategoryId(catId);
        setSubcategoryId(subId);
        skipNextSubcategoryReset.current = true;
        const subs = await getSubcategories(catId);
        setSubcategories(subs);
        setLoadingData(false);
      });
      return;
    }
    if (isCopy && copyFromTransactionId) {
      setLoadingData(true);
      getTransaction(copyFromTransactionId).then(async (m) => {
        if (!m) return;
        const parentId = m.parent_id ?? null;
        const catId = parentId || m.category_id;
        const subId = parentId ? m.category_id : "";
        setDate(new Date().toISOString().slice(0, 10));
        setAmount(formatMoneyAmountTwoDecimals(m.amount, localeTag));
        setDescription(m.description ?? "");
        setObservations((m as { observations?: string | null }).observations ?? "");
        setAttachments([]);
        setPendingFiles([]);
        setAttachmentFileError(null);
        setAccountFromId(m.account_from_id ?? "");
        setAccountToId(m.account_to_id ?? "");
        setPaidByMemberId(m.paid_by_member_id ?? null);
        setReceivedByMemberId(m.received_by_member_id ?? null);
        setCategoryId(catId);
        setSubcategoryId(subId);
        setSaveAsPending(m.status === "pending");
        skipNextSubcategoryReset.current = true;
        const subs = await getSubcategories(catId);
        setSubcategories(subs);
        setLoadingData(false);
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
        setDate(new Date().toISOString().slice(0, 10));
        setAmount(formatMoneyAmountTwoDecimals(r.amount, localeTag));
        setDescription(r.description ?? "");
        setAccountFromId(r.account_from_id ?? "");
        setAccountToId(r.account_to_id ?? "");
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
        const subs = await getSubcategories(catId);
        setSubcategories(subs);
        setLoadingData(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [open, currentWalletId, isEdit, isCopy, transactionId, copyFromTransactionId, copyFromRecurringId, localeTag]);

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
      getRecentTransactionsByType(currentWalletId, "transfer", 20)
        .then(setRecentSimilar)
        .finally(() => setLoadingSimilar(false));
    } else {
      getRecentTransactionsByCategory(
        currentWalletId,
        "transfer",
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
    setCategoryId(catId);
    setSubcategoryId(subId);
    getSubcategories(catId).then(setSubcategories);
    setError(null);
  }

  const resetForm = useCallback(() => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setObservations("");
    setAttachments([]);
    setPendingFiles([]);
    setAttachmentFileError(null);
    setCategoryId("");
    setSubcategoryId("");
    setAmount("");
    setAccountFromId("");
    setAccountToId("");
    setPaidByMemberId(null);
    setReceivedByMemberId(null);
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
    if (mode === "new" && !transactionId && !copyFromTransactionId && !copyFromRecurringId) {
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
  }, [open, onClose, loading, loadingData, resetForm, mode, transactionId, copyFromTransactionId, copyFromRecurringId, currentWalletId]);

  useEffect(() => {
    if (!open || !currentWalletId) return;
    getWalletSplitInfo(currentWalletId, { referenceDate: date }).then((result) => {
      const sharedOption = result.shared_option ?? null;
      const members = result.members ?? [];
      setWalletSharedOption(sharedOption);
      setWalletSplitType(result.split_type ?? null);
      setWalletTrackingMode(result.tracking_mode ?? null);
      setWalletMembers(members);

      if (!autoSelectedMember.current && (sharedOption === "split" || sharedOption === "track_and_split") && members.length > 0) {
        autoSelectedMember.current = true;
        getCurrentUserId().then((userResult) => {
          if (userResult.userId) {
            const currentMember = members.find((m) => m.user_id === userResult.userId);
            if (currentMember) {
              if (!memberManuallyChanged.current) {
                setPaidByMemberId((prev) => prev ?? currentMember.id);
                setReceivedByMemberId((prev) => prev ?? currentMember.id);
              }
            }
          }
        });
      }
    });
  }, [open, currentWalletId, date]);

  const isSplitOnly = walletSharedOption === "split" || (!walletSharedOption && !!walletSplitType);
  const isBasicTracking = walletTrackingMode === "basic" || (!walletTrackingMode && isSplitOnly);
  const requiresAccounts = !isBasicTracking;
  const isSplitWallet = walletSharedOption === "track_and_split" || isSplitOnly;

  function validate(): string | null {
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) return t("validation.amountPositive");
    const catId = subcategoryId || categoryId;
    if (!catId) return t("validation.categoryRequired");
    if (!description.trim()) return t("validation.descriptionRequired");

    // For track and track_and_split: accounts always required
    // For split: accounts not used, only member
    if (requiresAccounts && (!accountFromId || !accountToId)) return t("validation.accountTransferFromRequired") + " / " + t("validation.accountTransferToRequired");
    if (requiresAccounts && accountFromId === accountToId) return t("validation.accountsDifferent");
    if (isSplitWallet && !paidByMemberId) return t("validation.memberPaidRequired");
    if (isSplitWallet && !receivedByMemberId) return t("validation.memberReceivedRequired");
    if (isSplitWallet && paidByMemberId && receivedByMemberId && paidByMemberId === receivedByMemberId) {
      return "From user and To user must be different";
    }

    if (isRecurring && recurrenceType === "interval_months") {
      const x = parseInt(intervalMonths, 10);
      if (isNaN(x) || x < 1) return t("validation.intervalMonthsValid");
    }
    if (isRecurring && recurrenceType === "interval_days") {
      const x = parseInt(intervalDays, 10);
      if (isNaN(x) || x < 1) return t("validation.intervalDaysValid");
    }
    const isWorkDay =
      isRecurring &&
      (recurrenceType === "monthly_nth_work_day" ||
        recurrenceType === "monthly_nth_last_work_day");
    if (isWorkDay) {
      const x = parseInt(workDayIndex, 10);
      if (isNaN(x) || x < 1 || x > 31) return t("validation.workDayIndexValid");
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

    if (isEdit && transactionId) {
      const useRecurring = status === "confirmed" && isRecurring;
      const res = await updateTransaction(transactionId, {
        type: "transfer",
        category_id: catId,
        date,
        amount: num,
        account_from_id: accountFromId,
        account_to_id: accountToId,
        description: description.trim(),
        observations: observations.trim() || null,
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
        paid_by_member_id: paidByMemberId,
        received_by_member_id: receivedByMemberId,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      showToast(t("toasts.transactionUpdated"));
      onClose();
      router.push(targetAfterSave);
      router.refresh();
      return;
    }

    const res = await createTransaction({
      wallet_id: currentWalletId,
      type: "transfer",
      category_id: catId,
      date,
      amount: num,
      account_from_id: accountFromId,
      account_to_id: accountToId,
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
        isWorkDay && workDayIndex.trim() ? parseInt(workDayIndex, 10) : null,
      paid_by_member_id: paidByMemberId,
      received_by_member_id: receivedByMemberId,
      status: saveAsPending ? "pending" : "confirmed",
      hold_balance: saveAsPending ? holdBalance : false,
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
    showToast(t("toasts.transactionAdded"));
    onClose();
    router.push(targetAfterSave);
    router.refresh();
  }

  async function handleConfirm() {
    if (!currentWalletId || !transactionId) return;
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
    const up = await updateTransaction(transactionId, {
      type: "transfer",
      category_id: catId,
      date,
      amount: num,
      account_from_id: accountFromId,
      account_to_id: accountToId,
      description: description.trim(),
      observations: observations.trim() || null,
      is_recurring: false,
      paid_by_member_id: paidByMemberId,
      received_by_member_id: receivedByMemberId,
    });
    if (up.error) {
      setError(up.error);
      setLoading(false);
      setDialog(null);
      showToast(up.error, "error");
      return;
    }
    const cr = await confirmTransaction(transactionId);
    setLoading(false);
    setDialog(null);
    if (cr.error) {
      setError(cr.error);
      showToast(cr.error, "error");
      return;
    }
    showToast(t("toasts.transactionConfirmed"));
    onClose();
    router.push(targetAfterSave);
    router.refresh();
  }

  async function handleDelete() {
    if (!transactionId) return;
    setLoading(true);
    const res = await deleteTransaction(transactionId);
    setLoading(false);
    setDialog(null);
    if (res.error) {
      showToast(res.error, "error");
      return;
    }
    showToast(status === "pending" ? t("toasts.pendingTransactionCanceled") : t("toasts.transactionDeleted"));
    onClose();
    router.push(targetAfterSave);
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
            {t("noWallet")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {t("close")}
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
      aria-labelledby="transfer-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={() => !loading && !loadingData && onClose()}
      />
      <div
        className="relative w-full max-w-[76.8rem] h-[min(78vh,780px)] max-h-[min(78vh,780px)] overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <TransactionTypeIcon
              type="transfer"
              aria-hidden
              className="[&_svg]:h-5 [&_svg]:w-5 dark:text-blue-400"
            />
            <h2 id="transfer-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isEdit
                ? status === "pending"
                  ? t("editPendingTransfer")
                  : t("editTransfer")
                : t("newTransfer")}
            </h2>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col min-h-0 flex-1 overflow-hidden"
        >
          {shouldBlockForm ? (
            <div className="min-h-[200px] flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="p-2 sm:p-3 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-3 items-stretch overflow-hidden">
            <div className="min-h-0 overflow-y-auto min-w-0 space-y-2.5 lg:pr-1 friendly-scroll">
              <div>
                <label className="block text-xs font-medium mb-1">{t("fields.date")}</label>
                <TransactionDateInput
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t("fields.description")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  required
                  placeholder={t("fields.transferDescriptionPlaceholder")}
                  className={inputClass}
                />
              </div>
              <TransactionObservationsAttachments
                observations={observations}
                onObservationsChange={setObservations}
                walletId={currentWalletId}
                transactionId={isEdit && transactionId ? transactionId : null}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
                fileError={attachmentFileError}
                onFileError={setAttachmentFileError}
                disabled={shouldBlockForm || loading}
                textareaClassName={inputClass}
              />
            </div>
            <div className="min-h-0 overflow-y-auto min-w-0 space-y-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 lg:pl-3 friendly-scroll">
              <CategorySubcategorySearchField
                flat={categoriesFlat}
                disabled={shouldBlockForm}
                inputClassName={inputClass}
                onPick={(parentId, subId) => {
                  skipNextSubcategoryReset.current = true;
                  setCategoryId(parentId);
                  setSubcategoryId(subId);
                  getSubcategories(parentId).then(setSubcategories);
                }}
              />
              <div>
                <label className="block text-xs font-medium mb-1">{t("fields.category")}</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className={inputClass + " flex-1"}
                  >
                    <option value="">{t("fields.selectCategory")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {!categoryId && (
                    <button
                      type="button"
                      onClick={() => setCatModal({ kind: "add-category", type: "transfer" })}
                      className="shrink-0 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title={t("fields.addCategory")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                    </button>
                  )}
                </div>
              </div>
              {(subcategories.length > 0 || categoryId) && (
                <div>
                  <label className="block text-xs font-medium mb-1">{t("fields.subcategory")}</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={subcategoryId}
                      onChange={(e) => setSubcategoryId(e.target.value)}
                      className={inputClass + " flex-1"}
                    >
                      <option value="">{t("fields.none")}</option>
                      {subcategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {categoryId && (
                      <button
                        type="button"
                        onClick={() => {
                          const parent = categories.find((c) => c.id === categoryId);
                          if (parent) setCatModal({ kind: "add-subcategory", type: "transfer", parentId: parent.id, parentName: parent.name });
                        }}
                        className="shrink-0 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title={t("fields.addSubcategory")}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">{t("fields.amount")}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setAmount((a) => normalizeMoneyInputString(a, localeTag))}
                  required
                  placeholder={t("fields.amountPlaceholder")}
                  className={inputClass}
                />
              </div>
              {requiresAccounts && (
                <div>
                  <label className="block text-xs font-medium mb-1">{t("fields.accountTransferFrom")}</label>
                  <select
                    value={accountFromId}
                    onChange={(e) => setAccountFromId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">{t("fields.selectAccount")}</option>
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
                    const fromChanged =
                      isEdit && orig && !orig.holdBalance && orig.accountFromId && orig.accountFromId !== accountFromId;
                    return (
                      <>
                        {fromChanged && (() => {
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
                        {(() => {
                          const acc = accounts.find((a) => a.id === accountFromId);
                          if (!acc) return null;
                          const sameAccount = isEdit && orig && !orig.holdBalance && orig.accountFromId === accountFromId;
                          const afterBalance = sameAccount
                            ? acc.current_balance - (num - orig.amount)
                            : acc.current_balance - num;
                          return (
                            <BalanceHint
                              label={fromChanged ? acc.name : undefined}
                              currentBalance={acc.current_balance}
                              afterBalance={afterBalance}
                            />
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              )}
              {requiresAccounts && (
                <div>
                  <label className="block text-xs font-medium mb-1">{t("fields.accountTransferTo")}</label>
                  <select
                    value={accountToId}
                    onChange={(e) => setAccountToId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">{t("fields.selectAccount")}</option>
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
                    const toChanged =
                      isEdit && orig && !orig.holdBalance && orig.accountToId && orig.accountToId !== accountToId;
                    return (
                      <>
                        {toChanged && (() => {
                          const oldAcc = accounts.find((a) => a.id === orig.accountToId);
                          if (!oldAcc) return null;
                          return (
                            <BalanceHint
                              label={oldAcc.name}
                              currentBalance={oldAcc.current_balance}
                              afterBalance={oldAcc.current_balance - orig.amount}
                            />
                          );
                        })()}
                        {(() => {
                          const acc = accounts.find((a) => a.id === accountToId);
                          if (!acc) return null;
                          const sameAccount = isEdit && orig && !orig.holdBalance && orig.accountToId === accountToId;
                          const afterBalance = sameAccount
                            ? acc.current_balance + (num - orig.amount)
                            : acc.current_balance + num;
                          return (
                            <BalanceHint
                              label={toChanged ? acc.name : undefined}
                              currentBalance={acc.current_balance}
                              afterBalance={afterBalance}
                            />
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              )}
              {isSplitWallet && (
                <div>
                  <label className="block text-xs font-medium mb-2">
                    {walletSharedOption !== null ? t("fields.paidByMemberRequired") : t("fields.paidByMember")}
                  </label>
                  <select
                    value={paidByMemberId ?? ""}
                    onChange={(e) => {
                      memberManuallyChanged.current = true;
                      setPaidByMemberId(e.target.value || null);
                    }}
                    required={isSplitWallet}
                    className={inputClass}
                  >
                    <option value="">Select user</option>
                    {walletMembers.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  {walletMembers.length === 0 && (
                    <div className="text-xs text-slate-500 mt-1">{t("fields.noMembers")}</div>
                  )}
                </div>
              )}
              {isSplitWallet && (
                <div>
                  <label className="block text-xs font-medium mb-2">
                    {walletSharedOption !== null ? t("fields.receivedByMemberRequired") : t("fields.receivedByMember")}
                  </label>
                  <select
                    value={receivedByMemberId ?? ""}
                    onChange={(e) => {
                      memberManuallyChanged.current = true;
                      setReceivedByMemberId(e.target.value || null);
                    }}
                    required={isSplitWallet}
                    className={inputClass}
                  >
                    <option value="">Select user</option>
                    {walletMembers.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  {walletMembers.length === 0 && (
                    <div className="text-xs text-slate-500 mt-1">{t("fields.noMembers")}</div>
                  )}
                </div>
              )}
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
                        <span className="text-xs font-medium">{t("options.saveAsPending")}</span>
                      </label>
                      {saveAsPending && (
                        <label className="flex items-center gap-2 cursor-pointer pl-6 -mt-1">
                          <input
                            type="checkbox"
                            checked={holdBalance}
                            onChange={(e) => setHoldBalance(e.target.checked)}
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {t("options.holdBalance")}
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
                    <span className="text-xs font-medium">{t("options.makeRecurring")}</span>
                  </label>
                  {isRecurring && (
                    <div className="space-y-3 pl-6">
                      <div>
                        <label className="block text-xs font-medium mb-1">{t("options.schedule")}</label>
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
                                {recurrenceOptionLabel(o.value, o.label)}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      {recurrenceType === "interval_days" && (
                        <div>
                          <label className="block text-xs font-medium mb-1">{t("options.intervalDays")}</label>
                          <input
                            type="number"
                            min={1}
                            value={intervalDays}
                            onChange={(e) => setIntervalDays(e.target.value)}
                            placeholder={t("options.intervalDaysPlaceholder")}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                          />
                        </div>
                      )}
                      {recurrenceType === "interval_months" && (
                        <div>
                          <label className="block text-xs font-medium mb-1">{t("options.intervalMonths")}</label>
                          <input
                            type="number"
                            min={1}
                            value={intervalMonths}
                            onChange={(e) => setIntervalMonths(e.target.value)}
                            placeholder={t("options.intervalMonthsPlaceholder")}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                          />
                        </div>
                      )}
                      {(recurrenceType === "monthly_nth_work_day" ||
                        recurrenceType === "monthly_nth_last_work_day") && (
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              {recurrenceType === "monthly_nth_last_work_day"
                                ? t("options.nthLastWorkDay")
                                : t("options.nthWorkDay")}
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={workDayIndex}
                              onChange={(e) => setWorkDayIndex(e.target.value)}
                              placeholder={t("options.workDayPlaceholder")}
                              className="w-full max-w-[120px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                            />
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
            <div className="min-h-0 flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 lg:min-w-0">
              <div className="shrink-0 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 lg:px-4 lg:py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {!categoryId
                    ? t("similar.transfers")
                    : subcategoryId
                      ? t("similar.transfersSubcategory")
                      : t("similar.transfersCategory")}
                </h3>
              </div>
              <div className="p-2 lg:p-3 flex-1 min-h-0 overflow-y-auto min-h-[100px] friendly-scroll">
                {loadingSimilar ? (
                  <p className="text-xs text-slate-500">{t("similar.loading")}</p>
                ) : recentSimilar.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {t("similar.noSimilar")}
                  </p>
                ) : (
                  <div className="w-full min-w-0 text-xs">
                    <div className="flex items-center justify-between gap-6 pb-1.5 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                      <span className="font-medium min-w-0 max-w-[42%] truncate">{t("similar.tableDescription")}</span>
                      <span className="font-medium shrink-0">{t("similar.tableAmount")}</span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                      {recentSimilar.map((r) => (
                        <li key={r.id} className="py-1.5 min-w-0">
                          <div className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 tabular-nums">
                            {r.date}
                          </div>
                          <div className="mt-0.5 flex items-start justify-between gap-4 min-w-0">
                            <div className="min-w-0 max-w-[38%] flex-none text-left sm:max-w-[40%]">
                              <p className="text-slate-700 dark:text-slate-200 break-words hyphens-auto">
                                {r.description || "—"}
                              </p>
                              <p className="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400 break-words">
                                {(r.account_from_name ?? "—") + " → " + (r.account_to_name ?? "—")}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-start gap-2">
                              <span className="tabular-nums text-right text-blue-600 dark:text-blue-400 whitespace-nowrap pt-px">
                                {r.amount.toLocaleString("pt-PT", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                €
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyFromSimilar(r.id)}
                                disabled={!!copyingSimilarId}
                                className="p-1 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200 disabled:opacity-50 transition-colors shrink-0"
                                title={copyingSimilarId === r.id ? t("similar.copying") : t("similar.copy")}
                                aria-label={copyingSimilarId === r.id ? t("similar.copying") : t("similar.copy")}
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
            </div>
          )}
          {!shouldBlockForm && (
            <div className="shrink-0 flex flex-wrap gap-2 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || loadingData}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {t("buttons.cancel")}
            </button>
            {isEdit && status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => setDialog("confirm")}
                  disabled={loading || loadingData}
                  className="px-3 py-1.5 text-xs rounded-lg bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? t("buttons.confirming") : t("buttons.confirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog("cancel")}
                  disabled={loading || loadingData}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-600 dark:border-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  {loading ? t("buttons.cancelling") : t("buttons.cancelPending")}
                </button>
              </>
            )}
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50"
            >
              {loading ? t("buttons.saving") : t("buttons.save")}
            </button>
            </div>
          )}
        </form>
      </div>

      <ConfirmDialog
        open={dialog === "confirm"}
        onClose={() => setDialog(null)}
        onConfirm={handleConfirm}
        title={t("confirmDialogs.confirmTitle")}
        message={t("confirmDialogs.confirmMessage")}
        confirmLabel={t("confirmDialogs.confirmButton")}
        cancelLabel={t("confirmDialogs.goBack")}
        variant="confirm"
        loading={loading}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        onConfirm={handleDelete}
        title={t("confirmDialogs.cancelTitle")}
        message={t("confirmDialogs.cancelMessage")}
        confirmLabel={t("confirmDialogs.cancelButton")}
        cancelLabel={t("confirmDialogs.keepButton")}
        variant="cancel"
        loading={loading}
      />
      {catModal && (
        <CategoryModal
          mode={catModal}
          open={true}
          onClose={() => setCatModal(null)}
          onSaved={(newId) => {
            if (!currentWalletId) return;
            if (catModal.kind === "add-category") {
              Promise.all([
                getCategories(currentWalletId, "transfer"),
                getCategoriesFlatForSearch(currentWalletId, "transfer"),
              ]).then(([cats, flat]) => {
                setCategories(cats);
                setCategoriesFlat(flat);
                if (newId) setCategoryId(newId);
              });
            } else if (catModal.kind === "add-subcategory") {
              Promise.all([
                getSubcategories(categoryId),
                getCategoriesFlatForSearch(currentWalletId, "transfer"),
              ]).then(([subs, flat]) => {
                setSubcategories(subs);
                setCategoriesFlat(flat);
                if (newId) {
                  skipNextSubcategoryReset.current = true;
                  setSubcategoryId(newId);
                }
              });
            }
          }}
        />
      )}
    </div>
  );
}
