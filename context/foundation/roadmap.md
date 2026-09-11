---
project: "BMC AI Advisor"
version: 3
status: active
created: 2026-06-04
updated: 2026-09-11
prd_version: 1
main_goal: quality
top_blocker: time
---

# Roadmap: BMC AI Advisor

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

First-time founders stare at 9 empty BMC boxes with no guidance — they either guess or abandon the exercise. BMC AI Advisor closes the gap left by static templates and generic AI tools: it is a domain-aware AI that fills, critiques, and makes shareable a Business Model Canvas in one continuous session, with no external help needed.

The product's distinguishing trait — the one capability that, if removed, makes it indistinguishable from a generic AI prompt — is that the AI fills the canvas structured to the 9 named BMC blocks, with cross-block consistency critique built in. Generic tools return free-form text the founder must parse; this product returns a structured, editable, shareable canvas.

## North star (v2)

**S-06: Founder edits their idea and regenerates the canvas** — the smallest end-to-end slice whose successful delivery proves the product is ready for real users: a one-shot demo graduates to a genuine iteration tool when a founder can refine their idea and get a fresh canvas without starting over.

> "The north star" here means the single slice that, if shipped, most advances the current main_goal (`quality`). S-02 was the original north star (delivered at launch); S-06 is the quality gate for the next phase — if a founder can't refine their input, the PRD Success Criteria bar ("the flow completes without external help") is not met.

**Current sprint (2026-09-11):** S-06 stays the product north star but is **deferred**. The active sequence is the delivery track below (architecture quality + CI evidence + landing page) so the public product and the engineering record match what is already built.

## At a glance

| ID   | Change ID                 | Outcome (user can …)                                                                                        | Prerequisites | PRD refs                              | Status |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------- | ------ |
| F-01 | canvas-schema             | (foundation) canvas, blocks, and share-link tables in Supabase with RLS per-user isolation                  | —             | FR-001, FR-002, FR-003, FR-011        | done   |
| S-01 | canvas-dashboard          | view list of saved canvases and delete any canvas                                                           | F-01          | FR-004, FR-005, US-01                 | done   |
| S-02 | s-02                      | input a plain-text idea, trigger AI fill of all 9 BMC blocks, edit any block, and see the canvas auto-saved | F-01, S-01    | FR-003, FR-006, FR-007, FR-008, US-01 | done   |
| S-03 | ai-critique               | trigger AI critique of their canvas and see block-level feedback                                            | S-02          | FR-010, US-02                         | done   |
| S-04 | s-04                      | generate a read-only share link with optional expiry and share it with anyone                               | S-02          | FR-011, FR-012, US-03                 | done   |
| S-05 | account-deletion          | permanently delete their account and all associated data                                                    | F-01          | FR-013                                | ready  |
| S-06 | edit-idea-regenerate      | edit the idea text on an existing canvas and trigger full AI regeneration of all 9 blocks                   | F-01, S-02    | FR-014, FR-006, FR-007                | ready  |
| S-07 | product-landing-page      | discover the product on a purpose-built landing page and navigate to sign-up or sign-in                     | —             | FR-015                                | done   |
| S-08 | readme-update             | read an accurate README describing the project, its purpose, setup, and usage                               | —             | FR-016                                | ready  |
| S-09 | agent-hooks               | (quality) agent edits of source files are lint-checked immediately, with failing output fed back            | —             | test-plan §4                          | ready  |
| S-10 | architecture-evidence     | (quality) a reviewer can read one document covering tests, gates, hardening, and AI contracts               | —             | test-plan, lessons.md                 | ready  |
| S-11 | archive-completed-changes | (quality) completed change folders live under archive; `context/changes/` holds only in-flight work         | —             | —                                     | ready  |
| S-12 | ci-cd-evidence            | (quality) a reviewer can read how lint, build, tests, and production deploy run on every push and PR        | —             | infrastructure.md                     | ready  |
| S-13 | dependabot                | (quality) npm dependency updates arrive as pull requests instead of silent drift                            | —             | —                                     | ready  |

## Current sprint — implementation briefs

Ordered for a short window: cheapest quality artifacts first, then account deletion, then the public landing page. S-06 (regenerate) and extra Playwright e2e stay out of this sprint.

