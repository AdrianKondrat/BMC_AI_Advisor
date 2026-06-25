# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-23

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic assertion that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is produced
   by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

Hot-spot scope used for likelihood weighting: `src/` (excluding
`node_modules`, `dist`, `build`, `.wrangler`). Top directories by
commit frequency over the past 30 days: `src/components` (12),
`src/lib` (8), `src/pages/api/canvases` (6), `src/lib/services` (3),
`src/pages/share` (3).

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                       | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AI fill returns free-form text or partial/missing BMC block keys — user sees a broken or empty canvas; core product hypothesis fails silently | High   | High       | PRD FR-007 + Guardrail "never free-form text"; interview Q1 (top fear: "AI fill stops returning structured blocks"); hot-spot dir `src/lib/services` (3/30d)          |
| 2   | Expired share token still returns canvas data from the public route — founder IP exposed past chosen expiry                                   | High   | Medium     | PRD FR-011; roadmap S-04 risk note "expiry must be enforced server-side"; interview Q3 (low confidence: "share link flow")                                            |
| 3   | A recipient with a share token can reach write API endpoints (no auth session) — read-only guarantee broken                                   | High   | Medium     | PRD Guardrail "recipient must never be able to modify"; interview Q3; hot-spot dirs `src/pages/share` (3/30d), `src/pages/api/canvases` (6/30d)                       |
| 4   | User B reads or modifies User A's canvas via a known canvas UUID — per-user data isolation broken (IDOR)                                      | High   | Medium     | PRD Guardrail "never appear in any other user's session"; `context/foundation/lessons.md` "RLS mutation no-op" pattern; hot-spot dir `src/pages/api/canvases` (6/30d) |
| 5   | Block edit returns 200 but content is not persisted — founder sees old data on refresh (silent data loss)                                     | High   | Low-Medium | PRD Guardrail "no silent data loss"; `context/foundation/lessons.md` "owner filter on mutations"; hot-spot dir `src/pages/api/canvases` (6/30d)                       |
| 6   | AI call fails (timeout / 5xx / malformed response) and UI hangs on spinner or shows blank screen — no visible recovery path                   | Medium | Medium     | PRD NFR "visible progress feedback — no blank screen"; roadmap S-02 risk "AI latency likely >2s"; hot-spot dir `src/lib/services` (3/30d)                             |
| 7   | Unauthenticated GET to a protected route returns page content instead of redirecting — PROTECTED_ROUTES list incomplete                       | Medium | Low        | PRD §Access Control; CLAUDE.md §Auth flow; hot-spot `src/middleware.ts` (2/30d)                                                                                       |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                   | Must challenge                                                                                                      | Context `/10x-research` must ground                                                                                                                        | Likely cheapest layer                                                                                                        | Anti-pattern to avoid                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| #1   | Endpoint returns a response containing all 9 named BMC block keys with non-empty string values                                                | "Status 200 = correct structure"                                                                                    | How is the AI JSON parsed after the call? What happens when a block key is absent or null? Is there a validation step?                                     | Integration test with a mocked AI response fixture — verify the parse-and-validate path, not live AI                         | Asserting content quality or creativity (non-deterministic) — test shape and key presence only        |
| #2   | GET to the public share route with an expired token returns a non-200 status and no canvas payload                                            | "The UI shows an expired message" — server must independently reject                                                | Where is the expiry timestamp checked — on the server route, the API handler, or only in a UI component?                                                   | Integration test — seed a share_link row with expiry in the past, hit the public route, assert 4xx and empty payload         | Testing only that the client hides content without verifying the server rejects the token             |
| #3   | PATCH/DELETE to a canvas endpoint with a share-token-only context (no valid auth session) returns 401 or 403                                  | "No edit UI on the share page = no write access" — direct API calls bypass the UI                                   | Can write endpoints be reached without a valid Supabase auth session? Is the session checked independently of the RLS policy?                              | Integration test — unauthenticated write request to canvas API endpoints, assert 401/403                                     | Testing only UI read behaviour; not testing direct API write attempts from an unauthenticated context |
| #4   | User B's authenticated GET for User A's canvas UUID returns 404 or 403, not canvas data                                                       | "RLS will catch it" — lessons.md documents RLS silently no-ops mutations; read may share the same gap               | Does the GET endpoint filter by owner_id explicitly, or only rely on the RLS policy? Does it return 404 vs. 403 on access failure?                         | Integration test with two seeded test users — User A creates canvas, User B attempts GET by ID, assert non-200 or empty body | Single-user fixture only — cross-user assertion is mandatory                                          |
| #5   | PATCH a block, then GET the same canvas — the block's content in the GET response matches what was PATCHed (round-trip persistence)           | "PATCH returned 200 = data saved" — the RLS mutation no-op pattern can produce a silent 200 without a write         | Does the PATCH endpoint use an explicit owner_id filter? Is the response the updated record or just 200? Is there any caching that could serve stale data? | Integration test — write updated content, read back, assert specific block value matches                                     | Asserting only the PATCH response status without a subsequent read-back                               |
| #6   | When the AI call rejects, the component renders a visible error message (not a perpetual spinner) and any existing canvas data is not cleared | "A rejected Promise dismisses the loading state" — an uncaught rejection may leave the spinner running indefinitely | Where is the AI error caught in the component tree? Is there a try/catch or error boundary that renders user-facing copy?                                  | React unit test — mock the AI call to reject, assert error message renders and canvas state is preserved                     | Mocking the fetch without asserting the rendered component output (tests the mock, not the component) |
| #7   | Unauthenticated GET to /dashboard or /canvas/[id] returns a 302/303 redirect to /auth/signin, not page content                                | "The middleware is correct today" — PROTECTED_ROUTES may not be updated as new pages are added                      | Which routes are in PROTECTED_ROUTES? Does the middleware check fire before the page handler runs?                                                         | Integration test — unauthenticated GET to each protected route, assert redirect status and Location header                   | Testing only the authenticated path (happy-path-only) without the unauthenticated rejection case      |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                           | Goal (one line)                                                          | Risks covered | Test types                                | Status      | Change folder                                |
| --- | ------------------------------------ | ------------------------------------------------------------------------ | ------------- | ----------------------------------------- | ----------- | -------------------------------------------- |
| 1   | Test infra + access control          | Bootstrap Vitest in CI; prove auth redirect and cross-user IDOR baseline | #4, #7        | integration (API, middleware)             | complete    | context/changes/testing-infra-access-control |
| 2   | Share link integrity                 | Prove expiry rejection and read-only enforcement at the API layer        | #2, #3        | integration (API, share route)            | complete    | context/changes/share-link-integrity         |
| 3   | AI service contract + error handling | Prove structured 9-block output via fixture and error recovery in the UI | #1, #6        | integration (fixture mock), React unit    | not started | —                                            |
| 4   | Data persistence + quality gates     | Round-trip block save verified; lint + typecheck + tests wired in CI     | #5            | integration (write + read-back), CI gates | not started | —                                            |

