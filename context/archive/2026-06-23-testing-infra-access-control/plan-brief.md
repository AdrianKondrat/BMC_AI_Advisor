# Test Infra + Access Control — Plan Brief

> Full plan: `context/changes/testing-infra-access-control/plan.md`
> Research: `context/changes/testing-infra-access-control/research.md`

## What & Why

Bootstrap a zero-to-working test runner (Vitest + `@cloudflare/vitest-pool-workers`) and write the first integration tests for this project. The tests prove two access-control risks from the Phase 1 rollout in `context/foundation/test-plan.md`: that an authenticated User B cannot read or modify User A's canvas (IDOR — Risk #4), and that unauthenticated requests to protected routes receive a 303 redirect instead of page content (Risk #7).

## Starting Point

No test runner, no test files, no CI test step. The project has `wrangler.jsonc` with `nodejs_compat` already set (required for `@cloudflare/vitest-pool-workers`) and a Vite 7.x override in `package.json`. The access-control surface is fully mapped by the research doc — no unknown code areas remain.

## Desired End State

`npm run build && npm test` passes with 5 integration tests: 3 redirect tests (one per PROTECTED_ROUTES prefix + deep-path variant) and 2 IDOR tests (PATCH → 404, DELETE → 204 with read-back). CI runs tests after build on every push and PR. The §6.2 cookbook entry in `test-plan.md` is filled in so future contributors know how to add a new integration test.

## Key Decisions Made

| Decision              | Choice                                           | Why (1 sentence)                                                                                     | Source   |
| --------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| IDOR assertion layer  | PATCH API → 404 (primary)                        | Cleanest status-code assertion; tests the mutation guard directly without following a redirect chain | Plan     |
| DELETE coverage       | Include with read-back                           | Documents and guards the silent 204 no-op behavior flagged in lessons.md                             | Plan     |
| CI test environment   | Same Supabase project as build CI                | Reuses existing secrets; only adds `SUPABASE_SERVICE_ROLE_KEY`                                       | Plan     |
| Wrangler config       | Shared `wrangler.jsonc`                          | KV SESSION binding is harmlessly present but unused by auth tests                                    | Plan     |
| Risk #7 coverage      | 3 tests (one per prefix + one deep path)         | Proves both prefix-root and prefix-child matching with minimal test count                            | Plan     |
| Canvas fixture        | Service-role INSERT (not POST /api/canvases)     | POST calls the AI before inserting — cannot be used in test setup                                    | Research |
| Auth cookie passing   | `createServerClient` + `setSession()` serializer | Lets `@supabase/ssr` produce the exact cookie format production middleware expects                   | Research |
| Test context env vars | `process.env` (not `astro:env/server`)           | `astro:env/server` is an Astro virtual module unavailable in the workerd test context                | Research |

## Scope

**In scope:**

- Install `vitest` and `@cloudflare/vitest-pool-workers` (Vite 7.x compatible versions)
- `vitest.config.ts` using `defineWorkersConfig` + shared `wrangler.jsonc`
- `tests/helpers/setup.ts` — service-role user/canvas lifecycle
- `tests/helpers/auth.ts` — session-to-cookie serializer
- `tests/integration/redirect.test.ts` — Risk #7 (3 tests)
- `tests/integration/access-control.test.ts` — Risk #4 (2 tests)
- CI test step in `.github/workflows/ci.yml`
- `SUPABASE_SERVICE_ROLE_KEY` documented in `.env.example` and added as CI secret (human action)
- §6.2 cookbook fill-in in `context/foundation/test-plan.md`

**Out of scope:**

- E2e / browser tests; React unit tests; share-link tests (Phases 2–3)
- SSR page-level IDOR assertion (page GET → 302 to /dashboard)
- Any mocking of auth middleware or Supabase

## Architecture / Approach

Tests run inside the workerd runtime via `@cloudflare/vitest-pool-workers`. `SELF.fetch()` dispatches HTTP requests to the compiled Astro SSR worker — the same execution environment as production. Test helpers use `@supabase/supabase-js` (service-role) and `@supabase/ssr` (cookie serialization), both reading from `process.env`, avoiding the `astro:env/server` virtual module that is unavailable outside the Astro build pipeline.

## Phases at a Glance

| Phase                            | What it delivers                                     | Key risk                                                            |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Test Runner Bootstrap         | Vitest installed, config created, CI step added      | Vite 7.x / vitest version incompatibility                           |
| 2. Auth Test Helpers             | `setup.ts` + `auth.ts` working against live Supabase | `astro:env/server` import leaking into helpers                      |
| 3. Risk #7 Redirect Tests        | 3 passing redirect tests                             | `dist/` not present when tests run (build-first constraint)         |
| 4. Risk #4 IDOR Tests + Cookbook | 2 passing IDOR tests, §6.2 filled in                 | Test user collision across CI runs; fixture cleanup on test failure |

**Prerequisites:** `SUPABASE_SERVICE_ROLE_KEY` must be added to `.dev.vars` locally and to GitHub repository secrets before Phase 2. The app must be built (`npm run build`) before any test run.

**Estimated effort:** ~2-3 focused sessions across 4 phases.

## Open Risks & Assumptions

- `@cloudflare/vitest-pool-workers` compatible with Vite 7.x must exist — check peer deps at install time; if not, the plan must be revisited with an alternative runner.
- `dist/` must exist before tests run — the CI order (build → test → deploy) satisfies this, but local dev requires a manual build step.
- Service-role key for the existing Supabase project must be available from the Supabase dashboard (Project Settings > API > service_role).

## Success Criteria (Summary)

- `npm run build && npm test` reports 5/5 passing tests locally and in CI.
- False-positive guards pass: tests fail when the middleware redirect or PATCH owner filter is temporarily removed.
- No orphaned test users or canvases remain in Supabase after the test run.
