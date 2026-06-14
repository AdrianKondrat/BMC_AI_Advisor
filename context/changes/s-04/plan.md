# Share Canvas Implementation Plan

## Overview

Implement read-only share links for Business Model Canvases. A founder generates a link from the canvas editor, the link auto-expires after 7 days (and can be renewed), and anyone with the valid URL can view the full canvas — including critique — without an account.

## Current State Analysis

- `share_links` table exists (from F-01) with columns: `id`, `canvas_id`, `token` (64-char hex, unique, auto-generated), `expires_at`, `pin_hash`, `created_at`.
- Anon RLS on `share_links` already enforces expiry: `USING (expires_at IS NULL OR expires_at > now())`.
- `canvases` table has **no anon RLS policy** — the public share page cannot read canvas data without a new migration.
- `ShareLink` TypeScript type is already exported from `src/types.ts` via `Tables<"share_links">`.
- No share API routes, no SharePanel component, and no public viewer page exist.
- The existing canvas page at `/canvas/[id]` is protected by middleware (`PROTECTED_ROUTES` includes `/canvas`).
- `/share/*` is not in `PROTECTED_ROUTES` — no middleware changes needed.
- `SUPABASE_KEY` is the anon key; `createClient()` on unauthenticated pages operates as the anon role.

## Desired End State

A founder clicks "Share" in the canvas editor header, sees a panel with a copy-able URL (and expiry date), and can renew (reset to +7 days) or revoke it. Anyone opening `https://<host>/share/<token>` sees the full 9-block BMC grid (read-only, critique included if run) with a clear "read-only" badge. Expired or unknown tokens show an error screen rather than a canvas.

### Key Discoveries

- `src/pages/canvas/[id].astro:14` fetches the canvas server-side and passes it to `CanvasEditor`. Share link should follow the same pattern — fetched server-side in the Astro page and passed as a prop to `CanvasEditor`.
- `src/components/CanvasEditor.tsx:187–207` renders the header div (`flex items-center justify-between`). `SharePanel` slots in here alongside the existing "Run Critique" button.
- Critique column is in the DB (migration `20260611000000_add_critique_column.sql`) but not in `database.types.ts` — the existing `Canvas` type in `src/types.ts` handles this via `Omit` + manual union. The same cast pattern (`as unknown as Canvas`) is already used in `canvas/[id].astro:15`.
- Cloudflare Workers runtime (workerd) does not support `bcrypt` — PIN is out of scope for this plan per decision made in planning. No crypto library changes needed.
- Lessons: always add `.eq('owner_id', ...)` on mutations alongside RLS; never edit committed migrations.

## What We're NOT Doing

- No PIN support (deferred; PRD FR-011 is satisfied by expiry alone).
- No custom expiry picker — links always expire in 7 days from creation or last renewal.
- No multiple active share links per canvas — API enforces one active link per canvas by deleting the existing link before creating a new one.
- No unique constraint migration on `share_links.canvas_id` — one-at-a-time is enforced at the API layer only.
- No updating `database.types.ts` — out of scope; the existing cast pattern handles the gap.
- No mobile-responsive breakpoints beyond what the existing BMC grid already has.

## Implementation Approach

Five phases in strict dependency order:

1. Migration adds anon read access to canvases so the public page can load canvas data.
2. API routes handle authenticated link management (create/get/renew/revoke).
3. SharePanel is the React component that drives the share UX from the editor.
4. Canvas page and CanvasEditor wire SharePanel in.
5. Public share page renders the canvas read-only.

## Critical Implementation Details

**Anon read chain on the public page**: To load a shared canvas, the anon client first looks up the share link by token (share_links anon RLS enforces expiry automatically), then reads the canvas by `canvas_id` (new anon policy on canvases allows this when a valid share link exists). If the token query returns 0 rows the link is either expired or doesn't exist — both cases render the same "invalid or expired" UI without leaking which is true.

