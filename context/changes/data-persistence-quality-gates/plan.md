# Data Persistence + Quality Gates — Implementation Plan

## Overview

Phase 4 (final) of the test-plan rollout. Proves Risk #5 (silent data loss): a PATCH to
`/api/canvases/{id}` that returns 200 actually persists the new block content to the database — a
silent no-op is impossible. Also closes the rollout with a CI-gate checkpoint and cookbook update.

## Current State Analysis

- `PATCH /api/canvases/[id].ts:52–98` already applies the explicit `owner_id` filter (`lessons.md`
  rule) and returns `{ updated_at }` on success and `404` when the canvas is not found for the
  owner. The endpoint is correct — the test proves it stays that way.
- **No `GET /api/canvases/[id]` endpoint exists.** Read-back must go through the Supabase admin
  client (same pattern as `canvasExists` in `tests/helpers/setup.ts`).
- `createTestCanvas` inserts a canvas row with no `blocks` value. The PATCH test will set `blocks`
  to a known payload — the admin read-back then asserts the written value.
- CI already runs lint → build → test → deploy. No new CI steps are needed; Phase 4 confirms the
  gate is complete for all four rollout phases.

## Desired End State

`tests/integration/data-persistence.test.ts` exists and passes in `npm run build && npm test`:

- PATCH with a sentinel `key_partners` value → 200
- Admin client reads back `blocks.key_partners` from the DB and asserts it equals the sentinel

`test-plan.md §3` Phase 4 row shows `complete`. `§6.5` per-rollout-phase notes are filled in.

### Key Discoveries

- `patchBodySchema` (`[id].ts:11–26`) uses `z.record(z.enum([...9 keys...]), z.string())` — any
  key from the enum is valid; the endpoint stores whatever is sent, replacing the entire `blocks`
  JSONB column. All 9 keys must be in the payload (even as empty strings) to avoid DB state
  issues; this matches the existing pattern in `tests/integration/access-control.test.ts:31–52`.
- `getAdmin()` in `tests/helpers/setup.ts:3–12` provides the service-role Supabase client. A new
  `getTestCanvasBlocks` helper follows the same pattern as `canvasExists`.
- All four auth/fixture patterns (`createTestUser`, `deleteTestUser`, `createTestCanvas`,
  `getAuthCookies`) are already available and only need a one-liner import addition.

## What We're NOT Doing

- Adding a `GET /api/canvases/[id]` production endpoint (not in the Phase 4 scope; the admin
  client read-back is sufficient for the persistence assertion).
- Asserting all 9 block values — Risk #5 is about silent write failure, not completeness (that is
  Risk #1, covered in Phase 3).
- Adding new CI steps — lint, build, and test are already wired; Phase 4 confirms correctness, not
  new infrastructure.
- Stryker mutation testing — the persistent-write path is thin and the test is already a
  strong mutation gate (sentinel value is unique, the admin read-back cannot lie).

## Implementation Approach

Two sequential phases. Phase 1 delivers the Risk #5 assertion. Phase 2 closes the rollout
with documentation and status updates.

---

## Phase 1: Round-Trip Integration Test (Risk #5)

### Overview

Add a `getTestCanvasBlocks` helper and a new integration test file that proves PATCH + DB
persistence end-to-end using a unique sentinel value.

### Changes Required

#### 1. Add `getTestCanvasBlocks` helper

**File**: `tests/helpers/setup.ts`

**Intent**: Read back the `blocks` column for a given canvas ID using the admin client, so the
round-trip test can assert the persisted value without a GET API endpoint.

**Contract**: Add after `canvasExists`. Signature:
`getTestCanvasBlocks(canvasId: string): Promise<Record<string, string> | null>`

Queries `.from("canvases").select("blocks").eq("id", canvasId).maybeSingle()`. On error, throws
with message `getTestCanvasBlocks failed: <error.message>`. Returns `null` if no row found,
otherwise the `blocks` value cast to `Record<string, string>`.

#### 2. Add `tests/integration/data-persistence.test.ts`

**File**: `tests/integration/data-persistence.test.ts`

**Intent**: Prove that a successful PATCH (status 200) writes the new block values to the database
— a silent RLS no-op would leave the original empty blocks in place and fail the sentinel
assertion.

**Contract**: Follow the structure of `tests/integration/access-control.test.ts`.

Lifecycle:

- `beforeAll`: `createTestUser` → `getAuthCookies` → `createTestCanvas` (all under the same test
  user). Use timestamped email/password to avoid collisions.
- `afterAll`: `deleteTestCanvas` then `deleteTestUser`, each with `.catch(() => undefined)`.

Test — `"PATCH /api/canvases/{id} persists block content to the database"`:

1. Derive `sentinel = 'ROUND_TRIP_SENTINEL_' + timestamp` (use the same `timestamp` as the email)
2. `SELF.fetch` PATCH with `Cookie`, `Content-Type: application/json`, `Origin: http://localhost`
3. Body: `{ blocks: { key_partners: sentinel, key_activities: '', key_resources: '', value_propositions: '', customer_relationships: '', channels: '', customer_segments: '', cost_structure: '', revenue_streams: '' } }`
4. Assert `response.status === 200`
5. Call `getTestCanvasBlocks(canvasId)` and assert `blocks.key_partners === sentinel`

