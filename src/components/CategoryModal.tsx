"use client";

import { createCategory, updateCategory } from "@/app/actions/categories";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type Mode =
  | { kind: "add-category"; type: "income" | "expense" | "transfer" }
  | { kind: "add-subcategory"; type: "income" | "expense" | "transfer"; parentId: string; parentName: string }
  | { kind: "edit"; categoryId: string };

type Props = {
  mode: Mode;
  open: boolean;
  onClose: () => void;
  /** Called after a successful save. For add operations, `newId` is the created category ID. */
  onSaved: (newId?: string) => void;
};

const SUGGESTED_CATEGORY_KEYS: Record<"income" | "expense" | "transfer", string[]> = {
  income: ["salary", "freelance", "bonus", "interest", "dividends", "gifts"],
  expense: [
    "groceries",
    "rent",
    "utilities",
    "transport",
    "health",
    "entertainment",
    "diningOut",
    "insurance",
    "education",
    "shopping",
    "subscriptions",
    "travel",
    "childcare",
    "petCare",
    "homeMaintenance",
    "taxes",
  ],
  transfer: ["savings", "investments", "emergencyFund", "debtPayment"],
};

export function CategoryModal({ mode, open, onClose, onSaved }: Props) {
  const tCategories = useTranslations("categories.modal");
  const tTransactions = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tForm = useTranslations("transactions.form");
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isEssential, setIsEssential] = useState(false);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editChildCount, setEditChildCount] = useState(0);
  const [editType, setEditType] = useState<"income" | "expense" | "transfer" | null>(null);
  const [parentRootOptions, setParentRootOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRootNames, setExistingRootNames] = useState<Set<string>>(new Set());
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());

  // Load data when editing
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode.kind === "edit") {
      setLoadingData(true);
      const supabase = createClient();
      Promise.all([
        supabase
          .from("categories")
          .select("wallet_id, name, is_active, is_essential, parent_id, type")
          .eq("id", mode.categoryId)
          .single(),
        supabase
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", mode.categoryId),
      ]).then(async ([rowRes, countRes]) => {
        const data = rowRes.data;
        const e = rowRes.error;
        if (e || !data) {
          setLoadingData(false);
          setError(e?.message ?? tCategories("notFound"));
          setParentRootOptions([]);
          setSelectedParentId("");
          return;
        }
        setName(data.name);
        setIsActive(data.is_active);
        setIsEssential(!!(data as { is_essential?: boolean }).is_essential);
        const pid = (data as { parent_id?: string | null }).parent_id ?? null;
        setEditParentId(pid);
        setEditChildCount(countRes.count ?? 0);
        const t = (data as { type?: string }).type;
        const typ = t === "income" || t === "expense" || t === "transfer" ? t : null;
        setEditType(typ);
        const wid = (data as { wallet_id?: string }).wallet_id ?? null;
        if (pid && wid && typ) {
          setSelectedParentId(pid);
          const { data: roots } = await supabase
            .from("categories")
            .select("id, name")
            .eq("wallet_id", wid)
            .eq("type", typ)
            .is("parent_id", null)
            .order("name");
          let list = (roots ?? []) as { id: string; name: string }[];
          if (!list.some((r) => r.id === pid)) {
            const { data: cur } = await supabase.from("categories").select("id, name").eq("id", pid).maybeSingle();
            if (cur) {
              list = [cur as { id: string; name: string }, ...list].sort((a, b) =>
                a.name.localeCompare(b.name)
              );
            }
          }
          setParentRootOptions(list);
        } else {
          setSelectedParentId("");
          setParentRootOptions([]);
        }
        setLoadingData(false);
      });
    } else {
      setName("");
      setIsActive(true);
      setIsEssential(false);
      setEditParentId(null);
      setEditChildCount(0);
      setEditType(null);
      setParentRootOptions([]);
      setSelectedParentId("");
      setSelectedSuggestionKeys(new Set());
    }
  }, [open, mode, tCategories]);

  useEffect(() => {
    let cancelled = false;
    async function loadExistingRoots() {
      if (!open || mode.kind !== "add-category" || !currentWalletId) {
        if (!cancelled) setExistingRootNames(new Set());
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("name")
        .eq("wallet_id", currentWalletId)
        .eq("type", mode.type)
        .is("parent_id", null);
      if (!cancelled) {
        setExistingRootNames(
          new Set((data ?? []).map((c: any) => String(c.name ?? "").trim().toLowerCase()).filter(Boolean))
        );
      }
    }
    void loadExistingRoots();
    return () => {
      cancelled = true;
    };
  }, [open, mode, currentWalletId]);

  // Keyboard & scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);

    let newId: string | undefined;

    if (mode.kind === "edit") {
      const isSub = editParentId != null;
      const isLeafRoot = editParentId == null && editChildCount === 0;
      const expenseEdit = editType === "expense";
      const res = await updateCategory(mode.categoryId, {
        name: name.trim(),
        is_active: isActive,
        ...(expenseEdit && (isSub || isLeafRoot) ? { is_essential: isEssential } : {}),
        ...(isSub && selectedParentId ? { parent_id: selectedParentId } : {}),
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      showToast(tCategories("updatedToast"));
    } else if (mode.kind === "add-category") {
      if (!currentWalletId) return;
      const res = await createCategory({
        wallet_id: currentWalletId,
        name: name.trim(),
        type: mode.type,
        is_essential: mode.type === "expense" ? isEssential : false,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      newId = res.id;
      showToast(tCategories("addedToast"));
    } else {
      // add-subcategory
      if (!currentWalletId) return;
      const res = await createCategory({
        wallet_id: currentWalletId,
        name: name.trim(),
        type: mode.type,
        parent_id: mode.parentId,
        is_essential: mode.type === "expense" ? isEssential : false,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      newId = res.id;
      showToast(tCategories("subAddedToast"));
    }

    onClose();
    onSaved(newId);
  }

  async function handleAddSelectedSuggestions() {
    if (mode.kind !== "add-category" || !currentWalletId) return;
    const selected = filteredSuggestions.filter(
      (s) => selectedSuggestionKeys.has(s.key) && !s.exists
    );
    if (selected.length === 0) return;

    setError(null);
    setLoading(true);
    let added = 0;
    const nextExisting = new Set(existingRootNames);

    for (const s of selected) {
      const res = await createCategory({
        wallet_id: currentWalletId,
        name: s.label.trim(),
        type: mode.type,
      });
      if (res.error) {
        setLoading(false);
        setError(res.error);
        showToast(res.error, "error");
        return;
      }
      added += 1;
      nextExisting.add(s.label.trim().toLowerCase());
    }

    setExistingRootNames(nextExisting);
    setSelectedSuggestionKeys(new Set());
    setLoading(false);
    showToast(tCategories("addedSelectedToast", { count: added }));
    onSaved();
  }

  const title =
    mode.kind === "edit"
      ? tCategories("titleEdit")
      : mode.kind === "add-subcategory"
        ? tCategories("titleAddSubcategory", { parentName: mode.parentName })
        : tCategories("titleAddType", {
          type:
            mode.type === "income"
              ? tTransactions("income")
              : mode.type === "expense"
                ? tTransactions("expense")
                : tTransactions("transfer"),
        });

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm";
  const filteredSuggestions = useMemo(() => {
    if (mode.kind !== "add-category") return [];
    const rows = SUGGESTED_CATEGORY_KEYS[mode.type].map((key) => {
      const label = tCategories(`suggestions.${mode.type}.${key}`);
      return {
        key,
        label,
        exists: existingRootNames.has(label.trim().toLowerCase()),
      };
    });
    return rows
      .filter((s) => !name.trim() || s.label.toLowerCase().includes(name.trim().toLowerCase()))
      .sort((a, b) => Number(a.exists) - Number(b.exists) || a.label.localeCompare(b.label));
  }, [mode, tCategories, existingRootNames, name]);

  const expenseContext =
    mode.kind === "edit"
      ? editType === "expense"
      : (mode.kind === "add-category" || mode.kind === "add-subcategory") && mode.type === "expense";

  const showEssentialCheckbox =
    expenseContext &&
    (mode.kind === "add-category" ||
      mode.kind === "add-subcategory" ||
      (mode.kind === "edit" && (editParentId != null || editChildCount === 0)));

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current && !loading) onClose();
      }}
    >
      <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={tCommon("close")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold mb-4">{title}</h2>

        {loadingData ? (
          <p className="text-slate-500 text-sm">{tCommon("loading")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode.kind === "add-category" && (
              <>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="mb-2">
                    <p className="text-sm font-medium">{tCategories("suggestedTitle")}</p>
                    <p className="text-xs text-slate-500">{tCategories("suggestedSubtitle")}</p>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredSuggestions.map((s) => (
                          <tr key={s.key}>
                            <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{s.label}</td>
                            <td className="px-2 py-1.5 text-right">
                              {s.exists ? (
                                <span className="text-slate-400">{tCategories("alreadyExists")}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSuggestionKeys((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(s.key)) next.delete(s.key);
                                      else next.add(s.key);
                                      return next;
                                    })
                                  }
                                  className={`rounded-md border px-2 py-0.5 ${
                                    selectedSuggestionKeys.has(s.key)
                                      ? "border-slate-700 bg-slate-100 dark:border-slate-500 dark:bg-slate-800"
                                      : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  {tCategories("useSuggestion")}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddSelectedSuggestions}
                      disabled={loading || filteredSuggestions.every((s) => !selectedSuggestionKeys.has(s.key) || s.exists)}
                      className="rounded-lg bg-slate-800 text-white px-3 py-1.5 text-xs hover:bg-slate-700 disabled:opacity-50"
                    >
                      {tCategories("addSelectedSuggestions")}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700" />

                <div>
                  <p className="text-sm font-medium mb-1">{tCategories("createNewTitle")}</p>
                  <label className="block text-sm font-medium mb-1">{tCategories("nameLabel")}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
              </>
            )}
            {mode.kind !== "add-category" && (
              <div>
                <label className="block text-sm font-medium mb-1">{tCategories("nameLabel")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>
            )}
            {mode.kind === "edit" && editParentId && parentRootOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="catMoveParent">
                  {tCategories("parentCategoryEditLabel")}
                </label>
                <select
                  id="catMoveParent"
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  required
                  className={inputClass}
                >
                  {parentRootOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">{tCategories("moveSubcategoryHint")}</p>
              </div>
            )}
            {showEssentialCheckbox && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="catEssential"
                  checked={isEssential}
                  onChange={(e) => setIsEssential(e.target.checked)}
                />
                <label htmlFor="catEssential" className="text-sm">
                  {tCategories("essentialLabel")}
                </label>
              </div>
            )}
            {mode.kind === "edit" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label htmlFor="catIsActive" className="text-sm">
                  {tCategories("activeLabel")}
                </label>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                {loading ? tForm("buttons.saving") : tCommon("save")}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
              >
                {tCommon("cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
