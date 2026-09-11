import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser, createTestCanvas, createTestShareLink, canvasExists } from "../helpers/setup";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import { inject } from "vitest";

function getAdmin() {
  const url = inject<string>("SUPABASE_URL");
  const key = inject<string>("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Account deletion cascade", () => {
  let userId: string;
  let canvasId: string;
  let shareLinkId: string;

  const timestamp = Date.now();
  const testEmail = `account-deletion-${timestamp}@test.invalid`;
  const password = `Test1234!${timestamp}`;

  beforeAll(async () => {
    // Create test user
    const user = await createTestUser(testEmail, password);
    userId = user.id;

    // Create canvas for user
    const canvas = await createTestCanvas(userId);
    canvasId = canvas.id;

    // Create share link for canvas
    const shareLink = await createTestShareLink(canvasId);
    shareLinkId = shareLink.id;
  });

  afterAll(async () => {
    // Cleanup: user should already be deleted; if not, clean up manually
    if (userId) {
      await deleteTestUser(userId).catch(() => undefined);
    }
  });

  it("cascades delete user → canvases → share_links", async () => {
    // Verify data exists before deletion
    expect(await canvasExists(canvasId)).toBe(true);

    const adminClient = getAdmin();
    const { data: shareLinksBeforeDelete } = await adminClient.from("share_links").select("id").eq("id", shareLinkId);
    expect(shareLinksBeforeDelete).toHaveLength(1);

    // Delete the user
    await deleteTestUser(userId);

    // Verify user is deleted
    const { data: authUserData } = await adminClient.auth.admin.getUserById(userId);
    expect(authUserData.user).toBeNull();

    // Verify canvas is deleted (cascade)
    expect(await canvasExists(canvasId)).toBe(false);

    // Verify share link is deleted (cascade)
    const { data: shareLinksAfterDelete } = await adminClient.from("share_links").select("id").eq("id", shareLinkId);
    expect(shareLinksAfterDelete).toHaveLength(0);
  });
});
