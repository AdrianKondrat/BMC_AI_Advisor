# AI Block-Level Critique Implementation Plan

## Overview

Implement S-03: a "Run Critique" flow on the canvas editor where the founder triggers an AI critique of their filled canvas and sees per-block feedback classified as consistency gap, completeness gap, or investor-challenge assumption — each tagged to one of the 9 BMC blocks. Critique results are persisted to the database so the S-04 share link can include them.

## Current State Analysis

- `src/lib/services/ai.ts` — `generateBMCCanvas` already uses the OpenRouter/OpenAI-SDK pattern with strict JSON schema; `CRITIQUE_SYSTEM_PROMPT` and `CRITIQUE_MODEL` will be added as module-level constants alongside the existing `BMC_KEYS` and `BMC_SCHEMA` constants.
- `src/pages/api/canvases/[id].ts` — has DELETE + PATCH; the critique route sits at `src/pages/api/canvases/[id]/critique.ts` (nested under the same dynamic segment).
- `src/components/CanvasEditor.tsx` — owns the block grid and editor header; critique trigger button and per-block feedback render here.
- `src/types.ts` — needs three new types: `CritiqueCategory`, `BlockCritique`, `CanvasCritique`.
- `canvases` table — has `blocks jsonb`, `idea text`, `name text`. Needs a new `critique jsonb` column.
- Middleware already protects `/canvas`; no routing changes needed.

## Desired End State

- Founder opens `/canvas/[id]`, fills all 9 blocks, and clicks "Run Critique" in the editor header.
- The button shows "Analysing…" and is disabled while the AI call is in-flight (~5–15 s).
- On success, each block cell gains an inline critique section: a category badge (`consistency` / `completeness` / `investor`) and 1–2 sentences of specific feedback.
- Critique is stored in the `canvases.critique` column; it survives page refresh and will be readable by the S-04 share-link view.
- Re-running critique overwrites the previous result (no confirmation prompt at MVP).
- Attempting to critique a canvas with any empty block returns a 400 and the UI shows an inline error.

### Key Discoveries

- `src/lib/services/ai.ts:5–32` — `BMC_KEYS` and `BMC_SCHEMA` are module-level constants; `CRITIQUE_SYSTEM_PROMPT` and `CRITIQUE_MODEL` follow the same pattern.
- `src/pages/api/canvases/[id].ts:7` — UUID regex already defined; the nested critique route re-uses the same pattern.
- `lessons.md` rule: always add `.eq('owner_id', user.id)` on Supabase mutations — applies to the critique UPDATE.
- `lessons.md` rule: never edit committed migrations — new `ALTER TABLE` migration required.
- `CanvasEditor.tsx:83` — `canvas.blocks` initialises `blocks` state; `canvas.critique` will initialise `critique` state the same way.

## What We're NOT Doing

- No per-block re-critique (single whole-canvas trigger only).
- No critique history / versioning — re-run overwrites.
- No streaming the critique response.
- No toast library — inline status text in the editor header only.
- No UI changes to the dashboard or share link (S-04 reads `critique` from DB directly).
- No changes to `src/middleware.ts` (routes already protected).

## Implementation Approach

**Phase 1** adds the DB column and TS types so the rest of the plan has a stable contract.

**Phase 2** adds `CRITIQUE_SYSTEM_PROMPT`, `CRITIQUE_MODEL`, and `critiqueBMCCanvas()` to `ai.ts`, then wires them into a new `POST /api/canvases/[id]/critique` route that: verifies ownership (SELECT before AI call), validates all 9 blocks are non-empty (400 otherwise), calls the AI, and UPDATEs `canvases.critique`.

**Phase 3** updates `CanvasEditor` and `BlockCell` to show the trigger button, loading/error states, and inline per-block critique.

---

## Phase 1: Schema Migration + Type Updates

### Overview

