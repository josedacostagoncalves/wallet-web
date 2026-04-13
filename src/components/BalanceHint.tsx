"use client";

import { intlLocaleFromAppLocale, formatMoneyAmountTwoDecimals } from "@/lib/money-format";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  currentBalance: number;
  afterBalance: number;
  /** Optional account name label shown before the balance info */
  label?: string;
};

/**
 * Small inline hint showing localized "Balance: X € → Y €" below an account selector.
 * When `label` is provided, shows "AccountName: …".
 */
export function BalanceHint({ currentBalance, afterBalance, label }: Props) {
  const t = useTranslations("common");
  const locale = useLocale();
  const localeTag = intlLocaleFromAppLocale(locale);
  const fmt = (n: number) => formatMoneyAmountTwoDecimals(n, localeTag);
  const changed = currentBalance !== afterBalance;
  const balanceWord = t("balanceHintLabel");
  return (
    <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
      {label && <span className="font-medium">{label}: </span>}
      <span>
        {balanceWord}: {fmt(currentBalance)} €
      </span>
      <span className="mx-1.5">→</span>
      <span
        className={
          changed
            ? afterBalance < currentBalance
              ? "text-red-600 dark:text-red-400 font-medium"
              : "text-green-600 dark:text-green-400 font-medium"
            : ""
        }
      >
        {fmt(afterBalance)} €
      </span>
    </p>
  );
}
