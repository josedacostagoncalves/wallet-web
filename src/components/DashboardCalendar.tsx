"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CalendarMovement = {
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
};

type Props = { movements: CalendarMovement[] };

type DayIndicators = { income: boolean; expense: boolean; transfer: boolean; pending: boolean };

function indicatorsForDay(movements: CalendarMovement[]): DayIndicators {
  let income = false;
  let expense = false;
  let transfer = false;
  let pending = false;
  for (const m of movements) {
    if (m.type === "income") income = true;
    else if (m.type === "expense") expense = true;
    else if (m.type === "transfer") transfer = true;
    if (m.status === "pending") pending = true;
  }
  return { income, expense, transfer, pending };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function movementsByDate(movements: CalendarMovement[]): Map<string, CalendarMovement[]> {
  const m = new Map<string, CalendarMovement[]>();
  for (const t of movements) {
    const d = t.date.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(t);
  }
  const arrays = Array.from(m.values());
  for (const arr of arrays) {
    arr.sort((a: CalendarMovement, b: CalendarMovement) => {
      const byType = a.type.localeCompare(b.type);
      if (byType !== 0) return byType;
      const da = a.description ?? "";
      const db = b.description ?? "";
      return da.localeCompare(db);
    });
  }
  return m;
}

export function DashboardCalendar({ movements }: Props) {
  const [view, setView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => movementsByDate(movements), [movements]);

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
    if (view.month === 0) setView({ year: view.year - 1, month: 11 });
    else setView({ year: view.year, month: view.month - 1 });
  };
  const next = () => {
    if (view.month === 11) setView({ year: view.year + 1, month: 0 });
    else setView({ year: view.year, month: view.month + 1 });
  };

  const dayMovements = selected ? (byDate.get(selected) ?? []) : [];
  const selDate = selected ? new Date(selected + "T12:00:00Z") : null;

  return (
    <div className="flex flex-col gap-4 w-[360px] shrink-0">
      <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white w-[360px] h-[360px]">
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={prev}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
            aria-label="Previous month"
          >
            ◀
          </button>
          <span className="text-sm font-semibold text-slate-800">
            {MONTHS[view.month]} {view.year}
          </span>
          <button
            type="button"
            onClick={next}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
            aria-label="Next month"
          >
            ▶
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-2">
          <div className="shrink-0 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-500 mb-1">
            {DOW.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-7 gap-0.5 [grid-auto-rows:1fr]">
            {days.map(({ date, day, isCurrent }) => {
              const dayList = byDate.get(date) ?? [];
              const ind = indicatorsForDay(dayList);
              const isSel = selected === date;
              const bg = isSel ? "ring-2 ring-slate-800 bg-slate-100" : "hover:bg-slate-100";
              const fg = !isCurrent ? "text-slate-400" : "text-slate-800";
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  className={`min-h-0 flex flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium ${fg} ${bg}`}
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
      </div>

      {selected && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-800">
              {selDate?.toLocaleDateString("pt-PT", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </h3>
          </div>
          <div className="p-3 max-h-[280px] overflow-y-auto">
            {dayMovements.length === 0 ? (
              <p className="text-xs text-slate-500">No movements on this day.</p>
            ) : (
              <ul className="space-y-2">
                {dayMovements.map((t) => (
                  <li key={t.id} className="text-xs">
                    <Link
                      href={`/movements/${t.id}/edit`}
                      className="flex flex-col gap-0.5 rounded-lg p-2 border border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                    >
                      <span className="font-medium text-slate-800 truncate">
                        {t.description || "—"}
                      </span>
                      <span className="flex justify-between items-center gap-2">
                        <span className="text-slate-500 capitalize">
                          {t.type}
                          {t.status === "pending" ? " (pending)" : ""}
                        </span>
                        <span
                          className={`font-mono shrink-0 ${
                            t.type === "income"
                              ? "text-green-600"
                              : t.type === "expense"
                                ? "text-red-600"
                                : "text-slate-600"
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
