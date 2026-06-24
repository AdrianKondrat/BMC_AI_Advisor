# Test Infra + Access Control Implementation Plan

## Overview

Bootstrap Vitest and `@cloudflare/vitest-pool-workers` from a zero-test baseline, then write integration tests that prove Risks #4 (IDOR — User B reads/modifies User A's canvas) and #7 (unauthenticated GET returns redirect instead of page content) from `context/foundation/test-plan.md` Phase 1.

## Current State Analysis

No test runner, no test files, no CI test step. The `package.json` has no `test` script; `devDependencies` has no vitest or pool-workers package. The CI workflow (`ci.yml`) runs lint → build → deploy only.

The access-control surface is well-understood from research:

- PROTECTED_ROUTES is `["/dashboard", "/canvas"]` with prefix matching; middleware issues a 303 redirect before any page handler runs.
- IDOR protection for PATCH is an explicit `.eq("owner_id", context.locals.user.id)` filter — returns 404 when User B is authenticated but requests User A's canvas UUID.
- DELETE uses the same explicit owner filter but returns 204 regardless of whether a row was affected (silent no-op when non-owner).
- `POST /api/canvases` invokes the AI (`generateBMCCanvas`) — cannot be used in test setup.

### Key Discoveries

- `src/middleware.ts:18-22` — `context.redirect("/auth/signin")` is Astro's redirect helper, which issues 303 See Other.
- `src/pages/api/canvases/[id].ts:85-95` — PATCH `.maybeSingle()` returns null for a non-owner UUID → status 404.
- `src/pages/api/canvases/[id].ts:43-49` — DELETE returns 204 unconditionally; row-not-deleted is silent.
- `src/pages/api/canvases/index.ts:39-44` — POST calls `generateBMCCanvas` (AI) before any DB write; test fixtures must bypass this endpoint entirely.
- `src/lib/supabase.ts:12-15` — `createServerClient` reads all cookies via `parseCookieHeader(requestHeaders.get("Cookie"))`. Passing auth cookies in `SELF.fetch()` headers is the correct mechanism.
- `canvases` table: `owner_id uuid NOT NULL`, `blocks jsonb NOT NULL DEFAULT '{}'`, `name text` (nullable). Minimum fixture INSERT: `{ owner_id, name }` — `blocks` defaults to `{}`.
- `@cloudflare/vitest-pool-workers` runs tests inside workerd. `SELF.fetch()` dispatches to the worker described by `wrangler.jsonc`. The Astro SSR entry point (`@astrojs/cloudflare/entrypoints/server`) loads from the compiled `dist/` output — **the app must be built before tests run**.

## Desired End State

