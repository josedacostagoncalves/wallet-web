"use client";

import Link from "next/link";

type Props = { className?: string };

/**
 * Tech/modern "J" logo for J-Wallet. Used as app icon in the header.
 */
export function JWalletIcon({ className = "w-8 h-8" }: Props) {
  return (
    <Link
      href="/home"
      className={`flex items-center justify-center shrink-0 ${className} text-slate-800 dark:text-white hover:opacity-80 transition-opacity rounded-lg`}
      aria-label="J-Wallet home"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden
      >
        <rect width="32" height="32" rx="6" fill="currentColor" opacity="0.1" />
        <path
          d="M11 8h10v2h-8v12q0 3 2.5 3h2v2h-4.5q-3.5 0-3.5-3.5V10h-5V8z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    </Link>
  );
}
