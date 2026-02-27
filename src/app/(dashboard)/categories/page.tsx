"use client";

import {
  copyCategoriesToWallet,
  deleteCategory,
  getCategoryUsage,
  getCopyableCategories,
  type CopyableCategoryGroup,
} from "@/app/actions/categories";
import { DeleteIcon, EditIcon } from "@/components/ActionIcons";
import { CategoryModal } from "@/components/CategoryModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Cat = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  is_active: boolean;
  children: Cat[];
};

type ModalMode =
  | { kind: "add-category"; type: "income" | "expense" | "transfer" }
  | { kind: "add-subcategory"; type: "income" | "expense" | "transfer"; parentId: string; parentName: string }
  | { kind: "edit"; categoryId: string }
  | null;

type CopyDialogState = {
  type: "income" | "expense" | "transfer";
  loading: boolean;
  groups: CopyableCategoryGroup[];
  sourceWalletId: string;
  selectedRootIds: string[];
  copying: boolean;
} | null;

/* ─── Icons ─── */

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${expanded ? "rotate-90" : ""}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const TYPE_COLORS: Record<string, string> = {
  income: "text-green-700 dark:text-green-400",
  expense: "text-red-700 dark:text-red-400",
  transfer: "text-blue-700 dark:text-blue-400",
};

/* ─── Helpers ─── */

function buildDeleteMessage(t: { name: string; childCount: number; transactionCount: number }): string {
  const parts: string[] = [];

  // What will be affected
  if (t.childCount > 0) {
    parts.push(`"${t.name}" and its ${t.childCount} subcategor${t.childCount === 1 ? "y" : "ies"}`);
  } else {
    parts.push(`"${t.name}"`);
  }

  // Transaction info
  if (t.transactionCount > 0) {
    const txLabel = t.transactionCount === 1 ? "1 transaction uses" : `${t.transactionCount} transactions use`;
    return `${txLabel} ${parts[0]}. It will be deactivated instead of deleted so confirmed transactions maintain their data.`;
  }

  return `Delete ${parts[0]}? This cannot be undone.`;
}

/* ─── Main Page ─── */