Add `critique jsonb` to the `canvases` table and extend `src/types.ts` with the three critique types. This gives the rest of the plan a stable schema and type contract.

### Changes Required

#### 1. New migration

**File**: `supabase/migrations/20260611000000_add_critique_column.sql`

**Intent**: Add a nullable `critique` column to `canvases` so critique results can be persisted. Existing canvas rows are unaffected (column is nullable).

**Contract**: `ALTER TABLE canvases ADD COLUMN critique jsonb;` — nullable, no default, no RLS policy change needed (existing per-operation policies already cover the whole row).

#### 2. New types

**File**: `src/types.ts`

**Intent**: Give the AI service, API route, and React components a shared type for critique output.

**Contract**: Add after the existing `CanvasSummary` type:

```ts
export type CritiqueCategory = "consistency" | "completeness" | "investor";

export interface BlockCritique {
  category: CritiqueCategory;
  text: string;
}

export type CanvasCritique = Record<BMCBlockKey, BlockCritique>;
```

Also update the `Canvas` type to include `critique: CanvasCritique | null` in the intersection (after `blocks: Partial<CanvasBlocks>`).

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset` exits 0
- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- `canvases` table in Supabase Studio shows the new `critique` column (nullable, type jsonb)
- Existing canvas rows still appear without error

**Implementation Note**: After automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: AI Critique Function + API Route

### Overview

Add the critique AI function to `ai.ts` — with `CRITIQUE_SYSTEM_PROMPT` and `CRITIQUE_MODEL` as named module-level constants — then wire it into a new `POST /api/canvases/[id]/critique` route.

### Changes Required

#### 1. Critique constants and function in AI service

**File**: `src/lib/services/ai.ts`

**Intent**: Encapsulate the critique call behind a named function and expose the system prompt and model as editable top-level constants so they can be tuned without touching function logic.

**Contract**:

Add at the module level (alongside `BMC_KEYS` and `BMC_SCHEMA`):

```ts
export const CRITIQUE_MODEL = "openai/gpt-4o";

