"use client";

import { TransactionTypeIcon } from "@/components/ActionIcons";
import { useTransactionModals } from "@/contexts/TransactionModalsContext";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export type CalendarTransaction = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
  status: "confirmed" | "pending";
  /** Present on expense rows from reports/calendar data. */
  isExpenseEssential?: boolean;
};

export type CalendarRecurringNextRun = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  categoryLabel: string;
  subcategoryLabel: string;
  accountFromName: string;
  accountToName: string;
};

type Props = {
  transactions: CalendarTransaction[];
  recurringNextRuns?: CalendarRecurringNextRun[];
  onMonthChange?: (year: number, month: number) => void;
  onPeriodModeChange?: (mode: "month" | "year", year: number, month: number) => void;
};

type DayIndicators = { income: boolean; expense: boolean; transfer: boolean; pending: boolean };

function indicatorsForDay(
  transactions: CalendarTransaction[],
  recurringCount: number
): DayIndicators {
  let income = false;
  let expense = false;
  let transfer = false;
  let pending = false;
  for (const t of transactions) {
    if (t.type === "income") income = true;
    else if (t.type === "expense") expense = true;
    else if (t.type === "transfer") transfer = true;
    if (t.status === "pending") pending = true;
  }
  if (recurringCount > 0) pending = true;
  return { income, expense, transfer, pending };
}

function transactionsByDate(transactions: CalendarTransaction[]): Map<string, CalendarTransaction[]> {
  const m = new Map<string, CalendarTransaction[]>();
  for (const t of transactions) {
    const d = t.date.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(t);
  }
  const arrays = Array.from(m.values());
  for (const arr of arrays) {
    arr.sort((a: CalendarTransaction, b: CalendarTransaction) => {
      const byType = a.type.localeCompare(b.type);
      if (byType !== 0) return byType;
      const da = a.description ?? "";
      const db = b.description ?? "";
      return da.localeCompare(db);
    });
  }
  return m;
}

function recurringByDate(
  runs: CalendarRecurringNextRun[]
): Map<string, CalendarRecurringNextRun[]> {
  const m = new Map<string, CalendarRecurringNextRun[]>();
  for (const r of runs) {
    const d = r.date.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(r);
  }
  return m;
}

