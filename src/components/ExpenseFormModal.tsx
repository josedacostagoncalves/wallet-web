"use client";

import {
  getAccounts,
  getCategories,
  getSubcategories,
  getTransaction,
  getRecentTransactionsByType,
  getRecentTransactionsByCategory,
  createTransaction,
  updateTransaction,
  confirmTransaction,
  deleteTransaction,
} from "@/app/actions/transactions";
import { getWalletSplitInfo, getCurrentUserId } from "@/app/actions/wallets";
import { getCategory } from "@/app/actions/categories";
import { BalanceHint } from "@/components/BalanceHint";
import { CategoryModal } from "@/components/CategoryModal";
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
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TransactionModalMode } from "@/contexts/TransactionModalsContext";
import { useTranslations } from "next-intl";

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

const clampPct = (v: number) => Math.min(100, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const formatPctInput = (v: number) => {
  const fixed = round2(v).toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed.endsWith("0") ? fixed.slice(0, -1) : fixed;
};

export function ExpenseFormModal({
  open,
  onClose,
  mode = "new",
  transactionId,
  copyFromTransactionId,
  copyFromRecurringId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("transactions.form");
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
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null);
  const [walletSharedOption, setWalletSharedOption] = useState<string | null>(null);
  const [walletSplitType, setWalletSplitType] = useState<string | null>(null);
  const [walletTrackingMode, setWalletTrackingMode] = useState<string | null>(null);
  const [splitMethod, setSplitMethod] = useState<"equally" | "by_income" | "manual">("equally");
  const [manualSplits, setManualSplits] = useState<Array<{ member_id: string; percentage: string }>>([]);
  const [walletMembers, setWalletMembers] = useState<
    {
      id: string;
      user_id: string;
      display_name: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      current_month_income?: number;
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
  const [recentSimilar, setRecentSimilar] = useState<
    { id: string; date: string; description: string | null; amount: number }[]
  >([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [copyingSimilarId, setCopyingSimilarId] = useState<string | null>(null);
  const [catModal, setCatModal] = useState<
    | { kind: "add-category"; type: "income" | "expense" | "transfer" }
    | { kind: "add-subcategory"; type: "income" | "expense" | "transfer"; parentId: string; parentName: string }
    | null
  >(null);
  const skipNextSubcategoryReset = useRef(false);
  const editOriginal = useRef<{ amount: number; accountFromId: string; holdBalance: boolean } | null>(null);
  const autoSelectedMember = useRef(false);
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
      return;
    }
    getAccounts(currentWalletId).then(setAccounts);
    getCategories(currentWalletId, "expense").then(setCategories);
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
          holdBalance: m.hold_balance,
        };
        const parentId = m.parent_id ?? null;
        const catId = parentId || m.category_id;
        const subId = parentId ? m.category_id : "";
        setDate(m.date);
        setAmount(String(m.amount));
        setDescription(m.description ?? "");
        setAccountFromId(m.account_from_id ?? "");
        setPaidByMemberId(m.paid_by_member_id ?? null);
        if (
          m.split_method_override === "equally" ||
          m.split_method_override === "by_income" ||
          m.split_method_override === "manual"
        ) {
          setSplitMethod(m.split_method_override);
        }
        if (Array.isArray(m.manual_splits)) {
          setManualSplits(
            m.manual_splits.map((s: { member_id: string; percentage: number }) => ({
              member_id: s.member_id,
              percentage: String(s.percentage),
            }))
          );
        }
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
        setAmount(String(m.amount));
        setDescription(m.description ?? "");
        setAccountFromId(m.account_from_id ?? "");
        setPaidByMemberId(m.paid_by_member_id ?? null);
        if (
          m.split_method_override === "equally" ||
          m.split_method_override === "by_income" ||
          m.split_method_override === "manual"
        ) {
          setSplitMethod(m.split_method_override);
        }
        if (Array.isArray(m.manual_splits)) {
          setManualSplits(
            m.manual_splits.map((s: { member_id: string; percentage: number }) => ({
              member_id: s.member_id,
              percentage: String(s.percentage),
            }))
          );
        }
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
        const subs = await getSubcategories(catId);
        setSubcategories(subs);
        setLoadingData(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [open, currentWalletId, isEdit, isCopy, transactionId, copyFromTransactionId, copyFromRecurringId]);

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
      getRecentTransactionsByType(currentWalletId, "expense", 20)
        .then(setRecentSimilar)
        .finally(() => setLoadingSimilar(false));
    } else {
      getRecentTransactionsByCategory(
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
    const m = await getTransaction(id);
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
    setPaidByMemberId(null);
    setSplitMethod("equally");
    setManualSplits([]);
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

    // Fetch wallet split info and auto-select member AFTER form reset
    if (currentWalletId) {
      getWalletSplitInfo(currentWalletId).then((result) => {
        const sharedOption = result.shared_option ?? null;
        const members = result.members ?? [];
        setWalletSharedOption(sharedOption);
        setWalletSplitType(result.split_type ?? null);
        setWalletTrackingMode(result.tracking_mode ?? null);
        const defaultSplitMethod =
          result.default_split_method === "by_income" || result.default_split_method === "manual"
            ? result.default_split_method
            : "equally";
        if (!isEdit) setSplitMethod(defaultSplitMethod);
        setWalletMembers(members);

        // Auto-select current user only for brand-new transactions.
        if (
          !isEdit &&
          !isCopy &&
          !autoSelectedMember.current &&
          (sharedOption === "split" || sharedOption === "track_and_split") &&
          members.length > 0
        ) {
          autoSelectedMember.current = true;
          getCurrentUserId().then((userResult) => {
            if (userResult.userId) {
              // Find the member that matches the current user
              const currentMember = members.find((m) => m.user_id === userResult.userId);
              if (currentMember) {
                setPaidByMemberId((prev) => prev ?? currentMember.id);
              }
            }
          });
        }
      });
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
  }, [open, currentWalletId, onClose, loading, loadingData, resetForm, mode, transactionId, copyFromTransactionId, copyFromRecurringId]);

  const isSplitOnly = walletSharedOption === "split" || (!walletSharedOption && !!walletSplitType);
  const isBasicTracking = walletTrackingMode === "basic" || (!walletTrackingMode && isSplitOnly);
  const requiresAccounts = !isBasicTracking;
  const isSplitWallet = walletSharedOption === "track_and_split" || isSplitOnly;
  const effectiveSplitMethod = isSplitWallet ? splitMethod : "equally";
  const expenseAmount = parseFloat(amount.replace(",", ".")) || 0;

  useEffect(() => {
    if (!isSplitWallet) return;
    if (!manualSplits.length && walletMembers.length > 0) {
      const equalShare = (100 / walletMembers.length).toFixed(2);
      setManualSplits(walletMembers.map((m) => ({ member_id: m.user_id, percentage: equalShare })));
      return;
    }
    const memberIds = new Set(walletMembers.map((m) => m.user_id));
    setManualSplits((prev) => {
      const byId = new Map(prev.map((s) => [s.member_id, s.percentage]));
      return walletMembers
        .filter((m) => memberIds.has(m.user_id))
        .map((m) => ({ member_id: m.user_id, percentage: byId.get(m.user_id) ?? "0" }));
    });
  }, [isSplitWallet, walletMembers, manualSplits.length]);

  const rebalanceManualSplit = useCallback((memberId: string, rawValue: string) => {
    setManualSplits((prev) => {
      const ordered = walletMembers.map((m) => {
        const current = prev.find((s) => s.member_id === m.user_id)?.percentage ?? "0";
        return { member_id: m.user_id, percentage: current };
      });
      if (ordered.length === 0) return prev;
      if (ordered.length === 1) return [{ member_id: ordered[0].member_id, percentage: "100" }];

      const parsed = Number.parseFloat(String(rawValue).replace(",", "."));
      const edited = round2(clampPct(Number.isFinite(parsed) ? parsed : 0));
      const others = ordered.filter((s) => s.member_id !== memberId);
      const targetOthers = round2(100 - edited);

      const existingOthers = others.map((s) => round2(clampPct(Number.parseFloat(s.percentage.replace(",", ".")) || 0)));
      const sumExistingOthers = existingOthers.reduce((sum, v) => sum + v, 0);
      let nextOthers: number[] = [];
      if (sumExistingOthers <= 0) {
        const equal = targetOthers / others.length;
        nextOthers = others.map(() => round2(equal));
      } else {
        nextOthers = existingOthers.map((v) => round2((v / sumExistingOthers) * targetOthers));
      }
      const diff = round2(targetOthers - nextOthers.reduce((sum, v) => sum + v, 0));
      if (nextOthers.length > 0) {
        const last = nextOthers.length - 1;
        nextOthers[last] = round2(clampPct(nextOthers[last] + diff));
      }

      const otherById = new Map(others.map((o, idx) => [o.member_id, nextOthers[idx] ?? 0]));
      return ordered.map((s) =>
        s.member_id === memberId
          ? { ...s, percentage: formatPctInput(edited) }
          : { ...s, percentage: formatPctInput(otherById.get(s.member_id) ?? 0) }
      );
    });
  }, [walletMembers]);

  const splitPreviewRows = useMemo(() => {
    if (!isSplitWallet || walletMembers.length === 0) return [];

    const normalizedPercentages = (weights: number[]) => {
      if (!weights.length) return [];
      const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
      const total = safeWeights.reduce((sum, w) => sum + w, 0);
      const base = total > 0 ? safeWeights : safeWeights.map(() => 1);
      const denom = base.reduce((sum, w) => sum + w, 0) || 1;
      const p = base.map((w) => round2((w / denom) * 100));
      const diff = round2(100 - p.reduce((sum, x) => sum + x, 0));
      if (p.length > 0) p[p.length - 1] = round2(p[p.length - 1] + diff);
      return p.map((x) => clampPct(x));
    };

    let pcts: number[] = [];
    if (effectiveSplitMethod === "equally") {
      pcts = normalizedPercentages(walletMembers.map(() => 1));
    } else if (effectiveSplitMethod === "by_income") {
      pcts = normalizedPercentages(walletMembers.map((m) => Number(m.current_month_income ?? 0)));
    } else {
      const byId = new Map(manualSplits.map((s) => [s.member_id, Number.parseFloat(s.percentage.replace(",", ".")) || 0]));
      pcts = walletMembers.map((m) => round2(clampPct(byId.get(m.user_id) ?? 0)));
    }

    return walletMembers.map((m, idx) => {
      const pct = pcts[idx] ?? 0;
      const value = round2((Math.max(0, expenseAmount) * pct) / 100);
      return { memberId: m.user_id, name: m.display_name, percentage: pct, value };
    });
  }, [isSplitWallet, walletMembers, effectiveSplitMethod, manualSplits, expenseAmount]);

  function validate(): string | null {
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) return t("validation.amountPositive");
    const catId = subcategoryId || categoryId;
    if (!catId) return t("validation.categoryRequired");
    if (subcategories.length > 0 && !subcategoryId) return t("validation.subcategoryRequired");
    if (!description.trim()) return t("validation.descriptionRequired");

    // Account required for 'track' and 'track_and_split' wallets, not for 'split'
    if (requiresAccounts && !accountFromId) return t("validation.accountFromRequired");

    // Member required for 'split' and 'track_and_split' wallets
    if (isSplitWallet && !paidByMemberId) return t("validation.memberPaidRequired");
    if (isSplitWallet && effectiveSplitMethod === "manual") {
      const total = manualSplits.reduce((sum, s) => sum + (parseFloat(s.percentage.replace(",", ".")) || 0), 0);
      if (Math.abs(total - 100) > 0.01) return t("validation.manualSplitTotal");
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
        paid_by_member_id: paidByMemberId,
        received_by_member_id: null,
        split_method_override: isSplitWallet ? effectiveSplitMethod : null,
        manual_splits:
          isSplitWallet && effectiveSplitMethod === "manual"
            ? manualSplits.map((s) => ({
              member_id: s.member_id,
              percentage: parseFloat(s.percentage.replace(",", ".")) || 0,
            }))
            : [],
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
      paid_by_member_id: paidByMemberId,
      received_by_member_id: null,
      split_method_override: isSplitWallet ? effectiveSplitMethod : null,
      manual_splits:
        isSplitWallet && effectiveSplitMethod === "manual"
          ? manualSplits.map((s) => ({
            member_id: s.member_id,
            percentage: parseFloat(s.percentage.replace(",", ".")) || 0,
          }))
          : [],
      status: saveAsPending ? "pending" : "confirmed",
      hold_balance: saveAsPending ? holdBalance : false,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
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
      type: "expense",
      category_id: catId,
      date,
      amount: num,
      account_from_id: accountFromId,
      account_to_id: null,
      description: description.trim(),
      is_recurring: false,
      paid_by_member_id: paidByMemberId,
      received_by_member_id: null,
      split_method_override: isSplitWallet ? effectiveSplitMethod : null,
      manual_splits:
        isSplitWallet && effectiveSplitMethod === "manual"
          ? manualSplits.map((s) => ({
            member_id: s.member_id,
            percentage: parseFloat(s.percentage.replace(",", ".")) || 0,
          }))
          : [],
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
      aria-labelledby="expense-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={() => !loading && !loadingData && onClose()}
      />
      <div
        className="relative w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          <h2 id="expense-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {isEdit
              ? status === "pending"
                ? t("editPendingExpense")
                : t("editExpense")
              : t("newExpense")}
          </h2>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col min-h-0 flex-1 overflow-y-auto"
        >
          {shouldBlockForm ? (
            <div className="min-h-[360px] flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="p-3 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
            <div className="w-full sm:min-w-0 sm:w-1/2 space-y-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">{t("fields.date")}</label>
                <input
                  type="date"
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
                  placeholder={t("fields.descriptionPlaceholder")}
                  className={inputClass}
                />
              </div>
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
                      onClick={() => setCatModal({ kind: "add-category", type: "expense" })}
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
                  <label className="block text-xs font-medium mb-1">
                    {subcategories.length > 0 ? t("fields.subcategoryRequired") : t("fields.subcategory")}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={subcategoryId}
                      onChange={(e) => setSubcategoryId(e.target.value)}
                      required={subcategories.length > 0}
                      className={inputClass + " flex-1"}
                    >
                      <option value="">{subcategories.length > 0 ? t("fields.selectSubcategory") : t("fields.none")}</option>
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
                          if (parent) setCatModal({ kind: "add-subcategory", type: "expense", parentId: parent.id, parentName: parent.name });
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
                  required
                  placeholder={t("fields.amountPlaceholder")}
                  className={inputClass}
                />
              </div>
              {requiresAccounts && (
                <div>
                  <label className="block text-xs font-medium mb-1">{t("fields.accountFrom")}</label>
                  <select
                    value={accountFromId}
                    onChange={(e) => setAccountFromId(e.target.value)}
                    required={requiresAccounts}
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
              )}
              {isSplitWallet && (
                <div>
                  <label className="block text-xs font-medium mb-2">
                    {walletSharedOption !== null ? t("fields.paidByMemberRequired") : t("fields.paidByMember")}
                  </label>
                  <select
                    value={paidByMemberId ?? ""}
                    onChange={(e) => setPaidByMemberId(e.target.value || null)}
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
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
                  <label className="block text-xs font-medium">{t("fields.splitMethod")}</label>
                  <select
                    value={splitMethod}
                    onChange={(e) => setSplitMethod(e.target.value as "equally" | "by_income" | "manual")}
                    className={inputClass}
                  >
                    <option value="equally">
                      {t("fields.splitMethodEqually")}
                    </option>
                    <option value="by_income">
                      {t("fields.splitMethodByIncome")}
                    </option>
                    <option value="manual">
                      {t("fields.splitMethodManual")}
                    </option>
                  </select>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">
                            {t("fields.paidByMember")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium text-slate-600 dark:text-slate-300 w-28">
                            %
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium text-slate-600 dark:text-slate-300 w-28">
                            {t("fields.splitValue")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {splitPreviewRows.map((r) => {
                          const current = manualSplits.find((s) => s.member_id === r.memberId)?.percentage ?? "0";
                          return (
                            <tr key={r.memberId}>
                              <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{r.name}</td>
                              <td className="px-2 py-1.5 text-right">
                                {effectiveSplitMethod === "manual" ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      value={current}
                                      onChange={(e) => rebalanceManualSplit(r.memberId, e.target.value)}
                                      className="w-20 text-right text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                                    />
                                    <span className="text-slate-500">%</span>
                                  </div>
                                ) : (
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {r.percentage.toFixed(2)}%
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                                {r.value.toLocaleString("pt-PT", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                €
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
            <div className="w-full sm:min-w-0 sm:w-1/2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
              <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {!categoryId
                    ? t("similar.expenses")
                    : subcategoryId
                      ? t("similar.expensesSubcategory")
                      : t("similar.expensesCategory")}
                </h3>
              </div>
              <div className="p-3 min-h-[120px] max-h-[360px] overflow-y-auto">
                {loadingSimilar ? (
                  <p className="text-xs text-slate-500">{t("similar.loading")}</p>
                ) : recentSimilar.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {!categoryId ? t("similar.noExpenses") : t("similar.noSimilar")}
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-3 font-medium">{t("similar.tableDate")}</th>
                        <th className="pb-2 pr-3 font-medium min-w-0">{t("similar.tableDescription")}</th>
                        <th className="pb-2 pr-3 font-medium text-right">{t("similar.tableAmount")}</th>
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
                              title={copyingSimilarId === r.id ? t("similar.copying") : t("similar.copy")}
                              aria-label={copyingSimilarId === r.id ? t("similar.copying") : t("similar.copy")}
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
      </div >

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
      {
        catModal && (
          <CategoryModal
            mode={catModal}
            open={true}
            onClose={() => setCatModal(null)}
            onSaved={(newId) => {
              if (!currentWalletId) return;
              if (catModal.kind === "add-category") {
                getCategories(currentWalletId, "expense").then((cats) => {
                  setCategories(cats);
                  if (newId) setCategoryId(newId);
                });
              } else if (catModal.kind === "add-subcategory") {
                getSubcategories(categoryId).then((subs) => {
                  setSubcategories(subs);
                  if (newId) {
                    skipNextSubcategoryReset.current = true;
                    setSubcategoryId(newId);
                  }
                });
              }
            }}
          />
        )
      }
    </div >
  );
}
