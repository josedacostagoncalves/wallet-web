"use client";

import { saveLanguage, type LanguageCode } from "@/app/actions/profiles";
import { useToast } from "@/contexts/ToastContext";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Props = {
    language: LanguageCode | null;
};

export function LanguageSelector({ language }: Props) {
    const t = useTranslations('settings');
    const tLang = useTranslations('language');
    const { showToast } = useToast();
    const router = useRouter();
    const [value, setValue] = useState<LanguageCode>(language ?? "en");
    const [isPending, startTransition] = useTransition();

    const OPTIONS: { value: LanguageCode; label: string; badge: string }[] = [
        { value: "en", label: tLang('english'), badge: "EN" },
        { value: "pt", label: tLang('portuguese'), badge: "PT" },
        { value: "es", label: tLang('spanish'), badge: "ES" },
        { value: "fr", label: tLang('french'), badge: "FR" },
    ];

    async function handleChange(next: LanguageCode) {
        const prev = value;
        setValue(next);
        const res = await saveLanguage(next);
        if (res.error) {
            setValue(prev);
            showToast(res.error, "error");
            return;
        }
        showToast(tLang('languageUpdated'), "success");

        // Refresh the page to apply the new language
        startTransition(() => {
            router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('language')}</h2>
            <div className="grid grid-cols-4 gap-3 max-w-md">
                {OPTIONS.map((opt) => {
                    const active = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleChange(opt.value)}
                            disabled={isPending}
                            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors h-28 w-full ${active
                                ? "border-slate-800 bg-slate-50 dark:border-slate-300 dark:bg-slate-800"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                                }`}
                            aria-pressed={active}
                        >
                            <span className={active ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                                <span
                                    className="text-[20px] font-semibold tracking-[0.12em] leading-none"
                                    aria-hidden
                                >
                                    {opt.badge}
                                </span>
                            </span>
                            <span className={`text-sm font-medium ${active ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                                {opt.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
