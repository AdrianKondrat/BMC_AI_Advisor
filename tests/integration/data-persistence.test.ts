import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  createTestCanvas,
  deleteTestCanvas,
  getTestCanvasBlocks,
} from "../helpers/setup";
import { getAuthCookies } from "../helpers/auth";

describe("Risk #5 — silent data loss", () => {
  let userId: string;
  let cookies: string;
  let canvasId: string;

  const timestamp = Date.now();
  const email = `persist-${timestamp}@test.invalid`;
  const password = `Test1234!${timestamp}`;

  beforeAll(async () => {
    userId = (await createTestUser(email, password)).id;
    cookies = await getAuthCookies(email, password);
    canvasId = (await createTestCanvas(userId)).id;
  });

  afterAll(async () => {
    if (canvasId) await deleteTestCanvas(canvasId).catch(() => undefined);
    if (userId) await deleteTestUser(userId).catch(() => undefined);
  });

  it("PATCH /api/canvases/{id} persists block content to the database", async () => {
    const sentinel = `ROUND_TRIP_SENTINEL_${timestamp}`;
    const response = await SELF.fetch(`http://localhost/api/canvases/${canvasId}`, {
      method: "PATCH",
      headers: {
        Cookie: cookies,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({
        blocks: {
          key_partners: sentinel,
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
    expect(response.status).toBe(200);

    const blocks = await getTestCanvasBlocks(canvasId);
    expect(blocks?.key_partners).toBe(sentinel);
  });
});
