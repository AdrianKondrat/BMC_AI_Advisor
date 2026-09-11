# Account Deletion — Plan Brief

> Full plan: `context/changes/account-deletion/plan.md`
> Research: Roadmap S-05 (line 157–170)

## What & Why

Users need a way to permanently delete their account and all associated data (canvases, blocks, share links) with explicit confirmation to prevent accidental deletion. The backend endpoint exists; this plan implements the UI, middleware protection, and deletion-success notice.

## Starting Point

- `/api/auth/delete-account` endpoint drafted (uses Supabase admin client to delete user + cascade deletes)
- Dashboard and auth pages exist with established patterns
- Middleware protects `/dashboard` and `/canvas` but not `/settings`
- Sign-in page can handle query params for status messages

## Desired End State

Users can navigate to `/settings` from the dashboard, check "I understand this is permanent," and confirm deletion via an AlertDialog. On success, they're signed out and see a deletion notice on the sign-in page. If deletion fails, they stay on `/settings` with an error alert and can retry.

## Key Decisions Made

| Decision                   | Choice                                    | Why                                                                                                                        | Source |
| -------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| Settings scope             | Account deletion only                     | Minimal scope, ships fast. Other account features can be added later.                                                      | Plan   |
| Confirmation UX            | Checkbox + AlertDialog (2-step)           | Higher friction than modal alone; prevents accidental clicks. Checkbox enables the button to prevent thoughtless clicking. | Plan   |
| After-deletion flow        | Redirect to `/auth/signin?deleted=true`   | User sees proof of deletion; one place to surface the finality.                                                            | Plan   |
| Deletion notice prominence | Prominent alert box above form            | Can't miss it; consistent with existing error UX.                                                                          | Plan   |
| Error handling             | Alert on `/settings`, user stays on page  | User can retry without losing session.                                                                                     | Plan   |
| Cascade delete testing     | Automated integration test                | Verifies cascade constraint; catches regressions.                                                                          | Plan   |
| Middleware                 | `/settings` only (no over-generalization) | Minimal scope; future account pages can add themselves.                                                                    | Plan   |
| Secret setup timing        | During final phase (when ready to test)   | Clean workflow; secret provisioned when actually needed.                                                                   | Plan   |

## Scope

**In scope:**

- `/settings` page (protected route) with "Danger Zone" section
- DeleteAccountButton component with checkbox confirmation + AlertDialog
- Middleware protection for `/settings`
- Dashboard settings link
- Sign-in `?deleted=true` notice (green alert box)
- Integration test for cascade delete (user → canvases → share_links)
- Local `.dev.vars` setup + production Cloudflare secret documentation

**Out of scope:**

- Other account settings (email change, password reset) — reserved for future
- Account suspension or soft-delete — this is permanent
- Data export before deletion
- Scheduled deletion (e.g., "delete in 30 days")
- Re-authentication step (e.g., "enter password to confirm")

## Architecture / Approach

**Flow**:

1. User navigates to `/settings` (protected route)
2. Unchecks "I understand" → delete button disabled
3. Checks "I understand" → delete button enabled
4. Clicks delete → AlertDialog confirmation
5. Confirms → POST to `/api/auth/delete-account`
6. Endpoint deletes user (cascade to canvases + share_links), returns 200
7. Client redirects to `/auth/signin?deleted=true`
8. Sign-in page renders green alert: "Your account has been permanently deleted"

**On error**:

- Endpoint returns 5xx
- Client shows alert on `/settings`
- User stays on page and can retry

**Testing**:

- Unit test: DeleteAccountButton component (checkbox state, button enabled/disabled)
- Integration test: cascade delete via admin client
- Manual: full flow from dashboard → deletion → sign-in notice

## Phases at a Glance

| Phase                       | What it delivers                                                  | Key risk                                         |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| 1. Protected Settings Route | `/settings` page + middleware + dashboard link                    | None — straightforward route setup               |
| 2. DeleteAccountButton      | Confirmation component + API wiring + error handling              | Button disabled state if checkbox binding breaks |
| 3. Sign-In Deletion Notice  | Param detection + green alert box on sign-in                      | Alert not rendering if param parsing fails       |
| 4. Testing & Integration    | Integration test + local `.dev.vars` setup + secret documentation | Admin client fails if secret is missing or wrong |

**Prerequisites**: Supabase auth working (already done); AlertDialog component available (already in codebase)
**Estimated effort**: ~3-4 hours across 4 phases (1-2 hours design + component, 30min testing, 30min admin setup)

## Open Risks & Assumptions

- **Admin client availability**: The `createAdminClient()` function must have access to `SUPABASE_SERVICE_ROLE_KEY`. Locally, this comes from `.dev.vars`; in production, from a Cloudflare secret. If the secret is missing, the endpoint returns a 500. We'll set it during the final phase (Phase 4) when testing.
- **Session termination**: The endpoint deletes the user from auth.users, which immediately invalidates their session. The client redirects to sign-in after the POST succeeds, ensuring no stale session state is displayed.
- **Cascade delete verification**: We assume Supabase FK constraints and RLS are correctly configured. The integration test will verify; if it fails, we know the schema is wrong.

## Success Criteria (Summary)

- Users can delete their account from `/settings` with explicit checkbox + dialog confirmation
- On success: redirected to sign-in with green "account deleted" notice
- On error: alert stays on `/settings` so user can retry
- Cascade delete (user → canvases → share_links) is verified by automated test
- Feature works locally with `.dev.vars` and in production with Cloudflare secret
