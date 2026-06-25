import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  createTestCanvas,
  deleteTestCanvas,
  createTestShareLink,
} from "../helpers/setup";

describe("Risk #2 — expiry rejection", () => {
  let userId: string;
  let canvasId: string;
  let expiredToken: string;
  let validToken: string;

  const timestamp = Date.now();
  const email = `share-link-${timestamp}@test.invalid`;
  const password = `Test1234!${timestamp}`;

  beforeAll(async () => {
    userId = (await createTestUser(email, password)).id;
    canvasId = (await createTestCanvas(userId)).id;
    expiredToken = (await createTestShareLink(canvasId, new Date(Date.now() - 60_000).toISOString())).token;
    validToken = (await createTestShareLink(canvasId, null)).token;
  });

  afterAll(async () => {
    if (canvasId) await deleteTestCanvas(canvasId).catch(() => undefined);
    if (userId) await deleteTestUser(userId).catch(() => undefined);
  });

  it("GET /api/share/{token} with expired token returns 404", async () => {
    const response = await SELF.fetch(`http://localhost/api/share/${expiredToken}`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("GET /api/share/{token} with valid token returns 200 with canvas and shareLink", async () => {
    const response = await SELF.fetch(`http://localhost/api/share/${validToken}`);
    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    const body = json as { canvas: unknown; shareLink: unknown };
    expect(body.canvas).not.toBeNull();
    expect(typeof body.canvas).toBe("object");
    expect(body.shareLink).not.toBeNull();
    expect(typeof body.shareLink).toBe("object");
  });
});

describe("Risk #3 — write access without auth session", () => {
  let userId: string;
  let canvasId: string;

  const timestamp = Date.now();
  const email = `write-guard-${timestamp}@test.invalid`;
  const password = `Test1234!${timestamp}`;

  beforeAll(async () => {
    userId = (await createTestUser(email, password)).id;
    canvasId = (await createTestCanvas(userId)).id;
  });

  afterAll(async () => {
    if (canvasId) await deleteTestCanvas(canvasId).catch(() => undefined);
    if (userId) await deleteTestUser(userId).catch(() => undefined);
  });

  it("PATCH /api/canvases/{id} without auth session returns 401", async () => {
    const response = await SELF.fetch(`http://localhost/api/canvases/${canvasId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({
        blocks: {
          key_partners: "",
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
    expect(response.status).toBe(401);
  });

  it("DELETE /api/canvases/{id} without auth session returns 401", async () => {
    const response = await SELF.fetch(`http://localhost/api/canvases/${canvasId}`, {
      method: "DELETE",
      headers: {
        Origin: "http://localhost",
      },
    });
    expect(response.status).toBe(401);
  });
});