`npm run build && npm test` passes cleanly in both local dev and CI. The CI pipeline has a test step (after build, before deploy) that runs with `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Two integration test suites exist:

1. `tests/integration/redirect.test.ts` — 3 tests that each GET a protected route without auth and assert 303 + `Location: /auth/signin`.
2. `tests/integration/access-control.test.ts` — 2 tests that authenticate as User B and assert PATCH → 404 and DELETE → 204 + canvas still exists.

§6.2 of `context/foundation/test-plan.md` is filled in with the fixture pattern, run command, and file locations.

### Key Discoveries

- Minimum canvas fixture: `{ owner_id: userId, name: "IDOR test fixture" }` — all other columns are nullable or have defaults.
- PATCH 404 is the cleanest IDOR assertion; DELETE read-back (via service-role SELECT) proves the silent no-op is actually protective.
- Auth cookies are serialized by calling `createServerClient` + `setSession()`, letting `@supabase/ssr` produce the exact cookie format the production middleware expects — no manual cookie name construction.

## What We're NOT Doing

- No e2e or browser tests (deferred to a future refresh cycle).
- No React unit tests (Phase 3 of the rollout).
- No share-link tests (Phase 2 of the rollout).
- No testing of the SSR page redirect for IDOR (page GET → 302 to /dashboard); PATCH → 404 is the chosen primary assertion.
- No test via `POST /api/canvases` — it calls the AI; canvas fixtures are seeded directly via service-role INSERT.
- No mock of the middleware or auth — tests hit the real middleware via `SELF.fetch()`.

## Implementation Approach

Four sequential phases: infrastructure first, helpers second, simpler test suite (Risk #7) third, then the more complex cross-user suite (Risk #4) plus cookbook update. Each phase has concrete automated and manual success criteria before proceeding.

Env var strategy: `SUPABASE_URL` and `SUPABASE_KEY` are already in CI and `.dev.vars`. A new `SUPABASE_SERVICE_ROLE_KEY` is needed only in test context — it must appear in `.dev.vars` locally and as a new CI secret; it must NOT be added to the wrangler.jsonc env schema (not exposed to the runtime worker).

## Critical Implementation Details

**Build before test**: `SELF.fetch()` dispatches to the compiled Astro SSR worker. If `dist/` doesn't exist, workerd cannot start the worker and all tests fail. The local run command is `npm run build && npm test`. In CI the existing build step runs before the new test step, so the dependency is satisfied automatically.

**Test helpers must not import from `@/lib/supabase.ts`**: That module imports `SUPABASE_URL` and `SUPABASE_KEY` from `astro:env/server`, an Astro virtual module that is resolved at build time and is not available in the test file's workerd context. Test helpers must create their own Supabase clients directly from `@supabase/supabase-js` / `@supabase/ssr`, reading env vars from `process.env`.

**Canvas fixture via service-role INSERT**: `POST /api/canvases` calls `generateBMCCanvas(idea)` (AI) before inserting. Test setup must insert directly into the `canvases` table using the service-role Supabase client, bypassing the API entirely.

**Session-to-cookie serialization**: Do not hard-code or reverse-engineer `@supabase/ssr`'s internal cookie name format. Instead, call `createServerClient` with an in-memory cookie store, call `auth.setSession({ access_token, refresh_token })`, capture the cookies that `setAll()` emits, and join them as a `Cookie:` header value for `SELF.fetch()` requests.

---

## Phase 1: Test Runner Bootstrap

### Overview

Install the test packages, create the vitest configuration, add the test scripts, expose the new env var, and wire the CI test step. After this phase, `npm run build && npm test` exits 0 ("no test files found" is acceptable) and the CI pipeline has a passing test step.

### Changes Required

#### 1. Install packages

**File**: `package.json` (via `npm install`)

**Intent**: Add `vitest` and `@cloudflare/vitest-pool-workers` to `devDependencies`. Both packages must be mutually compatible and compatible with the Vite version override `^7.x` declared in `overrides.vite`. Check peer-dependency constraints at install time; if npm reports version conflicts, pin the versions that satisfy all constraints. Also add a `workerd` entry to `allowScripts` for the version pulled in by `@cloudflare/vitest-pool-workers` if it differs from the one already listed.

**Contract**: After install, `package.json` `devDependencies` contains `vitest` and `@cloudflare/vitest-pool-workers` at compatible versions. The `scripts` block gains `"test": "vitest run"` and `"test:watch": "vitest"`.

#### 2. Create vitest configuration

**File**: `vitest.config.ts` (new file, project root)

**Intent**: Configure Vitest to run test files inside the workerd runtime using the existing `wrangler.jsonc` for bindings and compatibility flags. The `nodejs_compat` flag in `wrangler.jsonc` is already set; no duplication needed.

**Contract**: Exports `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config` with `test.poolOptions.workers.wrangler.configPath` pointing to `./wrangler.jsonc`. Include `test.include` to target `tests/**/*.test.ts` so test discovery is explicit.

#### 3. Document new env var

**File**: `.env.example`

**Intent**: Make `SUPABASE_SERVICE_ROLE_KEY` visible to anyone setting up the project for local test runs.

**Contract**: Add `SUPABASE_SERVICE_ROLE_KEY=###` after the existing four entries. No other changes to `.env.example`.

#### 4. Add CI test step

**File**: `.github/workflows/ci.yml`

**Intent**: Run `npm test` after the build step (so `dist/` exists for SELF.fetch()) and before the deploy step. Pass the three Supabase env vars the test suite needs. Add a note reminding the team to add `SUPABASE_SERVICE_ROLE_KEY` as a repository secret (this is a human action, not a file change).

**Contract**: New step inserted between `npm run build` and `Deploy to Cloudflare Workers`, using `run: npm test` with `env:` block containing `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` each sourced from `secrets`. The `if: github.event_name == 'push'` condition should NOT be on the test step — tests must run on both push and pull_request events.

### Success Criteria

#### Automated Verification

- `npm install` completes without peer-dependency errors
- `npm run build && npm test` exits 0 (zero test files found is acceptable — Vitest exits cleanly)
- `npx astro check` (typecheck) passes on `vitest.config.ts`
- `npm run lint` passes (no ESLint errors on `vitest.config.ts`)

#### Manual Verification

- Confirm `.dev.vars` has been updated locally with a real `SUPABASE_SERVICE_ROLE_KEY` value (obtained from the Supabase dashboard > Project Settings > API > service_role key)
- Confirm `SUPABASE_SERVICE_ROLE_KEY` has been added as a GitHub repository secret
- Push to a branch; verify the CI `Test` step appears and passes (zero tests, zero failures)

