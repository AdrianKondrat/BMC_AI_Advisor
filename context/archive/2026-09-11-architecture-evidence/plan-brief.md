# One-Page Architecture and Quality-Gate Document — Plan Brief

> Full plan: `context/changes/architecture-evidence/plan.md`

## What & Why

Write a one-page synthesis of the running system, the top four failure risks, and the specific test phases and quality gates that guard each risk. This document is for an evaluation committee to assess engineering quality — it bridges the gap between a long test-plan and scattered change folders by showing how design choices protect the product's core guarantees (structured AI output, data isolation, share-link expiry, read-only enforcement).

## Starting Point

The product is built and tested: all four test phases are complete (`testing-infra-access-control`, `share-link-integrity`, `ai-service-contract`, `data-persistence-quality-gates`), quality gates are wired (ESLint, Vitest, Husky pre-commit, CI/CD), and design patterns are documented (lessons.md). What's missing is a synthesized one-page story showing how these pieces together prevent the worst failures.

## Desired End State

An evaluator reads one page and walks away knowing:

1. The system stack (Astro SSR, Supabase RLS, OpenRouter structured fill)
2. The four highest-impact risks (AI integrity, share-link expiry, share-link read-only, IDOR)
3. How each risk is guarded (which test phase proves it, which gate prevents it, where to look for evidence)
4. The critical patterns that prevent silent failures (explicit owner_id filter, migration immutability)

## Key Decisions Made

| Decision            | Choice                                     | Why (1 sentence)                                                         | Source       |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | ------------ |
| Narrative structure | Risks-first (what goes wrong → guards)     | Tells the story an evaluator cares about most: "Can this silently fail?" | Questioning  |
| Audience framing    | Admissions/evaluation committee            | Emphasis on proof of rigor over implementation detail                    | Questioning  |
| Evidence style      | Prose + file references, no code           | One page + evaluation context doesn't require snippets                   | Questioning  |
| Hardening scope     | Expiry + read-only (tests #2, #3 only)     | Laser focus on the provable protections, not deferred features           | Questioning  |
| Sections covered    | System sketch + 4 risks + gates + appendix | Breadth (all sections named) + depth (highest-risk areas expanded)       | Roadmap S-10 |

## Scope

**In scope:**

- System sketch (Astro SSR, Supabase RLS, OpenRouter)
- Four highest-impact risks mapped to test phases and gates (AI structure #1, share-link expiry #2, read-only #3, IDOR #4)
- Quality gates overview (ESLint, Vitest, Husky, CI)
- Design patterns reference (explicit owner_id filter, migration immutability)
- File and directory references for evidence drill-down

**Out of scope:**

- Code snippets (one-page constraint + evaluation audience)
- Rewriting test-plan, lessons, or roadmap
- Covering deferred features (PIN protection, business-plan generation)
- Performance benchmarks or scale analysis
- Playwright e2e or other future test phases

## Architecture / Approach

The document follows a narrative arc:

1. **System Sketch** (50 words) — what we built
2. **Risk-to-Guard Mapping** (1200 words) — why it's hard to break, with evidence
   - Each of the 4 top risks gets 300 words: the failure scenario, why it matters, which test phase proves protection, where to verify
3. **Quality Gates** (300 words) — how we keep it safe (ESLint, tests, Husky, CI, patterns)
4. **Appendix** (200 words) — architecture layer notes for deeper dive

**Key principle**: Every paragraph justifies a design choice by showing how it prevents a failure or satisfies a guardrail from the PRD.

## Phases at a Glance

| Phase     | What it delivers                                    | Key risk                                                  |
| --------- | --------------------------------------------------- | --------------------------------------------------------- |
| 1. Draft  | First complete version with risk mapping            | Narrative may be unclear or evidence citations inaccurate |
| 2. Verify | Accurate file paths, credible evidence, proper tone | Document doesn't fit one page; cuts critical sections     |

**Prerequisites:** Test-plan complete (done), all four test phases landed (done), lessons.md finalized (done)
**Estimated effort:** ~1 session (2-3 hours to draft, review citations, verify page fit, finalize)

## Open Risks & Assumptions

- **Page fit**: The document must not exceed ~2000 characters/300 words per risk. If evidence trails expand, we may need to cut architecture appendix or lessons section.
- **Evidence accuracy**: All cited test files and patterns must still be where they're documented (test files in `tests/integration/`, patterns in `lessons.md`). If files have moved since test phases landed, citations will be stale.
- **Evaluator familiarity**: We assume the evaluator has read or can quickly access the test-plan for context. If not, the narrative may feel too terse.

## Success Criteria (Summary)

- Document is one page when printed (~2000 characters, ~300 words) ✓
- Risk-to-guard narrative is clear and evidence is credible ✓
- All file paths cited in the document exist and are accurate ✓
- An evaluator can skim in 2 minutes and understand the engineering quality story ✓
