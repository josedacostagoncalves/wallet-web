"use client";

import { logActivityAction } from "@/app/actions/auth";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const tAuth = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/home";
  const queryError = searchParams.get("error");

  useEffect(() => {
    if (!queryError) return;
    setError(queryError);
    showToast(queryError, "error");
  }, [queryError, showToast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      showToast(err.message, "error");
      return;
    }
    await logActivityAction({ action: "login", payload: {} });
    showToast(tAuth("loggedInSuccess"));
    router.push(redirect);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?mode=login&next=${encodeURIComponent(redirect)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: { prompt: "select_account" },
      },
    });
    setGoogleLoading(false);
    if (oauthError) {
      setError(oauthError.message);
      showToast(oauthError.message, "error");
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-xl font-semibold text-center">{tAuth("login")}</h1>
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.2 0-.5-.1-.9-.1-1.3H12z" />
        </svg>
        <span>{googleLoading ? tAuth("redirectingToGoogle") : tAuth("continueWithGoogle")}</span>
      </button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white dark:bg-slate-950 text-slate-500">{tAuth("orUseEmail")}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? tAuth("signingIn") : tAuth("login")}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        {tAuth("dontHaveAccount")} {" "}
        <Link href="/signup" className="text-slate-800 dark:text-slate-200 underline">
          {tAuth("signup")}
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/" className="text-slate-500 hover:underline">← {tAuth("back")}</Link>
      </p>
    </div>
  );
}
