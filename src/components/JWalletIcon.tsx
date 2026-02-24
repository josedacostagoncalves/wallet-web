"use client";

import Link from "next/link";

type IconVariant = "v1" | "v2" | "v3";
type Props = { className?: string; rounded?: boolean; variant?: IconVariant };

function GlyphV1() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect x="4" y="4" width="56" height="56" rx="14" className="fill-slate-900 dark:fill-slate-100" />

      <line x1="14" y1="18" x2="26" y2="18" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="12" x2="20" y2="24" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />

      <line x1="38" y1="18" x2="50" y2="18" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />

      <path d="M16 44h28" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 38l6 6-6 6" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M48 52H20" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 46l-6 6 6 6" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphV2() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect x="4" y="4" width="56" height="56" rx="14" className="fill-slate-900 dark:fill-slate-100" />

      <circle cx="22" cy="20" r="9" fill="#22c55e" fillOpacity="0.2" />
      <line x1="17" y1="20" x2="27" y2="20" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="22" y1="15" x2="22" y2="25" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" />

      <circle cx="42" cy="20" r="9" fill="#ef4444" fillOpacity="0.2" />
      <line x1="37" y1="20" x2="47" y2="20" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />

      <rect x="14" y="33" width="36" height="17" rx="8.5" fill="#3b82f6" fillOpacity="0.15" />
      <path d="M18 38h20" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 34l4 4-4 4" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 45H26" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 41l-4 4 4 4" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphV3() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect x="4" y="4" width="56" height="56" rx="14" className="fill-slate-900 dark:fill-slate-100" />

      <path d="M12 33C16 25 24 20 32 20C40 20 48 25 52 33" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      <path d="M47 29l5 4-6 2" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M52 31C48 39 40 44 32 44C24 44 16 39 12 31" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 35l-5-4 6-2" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <line x1="24" y1="51" x2="40" y2="51" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
      <line x1="26" y1="14" x2="38" y2="14" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
      <line x1="32" y1="8" x2="32" y2="20" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function WalletGlyph({ className = "w-full h-full", rounded, variant = "v1" }: Props) {
  return (
    <span
      className={`${className} shrink-0 inline-flex items-center justify-center ${rounded ? "rounded-full" : "rounded-lg"}`}
      aria-hidden
    >
      {variant === "v1" ? <GlyphV1 /> : variant === "v2" ? <GlyphV2 /> : <GlyphV3 />}
    </span>
  );
}

/** J-Wallet logo image (no link). For use in modals, etc. */
export function JWalletLogo({ className = "w-10 h-10", rounded, variant = "v1" }: Props) {
  return (
    <WalletGlyph className={className} rounded={rounded} variant={variant} />
  );
}

/** J-Wallet app icon. Used in the header. */
export function JWalletIcon({ className = "w-8 h-8", variant = "v1" }: Props) {
  return (
    <Link
      href="/home"
      className={`flex items-center justify-center shrink-0 ${className} hover:opacity-80 transition-opacity rounded-lg`}
      aria-label="J-Wallet home"
    >
      <WalletGlyph variant={variant} />
    </Link>
  );
}