**Implementation Note**: After all automated checks pass, pause here for manual confirmation that CI is green before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Auth Test Helpers

### Overview

Create two test helper modules used by both integration test suites: one for user and canvas lifecycle via the service-role admin API, and one for serializing a Supabase session into a cookie string that the production middleware can authenticate.

### Changes Required

#### 1. Service-role admin helper

**File**: `tests/helpers/setup.ts` (new file)

**Intent**: Provide the test suites with functions to create/delete test users via the Supabase auth admin API and to create/delete/verify canvas rows directly via the service-role Supabase client. All functions read env vars from `process.env`, not `astro:env/server`.

**Contract**: Exports four functions:

- `createTestUser(email: string, password: string) → Promise<{ id: string }>` — calls `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`.
- `deleteTestUser(userId: string) → Promise<void>` — calls `supabaseAdmin.auth.admin.deleteUser(userId)`.
- `createTestCanvas(ownerId: string) → Promise<{ id: string }>` — service-role INSERT into `canvases` with `{ owner_id: ownerId, name: "IDOR test fixture" }`; returns the generated `id`.
- `deleteTestCanvas(canvasId: string) → Promise<void>` — service-role DELETE from `canvases` by `id`.
- `canvasExists(canvasId: string) → Promise<boolean>` — service-role SELECT from `canvases` by `id`; returns `true` if a row is found.

The service-role client is created once at module level: `createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })` using `createClient` from `@supabase/supabase-js`.

#### 2. Session-to-cookie serializer

**File**: `tests/helpers/auth.ts` (new file)

**Intent**: Sign in as a test user and produce a `Cookie:` header value string that the production middleware's `createServerClient` will accept — without knowing or hard-coding the `@supabase/ssr` internal cookie name format.

**Contract**: Exports one function:

- `getAuthCookies(email: string, password: string) → Promise<string>` — signs in via a Supabase client created from `process.env.SUPABASE_URL` + `process.env.SUPABASE_KEY` (anon key), gets `session.access_token` and `session.refresh_token`, then calls `createServerClient` (from `@supabase/ssr`) with an in-memory `setAll` cookie collector, calls `client.auth.setSession({ access_token, refresh_token })`, collects every `{ name, value }` pair emitted by `setAll`, and joins them as `name=value; name=value...` returning the full cookie header string.

### Success Criteria

#### Automated Verification

- `npm run lint` passes on both helper files (no TypeScript or ESLint errors)
- `npm run build && npm test` exits 0 (helpers are imported but no test files invoke them yet — no import errors)

#### Manual Verification

- In a temporary test file (deleted after verification), call `createTestUser` + `deleteTestUser` against the live Supabase project; confirm user appears and disappears in the Supabase dashboard > Authentication > Users.
- Call `getAuthCookies` and log the returned string; confirm it is a non-empty `name=value` cookie string.

**Implementation Note**: After all automated checks pass and helpers are manually confirmed to work against live Supabase, delete any temporary test file and proceed to Phase 3.

---

## Phase 3: Risk #7 Integration Tests — Unauthenticated Redirect

### Overview

Write the redirect integration tests. Three test cases cover all distinct protection prefix patterns: exact prefix match (`/dashboard`), prefix-child (`/canvas/new`), and deep UUID path (`/canvas/{fake-uuid}`). Each confirms the unauthenticated response is 303 with `Location: /auth/signin`.

### Changes Required

#### 1. Redirect integration test suite

**File**: `tests/integration/redirect.test.ts` (new file)

**Intent**: For each of the three protected paths, make an unauthenticated `SELF.fetch()` request (with `redirect: "manual"` to prevent auto-following) and assert the response status and Location header. The test must not pass cookies or auth headers — the request must be anonymous.

**Contract**: A single `describe("Risk #7 — unauthenticated redirect")` block with three `it` cases:

| Path                                           | Expected status | Expected Location pathname |
| ---------------------------------------------- | --------------- | -------------------------- |
| `/dashboard`                                   | 303             | `/auth/signin`             |
| `/canvas/new`                                  | 303             | `/auth/signin`             |
| `/canvas/00000000-0000-0000-0000-000000000001` | 303             | `/auth/signin`             |

Each case calls `SELF.fetch("http://localhost{path}", { redirect: "manual" })`, asserts `response.status === 303`, and asserts `new URL(response.headers.get("Location")!).pathname === "/auth/signin"`. No `beforeAll`/`afterAll` needed — these tests are stateless.

### Success Criteria

#### Automated Verification