---

## 4. Stack

The classic test base for this project. No test runner is currently installed
(profile: `none`). Phase 1 bootstraps the runner; subsequent phases add layers.

| Layer                         | Tool                              | Version                   | Notes                                                                                                         |
| ----------------------------- | --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Unit + integration            | Vitest                            | none yet — see §3 Phase 1 | Natural fit for the Vite/Astro ecosystem; supports React component tests via jsdom                            |
| Cloudflare Worker integration | `@cloudflare/vitest-pool-workers` | none yet — see §3 Phase 1 | Runs integration tests inside the workerd runtime; required for accurate Astro SSR + Cloudflare env behaviour |
| HTTP / AI API mocking         | MSW (Mock Service Worker)         | none yet — see §3 Phase 3 | Mock the OpenRouter/OpenAI HTTP boundary only; never mock internal modules                                    |
| React component testing       | `@testing-library/react`          | none yet — see §3 Phase 3 | For Risk #6 error-state assertion; jsdom environment via Vitest                                               |
| e2e                           | none — not in current rollout     | —                         | Deferred; add via `/10x-test-plan --refresh` if a critical flow requires browser-level verification           |

**Stack grounding tools (current session):**

- Docs: none — Context7 not available in current session; Vitest and `@cloudflare/vitest-pool-workers` recommendations based on local `package.json` manifest (Astro 6 + Wrangler 4); checked: 2026-06-23
- Search: none — Exa.ai not available in current session; checked: 2026-06-23
- Runtime/browser: none — Playwright MCP not available in current session; e2e layer deferred; checked: 2026-06-23
- Provider/platform: Supabase MCP available in current session — relevant for Phase 1/2 schema inspection and verifying RLS policy shape during research; not used for code anchors; checked: 2026-06-23

---

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate                    | Where                                   | Required?                                    | Catches                                                                         |
| ----------------------- | --------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| lint + typecheck        | local + CI (`.github/workflows/ci.yml`) | required (already wired)                     | syntactic and type drift                                                        |
| unit + integration      | local + CI                              | required after §3 Phase 1                    | logic regressions, access control gaps                                          |
| post-edit hook (eslint) | local (husky + lint-staged)             | recommended (already wired for lint/format)  | syntactic errors at commit time                                                 |
| pre-prod smoke          | between merge and prod                  | optional                                     | environment-specific failures (e.g. remote schema out of sync — see lessons.md) |
| e2e on critical flows   | CI on PR                                | not in current rollout — add via `--refresh` | broken end-to-end user paths                                                    |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test (React component)

TBD — see §3 Phase 3 (AI service contract + error handling, which ships the first React unit tests).

### 6.2 Adding an integration test (API endpoint)

**Test runner**: Vitest with `@cloudflare/vitest-pool-workers` — runs inside workerd (the same runtime as production). The `wrangler.json` in `dist/server/` drives bindings and compat flags; the app must be built before tests so `dist/` exists.

