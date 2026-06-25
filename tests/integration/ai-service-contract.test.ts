import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { createTestUser, deleteTestUser } from "../helpers/setup";
import { getAuthCookies } from "../helpers/auth";

const BMC_KEYS = [
  "key_partners",
  "key_activities",
  "key_resources",
  "value_propositions",
  "customer_relationships",
  "channels",
  "customer_segments",
  "cost_structure",
  "revenue_streams",
] as const;

const VALID_FIXTURE = {
  name: "Test Canvas",
  key_partners: "Partner A",
  key_activities: "Activity B",
  key_resources: "Resource C",
  value_propositions: "Value D",
  customer_relationships: "Relation E",
  channels: "Channel F",
  customer_segments: "Segment G",
  cost_structure: "Cost H",
  revenue_streams: "Revenue I",
};

function makeOpenAIResponse(content: object): string {
  return JSON.stringify({
    choices: [{ message: { content: JSON.stringify(content) } }],
  });
}

// @cloudflare/vitest-pool-workers v0.16+ wraps globalThis.fetch in a configurable
// function (src/worker/fetch-mock.ts in test-internal.mjs) — vi.spyOn works here.
function spyOpenRouterFetch(responseBody: string): void {
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://openrouter.ai")) {
      return new Response(responseBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch.call(globalThis, input, init);
  });
}

describe("Risk #1 — AI service contract", () => {
  let userId: string;
  let authCookies: string;

  const timestamp = Date.now();
  const email = `ai-contract-${timestamp}@test.invalid`;
  const password = `Test1234!${timestamp}`;

  beforeAll(async () => {
    userId = (await createTestUser(email, password)).id;
    authCookies = await getAuthCookies(email, password);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (userId) await deleteTestUser(userId).catch(() => undefined);
  });

  it("POST /api/canvases returns 201 with all 9 BMC keys non-empty when AI returns valid fixture", async () => {
    spyOpenRouterFetch(makeOpenAIResponse(VALID_FIXTURE));

    const response = await SELF.fetch("http://localhost/api/canvases", {
      method: "POST",
      headers: {
        Cookie: authCookies,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({ idea: "A SaaS platform for project management tools" }),
    });

    expect(response.status).toBe(201);
    const json: unknown = await response.json();
    const body = json as { id: string; name: string; blocks: Record<string, string> };
    for (const key of BMC_KEYS) {
      expect(typeof body.blocks[key]).toBe("string");
      expect(body.blocks[key]).not.toBe("");
    }
  });

  it("POST /api/canvases returns 500 when AI fixture is missing a required key (Zod rejects)", async () => {
    const { key_partners: _omitted, ...incompleteFixture } = VALID_FIXTURE;
    spyOpenRouterFetch(makeOpenAIResponse(incompleteFixture));

    const response = await SELF.fetch("http://localhost/api/canvases", {
      method: "POST",
      headers: {
        Cookie: authCookies,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({ idea: "A SaaS platform for project management tools" }),
    });

    expect(response.status).toBe(500);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("AI generation failed");
  });
});
