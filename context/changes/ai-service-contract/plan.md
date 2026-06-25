# AI Service Contract + Error Handling — Implementation Plan

## Overview

Phase 3 of the test-plan rollout. Proves two risks:

- **Risk #1**: `generateBMCCanvas` returns all 9 BMC block keys as non-empty strings — structural output
  contract verified via a `fetchMock` fixture in the workerd integration pool.
- **Risk #6**: Both the generation form and the critique editor recover visibly from AI call failures —
  verified with React unit tests in a new jsdom Vitest project.

The plan also closes a one-line runtime gap: `aiCanvasSchema` allows empty strings, but the PRD oracle
requires non-empty values. Adding `.min(1)` aligns the Zod guard with the oracle, making the Risk #1
test a true regression gate rather than a documentation test.

## Current State Analysis

- Two test projects exist in practice but only one is configured: `vitest.config.ts` uses a single
  workerd pool. React component tests cannot run in workerd — a second jsdom project is required.
- `generateBMCCanvas` (`src/lib/services/ai.ts:121–160`) has two-layer enforcement: OpenAI
  `strict: true` JSON Schema + Zod parse. The Zod schema (`aiCanvasSchema`, `ai.ts:36–46`) uses
  `z.string()` — empty strings pass Zod but violate the PRD's "non-empty string values" guarantee.
- `NewCanvasForm.tsx` and `CanvasEditor.tsx` both use `try/catch` around their fetch calls and
  correctly set status to `"error"` on any rejection. The loading state (button label) is cleared by
  the catch block in both components — no perpetual spinner path exists.
- `critiqueBMCCanvas` uses a bare type assertion with no Zod validation — a parallel gap, deferred to
  a future change per scope decision.

## Desired End State

After this plan, `npm run build && npm test` passes with two test projects:

1. **workerd** — existing integration tests + new `tests/integration/ai-service-contract.test.ts`:
   fixture response with all 9 keys → 201; fixture missing a key → 500.
2. **unit/jsdom** — new `tests/unit/NewCanvasForm.test.tsx` and
   `tests/unit/CanvasEditor.test.tsx`: fetch failure paths rendered and block state preserved.

`aiCanvasSchema` rejects empty block values at runtime, matching the PRD oracle.
`test-plan.md §3` Phase 3 marked `complete`; §6.1 and §6.4 filled in.

### Key Discoveries

- `aiCanvasSchema` at `ai.ts:36–46` reduces over `BMC_KEYS` — changing `z.string()` to
  `z.string().min(1)` in the reducer is a one-line change.
- `CanvasEditor.runCritique()` calls `saveBlocks` before the critique fetch; `saveBlocks` contains a
  `setTimeout` that resets `saveStatus` after 2 s — unit tests must use `vi.useFakeTimers()`.
- `SharePanel` is fully event-driven (no fetch on mount) — rendering `CanvasEditor` with
  `initialShareLink={null}` produces no unwanted fetch calls.
- The workerd pool intercepts outgoing HTTP via `fetchMock` from `cloudflare:test` (undici
  `MockAgent`). This is the correct mechanism to stub the OpenRouter call without skipping the Zod
  parse path.
- `OPENROUTER_API_KEY` is declared `optional: true` in `astro.config.mjs` env schema but the
  runtime guard in `ai.ts:122–126` throws if it is falsy. It must be a non-empty string in the test
  environment — the actual value is irrelevant because `fetchMock.disableNetConnect()` prevents real
  calls.

## What We're NOT Doing

- Adding Zod validation to `critiqueBMCCanvas` (bare type assertion gap — future change).
- Installing MSW for the workerd Risk #1 test (fetch spy via `cloudflare:test` `fetchMock` is
  sufficient and avoids the `astro:env/server` virtual module mocking problem in Node.js).
