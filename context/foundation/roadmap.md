---
project: "BMC AI Advisor"
version: 1
status: draft
created: 2026-06-04
updated: 2026-06-04
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: BMC AI Advisor

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

First-time founders stare at 9 empty BMC boxes with no guidance — they either guess or abandon the exercise. BMC AI Advisor closes the gap left by static templates and generic AI tools: it is a domain-aware AI that fills, critiques, and makes shareable a Business Model Canvas in one continuous session, with no external help needed.

The product's distinguishing trait — the one capability that, if removed, makes it indistinguishable from a generic AI prompt — is that the AI fills the canvas structured to the 9 named BMC blocks, with cross-block consistency critique built in. Generic tools return free-form text the founder must parse; this product returns a structured, editable, shareable canvas.

## North star

**S-02: AI wypełnia 9 bloków BMC z pomysłu założyciela** — the north star is the smallest end-to-end slice whose successful delivery proves the core product hypothesis: that AI-assisted structured BMC fill is more valuable than a blank template. All other slices are either prerequisite scaffolding for it or depth added on top of it.

> "The wow moment of seeing all 9 blocks filled instantly is the core proposition." — PRD FR-007

## At a glance

| ID   | Change ID            | Outcome (user can …)                                                                        | Prerequisites | PRD refs                              | Status   |
| ---- | -------------------- | ------------------------------------------------------------------------------------------- | ------------- | ------------------------------------- | -------- |
| F-01 | canvas-schema        | (foundation) canvas, blocks, and share-link tables in Supabase with RLS per-user isolation | —             | FR-001, FR-002, FR-003, FR-011        | ready    |
| S-01 | canvas-dashboard     | view list of saved canvases and delete any canvas                                           | F-01          | FR-004, FR-005, US-01                 | proposed |
| S-02 | ai-canvas-generation | input a plain-text idea, trigger AI fill of all 9 BMC blocks, edit any block, and see the canvas auto-saved | F-01, S-01    | FR-003, FR-006, FR-007, FR-008, US-01 | proposed |
| S-03 | ai-critique          | trigger AI critique of their canvas and see block-level feedback                            | S-02          | FR-010, US-02                         | proposed |
| S-04 | share-canvas         | generate a read-only share link with expiry/PIN and share it with anyone                    | S-02          | FR-011, FR-012, US-03                 | proposed |

## Baseline

What's already in place as of 2026-06-04 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + shadcn/ui; auth pages + dashboard shell at `src/pages/`
- **Backend / API:** partial — Astro SSR server present; only auth API routes implemented (`src/pages/api/auth/`); no business logic routes
- **Data:** absent — Supabase client wired (`src/lib/supabase.ts`), no migrations, no domain models
- **Auth:** present — Supabase auth with middleware (`src/middleware.ts`), signup/signin flows complete
- **Deploy / infra:** present — CI at `.github/workflows/ci.yml`; Cloudflare Workers via `wrangler.jsonc`
- **Observability:** absent — no logging library, error tracking, or metrics

## Foundations

### F-01: Canvas schema

- **Outcome:** (foundation) `canvases`, `canvas_blocks`, and `share_links` tables created in Supabase with RLS policies enforcing per-user isolation; auth identities wired to canvas ownership.
- **Change ID:** canvas-schema
- **PRD refs:** FR-001, FR-002 (auth UIDs used in RLS `owner_id` policies), FR-003 (canvas entity), FR-011 (share_links table)
- **Unlocks:** S-01 (list/delete queries), S-02 (canvas create + block writes), S-03 (critique read/write), S-04 (share_links read/write)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** every downstream slice depends on this schema; sequenced first. Main risk is picking the wrong block storage shape — JSONB column on `canvases` is simpler than a normalized `canvas_blocks` table and fits `speed` mode; defer normalization to a later change if needed.
- **Status:** ready

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
- **Status:** proposed

### S-02: AI-generated canvas

