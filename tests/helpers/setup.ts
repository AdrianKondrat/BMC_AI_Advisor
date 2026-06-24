import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import { inject } from "vitest";

function getAdmin() {
  const url = inject<string>("SUPABASE_URL");
  const key = inject<string>("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing SUPABASE_URL — is it set in env / repository secrets?");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY — is it set in env / repository secrets?");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(email: string, password: string): Promise<{ id: string }> {
  const { data, error } = await getAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createTestUser failed: ${error.message}`);
  return { id: data.user.id };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await getAdmin().auth.admin.deleteUser(userId);
  if (error) throw new Error(`deleteTestUser failed: ${error.message}`);
}

export async function createTestCanvas(ownerId: string): Promise<{ id: string }> {
  const { data, error } = await getAdmin()
    .from("canvases")
    .insert({ owner_id: ownerId, name: "IDOR test fixture" })
    .select("id")
    .single();
  if (error) throw new Error(`createTestCanvas failed: ${error.message}`);
  return { id: (data as { id: string }).id };
}

export async function deleteTestCanvas(canvasId: string): Promise<void> {
  const { error } = await getAdmin().from("canvases").delete().eq("id", canvasId);
  if (error) throw new Error(`deleteTestCanvas failed: ${error.message}`);
}

export async function canvasExists(canvasId: string): Promise<boolean> {
  const { data, error } = await getAdmin().from("canvases").select("id").eq("id", canvasId).maybeSingle();
  if (error) throw new Error(`canvasExists failed: ${error.message}`);
  return data !== null;
}

export async function createTestShareLink(
  canvasId: string,
  expiresAt: string | null = null,
): Promise<{ id: string; token: string }> {
  const { data, error } = await getAdmin()
    .from("share_links")
    .insert({ canvas_id: canvasId, expires_at: expiresAt })
    .select("id, token")
    .single();
  if (error) throw new Error(`createTestShareLink failed: ${error.message}`);
  const result = data as { id: string; token: string };
  return { id: result.id, token: result.token };
}

export async function deleteTestShareLink(shareLinkId: string): Promise<void> {
  const { error } = await getAdmin().from("share_links").delete().eq("id", shareLinkId);
  if (error) throw new Error(`deleteTestShareLink failed: ${error.message}`);
}