- Testing `critiqueBMCCanvas` structured output (not Risk #1 scope).
- Testing the happy path of canvas generation (already covered by the access-control and
  share-link-integrity integration tests via `createTestCanvas`).

## Implementation Approach

Four sequential phases. The jsdom infrastructure lands first so the risk phases can run immediately.
Risk #1 stays in the workerd pool (where the full Astro SSR stack is available) using `fetchMock`.
Risk #6 goes in the new jsdom project (where React `render()` is available) using `vi.fn()` on
`global.fetch`.

## Critical Implementation Details

**`CanvasEditor` fake timers**: `saveBlocks` in `CanvasEditor.tsx:148–153` calls
`setTimeout(() => setSaveStatus("idle"), 2000)` in its `finally` block. Unit tests for `runCritique`
must call `vi.useFakeTimers()` before rendering and `vi.useRealTimers()` in `afterEach`. Without this,
the test process hangs waiting for the real 2-second timer to resolve.

**`fetchMock` intercept order**: `fetchMock` from `cloudflare:test` must be activated in `beforeAll`
and deactivated in `afterAll`. Interceptors are consumed once per call — register a new intercept per
`it` block for Risk #1, or re-register in `beforeEach`. After each test,
`fetchMock.assertNoPendingInterceptors()` catches unused interceptors that signal a failing code path.

**`OPENROUTER_API_KEY` in the workerd pool**: the key check at `ai.ts:122–126` throws before any
fetch call if the binding is falsy. Ensure the workerd test environment has any non-empty string for
this binding — the same mechanism used for `SUPABASE_URL` (`.dev.vars` locally,
`OPENROUTER_API_KEY: test-dummy` in the CI workflow's Test step env block).

**Path alias in the jsdom project**: imports in `NewCanvasForm.tsx` and `CanvasEditor.tsx` use `@/`
(mapped to `./src`). The jsdom project entry in `vitest.config.ts` must include
`resolve.alias: { '@': path.resolve('./src') }`.

---

## Phase 1: jsdom Vitest Project

### Overview

Install three dev-dependency packages and restructure `vitest.config.ts` into a two-project config.
The existing workerd tests must continue passing unchanged.

### Changes Required

#### 1. Install jsdom packages

**File**: `package.json` (via `npm install`)

**Intent**: Make `environment: 'jsdom'` and `@testing-library/react` available to Vitest's new unit
project. `@testing-library/jest-dom` provides the `toBeInTheDocument()` / `toHaveTextContent()`
custom matchers.

**Contract**: Run:

```
npm install --save-dev jsdom @testing-library/react @testing-library/jest-dom
```

#### 2. Create unit test setup file

**File**: `tests/unit/setup.ts`

**Intent**: Import `@testing-library/jest-dom` so its matchers are available globally in every unit
test without a per-file import.

**Contract**: Single-line file — `import '@testing-library/jest-dom'`. No other content.

#### 3. Restructure `vitest.config.ts` into two projects

**File**: `vitest.config.ts`

**Intent**: Split the single-project config into a `test.projects` array with two entries. The
workerd entry replicates the existing config exactly. The jsdom entry adds the unit test environment.
Vitest 4 requires all per-project config (plugins, resolve, test options) to live inside the project
entry when `test.projects` is used.

**Contract**: The workerd project entry carries all existing fields:
`plugins` (`supabaseCjsBundlePlugin()` + `cloudflareTest({...})`), `resolve.alias` (the three
`@supabase/*` aliases), `test.globalSetup`, `test.include: ['tests/integration/**/*.test.ts']`,
`test.passWithNoTests: true`.

The jsdom project entry adds:

- `resolve.alias`: `{ '@': path.resolve('./src') }` for the `@/` path alias
- `esbuild`: `{ jsx: 'automatic', jsxImportSource: 'react' }` for TSX transform without a plugin
- `test.name: 'unit'`, `test.environment: 'jsdom'`, `test.setupFiles: ['./tests/unit/setup.ts']`,
  `test.include: ['tests/unit/**/*.test.{ts,tsx}']`, `test.passWithNoTests: true`

Root-level `test.passWithNoTests: true` should also remain at the top level as a fallback.

### Success Criteria

#### Automated Verification

- `npm run build && npm test` exits 0 with the workerd project passing its existing integration tests
- No TypeScript errors in `vitest.config.ts`: `npm run lint` clean
- `tests/unit/` directory exists with `setup.ts` inside

#### Manual Verification

- Running `npm test -- --reporter=verbose` shows two named projects: `workerd` and `unit`, both
  reporting `No test files found` (passWithNoTests) or passing tests

**Implementation Note**: After Phase 1 automated verification passes, confirm manually that both
projects appear in the test output before proceeding to Phase 2.

---

## Phase 2: Risk #1 — AI Service Contract Test + Zod Fix

### Overview

Fix the empty-string gap in `aiCanvasSchema`, then add a workerd integration test that intercepts the
OpenRouter HTTP call with `fetchMock` and verifies the full generation pipeline.

### Changes Required

#### 1. Fix `aiCanvasSchema` — enforce non-empty block values

**File**: `src/lib/services/ai.ts`

**Intent**: Align the Zod runtime guard with the PRD oracle. The current `z.string()` allows empty
strings; `z.string().min(1)` makes the guard reject empty blocks at runtime, not just in tests.

**Contract**: In the reducer at `ai.ts:36–44`, change `shape[key] = z.string()` to
`shape[key] = z.string().min(1)`. The `name: z.string()` field (canvas title) is left as `z.string()`
— the PRD does not mandate a non-empty title, only non-empty block values.

#### 2. Add `tests/integration/ai-service-contract.test.ts`

**File**: `tests/integration/ai-service-contract.test.ts`

**Intent**: Prove that `POST /api/canvases` returns 201 with all 9 BMC keys as non-empty strings when
the AI returns a valid fixture, and returns 500 when the fixture is missing a required key (Zod
rejects).

**Contract**: The test file follows the same structure as existing integration tests
(`createTestUser`, `deleteTestUser`, `getAuthCookies`, `SELF.fetch`). Key additions:

Import `fetchMock` from `cloudflare:test` and call `fetchMock.activate()` /
`fetchMock.disableNetConnect()` in `beforeAll`; `fetchMock.assertNoPendingInterceptors()` in
`afterEach`; `fetchMock.deactivate()` in `afterAll`.

For each test, set up an interceptor targeting origin `https://openrouter.ai` with path
`/api/v1/chat/completions`. The fixture response body must match the OpenAI Chat Completions shape:

```json
{ "choices": [{ "message": { "content": "<JSON string of name + 9 keys>" } }] }
```

with `Content-Type: application/json`.

**Test 1** — all 9 keys present and non-empty: fixture content is a valid JSON string with all 9
`BMC_KEYS` plus `"name"`, all with non-empty string values. Call `SELF.fetch` with auth cookies and
`Origin: http://localhost`. Assert response status `201`. Parse the body and assert every key in
`BMC_KEYS` is present (`typeof body.blocks[key] === 'string'`) and non-empty
(`body.blocks[key] !== ''`).

**Test 2** — missing key: fixture content omits `key_partners`. Assert response status `500`. Assert
body contains `"error": "AI generation failed"`.

A shared `beforeAll` creates a test user and obtains auth cookies. `afterAll` deletes the test user
(any canvas created in Test 1 is cascade-deleted with the user via Supabase FK).

#### 3. Ensure `OPENROUTER_API_KEY` is available in the workerd test environment

**File**: `.github/workflows/ci.yml` (Test step)

**Intent**: The AI function throws before any HTTP call if `OPENROUTER_API_KEY` is falsy. A dummy
value is sufficient since `fetchMock.disableNetConnect()` prevents real calls.

**Contract**: Add `OPENROUTER_API_KEY: test-dummy` to the `env:` block of the Test step in
`.github/workflows/ci.yml`. Locally, ensure `.dev.vars` contains any non-empty value for
`OPENROUTER_API_KEY` (developers already have the real key there for local dev).

### Success Criteria

#### Automated Verification

- `npm run build && npm test` exits 0 with both new test cases passing
- `npm run lint` clean (no type errors in the new test file)
- `npm run build` compiles without error with the `.min(1)` change in `aiCanvasSchema`

#### Manual Verification

- Running `npm test -- --reporter=verbose` shows both `ai-service-contract` tests passing in the
  workerd project with no network connections attempted (verify via `fetchMock.disableNetConnect()`)
- Confirm the Zod fix: attempting to call `generateBMCCanvas` locally with a fixture that omits a key
  throws `ZodError` rather than returning a partial object

**Implementation Note**: After automated verification passes, confirm the two new test cases appear
individually in verbose output before proceeding to Phase 3.

---

## Phase 3: Risk #6 — React Unit Tests (Error Recovery)

### Overview

Add two unit test files in the jsdom project — one per component — proving that AI call failures
render a visible error message and preserve any existing canvas data.

### Changes Required

#### 1. Add `tests/unit/NewCanvasForm.test.tsx`

**File**: `tests/unit/NewCanvasForm.test.tsx`

**Intent**: Prove that `NewCanvasForm` renders a red error paragraph on non-201 responses and on
network rejections, and that the button is no longer showing "Generating…" (loading state cleared).

**Contract**: Import `render`, `screen`, `fireEvent`, `waitFor` from `@testing-library/react`.
Import `NewCanvasForm` from `@/components/NewCanvasForm`.

In `beforeEach`, spy on `global.fetch` with `vi.spyOn(global, 'fetch')`.
In `afterEach`, call `vi.restoreAllMocks()`.

**Test 1 — non-201 response**: Mock `global.fetch` to resolve with
`new Response(JSON.stringify({ error: 'AI generation failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })`.
Render `<NewCanvasForm />`, get the textarea, type an idea, get the button, call
`fireEvent.submit(form)` (or `fireEvent.click(submitButton)`). Use `waitFor` to assert:

- An element with text `"AI generation failed"` is in the document
- The button does NOT have text `"Generating…"`

**Test 2 — network rejection**: Mock `global.fetch` to reject with `new Error('Network error')`.
After submit + `waitFor`, assert:

- An element containing `"Network error"` is in the document
- Button does not show `"Generating…"`

#### 2. Add `tests/unit/CanvasEditor.test.tsx`

**File**: `tests/unit/CanvasEditor.test.tsx`

**Intent**: Prove that `CanvasEditor.runCritique()` renders `"Critique failed — try again"` on fetch
failure, and that any existing critique annotations (passed via `canvas.critique`) remain visible
after the failure.

**Contract**: Import `render`, `screen`, `fireEvent`, `waitFor` from `@testing-library/react`.
Import `CanvasEditor` from `@/components/CanvasEditor`.

In `beforeEach`, call `vi.useFakeTimers()` and spy on `global.fetch`.
In `afterEach`, call `vi.restoreAllMocks()` then `vi.useRealTimers()`.

Define a `mockCanvas` object with `id: 'canvas-123'`, `name: 'Test'`, all 9 block keys with
non-empty string values, and `critique` set to a `CanvasCritique` object (all 9 keys with category
`'completeness'` and a non-empty `text` — at minimum, `key_partners.text` with a distinctive string
like `'Existing critique text'`).

**Test 1 — critique fetch rejects**: Mock `global.fetch` with two sequential resolved values:

- First call (PATCH saveBlocks): `new Response(null, { status: 200 })` — signals save success
- Second call (POST critique): reject via `.mockRejectedValueOnce(new Error('Network'))`

Render `<CanvasEditor canvas={mockCanvas} initialShareLink={null} />`.
Find the critique button by its label text (`"Re-run Critique"` since `canvas.critique` is non-null).
Fire a click event on it. Use `waitFor` to assert:

- `"Critique failed — try again"` is in the document
- `"Re-run Critique"` button is still present (not `"Analysing…"`)
- `"Existing critique text"` (or another distinctive string from `canvas.critique`) is still in the
  document — proving the existing critique state was not cleared

**Test 2 — non-OK critique response**: Same setup but second fetch mock resolves with
`new Response(null, { status: 500 })`. Same three assertions.

### Success Criteria

#### Automated Verification

- `npm test` exits 0 with the `unit` project reporting 4 passing tests (2 per file)
- `npm run lint` clean (TypeScript types satisfied, no implicit `any`)
- All existing workerd integration tests continue to pass

#### Manual Verification

- `npm test -- --reporter=verbose` shows both test files under the `unit` project
- Confirm that the `vi.useFakeTimers()` approach prevents test timeout — tests complete in < 2 s each

**Implementation Note**: After automated verification passes, confirm verbose output shows 4 unit
tests passing before proceeding to Phase 4.

---

## Phase 4: Cookbook + Progress Sync

### Overview

Update `test-plan.md` with Phase 3's completion state and fill in the two TBD cookbook entries
(§6.1 React unit tests, §6.4 AI service fixture pattern).

### Changes Required

#### 1. Update `test-plan.md §3` Phase 3 row

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 3 complete in the rollout table so §3 reflects the actual state.

**Contract**: In the Phase 3 row of the §3 table, change `Status` from `not started` to `complete`
and set `Change folder` to `context/changes/ai-service-contract`.

#### 2. Fill in `test-plan.md §6.1` — React component unit tests

**File**: `context/foundation/test-plan.md`

**Intent**: Document the React unit test pattern so future contributors can add tests without
reverse-engineering the vitest config split.

**Contract**: Replace the `TBD — see §3 Phase 3` placeholder in §6.1 with a section covering:

- Test runner and project: Vitest `unit` project (jsdom environment, `tests/unit/` include)
- Run command: `npm test` (runs both projects; `npm test -- --project unit` for unit-only)
- Fake timers: use `vi.useFakeTimers()` + `vi.useRealTimers()` in `beforeEach`/`afterEach` for any
  component that calls `setTimeout` (e.g., `CanvasEditor.saveBlocks`)
- Fetch mocking: `vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(...))` in `beforeEach`;
  `vi.restoreAllMocks()` in `afterEach`. Use `mockResolvedValueOnce` to sequence multiple stubs in
  call order.
- Path alias: `@/` resolves to `./src` via the jsdom project's `resolve.alias` — use full component
  paths when importing.
- Reference test: `tests/unit/CanvasEditor.test.tsx` (Phase 3 suite)

#### 3. Fill in `test-plan.md §6.4` — AI service response fixture pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Document the `fetchMock` fixture pattern for the workerd pool so future AI-layer tests
follow the same approach.

**Contract**: Replace the `TBD — see §3 Phase 3` placeholder in §6.4 with a section covering:

- Test runner: workerd pool (same as §6.2 API endpoint tests)
- Import: `import { fetchMock } from 'cloudflare:test'`
- Setup: `fetchMock.activate()` + `fetchMock.disableNetConnect()` in `beforeAll`;
  `fetchMock.assertNoPendingInterceptors()` in `afterEach`; `fetchMock.deactivate()` in `afterAll`
- Interceptor setup: `fetchMock.get('https://openrouter.ai').intercept({ path: '/api/v1/chat/completions', method: 'POST' }).reply(200, body, headers)` — registers a single-use interceptor consumed on the next matching call
- Fixture body shape: `{ choices: [{ message: { content: "<JSON string>" } }] }` with header
  `Content-Type: application/json`
- `OPENROUTER_API_KEY` must be a non-empty string in the test environment (any value — `test-dummy`
  suffices) — add to `.dev.vars` locally and CI workflow env
- Reference test: `tests/integration/ai-service-contract.test.ts` (Phase 3 suite)

### Success Criteria

#### Automated Verification

- `npm run lint` clean after `test-plan.md` edits (markdown linting passes)
- `npm run build && npm test` still exits 0

#### Manual Verification

- `test-plan.md §3` Phase 3 row shows `complete` and the correct change folder
- §6.1 and §6.4 are filled in with the patterns above (no TBD placeholders remain)

---

## Testing Strategy

### Unit Tests (jsdom project)

- `tests/unit/NewCanvasForm.test.tsx`: 2 tests — non-201 response, fetch rejection
- `tests/unit/CanvasEditor.test.tsx`: 2 tests — critique fetch rejection, critique non-OK response
- Each test: `vi.fn()` on `global.fetch`, `vi.useFakeTimers()` for CanvasEditor, `waitFor` for async

### Integration Tests (workerd pool)

- `tests/integration/ai-service-contract.test.ts`: 2 tests — valid fixture (201), missing key (500)
- Uses `fetchMock` from `cloudflare:test` — no real OpenRouter calls
- Shares test user lifecycle with existing integration tests (create in `beforeAll`, delete in
  `afterAll`)

### Manual Testing Steps

1. Run `npm run build && npm test -- --reporter=verbose` — verify 4 unit tests + 2 AI contract tests
2. Verify `npm run lint` is clean with the Zod `.min(1)` change in ai.ts
3. Confirm `test-plan.md §6.1` and `§6.4` are readable and complete

## References

- Research doc: `context/changes/ai-service-contract/research.md`
- Existing integration test reference: `tests/integration/share-link-integrity.test.ts`
- AI service: `src/lib/services/ai.ts:36–46` (Zod schema), `ai.ts:121–160` (generateBMCCanvas)
- Components: `src/components/NewCanvasForm.tsx`, `src/components/CanvasEditor.tsx:161–176`
- Test helpers: `tests/helpers/setup.ts`, `tests/helpers/auth.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: jsdom Vitest Project

#### Automated

- [x] 1.1 `npm run build && npm test` exits 0 with existing integration tests passing — 666c647
- [x] 1.2 `npm run lint` clean after vitest.config.ts restructure — 666c647
- [x] 1.3 `tests/unit/setup.ts` exists with `@testing-library/jest-dom` import — 666c647

#### Manual

- [x] 1.4 `npm test -- --reporter=verbose` shows both `workerd` and `unit` named projects

### Phase 2: Risk #1 — AI Service Contract Test + Zod Fix

#### Automated

- [x] 2.1 `npm run build && npm test` exits 0 with both new AI contract tests passing — 00607d3
- [x] 2.2 `npm run lint` clean (no type errors in new test file or modified ai.ts) — 00607d3
- [x] 2.3 `npm run build` succeeds with `.min(1)` change in `aiCanvasSchema` — 00607d3

#### Manual

- [x] 2.4 Verbose test output shows both `ai-service-contract` tests passing individually — 00607d3
- [x] 2.5 Confirm `.dev.vars` has `OPENROUTER_API_KEY` set, and CI workflow Test step has `OPENROUTER_API_KEY: test-dummy` — 00607d3

### Phase 3: Risk #6 — React Unit Tests

#### Automated

- [x] 3.1 `npm test` exits 0 with 4 unit tests passing in the `unit` project — 77d0291
- [x] 3.2 `npm run lint` clean (no TypeScript errors in new test files) — 77d0291
- [x] 3.3 All existing workerd integration tests continue to pass — 77d0291

#### Manual

- [x] 3.4 Verbose test output shows both unit test files under the `unit` project — 77d0291
- [x] 3.5 Unit tests complete in < 2 s each (fake timers working correctly — all 4 under 100 ms) — 77d0291

### Phase 4: Cookbook + Progress Sync

#### Automated

- [x] 4.1 `npm run lint` clean after `test-plan.md` edits — a132358
- [x] 4.2 `npm run build && npm test` still exits 0 — a132358

#### Manual

- [x] 4.3 `test-plan.md §3` Phase 3 row shows `complete` and correct change folder — a132358
- [x] 4.4 §6.1 and §6.4 contain the documented patterns with no TBD placeholders — a132358
