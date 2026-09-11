<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI Block-Level Critique Implementation Plan

- **Plan**: `context/changes/ai-critique/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-06-13
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Lint success criterion currently fails

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/ai.ts:36, src/lib/services/ai.ts:159
- **Detail**: `npm run lint` fails with two errors in the changed AI service: `prefer-reduce-type-parameter` on the `aiCanvasShape` reducer default value and `no-unsafe-assignment` on `JSON.parse(content)`. Build passes and the local Supabase reset passes, but lint is an explicit success criterion for all completed phases.
- **Fix**: Remove the unnecessary reducer assertion and parse AI JSON through `unknown` before Zod validation so strict type-checked lint passes.
- **Decision**: FIXED via applied lint-safe adjustments

### F2 — Critique update can report success without persistence

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/canvases/[id]/critique.ts:73
- **Detail**: The route checks only `updateError`. If the canvas is deleted between the pre-AI SELECT and the UPDATE, or if RLS/session behavior produces a no-op mutation, the API can still return `200` with critique JSON even though the database row was not updated. The sibling PATCH route uses `.select(...).maybeSingle()` to verify the row changed.
- **Fix**: Chain `.select("id").maybeSingle()` after the UPDATE and return `404` when no row is updated, or `500` on an update error.
  - Strength: Matches the existing PATCH route's persistence confirmation pattern and avoids false success responses.
  - Tradeoff: Small route change; the API now distinguishes post-AI row loss from generic update failure.
  - Confidence: HIGH — Supabase mutations can validly affect zero rows.
  - Blind spot: We did not manually reproduce the deletion/race window.
- **Decision**: FIXED via update verification change

### F3 — Critique can run against stale persisted blocks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/CanvasEditor.tsx:135
- **Detail**: `handleBlur()` starts `saveBlocks()` without awaiting it, while `runCritique()` POSTs to an endpoint that reads blocks from the database. Clicking "Run Critique" while editing a cell can trigger blur/save and critique almost simultaneously, so the AI may critique the old persisted value or reject a canvas that appears complete in the UI.
- **Fix A ⭐ Recommended**: Have `runCritique()` save `blocksRef.current` and await that save before POSTing the critique request.
  - Strength: Keeps the existing endpoint contract and ensures the persisted snapshot matches what the founder just edited.
  - Tradeoff: Requires `saveBlocks()` to return success/failure so critique can stop when save fails.
  - Confidence: HIGH — the current event ordering makes the race plausible.
  - Blind spot: Not browser-reproduced during this review.
- **Fix B**: Send the current blocks payload to the critique endpoint and let the endpoint validate, persist, critique, and store one submitted snapshot.
  - Strength: Stronger atomic UX contract around the exact data being critiqued.
  - Tradeoff: Wider API contract change than the plan described.
  - Confidence: MEDIUM — better model, but larger than a triage fix.
  - Blind spot: Would need checking against the existing PATCH route design.
- **Decision**: FIXED via awaiting save before critique

### F4 — Supabase database types are stale after migration

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/database.types.ts:31
- **Detail**: The migration adds `canvases.critique`, but generated `Database` types still omit `critique` from `canvases.Row`, `Insert`, and `Update`. `src/types.ts` works around it at the app type layer, but future Supabase queries will not type the column correctly from the generated source of truth.
- **Fix**: Regenerate or update `src/lib/database.types.ts` so `canvases.Row`, `Insert`, and `Update` include `critique: Json | null`.
- **Decision**: FIXED via regenerated database types

## Verification

- `npx supabase db reset` — PASS. Local migrations applied, including `20260611000000_add_critique_column.sql`.
- `npm run build` — PASS. Production build completed.
- `npm run lint` — PASS (warnings only: unexpected console statements in `src/pages/api/canvases/[id]/critique.ts`, `src/pages/api/canvases/index.ts`, and `src/pages/dashboard.astro`).
