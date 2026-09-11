# AI Service Contract + Error Handling — Plan Brief

> Full plan: `context/changes/ai-service-contract/plan.md`
> Research: `context/changes/ai-service-contract/research.md`

## What & Why

Phase 3 of the test-plan rollout. Proves Risk #1 (AI structured output contract) and Risk #6 (visible
error recovery in the UI). The core user fear: the AI stops returning structured BMC blocks and the
product fails silently, or an AI timeout leaves the user staring at a perpetual spinner.

## Starting Point

Phases 1 and 2 shipped integration tests in a workerd Vitest pool. No React unit tests exist yet,
and no jsdom environment is configured. `aiCanvasSchema` validates block values as `z.string()` —
empty strings pass at runtime even though the PRD requires non-empty values.

## Desired End State

`npm run build && npm test` runs two Vitest projects: **workerd** (existing integration tests + 2
new AI contract tests using `fetchMock`) and **unit/jsdom** (4 new React unit tests proving error
recovery). `aiCanvasSchema` now rejects empty block values. `test-plan.md §3` Phase 3 is marked
complete and §6.1/§6.4 cookbook entries are filled in.

## Key Decisions Made

| Decision                    | Choice                                  | Why (1 sentence)                                                                          | Source |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| Risk #1 test environment    | workerd pool + `fetchMock`              | Keeps test in the existing pool; avoids `astro:env/server` mocking problem in Node.js     | Plan   |
| Zod gap fix                 | Fix — add `.min(1)` to all 9 block keys | One-line change that closes the runtime/PRD gap; makes the test a true regression guard   | Plan   |
| Risk #6 component scope     | Both `NewCanvasForm` + `CanvasEditor`   | Risk #6 covers both generation and critique failure paths; both have independent error UI | Plan   |
| Risk #6 fetch mock          | `vi.fn()` on `global.fetch`             | Zero extra packages; `mockResolvedValueOnce` sequences PATCH + POST stubs cleanly         | Plan   |
| `critiqueBMCCanvas` Zod gap | Defer                                   | Out of Phase 3 scope; the bare type assertion gap is a future change                      | Plan   |

## Scope

**In scope:**

- New `tests/unit/` jsdom Vitest project (install `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`)
- Restructure `vitest.config.ts` into `test.projects` array (workerd + jsdom)
- `aiCanvasSchema` Zod fix: `z.string()` → `z.string().min(1)` for 9 block keys
- `tests/integration/ai-service-contract.test.ts` (workerd, `fetchMock`)
- `tests/unit/NewCanvasForm.test.tsx` and `tests/unit/CanvasEditor.test.tsx` (jsdom)
- `test-plan.md §3` Phase 3 status + §6.1 and §6.4 cookbook entries

**Out of scope:**

- `critiqueBMCCanvas` Zod validation
- MSW installation
- Testing AI response quality or content
- e2e tests

## Architecture / Approach

Two Vitest projects in one config. The workerd project inherits the existing Supabase CJS bundle
workaround and `cloudflareTest` plugin. The jsdom project uses esbuild's built-in `jsx: 'automatic'`
transform with React 19's JSX runtime — no extra Vite plugin needed. `fetchMock` from `cloudflare:test`
intercepts the outgoing OpenRouter HTTP call within the Worker isolate; `vi.fn()` on `global.fetch`
intercepts fetch calls inside jsdom (component tests). `CanvasEditor` tests require `vi.useFakeTimers()`
because `saveBlocks` schedules a 2-second `setTimeout`.

## Phases at a Glance

| Phase                              | What it delivers                                               | Key risk                                                           |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. jsdom Vitest project            | Working two-project test config, new packages installed        | Vitest 4 `test.projects` restructure breaks existing workerd tests |
| 2. Risk #1 contract test + Zod fix | AI fixture test passes; empty block values rejected at runtime | `OPENROUTER_API_KEY` not available in workerd test env             |
| 3. Risk #6 React unit tests        | Error recovery in both components verified                     | `CanvasEditor` test hangs on 2-second timer without fake timers    |
| 4. Cookbook + progress sync        | §6.1 and §6.4 filled in; Phase 3 marked complete               | None                                                               |

**Prerequisites:** Phase 1 and Phase 2 of the test-plan rollout are complete (workerd pool + integration
test helpers in place). `OPENROUTER_API_KEY` must be set to any non-empty string in `.dev.vars` (local)
and CI workflow `Test` step env block.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Vitest 4's `test.projects` inline config API accepts `plugins` and `resolve` per-project — assumed
  based on Vitest 2+ docs; verify on first run.
- `@testing-library/react` latest supports React 19 — no known incompatibility but not verified in
  this project yet.
- `fetchMock` from `cloudflare:test` intercepts calls inside the Worker isolate, not the test runner
  — assumed correct; if the OpenAI SDK bypasses the mocked fetch, the test will hit `disableNetConnect`
  and fail clearly.

## Success Criteria (Summary)

- `npm run build && npm test` exits 0 with 6 new tests across both projects (2 AI contract, 4 React unit)
- `aiCanvasSchema` rejects empty block values at runtime
- `test-plan.md §6.1` and `§6.4` are filled in with working patterns for future contributors
