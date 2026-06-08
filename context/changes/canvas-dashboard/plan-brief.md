# Canvas Dashboard — Plan Brief

> Full plan: `context/changes/canvas-dashboard/plan.md`

## What & Why

Build S-01: a founder dashboard that lists saved canvases and allows deleting any canvas. This is the prerequisite for S-02 (AI canvas generation) — canvases must be listable and manageable before auto-save can land them somewhere useful.

## Starting Point

`dashboard.astro` is a placeholder shell (welcome card + sign-out). The `canvases` table is live with RLS enforcing per-user isolation (`context/changes/canvas-schema/plan.md`). No canvas API routes or React components exist yet.

## Desired End State

`/dashboard` shows the user's canvases, newest first. Each row has a name ("Untitled canvas" when null), creation date, and a Delete button that opens a confirmation dialog. Confirming removes the row without a page reload. An empty state with a disabled "Create your first canvas" CTA appears when the list is empty.

## Key Decisions Made

| Decision           | Choice                           | Why (1 sentence)                                                                                        | Source |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| Delete interaction | React island + AlertDialog       | Prevents accidental deletion while staying consistent with the shadcn/ui pattern already in the project | Plan   |
| Data fetching      | Server-side in `dashboard.astro` | SSR delivers a hydrated list with no client loading state, matching the Astro-first convention          | Plan   |
| Post-delete state  | Optimistic client removal        | Avoids a full page reload; state is `useState` initialized from SSR props                               | Plan   |
| Null canvas name   | "Untitled canvas" fallback       | Always renders a readable label; matches standard doc-editor conventions                                | Plan   |
| Dashboard layout   | Replace placeholder shell        | The welcome card is placeholder content — the canvas list is the dashboard                              | Plan   |
| List type          | `CanvasSummary` (no blocks)      | Avoids shipping the blocks JSONB to the client for a view that only needs id/name/dates                 | Plan   |

## Scope

**In scope:**

- `GET` canvases server-side in `dashboard.astro`
- `DELETE /api/canvases/[id]` API endpoint
- `CanvasList` React island with AlertDialog confirmation
- Empty state with disabled CTA
- Retain sign-out in page header

**Out of scope:**

- Canvas editing or viewing (S-02)
- Search, filter, pagination
- Soft-delete or undo
- "Create canvas" functionality (CTA is disabled stub)

## Architecture / Approach

Astro SSR page fetches `canvases` (id, name, created_at, updated_at) from Supabase before rendering and passes the array as props to a `CanvasList` React island (`client:load`). The island owns its list state; delete fires a `fetch` to the API endpoint and filters the item from state on success. RLS on the Supabase side silently enforces ownership; the endpoint only validates auth + UUID format.

## Phases at a Glance

| Phase                         | What it delivers                              | Key risk                                                  |
| ----------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| 1. DELETE API Endpoint        | `/api/canvases/[id]` DELETE handler           | Low risk — thin route, RLS does the hard work             |
| 2. CanvasList React Component | List UI with AlertDialog delete, empty state  | Install AlertDialog; first React component in the project |
| 3. Dashboard Page Wiring      | SSR fetch + island mount in `dashboard.astro` | Supabase error must fall back to empty list, not crash    |

**Prerequisites:** F-01 (canvas-schema) complete — canvases table + RLS + TypeScript types all in place. ✓  
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- AlertDialog install via `npx shadcn@latest add alert-dialog` — assumed to work cleanly; shadcn version pinned in project.
- `CanvasSummary` type assumes the Supabase generated types in `src/lib/database.types.ts` are up to date with the current migration state.
- Delete is hard — no undo. Accepted per plan scope.

## Success Criteria (Summary)

- `/dashboard` renders the user's canvas list with names, dates, and working delete
- Empty state appears (and CTA is disabled) when no canvases exist
- Unauthenticated visits still redirect to `/auth/signin` (no middleware regression)
