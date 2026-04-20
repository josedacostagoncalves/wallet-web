/** Paperclip + essential star shown between “From → To” and amount on transaction lists. */

function PaperclipIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function EssentialStarIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

type Props = {
  hasAttachment: boolean;
  isEssential: boolean;
  ariaAttachment: string;
  ariaEssential: string;
};

export function TransactionListIndicators({
  hasAttachment,
  isEssential,
  ariaAttachment,
  ariaEssential,
}: Props) {
  return (
    <div className="inline-flex items-center justify-center gap-1.5 min-w-[2.75rem] text-center">
      {hasAttachment ? (
        <span className="inline-flex text-slate-500 dark:text-slate-400" title={ariaAttachment}>
          <PaperclipIcon />
          <span className="sr-only">{ariaAttachment}</span>
        </span>
      ) : null}
      {isEssential ? (
        <span className="inline-flex text-amber-500 dark:text-amber-400" title={ariaEssential}>
          <EssentialStarIcon />
          <span className="sr-only">{ariaEssential}</span>
        </span>
      ) : null}
    </div>
  );
}