**File location**: `tests/integration/{feature}.test.ts`

**Run command**: `npm run build && npm test`

**Auth pattern**: Use `getAuthCookies(email, password)` from `tests/helpers/auth.ts` to obtain a `Cookie:` header string. Pass it via `SELF.fetch()` headers. Also add `Origin: http://localhost` to every mutation request (POST/PATCH/DELETE/PUT) — Astro's built-in CSRF protection (`security.checkOrigin: true` default) blocks requests without a matching Origin.

**Fixture pattern**: Create users via `createTestUser` (Supabase auth admin API, in `tests/helpers/setup.ts`) and canvases via `createTestCanvas` (direct service-role INSERT — do NOT use `POST /api/canvases`, which calls the AI). Clean up in `afterAll` unconditionally using `.catch(() => undefined)` so cleanup never blocks test reporting.

**Schema note**: `PATCH /api/canvases/[id]` uses `z.record(z.enum([...9 block keys...]), z.string())` which requires all 9 block keys to be present. Send an object with all keys (even empty strings) to reach the owner-filter 404.

**Supabase module workaround**: `@supabase/*` packages ship `dist/module/*.js` as ESM without `"type":"module"`. The wrangler.json rule `**/*.js → ESModule` force-loads all `.js` node_modules files as ESM, breaking CJS packages. `vitest.config.ts` uses `resolve.alias` (for packages with `.cjs` bundles) and an esbuild pre-bundle plugin (for packages without `.cjs`) to route all `@supabase/*` imports through `.cjs` extension files, which the module rule does not cover.

**Reference test**: `tests/integration/access-control.test.ts` (cross-user IDOR suite from Phase 1).

### 6.3 Adding a test for a new share/public route

**Test runner**: Same Vitest + `@cloudflare/vitest-pool-workers` setup as §6.2.

**Target the API route, not the page route**: `GET /api/share/{token}` returns `404` for expired or unknown tokens. `GET /share/{token}` (the Astro page) always returns `200` with error HTML — it is not an enforcement point. Tests must target `/api/share/{token}`.

**Seeding share links**: Use `createTestShareLink(canvasId, expiresAt)` from `tests/helpers/setup.ts`.

- Expired fixture: pass a past ISO timestamp, e.g. `new Date(Date.now() - 1000).toISOString()`.
- Never-expiring fixture: pass `null` as the second argument (default).
- The `token` is generated by the DB default (`encode(gen_random_bytes(32), 'hex')`); retrieve it from the returned `{ id, token }`.

**Assertions**:

- Expired token: `SELF.fetch("http://localhost/api/share/{expiredToken}")` → assert `response.status === 404` and `await response.text() === ""` (handler returns `new Response(null, { status: 404 })`).
- Valid token: same fetch with valid token → assert `response.status === 200`, parse JSON, assert `body.canvas` and `body.shareLink` are non-null objects.

**No `Origin` header needed**: `GET /api/share/{token}` is a read-only public endpoint; Astro's CSRF guard (`security.checkOrigin`) only applies to mutations. Include `Origin: http://localhost` on POST/PATCH/DELETE requests only.

**Cleanup**: Call `deleteTestCanvas(canvasId)` in `afterAll` only — the `share_links` table has `ON DELETE CASCADE` on `canvas_id`, so share-link rows are removed automatically. Do not call `deleteTestShareLink` in teardown; it risks a double-delete after cascade.

**Reference test**: `tests/integration/share-link-integrity.test.ts` (Phase 2 suite).

### 6.4 Adding a test for AI service responses

TBD — see §3 Phase 3 (AI service contract + error handling, which ships the fixture-based AI mock pattern and the structured-output assertion pattern).

### 6.5 Per-rollout-phase notes

(Filled in as phases complete — captures surprises, fixture locations, and anything a future contributor would need to know.)

---

## 7. What We Deliberately Don't Test

Exclusions agreed during Phase 2 interview (Q5).

- **AI model response quality and creativity** — Whether the generated canvas text is insightful, relevant, or well-written is non-deterministic and cannot be asserted meaningfully. Re-evaluate only if a structured output schema with deterministic field-level validation is added. (Source: Phase 2 interview Q5.)
- **Auth pages UI flows (sign-in, sign-up, confirm-email)** — Supabase handles the underlying auth; testing our form wiring is primarily testing Supabase's library, not product logic. The access-control integration tests (Phase 1, Risk #7) cover the meaningful boundary: that protected routes redirect unauthenticated users. (Source: PRD §Non-Goals — no auth redesign; stack: Supabase auth is library-managed.)
- **UI snapshot / visual layout regression** — The canvas grid and block UI change frequently; snapshot churn produces noise without catching real regressions. Add a deterministic visual diff only if a specific screen has a track record of layout breakage. (Source: cost × signal principle §1.)

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-23
- Stack versions last verified: 2026-06-23
- AI-native tool references last verified: 2026-06-23 (no AI-native layer in current rollout)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
