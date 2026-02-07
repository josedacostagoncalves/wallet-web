"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import type { ThemeMode } from "@/app/actions/profiles";

const options: { value: ThemeMode; label: string; description: string; icon: JSX.Element }[] = [
  {
    value: "light",
    label: "Light",
    description: "Always use light mode",
    icon: (
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
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use dark mode",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device settings",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    ),
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  function handleSelect(value: ThemeMode) {
    setTheme(value);
    showToast(
      `Theme set to ${value === "system" ? "system (device default)" : value}.`,
      "success"
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Appearance</h2>
      <div className="grid grid-cols-3 gap-3 max-w-md">
        {options.map((o) => {
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => handleSelect(o.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
                active
                  ? "border-slate-800 bg-slate-50 dark:border-slate-300 dark:bg-slate-800"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              }`}
              aria-pressed={active}
            >
              <span className={active ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                {o.icon}
              </span>
              <span className={`text-sm font-medium ${active ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                {o.label}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{o.description}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        This preference is saved to your account and applies on all your devices.
      </p>
    </div>
  );
}
