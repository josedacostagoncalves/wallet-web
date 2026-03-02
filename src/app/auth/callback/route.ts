import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeNextPath(nextParam: string | null): string {
  if (!nextParam) return "/home";
  return nextParam.startsWith("/") ? nextParam : "/home";
}

function pickMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const mode = requestUrl.searchParams.get("mode") === "signup" ? "signup" : "login";
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const baseErrorRedirect = new URL(mode === "signup" ? "/signup" : "/login", requestUrl.origin);

  const oauthError =
    requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  if (oauthError) {
    baseErrorRedirect.searchParams.set("error", oauthError);
    return NextResponse.redirect(baseErrorRedirect);
  }

  const redirectUrl = new URL(nextPath, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      baseErrorRedirect.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(baseErrorRedirect);
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    baseErrorRedirect.searchParams.set("error", userError?.message ?? "Authentication failed.");
    return NextResponse.redirect(baseErrorRedirect);
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = pickMetadataString(metadata, ["first_name", "given_name", "name"]);
  const lastName = pickMetadataString(metadata, ["last_name", "family_name"]);
  const avatarUrl = pickMetadataString(metadata, ["avatar_url", "picture"]);

  const { data: existing } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, string | null> = {};
    if (!existing.first_name && firstName) updates.first_name = firstName;
    if (!existing.last_name && lastName) updates.last_name = lastName;
    if (!existing.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
    if (Object.keys(updates).length > 0) {
      await supabase.from("profiles").update(updates).eq("id", user.id);
    }
  } else {
    await supabase.from("profiles").insert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl,
    });
  }

  return response;
}
