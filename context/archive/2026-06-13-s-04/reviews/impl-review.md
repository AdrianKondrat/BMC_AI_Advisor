<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Share Canvas Implementation Plan

- **Plan**: `context/changes/s-04/plan.md`
- **Scope**: Phase 1-5 of 5
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Findings

### F1 — Shared links fail for logged-in recipients

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/share/[token].astro:11
- **Detail**: The share page uses `createClient(Astro.request.headers, Astro.cookies)`. If a recipient is logged in (but not the owner), requests run as `authenticated`, while token-based public read policies are defined for `anon`. Valid shared links can be rejected as "expired or invalid" for logged-in recipients.
- **Fix A ⭐ Recommended**: Resolve token lookups in a guaranteed anon-context path (for example, dedicated endpoint/RPC that validates token and expiry and returns only safe fields).
- Strength: Preserves strict owner policies for `authenticated` while making shared links behave consistently.
- Tradeoff: Adds server path complexity.
- Confidence: HIGH — current behavior is directly implied by role-specific RLS policies.
- Blind spot: Exact preferred implementation path (endpoint vs RPC) is not yet selected.
- **Fix B**: Add explicit `authenticated` token-based SELECT policies mirroring anon behavior on `share_links` and shared `canvases`.
  - Strength: Smaller app-layer change.
  - Tradeoff: Broadens authenticated read surface and increases policy complexity.
  - Confidence: MEDIUM — works technically, but carries higher long-term policy risk.
  - Blind spot: Future policy interactions when more authenticated-only features are added.
- **Decision**: FIXED (Fix A)

### F2 — Wrong-owner path returns 404 instead of planned 401 semantics

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/canvases/[id]/share.ts:35
- **Detail**: The plan success criteria says "Unauthenticated or wrong-owner calls return 401", but non-owner calls currently fail ownership lookup and return 404 in all handlers.
- **Fix**: Align API responses with plan semantics (return 401 for ownership failures) or update plan/manual criteria to accept 404-for-privacy semantics.
- **Decision**: FIXED (Fix now)

### F3 — Share-link rotation is delete-then-insert (non-atomic)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/canvases/[id]/share.ts:85
- **Detail**: `POST` deletes the current link before inserting a new one. If insert fails after delete, the previous valid link is lost.
- **Fix A ⭐ Recommended**: Rotate links atomically (transaction/RPC) so old link remains unless new one is created.
  - Strength: Eliminates transient data-loss window.
  - Tradeoff: Requires SQL function or transaction-capable path.
  - Confidence: HIGH — classic atomicity mitigation.
  - Blind spot: Exact RPC design is not yet drafted.
- **Fix B**: Upsert/update existing link instead of delete+insert.
  - Strength: Simple app-level flow with fewer moving parts.
  - Tradeoff: Changes token-rotation behavior semantics.
  - Confidence: MEDIUM — depends on product requirement for token replacement.
  - Blind spot: Whether preserving token is acceptable for expected UX/security posture.
- **Decision**: FIXED (Fix A)

### F4 — Automated verification not fully reproducible in current runtime

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: During this review run, `npx supabase db reset` could not run due Docker access limits in the current runtime, and `npm run build` failed here due sandbox restrictions for Wrangler logging/system interfaces. `npm run lint` completed with warnings only (no errors). This prevents full independent re-verification from this session.
- **Fix**: Re-run `npx supabase db reset` and `npm run build` directly in your local terminal context with Docker/Wrangler permissions to reconfirm.
- **Decision**: SKIPPED (sandbox blocked `npx supabase db reset` / `npm run build`)
