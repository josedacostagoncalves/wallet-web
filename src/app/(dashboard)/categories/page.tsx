"use client";

import { deleteCategory, getCategoryUsage } from "@/app/actions/categories";
import { DeleteIcon, EditIcon } from "@/components/ActionIcons";
import { CategoryModal } from "@/components/CategoryModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

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

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

const TYPE_COLORS: Record<string, string> = {
  income: "text-green-700 dark:text-green-400",
  expense: "text-red-700 dark:text-red-400",
  transfer: "text-blue-700 dark:text-blue-400",
};

/* ─── Helpers ─── */

function buildDeleteMessage(t: { name: string; childCount: number; movementCount: number }): string {
  const parts: string[] = [];

  // What will be affected
  if (t.childCount > 0) {
    parts.push(`"${t.name}" and its ${t.childCount} subcategor${t.childCount === 1 ? "y" : "ies"}`);
  } else {
    parts.push(`"${t.name}"`);
  }

  // Movement info
  if (t.movementCount > 0) {
    const mvLabel = t.movementCount === 1 ? "1 movement uses" : `${t.movementCount} movements use`;
    return `${mvLabel} ${parts[0]}. It will be deactivated instead of deleted so confirmed movements maintain their data.`;
  }

  return `Delete ${parts[0]}? This cannot be undone.`;
}

/* ─── Main Page ─── */

export default function CategoriesPage() {
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
    movementCount: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);

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
      movementCount: usage.movementCount,
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
      showToast("Category deactivated (movements preserved).");
      loadCategories();
    } else {
      showToast("Category deleted.");
      loadCategories();
    }
    setDeleteTarget(null);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>

      {!currentWalletId ? (
        <p className="text-slate-600 dark:text-slate-400">
          Select or create a wallet first.
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
                    {TYPE_LABELS[type]}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ kind: "add-category", type });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Add category
                      </button>
                    </div>

                    {forType.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        No categories yet.
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
                                className={`flex items-center justify-between px-4 py-2.5 ${
                                  !cat.is_active ? "opacity-50" : ""
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
                                      (inactive)
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
                                    title="Add subcategory"
                                  >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setModal({ kind: "edit", categoryId: cat.id })
                                    }
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    title="Edit"
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
                                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                    title="Delete"
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
                                      className={`flex items-center justify-between px-4 pl-10 py-2 ${
                                        !sub.is_active ? "opacity-50" : ""
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">
                                          {sub.name}
                                        </span>
                                        {!sub.is_active && (
                                          <span className="text-[10px] text-slate-400">
                                            (inactive)
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
                                          title="Edit"
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
                                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                          title="Delete"
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
        title="Delete category"
        message={
          deleteTarget
            ? buildDeleteMessage(deleteTarget)
            : ""
        }
        confirmLabel={deleteTarget && deleteTarget.movementCount > 0 ? "Deactivate" : "Delete"}
        cancelLabel="Cancel"
        variant="cancel"
        loading={deleting}
      />
    </div>
  );
}
