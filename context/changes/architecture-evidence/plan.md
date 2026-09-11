# One-Page Architecture and Quality-Gate Document Implementation Plan

## Overview

Write `context/foundation/architecture.md`, a one-page synthesis that demonstrates engineering rigor to an evaluation committee by mapping the top failure risks to the specific gates and hardening decisions that protect them. The document opens with a system sketch, dives into the four highest-impact risks (AI output integrity, share-link expiry, share-link read-only, cross-user data isolation), shows which test phases and quality gates protect each risk, then closes with a brief architecture sketch and design patterns reference.

## Current State Analysis

**What exists:**

- `context/foundation/test-plan.md` — comprehensive risk map (7 risks ranked by impact×likelihood) and 4-phase test rollout (all phases complete as of 2026-09-11)
- `context/foundation/lessons.md` — two critical patterns: RLS mutation no-op workaround (explicit owner_id filter), and Supabase migration immutability
- `context/foundation/roadmap.md` — S-10 implementation brief with named sections to cover (layers, test phases, quality gates, share-link hardening, AI contract, impl-review trail, lessons)
- **Implementation trail**: all four test phases complete (`testing-infra-access-control`, `share-link-integrity`, `ai-service-contract`, `data-persistence-quality-gates` in `context/changes/` and ready to archive)
- **Quality gates wired**: ESLint + Prettier (pre-commit via husky + lint-staged), Vitest integration/unit tests in CI, CI workflow at `.github/workflows/ci.yml`

**What's missing:**

- A synthesized one-page document that connects risks → protective gates for evaluation. Current evidence is scattered across test-plan, lessons, and change folders.

### Key Discoveries:

