import { createClient } from "@/lib/supabase/server";
import { getOrEnsureProfile } from "@/app/actions/profiles";
import { DevicesSection } from "@/components/DevicesSection";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";
import { ThemeSelector } from "@/components/ThemeSelector";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getOrEnsureProfile(user.id, user.user_metadata as { first_name?: string | null; last_name?: string | null } | undefined);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ProfileSettingsForm
        first_name={profile.first_name}
        last_name={profile.last_name}
        avatar_url={profile.avatar_url}
        birth_date={profile.birth_date}
        country={profile.country}
        email={user.email ?? ""}
      />
      <hr className="border-slate-200 dark:border-slate-700" />
      <ThemeSelector />
      <hr className="border-slate-200 dark:border-slate-700" />
      <DevicesSection />
    </div>
  );
}