| Order | ID   | Change ID                 | Track     | Implementation brief                                                                                                                                                                                                                                                                                                                                     |
| ----- | ---- | ------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | S-09 | agent-hooks               | Architect | Add `.cursor/hooks.json`. On `Write`/`Edit` of `*.{ts,tsx,astro}`, run ESLint on that file. On risk-area paths from `test-plan.md` (`src/lib/**`, `src/pages/api/**`), also run `vitest related` for the edited file with `--run`. Exit `2` on failure so the agent sees stdout. Do not run the full suite per edit.                                     |
| 2     | S-11 | archive-completed-changes | Architect | Move implemented change folders (canvas-schema, canvas-dashboard, s-02, ai-critique, s-04, testing-infra-access-control, share-link-integrity, ai-service-contract, data-persistence-quality-gates, bootstrap-verification) to `context/archive/<date>-<change-id>/`. Leave `account-deletion` in `context/changes/`. Flip matching Done rows if needed. |
| 3     | S-10 | architecture-evidence     | Architect | Write `context/foundation/architecture.md`: layers (Astro SSR, Supabase RLS, OpenRouter structured output), test-plan phases 1–4 and what they prove, quality gates (lint, tests, CI, husky), share-link hardening, AI JSON-schema contract, impl-review trail, lessons. One page. Point the submission form at this file.                               |
| 4     | S-12 | ci-cd-evidence            | Champion  | Write `context/foundation/ci-cd.md`: trigger (push/PR to `main`), steps (lint → build → miniflare secrets → `npm test` → `wrangler deploy` on push), required secrets, what a reviewer should look at in GitHub Actions. Do not invent new jobs here.                                                                                                    |
| 5     | S-13 | dependabot                | Champion  | Add `.github/dependabot.yml` for the npm ecosystem, weekly, grouped or capped so the inbox stays small. Confirm CI already runs on PRs (it does). Optional: enable GitHub Dependabot alerts if not already on.                                                                                                                                           |
| 6     | S-05 | account-deletion          | Architect | Follow existing `context/changes/account-deletion/plan.md`. Finish: settings page + confirm dialog, protect `/settings`, dashboard link, `?deleted=true` on sign-in, Cloudflare `SUPABASE_SERVICE_ROLE_KEY` secret. Backend client + `POST /api/auth/delete-account` already drafted.                                                                    |
| 7     | S-07 | product-landing-page      | Product   | Replace starter `Welcome` on `/` with a product page: hero (plain-text idea → structured 9-block BMC + critique), three steps, static 9-block canvas mock (not a live AI demo), CTAs to `/auth/signup` and `/auth/signin`. Keep existing cosmic layout. Copy decisions recorded on the slice (no longer blocked).                                        |

Related, not in this sprint: **S-08** README rewrite (do if time remains after S-07 — reviewers will open the repo first). **S-06** stays ready but parked until after submission.

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                                          | Note                                                                              |
| ------ | -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| A      | Canvas lifecycle     | F-01 → S-01 → S-02 → S-03 / S-04 / S-05 / S-06 | MVP chain complete (F-01–S-04 done); S-05 is in the current sprint; S-06 deferred |
| B      | Product presence     | S-08 / S-07                                    | S-07 unblocked (copy + static canvas mock decided); S-08 still ready              |
| C      | Architecture quality | S-09 / S-10 / S-11                             | Agent hooks, one-page architecture evidence, archive completed changes            |
| D      | Delivery automation  | S-12 / S-13                                    | Document existing CI/CD; add Dependabot so updates arrive as PRs                  |

## Baseline

What's already in place as of 2026-09-11 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + shadcn/ui; full MVP page tree at `src/pages/`; `index.astro` still renders Astro starter Welcome component, not a product landing page
- **Backend / API:** present — canvas CRUD, AI fill, critique, and share-link routes built; `POST /api/auth/delete-account` exists locally but has no settings UI and is not wired into middleware
- **Data:** present — `canvases` table with `idea` column (migration `20260610000000`) + JSONB blocks, `share_links`, RLS per-user isolation; idea text persisted per canvas
- **Auth:** present — Supabase auth with middleware; signin/signup/signout complete; account-deletion UI incomplete
- **Deploy / infra:** present — CI at `.github/workflows/ci.yml` (lint, build, test, deploy on push to `main`); Cloudflare Workers via `wrangler.jsonc`; no Dependabot; no agent `PostToolUse` hooks
- **Observability:** absent — no logging library, error tracking, or metrics; Worker observability flag is on in `wrangler.jsonc` only
- **Tests:** present — Vitest unit + Cloudflare-pool integration tests; React Testing Library for generate/critique error paths; no Playwright browser e2e
- **Context:** present — PRD, infrastructure, tech-stack, test-plan, deploy-plan, lessons; completed change folders still sit in `context/changes/` instead of archive

