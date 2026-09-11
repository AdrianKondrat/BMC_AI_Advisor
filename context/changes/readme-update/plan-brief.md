# README Update — Plan Brief

> Full plan: `context/changes/readme-update/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-08)

## What & Why

Replace the generic Astro starter template README with a project-accurate description of BMC AI Advisor. Readers visiting the repo should understand what the product does, that it solves a specific problem for first-time founders, and how to set it up and deploy it. The current README obscures the product under generic scaffolding.

## Starting Point

The repository has a fully functional MVP: founders can input an idea, get an AI-generated 9-block Business Model Canvas with cross-block consistency critique, and share the canvas with read-only links. Account deletion and a new landing page are shipping this sprint. What's missing is a README that reflects this reality — the current one is the Astro starter template with no mention of the product.

## Desired End State

A README that opens with the problem (founders stare at 9 empty boxes with no guidance), explains the solution (structured, shareable AI canvas with block-level critique), lists the shipped features, covers local setup and deployment, and links to detailed architecture and quality documentation. Readers should be able to fork/deploy/contribute without confusion about what the product is.

## Key Decisions Made

| Decision                     | Choice                                                   | Why (1 sentence)                                                             | Source |
| ---------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Content structure            | Problem → solution → features → tech → setup → deploy    | Story-first approach makes product value clear before setup friction         | Plan   |
| Unshipped feature disclosure | Omit entirely                                            | Keeps README focused on shipped value; roadmap.md documents the full picture | Plan   |
| Setup detail level           | Comprehensive (troubleshooting included)                 | Devs hitting Docker/env issues need self-service solutions fast              | Plan   |
| Context doc links            | Comprehensive (roadmap, architecture, test-plan, prd)    | Reviewers need to find architecture evidence and quality gates               | Plan   |
| Sections order               | Vision/problem first, then features, tech, setup, deploy | Non-technical readers (founders, reviewers) need value prop first            | Plan   |

## Scope

**In scope:**

- Hero statement (problem + solution)
- Shipped features list (canvas fill, critique, sharing, account deletion)
- Tech stack overview
- Comprehensive local setup (npm, Supabase local/cloud, .dev.vars, troubleshooting)
- Production deployment (build, wrangler deploy, secrets)
- Links to roadmap, architecture, test-plan, prd

**Out of scope:**

- Marketing copy beyond the problem/solution statement
- Separate DEVELOPMENT.md or deep-dive guides (setup lives in README)
- Images or diagrams (static canvas mock already in `/public/`)
- Unshipped features (idea regeneration, PIN protection)
- Code or configuration changes

## Architecture / Approach

Single-phase content update: write the README top-to-bottom, source all facts from roadmap.md and existing context files, ensure consistency with shipped features (canvas-schema through account-deletion, per the roadmap §At a glance table). No research or architecture decisions needed — all directions are decided.

## Phases at a Glance

| Phase           | What it delivers                            | Key risk                                                                                     |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Write README | Complete, accurate, comprehensive README.md | Tone mismatch or setup instructions too terse if not grounded in real contributor experience |

**Prerequisites:** None — roadmap and context files are available
**Estimated effort:** ~1 session (1–2 hours: writing + link verification + manual prose review)

## Open Risks & Assumptions

- **Setup completeness**: Assuming current local setup (Docker, Supabase, .dev.vars) matches what's documented in existing README — if it's changed, troubleshooting steps may be wrong
- **Feature list accuracy**: Assuming the roadmap §At a glance table is the source of truth for what's shipped; any recent changes not yet reflected there could make the README stale

## Success Criteria (Summary)

- README is complete and renders without errors on GitHub
- Problem/solution opening is clear to a developer unfamiliar with BMC
- Feature list matches shipped state (no unshipped features mentioned)
- Setup instructions allow a new dev with Docker to run locally without external help
- All links to context/foundation files exist and work
