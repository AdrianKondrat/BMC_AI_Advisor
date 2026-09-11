# AI-Generated BMC Fill — Plan Brief

> Full plan: `context/changes/s-02/plan.md`

## What & Why

S-02 is the north-star slice: it delivers the core product proposition. A founder types a plain-text business idea, the app calls OpenRouter (GPT-4o) with a strict JSON schema, and all 9 Business Model Canvas blocks appear filled and editable — auto-saved to Supabase, auto-named by the AI, and visible in the founder's dashboard. Without this slice the product is a list view with a disabled button.

## Starting Point

The `canvases` table (with `blocks jsonb`) and the `Canvas` / `CanvasBlocks` TypeScript types are in place from F-01. The dashboard lists canvases from S-01. No canvas editor page, no canvas creation endpoint, no AI integration, and no `idea` storage column exist yet.

## Desired End State

The founder visits `/canvas/new`, types their idea, waits 5–15 s while a loading state plays, and lands on `/canvas/[id]` with all 9 BMC blocks filled in the classic 5-column grid layout. Clicking any block activates an inline textarea; clicking elsewhere auto-saves. The canvas appears in the dashboard with the AI-generated name. Refreshing the editor shows saved edits.

## Key Decisions Made

| Decision      | Choice                                         | Why                                                                                              | Source |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| Flow entry    | Dedicated `/canvas/new` page                   | Clean separation of create vs edit; URL is shareable; no modal state bleed                       | Plan   |
| AI UX         | Single-call JSON, skeleton during wait         | Simpler API + more reliable structured output than streaming; NFR satisfied by loading indicator | Plan   |
| Block editing | Click-to-edit inline textarea                  | Cleaner reading experience; active/inactive state signals editability                            | Plan   |
| Auto-save     | On blur                                        | Predictable, zero debounce complexity; works naturally with click-to-edit                        | Plan   |
| API shape     | `PATCH /api/canvases/[id]` full blocks         | Single JSONB column in DB; follows existing route pattern; negligible payload at MVP             | Plan   |
| AI failure    | Error inline on `/canvas/new`, no orphaned row | No partial-state cleanup; user retries with idea text preserved                                  | Plan   |
| Canvas naming | AI generates `name` field in structured output | Richer names than word-truncation; single AI call, no extra hop                                  | Plan   |
| Idea storage  | `idea text` column on `canvases`               | Enables future FR-009 re-prompt; accepted PRD NFR deviation (documented)                         | Plan   |
| AI provider   | GPT-4o via OpenRouter (`OPENROUTER_API_KEY`)   | Env var already declared; roadmap default; `json_schema` strict mode reliable on GPT-4o          | Plan   |
| Canvas rename | Not in S-02 scope                              | Narrows scope; FR-003 rename tracked as follow-up                                                | Plan   |
| Canvas layout | Classic BMC 5-column grid                      | Core product differentiator; blocks-as-grid communicates spatial relationships                   | Plan   |

## Scope

**In scope:**

- New migration: `idea text` column on `canvases`
- `src/lib/services/ai.ts` — OpenRouter service module
- `POST /api/canvases` — create + AI generate
- `PATCH /api/canvases/[id]` — block update (added to existing file)
- `src/components/NewCanvasForm.tsx` — idea input island
- `src/components/CanvasEditor.tsx` — BMC grid + click-to-edit + blur save
- `src/pages/canvas/new.astro` + `src/pages/canvas/[id].astro`
- Middleware: add `/canvas` to `PROTECTED_ROUTES`
- `CanvasList.tsx`: add "Open" links + activate "Create" CTAs

**Out of scope:**

- Streaming AI output; AI_PROVIDER switching; canvas rename; single-block re-prompt (FR-009); toast library

## Architecture / Approach

```
/canvas/new (Astro SSR)
  └─ NewCanvasForm (React island)
       └─ POST /api/canvases
            └─ src/lib/services/ai.ts → OpenRouter (GPT-4o, json_schema)
            └─ Supabase INSERT (owner_id, name, blocks, idea)
            └─ → { id }
       └─ window.location.href = /canvas/${id}

/canvas/[id] (Astro SSR — fetches canvas)
  └─ CanvasEditor (React island)
       └─ 5-col BMC grid, click-to-edit per block
       └─ PATCH /api/canvases/[id] on blur → Supabase UPDATE
```

## Phases at a Glance

| Phase                       | What it delivers                            | Key risk                                           |
| --------------------------- | ------------------------------------------- | -------------------------------------------------- |
| 1. Schema + Types           | `idea` column in DB; `Canvas.idea` type     | New migration must not touch committed SQL         |
| 2. POST /api/canvases       | AI generation + canvas creation in one call | OpenRouter latency + structured output reliability |
| 3. PATCH /api/canvases/[id] | Block persistence via existing route        | Explicit owner filter required (lessons.md)        |
| 4. React Components         | NewCanvasForm + CanvasEditor (BMC grid)     | BMC grid CSS (row-span / col-span layout)          |
| 5. Pages & Wiring           | Full end-to-end routing + dashboard links   | Middleware PROTECTED_ROUTES coverage               |

**Prerequisites:** F-01 (canvas-schema) and S-01 (canvas-dashboard) must be fully deployed before starting.
**Estimated effort:** ~3–4 sessions across 5 phases. Phase 2 (AI integration) and Phase 4 (BMC grid component) are the two heaviest.

## Open Risks & Assumptions

- **PRD NFR deviation:** `idea` stored in DB contradicts "not retained in operator-accessible storage." Accepted consciously for re-prompt capability.
- **AI latency:** 5–15 s is expected for GPT-4o generation. No progress beyond a spinner — this is the primary UX risk.
- **Structured output parse failure:** If OpenRouter returns malformed JSON, the user sees a 500 error and retries. No partial-fill logic.

## Success Criteria (Summary)

- Founder can go from idea text → filled 9-block canvas in a single session, with no external help.
- Each block is independently editable and auto-saved on blur; edits survive a page refresh.
- Canvas appears in the dashboard list with the AI-generated name and an "Open" link.
