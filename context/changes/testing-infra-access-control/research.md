---
date: 2026-06-23T17:30:03+00:00
researcher: claude-sonnet-4-6
git_commit: 75a119be6a844fa69684ebda283565bbb15dc150
branch: main
repository: BMC_AI_Advisor
topic: "Test infra bootstrap and access-control surface for Phase 1 rollout (Risks #4 IDOR, #7 unauthenticated redirect)"
tags: [research, access-control, idor, middleware, vitest, cloudflare-workers, supabase-rls]
status: complete
last_updated: 2026-06-23
last_updated_by: claude-sonnet-4-6
---

# Research: Test infra bootstrap and access-control surface (Phase 1)

**Date**: 2026-06-23T17:30:03+00:00
**Researcher**: claude-sonnet-4-6
**Git Commit**: 75a119be6a844fa69684ebda283565bbb15dc150
**Branch**: main
**Repository**: BMC_AI_Advisor

## Research Question

Where does the actual IDOR surface live for Risk #4, what is the complete PROTECTED_ROUTES state for Risk #7, and what does it take to bootstrap Vitest + `@cloudflare/vitest-pool-workers` from a zero-test baseline in this Astro 6 / Cloudflare Workers project?

---

## Summary

Four key findings reshape the Phase 1 test plan:

1. **There is no `GET /api/canvases/[id]` endpoint.** Canvas HTML is served by the Astro SSR page `src/pages/canvas/[id].astro`, not an API route. Cross-user authenticated access to that page returns a **302 redirect to `/dashboard`**, not 404/403. The 404 assertion from the test plan can be satisfied at the PATCH API level instead.

2. **Both the application layer AND Supabase RLS protect canvas reads.** The Astro page query uses an explicit `.eq("owner_id", user.id)` filter. The Supabase client is created with `createServerClient` + a proper cookie adapter, so `auth.uid()` is non-null and RLS also fires correctly. The RLS mutation no-op concern from `lessons.md` does not apply to SELECTs in this codebase — explicit filters are present everywhere.

3. **`PROTECTED_ROUTES = ["/dashboard", "/canvas"]` covers all current user-facing pages.** Prefix matching means `/canvas/new` and `/canvas/[id]` are both protected. No current page is missing from the list. The Risk #7 test value is confirming the mechanism works on every listed route, not finding a current gap.