## Foundations

### F-01: Canvas schema

- **Outcome:** (foundation) `canvases`, `canvas_blocks`, and `share_links` tables created in Supabase with RLS policies enforcing per-user isolation; auth identities wired to canvas ownership.
- **Change ID:** canvas-schema
- **PRD refs:** FR-001, FR-002 (auth UIDs used in RLS `owner_id` policies), FR-003 (canvas entity), FR-011 (share_links table)
- **Unlocks:** S-01 (list/delete queries), S-02 (canvas create + block writes), S-03 (critique read/write), S-04 (share_links read/write), S-05 (account-level cascade delete), S-06 (idea text read/write for regeneration)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** every downstream slice depends on this schema; sequenced first. Main risk is picking the wrong block storage shape — JSONB column on `canvases` is simpler than a normalized `canvas_blocks` table and fits `speed` mode; defer normalization to a later change if needed.
- **Status:** done

## Slices

### S-01: Canvas dashboard

- **Outcome:** user can view the list of their saved canvases and delete any canvas.
- **Change ID:** canvas-dashboard
- **PRD refs:** FR-004, FR-005, US-01 (acceptance: "canvas is auto-saved and visible in the founder's canvas list")
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** small surface, but the list and delete paths must exist before S-02 auto-saves a canvas into the list. Sequenced before AI generation to catch data-layer issues early and cheaply.
- **Status:** done

### S-02: AI-generated canvas

- **Outcome:** user can input a plain-text business idea, trigger AI fill of all 9 BMC blocks, see them populated instantly, edit any block individually, and find the canvas auto-saved and auto-named in their list.
- **Change ID:** s-02
- **PRD refs:** FR-003, FR-006, FR-007, FR-008, US-01, NFR (progress feedback — loader/streaming during AI call), NFR (data privacy — AI provider must not store idea content)
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** most complex integration in the product — structured JSON output from AI, block-level persistence, and progress feedback all in one slice. AI latency will likely exceed 2 s; NFR requires visible progress during the wait — use streaming response or a loading indicator. If structured output is unreliable for a chosen model, switching models requires only an env-var change.
- **Status:** done

### S-03: AI critique

- **Outcome:** user can trigger an AI critique of their filled canvas and see block-level feedback classifying consistency gaps, completeness gaps, and investor-challenge assumptions — each tagged to a named BMC block.
- **Change ID:** ai-critique
- **PRD refs:** FR-010, US-02, NFR (progress feedback)
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** re-uses the AI integration scaffolded in S-02; main risk is prompt quality — critique prompt must enforce block-scoped output and evaluate at least one cross-block relationship (e.g., Value Proposition ↔ Customer Segment) to satisfy US-02 acceptance criteria. Free-form critique without block tags fails the acceptance test.
- **Status:** done

### S-04: Share canvas

- **Outcome:** user can generate a shareable read-only link for a canvas (with optional expiry), and anyone with the valid link can view the full canvas — including any critique run — without creating an account. PIN protection was deferred.
- **Change ID:** s-04
- **PRD refs:** FR-011, FR-012, US-03, NFR (3-second canvas render for share-link recipients)
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** public route requires deliberate auth bypass (read-only, no account); expiry must be enforced server-side; link must be strictly read-only (PRD Guardrail: "recipient must never be able to modify the founder's canvas"). Recipient performance NFR (3 s render) is naturally served by Cloudflare edge delivery.
- **Status:** done (PIN deferred)

### S-05: Account deletion

