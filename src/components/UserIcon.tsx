"use client";

type Props = { className?: string };

/** Default user/avatar icon when no photo is set. */
export function UserIcon({ className = "w-24 h-24" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.4 0-8 2.2-8 6v2h16v-2c0-3.8-3.6-6-8-6z"
        clipRule="evenodd"
      />
    </svg>
  );
}