4. **Test infra is at zero.** No vitest, no test files, no test script, no CI test step. The bootstrap work is non-trivial: `@cloudflare/vitest-pool-workers` integration for an Astro SSR app in workerd requires careful config, and cross-user IDOR tests (Risk #4) need two real Supabase test users — the plan must decide how to provision and clean them up.

---

## Detailed Findings

### 1. Canvas data surface — where IDOR actually lives

**No API GET for individual canvases exists.**

A search of `src/pages/api/canvases/` found only:

- [`src/pages/api/canvases/index.ts`](https://github.com/AdrianKondrat/BMC_AI_Advisor/blob/75a119be6a844fa69684ebda283565bbb15dc150/src/pages/api/canvases/index.ts) — exports `POST` only (create canvas)
- [`src/pages/api/canvases/[id].ts`](https://github.com/AdrianKondrat/BMC_AI_Advisor/blob/75a119be6a844fa69684ebda283565bbb15dc150/src/pages/api/canvases/%5Bid%5D.ts) — exports `DELETE`, `PATCH` (no GET)
- [`src/pages/api/canvases/[id]/critique.ts`](https://github.com/AdrianKondrat/BMC_AI_Advisor/blob/75a119be6a844fa69684ebda283565bbb15dc150/src/pages/api/canvases/%5Bid%5D/critique.ts) — exports `POST`
- [`src/pages/api/canvases/[id]/share.ts`](https://github.com/AdrianKondrat/BMC_AI_Advisor/blob/75a119be6a844fa69684ebda283565bbb15dc150/src/pages/api/canvases/%5Bid%5D/share.ts) — exports `GET`, `POST`, `PATCH`, `DELETE`

Canvas data is served by the SSR page [`src/pages/canvas/[id].astro`](https://github.com/AdrianKondrat/BMC_AI_Advisor/blob/75a119be6a844fa69684ebda283565bbb15dc150/src/pages/canvas/%5Bid%5D.astro). The page runs a Supabase SELECT with `.eq("owner_id", user.id)` at line 14; if the result is null, line 18 returns `Astro.redirect("/dashboard")` — a **302**, not 404 or 403.

**Implication for test assertions:**
The test plan assertion "User B's authenticated GET for User A's canvas UUID returns 404 or 403" must be restated:

- At the **page route** (`GET /canvas/{uuid}`): User B gets **302 redirect to /dashboard** (canvas data is never in the response body).
- At the **PATCH API** (`PATCH /api/canvases/{uuid}`): User B gets **404** (explicit owner filter + `.maybeSingle()` returns null → `if (!data) return 404`).
- At the **share GET API** (`GET /api/canvases/{uuid}/share`): User B gets **401** (verification check returns 401 on null canvas).

Either the page redirect or the PATCH 404 is a valid proof of IDOR protection. The plan should choose which layer to test (or test both).

### 2. Owner filtering — explicit filters present everywhere

All access-relevant handlers use **both** explicit application-level owner filters AND Supabase RLS:

| Handler        | File:line                                       | Owner filter                              | Response if not owner                |
| -------------- | ----------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| SSR page GET   | `src/pages/canvas/[id].astro:14`                | `.eq("owner_id", user.id)`                | 302 → /dashboard                     |
| PATCH blocks   | `src/pages/api/canvases/[id].ts:85`             | `.eq("owner_id", context.locals.user.id)` | 404                                  |
| DELETE canvas  | `src/pages/api/canvases/[id].ts:43`             | `.eq("owner_id", context.locals.user.id)` | 204 (silent no-op — row not deleted) |
| POST critique  | `src/pages/api/canvases/[id]/critique.ts:42-43` | `.eq("owner_id", userId)`                 | 404                                  |
| GET share link | `src/pages/api/canvases/[id]/share.ts:28-33`    | `.eq("owner_id", context.locals.user.id)` | 401                                  |

**DELETE is a silent no-op when cross-user:** The DELETE handler returns 204 regardless of rows affected. User B DELETEing User A's canvas gets 204 but the row is not removed. This is adequate (the canvas is preserved) but the test must verify via a subsequent read-back, not just the status code.

**RLS SELECT policy** (`supabase/migrations/20260607000000_canvas_schema.sql:54-57`):

```sql
CREATE POLICY "owners can select own canvases"
  ON canvases FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
```

**Supabase client cookie adapter** (`src/lib/supabase.ts:6-25`) uses `createServerClient` from `@supabase/ssr` with a `getAll()` that parses cookies from `requestHeaders.get("Cookie")`. This correctly attaches the session JWT to PostgREST requests, making `auth.uid()` non-null. The RLS mutation no-op lesson from `lessons.md` is a _mutation_ concern; the code already adds explicit `owner_id` filters on all mutations. SELECT is additionally guarded at the page/API layer. Risk of RLS being the sole protection: **none for current endpoints**.

### 3. Middleware and PROTECTED_ROUTES

**`src/middleware.ts:4`:**

```typescript
const PROTECTED_ROUTES = ["/dashboard", "/canvas"];
```

**Auth check** (lines 6-16): Creates Supabase SSR client from request headers + cookies, calls `supabase.auth.getUser()`, sets `context.locals.user` to user or null.

**Redirect** (lines 18-22): Prefix-matches pathname against each route; if matched AND no user, returns `context.redirect("/auth/signin")`. The Astro `redirect()` helper issues **303 See Other** with `Location: /auth/signin`.

**All current user-facing pages and their coverage:**

| Page file                            | Route                 | Covered by PROTECTED_ROUTES? | Why                    |
| ------------------------------------ | --------------------- | ---------------------------- | ---------------------- |
| `src/pages/dashboard.astro`          | `/dashboard`          | Yes                          | exact prefix match     |
| `src/pages/canvas/new.astro`         | `/canvas/new`         | Yes                          | `/canvas` prefix match |
| `src/pages/canvas/[id].astro`        | `/canvas/{uuid}`      | Yes                          | `/canvas` prefix match |
| `src/pages/index.astro`              | `/`                   | No — intentionally public    | landing page           |
| `src/pages/auth/signin.astro`        | `/auth/signin`        | No — intentionally public    | auth page              |
| `src/pages/auth/signup.astro`        | `/auth/signup`        | No — intentionally public    | auth page              |
| `src/pages/auth/confirm-email.astro` | `/auth/confirm-email` | No — intentionally public    | auth page              |
| `src/pages/share/[token].astro`      | `/share/{token}`      | No — intentionally public    | token-gated read-only  |

**No current gap exists.** The Risk #7 test will confirm the redirect mechanism works for each listed route, not find a current misconfiguration. The test's ongoing value is as a regression guard when new pages are added.

**Page-level auth guards:** `dashboard.astro` has no secondary auth check — it accesses `Astro.locals.user.id` directly (line 15) and crashes if middleware were bypassed. `canvas/[id].astro` has a secondary owner check (line 14) and redirects to dashboard on null result. `canvas/new.astro` has no secondary check.

### 4. Test infrastructure baseline

**Current state — zero:**

- No `vitest`, `@cloudflare/vitest-pool-workers`, or any test package in `package.json`
- No `vitest.config.ts` / `vitest.workspace.*`
- No `__tests__/`, `tests/`, `*.test.ts`, or `*.spec.ts` files anywhere in the project
- No `test` script in `package.json`
- CI (`.github/workflows/ci.yml`) runs only: `npm ci` → `astro sync` → `npm run lint` → `npm run build` → `wrangler deploy`; no test step

**Wrangler config** (`wrangler.jsonc`):

- name: `bmc-ai-advisor`
- main: `@astrojs/cloudflare/entrypoints/server`
- compatibility_date: `2026-05-08`
- compatibility_flags: `["nodejs_compat"]` — already set, required for `@cloudflare/vitest-pool-workers`
- KV namespace binding: `SESSION` (id: `ec75d8b539a44b3c9983741270b0c012`) — not relevant to auth tests

**Astro config** (`astro.config.mjs`): output `"server"`, adapter `@astrojs/cloudflare`. All env vars (`SUPABASE_URL`, `SUPABASE_KEY`, `AI_PROVIDER`, `OPENROUTER_API_KEY`) are declared as `envField.string({ context: "server", access: "secret", optional: true })`.

**Vite version override** (`package.json:61`): `vite` is pinned to `^7.3.2` — important because `@cloudflare/vitest-pool-workers` version must be compatible with both Vite 7 and Vitest.

**TypeScript config**: extends `astro/tsconfigs/strict`, path alias `@/*` → `./src/*`.

**Packages to install:**

```
npm install -D vitest @cloudflare/vitest-pool-workers
```

**Files to create:**

- `vitest.config.ts` — pool: `@cloudflare/vitest-pool-workers`, must reference `wrangler.jsonc` for bindings
- Add `"test": "vitest run"` (and optionally `"test:watch": "vitest"`) to `package.json`

**CI addition needed:** Add after the `lint` step in `.github/workflows/ci.yml`:

```yaml
- name: Test
  run: npm test
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

### 5. Cross-user test user provisioning (Risk #4 complexity)

Risk #4 integration tests require **two separate authenticated Supabase sessions**. This is the hardest part of Phase 1.

**Option A — Local Supabase + service-role seeding:**

- Run tests against the local Supabase instance (`npx supabase start`)
- Use the service-role key in test `beforeAll` to call `supabase.auth.admin.createUser({...})` for User A and User B
- Sign in as each user via `supabase.auth.signInWithPassword` to get JWT tokens
- Pass tokens as `Authorization: Bearer <token>` headers or as `sb-access-token` cookies in test requests
- Delete users in `afterAll` with `supabase.auth.admin.deleteUser()`

**Option B — Seeded SQL fixtures:**

- Insert test users directly via raw SQL in a migration that only runs in test environments
- Simpler but less isolated — schema and auth tables diverge from production migrations

Option A is more aligned with the project's existing Supabase patterns and keeps the test database clean across runs.

**Environment variable needed for tests:**

- `SUPABASE_SERVICE_ROLE_KEY` — not currently in `.env.example` or `astro.config.mjs` env schema. Must be added for test setup only (not exposed to the worker runtime).

### 6. Where canvas data is fetched on the dashboard

`src/pages/dashboard.astro` fetches via a Supabase SELECT with the session user's `user.id` — only the current user's canvases are returned. There is no route or API endpoint that could expose all canvases to another user via the dashboard.

---

## Code References

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/canvas"]`
- `src/middleware.ts:6-16` — auth check via `supabase.auth.getUser()`, sets `context.locals.user`
- `src/middleware.ts:18-22` — prefix-match redirect, returns `context.redirect("/auth/signin")` (303)
- `src/pages/canvas/[id].astro:14` — SELECT with `.eq("owner_id", user.id)`
- `src/pages/canvas/[id].astro:18` — `if (!canvas) return Astro.redirect("/dashboard")` (302)
- `src/pages/api/canvases/[id].ts:43` — DELETE with explicit owner filter (returns 204; silent no-op if not owner)
- `src/pages/api/canvases/[id].ts:85` — PATCH with explicit owner filter (returns 404 if not owner)
- `src/pages/api/canvases/[id]/share.ts:28-33` — GET ownership verification (returns 401 if not owner)
- `src/pages/api/canvases/[id]/critique.ts:42-43` — POST owner filter on SELECT (returns 404 if not owner)
- `src/lib/supabase.ts:6-25` — `createServerClient` with cookie adapter (`getAll` parses `Cookie` header)
- `supabase/migrations/20260607000000_canvas_schema.sql:7-14` — canvases table, `owner_id uuid NOT NULL REFERENCES auth.users(id)`
- `supabase/migrations/20260607000000_canvas_schema.sql:50` — `ALTER TABLE canvases ENABLE ROW LEVEL SECURITY`
- `supabase/migrations/20260607000000_canvas_schema.sql:54-57` — SELECT RLS policy: `owner_id = auth.uid()`
- `supabase/migrations/20260613000000_share_canvas_anon_read.sql` — anon SELECT policy for shared canvases
- `package.json:5-12` — scripts (no test script)
- `wrangler.jsonc:1-23` — name `bmc-ai-advisor`, `nodejs_compat` flag already set
- `astro.config.mjs:17-24` — env schema (all server-only secrets, optional)
- `.github/workflows/ci.yml:1-31` — no test step

---

## Architecture Insights

**Defense-in-depth is consistent across the codebase.** Every handler that touches a specific canvas uses an explicit `owner_id` filter AND benefits from RLS. The cookie adapter in `createServerClient` ensures `auth.uid()` is non-null for authenticated requests, making RLS reliable — but the code doesn't rely on it alone.

**PROTECTED_ROUTES is an allowlist (opt-in protection).** The middleware protects routes that are explicitly listed. Any new user-facing page added without updating this list would be unauthenticated-accessible by default. The Astro page might crash (like `dashboard.astro` would) or silently render a broken state. This is the forward-looking risk the Phase 1 tests should document and guard against.

**The canvas page's 302-to-dashboard pattern is the IDOR response at the page layer.** It's a legitimate protection: User B gets no canvas data, just a redirect. But it's different from the "404 or 403" framing in the test plan. The plan should accept the 302 as the correct observable at the page layer, and use PATCH → 404 if a status-code assertion is preferred.

**No GET API endpoint for individual canvases means the attack surface is smaller than assumed.** An attacker cannot enumerate or read canvas JSON via a direct API call — they would need to render the full Astro SSR page, which runs the owner-filtered query server-side.

**`@cloudflare/vitest-pool-workers` is the right integration test layer** for this app because it runs tests inside the workerd runtime (same environment as production), meaning the Astro middleware, env var resolution, and Cloudflare bindings all behave identically to production. `fetch()` against a dev server would not have that guarantee.

---

## Historical Context (from prior changes)

- `context/changes/canvas-schema/plan.md:64` — `owner_id` column was the deliberate name choice (not `user_id`); this is the canonical ownership column in all queries and policies.
- `context/changes/canvas-schema/plan.md:79-92` — All four RLS policies (SELECT, INSERT, UPDATE, DELETE) were designed together in the initial schema; anon read policy for share links was intentionally deferred.
- `context/changes/canvas-dashboard/plan.md:65-66` — The explicit `.eq('owner_id', ...)` pattern on DELETE was established here as a direct application of the lessons.md rule, after the RLS no-op concern was documented.
- `context/changes/s-02/plan.md:146` — POST to create canvas sets `owner_id: user.id` explicitly in the INSERT; RLS WITH CHECK is redundant but present.
- `context/changes/s-02/plan.md:187` — PATCH uses explicit `owner_id` filter; same pattern applied uniformly.
- `context/changes/s-04/plan.md:73-84` — The anon RLS policy added for shared canvases (`id IN (SELECT canvas_id FROM share_links WHERE expires_at IS NULL OR expires_at > now())`) is the only path for unauthenticated canvas read access; it is intentional and expiry-gated.
- `context/changes/s-04/plan.md:141-142` — Share link mutations also use the owner-join subquery pattern for isolation.

The manual verification pattern from all prior plans follows: own resource → success; another user's resource → 404 or 204 no-op; unauthenticated → 401/redirect. These are the shapes the integration tests should codify.

---

## Related Research

No prior research artifacts exist — this is the first research document in this project.

---

## Open Questions

1. **Which assertion to use for IDOR at the page layer?** The Astro page returns 302 → /dashboard. Is that the assertion, or should the plan target the PATCH API (→ 404) for a cleaner status-code test? Both are valid; the plan should pick one primary target per risk.

2. **How to provision test users?** Service-role admin API in `beforeAll` is the cleanest approach (Option A above). This requires adding `SUPABASE_SERVICE_ROLE_KEY` to the test env. The plan must specify: where does this key come from in CI (new repo secret), and how is it kept out of the worker runtime env.

3. **How to make requests as an authenticated user in `@cloudflare/vitest-pool-workers`?** The standard approach is to obtain a Supabase session JWT (via `signInWithPassword` in test setup) and pass it as a cookie (`sb-access-token=<token>`) in `SELF.fetch()` requests. The exact cookie name(s) used by `@supabase/ssr` should be verified against the Supabase SSR docs before the plan locks in a test helper shape.

4. **Should `vitest.config.ts` use the same `wrangler.jsonc` or a test-specific `wrangler.test.jsonc`?** If the production `wrangler.jsonc` has KV or other bindings that need test doubles, a test-specific config is safer. For Phase 1 (middleware + ownership tests), the production `wrangler.jsonc` should work with test env vars substituted.

5. **CI environment for tests:** The existing CI secrets (`SUPABASE_URL`, `SUPABASE_KEY`) are available. The service-role key for user provisioning would need a new secret. Does the project have a separate test Supabase project, or do tests run against the same project as the build step?
