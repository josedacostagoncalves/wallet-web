"use client";

import { setWalletCookie } from "@/app/actions/wallet-cookie";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";

export default function NewWalletPage() {
  const tAuth = useTranslations("auth");
  const tWallets = useTranslations("wallets");
  const tCommon = useTranslations("common");
  const tCategorySuggestions = useTranslations("categories.modal.suggestions");
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [ownership, setOwnership] = useState<"personal" | "shared">("personal");
  const [trackingMode, setTrackingMode] = useState<"full" | "basic">("full");
  const [splitMode, setSplitMode] = useState<"none" | "split">("none");
  const [defaultSplitMethod, setDefaultSplitMethod] = useState<"equally" | "by_income" | "manual">("equally");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function normalizeCategoryName(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(tAuth("notAuthenticated"));
      setLoading(false);
      showToast(tAuth("notAuthenticated"), "error");
      return;
    }

    const isShared = ownership === "shared";
    const legacySharedOption = !isShared
      ? null
      : splitMode === "none"
        ? "track"
        : trackingMode === "basic"
          ? "split"
          : "track_and_split";

    const { data: walletId, error: rpcErr } = await supabase.rpc("create_wallet", {
      p_name: name.trim(),
      p_is_shared: isShared,
      p_shared_option: legacySharedOption,
      p_tracking_mode: trackingMode,
      p_split_mode: isShared ? splitMode : "none",
      p_default_split_method: isShared && splitMode === "split" ? defaultSplitMethod : null,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setLoading(false);
      showToast(rpcErr.message, "error");
      return;
    }
    if (!walletId) {
      setError(tWallets("toasts.createFailed"));
      setLoading(false);
      showToast(tWallets("toasts.createFailed"), "error");
      return;
    }

    if (isShared && splitMode === "split") {
      const salaryName = tCategorySuggestions("income.salary");
      const settlementName = tCategorySuggestions("transfer.settlement");
      const wanted = [
        { name: salaryName, type: "income" as const },
        { name: settlementName, type: "transfer" as const },
      ];

      const { data: existingCats } = await supabase
        .from("categories")
        .select("name, type")
        .eq("wallet_id", walletId)
        .is("parent_id", null)
        .in("type", ["income", "transfer"]);

      const existingKey = new Set(
        (existingCats ?? []).map((c) => `${c.type}:${normalizeCategoryName(c.name)}`)
      );
      const toInsert = wanted
        .filter((c) => !existingKey.has(`${c.type}:${normalizeCategoryName(c.name)}`))
        .map((c) => ({
          wallet_id: walletId,
          name: c.name,
          type: c.type,
          parent_id: null,
          created_by: user.id,
          is_active: true,
        }));
      if (toInsert.length > 0) {
        const { error: defaultsErr } = await supabase.from("categories").insert(toInsert);
        if (defaultsErr) {
          showToast(defaultsErr.message, "error");
        }
      }
    }

    await supabase.from("activity_log").insert({
      user_id: user.id,
      wallet_id: walletId,
      action: "wallet_create",
      entity_type: "wallet",
      entity_id: walletId,
      payload: {
        name: name.trim(),
        is_shared: isShared,
        shared_option: legacySharedOption,
        tracking_mode: trackingMode,
        split_mode: isShared ? splitMode : "none",
        default_split_method: isShared && splitMode === "split" ? defaultSplitMethod : null,
      },
    });

    // Automatically select the newly created wallet
    await setWalletCookie(walletId);

    setLoading(false);
    showToast(tWallets("toasts.created"));
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={tWallets("page.create")} description={tWallets("page.new.subtitle")} />
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tWallets("page.new.nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={tWallets("page.new.namePlaceholder")}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium mb-1">{tWallets("page.new.walletOwnership")}</label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOwnership("personal")}
            className={
              "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
              (ownership === "personal"
                ? "border-slate-800 bg-slate-800/5"
                : "border-slate-200 hover:border-slate-300")
            }
          >
            <div className="text-sm font-semibold mb-1">{tWallets("page.new.ownership.personal")}</div>
            <div className="text-xs text-slate-600">{tWallets("page.new.ownership.personalDesc")}</div>
          </button>
          <button
            type="button"
            onClick={() => setOwnership("shared")}
            className={
              "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
              (ownership === "shared"
                ? "border-slate-800 bg-slate-800/5"
                : "border-slate-200 hover:border-slate-300")
            }
          >
            <div className="text-sm font-semibold mb-1">{tWallets("page.new.ownership.shared")}</div>
            <div className="text-xs text-slate-600">{tWallets("page.new.ownership.sharedDesc")}</div>
          </button>
        </div>

        <div className="mt-2">
          <p className="text-sm font-medium mb-2">{tWallets("page.new.trackingMode")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTrackingMode("full")}
              className={
                "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                (trackingMode === "full"
                  ? "border-slate-800 bg-slate-800/5"
                  : "border-slate-200 hover:border-slate-300")
              }
            >
              <div className="text-sm font-semibold mb-1">{tWallets("page.new.tracking.full")}</div>
              <div className="text-xs text-slate-600">{tWallets("page.new.tracking.fullDesc")}</div>
            </button>
            <button
              type="button"
              onClick={() => setTrackingMode("basic")}
              className={
                "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                (trackingMode === "basic"
                  ? "border-slate-800 bg-slate-800/5"
                  : "border-slate-200 hover:border-slate-300")
              }
            >
              <div className="text-sm font-semibold mb-1">{tWallets("page.new.tracking.basic")}</div>
              <div className="text-xs text-slate-600">{tWallets("page.new.tracking.basicDesc")}</div>
            </button>
          </div>
        </div>

        {ownership === "shared" && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">{tWallets("page.new.sharedSplitMode")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSplitMode("none")}
                className={
                  "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                  (splitMode === "none"
                    ? "border-slate-800 bg-slate-800/5"
                    : "border-slate-200 hover:border-slate-300")
                }
              >
                <div className="text-sm font-semibold mb-1">{tWallets("page.new.split.none")}</div>
                <div className="text-xs text-slate-600">{tWallets("page.new.split.noneDesc")}</div>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode("split")}
                className={
                  "flex flex-col items-start p-4 rounded-lg border transition-colors text-left " +
                  (splitMode === "split"
                    ? "border-slate-800 bg-slate-800/5"
                    : "border-slate-200 hover:border-slate-300")
                }
              >
                <div className="text-sm font-semibold mb-1">{tWallets("page.new.split.enabled")}</div>
                <div className="text-xs text-slate-600">{tWallets("page.new.split.enabledDesc")}</div>
              </button>
            </div>

            {splitMode === "split" && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">{tWallets("page.new.defaultSplitMethod")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDefaultSplitMethod("equally")}
                    className={
                      "px-3 py-2 rounded-lg border text-sm text-left " +
                      (defaultSplitMethod === "equally"
                        ? "border-slate-800 bg-slate-800/5"
                        : "border-slate-200 hover:border-slate-300")
                    }
                  >
                    {tWallets("page.new.splitMethod.equally")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultSplitMethod("by_income")}
                    className={
                      "px-3 py-2 rounded-lg border text-sm text-left " +
                      (defaultSplitMethod === "by_income"
                        ? "border-slate-800 bg-slate-800/5"
                        : "border-slate-200 hover:border-slate-300")
                    }
                  >
                    {tWallets("page.new.splitMethod.byIncome")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultSplitMethod("manual")}
                    className={
                      "px-3 py-2 rounded-lg border text-sm text-left " +
                      (defaultSplitMethod === "manual"
                        ? "border-slate-800 bg-slate-800/5"
                        : "border-slate-200 hover:border-slate-300")
                    }
                  >
                    {tWallets("page.new.splitMethod.manual")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? tWallets("page.new.creating") : tWallets("page.create")}
          </button>
          <Link
            href="/wallets"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
