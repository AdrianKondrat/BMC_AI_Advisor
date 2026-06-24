export default function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  provide("SUPABASE_URL", process.env.SUPABASE_URL ?? "");
  provide("SUPABASE_KEY", process.env.SUPABASE_KEY ?? "");
  provide("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}