- **Outcome:** user can permanently delete their account and all associated data — canvases, blocks, and share links — with a confirmation step before the action is irreversible.
- **Change ID:** account-deletion
- **PRD refs:** FR-013
- **Prerequisites:** F-01
- **Parallel with:** S-06, S-07, S-08, S-09, S-10, S-11, S-12, S-13
- **Blockers:** —
- **Unknowns:**
  - Does Supabase's auth admin API (service role key) need a new secret in the Cloudflare Worker runtime? — Owner: user. Block: no (known implementation path; service role key follows the same pattern as `SUPABASE_KEY`). Production secret still needs `wrangler secret put`.
- **Risk:** irreversible action — the UI must require explicit confirmation before deletion proceeds. Cascade is already on FKs (`auth.users` → canvases → share_links). The service role key must remain server-side. Partial backend exists; shipping the API without the settings UI would leave an unreachable endpoint.
- **Status:** ready
- **Implementation brief:** Execute `context/changes/account-deletion/plan.md`. Remaining work is the `/settings` page, `DeleteAccountButton` with checkbox confirmation, middleware entry for `/settings`, dashboard link, sign-in `?deleted=true` notice, and the Cloudflare secret. Do not re-plan from scratch.

### S-06: Edit initial idea and regenerate canvas

- **Outcome:** user can edit the original idea text on an existing canvas, trigger a full AI regeneration of all 9 blocks, confirm they want to overwrite current block content, and see the canvas updated with the fresh generation.
- **Change ID:** edit-idea-regenerate
- **PRD refs:** FR-014, FR-006, FR-007
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-05, S-07, S-08
- **Blockers:** —
- **Unknowns:**
  - Should the regeneration offer a "keep current blocks" rollback option, or is a single confirmation modal (overwrite all) sufficient for v1? — Owner: user. Block: no (single confirmation modal is the pragmatic default; rollback adds storage/UX complexity and can be v3).
- **Risk:** north star for v2 — if the confirmation modal is dismissible without intent, founders may accidentally overwrite blocks they've manually refined. UX must make overwrite consequences explicit. The AI generation endpoint is the same as S-02; primary risk is UX design, not integration.
- **Status:** ready (deferred this sprint — see Current sprint)

### S-07: Product landing page

- **Outcome:** an unauthenticated visitor can view a purpose-built landing page that explains what the product does, shows representative output (a static 9-block canvas mock), and navigates to sign-up or sign-in.
- **Change ID:** product-landing-page
- **PRD refs:** FR-015, Vision (plain-text idea → structured 9-block canvas + critique)
- **Prerequisites:** —
- **Parallel with:** S-05, S-06, S-08, S-09, S-10, S-11, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Decisions (resolved 2026-09-11):**
  - **Lead copy:** "Turn a plain-text idea into a structured Business Model Canvas — then get a block-level critique you can share." Supporting line: the tool fills the 9 named BMC blocks and checks them against each other, unlike a generic chatbot dump.
  - **Hero proof:** static 9-block canvas mock with sample content (not a live AI demo, not an animation). Three steps underneath: describe the idea → get 9 blocks → critique and share.
  - **CTAs:** primary Sign up, secondary Sign in. Authenticated visitors can still land here; header already handles session.
- **Risk:** a live demo would couple the homepage to AI latency and keys; a static mock is enough to show the product and keeps `/` fast (3-second NFR). Copy must not claim PIN protection or idea-regenerate (not shipped).
- **Status:** done
- **Implementation brief:** Replace `Welcome.astro` usage on `index.astro` with a product landing using the existing cosmic layout and Topbar. Sections: hero + CTAs, 3-step how-it-works, static BMC grid, one-line "for first-time founders". No new routes. No live OpenRouter call.

### S-08: README update

- **Outcome:** a developer or stakeholder visiting the repository can read a README that accurately describes BMC AI Advisor — what it is, who it's for, how to set it up locally, and how to deploy it — replacing the current Astro starter template content.
- **Change ID:** readme-update
- **PRD refs:** FR-016
- **Prerequisites:** —
- **Parallel with:** S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Who is the primary README audience: developers contributing, investors viewing the repo, or the founder for self-reference? — Owner: user. Block: no (reasonable default: developer setup guide + project overview; tone and depth adjustable later).
- **Risk:** low-risk documentation task; no runtime impact. Main risk is misrepresenting the feature set — content must reflect implemented reality (e.g., PIN protection was deferred in S-04 and must not be described as shipped).
- **Status:** ready

