type IconProps = { className?: string; "aria-hidden"?: boolean };

export type MovementType = "income" | "expense" | "transfer";

const TYPE_COLORS: Record<MovementType, string> = {
  income: "text-green-600",
  expense: "text-red-600",
  transfer: "text-blue-600",
};

const TYPE_LABELS: Record<MovementType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

export function MovementTypeIcon({
  type,
  className = "",
  "aria-hidden": ariaHidden,
}: IconProps & { type: MovementType }) {
  const t = type as MovementType;
  const color = TYPE_COLORS[t] ?? "text-slate-500";
  const label = TYPE_LABELS[t] ?? type;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${color} ${className}`.trim()}
      role="img"
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden ?? undefined}
      title={label}
    >
      {t === "income" && (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      )}
      {t === "expense" && (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      )}
      {t === "transfer" && (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8h10m-2-3l4 3-4 3" />
          <path d="M20 16H10m2 3l-4-3 4-3" />
        </svg>
      )}
    </span>
  );
}

export function CopyIcon({ className = "", "aria-hidden": ariaHidden }: IconProps) {
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
      className={className}
      aria-hidden={ariaHidden}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function EditIcon({ className = "", "aria-hidden": ariaHidden }: IconProps) {
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
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function DeleteIcon({ className = "", "aria-hidden": ariaHidden }: IconProps) {
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
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function ConfirmIcon({ className = "", "aria-hidden": ariaHidden }: IconProps) {
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
      className={className}
      aria-hidden={ariaHidden}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