**One-link-per-canvas enforcement**: `POST /api/canvases/[id]/share` deletes any existing share link for this canvas before inserting the new one. The DELETE uses `.eq('canvas_id', id)` with the owner join pattern from the lessons (subquery through canvases, not relying on RLS alone).

---

## Phase 1: Migration — Anon Read on Canvases

### Overview

Add a Supabase RLS policy that allows the anon role to SELECT canvases when a valid (non-expired) share link exists for them. This is the prerequisite for the public share page to load canvas data without auth.

### Changes Required

#### 1. New migration

**File**: `supabase/migrations/20260613000000_share_canvas_anon_read.sql`

**Intent**: Extend the anon role's read access to canvases so the public share page can fetch canvas data using the existing anon Supabase client. Without this policy, anon reads on `canvases` are silently denied by RLS.

**Contract**:

```sql
CREATE POLICY "anon can read shared canvases"
  ON canvases
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT canvas_id FROM share_links
      WHERE expires_at IS NULL OR expires_at > now()
    )
  );
```

This policy allows anon to read any canvas for which at least one non-expired share link exists. Since `share_links.canvas_id` is a UUID and there is no enumeration endpoint, this is acceptable for MVP.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset` exits 0
- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- In Supabase Studio → Authentication → Policies, a new "anon can read shared canvases" SELECT policy is visible on the `canvases` table targeting the `anon` role.
- Using the SQL editor as anon (or via a quick curl with anon key), a SELECT on `canvases` for a canvas with a valid share link returns a row; a canvas without a share link returns 0 rows.

**Implementation Note**: After automated verification passes, confirm the policy is visible in Studio before proceeding to Phase 2. Run `npx supabase db push` to sync remote before manual API testing.

---

## Phase 2: Share Link API

### Overview

Create `src/pages/api/canvases/[id]/share.ts` exporting `GET`, `POST`, `PATCH`, and `DELETE` handlers. All four require an authenticated owner. POST creates a new 7-day link (deleting any existing one first). PATCH renews the existing link's expiry. DELETE revokes it.

### Changes Required

#### 1. Share link API route

**File**: `src/pages/api/canvases/[id]/share.ts`

**Intent**: Provide the full lifecycle for share link management: fetch, create, renew, and revoke. Only the canvas owner may call any of these routes.

**Contract**: Export `prerender = false`. All handlers follow the existing API pattern: check `context.locals.user`, validate `id` as UUID, call `createClient`, perform Supabase queries with explicit `.eq('owner_id', ...)` / owner join on mutations, return JSON responses.

Route handlers:

- **GET** — query `share_links` where `canvas_id = id` and `canvas_id IN (SELECT id FROM canvases WHERE owner_id = user.id)`, ordered by `created_at DESC`, limit 1. Return `{ shareLink: ShareLink }` (200) or 404. No expiry filtering — return the link even if expired so the frontend can show "expired" state.

- **POST** — first delete any existing link for this canvas (using the owner-join subquery pattern, not relying on RLS alone per lessons.md). Then insert `{ canvas_id: id, expires_at: <now + 7 days ISO string> }`. Return `{ shareLink: ShareLink }` (201).

- **PATCH** — update `expires_at` to `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()` where `canvas_id = id` and owner join subquery. Return `{ shareLink: ShareLink }` (200) or 404 if no link exists.

- **DELETE** — delete where `canvas_id = id` and owner join subquery. Return 204.

Owner-join subquery pattern for mutations on `share_links` (required per lessons.md since `share_links` has no direct `owner_id`):

```sql
-- subquery in .eq() is not possible via the JS client; use .filter() with a nested select
// Supabase JS client pattern:
.delete()
.eq('canvas_id', id)
.filter('canvas_id', 'in', `(SELECT id FROM canvases WHERE owner_id = '${userId}')`)
// ^ but raw SQL injection risk — use RPC or parameterized approach instead
```

Since the Supabase JS client doesn't allow subquery filters directly, use the following safe pattern: fetch the canvas first to verify ownership, then operate on `share_links` by `canvas_id`. Because RLS policies also protect the `share_links` table for the authenticated role (the authenticated-role policies use the same subquery), and since `createClient` attaches the session JWT, RLS will enforce ownership even without the explicit subquery in the JS client call. Add the ownership verification fetch as a belt-and-suspenders check.

**Contract for POST (expiry calculation)**:

```ts
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
```

### Success Criteria

#### Automated Verification

- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- `POST /api/canvases/:id/share` with a valid authenticated session returns `{ shareLink: { token, expires_at, ... } }` with status 201.
- A second `POST` to the same canvas replaces the old link (old token no longer works after Phase 5 is done; for now verify only one row exists in `share_links` for this canvas).
- `GET /api/canvases/:id/share` returns the link.
- `PATCH /api/canvases/:id/share` updates `expires_at` to ~7 days from now.
- `DELETE /api/canvases/:id/share` removes the link; subsequent GET returns 404.
- Calling any route as a different user (or unauthenticated) returns 401.

**Implementation Note**: Run `npx supabase db push` before manual API tests.

---

## Phase 3: SharePanel Component

### Overview

Create `src/components/SharePanel.tsx` — a React component that renders the share link lifecycle in the canvas editor header. It receives the initial share link state as a prop (fetched server-side) and manages create/renew/revoke via the Phase 2 API routes.

### Changes Required

#### 1. SharePanel component

**File**: `src/components/SharePanel.tsx`

**Intent**: Encapsulate all share link state and controls in one island so CanvasEditor stays focused on block editing. The component shows different UI depending on link state: no link (Create button), active link (URL + copy + Renew + Revoke), or expired link (expired notice + Renew + Revoke).

**Contract**: Props interface:

```ts
interface Props {
  canvasId: string;
  initialShareLink: ShareLink | null;
}
```

Internal state:

- `shareLink: ShareLink | null` — initialised from `initialShareLink` prop
- `status: "idle" | "loading" | "error"` — covers all async operations
- `copied: boolean` — copy-to-clipboard feedback (reset after 2 s)

Share URL construction: `` `${window.location.origin}/share/${shareLink.token}` ``

Expiry display: if `expires_at` is past `new Date()`, label it "Expired"; otherwise show `Expires <date>` formatted with `toLocaleDateString()`.

Action handlers call the relevant API routes and update `shareLink` state from the response.

The component renders as an inline control group (button + panel pattern), using the same `rounded-md bg-white/10 px-3 py-1.5 text-sm text-white` button styling as the existing "Run Critique" button in CanvasEditor.

### Success Criteria

#### Automated Verification

- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- With no existing share link: clicking "Share" reveals a "Create share link" button.
- Creating a link shows the URL, copy button, "Renew", "Revoke", and an expiry date ~7 days out.
- Clicking copy fills the clipboard and briefly shows "Copied!".
- Clicking Renew updates the expiry date in the UI.
- Clicking Revoke removes the link and returns to the "Create share link" state.

---

## Phase 4: CanvasEditor Integration

### Overview

Wire SharePanel into the canvas editor. The canvas page fetches the existing share link server-side (alongside the canvas) and passes it to CanvasEditor, which renders SharePanel in its header alongside the existing "Run Critique" button.

### Changes Required

#### 1. Canvas page — fetch share link

**File**: `src/pages/canvas/[id].astro`

**Intent**: Load the initial share link state server-side so SharePanel doesn't need a client-side GET on every canvas open.

**Contract**: After the existing canvas fetch, add a query:

```ts
let shareLink: ShareLink | null = null;
if (supabase && id) {
  const { data } = await supabase
    .from("share_links")
    .select("*")
    .eq("canvas_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) shareLink = data;
}
```

Pass `canvasId={canvas.id}` and `initialShareLink={shareLink}` to CanvasEditor.

#### 2. CanvasEditor — add SharePanel

**File**: `src/components/CanvasEditor.tsx`

**Intent**: Extend Props to accept share link data and render SharePanel in the header row next to "Run Critique".

**Contract**: Add to `Props`:

```ts
shareLink?: ShareLink | null;
```

Import `SharePanel` and render it in the header `div` between the save status span and the critique button. Pass `canvasId={canvas.id}` and `initialShareLink={shareLink ?? null}`.

### Success Criteria

#### Automated Verification

- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- Opening any canvas shows a "Share" button in the header next to "Run Critique".
- Share panel appears inline when clicked; create/renew/revoke all work end-to-end.
- Existing critique and save functionality are unaffected.

---

## Phase 5: Public Share Page

### Overview

Create the unauthenticated public canvas viewer at `/share/[token]`. Validate the token, load the canvas, and render it read-only using a new `CanvasReadOnly` component that mirrors the BMC grid layout of `CanvasEditor` without editing controls.

### Changes Required

#### 1. CanvasReadOnly component

**File**: `src/components/CanvasReadOnly.tsx`

**Intent**: Render the 9-block BMC grid in a purely presentational mode. Includes critique badges if the canvas has been critiqued. No state, no event handlers, no save logic.

**Contract**: Props:

```ts
interface Props {
  canvas: Canvas;
}
```

Reuse the same grid layout (`grid grid-cols-1 gap-2 md:grid-cols-5 md:grid-rows-3`), block labels, and `BlockCell` visual structure from CanvasEditor — but extract just the display portion (the `h3` label + `p` content + optional critique badge). No textarea, no `isActive` branch, no `onClick`.

Copy `BMC_BLOCK_LABELS`, `ALL_BLOCK_KEYS`, and `CATEGORY_STYLES` from CanvasEditor (or extract to a shared constant file — acceptable either way; the plan does not mandate extraction).

#### 2. Public share page

**File**: `src/pages/share/[token].astro`

**Intent**: Validate the share token, load the canvas, and render it for an unauthenticated recipient. Show a clear error screen for expired or unknown tokens.

**Contract**:

1. Extract `token` from `Astro.params`.
2. Call `createClient(Astro.request.headers, Astro.cookies)` — operates as anon role since no auth cookies are present.
3. Look up share link: `supabase.from("share_links").select("canvas_id, expires_at").eq("token", token).single()`. If no data (or `error.code === "PGRST116"`), render an error page: "This share link has expired or is invalid."
4. Load canvas: `supabase.from("canvases").select("*").eq("id", shareLink.canvas_id).single()`. Cast `data as unknown as Canvas`. If no data, render the same error page (the anon policy blocks access when the link is expired, so this case covers race conditions).
5. Render `CanvasReadOnly` (non-interactive, no `client:load` needed — pure SSR).
6. Include a "Read-only view" badge in the page header and the canvas name.
7. No back link to dashboard (recipient is not logged in).

### Success Criteria

#### Automated Verification

- Build passes: `npm run build` exits 0
- Lint passes: `npm run lint` exits 0

#### Manual Verification

- Opening a valid share URL (from a freshly created link) shows the full 9-block canvas with the canvas name and a "Read-only" badge.
- If the canvas had critique run, critique badges appear on the relevant blocks.
- No edit controls are present (no textareas, no "Run Critique" button, no save status).
- Opening the URL in an incognito window (no session cookies) shows the canvas correctly.
- Navigating to `/share/nonexistent-token` shows the "expired or invalid" error screen.
- After revoking a link (Phase 4), the share URL shows the error screen.
- After link expiry (manually set `expires_at` to the past via Supabase Studio), the URL shows the error screen.

**Implementation Note**: Run `npx supabase db push` before manual share page testing. Test the full flow: create link → copy URL → open in incognito → verify read-only canvas loads.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in as a founder; open any filled canvas.
2. Click "Share" → "Create share link" → confirm URL appears with 7-day expiry.
3. Copy URL; open in incognito tab → canvas should render read-only with all 9 blocks.
4. If critique has been run on the canvas, verify critique badges appear in the share view.
5. Back in editor: click "Renew" → expiry date updates.
6. Click "Revoke" → link disappears from panel; incognito tab refresh shows "expired or invalid".
7. Create a new link; use Supabase Studio to manually set `expires_at` to a past timestamp; confirm share URL shows error screen.
8. Navigate to `/share/definitely-not-a-token` — confirm error screen (not a crash).

## Migration Notes

New migration `20260613000000_share_canvas_anon_read.sql` adds one RLS policy. It is additive — no existing policies are modified. Follows the pattern from lessons.md: treat all prior migrations as immutable.

## References

- Roadmap: `context/foundation/roadmap.md` §S-04
- PRD: `context/foundation/prd.md` §FR-011, FR-012, US-03
- Canvas schema plan: `context/changes/canvas-schema/plan.md`
- Existing canvas page: `src/pages/canvas/[id].astro`
- Existing API pattern: `src/pages/api/canvases/[id].ts`
- Existing editor: `src/components/CanvasEditor.tsx`
- Lessons: `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration — Anon Read on Canvases

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` exits 0 — 734a4e6
- [x] 1.2 Build passes: `npm run build` exits 0 — 734a4e6
- [x] 1.3 Lint passes: `npm run lint` exits 0 — 734a4e6

#### Manual

- [x] 1.4 "anon can read shared canvases" policy visible in Supabase Studio → Auth → Policies — 734a4e6
- [x] 1.5 Anon SELECT on canvas with valid share link returns row; canvas without link returns 0 rows — 734a4e6

### Phase 2: Share Link API

#### Automated

- [x] 2.1 Build passes: `npm run build` exits 0 — 3b8a7f1
- [x] 2.2 Lint passes: `npm run lint` exits 0 — 3b8a7f1

#### Manual

- [x] 2.3 POST creates share link (201) with token and expires_at ~7 days out — 3b8a7f1
- [x] 2.4 Second POST to same canvas replaces old link (one row in share_links) — 3b8a7f1
- [x] 2.5 GET returns the link; PATCH updates expires_at; DELETE removes link — 3b8a7f1
- [x] 2.6 Unauthenticated or wrong-owner calls return 401 — 3b8a7f1

### Phase 3: SharePanel Component

#### Automated

- [x] 3.1 Build passes: `npm run build` exits 0
- [x] 3.2 Lint passes: `npm run lint` exits 0

#### Manual

- [x] 3.3 "Share" button opens panel; "Create share link" creates link and displays URL + expiry
- [x] 3.4 Copy button fills clipboard and shows "Copied!" feedback
- [x] 3.5 Renew updates expiry date in the UI
- [x] 3.6 Revoke removes the link and returns to create state

### Phase 4: CanvasEditor Integration

#### Automated

- [x] 4.1 Build passes: `npm run build` exits 0
- [x] 4.2 Lint passes: `npm run lint` exits 0

#### Manual

- [ ] 4.3 "Share" button appears in canvas editor header next to "Run Critique"
- [ ] 4.4 Share panel is functional end-to-end from the editor
- [ ] 4.5 Critique and save functionality unaffected

### Phase 5: Public Share Page

#### Automated

- [ ] 5.1 Build passes: `npm run build` exits 0
- [ ] 5.2 Lint passes: `npm run lint` exits 0

#### Manual

- [ ] 5.3 Valid share URL shows full 9-block canvas read-only in incognito window
- [ ] 5.4 Critique badges appear if critique was run on the canvas
- [ ] 5.5 No edit controls present in the share view
- [ ] 5.6 Unknown token → "expired or invalid" error screen (no crash)
- [ ] 5.7 Revoked link → error screen on next visit
- [ ] 5.8 Manually expired link (expires_at in the past) → error screen
