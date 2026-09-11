<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI-Generated BMC Fill

- **Plan**: `context/changes/s-02/plan.md`
- **Scope**: Phases 1-5 of 5
- **Date**: 2026-06-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Verification

- `npm run build`: PASS
- `npm run lint`: PASS, with warnings only
- `npx supabase db reset`: NOT RERUN during review because it resets local database state; Phase 1 records it as previously passed.

## Findings

### F1 — Validation errors can render as non-string content

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/NewCanvasForm.tsx:26
- **Detail**: The plan requires inline error handling that preserves the idea text. The API returns `{ error: result.error.issues }` for validation failures, but the form casts `error` as a string and can pass an array of Zod issue objects into React text output.
- **Fix**: Normalize API errors to a string at the API boundary, or defensively coerce unknown client error payloads before `setErrorMessage`.
- **Decision**: FIXED — POST now returns a joined string of Zod issue messages.

### F2 — AI response is parsed and cast without local validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/ai.ts:73
- **Detail**: OpenRouter strict JSON schema reduces risk, but this is still an external boundary. Valid JSON with missing or wrong-shaped fields would be accepted by `JSON.parse(...) as` and could be inserted into Supabase.
- **Fix**: Validate the parsed AI payload with a local Zod schema before returning it.
- **Decision**: FIXED — `generateBMCCanvas` now zod-parses the AI payload before returning it.

### F3 — Full-canvas autosaves can race and overwrite newer edits

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/CanvasEditor.tsx:94
- **Detail**: Each blur sends the full `blocks` object. If two saves are in flight, an older request can finish after a newer one and leave the database with stale block content.
- **Fix A ⭐ Recommended**: Serialize saves and queue the latest full-block snapshot
  - Strength: Preserves the planned PATCH contract and keeps the API unchanged.
  - Tradeoff: Slightly more client state around pending saves.
  - Confidence: HIGH — the risk is confined to `CanvasEditor`.
  - Blind spot: Does not protect against two browser tabs editing the same canvas.
- **Fix B**: Change the API to PATCH only the edited block with server-side merge semantics
  - Strength: Reduces payload size and narrows each write.
  - Tradeoff: Changes the planned API contract and touches both client and server.
  - Confidence: MEDIUM — better long-term shape, but broader than the current slice.
  - Blind spot: Would need manual regression testing for all edit flows.
- **Decision**: FIXED — Saves now run serially via a queued `saveBlocks` loop to respect the latest snapshot.

### F4 — PATCH accepts unbounded block text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/canvases/[id].ts:9
- **Detail**: `z.string()` allows authenticated users to send very large block values. That can increase request, database, and render cost for a user-controlled payload.
- **Fix**: Add reasonable `.max(...)` limits for block strings, aligned with expected BMC text length.
- **Decision**: FIXED — PATCH now limits each block string to <=2000 chars via Zod.

### F5 — AI request has no explicit application timeout

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/ai.ts:45
- **Detail**: The OpenRouter request relies on SDK/platform timeout behavior. A slow provider can keep the create route occupied longer than the app intends.
- **Fix**: Configure an explicit timeout on the OpenAI client/request and return the existing AI failure response when it expires.
- **Decision**: SKIPPED — keep the default OpenRouter timeout for now (per triage choice).

### F6 — Migration reset was not rerun during review

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: `npm run build` passed and `npm run lint` exited 0 with warnings only. I did not rerun `npx supabase db reset` during review because it resets local database state; the plan records it as previously passed in Phase 1.
- **Fix**: Rerun `npx supabase db reset` only when local data loss is acceptable or against a disposable DB.
- **Decision**: SKIPPED — not rerunning reset because it destroys local state; plan already recorded the earlier result.
