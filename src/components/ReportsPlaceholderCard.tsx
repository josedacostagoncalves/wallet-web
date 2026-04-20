"use client";

import { useTranslations } from "next-intl";

/** 360×360 reserved slot on the reports grid (content TBD). */
export function ReportsPlaceholderCard() {
  const t = useTranslations("reports.placeholder");

  return (
    <div className="w-[360px] h-[360px] shrink-0 flex flex-col rounded-xl border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-50/80 dark:bg-slate-900/30">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 font-medium">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{t("title")}</h2>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 text-center">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("description")}</p>
      </div>
    </div>
  );
}
