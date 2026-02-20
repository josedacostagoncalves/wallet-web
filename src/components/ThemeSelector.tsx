"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import type { ThemeMode } from "@/app/actions/profiles";
import { useTranslations } from "next-intl";

const themeIcons: Record<ThemeMode, JSX.Element> = {
  light: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  ),
  dark: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  ),
  system: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  ),
};

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const t = useTranslations("settings");

  const optionLabels: Record<ThemeMode, string> = {
    light: t("themeOptions.light.label"),
    dark: t("themeOptions.dark.label"),
    system: t("themeOptions.system.label"),
  };

  const optionDescriptions: Record<ThemeMode, string> = {
    light: t("themeOptions.light.description"),
    dark: t("themeOptions.dark.description"),
    system: t("themeOptions.system.description"),
  };

  function handleSelect(value: ThemeMode) {
    setTheme(value);
    const themeLabel = value === "system" ? t("themeOptions.system.toastLabel") : optionLabels[value];
    showToast(t("themeToast", { theme: themeLabel }), "success");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t("appearance")}</h2>
      <div className="grid grid-cols-3 gap-3 max-w-md">
        {(["light", "dark", "system"] as ThemeMode[]).map((value) => {
          const icon = themeIcons[value];
          const label = optionLabels[value];
          const description = optionDescriptions[value];
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors h-28 w-full ${active
                ? "border-slate-800 bg-slate-50 dark:border-slate-300 dark:bg-slate-800"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                }`}
              aria-pressed={active}
            >
              <span className={active ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                {icon}
              </span>
              <span className={`text-sm font-medium ${active ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                {label}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
