# Account Deletion Implementation Plan

## Overview

Build a complete account deletion flow allowing users to permanently delete their account and all associated data (canvases, blocks, share links) with explicit two-step confirmation. The backend deletion endpoint exists; this plan implements the UI, middleware protection, deletion notice, and final verification.

## Current State Analysis

The `/api/auth/delete-account` endpoint exists and uses Supabase's admin client (`auth.admin.deleteUser()`) to delete the user, triggering cascading deletes on canvases and share_links via foreign key constraints. The endpoint signs out the user after deletion succeeds.

The dashboard exists with a sign-out button; the auth middleware already protects `/dashboard` and `/canvas` but not `/settings`. The sign-in page handles error params and can be extended to show the `?deleted=true` deletion-success notice.

The codebase uses:

- Astro SSR with React islands
- shadcn/ui AlertDialog component for confirmations
- Error handling patterns via query params (e.g., `?error=...`)
- RLS for data isolation; cascade deletes rely on Supabase FK constraints

**Key Discoveries:**

- Admin client requires `SUPABASE_SERVICE_ROLE_KEY` secret in Cloudflare Worker (not yet provisioned)
- AlertDialog is available and used elsewhere; follows Radix UI patterns
- Sign-in form already handles error params; can reuse this pattern for deleted notice
- Dashboard header has sign-out button; settings link can go in the same header area

## Desired End State

When this plan is complete:

1. Users can navigate to `/settings` from the dashboard header, see a dedicated settings page with a "Delete Account" section.
2. Clicking "Delete" opens an AlertDialog requiring the user to check "I understand this is permanent" and confirm the deletion.
3. On successful deletion, the user is signed out and redirected to `/auth/signin?deleted=true`, where a prominent alert confirms "Your account has been permanently deleted."
4. If deletion fails, an error alert appears on `/settings` and the user remains on the page to retry.
5. The deletion cascade (user → canvases → share_links) is verified by an integration test.
6. Local testing uses `.dev.vars` with the service role key; production uses the Cloudflare secret.

### Acceptance Criteria

- ✓ `/settings` route is protected (unauthenticated users redirect to sign-in)
- ✓ DeleteAccountButton shows checkbox confirmation dialog before deletion
- ✓ On success: user is signed out and sees deletion notice on sign-in page
- ✓ On error: alert appears on `/settings`, user can retry
- ✓ Integration test verifies cascade delete (user data cleared from all tables)
- ✓ Feature works locally with `.dev.vars` and in production with Cloudflare secret
- ✓ No data is left behind; RLS isolation is maintained throughout

## What We're NOT Doing

- Account suspension or soft-delete; this is permanent deletion of auth.users record
- Data export before deletion; roadmap does not require an export flow
- Scheduling deletions (e.g., "delete in 30 days"); deletion is immediate
- Audit trail or admin recovery; once deleted, data is gone
- Re-authentication step (e.g., "enter your password to confirm"); checkbox + dialog is sufficient per roadmap

## Implementation Approach

**Route & middleware protection**: Add `/settings` route as an Astro page with server-side rendering, add it to PROTECTED_ROUTES in middleware so unauthenticated users are redirected to sign-in.

**Confirmation UX**: Build a DeleteAccountButton React component using shadcn/ui's AlertDialog. The button starts disabled; when user checks the "I understand" checkbox, button enables. Clicking opens a confirmation dialog with Cancel and Delete actions.

**Deletion flow**: On confirm, POST to `/api/auth/delete-account`, which uses the admin client to delete the user (cascading to canvases and share_links), then signs out the session. The endpoint returns a 200 with `{ success: true }` on success or a 5xx error on failure. On success, the client redirects to `/auth/signin?deleted=true`. On error, an alert is shown and the user stays on `/settings`.

