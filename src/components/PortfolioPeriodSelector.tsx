"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  years: number[];
  selectedYear: number;
  selectedMonth: number;
  periodType: "monthly" | "yearly";
};

function ArrowIcon({ left = false }: { left?: boolean }) {
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
      aria-hidden
    >
      {left ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

export function PortfolioPeriodSelector({ years, selectedYear, selectedMonth, periodType }: Props) {
  const t = useTranslations("portfolio");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const setPeriod = (year: number, month: number, nextType: "monthly" | "yearly" = periodType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("month", String(month));
    if (nextType === "yearly") params.set("period", "yearly");
    else params.delete("period");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const moveMonth = (delta: number) => {
    let year = selectedYear;
    let month = selectedMonth + delta;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    if (year < minYear || year > maxYear) return;
    setPeriod(year, month);
  };

  const moveYear = (delta: number) => {
    const year = selectedYear + delta;
    if (year < minYear || year > maxYear) return;
    setPeriod(year, selectedMonth, "yearly");
  };

  const monthLabel = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(Date.UTC(2024, m - 1, 1)));

  const canPrev = periodType === "yearly"
    ? selectedYear > minYear
    : !(selectedYear === minYear && selectedMonth === 1);
  const canNext = periodType === "yearly"
    ? selectedYear < maxYear
    : !(selectedYear === maxYear && selectedMonth === 12);

  return (
    <div className="flex items-center gap-2">
      <select
        value={periodType}
        onChange={(e) => setPeriod(selectedYear, selectedMonth, e.target.value as "monthly" | "yearly")}
        className="px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
        aria-label={t("period")}
      >
        <option value="monthly">{t("periodTypes.monthly")}</option>
        <option value="yearly">{t("periodTypes.yearly")}</option>
      </select>
      <button
        type="button"
        onClick={() => (periodType === "yearly" ? moveYear(-1) : moveMonth(-1))}
        disabled={!canPrev}
        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label={t("previousMonth")}
        title={t("previousMonth")}
      >
        <ArrowIcon left />
      </button>
      {periodType === "monthly" && (
        <select
          value={selectedMonth}
          onChange={(e) => setPeriod(selectedYear, Number(e.target.value), "monthly")}
          className="px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
          aria-label={t("month")}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      )}
      <select
        value={selectedYear}
        onChange={(e) => setPeriod(Number(e.target.value), selectedMonth, periodType)}
        className="px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
        aria-label={t("year")}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => (periodType === "yearly" ? moveYear(1) : moveMonth(1))}
        disabled={!canNext}
        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label={t("nextMonth")}
        title={t("nextMonth")}
      >
        <ArrowIcon />
      </button>
    </div>
  );
}
