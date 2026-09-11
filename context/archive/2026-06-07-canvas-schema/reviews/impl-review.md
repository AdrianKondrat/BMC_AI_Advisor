<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Canvas Schema Implementation Plan

- **Plan**: context/changes/canvas-schema/plan.md
- **Scope**: All Phases (1–2 of 2)
- **Date**: 2026-06-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | FAIL    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — share_links_updated_at trigger breaks all UPDATEs on share_links

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Plan Adherence
- **Location**: supabase/migrations/20260607000000_canvas_schema.sql:43-45
- **Detail**: The plan said "triggers on both tables" but defined updated_at only on canvases. Implementation added share_links_updated_at which calls set_updated_at() — that function sets NEW.updated_at = now() but share_links has no updated_at column. Any UPDATE to share_links would raise a runtime error.
- **Fix**: New migration dropping the trigger: `DROP TRIGGER IF EXISTS share_links_updated_at ON share_links;`
- **Decision**: FIXED via supabase/migrations/20260607000001_drop_share_links_updated_at_trigger.sql

### F2 — canvases UPDATE policy missing WITH CHECK — owner_id can be transferred

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260607000000_canvas_schema.sql:67
- **Detail**: UPDATE policy had USING but no WITH CHECK. Without WITH CHECK, an owner could change owner_id to any other user's UUID, silently transferring canvas ownership.
- **Fix**: New migration dropping and recreating the UPDATE policy with both USING and WITH CHECK (owner_id = auth.uid()).
- **Decision**: FIXED via supabase/migrations/20260607000002_fix_canvases_update_policy.sql

### F3 — anon SELECT on share_links exposes token and pin_hash to the public

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260607000000_canvas_schema.sql:95-99
- **Detail**: The anon SELECT policy restricts rows (non-expired) but not columns. token and pin_hash are readable by unauthenticated callers via PostgREST. Accepted risk until S-04 replaces this stub with an application-layer endpoint.
- **Fix chosen**: Fix B — added SQL comment documenting the accepted exposure in the migration file.
- **Decision**: ACCEPTED-AS-DOCUMENTED (Fix B applied)

### F4 — Supabase client untyped; manual types will drift from schema

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Pattern Consistency
- **Location**: src/lib/supabase.ts:9 / src/types.ts
- **Detail**: createServerClient was called without a Database type parameter. Manual interfaces in types.ts had no schema-derived safety net — any future migration could silently drift from the TypeScript types.
- **Fix**: Generated src/lib/database.types.ts via `npx supabase gen types typescript --local`. Wired createServerClient<Database> in supabase.ts. Derived Canvas and ShareLink in types.ts from Tables<> row types. Added database.types.ts to ESLint ignores (generated file).
- **Decision**: FIXED via Fix A

### F5 — CASCADE delete is silent and irreversible — intent not documented

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260607000000_canvas_schema.sql:9
- **Detail**: ON DELETE CASCADE means user deletion permanently removes all canvas data with no recovery path. Intentional but undocumented.
- **Decision**: SKIPPED
