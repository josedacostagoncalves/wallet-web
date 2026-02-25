"use client";

import { createCategory, updateCategory } from "@/app/actions/categories";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data when editing
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode.kind === "edit") {
      setLoadingData(true);
      const supabase = createClient();
      supabase
        .from("categories")
        .select("name, is_active")
        .eq("id", mode.categoryId)
        .single()
        .then(({ data, error: e }) => {
          setLoadingData(false);
          if (e || !data) {
            setError(e?.message ?? tCategories("notFound"));
            return;
          }
          setName(data.name);
          setIsActive(data.is_active);
        });
    } else {
      setName("");
      setIsActive(true);
    }
  }, [open, mode, tCategories]);

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
      const res = await updateCategory(mode.categoryId, {
        name: name.trim(),
        is_active: isActive,
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

  if (!open) return null;

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