export function DashboardCalendar({ transactions, recurringNextRuns = [], onMonthChange, onPeriodModeChange }: Props) {
  const t = useTranslations("calendar");
  const { openEditTransaction, openEditRecurring } = useTransactionModals();
  const [view, setView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"month" | "year">("month");

  // Build month and day names from translations
  const MONTHS = useMemo(() => [
    t("january"),
    t("february"),
    t("march"),
    t("april"),
    t("may"),
    t("june"),
    t("july"),
    t("august"),
    t("september"),
    t("october"),
    t("november"),
    t("december"),
  ], [t]);

  const DOW = useMemo(() => [
    t("sunday"),
    t("monday"),
    t("tuesday"),
    t("wednesday"),
    t("thursday"),
    t("friday"),
    t("saturday"),
  ], [t]);

  const byDate = useMemo(() => transactionsByDate(transactions), [transactions]);
  const recurringByDay = useMemo(
    () => recurringByDate(recurringNextRuns),
    [recurringNextRuns]
  );

  const { days } = useMemo(() => {
    const y = view.year;
    const m = view.month;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startDow = first.getDay();
    const n = last.getDate();
    const pad = startDow;
    const total = Math.ceil((pad + n) / 7) * 7;
    const startDate = new Date(first);
    startDate.setDate(startDate.getDate() - pad);
    const out: { date: string; day: number; isCurrent: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().slice(0, 10);
      const isCurrent = d.getMonth() === m && d.getFullYear() === y;
      out.push({ date, day: d.getDate(), isCurrent });
    }
    return { days: out };
  }, [view.year, view.month]);

  const prev = () => {
    const newView =
      pickerMode === "year"
        ? { year: view.year - 1, month: view.month }
        : view.month === 0
          ? { year: view.year - 1, month: 11 }
          : { year: view.year, month: view.month - 1 };
    setView(newView);
    if (pickerMode === "month") onMonthChange?.(newView.year, newView.month);
    onPeriodModeChange?.(pickerMode, newView.year, newView.month);
    setSelected(null);
  };
  const next = () => {
    const newView =
      pickerMode === "year"
        ? { year: view.year + 1, month: view.month }
        : view.month === 11
          ? { year: view.year + 1, month: 0 }
          : { year: view.year, month: view.month + 1 };
    setView(newView);
    if (pickerMode === "month") onMonthChange?.(newView.year, newView.month);
    onPeriodModeChange?.(pickerMode, newView.year, newView.month);
    setSelected(null);
  };

  const dayTransactions = selected ? (byDate.get(selected) ?? []) : [];
  const dayRecurring = selected ? (recurringByDay.get(selected) ?? []) : [];
  const selDate = selected ? new Date(selected + "T12:00:00Z") : null;
  const hasDayContent = dayTransactions.length > 0 || dayRecurring.length > 0;
  const isDetailsOpen = Boolean(selected);

  return (
    <div className="w-[360px] h-[360px] shrink-0">
      <div className="relative h-full w-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-sm dark:shadow-none">
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
          <button
            type="button"
            onClick={prev}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label={t("previousMonth")}
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() =>
              setPickerMode((m) => {
                const nextMode = m === "month" ? "year" : "month";
                onPeriodModeChange?.(nextMode, view.year, view.month);
                return nextMode;
              })
            }
            className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline underline-offset-4"
          >
            {pickerMode === "month" ? `${MONTHS[view.month]} ${view.year}` : String(view.year)}
          </button>
          <button
            type="button"
            onClick={next}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            aria-label={t("nextMonth")}
          >
            ▶
          </button>
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden [perspective:1200px]">
          <div
            className={`absolute inset-0 p-2 transition-all duration-500 ease-out ${isDetailsOpen
              ? "opacity-0 pointer-events-none [transform:rotateY(-90deg)_scale(0.97)]"
              : "opacity-100 [transform:rotateY(0deg)_scale(1)]"
              }`}
          >
            {pickerMode === "month" ? (
              <div className="h-full min-h-0 flex flex-col">
                <div className="shrink-0 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {DOW.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="flex-1 min-h-0 grid grid-cols-7 gap-0.5 [grid-auto-rows:1fr]">
                  {days.map(({ date, day, isCurrent }) => {
                    const dayList = byDate.get(date) ?? [];
                    const dayRecurring = recurringByDay.get(date) ?? [];
                    const ind = indicatorsForDay(dayList, dayRecurring.length);
                    const isSel = selected === date;
                    const bg = isSel
                      ? "ring-2 ring-slate-800 dark:ring-slate-200 bg-slate-100 dark:bg-slate-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/80";
                    const fg = !isCurrent ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100";
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelected(date)}
                        className={`min-h-0 flex flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium transition-colors ${fg} ${bg}`}
                      >
                        <span>{day}</span>
                        <span className="flex items-center justify-center gap-0.5 flex-wrap" aria-hidden>
                          {ind.income && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                          {ind.expense && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          {ind.transfer && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                          {ind.pending && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full grid grid-cols-3 gap-1.5 p-1">
                {MONTHS.map((monthName, monthIdx) => {
                  const isActive = monthIdx === view.month;
                  return (
                    <button
                      key={`${view.year}-${monthIdx}`}
                      type="button"
                      onClick={() => {
                        const newView = { year: view.year, month: monthIdx };
                        setView(newView);
                        setPickerMode("month");
                        setSelected(null);
                        onMonthChange?.(newView.year, newView.month);
                        onPeriodModeChange?.("month", newView.year, newView.month);
                      }}
                      className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 text-slate-900 dark:text-slate-100"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      {monthName.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className={`absolute inset-0 transition-all duration-500 ease-out ${isDetailsOpen
              ? "opacity-100 [transform:rotateY(0deg)_scale(1)]"
              : "opacity-0 pointer-events-none [transform:rotateY(90deg)_scale(0.97)]"
              }`}
          >
            <div className="h-full min-h-0 flex flex-col">
              <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selDate?.toLocaleDateString("pt-PT", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close day details"
                >
                  ✕
                </button>
              </div>
              <div className="friendly-scroll p-3 flex-1 min-h-0 overflow-y-auto">
                {!hasDayContent ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No transactions or recurring next runs on this day.</p>
                ) : (
                  <ul className="space-y-2">
                    {dayTransactions.map((t) => (
                      <li key={`t-${t.id}`} className="text-xs">
                        <button
                          type="button"
                          onClick={() => openEditTransaction(t.id)}
                          className={`w-full text-left flex items-start gap-2 rounded-lg p-2 border transition-colors ${t.status === "pending"
                            ? "border-yellow-200 dark:border-yellow-800/80 bg-yellow-50 dark:bg-yellow-950/35 hover:bg-yellow-100 dark:hover:bg-yellow-950/55 hover:border-yellow-300 dark:hover:border-yellow-700"
                            : "border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-600"
                            }`}
                        >
                          <TransactionTypeIcon type={t.type as "income" | "expense" | "transfer"} className="mt-0.5" />
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                              {t.description || "—"}
                            </span>
                            <span className="flex justify-between items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400">
                                {t.status === "pending" ? "Pending" : null}
                              </span>
                              <span
                                className={`tabular-nums shrink-0 ${t.type === "income"
                                  ? "text-green-600 dark:text-green-400"
                                  : t.type === "expense"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-slate-600 dark:text-slate-300"
                                  }`}
                              >
                                {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                                {t.amount.toLocaleString("pt-PT", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                €
                              </span>
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                    {dayRecurring.map((r) => (
                      <li key={`r-${r.id}`} className="text-xs">
                        <button
                          type="button"
                          onClick={() => openEditRecurring(r.id)}
                          className="w-full text-left flex items-start gap-2 rounded-lg p-2 border border-yellow-200 dark:border-yellow-800/80 bg-yellow-50 dark:bg-yellow-950/35 hover:bg-yellow-100 dark:hover:bg-yellow-950/55 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
                        >
                          <TransactionTypeIcon type={r.type as "income" | "expense" | "transfer"} className="mt-0.5" />
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                              {r.description || "—"}
                            </span>
                            <span className="flex justify-between items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400">Next run</span>
                              <span
                                className={`tabular-nums shrink-0 ${r.type === "income"
                                  ? "text-green-600 dark:text-green-400"
                                  : r.type === "expense"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-slate-600 dark:text-slate-300"
                                  }`}
                              >
                                {r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}
                                {r.amount.toLocaleString("pt-PT", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                €
                              </span>
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
