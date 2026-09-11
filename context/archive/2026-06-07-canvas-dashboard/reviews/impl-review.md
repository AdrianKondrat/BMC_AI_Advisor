<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Canvas Dashboard (S-01)

- **Plan**: context/changes/canvas-dashboard/plan.md
- **Scope**: All Phases (1–3)
- **Date**: 2026-06-08
- **Verdict**: APPROVED (post-triage fixes applied)
- **Findings**: 0 critical 4 warnings 2 observations (1 finding already resolved by another)

## Verdicts

| Dimension           | Verdict             |
| ------------------- | ------------------- |
| Plan Adherence      | PASS                |
| Scope Discipline    | WARNING             |
| Safety & Quality    | WARNING             |
| Architecture        | WARNING             |
| Pattern Consistency | WARNING             |
| Success Criteria    | FAIL → PASS (fixed) |

## Findings

### F1 — Lint failure: `||` instead of `??` in name fallback

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/CanvasList.tsx:53
- **Detail**: `canvas.name || "Untitled canvas"` failed the `@typescript-eslint/prefer-nullish-coalescing` rule. Plan specified `??`; `||` was used instead. ESLint exited 1.
- **Fix**: Changed `||` to `??` on line 53.
- **Decision**: FIXED

### F2 — Dual auth resolution: middleware user ignored in DELETE handler

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/pages/api/canvases/[id].ts:9–30
- **Detail**: Handler ran two separate auth checks — middleware `context.locals.user` guard plus a second `getUser()` call whose result was used for the `owner_id` filter. Created a minor TOCTOU window and diverged from the middleware-driven pattern used everywhere else.
- **Fix A ⭐**: Removed the second `getUser()` block; now uses `context.locals.user.id` directly in `.eq("owner_id", ...)`.
  - Strength: Matches the established pattern; eliminates TOCTOU window and dead code.
  - Tradeoff: Slight reduction in defense-in-depth; acceptable since middleware already called getUser().
  - Confidence: HIGH
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A

### F3 — SELECT canvases with no owner_id filter

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:12–16
- **Detail**: Dashboard SELECT query had no `.eq("owner_id", user.id)` filter. Relied solely on RLS. If RLS SELECT policy is ever misconfigured, authenticated users could see each other's canvases.
- **Fix**: Added `.eq("owner_id", user.id)` to the SELECT query chain.
- **Decision**: FIXED

### F4 — Existing migration edited to fix gen_random_bytes schema qualifier

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20260607000000_canvas_schema.sql:22
- **Detail**: `gen_random_bytes(32)` → `extensions.gen_random_bytes(32)` was applied in commit 2801dfb (canvas-dashboard Phase 1). This file belongs to canvas-schema. Editing a committed migration creates state mismatch between environments.
- **Fix A ⭐**: Accepted the edit for this solo-project context. Recorded a recurring lesson: "Never edit a committed migration; create a new one instead."
- **Decision**: ACCEPTED-AS-RULE: Migration immutability

### F5 — Redundant getSession() dead code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/canvases/[id].ts:23
- **Detail**: `await supabase.auth.getSession()` was called with result discarded. Dead code alongside the dual-auth block.
- **Fix**: Resolved by F2 Fix A — the entire block including this line was removed.
- **Decision**: FIXED (via F2)

### F6 — Supabase query errors silently swallowed on dashboard page

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:12–17
- **Detail**: `const { data }` discarded `error`. A network failure or RLS error silently returned an empty canvas list.
- **Fix**: Destructured `error` alongside `data`; added `console.error` server-side when non-null.
- **Decision**: FIXED

### F7 — No in-flight guard on delete — duplicate requests possible

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/CanvasList.tsx:24–32
- **Detail**: `handleDelete` had no loading state; duplicate DELETE requests possible before fetch responds. Idempotent so no data corruption risk.
- **Fix**: Track `deletingId` state; disable AlertDialogAction while in-flight.
- **Decision**: SKIPPED
