import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser, createTestCanvas, deleteTestCanvas, canvasExists } from "../helpers/setup";
import { getAuthCookies } from "../helpers/auth";

describe("Risk #4 — cross-user IDOR", () => {
  let userAId: string;
  let userBId: string;
  let userBCookies: string;
  let canvasId: string;

  const timestamp = Date.now();
  const userAEmail = `user-a-${timestamp}@test.invalid`;
  const userBEmail = `user-b-${timestamp}@test.invalid`;
  const password = `Test1234!${timestamp}`;

  beforeAll(async () => {
    userAId = (await createTestUser(userAEmail, password)).id;
    userBId = (await createTestUser(userBEmail, password)).id;
    userBCookies = await getAuthCookies(userBEmail, password);
    canvasId = (await createTestCanvas(userAId)).id;
  });

  afterAll(async () => {
    if (canvasId) await deleteTestCanvas(canvasId).catch(() => undefined);
    if (userAId) await deleteTestUser(userAId).catch(() => undefined);
    if (userBId) await deleteTestUser(userBId).catch(() => undefined);
  });

  it("PATCH /api/canvases/{id} as User B returns 404", async () => {
    const response = await SELF.fetch(`http://localhost/api/canvases/${canvasId}`, {
      method: "PATCH",
      headers: {
        Cookie: userBCookies,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({
        blocks: {
          key_partners: "x",
          key_activities: "",
          key_resources: "",
          value_propositions: "",
          customer_relationships: "",
          channels: "",
          customer_segments: "",
          cost_structure: "",
          revenue_streams: "",
        },
      }),
    });
    expect(response.status).toBe(404);
  });

  it("DELETE /api/canvases/{id} as User B returns 204 but canvas still exists", async () => {
    const response = await SELF.fetch(`http://localhost/api/canvases/${canvasId}`, {
      method: "DELETE",
      headers: {
        Cookie: userBCookies,
        Origin: "http://localhost",
      },
    });
    expect(response.status).toBe(204);
    expect(await canvasExists(canvasId)).toBe(true);
  });
});