- `npm run build && npm test` reports 3 passing tests in `tests/integration/redirect.test.ts`
- `npm run lint` passes on the new test file
- All three test cases pass independently (no cross-test state)

#### Manual Verification

- Run `npm run build && npm test -- --reporter=verbose` locally and confirm test names and assertion values are legible
- Confirm no false-positive: temporarily comment out the middleware redirect block in `src/middleware.ts`, re-run tests, confirm they fail → restore the middleware

**Implementation Note**: The false-positive verification is the most important manual step — it proves the test is actually catching what it claims to catch. After restoring the middleware and confirming 3/3 pass, proceed to Phase 4.

---

## Phase 4: Risk #4 Integration Tests — IDOR + Cookbook Update

### Overview

Write the cross-user IDOR integration tests. `beforeAll` provisions two real Supabase test users and a canvas owned by User A. Two tests run as User B: PATCH → 404, DELETE → 204 with read-back proving canvas still exists. `afterAll` cleans up all fixtures. After tests pass, fill in §6.2 of `context/foundation/test-plan.md`.

### Changes Required

#### 1. IDOR integration test suite

**File**: `tests/integration/access-control.test.ts` (new file)

**Intent**: Prove that an authenticated User B cannot modify or delete User A's canvas by UUID. Uses the helpers from Phase 2 for user/canvas lifecycle and cookie serialization. Both PATCH and DELETE are tested; DELETE includes a read-back assertion via `canvasExists` to prove the silent 204 is genuinely non-destructive.

**Contract**: A `describe("Risk #4 — cross-user IDOR")` block with:

- `beforeAll`:
  1. `createTestUser("user-a-{timestamp}@test.invalid", generatedPassword)` → store `{ userId: userA.id }`.
  2. `createTestUser("user-b-{timestamp}@test.invalid", generatedPassword)` → store `{ userId: userB.id }`.
  3. `getAuthCookies(userBEmail, userBPassword)` → store `userBCookies`.
  4. `createTestCanvas(userA.id)` → store `canvasId`.

- `it("PATCH /api/canvases/{id} as User B returns 404")`: `SELF.fetch("http://localhost/api/canvases/{canvasId}", { method: "PATCH", headers: { "Cookie": userBCookies, "Content-Type": "application/json" }, body: JSON.stringify({ blocks: { key_partners: "x" } }) })` → assert `response.status === 404`.

- `it("DELETE /api/canvases/{id} as User B returns 204 but canvas still exists")`: `SELF.fetch(...)` with method DELETE and `userBCookies` → assert `response.status === 204`; then `canvasExists(canvasId)` → assert `true`.

- `afterAll`:
  1. `deleteTestCanvas(canvasId)` — remove fixture even if tests failed.
  2. `deleteTestUser(userA.id)`.
  3. `deleteTestUser(userB.id)`.

Use a timestamp suffix in test email addresses (e.g., `user-a-${Date.now()}@test.invalid`) to avoid collisions across parallel CI runs.

#### 2. Fill in §6.2 cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD — see §3 Phase 1` placeholder in §6.2 with the canonical patterns established by this phase. Future contributors should be able to add a new API integration test by reading this section alone.

**Contract**: The §6.2 entry (`### 6.2 Adding an integration test (API endpoint)`) is replaced with:

- **Test runner**: Vitest with `@cloudflare/vitest-pool-workers` — runs in workerd, same runtime as production.
- **File location**: `tests/integration/{feature}.test.ts`.
- **Run command**: `npm run build && npm test` (build must precede tests; `dist/` is required by workerd).
- **Auth pattern**: Use `getAuthCookies(email, password)` from `tests/helpers/auth.ts` to get a `Cookie:` header string; pass it in `SELF.fetch()` options. Never pass a raw JWT via `Authorization: Bearer`.
- **Fixture pattern**: Create users via `createTestUser` (service-role admin API) and canvases via `createTestCanvas` (direct service-role INSERT, not `POST /api/canvases` — that endpoint calls the AI). Clean up in `afterAll` unconditionally.
- **Reference test**: `tests/integration/access-control.test.ts` (IDOR tests from Phase 1).

### Success Criteria

#### Automated Verification

- `npm run build && npm test` reports 5 passing tests total (3 redirect + 2 IDOR)
- `npm run lint` passes on `tests/integration/access-control.test.ts`
- `afterAll` cleanup runs even when a test fails (no orphaned users or canvases in Supabase)

#### Manual Verification

- Confirm test users appear in Supabase dashboard > Auth > Users during test run and are deleted after
- Run tests twice back-to-back; confirm no "user already exists" or "duplicate key" errors from stale fixtures
- Confirm false-positive guard: temporarily remove the `.eq("owner_id", context.locals.user.id)` filter from the PATCH handler (`src/pages/api/canvases/[id].ts:85`), re-run the IDOR test, confirm it fails → restore the filter

