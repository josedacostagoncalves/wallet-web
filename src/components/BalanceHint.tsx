"use client";

function fmt(n: number) {
  return n.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  currentBalance: number;
  afterBalance: number;
  /** Optional account name label shown before the balance info */
  label?: string;
};

/**
 * Small inline hint showing "Balance: X € → Y €" below an account selector.
 * When `label` is provided, shows "AccountName: Balance: X € → Y €".
 */
export function BalanceHint({ currentBalance, afterBalance, label }: Props) {
  const changed = currentBalance !== afterBalance;
  return (
    <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
      {label && <span className="font-medium">{label}: </span>}
      <span>Balance: {fmt(currentBalance)} €</span>
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
