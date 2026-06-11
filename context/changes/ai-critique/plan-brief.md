# AI Block-Level Critique — Plan Brief

> Full plan: `context/changes/ai-critique/plan.md`

## What & Why

Add an AI critique flow to the canvas editor (S-03). After filling all 9 BMC blocks, the founder clicks "Run Critique" and receives per-block feedback classifying consistency gaps, completeness gaps, and investor-challenge assumptions — each tagged to a named block. The critique is persisted in the database so the upcoming S-04 share link can include it without re-running the AI.

## Starting Point

S-02 is complete: `generateBMCCanvas` in `src/lib/services/ai.ts` already uses the OpenRouter/OpenAI-SDK pattern with strict JSON schema output. The `canvases` table has `blocks jsonb`; it needs one new `critique jsonb` column. `CanvasEditor.tsx` owns the block grid and editor header — critique feedback renders inline there.

## Desired End State

The founder opens a filled canvas, clicks "Run Critique" in the editor header, waits ~5–15 s, and sees a category badge plus 1–2 sentences of targeted feedback inside each of the 9 block cells. Critique survives a page refresh (stored in DB). Re-running overwrites the previous result.

## Key Decisions Made

| Decision             | Choice                                                                                 | Why (1 sentence)                                                                        | Source |
| -------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| Critique storage     | DB-persisted (`critique jsonb` column)                                                 | S-04 share link must display critique without re-running AI                             | Plan   |
| Output shape         | One `{ category, text }` item per block (strict JSON schema)                           | Maps exactly to the roadmap acceptance test; strict schema is reliable with GPT-4o      | Plan   |
| UI placement         | Inline beneath each block cell                                                         | Co-locates feedback with the block it critiques; no context-switching                   | Plan   |
| Trigger              | Single "Run Critique" button in editor header                                          | Follows S-02's "Generating…" pattern; familiar UX                                       | Plan   |
| Re-run               | Overwrites previous result, no confirmation                                            | Simple state machine at MVP; critique history is out of scope                           | Plan   |
| Auth guard           | Explicit `owner_id` filter on SELECT before AI call                                    | `lessons.md` rule — RLS alone can silently block if JWT isn't attached                  | Plan   |
| Cross-block emphasis | VP↔CS fit + Cost↔Revenue balance                                                       | Two most common BMC failure modes; satisfies roadmap "at least one" criterion with room | Plan   |
| Prompt & model       | `CRITIQUE_SYSTEM_PROMPT` + `CRITIQUE_MODEL` as named module-level constants in `ai.ts` | Easy to tune without touching function logic                                            | Plan   |
| Min completeness     | All 9 blocks non-empty (400 otherwise)                                                 | Critique of a partial canvas is low-value; roadmap says "filled canvas"                 | Plan   |

## Scope

**In scope:**

- New `critique jsonb` column + migration
- `CritiqueCategory`, `BlockCritique`, `CanvasCritique` types in `src/types.ts`
- `CRITIQUE_SYSTEM_PROMPT`, `CRITIQUE_MODEL`, `critiqueBMCCanvas()` added to `src/lib/services/ai.ts`
- `POST /api/canvases/[id]/critique` endpoint
- "Run Critique" / "Re-run Critique" button + loading/error state in `CanvasEditor`
- Inline critique section per `BlockCell` (category badge + text)

**Out of scope:**

- Per-block re-critique
- Critique history or versioning
- Streaming critique response
- Dashboard or share-link UI changes (S-04 reads `critique` from DB)
- Middleware changes (routes already protected)

## Architecture / Approach

The critique call mirrors `generateBMCCanvas`: the React island POSTs to a new API route, the route validates ownership and completeness, calls `critiqueBMCCanvas()` (new export in `ai.ts`), writes the result to `canvases.critique`, and returns the JSON to the client. The client sets `critique` state, which flows as props into each `BlockCell` for inline rendering. On page load, `canvas.critique` from the server initialises the state so critique is immediately visible without a re-call.

## Phases at a Glance

| Phase                       | What it delivers                                           | Key risk                                                                                                   |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1. Schema Migration + Types | `critique` column live; TS types defined                   | None — small migration, established pattern                                                                |
| 2. AI Function + API Route  | `critiqueBMCCanvas()` + `POST /api/canvases/[id]/critique` | Nested route (`[id]/critique.ts`) alongside existing `[id].ts` — verify Astro routing handles this cleanly |
| 3. CanvasEditor UI          | Critique trigger + inline per-block display                | Editor header getting busy (`Saved ✓` + critique button); layout needs care                                |

**Prerequisites:** S-02 fully done (✓); local Supabase running; `OPENROUTER_API_KEY` in `.dev.vars`
**Estimated effort:** ~2–3 sessions across 3 phases

## Open Risks & Assumptions

- Nested Astro route `src/pages/api/canvases/[id]/critique.ts` alongside `src/pages/api/canvases/[id].ts` — test that Astro resolves both without conflict on Cloudflare Workers.
- GPT-4o with strict JSON schema is reliable for 9-block structured output (assumption carried over from S-02; no new risk).

## Success Criteria (Summary)

- All 9 block cells show a category badge + critique text after "Run Critique" completes
- `canvases.critique` is populated in Supabase Studio and survives page refresh
- Empty-block attempt returns a 400 with a user-visible error message
