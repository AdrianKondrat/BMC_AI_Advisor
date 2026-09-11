# System Architecture and Quality Evidence

## System Overview

BMC AI Advisor is an Astro 6 server-side-rendered application deployed on Cloudflare Workers. It integrates Supabase for user authentication and row-level security (RLS), and OpenRouter for structured AI generation. The system fills a 9-block Business Model Canvas with domain-aware AI output, enforces strict read-only sharing, and isolates user data at the database layer. All pages render on the server; API routes validate both session state and RLS policies before returning data.

## Four Failure Risks and Protective Measures

### Risk #1: AI Output Integrity

**Failure scenario:** OpenRouter returns free-form text or incomplete BMC blocks—user sees a malformed canvas and the core product hypothesis fails silently.

**Why this matters:** The product's distinguishing feature is structured, 9-block output. Free-form AI text degrades the offering to a generic prompt.

**How it's protected:**

- **Test Phase 3** (`context/changes/ai-service-contract/`) validates that the AI response parser enforces all nine named BMC block keys (Value Proposition, Customer Segment, Revenue Stream, etc.) with non-empty string values. The test uses a mocked fixture response to isolate the parse-and-validate path from live AI latency.
- **Test reference:** `tests/integration/ai-service-contract.test.ts` seeds a fixture response, asserts the parsed block structure contains all nine keys, and verifies the component renders without missing content.
- **Lessons applied:** Validation happens before storage; the response contract is treated as untrusted input.

### Risk #2: Share-Link Expiry Bypass

**Failure scenario:** An expired share token still returns canvas data from the public read route—founder's IP is exposed past the chosen expiry window.

**Why this matters:** Privacy-conscious founders trust the expiry guarantee. Silent bypass undermines the sharing feature and creator confidence.

**How it's protected:**

- **Test Phase 2** (`context/changes/share-link-integrity/`) proves that a GET request to the public share route with an expired token returns a 404 (or 403) without the canvas payload. The test seeds a `share_links` row with `expires_at` in the past and hits the route server-side, asserting rejection before any component code executes.
- **Test reference:** `tests/integration/share-link-integrity.test.ts` covers expiry rejection and includes timing assertions to prove the server checks the timestamp independently.
- **Hardening:** Expiry validation is checked on every public route access; the route does not leak canvas data on expired tokens.

### Risk #3: Share-Link Write Bypass

**Failure scenario:** A recipient holding only a share token (no auth session) can reach write API endpoints—the read-only guarantee breaks.

**Why this matters:** The PRD guardrail is absolute: "recipient must never be able to modify the founder's canvas." Direct API calls bypass UI controls; the API must enforce this independently.

**How it's protected:**

- **Test Phase 2** validates that PATCH and DELETE endpoints return 401 or 403 when called with only a share token and no valid Supabase auth session. The test makes direct unauthenticated requests to canvas write endpoints and asserts rejection.
- **Test reference:** Same suite, `tests/integration/share-link-integrity.test.ts`—write-attempt assertions sit alongside expiry checks.
- **Enforcement:** Write endpoints check for a valid auth session before querying the database; RLS policy is a second layer, not the first.

### Risk #4: Cross-User Data Isolation (IDOR)

**Failure scenario:** User B reads or modifies User A's canvas by knowing its UUID—per-user data isolation is broken.

**Why this matters:** Multi-user systems require strict isolation. Any gap exposes private business ideas and allows vandalism.

**How it's protected:**

- **Test Phase 1** (`context/changes/testing-infra-access-control/`) seeds two distinct users, has User A create a canvas, and asserts that User B's authenticated GET for that canvas UUID returns 404 or 403 (not the canvas data). This proves explicit ownership checks work.
- **Test reference:** `tests/integration/access-control.test.ts` uses Supabase RLS policies and an explicit `owner_id` filter on all queries.
- **Critical lesson from `context/foundation/lessons.md`:** RLS mutations sometimes silently no-op if the Supabase SSR client doesn't attach the session JWT. The guard is an explicit `.eq('owner_id', context.locals.user.id)` filter on every DELETE and UPDATE, independent of the RLS policy. This dual-layer defense catches both session-binding bugs and RLS policy gaps.

## Quality Gates: Layers of Defense

**Per-edit (agent hooks):** ESLint runs on every file write. Risk-area files (those in `src/lib/**` and `src/pages/api/**`) trigger related-test execution via `vitest related --run`, feeding failures back to the agent for immediate correction.

**Pre-commit (git hooks):** Husky + lint-staged enforces ESLint and Prettier formatting on staged source files before any commit lands.

**CI/CD (.github/workflows/ci.yml):** On every push and PR to main, the workflow runs:

1. Lint and build (validates Astro+TypeScript+Tailwind)
2. Full integration and unit test suite (Vitest with Cloudflare pool workers)
3. On push to main: automatic deployment to Cloudflare Workers

**Lessons Wired into Implementation:**

- Explicit owner_id filters protect all canvas mutations against RLS no-op bugs.
- Migrations are treated as immutable; schema corrections create new compensating migrations.
- Supabase schema changes are pushed to remote before manual API testing, preventing silent 500s from local-only schema drift.

## Architecture Reference

**Auth flow:** Middleware runs on every request, resolves the current user via Supabase SSR client, attaches `context.locals.user` to the request context, and redirects unauthenticated traffic away from protected routes (`/dashboard`, `/canvas/[id]`, `/settings`).

**Row-Level Security:** Canvas, block, and share-link tables enforce `auth.uid() = owner_id` policies; users cannot read or modify rows they don't own. API routes add explicit owner filters to prevent the RLS mutation no-op pattern.

**Structured AI Contract:** OpenRouter is called with a strict JSON-schema prompt that names all nine blocks and requires non-empty string values. Parser validates the response before storing blocks as JSONB on the canvas row. Critique output is similarly schema-enforced.

**Data Persistence:** Block edits persist via PATCH endpoints that return 204 and require a subsequent GET to verify. Round-trip tests in Phase 4 (`context/changes/data-persistence-quality-gates/`) prove that edited content survives a read-back.

---

**Evidence trail:** Completed test phases (1–4) live in `context/changes/` and are ready for archive. Each phase folder contains its plan, research findings, and implementation evidence. CI logs on GitHub Actions show every gate pass. This document ties the pieces together for a reviewer.
