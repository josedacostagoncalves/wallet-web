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

    const OPTIONS: { value: LanguageCode; label: string }[] = [
        { value: "en", label: tLang('english') },
        { value: "pt", label: tLang('portuguese') },
        { value: "es", label: tLang('spanish') },
        { value: "fr", label: tLang('french') },
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
        <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('language')}</h2>
            <div className="max-w-md">
                <label htmlFor="language-select" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Preferred language
                </label>
                <select
                    id="language-select"
                    value={value}
                    onChange={(e) => handleChange(e.target.value as LanguageCode)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                    {OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                This preference is saved to your account and applies on all your devices.
            </p>
        </div>
    );
}
