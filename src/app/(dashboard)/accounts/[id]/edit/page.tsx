"use client";

import { updateAccount } from "@/app/actions/accounts";
import { AccountTypeSelect } from "@/components/AccountTypeSelect";
import { useToast } from "@/contexts/ToastContext";
import type { AccountType } from "@/lib/account-types";
import { BalanceHint } from "@/components/BalanceHint";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import {
  intlLocaleFromAppLocale,
  formatMoneyAmountTwoDecimals,
  normalizeMoneyInputString,
  parseMoneyInputString,
} from "@/lib/money-format";

export default function EditAccountPage() {
  const tAccounts = useTranslations("accounts.modal");
  const tCommon = useTranslations("common");
  const tNavigation = useTranslations("navigation");
  const locale = useLocale();
  const localeTag = intlLocaleFromAppLocale(locale);
  const params = useParams();
  const id = String(params.id);
  const { showToast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank_account");
  const [initialBalance, setInitialBalance] = useState("");
  const [plafond, setPlafond] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [originalInitialBalance, setOriginalInitialBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("accounts")
      .select("name, account_type, initial_balance, current_balance, is_active, plafond")
      .eq("id", id)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false);
        if (e || !data) {
          setError(e?.message ?? tAccounts("notFound"));
          return;
        }
        setName(data.name);
        setAccountType(
          (data.account_type as AccountType) ?? "bank_account"
        );
        setInitialBalance(formatMoneyAmountTwoDecimals(Number(data.initial_balance), localeTag));
        setOriginalInitialBalance(Number(data.initial_balance));
        setCurrentBalance(Number(data.current_balance));
        setPlafond(
          data.plafond != null
            ? formatMoneyAmountTwoDecimals(Number(data.plafond), localeTag)
            : ""
        );
        setIsActive(data.is_active);
      });
  }, [id, tAccounts, localeTag]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const num = parseMoneyInputString(initialBalance);
    if (Number.isNaN(num)) {
      setError(tAccounts("invalidInitialBalance"));
      setSaving(false);
      return;
    }
    const plafondParsed = parseMoneyInputString(plafond);
    const plafondNum =
      accountType === "credit_card" && plafond.trim() && !Number.isNaN(plafondParsed)
        ? plafondParsed
        : null;
    const res = await updateAccount(id, {
      name: name.trim(),
      account_type: accountType,
      initial_balance: num,
      is_active: isActive,
      plafond: plafondNum,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      showToast(res.error, "error");
      return;
    }
    showToast(tAccounts("updatedToast"));
    router.push("/accounts");
    router.refresh();
  }

  if (loading) return <p className="text-slate-500">{tCommon("loading")}</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/accounts" className="underline">← {tNavigation("accounts")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{tAccounts("titleEdit")}</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{tAccounts("nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
        </div>
        <AccountTypeSelect value={accountType} onChange={setAccountType} />
        {accountType === "credit_card" && (
          <div>
            <label className="block text-sm font-medium mb-1">{tAccounts("plafondLabel")}</label>
            <input
              type="text"
              inputMode="decimal"
              value={plafond}
              onChange={(e) => setPlafond(e.target.value)}
              onBlur={() => setPlafond((p) => normalizeMoneyInputString(p, localeTag))}
              placeholder={tAccounts("plafondPlaceholder")}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
            />
            <p className="text-xs text-slate-500 mt-1">
              {tAccounts("plafondHint")}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">{tAccounts("initialBalanceLabel")}</label>
          <input
            type="text"
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            onBlur={() => setInitialBalance((b) => normalizeMoneyInputString(b, localeTag))}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
          />
          <p className="text-xs text-slate-500 mt-1">
            {tAccounts("initialBalanceHint")}
          </p>
          {(() => {
            if (currentBalance == null) return null;
            const newInit = parseMoneyInputString(initialBalance);
            if (Number.isNaN(newInit)) return null;
            const diff = newInit - originalInitialBalance;
            const afterBalance = currentBalance + diff;
            if (diff === 0) return null;
            return <BalanceHint currentBalance={currentBalance} afterBalance={afterBalance} />;
          })()}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="isActive">{tAccounts("activeLabel")}</label>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? tAccounts("saving") : tCommon("save")}
          </button>
          <Link
            href="/accounts"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            {tCommon("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
