# Share Link Integrity — Plan Brief

> Full plan: `context/changes/share-link-integrity/plan.md`
> Research: `context/changes/share-link-integrity/research.md`

## What & Why

Add integration tests for Risk #2 (expired share token still returns canvas data) and Risk #3 (share-token recipient can reach write API endpoints). Both protections are already correctly implemented in the codebase — these tests are regression guards that would catch any future refactor that accidentally removes them.

## Starting Point

Phase 1 (testing-infra-access-control) already shipped the full test infrastructure: Vitest + `@cloudflare/vitest-pool-workers`, the `SELF.fetch()` pattern, `supabaseAdmin` for service-role fixture setup, and helpers for users and canvases. No new tooling or dependencies are needed; Phase 2 adds only share-link helpers and test cases on top of what exists.

## Desired End State

`tests/integration/share-link-integrity.test.ts` exists with four passing tests (two per risk). `tests/helpers/setup.ts` exports `createTestShareLink` and `deleteTestShareLink`. `npm run build && npm test` passes with zero failures across both Phase 1 and Phase 2 suites. `test-plan.md §6.3` documents the public-route test pattern and Phase 2 is marked `complete` in the rollout table.

## Key Decisions Made

| Decision                        | Choice                                                       | Why (1 sentence)                                                                             | Source          |
| ------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------- |
| Test file organization          | One file, two `describe` blocks                              | Risks share the same canvas setup; single file follows Phase 1 convention                    | Plan            |
| Risk #3 write endpoint coverage | PATCH + DELETE on `/api/canvases/{id}` only                  | All 8 write handlers share an identical guard; 2 tests prove the pattern without boilerplate | Research / Plan |
| Happy-path body assertion       | Status 200 + assert `canvas` and `shareLink` keys in JSON    | Prevents a regression where status is 200 but body is empty; matches the research oracle     | Research / Plan |
| Route targeted for Risk #2      | `GET /api/share/{token}` (API route, not Astro page)         | The API route returns 404 for expired tokens; the Astro page returns 200 with error HTML     | Research        |
| Share link teardown strategy    | Delete canvas only (`ON DELETE CASCADE` removes share links) | Avoids double-delete risk if canvas is deleted first; keeps `afterAll` minimal               | Research / Plan |

## Scope

**In scope:**

- `createTestShareLink` + `deleteTestShareLink` helpers in `tests/helpers/setup.ts`
- `tests/integration/share-link-integrity.test.ts` — 4 tests across 2 `describe` blocks
- `test-plan.md §6.3` cookbook entry for public-route tests
- Rollout state advancement (Phase 2 → `complete`, `change.md` → `planned`)

**Out of scope:**

- Astro page route (`/share/[token]`) — returns 200 with error HTML for expired tokens by design
- Pin-protected share links (`pin_hash` column) — deferred
- All 8 write handlers individually — the pattern is proven by 2 representative tests
- Any new npm dependencies or infra changes

## Architecture / Approach

The test file seeds fixtures directly into Supabase via `supabaseAdmin` (service role, bypasses RLS), then hits the workerd runtime via `SELF.fetch()`. For Risk #2, two share links are seeded: one with a past `expires_at` (triggers both the RLS invisible-row filter and `isExpired()` backstop) and one with `expires_at = null` (happy-path, proves valid links still work). For Risk #3, the test sends write requests with no `Cookie` header — the handler's `if (!context.locals.user) return 401` fires before any DB access.

## Phases at a Glance

| Phase                              | What it delivers                                          | Key risk                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1. Add share link helpers          | `createTestShareLink` + `deleteTestShareLink` in setup.ts | None — straightforward service-role INSERT/DELETE                                                                             |
| 2. Write integration tests         | 4 tests passing in new test file                          | Expired fixture must use past ISO timestamp; valid fixture must use `null` not a future date (to avoid flakiness near expiry) |
| 3. Update cookbook + rollout state | §6.3 filled in; Phase 2 marked complete                   | None                                                                                                                          |

**Prerequisites:** Phase 1 (testing-infra-access-control) must be complete — infrastructure already in place on current branch (`testing-infra-access-control`).  
**Estimated effort:** ~1 session across 3 short phases.

## Open Risks & Assumptions

- The `GET /api/share/[token]` response body shape (`{ canvas, shareLink }`) is inferred from the research doc and handler code — if the shape differs, the happy-path body assertion in Phase 2 will need adjustment.
- The inconsistency in `DELETE /api/canvases/[id]/share` (returns 404 for wrong-owner vs. 401 from other handlers) is noted in research but not addressed in Phase 2. Deferred as a separate consistency pass.

## Success Criteria (Summary)

- `npm run build && npm test` exits 0 with exactly 4 new passing tests alongside the 2 Phase 1 tests
- Both expiry paths (expired → 404, valid → 200 + body) and both write-guard paths (PATCH → 401, DELETE → 401) are covered
- `test-plan.md §6.3` no longer reads "TBD"
