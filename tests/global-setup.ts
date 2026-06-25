import { loadEnv } from "vite";

export default function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  // globalSetup runs outside Vite's transform pipeline; process.env does not receive .env vars
  // automatically. loadEnv reads .env (and .env.local etc.) from the project root directly.
  const env = loadEnv("", process.cwd(), "");
  provide("SUPABASE_URL", env.SUPABASE_URL ? env.SUPABASE_URL : (process.env.SUPABASE_URL ?? ""));
  provide("SUPABASE_KEY", env.SUPABASE_KEY ? env.SUPABASE_KEY : (process.env.SUPABASE_KEY ?? ""));
  provide(
    "SUPABASE_SERVICE_ROLE_KEY",
    env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
  );
}
