---
change_id: testing-infra-access-control
title: Test infra and access control (Phase 1 rollout)
status: implementing
created: 2026-06-23
updated: 2026-06-24
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Test infra + access control".
Risks covered: #4 (IDOR — User B reads User A's canvas), #7 (unauthenticated GET to protected route returns page content instead of redirect).
Test types planned: integration (API endpoints, middleware).
Risk response intent:

- Risk #4: Prove User B's authenticated GET for User A's canvas UUID returns 404 or 403 — not canvas data. Challenge: do not assume RLS alone is sufficient (lessons.md documents the RLS mutation no-op pattern; read may share the same gap). Avoid single-user fixtures; cross-user assertion is mandatory.
- Risk #7: Prove unauthenticated GET to /dashboard or /canvas/[id] returns a 302/303 redirect to /auth/signin — not page content. Challenge: do not assume today's PROTECTED_ROUTES list is complete as new pages are added. Test each listed protected route, not just one.