### S-09: Agent hooks

- **Outcome:** (quality) after an agent writes or edits a source file, lint (and, for risk-area files, related tests) run automatically; a failing check returns to the agent instead of waiting for commit.
- **Change ID:** agent-hooks
- **PRD refs:** test-plan §4 (per-edit gate recommended; currently only husky + lint-staged at commit)
- **Prerequisites:** —
- **Parallel with:** S-05, S-07, S-08, S-10, S-11, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** a slow per-edit hook blocks every save. Keep the handler to ESLint on the touched file; scoped Vitest only on `src/lib/**` and `src/pages/api/**`. Full typecheck and full suite stay at commit/CI.
- **Status:** ready
- **Implementation brief:** Add `.cursor/hooks.json` with a `PostToolUse` matcher for `Write|Edit`. Shell handler: ESLint on `tool_input.file_path`; if the path is a risk area, `npx vitest related <file> --run`. Exit 2 on failure. Do not migrate husky to Lefthook.

### S-10: Architecture evidence

- **Outcome:** (quality) a reviewer can read a single architecture document that explains the running system, the test strategy, quality gates, share-link hardening, and the AI output contract — without reconstructing it from change folders.
- **Change ID:** architecture-evidence
- **PRD refs:** test-plan, lessons.md, infrastructure.md (existing artifacts to collate, not rewrite)
- **Prerequisites:** —
- **Parallel with:** S-05, S-07, S-08, S-09, S-11, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** a long essay hides the signal. Cap at one page. Link out to test-plan and impl-reviews rather than duplicating them.
- **Status:** ready
- **Implementation brief:** Create `context/foundation/architecture.md` with: system sketch; auth + RLS; AI fill/critique contract (strict JSON schema, 9 keys); test-plan phases 1–4 and the user-visible risks they cover; gates (eslint, vitest, husky, CI); share-link expiry and read-only enforcement. Cite files, do not paste code dumps.

### S-11: Archive completed changes

