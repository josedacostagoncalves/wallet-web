import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWalletCookie } from "@/app/actions/wallet-cookie";
import { getOrEnsureProfile } from "@/app/actions/profiles";
import { MovementModalsProvider } from "@/contexts/MovementModalsContext";
import { ThemeProvider, ThemeScript } from "@/contexts/ThemeContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { Header } from "@/components/Header";
import { MovementModals } from "@/components/MovementModals";
import { SidebarNav } from "@/components/SidebarNav";

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
  const theme = profile.theme ?? "system";

  const { data: wallets } = await supabase
    .from("wallets")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  const list = wallets ?? [];

  const cookie = await getWalletCookie();
  const currentWalletId =
    (cookie && list.some((w) => w.id === cookie)) ? cookie : list[0]?.id ?? null;

  return (
    <ThemeProvider initialTheme={theme}>
      <ThemeScript theme={theme} />
      <WalletProvider currentWalletId={currentWalletId} wallets={list} user={user} firstName={firstName}>
        <MovementModalsProvider>
          <Header />
          <div className="flex w-full">
            <SidebarNav />
            <main className="flex-1 py-6">
              <div className="max-w-6xl w-full mx-auto px-3">{children}</div>
            </main>
          </div>
          <MovementModals />
        </MovementModalsProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
