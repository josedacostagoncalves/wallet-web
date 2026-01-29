import { createClient } from "@/lib/supabase/server";
import { getOrEnsureProfile } from "@/app/actions/profiles";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getOrEnsureProfile(user.id, user.user_metadata as { first_name?: string | null; last_name?: string | null } | undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile settings</h1>
      <ProfileSettingsForm
        first_name={profile.first_name}
        last_name={profile.last_name}
        avatar_url={profile.avatar_url}
      />
    </div>
  );
}
