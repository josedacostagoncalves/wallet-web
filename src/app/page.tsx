import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const tAuth = await getTranslations("auth");
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">J-Wallet</h1>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
        >
          {tAuth("login")}
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          {tAuth("signup")}
        </Link>
      </div>
    </main>
  );
}
