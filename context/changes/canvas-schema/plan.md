# Canvas Schema Implementation Plan

## Overview

Create the Supabase database schema for BMC AI Advisor: a `canvases` table (with JSONB blocks), a `share_links` table, per-operation RLS policies for authenticated owners, an anon-read stub for public share links, and the corresponding TypeScript types. This is the foundation all downstream slices (S-01 through S-04) depend on.

## Current State Analysis

No domain migrations exist. The `supabase/migrations/` directory was absent and has been created. The Supabase client is wired at `src/lib/supabase.ts` using `@supabase/ssr` with cookie-based sessions. The auth user is available as `context.locals.user` (set in `src/middleware.ts:13`). No `src/types.ts` exists.

## Desired End State

A single migration file applies cleanly against local Supabase, creating `canvases` and `share_links` with RLS enabled and all policies active. `src/types.ts` exports TypeScript types matching the schema. Any downstream slice can import the types and query the tables without additional schema work.

### Key Discoveries

- `src/lib/supabase.ts` uses `createServerClient` from `@supabase/ssr` — no raw `pg` client; all DB access goes through Supabase's REST/RPC layer which respects RLS automatically.
- `src/middleware.ts:13` sets `context.locals.user` via `supabase.auth.getUser()` — the `auth.uid()` function in RLS policies matches this identity.
- CLAUDE.md requires granular per-operation, per-role RLS policies (not a single permissive `ALL` policy).
- Migration naming convention per CLAUDE.md: `YYYYMMDDHHmmss_short_description.sql`.
- `pgcrypto` extension is available in Supabase by default — `gen_random_bytes` can generate the share token; `gen_random_uuid()` for UUIDs.
- PIN hashing: store `pin_hash text` (nullable). The application layer handles bcrypt comparison; the migration only defines the column.

## What We're NOT Doing

- No `canvas_blocks` normalized table — JSONB on `canvases` is the chosen shape.
- No `deleted_at` soft-delete column — hard DELETE is the only delete path.
- No full share-link validation logic (PIN comparison, expiry enforcement) — that is S-04's API layer.
- No seed data or test fixtures.
- No Supabase Edge Functions.

## Implementation Approach

One migration file creates both tables, the `updated_at` trigger function, triggers on both tables, enables RLS, and installs all policies. TypeScript types in `src/types.ts` are written to mirror the SQL schema exactly, using `Partial<CanvasBlocks>` for the JSONB column (blocks may be empty on creation).

## Critical Implementation Details

**RLS for `share_links` owner policies** — the authenticated owner check must join through `canvases` because `share_links` has no direct `owner_id` column. Use a subquery: `canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid())`. This must appear in both `USING` and `WITH CHECK` clauses for write policies.

**Anon read on `share_links`** — the anon role needs `USING (expires_at IS NULL OR expires_at > now())`. PIN validation is intentionally left to the application layer; the DB only enforces expiry at the row level.

---

## Phase 1: Supabase Migration

### Overview

Write a single SQL migration that creates both tables, the `updated_at` maintenance trigger, enables RLS, and installs all policies. Applies cleanly with `npx supabase db reset` or `npx supabase migration up`.

### Changes Required

#### 1. Migration file

**File**: `supabase/migrations/20260607000000_canvas_schema.sql`

**Intent**: Define the complete domain schema for canvases and share links in one atomic migration. All downstream slices depend on this applying cleanly.

**Contract**: The file must contain (in order): extension enable for `pgcrypto`, table DDL for `canvases`, table DDL for `share_links`, the `set_updated_at()` trigger function, triggers on both tables, `ALTER TABLE … ENABLE ROW LEVEL SECURITY` for both tables, and six RLS policies (four on `canvases`, two on `share_links` for authenticated role, one on `share_links` for anon role).

Schema contract:

