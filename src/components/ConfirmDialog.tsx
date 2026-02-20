"use client";

import { JWalletLogo } from "@/components/JWalletIcon";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

export type ConfirmVariant = "confirm" | "cancel";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant: ConfirmVariant;
  loading?: boolean;
  /** Optional extra content rendered below the message. */
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = "Go back",
  variant,
  loading = false,
  children,
}: Props) {
  const tCommon = useTranslations("common");
  const overlayRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusable = overlayRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loadingRef.current) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  async function handleConfirm() {
    await onConfirm();
  }

  if (!open) return null;

  const isConfirm = variant === "confirm";
  const accentBorder = isConfirm ? "border-green-300" : "border-red-300";
  const iconColor = isConfirm ? "text-green-700" : "text-red-700";
  const primaryBtn = isConfirm
    ? "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
    : "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500";
  const cardBg = isConfirm ? "bg-green-50" : "bg-red-50";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={() => !loading && onClose()}
      />
      <div
        className={`relative w-full max-w-md rounded-xl border-2 ${accentBorder} ${cardBg} p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full overflow-hidden ${isConfirm ? "bg-green-100" : "bg-red-100"} ${iconColor}`}
          >
            <JWalletLogo className="h-8 w-8" rounded />
          </div>
          <div className="space-y-2">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-desc"
              className="text-sm text-slate-600"
            >
              {message}
            </p>
            {children}
          </div>
          <div className="flex w-full gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${primaryBtn}`}
            >
              {loading ? tCommon("pleaseWait") : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
