"use client";

export function DonutIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        className={active ? "text-slate-900 dark:text-white" : "text-slate-500"}
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="currentColor"
        className={active ? "text-slate-900 dark:text-white" : "text-slate-400"}
      />
    </svg>
  );
}

export function BarsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path
        d="M4 19h3v-8H4v8zm6 0h3V5h-3v14zm6 0h3v-6h-3v6z"
        className={active ? "text-slate-900 dark:text-white" : "text-slate-500"}
      />
    </svg>
  );
}

const toggleBtn =
  "p-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/50 " +
  "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800";

const toggleBtnActive =
  "border-slate-700 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-500";

type Props = {
  view: "donut" | "bars";
  onViewChange: (view: "donut" | "bars") => void;
  labelDonut: string;
  labelBars: string;
};

export function ReportDonutBarsToggle({ view, onViewChange, labelDonut, labelBars }: Props) {
  return (
    <div className="flex gap-1 shrink-0 pt-0.5">
      <button
        type="button"
        onClick={() => onViewChange("donut")}
        className={`${toggleBtn} ${view === "donut" ? toggleBtnActive : ""}`}
        aria-pressed={view === "donut"}
        aria-label={labelDonut}
        title={labelDonut}
      >
        <DonutIcon active={view === "donut"} />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("bars")}
        className={`${toggleBtn} ${view === "bars" ? toggleBtnActive : ""}`}
        aria-pressed={view === "bars"}
        aria-label={labelBars}
        title={labelBars}
      >
        <BarsIcon active={view === "bars"} />
      </button>
    </div>
  );
}
