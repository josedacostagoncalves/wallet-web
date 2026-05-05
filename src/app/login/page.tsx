"use client";

/** Login page: email/password and OAuth entry with Suspense-wrapped form. */
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { useTranslations } from "next-intl";

function LoginFallback() {
  const tCommon = useTranslations("common");
  return (
    <div className="w-full max-w-sm space-y-6 animate-pulse">
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-24 mx-auto" />
      <div className="space-y-4">
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      <p className="text-center text-sm text-slate-500">{tCommon("loading")}</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
