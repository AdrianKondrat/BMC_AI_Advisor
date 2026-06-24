---
date: 2026-06-24T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: 96d88d75e5e6b2eced7581440f52e9520f3779da
branch: testing-infra-access-control
repository: 10xDevs
topic: "Share link integrity — expiry rejection and read-only enforcement (Phase 2)"
tags: [research, share-links, access-control, expiry, rls, supabase, integration-tests]
status: complete
last_updated: 2026-06-24
last_updated_by: Claude Sonnet 4.6
---

# Research: Share link integrity — expiry rejection and read-only enforcement

**Date**: 2026-06-24  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: `96d88d75e5e6b2eced7581440f52e9520f3779da`  
**Branch**: `testing-infra-access-control`  
**Repository**: 10xDevs

---

## Research Question

Phase 2 of the test rollout (test-plan.md §3). Goal: understand the current implementation of share link expiry enforcement (Risk #2) and write-endpoint auth enforcement (Risk #3) well enough to define the test oracle and design integration tests.

**Risk #2**: Expired share token still returns canvas data from the public route — founder IP exposed past chosen expiry.  
**Risk #3**: A recipient with a share token can reach write API endpoints (no auth session) — read-only guarantee broken.

---

## Summary

**Both risks are already correctly implemented in the current codebase.** Phase 2 tests are regression guards — they prove existing correct behavior holds and would catch any future refactor that accidentally removes the protection.

**Risk #2 (expiry)**: Enforced at two independent layers. (1) The Supabase RLS policy for the `anon` role filters `expires_at IS NULL OR expires_at > now()`, making expired rows invisible to the anon client. (2) The application-layer `isExpired()` function in the public API handler provides a belt-and-suspenders check before returning canvas data. Both layers must be tested — a test that only exercises one layer gives incomplete coverage.

**Risk #3 (write access)**: Every write handler (`PATCH`, `DELETE`, `POST` across all canvas API routes) checks `if (!context.locals.user) return 401` as its very first operation — before any Supabase query is run. The middleware does NOT protect API routes (only page routes are in `PROTECTED_ROUTES`); the handlers are self-defending. A share token recipient holding only a URL token (not a session cookie) will always have `context.locals.user === null` and receive a 401.

---

## Detailed Findings

### Schema: `share_links` table

**Migration**: `supabase/migrations/20260607000000_canvas_schema.sql:18-26`

```sql
CREATE TABLE share_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id  uuid        NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at timestamptz,           -- nullable: NULL = never expires
  pin_hash   text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Key column: **`expires_at` is `timestamptz`, nullable with no default**. `NULL` means the link never expires. The application always sets a 7-day expiry when creating links (`sevenDaysFromNow()` in `src/pages/api/canvases/[id]/share.ts:8-10`), but the column schema does not enforce this.

Token format: 64-char hex string (`encode(gen_random_bytes(32), 'hex')`). Accepted format per app regex: `/^[0-9a-zA-Z_-]+$/` (`src/pages/api/share/[token].ts:4`).

---

### Risk #2: Expiry enforcement chain

The expiry check runs at two independent layers. An integration test exercises the application layer; RLS provides a database-level safety net.

#### Layer 1 — RLS (database)

**`share_links` anon SELECT policy** (`supabase/migrations/20260607000000_canvas_schema.sql:100-103`):

```sql
CREATE POLICY "public can read valid share_links"
  ON share_links FOR SELECT
  TO anon
  USING (expires_at IS NULL OR expires_at > now());
```

**`canvases` anon SELECT policy** (`supabase/migrations/20260613000000_share_canvas_anon_read.sql:1-10`):

```sql
CREATE POLICY "anon can read shared canvases"
  ON canvases FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT canvas_id FROM share_links
      WHERE expires_at IS NULL OR expires_at > now()
    )
  );