- **Outcome:** user can input a plain-text business idea, trigger AI fill of all 9 BMC blocks, see them populated instantly, edit any block individually, and find the canvas auto-saved and auto-named in their list.
- **Change ID:** ai-canvas-generation
- **PRD refs:** FR-003, FR-006, FR-007, FR-008, US-01, NFR (progress feedback — loader/streaming during AI call), NFR (data privacy — AI provider must not store idea content)
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which AI model to use for structured BMC output (OpenRouter multi-model gateway vs. OpenAI direct; GPT-4o-mini vs. larger model for JSON schema reliability) — Owner: user. Block: no (default to GPT-4o via OpenRouter; switch via `AI_PROVIDER` env var without code changes).
- **Risk:** most complex integration in the product — structured JSON output from AI, block-level persistence, and progress feedback all in one slice. AI latency will likely exceed 2 s; NFR requires visible progress during the wait — use streaming response or a loading indicator. If structured output is unreliable for a chosen model, switching models requires only an env-var change.
- **Status:** proposed

### S-03: AI critique

- **Outcome:** user can trigger an AI critique of their filled canvas and see block-level feedback classifying consistency gaps, completeness gaps, and investor-challenge assumptions — each tagged to a named BMC block.
- **Change ID:** ai-critique
- **PRD refs:** FR-010, US-02, NFR (progress feedback)
- **Prerequisites:** S-02
- **Parallel with:** S-04 (share-canvas)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** re-uses the AI integration scaffolded in S-02; main risk is prompt quality — critique prompt must enforce block-scoped output and evaluate at least one cross-block relationship (e.g., Value Proposition ↔ Customer Segment) to satisfy US-02 acceptance criteria. Free-form critique without block tags fails the acceptance test.
- **Status:** proposed

### S-04: Share canvas

- **Outcome:** user can generate a shareable read-only link for a canvas (with optional expiry or PIN), and anyone with the valid link can view the full canvas — including any critique run — without creating an account.
- **Change ID:** share-canvas
- **PRD refs:** FR-011, FR-012, US-03, NFR (3-second canvas render for share-link recipients)
- **Prerequisites:** S-02
- **Parallel with:** S-03 (ai-critique)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** public route requires deliberate auth bypass (read-only, no account); expiry and PIN must be enforced server-side; link must be strictly read-only (PRD Guardrail: "recipient must never be able to modify the founder's canvas"). Recipient performance NFR (3 s render) is naturally served by Cloudflare edge delivery.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID            | Suggested issue title                                      | Ready for `/10x-plan` | Notes                         |
| ---------- | -------------------- | ---------------------------------------------------------- | --------------------- | ----------------------------- |
| F-01       | canvas-schema        | Define canvas, blocks, and share-link schema with RLS      | yes                   | Run `/10x-plan canvas-schema` |
| S-01       | canvas-dashboard     | Canvas list and delete — founder dashboard                 | no                    | Needs F-01 done first         |
| S-02       | ai-canvas-generation | AI-generated BMC fill, block edit, auto-save (north star)  | no                    | Needs F-01, S-01 done first   |
| S-03       | ai-critique          | AI block-level critique of canvas                          | no                    | Needs S-02 done first         |
| S-04       | share-canvas         | Read-only share link with expiry/PIN                       | no                    | Needs S-02 done first         |

## Open Roadmap Questions

1. **Jaka jest docelowa skala produktu?** (`target_scale.users`, `target_scale.qps`, `target_scale.data_volume`) — Owner: user. Block: no (sensible MVP defaults assumed for planning; resolving this tunes RLS policies, Supabase plan selection, and rate-limiting decisions but does not block any slice). Source: PRD §Open Questions.

## Parked

- **Business plan / narrative generation** — Why parked: PRD §Non-Goals: "Full-journey flow (fill → critique → business plan) is explicitly v2. Reduces MVP scope to a shippable 3-week target."
- **Team workspaces / multi-user collaboration** — Why parked: PRD §Non-Goals: collaboration adds UX and data-model complexity before core value is proven.
- **Self-hosted / fine-tuned AI model** — Why parked: PRD §Non-Goals: model hosting is expensive and complex; two-backend env-var setup (OpenRouter / OpenAI) is sufficient for MVP.
- **Mobile-native app** — Why parked: PRD §Non-Goals: native app build/deploy pipelines out of scope for July 1st deadline.
- **FR-009: Single-block AI re-prompt** — Why parked: nice-to-have per PRD; adds chatbot-UX design complexity. Deferred for `speed` main goal. Worth adding as a stretch goal if S-02 lands early and time permits.

## Done

(Empty on first generation. `/10x-archive` appends here when a change whose Change ID matches a roadmap item is archived.)
