"use client";

import { updateCategory } from "@/app/actions/categories";
import { useToast } from "@/contexts/ToastContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";

export default function EditCategoryPage() {
  const tCategories = useTranslations("categories.modal");
  const tCommon = useTranslations("common");
  const tNavigation = useTranslations("navigation");
  const params = useParams();
  const id = String(params.id);
  const { showToast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isEssential, setIsEssential] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [childCount, setChildCount] = useState(0);
  const [categoryType, setCategoryType] = useState<"income" | "expense" | "transfer" | null>(null);
  const [parentRootOptions, setParentRootOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("categories")
        .select("wallet_id, name, is_active, is_essential, parent_id, type")
        .eq("id", id)
        .single(),
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id),
    ]).then(async ([rowRes, countRes]) => {
      const data = rowRes.data;
      const e = rowRes.error;
      if (e || !data) {
        setLoading(false);
        setError(e?.message ?? tCategories("notFound"));
        setParentRootOptions([]);
        setSelectedParentId("");
        return;
      }
      setName(data.name);
      setIsActive(data.is_active);
      setIsEssential(!!(data as { is_essential?: boolean }).is_essential);
      const pid = (data as { parent_id?: string | null }).parent_id ?? null;
      setParentId(pid);
      setChildCount(countRes.count ?? 0);
      const t = (data as { type?: string }).type;
      const typ = t === "income" || t === "expense" || t === "transfer" ? t : null;
      setCategoryType(typ);
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
      setLoading(false);
    });
  }, [id, tCategories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const isSub = parentId != null;
    const isLeafRoot = parentId == null && childCount === 0;
    const res = await updateCategory(id, {
      name: name.trim(),
      is_active: isActive,
      ...(categoryType === "expense" && (isSub || isLeafRoot) ? { is_essential: isEssential } : {}),
      ...(isSub && selectedParentId ? { parent_id: selectedParentId } : {}),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast(tCategories("updatedToast"));
    router.push("/categories");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title={tCategories("titleEdit")} description={tCategories("subtitleEdit")} />
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/categories" className="underline">← {tNavigation("categories")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={tCategories("titleEdit")} description={tCategories("subtitleEdit")} />
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tCategories("nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        {parentId != null && parentRootOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="editMoveParent">
              {tCategories("parentCategoryEditLabel")}
            </label>
            <select
              id="editMoveParent"
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
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
        {categoryType === "expense" && (parentId != null || childCount === 0) && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editCatEssential"
              checked={isEssential}
              onChange={(e) => setIsEssential(e.target.checked)}
            />
            <label htmlFor="editCatEssential" className="text-sm">
              {tCategories("essentialLabel")}
            </label>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="isActive">{tCategories("activeLabel")}</label>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? tCategories("saving") : tCommon("save")}
          </button>
          <Link
            href="/categories"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
