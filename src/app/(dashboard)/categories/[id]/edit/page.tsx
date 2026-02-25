"use client";

import { updateCategory } from "@/app/actions/categories";
import { useToast } from "@/contexts/ToastContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("name, is_active")
      .eq("id", id)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false);
        if (e || !data) {
          setError(e?.message ?? tCategories("notFound"));
          return;
        }
        setName(data.name);
        setIsActive(data.is_active);
      });
  }, [id, tCategories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await updateCategory(id, { name: name.trim(), is_active: isActive });
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

  if (loading) return <p className="text-slate-500">{tCommon("loading")}</p>;
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
      <h1 className="text-2xl font-semibold">{tCategories("titleEdit")}</h1>
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