```

When the test seeds a share_link with past `expires_at` via the service-role client and then queries it via the anon client (`createAnonClient()`), the RLS policy makes the row invisible — the SELECT returns an error. This is the primary enforcement mechanism.

#### Layer 2 — application (belt-and-suspenders)

**`src/pages/api/share/[token].ts:8-13`** — `isExpired()`:

```typescript
const isExpired = (expiresAt: string | null) => {
  if (!expiresAt) return false; // null = never expires
  return new Date(expiresAt) < new Date();
};
```

**`src/pages/api/share/[token].ts:26-33`** — handler logic:

```typescript
const { data: shareLink, error: shareError } = await supabase
  .from("share_links")
  .select("canvas_id, expires_at")
  .eq("token", token)
  .single();

if (shareError || isExpired(shareLink.expires_at)) {
  return new Response(null, { status: 404 });
}
```

If RLS blocks the SELECT, `shareError` is truthy → 404. If RLS is ever misconfigured and an expired row slips through, `isExpired()` is the backstop.

**Same pattern in the Astro page route** (`src/pages/share/[token].astro:28-31`):

```typescript
const isExpired = (expiresAt: string | null) => (expiresAt ? new Date(expiresAt) < new Date() : false);

if (shareError || isExpired(shareLink.expires_at)) {
  invalid = true;
}
```

The Astro page renders "Link expired or invalid" HTML when `invalid === true`, but the HTTP status code is **still 200** (Astro returns the page normally). The canvas data is withheld from the HTML, but no canvas JSON payload is returned either way for a page route. **The integration test should target `/api/share/[token]`** (returns `404` with empty body) rather than `/share/[token]` (returns `200` with error HTML) to satisfy the test-plan oracle ("non-200 status and no canvas payload").

#### Test oracle (Risk #2)

Seed: canvas + share_link with `expires_at` = 1 day in the past (direct service-role INSERT).  
Action: `SELF.fetch("GET /api/share/{token}")` — no auth cookie (public endpoint, none needed).  
Assert: status `404`, body does not contain `"canvas"`.

Second assertion (happy path, required to prove the fixture is correct and that valid links still work):  
Seed: same canvas + share_link with `expires_at = null` (never expires) or future date.  
Action: `SELF.fetch("GET /api/share/{token}")`.  
Assert: status `200`, body contains `{ canvas, shareLink }`.

---

### Risk #3: Write-endpoint auth enforcement

**Middleware does NOT protect API routes.** (`src/middleware.ts:4`)

```typescript
const PROTECTED_ROUTES = ["/dashboard", "/canvas"];
```

Only page routes (`/dashboard`, `/canvas`) get a redirect when unauthenticated. API routes under `/api/` are not in this list — the middleware still resolves and attaches `context.locals.user` (or `null`), but does not redirect/reject.

**Every write handler self-defends.** First lines of each handler:

| File                                      | Handler | Line    | Guard                                                                  |
| ----------------------------------------- | ------- | ------- | ---------------------------------------------------------------------- |
| `src/pages/api/canvases/[id].ts`          | PATCH   | 53-55   | `if (!context.locals.user) return new Response(null, { status: 401 })` |
| `src/pages/api/canvases/[id].ts`          | DELETE  | 29-31   | same                                                                   |
| `src/pages/api/canvases/index.ts`         | POST    | 13-15   | same                                                                   |
| `src/pages/api/canvases/[id]/critique.ts` | POST    | 23-25   | same                                                                   |
| `src/pages/api/canvases/[id]/share.ts`    | GET     | 13-15   | same                                                                   |
| `src/pages/api/canvases/[id]/share.ts`    | POST    | 59-61   | same                                                                   |
| `src/pages/api/canvases/[id]/share.ts`    | PATCH   | 98-100  | same                                                                   |
| `src/pages/api/canvases/[id]/share.ts`    | DELETE  | 143-145 | same                                                                   |

**Exception**: `GET /api/share/[token]` has **no auth check** — intentionally public. Uses `createAnonClient()` (anon credentials only).

**How `context.locals.user` resolves to `null`** for a share-token recipient:  
Middleware calls `supabase.auth.getUser()` which reads the Cookie header. A share token is a URL path segment, not a cookie. The recipient has no `sb-*` session cookies → `getUser()` returns `null` → `context.locals.user = null` → any write handler returns 401 before touching the database.

All write handlers also follow the `lessons.md` pattern with explicit `.eq("owner_id", context.locals.user.id)` filters, providing defense-in-depth against the RLS mutation no-op issue. But they cannot be reached unauthenticated at all.

**Inconsistency to note**: `DELETE /api/canvases/[id]/share` returns **404** (not 401) when the user does not own the canvas (line 143-145 is the auth check → 401; lines 158-163 ownership check → 404). This differs from other handlers which return 401 for ownership failures. Not a security issue (access is denied either way), but the test should assert 401 for the unauthenticated case and be aware of the 404 for the wrong-owner case.

#### Test oracle (Risk #3)

Action: `SELF.fetch("PATCH /api/canvases/{id}")` and `SELF.fetch("DELETE /api/canvases/{id}")` — no Cookie header (simulates share recipient with only the URL).  
Assert: status `401` for both.  
Optional secondary: `SELF.fetch("PATCH /api/canvases/{id}/share")` — no Cookie → 401.

---

### Existing Phase 1 infrastructure (what Phase 2 can reuse)

All helpers use `supabaseAdmin` with the service-role key (bypasses RLS for test setup).

**`tests/helpers/auth.ts`**:

- `getAuthCookies(email, password): Promise<string>` — signs in via anon client, returns cookie string for `Cookie` header.

**`tests/helpers/setup.ts`**:

- `createTestUser(email, password): Promise<{ id }>` — creates pre-verified Supabase auth user.
- `deleteTestUser(userId): Promise<void>`
- `createTestCanvas(ownerId): Promise<{ id }>` — direct INSERT with service role, no AI call.
- `deleteTestCanvas(canvasId): Promise<void>`
- `canvasExists(canvasId): Promise<boolean>` — assertion helper.

**Phase 1 test pattern** (`tests/integration/access-control.test.ts`):

```typescript
beforeAll(async () => {
  userId = (await createTestUser(email, password)).id;
  cookies = await getAuthCookies(email, password);
  canvasId = (await createTestCanvas(userId)).id;
});
afterAll(async () => {
  await deleteTestCanvas(canvasId).catch(() => undefined);
  await deleteTestUser(userId).catch(() => undefined);
});
it("...", async () => {
  const response = await SELF.fetch(`http://localhost/api/canvases/${canvasId}`, {
    method: "PATCH",
    headers: { Cookie: cookies, "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ ... }),
  });
  expect(response.status).toBe(404);
});
```

**Key cookbook notes from Phase 1** (already in test-plan §6.2):

- Add `Origin: http://localhost` to every mutation request (CSRF protection).
- Build before test: `npm run build && npm test`.
- Cleanup always uses `.catch(() => undefined)` so it never blocks test reporting.

---

### What Phase 2 needs to add

A new helper in `tests/helpers/setup.ts`:

```typescript
// createTestShareLink — direct INSERT via service role; accepts past expires_at for expired-token tests
async function createTestShareLink(
  canvasId: string,
  expiresAt: string | null = null,
): Promise<{ id: string; token: string }> {
  const { data, error } = await supabaseAdmin
    .from("share_links")
    .insert({ canvas_id: canvasId, expires_at: expiresAt })
    .select("id, token")
    .single();
  if (error) throw error;
  return data;
}

async function deleteTestShareLink(shareLinkId: string): Promise<void> {
  await supabaseAdmin.from("share_links").delete().eq("id", shareLinkId);
}
```

Note: `expires_at = null` creates a never-expiring link. For expired-token tests, pass a past ISO timestamp: `new Date(Date.now() - 86400_000).toISOString()` (1 day ago).

---

## Code References

- `supabase/migrations/20260607000000_canvas_schema.sql:18-26` — `share_links` table DDL
- `supabase/migrations/20260607000000_canvas_schema.sql:100-103` — anon RLS policy on `share_links`
- `supabase/migrations/20260613000000_share_canvas_anon_read.sql:1-10` — anon RLS policy on `canvases` (links through share_links)
- `supabase/migrations/20260614000000_rotate_share_link.sql` — RPC function for rotating share links
- `src/pages/api/share/[token].ts:4` — TOKEN_REGEX validation
- `src/pages/api/share/[token].ts:8-13` — `isExpired()` application-layer check
- `src/pages/api/share/[token].ts:26-33` — expiry check + 404 on expired/missing token
- `src/pages/share/[token].astro:28-31` — same expiry logic in Astro page (returns 200 with error HTML)
- `src/pages/api/canvases/[id].ts:29-31` — DELETE auth guard (→ 401)
- `src/pages/api/canvases/[id].ts:53-55` — PATCH auth guard (→ 401)
- `src/pages/api/canvases/[id]/share.ts:59-61` — POST share auth guard (→ 401)
- `src/pages/api/canvases/[id]/share.ts:143-145` — DELETE share auth guard (→ 401)
- `src/middleware.ts:4` — `PROTECTED_ROUTES` (page routes only, no `/api/` entries)
- `src/lib/supabase.ts:6-24` — `createClient()`, reads session from Cookie header
- `tests/helpers/setup.ts` — `createTestUser`, `createTestCanvas`, `supabaseAdmin`
- `tests/helpers/auth.ts` — `getAuthCookies`
- `tests/integration/access-control.test.ts` — Phase 1 reference test (IDOR suite)

---

## Architecture Insights

**Defense-in-depth for expiry**: The dual-layer enforcement (RLS + `isExpired()`) means a single-layer bypass does not immediately expose data. RLS makes expired rows invisible to the anon client; the app check catches the case where RLS might not apply (e.g., if the client is incorrectly created with elevated privileges). Integration tests primarily exercise the application layer but benefit from both.

**API route self-defense pattern**: The middleware's job is to resolve the user and redirect page routes. API routes have no middleware-level 401 — they must each return it themselves. The consistent `if (!context.locals.user) return 401` at the top of every write handler is the team's chosen pattern. Phase 2 tests prove this pattern actually runs before any DB access.

**Anon client isolation**: The public share route uses `createAnonClient()` (anon key, no session cookies). This correctly separates the public read surface from the authenticated write surface. A share token in the URL is just a DB lookup key; it never becomes a session identity.

**RLS mutation no-op risk (from lessons.md)**: Not directly relevant to Phase 2 (the risk is write operations where RLS silently no-ops). Worth noting: the `share_links` table's anon policy is SELECT-only — no INSERT/UPDATE/DELETE for anon. The write endpoints all check auth explicitly before reaching the DB.

---

## Historical Context

- `context/changes/testing-infra-access-control/` (Phase 1) — established Vitest + `@cloudflare/vitest-pool-workers` environment, `createTestUser`/`createTestCanvas` helpers, SELF.fetch() pattern, and the Supabase ESM/CJS workaround in `vitest.config.ts`. Phase 2 builds directly on this without any new infra setup.
- `context/changes/s-04/` — roadmap slice S-04, which included the share link expiry risk note ("expiry must be enforced server-side") that became Risk #2.
- `context/foundation/lessons.md` — "RLS mutation no-op" lesson: write endpoints must add explicit `owner_id` filters. Relevant context for why Phase 2 write-endpoint tests also verify ownership, not just authentication.

---

## Open Questions

1. **HTTP status of the Astro page route on expired token**: `src/pages/share/[token].astro` renders a "Link expired or invalid" page when `invalid === true`, but the HTTP response status is likely `200` (no `Astro.response.status` override observed). If the product requirement is that the page returns a non-200 for expired tokens, this is a gap. The API endpoint (`/api/share/[token]`) correctly returns 404. Phase 2 integration tests should target the API endpoint; the page route question can be deferred or raised as a separate bug.

2. **`DELETE /api/canvases/[id]/share` returns 404 vs 401 on ownership failure**: The auth check (line 143-145) returns 401 for unauthenticated, but the ownership check (line 158-163) returns 404 for wrong-owner. Other share handlers return 401 for wrong-owner. This inconsistency doesn't affect Phase 2 tests (which test the unauthenticated case → 401), but worth noting for a future consistency pass.

3. **Pin-protected share links**: The `share_links` table has a `pin_hash` column and there is no mention of pin enforcement in the routes examined. Phase 2 tests should not cover pin scenarios — this is out of scope per the test-plan. If pin enforcement is added later, it needs its own research pass.
