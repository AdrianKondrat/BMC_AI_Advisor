import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Risk #7 — unauthenticated redirect", () => {
  it("GET /dashboard returns 302 → /auth/signin", async () => {
    const response = await SELF.fetch("http://localhost/dashboard", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/signin");
  });

  it("GET /canvas/new returns 302 → /auth/signin", async () => {
    const response = await SELF.fetch("http://localhost/canvas/new", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/signin");
  });

  it("GET /canvas/00000000-0000-0000-0000-000000000001 returns 302 → /auth/signin", async () => {
    const response = await SELF.fetch("http://localhost/canvas/00000000-0000-0000-0000-000000000001", {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/signin");
  });
});
