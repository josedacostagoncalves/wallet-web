"use client";

import Link from "next/link";

type Props = { className?: string; rounded?: boolean };

/** J-Wallet logo image (no link). For use in modals, etc. */
export function JWalletLogo({ className = "w-10 h-10", rounded }: Props) {
  return (
    <img
      src="/j-wallet-icon.png"
      alt=""
      className={`${className} shrink-0 object-contain ${rounded ? "rounded-full" : ""}`}
      aria-hidden
    />
  );
}

/** J-Wallet app icon. Used in the header. */
export function JWalletIcon({ className = "w-8 h-8" }: Props) {
  return (
    <Link
      href="/home"
      className={`flex items-center justify-center shrink-0 ${className} hover:opacity-80 transition-opacity rounded-lg`}
      aria-label="J-Wallet home"
    >
      <img
        src="/j-wallet-icon.png"
        alt=""
        className="w-full h-full object-contain"
        aria-hidden
      />
    </Link>
  );
}