- **Risk map is the narrative spine**: Test-plan §2 ranks risks by impact×likelihood (AI structure #1, share-link expiry #2, share-link read-only #3, IDOR #4). These four are the most credible proof that engineering quality was taken seriously.
- **Test phases are mapped 1:1 to risks**: Phase 1 covers IDOR (#4) + auth redirect (#7), Phase 2 covers expiry + read-only (#2, #3), Phase 3 covers AI structure (#1), Phase 4 covers silent data loss (#5). Citing phase completion is concrete evidence.
- **Quality gates are layered**: ESLint (local), tests (local + CI), Husky (pre-commit), CI/CD (on every push). Lessons.md codifies two escape-hatch bugs that tests alone wouldn't catch.
- **"Hardening" = specific protections**: Share-link expiry (404 on expired token in `GET /api/share/{token}`), read-only enforcement (401/403 on write without session), IDOR protection (explicit owner_id filter + RLS).

## Desired End State

A reader (admissions committee, tech reviewer) opens `context/foundation/architecture.md` and walks away knowing:

1. What the system does (Astro SSR + Supabase RLS + OpenRouter structured AI output)
2. The top four things that could go wrong (drawn from test-plan risks #1–4)
3. How each risk is guarded (which test phase proves it, which gate prevents it)
4. Where to look for proof (specific test file, lessons.md pattern, code change)
5. The critical design patterns that prevent silent failures (lessons.md rules applied)

The document is one page (~2000 characters, ~300 words), prose + file references only, no code snippets.

### Success Criteria:

After writing `context/foundation/architecture.md`:

- ✓ Document is one page (check character/line count)
- ✓ Covers all named sections from roadmap (layers, test phases, gates, hardening, contract, lessons)
- ✓ Risk-first structure: opens with failure scenarios, maps each to protective gates
- ✓ File/directory references are accurate (test files exist, paths resolve, lessons.md contains the cited rules)
- ✓ An evaluator can skim it in 2 minutes and understand the quality story
- ✓ Change status updated to `implemented` with completion commit

## What We're NOT Doing

- Rewriting test-plan, lessons, or roadmap — those are authoritative; this document links to them.
- Including code snippets or schema dumps (one page constraint + evaluation audience).
- Explaining every test detail — that's test-plan's job; we cite phases and summarize.
- Adding new lessons or patterns — only synthesizing what's already documented.
- Covering deferred/parked features (PIN, business-plan generation) — focus on what's built and proven.

## Implementation Approach

**Single phase with clear success criteria:**

1. Read and internalize test-plan §2 (risk map), roadmap S-10 (sections to cover), and lessons.md (patterns to reference)
2. Outline the document: System sketch (50 words) → Risks and Guards (1200 words targeting risks #1–4) → Quality Gates (300 words) → Appendix (brief architecture layer notes, 200 words) = ~1800 words ≈ 1 page
3. Draft prose-only (no code snippets), linking to test files and lessons.md
4. Verify all file paths exist and citations are accurate
5. Finalize and commit

**Tone:** Technical and direct; written for an evaluator who values concrete proof over rhetoric. Each paragraph should justify why this design choice protects the product (not just describe what the choice is).

## Phase 1: Write and Verify `context/foundation/architecture.md`

### Overview

Synthesize the top four risks from test-plan into one prose narrative showing how each risk is guarded, then append brief quality-gate overview and architecture reference.

### Changes Required:

#### 1. Create `context/foundation/architecture.md`

**File**: `context/foundation/architecture.md` (new)

**Intent**: Document the running system, top failure risks, and the specific test phases + quality gates that guard each risk. Written for an evaluation committee to assess engineering rigor.

**Contract**:

File must contain:

- **System Sketch** (50 words): Astro SSR on Cloudflare, Supabase for auth/data with RLS, OpenRouter for structured AI fill
- **Risk-to-Guard Mapping** (1200 words):
  - Risk #1 (AI structure): OpenRouter returns all 9 BMC block keys non-empty; guarded by test-plan Phase 3 fixture mocking + AI service contract in `tests/integration/ai-service-contract.test.ts`
  - Risk #2 (share-link expiry): Expired tokens return 404; guarded by test-plan Phase 2 in `tests/integration/share-link-integrity.test.ts`
  - Risk #3 (share-link read-only): Write endpoints reject unauthenticated share-token access; guarded by test-plan Phase 2, same suite
  - Risk #4 (IDOR): User B cannot access User A's canvas; guarded by test-plan Phase 1 + RLS policy + lessons.md pattern (explicit owner_id filter) in `tests/integration/access-control.test.ts`
- **Quality Gates** (300 words): ESLint (local + CI), Vitest (unit + integration in CI), Husky pre-commit, lessons.md two critical patterns
- **Appendix** (200 words): Brief notes on auth flow, RLS, structured output contract, data persistence patterns

One page total; prose + file references only (no code snippets).

### Success Criteria:

#### Automated Verification:

- Document exists at `context/foundation/architecture.md` ✓
- Word count ≤ 2000 (fits one page when printed) ✓
- All cited file paths exist (`tests/integration/*.test.ts`, `context/foundation/lessons.md`, `.github/workflows/ci.yml`, `src/lib/supabase.ts`) ✓
- Markdown lint passes: `npm run lint context/foundation/architecture.md` ✓

#### Manual Verification:

- Read the document end-to-end; verify each risk section is clear and evidence is credible
- Spot-check 3-4 cited file references by opening them (test file contains the assertion it claims, lessons.md contains the pattern)
- Review the risk-to-guard narrative flow; an evaluator can skim in 2 minutes and understand the story
- Confirm the tone is direct and evidence-based, not marketing language
- Verify no code snippets or schema dumps appear (constraint met)

**Implementation Note**: After writing the document, pause here for manual review. Ensure the narrative works, evidence is accurate, and it fits on one page. Adjust emphasis or trim sections as needed before committing.

---

## Testing Strategy

Manual verification is the key gate here:

- **Narrative quality**: Does it tell the story of "here are the worst things that could happen, here's how we prevent them"?
- **Evidence accuracy**: Do the test files and lessons.md actually contain what's cited?
- **Audience fit**: Would an evaluation committee find this credible and comprehensive?
- **Scope containment**: Does it fit one page without cutting critical sections?

No automated tests apply to documentation; static linting (markdown format) is the only automated gate.

## References

- **Test-plan risk map**: `context/foundation/test-plan.md` §2 (Risk Map) and §3 (Phased Rollout)
- **Implementation evidence**:
  - Phase 1: `context/changes/testing-infra-access-control/` (IDOR + auth redirect)
  - Phase 2: `context/changes/share-link-integrity/` (expiry + read-only)
  - Phase 3: `context/changes/ai-service-contract/` (structured output)
  - Phase 4: `context/changes/data-persistence-quality-gates/` (round-trip persistence)
- **Design patterns**: `context/foundation/lessons.md` (owner filter, migration immutability)
- **Roadmap brief**: `context/foundation/roadmap.md` S-10 (section requirements)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Write and Verify

#### Automated

- [x] 1.1 Document exists at `context/foundation/architecture.md`
- [x] 1.2 Markdown lint passes on the document
- [x] 1.3 All cited file paths exist and are accessible

#### Manual

- [ ] 1.4 Narrative flow is clear (risk-to-guard mapping tells a coherent story)
- [ ] 1.5 Evidence citations are spot-checked and accurate (test files contain claimed assertions)
- [ ] 1.6 Document fits one page when printed/exported
- [ ] 1.7 Tone is direct and evidence-based, appropriate for evaluation context
