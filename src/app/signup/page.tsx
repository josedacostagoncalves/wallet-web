"use client";

/** Sign up: register a new user then redirect into the app. */
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/contexts/ToastContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function SignupPage() {
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryError = params.get("error");
    if (!queryError) return;
    setError(queryError);
    showToast(queryError, "error");
  }, [showToast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        },
      },
    });
    setLoading(false);
    if (err) {
      const lower = err.message.toLowerCase();
      const alreadyRegistered =
        lower.includes("already registered") ||
        lower.includes("already been registered") ||
        lower.includes("already exists");
      if (alreadyRegistered) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr || !signInData.user) {
          const msg = tAuth("signupEmailExistsWrongPassword");
          setError(msg);
          showToast(msg, "error");
          return;
        }

        const userId = signInData.user.id;
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .maybeSingle();

        const mergedFirstName =
          currentProfile?.first_name?.trim() ? currentProfile.first_name : (firstName.trim() || null);
        const mergedLastName =
          currentProfile?.last_name?.trim() ? currentProfile.last_name : (lastName.trim() || null);

        await supabase
          .from("profiles")
          .upsert({ id: userId, first_name: mergedFirstName, last_name: mergedLastName }, { onConflict: "id" });

        showToast(tAuth("signupMergedAndLoggedIn"));
        router.push("/home");
        router.refresh();
        return;
      }

      setError(err.message);
      showToast(err.message, "error");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  async function handleGoogleSignup() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?mode=signup&next=${encodeURIComponent("/home")}`;
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

  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">{tAuth("checkEmail")}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {tAuth("checkEmailMessage", { email })}
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            {tAuth("goToLogin")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-semibold text-center">{tAuth("signup")}</h1>
        <button
          type="button"
          onClick={handleGoogleSignup}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                {tAuth("firstName")}
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                {tAuth("lastName")}
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
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
              autoComplete="email"
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
              minLength={6}
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
            {loading ? tAuth("creatingAccount") : tAuth("signup")}
          </button>
        </form>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {tAuth("alreadyHaveAccount")} {" "}
          <Link href="/login" className="text-slate-800 dark:text-slate-200 underline">
            {tAuth("login")}
          </Link>
        </p>
        <p className="text-center text-sm">
          <Link href="/" className="text-slate-500 hover:underline">← {tAuth("back")}</Link>
        </p>
      </div>
    </main>
  );
}
