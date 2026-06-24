import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { inject } from "vitest";

export async function getAuthCookies(email: string, password: string): Promise<string> {
  const url = inject<string>("SUPABASE_URL");
  const anonKey = inject<string>("SUPABASE_KEY");
  if (!url) throw new Error("Missing SUPABASE_URL — is it set in env / repository secrets?");
  if (!anonKey) throw new Error("Missing SUPABASE_KEY — is it set in env / repository secrets?");

  const signInClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await signInClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`getAuthCookies sign-in failed: ${error.message}`);

  const { access_token, refresh_token } = data.session;

  const capturedCookies: { name: string; value: string }[] = [];

  const serverClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          capturedCookies.push({ name, value });
        });
      },
    },
  });

  await serverClient.auth.setSession({ access_token, refresh_token });

  return capturedCookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}
