"use client";

import { joinWalletByCode } from "@/app/actions/wallets";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function JoinWalletPage() {
  const tWallets = useTranslations("wallets");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");
  const [shareCode, setShareCode] = useState(codeParam || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shareCode.trim()) {
      setError(tWallets("page.joinPage.validation.shareCodeRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    const res = await joinWalletByCode(shareCode.trim().toUpperCase());
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      router.push("/wallets");
      router.refresh();
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{tWallets("page.joinPage.title")}</h1>

      {success ? (
        <div className="p-6 rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20">
          <p className="text-green-800 dark:text-green-200 font-medium mb-2">
            {tWallets("page.joinPage.successTitle")}
          </p>
          <p className="text-sm text-green-700 dark:text-green-300">
            {tWallets("page.joinPage.successRedirect")}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {tWallets("page.joinPage.shareCodeLabel")}
            </label>
            <input
              type="text"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value.toUpperCase())}
              placeholder={tWallets("page.joinPage.shareCodePlaceholder")}
              maxLength={8}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 font-mono text-lg tracking-wider text-center"
            />
            <p className="text-xs text-slate-500 mt-1">
              {tWallets("page.joinPage.shareCodeHint")}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? tWallets("page.joinPage.joining") : tWallets("page.joinPage.joinButton")}
            </button>
            <Link
              href="/wallets"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {tCommon("cancel")}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