- **Outcome:** (quality) `context/changes/` contains only in-flight work; completed changes are archived so the project history is scannable.
- **Change ID:** archive-completed-changes
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** S-05, S-07, S-08, S-09, S-10, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** archiving a still-active folder (account-deletion) would lose the live plan. Leave that one in `context/changes/`.
- **Status:** ready
- **Implementation brief:** Move the implemented folders listed in the sprint table to `context/archive/2026-09-11-<change-id>/` (or today's date). Keep `account-deletion`. Do not rewrite plans while moving.

### S-12: CI/CD evidence

- **Outcome:** (quality) a reviewer can follow how every push and PR is linted, built, tested, and (on `main`) deployed, including which secrets the pipeline needs.
- **Change ID:** ci-cd-evidence
- **PRD refs:** infrastructure.md, `.github/workflows/ci.yml` (document existing pipeline; do not redesign it)
- **Prerequisites:** —
- **Parallel with:** S-05, S-07, S-08, S-09, S-10, S-11, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** adding jobs "for completeness" (e2e, security scan) during this sprint creates flake without new product value. Document what already runs.
- **Status:** ready
- **Implementation brief:** Write `context/foundation/ci-cd.md` mirroring the live workflow: checkout, Node 22, `npm ci`, `astro sync`, lint, build (Supabase secrets), write `.dev.vars` for miniflare, `npm test`, `wrangler deploy` on push. List required GitHub secrets. Screenshot or URL of a green run is optional evidence for the submission form.

### S-13: Dependabot

- **Outcome:** (quality) npm dependency updates arrive as pull requests so CI validates them before they land on `main`.
- **Change ID:** dependabot
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** S-05, S-07, S-08, S-09, S-10, S-11, S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** noisy daily PRs. Weekly cadence and grouping (production vs development, or a single npm group) keep the signal usable.
- **Status:** ready
- **Implementation brief:** Add `.github/dependabot.yml` for `package-ecosystem: npm`, directory `/`, interval `weekly`. Do not add a second CI workflow; existing PR CI is the gate.

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                              | Ready for `/10x-plan` | Notes                                                      |
| ---------- | ------------------------- | ------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------- |
| F-01       | canvas-schema             | Define canvas, blocks, and share-link schema with RLS              | —                     | Done — GitHub issue #1 closed                              |
| S-01       | canvas-dashboard          | Canvas list and delete — founder dashboard                         | —                     | Done — GitHub issue #2 closed                              |
| S-02       | s-02                      | AI-generated BMC fill, block edit, auto-save (original north star) | —                     | Done — GitHub issue #3 closed                              |
| S-03       | ai-critique               | AI block-level critique of canvas                                  | —                     | Done — GitHub issue #4 closed                              |
| S-04       | s-04                      | Read-only share link with expiry                                   | —                     | Done — GitHub issue #5 closed                              |
| S-05       | account-deletion          | Account deletion with cascade and confirmation                     | yes                   | Plan exists — finish UI + secret; in current sprint        |
| S-06       | edit-idea-regenerate      | Edit idea text and regenerate canvas (v2 north star)               | yes                   | Deferred this sprint                                       |
| S-07       | product-landing-page      | Product landing page for unauthenticated visitors                  | yes                   | Unblocked — static mock + copy recorded; in current sprint |
| S-08       | readme-update             | Replace Astro starter README with project-accurate content         | yes                   | After S-07 if time remains                                 |
| S-09       | agent-hooks               | Per-edit ESLint (and scoped tests) for agent file writes           | yes                   | Current sprint #1                                          |
| S-10       | architecture-evidence     | One-page architecture + quality-gate document                      | yes                   | Current sprint #3                                          |
| S-11       | archive-completed-changes | Archive done change folders                                        | yes                   | Current sprint #2                                          |
| S-12       | ci-cd-evidence            | Document existing GitHub Actions pipeline                          | yes                   | Current sprint #4                                          |
| S-13       | dependabot                | Weekly npm Dependabot PRs                                          | yes                   | Current sprint #5                                          |

## Open Roadmap Questions

1. **Jaka jest docelowa skala produktu?** (`target_scale.users`, `target_scale.qps`, `target_scale.data_volume`) — Owner: user. Block: roadmap-wide (non-blocking; sensible MVP defaults assumed for planning; resolving this tunes RLS policies, Supabase plan selection, and rate-limiting decisions). Source: PRD §Open Questions.

Resolved this revision:

- Landing lead copy and hero format (S-07) — static 9-block mock; copy recorded on the slice.
- Landing live-demo vs static vs animation (S-07) — static mock.

## Parked

- **Business plan / narrative generation** — Why parked: PRD §Non-Goals: "Full-journey flow (fill → critique → business plan) is explicitly v2. Reduces MVP scope to a shippable 3-week target."
- **Team workspaces / multi-user collaboration** — Why parked: PRD §Non-Goals: collaboration adds UX and data-model complexity before core value is proven.
- **Self-hosted / fine-tuned AI model** — Why parked: PRD §Non-Goals: model hosting is expensive and complex; two-backend env-var setup (OpenRouter / OpenAI) is sufficient for MVP.
- **Mobile-native app** — Why parked: PRD §Non-Goals: native app build/deploy pipelines out of scope for July 1st deadline.
- **FR-009: Single-block AI re-prompt** — Why parked: nice-to-have per PRD; adds chatbot-UX design complexity. Deferred for `speed` main goal. Worth revisiting after S-06 ships and usage patterns emerge.
- **PIN protection for share links** — Why parked: deferred from S-04; would add a `share_links.pin_hash` column and validation step. Worth revisiting if IP-sensitivity concerns arise from early users.

## Done

| ID   | Change ID            | Completed  | Notes                                                           |
| ---- | -------------------- | ---------- | --------------------------------------------------------------- |
| F-01 | canvas-schema        | 2026-06-07 | Canvas, share_links tables + RLS; GitHub issue #1               |
| S-01 | canvas-dashboard     | 2026-06-08 | Canvas list and delete, empty state, RLS; GitHub issue #2       |
| S-02 | s-02                 | 2026-06-11 | AI fill, block edit, auto-save; GitHub issue #3                 |
| S-03 | ai-critique          | 2026-06-13 | Block-level critique with gap classification; GitHub issue #4   |
| S-04 | s-04                 | 2026-06-14 | Read-only share link with expiry; PIN deferred; GitHub issue #5 |
| S-07 | product-landing-page | 2026-09-11 | Hero, feature cards, and CTAs; cosmic layout; responsive design |
