# Data Persistence + Quality Gates — Plan Brief

> Full plan: `context/changes/data-persistence-quality-gates/plan.md`

## What & Why

Phase 4 (final) of the test-plan rollout. Proves Risk #5: a PATCH to `/api/canvases/{id}` that
returns 200 actually writes the new block content to the database — a silent RLS no-op (documented
in `lessons.md`) cannot fake success. Also closes the rollout with a cookbook update.

## Starting Point

Three rollout phases are complete. The PATCH endpoint already applies an explicit `owner_id` filter
(the `lessons.md` rule). There is no `GET /api/canvases/[id]` endpoint, so read-back must go
through the Supabase admin client. All fixture helpers and workerd pool infrastructure are in place.

## Desired End State

`tests/integration/data-persistence.test.ts` passes in CI, asserting that a PATCHed sentinel value
appears in the admin-client read-back. `test-plan.md §3` Phase 4 is marked `complete` and `§6.5`
per-rollout-phase notes are filled in, completing the cookbook.

## Key Decisions Made

| Decision         | Choice                                    | Why (1 sentence)                                                                          | Source |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| Read-back method | Admin client (`getTestCanvasBlocks`)      | No GET endpoint exists; admin client directly validates DB write without a caching layer  | Plan   |
| Assertion scope  | One sentinel block value (`key_partners`) | Risk #5 is about silent write failure, not completeness — one distinctive value is enough | Plan   |
| CI gates         | No new steps                              | Lint, build, and test are already wired; Phase 4 confirms, not adds                       | Plan   |
| Cookbook update  | §3 status + §6.5 phase notes only         | Pattern is simple enough that the reference test is sufficient; no new §6.x needed        | Plan   |

## Scope

**In scope:**

- `getTestCanvasBlocks` helper in `tests/helpers/setup.ts`
- `tests/integration/data-persistence.test.ts` (one round-trip test)
- `test-plan.md §3` Phase 4 row → `complete`
- `test-plan.md §6.5` per-rollout-phase notes

**Out of scope:**

- `GET /api/canvases/[id]` production endpoint
- New CI steps
- Asserting all 9 block values (Risk #1 scope, already done)
- Stryker mutation testing

## Architecture / Approach

Single integration test in the existing workerd pool. `beforeAll` creates a test user, obtains auth
cookies, and seeds a canvas via `createTestCanvas`. The test PATCHes the canvas with a timestamped
sentinel in `key_partners`, asserts 200, then reads back `blocks` via the admin client and asserts
the sentinel value persists. `afterAll` cleans up canvas and user unconditionally.

## Phases at a Glance

| Phase                          | What it delivers                               | Key risk                                                                                  |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Round-trip integration test | Proves PATCH + DB persistence for Risk #5      | Admin client read-back returns stale data (unlikely — service-role client bypasses cache) |
| 2. Cookbook + progress sync    | Closes the rollout; fills §6.5 per-phase notes | Placeholder text left in §6.5                                                             |

**Prerequisites:** Phase 3 complete (workerd pool, jsdom project, all helpers in place)
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- `createTestCanvas` inserts with no `blocks` value — the PATCH will set it for the first time.
  If the DB schema enforces a `NOT NULL` constraint on `blocks`, the fixture may need adjustment.
  (Unlikely given Phase 1 tests already seed canvases the same way.)

## Success Criteria (Summary)

- `npm run build && npm test` exits 0 with the new `data-persistence` test visible in verbose output
- `test-plan.md §3` Phase 4 row shows `complete` with correct change folder
- `§6.5` has four per-phase notes with no placeholder text remaining