```sql
-- canvases
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name        text        -- nullable; filled by S-02 AI generation
blocks      jsonb       NOT NULL DEFAULT '{}'::jsonb
created_at  timestamptz NOT NULL DEFAULT now()
updated_at  timestamptz NOT NULL DEFAULT now()

-- share_links
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
canvas_id   uuid        NOT NULL REFERENCES canvases(id) ON DELETE CASCADE
token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')
expires_at  timestamptz -- nullable
pin_hash    text        -- nullable; bcrypt hash, compared by application layer
created_at  timestamptz NOT NULL DEFAULT now()

-- RLS policies (canvases, authenticated role)
"owners can select own canvases"   FOR SELECT  USING (owner_id = auth.uid())
"owners can insert own canvases"   FOR INSERT  WITH CHECK (owner_id = auth.uid())
"owners can update own canvases"   FOR UPDATE  USING (owner_id = auth.uid())
"owners can delete own canvases"   FOR DELETE  USING (owner_id = auth.uid())

-- RLS policies (share_links, authenticated role)
"owners can select own share_links"  FOR SELECT  USING  (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()))
"owners can insert own share_links"  FOR INSERT  WITH CHECK (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()))
"owners can update own share_links"  FOR UPDATE  USING  (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()))
"owners can delete own share_links"  FOR DELETE  USING  (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()))

-- RLS policy (share_links, anon role — S-04 stub)
"public can read valid share_links"  FOR SELECT  TO anon  USING (expires_at IS NULL OR expires_at > now())
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly against local Supabase: `npx supabase db reset` exits 0
- Both tables exist: `npx supabase db diff` shows no pending changes after reset
- `npm run build` exits 0 (no TS errors introduced by the new types file)
- `npm run lint` exits 0

#### Manual Verification

- In Supabase Studio (port 54323), `canvases` and `share_links` appear in the Table Editor with the correct columns
- RLS is shown as enabled on both tables in the Authentication → Policies view
- All nine policies are listed with the correct target roles and operations
- Inserting a canvas row as a different user's `auth.uid()` is rejected by RLS

**Implementation Note**: After automated verification passes, pause for manual confirmation in Supabase Studio before proceeding to Phase 2.

---

## Phase 2: TypeScript Types

### Overview

Write `src/types.ts` exporting the TypeScript representations of the schema. This file is the single source of truth for shared entity types consumed by S-01, S-02, S-03, and S-04.

### Changes Required

#### 1. Shared types file

**File**: `src/types.ts`

**Intent**: Provide typed representations of `canvases` and `share_links` rows so downstream slices have a shared contract without duplicating inline types.

**Contract**:

```typescript
export type BMCBlockKey =
  | "key_partners"
  | "key_activities"
  | "key_resources"
  | "value_propositions"
  | "customer_relationships"
  | "channels"
  | "customer_segments"
  | "cost_structure"
  | "revenue_streams";

export type CanvasBlocks = Record<BMCBlockKey, string>;

export interface Canvas {
  id: string;
  owner_id: string;
  name: string | null;
  blocks: Partial<CanvasBlocks>;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  canvas_id: string;
  token: string;
  expires_at: string | null;
  pin_hash: string | null;
  created_at: string;
}
```

`blocks` is `Partial<CanvasBlocks>` because a freshly created canvas has an empty JSONB object (`{}`); all 9 keys are present only after S-02 fills them.

### Success Criteria

#### Automated Verification

- `npm run build` exits 0 with no TypeScript errors
- `npm run lint` exits 0

#### Manual Verification

- `src/types.ts` exports are importable from a dashboard page without TS errors (quick smoke-check: add a temporary `import type { Canvas } from '@/types'` to `src/pages/dashboard.astro` and confirm build passes, then revert)

---

## Testing Strategy

### Manual Testing Steps

1. Run `npx supabase start` and then `npx supabase db reset` — confirm it exits 0
2. Open Supabase Studio at `http://127.0.0.1:54323`
3. Check Table Editor — both tables visible with correct columns
4. Check Authentication → Policies — all 9 policies listed
5. Use the SQL editor to attempt an INSERT into `canvases` with a hardcoded `owner_id` that does not match the session — confirm it is rejected

## Migration Notes

This is the first migration in the project. `supabase/migrations/` was empty; the file `20260607000000_canvas_schema.sql` is the initial baseline. Future migrations will use timestamps after this one.

## References

- Roadmap: `context/foundation/roadmap.md` §F-01
- GitHub issue: AdrianKondrat/BMC_AI_Advisor#1
- Supabase client: `src/lib/supabase.ts`
- Auth middleware: `src/middleware.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supabase Migration

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` exits 0 — 49c0303
- [x] 1.2 No pending diff after reset: `npx supabase db diff` is clean — 49c0303
- [x] 1.3 Build passes: `npm run build` exits 0 — 49c0303
- [x] 1.4 Lint passes: `npm run lint` exits 0 — 49c0303

#### Manual

- [x] 1.5 Both tables visible in Supabase Studio Table Editor with correct columns — 49c0303
- [x] 1.6 RLS enabled on both tables; all 9 policies listed in Auth → Policies — 49c0303
- [x] 1.7 Cross-user INSERT into `canvases` rejected by RLS — 49c0303

### Phase 2: TypeScript Types

#### Automated

- [x] 2.1 Build passes with types file: `npm run build` exits 0 — 395a0c1
- [x] 2.2 Lint passes: `npm run lint` exits 0 — 395a0c1

#### Manual

- [x] 2.3 `Canvas` and `ShareLink` types importable from `@/types` without TS errors — 395a0c1