**Sign-in notice**: Extend the sign-in page to check for the `?deleted=true` param and render a prominent dismissible alert box (using Astro's `Astro.url.searchParams.get()`) before the form.

**Testing**: Write an integration test using the existing Vitest + Supabase test setup. Create a test user, create canvases and share links for that user, call the delete endpoint, and verify all data is gone.

## Critical Implementation Details

**Session termination after deletion**: The `/api/auth/delete-account` endpoint deletes the user from auth.users, which terminates their session. After the POST succeeds, the client-side code must redirect (the session is already invalid). The redirect happens before the user can see any stale session state.

**Admin client configuration**: The `createAdminClient()` function in `src/lib/supabase.ts` must have access to `SUPABASE_SERVICE_ROLE_KEY`. Locally, this is set via `.dev.vars`. In production, it's a Cloudflare secret set via `wrangler secret put`. If the secret is missing, the endpoint returns a 500 "Server configuration error".

**Checkbox state management**: The DeleteAccountButton must manage local React state for the checkbox (boolean). The delete button is disabled until the checkbox is true. This prevents accidental deletions if the user clicks the button without reading the confirmation.

---

## Phase 1: Protected Settings Route

### Overview

Create the `/settings` page as a protected Astro route and add middleware protection. Wire a navigation link from the dashboard header to `/settings`.

### Changes Required:

#### 1. Middleware protection

**File**: `src/middleware.ts`

**Intent**: Add `/settings` to the PROTECTED_ROUTES array so unauthenticated users are redirected to sign-in when accessing the page.

**Contract**: Update `const PROTECTED_ROUTES` to include `"/settings"`. If the route is not in the list, the middleware will call `next()` and allow access. Once added, any request to `/settings` without an authenticated session will redirect to `/auth/signin`.

```typescript
const PROTECTED_ROUTES = ["/dashboard", "/canvas", "/settings"];
```

#### 2. Settings page

**File**: `src/pages/settings.astro`

**Intent**: Create a new page that renders a settings layout with the user's email and a "Delete Account" section (which will contain the DeleteAccountButton component in Phase 2).

**Contract**: Astro page that reads `context.locals.user` from the middleware, displays the user's email, and includes a section for account deletion. Structure mirrors the dashboard: cosmic background, centered card layout, user email in header. Will import `DeleteAccountButton` from `@/components/account/` in Phase 2.

```astro
---
import Layout from "@/layouts/Layout.astro";

const { user } = Astro.locals;
---

<Layout title="Settings">
  <div class="bg-cosmic min-h-screen p-6">
    <div class="mx-auto max-w-2xl">
      <header class="mb-8 flex items-center justify-between">
        <p class="text-sm text-white/70">{user?.email}</p>
        <form method="POST" action="/api/auth/signout">
          <button
            type="submit"
            class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Sign out
          </button>
        </form>
      </header>
      <h1 class="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
        Account
      </h1>
      <div class="rounded-lg border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
        <h2 class="mb-4 text-lg font-semibold text-white">Danger Zone</h2>
        <p class="mb-6 text-sm text-white/70">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        {/* DeleteAccountButton will be rendered here in Phase 2 */}
      </div>
    </div>
  </div>
</Layout>
```

#### 3. Dashboard link

**File**: `src/pages/dashboard.astro`

**Intent**: Add a link in the dashboard header that navigates to `/settings`.

**Contract**: In the dashboard header (the `<header>` element), add a link to `/settings`. Can be a button next to the Sign out button or a simple text link. Text should be "Settings" or "Account settings".

Modify the header to:

```astro
<header class="mb-8 flex items-center justify-between">
  <p class="text-sm text-white/70">{user?.email}</p>
  <div class="flex gap-2">
    <a
      href="/settings"
      class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
    >
      Settings
    </a>
    <form method="POST" action="/api/auth/signout">
      <button
        type="submit"
        class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
      >
        Sign out
      </button>
    </form>
  </div>
</header>
```

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- Type checking passes: `npm run typecheck`
- Middleware test passes (if exists): `npm test` for middleware tests

#### Manual Verification:

- Navigate to `/settings` while authenticated → page loads with user email and "Account" heading
- Navigate to `/settings` while unauthenticated → redirected to `/auth/signin`
- Click "Settings" link on dashboard → navigates to `/settings`

---

## Phase 2: DeleteAccountButton Component

### Overview

Build a React component that renders a button with checkbox confirmation and an AlertDialog modal. On confirmation, POST to `/api/auth/delete-account`. On success, redirect to sign-in with deletion notice. On error, show an alert on the settings page.

### Changes Required:

#### 1. DeleteAccountButton component

**File**: `src/components/account/DeleteAccountButton.tsx`

**Intent**: Create a React component that manages deletion state, handles the checkbox, renders the confirmation dialog, and makes the API call.

**Contract**: Export a default function `DeleteAccountButton({ onError?: (message: string) => void })`. The component:

- Manages state: `checkboxChecked` (boolean), `isDeleting` (boolean, shows spinner during request)
- Renders: a checkbox input ("I understand this is permanent"), a delete button (disabled until checkbox is true), and an AlertDialog with Cancel and Delete actions
- On delete click: POST to `/api/auth/delete-account`, on 200 response redirect to `/auth/signin?deleted=true`, on error call the `onError` callback (or set local error state)
- Uses shadcn/ui Button, AlertDialog, and Checkbox components

```tsx
"use client"; // Not used in this codebase (Astro, not Next.js), but standard React pattern

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function DeleteAccountButton() {
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      // Redirect to sign-in with deleted notice
      window.location.href = "/auth/signin?deleted=true";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
      <div className="mb-4 flex items-center gap-2">
        <Checkbox
          id="delete-confirm"
          checked={checkboxChecked}
          onCheckedChange={(checked) => setCheckboxChecked(checked === true)}
        />
        <label htmlFor="delete-confirm" className="cursor-pointer text-sm text-white/70">
          I understand this is permanent
        </label>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={!checkboxChecked || isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated canvases, blocks, and share links. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

#### 2. Wire DeleteAccountButton into settings page

**File**: `src/pages/settings.astro`

**Intent**: Import and render the DeleteAccountButton component in the "Danger Zone" section.

**Contract**: Add `import DeleteAccountButton from "@/components/account/DeleteAccountButton";` at the top, and replace the comment `{/* DeleteAccountButton will be rendered here in Phase 2 */}` with `<DeleteAccountButton client:load />` (client:load directive because it's interactive).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- Type checking passes: `npm run typecheck`
- Component renders without errors: `npm test` (if component tests exist)

#### Manual Verification:

- Navigate to `/settings` and see the "Danger Zone" section with checkbox and delete button
- Delete button is disabled when checkbox is unchecked
- Delete button is enabled when checkbox is checked
- Clicking delete button opens AlertDialog with Cancel and Delete options
- Clicking Cancel closes the dialog and returns to settings page
- Clicking Delete (with `SUPABASE_SERVICE_ROLE_KEY` provisioned in `.dev.vars`): account is deleted, user is redirected to `/auth/signin?deleted=true`
- If the endpoint returns an error (simulated by removing the secret), an alert appears on settings page

---

## Phase 3: Sign-In Deletion Notice

### Overview

Extend the sign-in page to detect the `?deleted=true` query param and render a prominent success alert. Handle error params from the delete endpoint if deletion fails and the user is redirected back.

### Changes Required:

#### 1. Update sign-in page

**File**: `src/pages/auth/signin.astro`

**Intent**: Read the `deleted` query param and render a dismissible alert if it's present.

**Contract**: Use `Astro.url.searchParams.get("deleted")` to check for the param. If it exists and equals "true", render a prominent alert box (similar to the error alert) with text "Your account has been permanently deleted." The alert should be dismissible (clicking X closes it).

```astro
---
import Layout from "@/layouts/Layout.astro";
import SignInForm from "@/components/auth/SignInForm";

const error = Astro.url.searchParams.get("error");
const deleted = Astro.url.searchParams.get("deleted");
---

<Layout title="Sign in">
  <div class="bg-cosmic flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl">
      <h1
        class="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-2xl font-bold text-transparent"
      >
        Sign in
      </h1>
      {
        deleted === "true" && (
          <div class="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
            Your account has been permanently deleted.
          </div>
        )
      }
      <SignInForm serverError={error} client:load />
      <p class="mt-4 text-center text-sm text-blue-100/60">
        Don't have an account? <a href="/auth/signup" class="text-purple-300 hover:underline">Sign up</a>
      </p>
    </div>
  </div>
</Layout>
```

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- Navigate to `/auth/signin?deleted=true` → green alert box appears above the form
- Alert text clearly states account was deleted
- Clicking elsewhere on the page or reloading doesn't trigger the alert if the param is missing
- Error handling: if DeleteAccountButton encounters an error and redirects back to `/auth/signin`, the param is not set and no alert appears (user sees the error on `/settings` instead)

---

## Phase 4: Testing & Final Integration

### Overview

Write an integration test for the cascade delete, verify the flow locally using `.dev.vars`, and document the Cloudflare secret setup for production.

### Changes Required:

#### 1. Integration test for cascade delete

**File**: `src/__tests__/account-deletion.integration.test.ts` (or similar path following existing test structure)

**Intent**: Test that when a user is deleted via the admin client, all their canvases and share links are also deleted (cascade constraint).

**Contract**: Test function that:

1. Creates a test user (via `createClient` with Supabase auth)
2. Creates a canvas and a share link for that user
3. Calls the admin client's `deleteUser()` on that user
4. Verifies the user, canvas, and share_link are all gone from their respective tables
5. Assertions check row counts or specific queries return empty results

```typescript
// Pseudo-code structure
describe("Account deletion", () => {
  it("cascades delete to canvases and share_links", async () => {
    // Create test user
    const { data, error } = await supabase.auth.signUp({ email, password });
    const userId = data.user?.id;

    // Create canvas for user
    await supabase.from("canvases").insert({ owner_id: userId, name: "Test", idea: "..." });

    // Create share link for canvas
    const { data: canvas } = await supabase.from("canvases").select("id").eq("owner_id", userId).single();
    await supabase.from("share_links").insert({ canvas_id: canvas.id, token: "..." });

    // Delete user via admin client
    const adminClient = createAdminClient();
    await adminClient.auth.admin.deleteUser(userId);

    // Verify cascade
    const { data: canvases } = await supabase.from("canvases").select().eq("owner_id", userId);
    const { data: shareLinks } = await supabase.from("share_links").select().eq("canvas_id", canvas.id);
    expect(canvases).toHaveLength(0);
    expect(shareLinks).toHaveLength(0);
  });
});
```

#### 2. Local test setup

**File**: `.dev.vars` (gitignored; local only)

**Intent**: Set `SUPABASE_SERVICE_ROLE_KEY` locally so the admin client works during development and testing.

**Contract**: Add or uncomment the line:

```
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

Retrieve the key from your Supabase project settings (Service Role key, not the public anon key). This allows `createAdminClient()` to authenticate as a service role and call `auth.admin.deleteUser()`.

#### 3. Production secret documentation

**File**: `context/changes/account-deletion/plan.md` (this document)

**Intent**: Document the Cloudflare secret setup so the person deploying knows what to do.

**Contract**: After this plan is approved, run:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Paste the key from Supabase. The secret is then available to the Worker at runtime via `Env` (already handled by `createAdminClient()` in the codebase). Verify by deploying and testing the deletion flow on the live app.

### Success Criteria:

#### Automated Verification:

- Integration test passes: `npm test` (test-plan Phase 2 for API and data layer)
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- Local testing: set `.dev.vars` with service role key, navigate to `/settings`, create a test account, run the deletion flow, verify account is gone from dashboard
- Verify cascade: check that canvases and share_links for the deleted user are also gone
- Production readiness: after merging, follow the secret setup documentation to run `wrangler secret put` and test the flow on the live app

---

## Testing Strategy

### Unit Tests

- DeleteAccountButton component: checkbox toggle, button enabled/disabled state, error handling, loading state during request

### Integration Tests

- Cascade delete: user deletion triggers deletion of canvases and share_links (Phase 4)
- API endpoint: POST to `/api/auth/delete-account` with auth headers, verify 200 response and session termination

### Manual Testing Steps

1. Authenticate and navigate to dashboard
2. Click "Settings" link in header
3. Verify `/settings` page loads, user email is shown
4. Verify delete button is disabled
5. Check "I understand" checkbox
6. Verify delete button is enabled
7. Click "Delete Account"
8. Verify AlertDialog appears with warning text
9. Click "Delete" to confirm
10. Verify user is redirected to `/auth/signin?deleted=true`
11. Verify green alert appears: "Your account has been permanently deleted"
12. Check Supabase console: verify user, canvases, and share_links are gone
13. Try to log back in with the deleted email → should fail with "Invalid login credentials"

## Performance Considerations

The admin client deletion is a synchronous operation in Supabase; cascade deletes on FKs are atomic. The endpoint should complete in < 2 seconds for typical user data volumes. No caching or optimization needed at this stage.

## Migration Notes

No data migration required. The endpoint works on existing users. The `/settings` page is new; no existing routing conflicts.

## References

- Backend `/api/auth/delete-account`: `src/pages/api/auth/delete-account.ts`
- Middleware: `src/middleware.ts`
- AlertDialog component: `src/components/ui/alert-dialog.tsx`
- Dashboard layout pattern: `src/pages/dashboard.astro`
- Sign-in param handling: `src/pages/auth/signin.astro`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Protected Settings Route

#### Automated

- [x] 1.1 Middleware protection (add `/settings` to PROTECTED_ROUTES) — 3ddfaad
- [x] 1.2 Settings page created (`src/pages/settings.astro`) — 3ddfaad
- [x] 1.3 Dashboard settings link added — 3ddfaad
- [x] 1.4 Lint passes: `npm run lint` — 3ddfaad
- [x] 1.5 Build succeeds: `npm run build` — 3ddfaad
- [x] 1.6 Type checking passes: `npm run typecheck` — 3ddfaad

#### Manual

- [x] 1.7 Authenticate and navigate to `/settings` → page loads with user email and "Account" heading — 3ddfaad
- [x] 1.8 Navigate to `/settings` unauthenticated → redirect to sign-in — 3ddfaad
- [x] 1.9 Click "Settings" on dashboard → navigate to `/settings` — 3ddfaad

### Phase 2: DeleteAccountButton Component

#### Automated

- [x] 2.1 DeleteAccountButton component created
- [x] 2.2 Component imports and renders in settings page
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 Build succeeds: `npm run build`
- [x] 2.5 Type checking passes: `npm run typecheck`

#### Manual

- [ ] 2.6 Settings page displays delete button (initially disabled)
- [ ] 2.7 Checkbox toggle enables/disables delete button
- [ ] 2.8 Click delete → AlertDialog appears with warning
- [ ] 2.9 Click Cancel → dialog closes, stay on settings
- [ ] 2.10 Click Delete → POST to endpoint (with `.dev.vars` secret, should redirect to sign-in)

### Phase 3: Sign-In Deletion Notice

#### Automated

- [ ] 3.1 Sign-in page updated to read `deleted` param
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 Type checking passes: `npm run typecheck`

#### Manual

- [ ] 3.5 Navigate to `/auth/signin?deleted=true` → green alert appears
- [ ] 3.6 Alert text clearly states account was deleted
- [ ] 3.7 Sign-in without param → no alert shown

### Phase 4: Testing & Final Integration

#### Automated

- [ ] 4.1 Integration test written for cascade delete
- [ ] 4.2 Integration test passes: `npm test`
- [ ] 4.3 Lint passes: `npm run lint`
- [ ] 4.4 Build succeeds: `npm run build`
- [ ] 4.5 Type checking passes: `npm run typecheck`

#### Manual

- [ ] 4.6 Local testing with `.dev.vars` secret: create account, navigate to settings, delete account
- [ ] 4.7 Verify user, canvases, and share_links are all deleted from Supabase
- [ ] 4.8 Verify redirect and sign-in deletion notice appear
- [ ] 4.9 After merge: run `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` in production
- [ ] 4.10 Production verification: test deletion flow on live app