export default function CategoriesPage() {
  const tCategories = useTranslations("categories.modal");
  const tCategoriesPage = useTranslations("categories");
  const tTransactions = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const { currentWalletId } = useWallet();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  // Collapsed state
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Modal
  const [modal, setModal] = useState<ModalMode>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    childCount: number;
    transactionCount: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [copyDialog, setCopyDialog] = useState<CopyDialogState>(null);

  const loadCategories = useCallback(() => {
    if (!currentWalletId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name, type, parent_id, is_active")
      .eq("wallet_id", currentWalletId)
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as Cat[];
        const byParent: Record<string, Cat[]> = {};
        const roots: Cat[] = [];
        for (const c of list) {
          c.children = [];
          if (c.parent_id) {
            byParent[c.parent_id] = byParent[c.parent_id] ?? [];
            byParent[c.parent_id].push(c);
          } else {
            roots.push(c);
          }
        }
        const sortActiveFirst = (a: Cat, b: Cat) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          return a.name.localeCompare(b.name);
        };
        for (const r of roots) {
          r.children = (byParent[r.id] ?? []).sort(sortActiveFirst);
        }
        roots.sort(sortActiveFirst);
        setCategories(roots);
        setLoading(false);
      });
  }, [currentWalletId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function toggleType(type: string) {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteClick(cat: { id: string; name: string; childCount: number }) {
    setLoadingUsage(true);
    const usage = await getCategoryUsage(cat.id);
    setLoadingUsage(false);
    setDeleteTarget({
      ...cat,
      childCount: usage.childCount,
      transactionCount: usage.transactionCount,
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteCategory(deleteTarget.id);
    setDeleting(false);
    if (res.error) {
      showToast(res.error, "error");
    } else if (res.deactivated) {
      showToast(tCategories("deactivatedToast"));
      loadCategories();
    } else {
      showToast(tCategories("deletedToast"));
      loadCategories();
    }
    setDeleteTarget(null);
  }

  async function openCopyDialog(type: "income" | "expense" | "transfer") {
    if (!currentWalletId) return;
    setCopyDialog({ type, loading: true, groups: [], sourceWalletId: "", selectedRootIds: [], copying: false });
    const res = await getCopyableCategories(currentWalletId, type);
    if (res.error) {
      showToast(res.error, "error");
      setCopyDialog(null);
      return;
    }
    const groups = res.groups ?? [];
    setCopyDialog({
      type,
      loading: false,
      groups,
      sourceWalletId: groups[0]?.wallet_id ?? "",
      selectedRootIds: [],
      copying: false,
    });
  }

  async function handleCopyConfirm() {
    if (!copyDialog || !currentWalletId || !copyDialog.sourceWalletId || copyDialog.selectedRootIds.length === 0) return;
    setCopyDialog({ ...copyDialog, copying: true });
    const res = await copyCategoriesToWallet({
      target_wallet_id: currentWalletId,
      source_wallet_id: copyDialog.sourceWalletId,
      type: copyDialog.type,
      root_category_ids: copyDialog.selectedRootIds,
    });
    if (res.error) {
      setCopyDialog({ ...copyDialog, copying: false });
      showToast(res.error, "error");
      return;
    }
    setCopyDialog(null);
    showToast(tCategories("addedToast"));
    loadCategories();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{tCategoriesPage("title")}</h1>
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{tCategoriesPage("title")}</h1>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          {tCategories("noWallet")}
        </p>
      ) : (
        <div className="space-y-4">
          {(["income", "expense", "transfer"] as const).map((type) => {
            const forType = categories.filter((c) => c.type === type);
            const isTypeExpanded = expandedTypes.has(type);

            return (
              <div
                key={type}
                className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Type header — click to expand/collapse */}
                <button
                  onClick={() => toggleType(type)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className={`text-lg font-medium ${TYPE_COLORS[type]}`}>
                    {type === "income" ? tTransactions("income") : type === "expense" ? tTransactions("expense") : tTransactions("transfer")}
                    <span className="ml-2 text-slate-400 font-normal text-sm">
                      ({forType.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <ChevronIcon expanded={isTypeExpanded} />
                  </div>
                </button>

                {isTypeExpanded && (
                  <div>
                    {/* Add category button */}
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ kind: "add-category", type });
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          {tCategoriesPage("addCategory")}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCopyDialog(type);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                        >
                          {tCategoriesPage("page.copyFromWallet")}
                        </button>
                      </div>
                    </div>

                    {forType.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        {tCategoriesPage("noCategories")}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {forType.map((cat) => {
                          const isCatExpanded = expandedCategories.has(cat.id);
                          const hasSubs = cat.children.length > 0;

                          return (
                            <div key={cat.id}>
                              {/* Category row */}
                              <div
                                className={`flex items-center justify-between px-4 py-2.5 ${!cat.is_active ? "opacity-50" : ""
                                  } ${hasSubs ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30" : ""}`}
                                onClick={() => hasSubs && toggleCategory(cat.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {hasSubs && (
                                    <ChevronIcon expanded={isCatExpanded} />
                                  )}
                                  <span className="text-sm font-medium">
                                    {cat.name}
                                  </span>
                                  {!cat.is_active && (
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({tCategoriesPage("page.inactive")})
                                    </span>
                                  )}
                                  {hasSubs && (
                                    <span className="text-[10px] text-slate-400">
                                      ({cat.children.length})
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() =>
                                      setModal({
                                        kind: "add-subcategory",
                                        type,
                                        parentId: cat.id,
                                        parentName: cat.name,
                                      })
                                    }
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    title={tCommon("add")}
                                  >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setModal({ kind: "edit", categoryId: cat.id })
                                    }
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    title={tCommon("edit")}
                                  >
                                    <EditIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteClick({
                                        id: cat.id,
                                        name: cat.name,
                                        childCount: cat.children.length,
                                      })
                                    }
                                    disabled={loadingUsage}
                                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                    title={tCommon("delete")}
                                  >
                                    <DeleteIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Subcategories */}
                              {isCatExpanded && hasSubs && (
                                <div className="bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-700/50">
                                  {cat.children.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className={`flex items-center justify-between px-4 pl-10 py-2 ${!sub.is_active ? "opacity-50" : ""
                                        }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">
                                          {sub.name}
                                        </span>
                                        {!sub.is_active && (
                                          <span className="text-[10px] text-slate-400">
                                            ({tCategoriesPage("page.inactive")})
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() =>
                                            setModal({
                                              kind: "edit",
                                              categoryId: sub.id,
                                            })
                                          }
                                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                          title={tCommon("edit")}
                                        >
                                          <EditIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeleteClick({
                                              id: sub.id,
                                              name: sub.name,
                                              childCount: 0,
                                            })
                                          }
                                          disabled={loadingUsage}
                                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                          title={tCommon("delete")}
                                        >
                                          <DeleteIcon className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Category modal (add/edit) */}
      {modal && (
        <CategoryModal
          mode={modal}
          open={true}
          onClose={() => setModal(null)}
          onSaved={loadCategories}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={tCommon("delete")}
        message={
          deleteTarget
            ? buildDeleteMessage(deleteTarget)
            : ""
        }
        confirmLabel={deleteTarget && deleteTarget.transactionCount > 0 ? tCategoriesPage("page.deactivate") : tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        variant="cancel"
        loading={deleting}
      />

      {copyDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold">{tCategoriesPage("page.copyTitle")}</h3>
            {copyDialog.loading ? (
              <p className="text-sm text-slate-500">{tCommon("loading")}</p>
            ) : copyDialog.groups.length === 0 ? (
              <p className="text-sm text-slate-500">{tCategoriesPage("page.noCopySources")}</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">{tCategoriesPage("page.sourceWallet")}</label>
                  <select
                    value={copyDialog.sourceWalletId}
                    onChange={(e) =>
                      setCopyDialog({
                        ...copyDialog,
                        sourceWalletId: e.target.value,
                        selectedRootIds: [],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800"
                  >
                    {copyDialog.groups.map((g) => (
                      <option key={g.wallet_id} value={g.wallet_id}>
                        {g.wallet_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                  {(copyDialog.groups.find((g) => g.wallet_id === copyDialog.sourceWalletId)?.categories ?? []).map((c) => (
                    <label key={c.id} className="block text-sm">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={copyDialog.selectedRootIds.includes(c.id)}
                          onChange={(e) =>
                            setCopyDialog({
                              ...copyDialog,
                              selectedRootIds: e.target.checked
                                ? [...copyDialog.selectedRootIds, c.id]
                                : copyDialog.selectedRootIds.filter((id) => id !== c.id),
                            })
                          }
                        />
                        <div>
                          <div className="font-medium">{c.name}</div>
                          {c.children.length > 0 && (
                            <div className="text-xs text-slate-500">
                              {c.children.map((ch) => ch.name).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCopyDialog(null)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={handleCopyConfirm}
                disabled={
                  copyDialog.loading ||
                  copyDialog.copying ||
                  !copyDialog.sourceWalletId ||
                  copyDialog.selectedRootIds.length === 0
                }
                className="px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                {copyDialog.copying ? tCommon("loading") : tCategoriesPage("page.copySelected")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
