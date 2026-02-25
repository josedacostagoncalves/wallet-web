"use client";

import { updateAccount } from "@/app/actions/accounts";
import { AccountTypeSelect } from "@/components/AccountTypeSelect";
import { BalanceHint } from "@/components/BalanceHint";
import { useToast } from "@/contexts/ToastContext";
import type { AccountType } from "@/lib/account-types";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type Props = {
  accountId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function EditAccountModal({ accountId, open, onClose, onSaved }: Props) {
  const tAccounts = useTranslations("accounts.modal");
  const tCommon = useTranslations("common");
  const tForm = useTranslations("transactions.form");
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Load account data when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    supabase
      .from("accounts")
      .select("name, account_type, initial_balance, current_balance, is_active, plafond")
      .eq("id", accountId)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false);
        if (e || !data) {
          setError(e?.message ?? tAccounts("notFound"));
          return;
        }
        setName(data.name);
        setAccountType((data.account_type as AccountType) ?? "bank_account");
        setInitialBalance(String(data.initial_balance));
        setOriginalInitialBalance(Number(data.initial_balance));
        setCurrentBalance(Number(data.current_balance));
        setPlafond(data.plafond != null ? String(data.plafond) : "");
        setIsActive(data.is_active);
      });
  }, [open, accountId, tAccounts]);

  // Keyboard & scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const num = parseFloat(initialBalance.replace(",", "."));
    if (isNaN(num)) {
      setError(tAccounts("invalidInitialBalance"));
      setSaving(false);
      return;
    }
    const plafondNum =
      accountType === "credit_card" && plafond.trim()
        ? parseFloat(plafond.replace(",", ".")) || null
        : null;
    const res = await updateAccount(accountId, {
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
    onClose();
    onSaved?.();
  }

  if (!open) return null;

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-sm";

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current && !saving) onClose();
      }}
    >
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={tCommon("close")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold mb-4">{tAccounts("titleEdit")}</h2>

        {loading ? (
          <p className="text-slate-500 text-sm">{tCommon("loading")}</p>
        ) : error && !name ? (
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tAccounts("nameLabel")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <AccountTypeSelect value={accountType} onChange={setAccountType} />
            {accountType === "credit_card" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {tAccounts("plafondLabel")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={plafond}
                  onChange={(e) => setPlafond(e.target.value)}
                  placeholder={tAccounts("plafondPlaceholder")}
                  className={inputClass}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {tAccounts("plafondHint")}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                {tAccounts("initialBalanceLabel")}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">
                {tAccounts("initialBalanceHint")}
              </p>
              {(() => {
                if (currentBalance == null) return null;
                const newInit = parseFloat(initialBalance.replace(",", "."));
                if (isNaN(newInit)) return null;
                const diff = newInit - originalInitialBalance;
                const afterBalance = currentBalance + diff;
                if (diff === 0) return null;
                return (
                  <BalanceHint
                    currentBalance={currentBalance}
                    afterBalance={afterBalance}
                  />
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActiveModal"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveModal" className="text-sm">
                {tAccounts("activeLabel")}
              </label>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                {saving ? tForm("buttons.saving") : tCommon("save")}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
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
