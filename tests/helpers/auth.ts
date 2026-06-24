import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export async function getAuthCookies(email: string, password: string): Promise<string> {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_KEY");

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