### Success Criteria

#### Automated Verification

- `npm run build && npm test` exits 0 with the new `data-persistence` test passing
- `npm run lint` clean (no type errors in new test file or modified helper)

#### Manual Verification

- `npm test -- --reporter=verbose` shows `data-persistence.test.ts` passing under the workerd
  project, with the test name visible individually

**Implementation Note**: After automated verification passes and verbose output confirms the test
appears individually, proceed to Phase 2.

---

## Phase 2: Cookbook + Progress Sync

### Overview

Mark Phase 4 complete in the rollout table, fill `§6.5` per-rollout-phase notes, and update
`change.md` to `implemented`.

### Changes Required

#### 1. Update `test-plan.md §3` Phase 4 row

**File**: `context/foundation/test-plan.md`

**Intent**: Reflect the actual rollout state — Phase 4 is now complete.

**Contract**: In the Phase 4 row of the §3 table, change `Status` from `not started` to
`complete` and set `Change folder` to `context/changes/data-persistence-quality-gates`.

#### 2. Fill in `test-plan.md §6.5` per-rollout-phase notes

**File**: `context/foundation/test-plan.md`

**Intent**: Capture Phase 4's one surprise — no GET endpoint means admin-client read-back — so a
future contributor doesn't have to rediscover it.

**Contract**: Replace the placeholder in §6.5 with notes covering:

- Phase 1 (testing-infra-access-control): no surprises; established the workerd pool and
  integration-test fixture lifecycle that all subsequent phases reuse.
- Phase 2 (share-link-integrity): The public share-page (`/share/{token}`) always returns 200 —
  the API route (`/api/share/{token}`) is the enforcement point. Tests must target the API route,
  not the page.
- Phase 3 (ai-service-contract): `CanvasEditor.saveBlocks` contains a `setTimeout` that hangs the
  test process if real timers run — use `vi.useFakeTimers()` in jsdom tests for this component.
  `OPENROUTER_API_KEY` must be a non-empty string in the test environment even though
  `fetchMock.disableNetConnect()` prevents real calls.
- Phase 4 (data-persistence-quality-gates): No `GET /api/canvases/[id]` endpoint exists; the
  round-trip read-back uses `getTestCanvasBlocks` (admin client). The sentinel value approach is
  sufficient because the `blocks` JSONB column is replaced wholesale on each PATCH.

#### 3. Update `change.md` status

**File**: `context/changes/data-persistence-quality-gates/change.md`

**Intent**: Reflect that this change has been planned and will be implemented.

**Contract**: Set `status: planned` and `updated: 2026-06-25`.

### Success Criteria

#### Automated Verification

- `npm run lint` clean after `test-plan.md` edits
- `npm run build && npm test` still exits 0

#### Manual Verification

- `test-plan.md §3` Phase 4 row shows `complete` and
  `context/changes/data-persistence-quality-gates`
- `§6.5` has four bullet points (one per rollout phase) with no placeholder remaining

---

## Testing Strategy

### Integration Tests (workerd pool)

- `tests/integration/data-persistence.test.ts`: 1 test — PATCH with sentinel value, assert
  `blocks.key_partners` in admin read-back matches
- Reuses `createTestUser`, `deleteTestUser`, `createTestCanvas`, `deleteTestCanvas`,
  `getAuthCookies` from existing helpers; adds `getTestCanvasBlocks` as the only new helper

### Manual Testing Steps

1. `npm run build && npm test -- --reporter=verbose` — confirm `data-persistence` appears under
   workerd with the test passing individually
2. Verify `test-plan.md §3` Phase 4 row is `complete`
3. Verify `§6.5` has four phase notes with no placeholder text

## References

- Test plan: `context/foundation/test-plan.md` §2 Risk #5, §3 Phase 4, §5, §6.5
- PATCH endpoint: `src/pages/api/canvases/[id].ts:52–98`
- Test helpers: `tests/helpers/setup.ts`, `tests/helpers/auth.ts`
- Reference integration test: `tests/integration/access-control.test.ts`
- Lessons: `context/foundation/lessons.md` (owner filter on mutations — already applied)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Round-Trip Integration Test (Risk #5)

#### Automated

- [x] 1.1 `npm run build && npm test` exits 0 with the new data-persistence test passing — 400c5d9
- [x] 1.2 `npm run lint` clean (no type errors in new test file or modified helper) — 400c5d9

#### Manual

- [x] 1.3 Verbose output shows `data-persistence.test.ts` passing individually under the workerd project — 400c5d9

### Phase 2: Cookbook + Progress Sync

#### Automated

- [x] 2.1 `npm run lint` clean after `test-plan.md` edits
- [x] 2.2 `npm run build && npm test` still exits 0

#### Manual

- [x] 2.3 `test-plan.md §3` Phase 4 row shows `complete` and correct change folder
- [x] 2.4 `§6.5` has four phase notes with no placeholder remaining
