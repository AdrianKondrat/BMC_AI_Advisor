import type { GlobalSetupContext } from "vitest/node";

export default function setup({ provide }: GlobalSetupContext) {
  provide("SUPABASE_URL", process.env.SUPABASE_URL ?? "");
  provide("SUPABASE_KEY", process.env.SUPABASE_KEY ?? "");
  provide("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}
