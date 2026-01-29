import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { getOrEnsureProfile } from "@/app/actions/profiles";
import { WalletProvider } from "@/contexts/WalletContext";
import { Header } from "@/components/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getOrEnsureProfile(user.id, user.user_metadata as { first_name?: string | null; last_name?: string | null } | undefined);
  const firstName = (profile.first_name ?? "").trim() || null;

  const { data: wallets } = await supabase
    .from("wallets")
    .select("*")
    .eq("is_active", true)
    .order("name");
  const list = wallets ?? [];

  const cookie = await getWalletCookie();
  const currentWalletId =
    (cookie && list.some((w) => w.id === cookie)) ? cookie : list[0]?.id ?? null;

  return (
    <WalletProvider currentWalletId={currentWalletId} wallets={list} user={user} firstName={firstName}>
      <Header />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
    </WalletProvider>
  );
}
