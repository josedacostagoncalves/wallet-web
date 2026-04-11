"use client";

import { forwardRef, useRef, type ComponentPropsWithoutRef, type MutableRefObject } from "react";
import { useTranslations } from "next-intl";

export type TransactionDateInputProps = Omit<ComponentPropsWithoutRef<"input">, "type">;

/** Native `type="date"` with a wide right hit-area that opens the calendar; left area keeps default text/segment editing. */
export const TransactionDateInput = forwardRef<HTMLInputElement, TransactionDateInputProps>(
  function TransactionDateInput({ className, disabled, onClick, ...props }, forwardedRef) {
    const t = useTranslations("transactions.form.fields");
    const innerRef = useRef<HTMLInputElement | null>(null);

    const setRefs = (el: HTMLInputElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === "function") {
        forwardedRef(el);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLInputElement | null>).current = el;
      }
    };

    const openPicker = () => {
      const el = innerRef.current;
      if (!el || disabled) return;
      try {
        el.showPicker?.();
      } catch {
        el.focus();
        el.click();
      }
    };

    return (
      <div className="relative w-full min-w-0">
        <input
          ref={setRefs}
          type="date"
          disabled={disabled}
          className={className}
          {...props}
          onClick={(e) => {
            onClick?.(e);
          }}
        />
        {!disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("openDateCalendar")}
            className="absolute inset-y-0 right-0 z-[1] w-[max(2.75rem,calc(100%-7rem))] cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 rounded-r-lg"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openPicker();
            }}
          />
        )}
      </div>
    );
  }
);