export const CRITIQUE_SYSTEM_PROMPT = `You are an expert business model advisor evaluating a Business Model Canvas.

For each of the 9 BMC blocks, return exactly one critique item with:
- category: "consistency" (the block conflicts with or undermines another block), "completeness" (the block is vague, generic, or missing key specifics), or "investor" (an assumption a seed-stage investor would challenge).
- text: 1–2 sentences of direct, actionable feedback specific to the content of the block.

Pay particular attention to:
1. Value Propositions ↔ Customer Segments fit: does the VP address real, named pains of the stated segments?
2. Cost Structure ↔ Revenue Streams balance: are the key costs proportionate to and justified by the revenue model?

Return one critique item per block even if a block appears strong — note the most important missing detail.`;
```

Add the JSON schema constant `CRITIQUE_SCHEMA` (same shape as `BMC_SCHEMA` but with object values):

- 9 required keys (all `BMCBlockKey` values)
- Each property: `{ type: 'object', properties: { category: { type: 'string', enum: ['consistency','completeness','investor'] }, text: { type: 'string' } }, required: ['category','text'], additionalProperties: false }`
- Top-level `additionalProperties: false`

Export function:

```ts
export async function critiqueBMCCanvas(blocks: CanvasBlocks): Promise<CanvasCritique>;
```

- Creates the same `OpenAI` client as `generateBMCCanvas` (same `baseURL` + `OPENROUTER_API_KEY`)
- Uses `CRITIQUE_MODEL` for the model field
- `response_format`: `{ type: 'json_schema', json_schema: { name: 'bmc_critique', strict: true, schema: CRITIQUE_SCHEMA } }`
- System message: `CRITIQUE_SYSTEM_PROMPT`
- User message: serialises `blocks` as labelled text (one line per block: `"Key Partners: <content>"`) so the AI sees the actual canvas content
- Throws on empty response or parse failure; caller handles

#### 2. POST /api/canvases/[id]/critique route

**File**: `src/pages/api/canvases/[id]/critique.ts`

**Intent**: Accept a critique trigger from the owner, validate canvas completeness, call the AI, persist the result, and return it.

**Contract**:

- `export const prerender = false`
- Exports `POST: APIRoute`
- Auth guard: 401 if `context.locals.user` is absent
- UUID validation of `context.params.id` using the same regex as `[id].ts`; 400 if invalid
- Fetch canvas: `SELECT blocks FROM canvases WHERE id = :id AND owner_id = :userId LIMIT 1` — explicit owner filter per `lessons.md` rule; 404 if no row
- Completeness check: all 9 `BMCBlockKey` values must be non-empty strings in `canvas.blocks`; return `Response.json({ error: 'All 9 blocks must be filled before running critique' }, { status: 400 })` otherwise
- Call `critiqueBMCCanvas(canvas.blocks as CanvasBlocks)` — on throw, log and return 500
- Supabase UPDATE: `.from('canvases').update({ critique: result }).eq('id', id).eq('owner_id', userId)` — explicit owner filter; 500 on error
- Return `Response.json(result, { status: 200 })`

### Success Criteria

#### Automated Verification

- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- Authenticated POST to a fully-filled canvas returns 200 with a JSON object containing all 9 block keys, each with `category` and `text` fields
- Supabase Studio shows `critique` column populated on that canvas row
- Authenticated POST to a canvas with any empty block returns 400 with the completeness error message
- Unauthenticated POST returns 401
- POST with an invalid UUID returns 400
- POST with another user's canvas ID returns 404

**Implementation Note**: After automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: CanvasEditor UI — Critique Trigger + Inline Display

### Overview

Update `CanvasEditor` to initialise `critique` state from `canvas.critique`, add a "Run Critique" button to the editor header, and render per-block critique inline inside each `BlockCell`.

### Changes Required

#### 1. Update CanvasEditor component

**File**: `src/components/CanvasEditor.tsx`

**Intent**: Add critique trigger, loading/error state, and critique state initialised from the server-delivered canvas prop.

**Contract**:

- Import `CanvasCritique` and `BlockCritique` from `@/types`
- New state: `critique: CanvasCritique | null` — initialised from `canvas.critique ?? null`
- New state: `critiqueStatus: 'idle' | 'loading' | 'error'`
- `runCritique` async function: POST to `/api/canvases/${canvas.id}/critique`; on 200 set `critique` from response JSON; on non-2xx set `critiqueStatus: 'error'`; always restore `critiqueStatus` to `'idle'` on success (critique presence in state signals completion)
- Header row already has canvas name + save status; add "Run Critique" button to the right of the save status text:
  - Idle with no critique: label "Run Critique"
  - Idle with critique: label "Re-run Critique"
  - Loading: label "Analysing…", `disabled`
  - Error: inline text "Critique failed — try again" next to the button
- Pass `critique?.[blockKey]` as a new optional `critique` prop to each `BlockCell`

#### 2. Update BlockCell component

**File**: `src/components/CanvasEditor.tsx` (BlockCell is defined in the same file)

**Intent**: Render the per-block critique section below the block content when critique data is present.

**Contract**:

- Add optional `critique?: BlockCritique` to `BlockCellProps`
- When `critique` is present and the cell is not in active-edit mode, render below the block content:
  - A thin separator (`border-t border-white/10 mt-2 pt-2`)
  - A category badge: small pill with label text (`consistency` / `completeness` / `investor`) and distinct muted colour per category (e.g., yellow for `consistency`, blue for `completeness`, orange for `investor`)
  - The `critique.text` string in a small, dimmed font (`text-xs text-white/60`)
- When the cell is in active-edit mode, hide the critique section (don't distract the editor)

### Success Criteria

#### Automated Verification

- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- "Run Critique" button is visible in the editor header for a fully-filled canvas
- Clicking "Run Critique" disables the button and shows "Analysing…" label
- After response (~5–15 s): all 9 block cells show a category badge + critique text inline
- Re-loading the page preserves the critique (loaded from `canvas.critique`)
- "Re-run Critique" replaces the previous critique with the new result
- Attempting critique with any empty block shows the 400 error message inline
- Clicking a block to edit hides the critique section in that cell; blurring restores it
- Mobile viewport: critique text wraps cleanly within the stacked single-column layout

---

## Testing Strategy

### Manual Testing Steps

1. Open a canvas with all 9 blocks filled → verify "Run Critique" button appears in header
2. Click "Run Critique" → verify button switches to "Analysing…" and is disabled
3. After AI response: verify all 9 blocks show a category badge and critique text
4. In Supabase Studio: confirm `critique` column is populated with the 9-key JSON object
5. Refresh the page → verify critique is still visible (DB-loaded)
6. Click a block → verify critique section hides while editing; blur → critique reappears
7. Click "Re-run Critique" → verify new critique replaces the old one (Studio shows updated value)
8. Clear one block → click "Run Critique" → verify inline 400 error message ("All 9 blocks must be filled")
9. Unauthenticated: POST `/api/canvases/{id}/critique` in a REST client → 401
10. Wrong-owner canvas ID → 404

## Performance Considerations

AI critique call will take 5–15 s (same latency as canvas generation). The "Analysing…" disabled-button state is the only wait indicator — ensure the label change is immediate on click.

## Migration Notes

`20260611000000_add_critique_column.sql` must be applied after the existing canvas-schema migration. `npx supabase db reset` applies all migrations in timestamp order.

## References

- S-02 plan (AI service pattern): `context/changes/s-02/plan.md`
- AI service: `src/lib/services/ai.ts`
- Existing canvas API route: `src/pages/api/canvases/[id].ts`
- Shared types: `src/types.ts`
- Canvas editor component: `src/components/CanvasEditor.tsx`
- Lessons: `context/foundation/lessons.md`
- Roadmap S-03: `context/foundation/roadmap.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema Migration + Type Updates

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` exits 0
- [x] 1.2 Build passes: `npm run build` exits 0
- [x] 1.3 Lint passes: `npm run lint` exits 0

#### Manual

- [x] 1.4 `canvases` table shows `critique` column (nullable, jsonb) in Supabase Studio
- [x] 1.5 Existing canvas rows still appear without error

### Phase 2: AI Critique Function + API Route

#### Automated

- [ ] 2.1 Build passes: `npm run build` exits 0
- [ ] 2.2 Lint passes: `npm run lint` exits 0

#### Manual

- [ ] 2.3 Authenticated POST to fully-filled canvas returns 200 with 9-key critique JSON
- [ ] 2.4 Supabase Studio shows `critique` column populated on that canvas row
- [ ] 2.5 POST to canvas with empty block returns 400 with completeness error message
- [ ] 2.6 Unauthenticated POST returns 401
- [ ] 2.7 POST with invalid UUID returns 400
- [ ] 2.8 POST with another user's canvas ID returns 404

### Phase 3: CanvasEditor UI — Critique Trigger + Inline Display

#### Automated

- [ ] 3.1 Build passes: `npm run build` exits 0
- [ ] 3.2 Lint passes: `npm run lint` exits 0

#### Manual

- [ ] 3.3 "Run Critique" button visible in editor header for a fully-filled canvas
- [ ] 3.4 Button shows "Analysing…" and is disabled during AI call
- [ ] 3.5 All 9 blocks show category badge + critique text after response
- [ ] 3.6 Page refresh preserves critique (loaded from DB)
- [ ] 3.7 "Re-run Critique" replaces previous critique
- [ ] 3.8 Empty-block attempt shows inline 400 error message
- [ ] 3.9 Editing a block hides critique section; blur restores it
