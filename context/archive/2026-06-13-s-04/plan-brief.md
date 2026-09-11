# Share Canvas — Plan Brief

> Full plan: `context/changes/s-04/plan.md`

## What & Why

S-04 lets a founder share their canvas with an investor or advisor via a read-only link — no account required for the recipient. The link auto-expires after 7 days and can be renewed or revoked by the founder. This closes the "last mile" of the core user journey: fill → critique → share.

## Starting Point

The `share_links` table already exists (from F-01 / canvas-schema) with token, expiry, and pin_hash columns. An anon RLS policy on `share_links` already enforces expiry. The `ShareLink` TypeScript type is exported from `src/types.ts`. No share API routes, no SharePanel component, and no public viewer page exist. The `canvases` table has no anon read policy, which is the key gap this plan fills first.

## Desired End State

The founder clicks "Share" in the canvas editor header, generates a link with a 7-day expiry, copies it, and optionally renews or revokes it. A recipient opens `/share/<token>` in any browser (no login) and sees the full 9-block BMC grid in read-only mode, including any critique that was run. Expired or unknown tokens render a clear error screen.

## Key Decisions Made

| Decision            | Choice                                                      | Why                                                                    | Source |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Expiry model        | Fixed 7 days, renewable                                     | PRD requires expiry; preset avoids datepicker complexity               | Plan   |
| PIN support         | Skipped for MVP                                             | PRD says "expiry OR PIN" — expiry alone satisfies FR-011               | Plan   |
| Renew mechanic      | Update expires_at on same token                             | Same URL stays valid; no need to re-share after renewal                | Plan   |
| Share entry point   | CanvasEditor header (next to Run Critique)                  | Contextual; matches existing button pattern                            | Plan   |
| One link per canvas | Enforced at API layer (POST deletes existing before insert) | Avoids link management complexity; no migration change needed          | Plan   |
| Public URL scheme   | `/share/[token]`                                            | Outside `/canvas` protected route; clearly separate from auth'd routes | Plan   |
| Public view layout  | Same BMC grid, read-only (new CanvasReadOnly component)     | Zero new layout work; consistent visual language                       | Plan   |
| Anon canvas access  | New RLS policy on canvases for anon role                    | `SUPABASE_KEY` is the anon key; no service role client available       | Plan   |

## Scope

**In scope:**

- Migration: anon SELECT policy on `canvases` (prerequisite for public page)
- `POST /PATCH /GET /DELETE /api/canvases/[id]/share` — share link lifecycle API
- `src/components/SharePanel.tsx` — share link UI island
- `src/components/CanvasReadOnly.tsx` — read-only BMC grid component
- `src/pages/share/[token].astro` — public canvas viewer
- Updates to `src/pages/canvas/[id].astro` and `src/components/CanvasEditor.tsx` to wire SharePanel

**Out of scope:**

- PIN support
- Custom expiry dates
- Multiple simultaneous share links per canvas
- Dashboard-level share action
- Unique constraint migration on `share_links.canvas_id`
- Updating `database.types.ts`

## Architecture / Approach

```
Owner flow:
  /canvas/[id].astro (SSR)
    ├─ Supabase: fetch canvas + current share link (server-side)
    └─ CanvasEditor (React island)
         └─ SharePanel (React island, canvasId + initialShareLink props)
              └─ GET/POST/PATCH/DELETE /api/canvases/[id]/share

Recipient flow:
  /share/[token] (Astro SSR, no auth)
    └─ Supabase anon client:
         1. share_links → canvas_id (anon RLS enforces expiry)
         2. canvases → canvas data (new anon RLS policy allows when share link valid)
    └─ CanvasReadOnly (pure SSR, no React island needed)
```

## Phases at a Glance

| Phase                                | What it delivers                                                           | Key risk                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Migration — Anon Read on Canvases | Anon role can SELECT canvases with valid share links                       | Must not touch committed migration files                                     |
| 2. Share Link API                    | GET/POST/PATCH/DELETE for share link lifecycle                             | Owner-join pattern on share_links mutations (no direct owner_id column)      |
| 3. SharePanel Component              | Share button + inline panel with copy/renew/revoke                         | Clipboard API availability in all target browsers                            |
| 4. CanvasEditor Integration          | Share link fetched server-side; SharePanel wired into editor header        | CanvasEditor Props change must not break existing consumers                  |
| 5. Public Share Page                 | `/share/[token]` renders read-only BMC grid for unauthenticated recipients | Anon RLS chain must hold: expired token → no share_link row → no canvas data |

**Prerequisites:** S-02 (ai-canvas-generation) and S-03 (ai-critique) must be done — the share page displays critique if present, and sharing a canvas with no blocks is a degenerate case.
**Estimated effort:** ~2 sessions across 5 phases. Phase 5 (public page + CanvasReadOnly) is the heaviest; Phase 1 (migration) is the shortest.

## Open Risks & Assumptions

- **Anon RLS policy breadth**: Any canvas with at least one non-expired share link is readable by any anon client that knows the canvas UUID. UUIDs are 128-bit random — guessing is impractical, but this is a "security by obscurity" layer. Acceptable for MVP.
- **`database.types.ts` gap**: The `critique` column exists in the DB but not in the generated types. The existing `as unknown as Canvas` cast pattern handles this; the share page must use the same cast.
- **Cloudflare Workers / bcrypt**: bcrypt is explicitly out of scope. If PIN is added later, hashing must use `crypto.subtle` (Web Crypto API), not Node.js `crypto`.

## Success Criteria (Summary)

- Founder can generate, copy, renew, and revoke a share link from the canvas editor without leaving the page.
- Recipient opens the link in an incognito window and sees all 9 blocks (+ critique if run) with no edit controls.
- Expired or revoked links show a clear error screen, not a crash or blank page.
