import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

const supabaseAdmin = createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function createTestUser(email: string, password: string): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createTestUser failed: ${error.message}`);
  return { id: data.user.id };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`deleteTestUser failed: ${error.message}`);
}

export async function createTestCanvas(ownerId: string): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin
    .from("canvases")
    .insert({ owner_id: ownerId, name: "IDOR test fixture" })
    .select("id")
    .single();
  if (error) throw new Error(`createTestCanvas failed: ${error.message}`);
  return { id: data.id };
}

export async function deleteTestCanvas(canvasId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("canvases").delete().eq("id", canvasId);
  if (error) throw new Error(`deleteTestCanvas failed: ${error.message}`);
}

export async function canvasExists(canvasId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from("canvases").select("id").eq("id", canvasId).maybeSingle();
  if (error) throw new Error(`canvasExists failed: ${error.message}`);
  return data !== null;
}