**Implementation Note**: The false-positive guard is mandatory before marking this phase complete. After restoring the owner filter and confirming 5/5 pass, update §3 Phase 1 status in `context/foundation/test-plan.md` to `complete`.

---

## Testing Strategy

### Unit Tests

None in this change — all tests are integration tests against the live workerd runtime and Supabase project.

### Integration Tests

- **Redirect tests** (`tests/integration/redirect.test.ts`): Stateless, no fixtures, no auth. Confirm 303 + correct Location for each PROTECTED_ROUTES prefix.
- **IDOR tests** (`tests/integration/access-control.test.ts`): Stateful, fixture-based. Confirm PATCH 404 and DELETE read-back using two real test users.

### Manual Testing Steps

1. Run `npm run build && npm test -- --reporter=verbose` and read each test name and assertion.
2. For redirect tests: remove the middleware redirect temporarily and confirm tests fail.
3. For IDOR tests: remove the owner filter from PATCH temporarily and confirm tests fail.
4. Confirm Supabase dashboard shows no orphaned test users after the run.
5. Push to a PR branch; confirm CI test step passes alongside lint + build.

## Performance Considerations

Integration tests create real Supabase users and make real network requests to the Supabase project. Expected test suite runtime: < 15s locally on a fast connection. `afterAll` cleanup must not be guarded by test success — use `try/finally` or equivalent to ensure cleanup even on failure.

## Migration Notes

No database migrations. `SUPABASE_SERVICE_ROLE_KEY` is a new env var for the test environment only — it must not appear in `wrangler.jsonc` bindings or `astro.config.mjs` env schema.

## References

- Research: `context/changes/testing-infra-access-control/research.md`
- Test plan Phase 1: `context/foundation/test-plan.md` §3 row #1
- Middleware: `src/middleware.ts:4,18-22`
- PATCH handler: `src/pages/api/canvases/[id].ts:52-98`
- DELETE handler: `src/pages/api/canvases/[id].ts:28-50`
- Supabase client: `src/lib/supabase.ts:6-24`
- Canvas schema: `supabase/migrations/20260607000000_canvas_schema.sql:7-14`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Runner Bootstrap

#### Automated

- [x] 1.1 `npm install` completes without peer-dependency errors — b519cea
- [x] 1.2 `npm run build && npm test` exits 0 (zero test files found) — b519cea
- [x] 1.3 `npx astro check` passes on `vitest.config.ts` — b519cea
- [x] 1.4 `npm run lint` passes on `vitest.config.ts` — b519cea

#### Manual

- [x] 1.5 `.dev.vars` updated locally with real `SUPABASE_SERVICE_ROLE_KEY` value
- [x] 1.6 `SUPABASE_SERVICE_ROLE_KEY` added as GitHub repository secret
- [x] 1.7 CI `Test` step appears and passes on a pushed branch

### Phase 2: Auth Test Helpers

#### Automated

- [x] 2.1 `npm run lint` passes on `tests/helpers/setup.ts` and `tests/helpers/auth.ts` — fa95f39
- [x] 2.2 `npm run build && npm test` exits 0 (helpers imported without import errors) — fa95f39

#### Manual

- [x] 2.3 `createTestUser` + `deleteTestUser` confirmed working against live Supabase — fa95f39
- [x] 2.4 `getAuthCookies` returns a non-empty cookie string — fa95f39

### Phase 3: Risk #7 Integration Tests — Unauthenticated Redirect

#### Automated

- [x] 3.1 `npm run build && npm test` reports 3 passing tests in redirect.test.ts
- [x] 3.2 `npm run lint` passes on redirect.test.ts

#### Manual

- [ ] 3.3 `--reporter=verbose` output shows legible test names and assertion values
- [ ] 3.4 False-positive guard: tests fail when middleware redirect is temporarily removed

### Phase 4: Risk #4 Integration Tests — IDOR + Cookbook Update

#### Automated

- [ ] 4.1 `npm run build && npm test` reports 5 passing tests total (3 redirect + 2 IDOR)
- [ ] 4.2 `npm run lint` passes on access-control.test.ts
- [ ] 4.3 Back-to-back run produces no fixture collision errors

#### Manual

- [ ] 4.4 Test users appear in Supabase dashboard during run and are deleted after
- [ ] 4.5 False-positive guard: IDOR tests fail when PATCH owner filter is temporarily removed
- [ ] 4.6 §3 Phase 1 status in test-plan.md updated to `complete`
