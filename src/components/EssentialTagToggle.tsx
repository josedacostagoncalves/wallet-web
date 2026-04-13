"use client";

type Props = {
  label: string;
  ariaDismissLabel: string;
  ariaActivateLabel: string;
  /** Whether this transaction counts as essential (including “follow category” when the leaf is essential). */
  isActive: boolean;
  /** User clicked the ✕ while the tag is active (amber). */
  onDismiss: () => void;
  /** User clicked the grey tag to turn essential on again. */
  onActivate: () => void;
};

const starPath =
  "M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z";

export function EssentialTagToggle({
  label,
  ariaDismissLabel,
  ariaActivateLabel,
  isActive,
  onDismiss,
  onActivate,
}: Props) {
  if (isActive) {
    return (
      <span
        className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-100/95 py-0.5 pl-2 pr-0.5 text-[11px] font-semibold leading-none text-amber-950 shadow-sm dark:border-amber-600/40 dark:from-amber-950/50 dark:to-amber-900/35 dark:text-amber-100 dark:shadow-none"
        title={label}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-2.5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        >
          <path fillRule="evenodd" d={starPath} clipRule="evenodd" />
        </svg>
        <span className="select-none truncate">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-amber-800/80 hover:bg-amber-200/70 hover:text-amber-950 dark:text-amber-100/90 dark:hover:bg-amber-800/60 dark:hover:text-amber-50"
          aria-label={ariaDismissLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="size-3"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={ariaActivateLabel}
      className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-slate-300/90 bg-slate-100/90 py-0.5 pl-2 pr-2 text-[11px] font-semibold leading-none text-slate-500 line-through shadow-sm hover:bg-slate-200/90 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700/80"
      title={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-2.5 shrink-0 text-slate-400 dark:text-slate-500"
        aria-hidden
      >
        <path fillRule="evenodd" d={starPath} clipRule="evenodd" />
      </svg>
      <span className="select-none truncate">{label}</span>
    </button>
  );
}
