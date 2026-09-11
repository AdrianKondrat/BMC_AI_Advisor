# README Update Implementation Plan

## Overview

Replace the generic Astro starter template README with a project-accurate document that describes BMC AI Advisor — what it is, who it's for, the features shipped, and how to set it up and deploy it. The new README will follow a story-first structure (problem → solution → tech → setup → deploy) and link readers to key architectural and quality documentation.

## Current State Analysis

- **Current README**: Generic Astro starter template with placeholder content, incorrect GitHub repo references, and no mention of the actual product
- **Shipped features**: Canvas AI fill, block-level critique, shareable read-only links, account deletion (all documented in roadmap.md §At a glance)
- **Unshipped features**: Idea regeneration, PIN protection (explicitly parked in roadmap.md § Parked; to be omitted from README per user decision)
- **Existing source material**: Roadmap §Vision recap, §At a glance table, §Baseline (system state), deployment guide, architecture decisions
- **Context docs available**: `context/foundation/roadmap.md`, `context/foundation/prd.md`, architecture.md (in progress), test-plan.md, deploy docs

## Desired End State

A README that:

- Opens with the founder problem and product solution (structured, shareable canvas + critique vs. generic AI tools)
- Lists shipped features clearly, with no mention of unshipped work
- Covers the full tech stack (Astro, React, Supabase, Cloudflare Workers)
- Includes comprehensive local setup (Node version, npm, Supabase local/cloud steps, .env/.dev.vars, troubleshooting)
- Includes production deployment steps (build, wrangler deploy, secrets)
- Links to context/foundation docs for vision, roadmap, architecture evidence, and test strategy
- Reflects the reality of the codebase as of 2026-09-11 (MVP features complete, quality gates in place)

## What We're NOT Doing

- Adding marketing copy beyond a clear problem/solution statement
- Writing a DEVELOPMENT.md or separate setup guide — this lives in the README per user decision
- Inventing new product features or commitments
- Changing any code or configuration files
- Adding images or diagrams (static 9-block canvas mock is already in the repo under `/public/`)

## Implementation Approach

Single phase: write the README top-to-bottom following the user-confirmed structure (Vision → Features → Tech Stack → Local Setup → Deploy → Context Docs), grounded in the roadmap and existing documentation. No research or architecture work needed — all decisions are made.

## Phase 1: Write the Complete README

### Overview

Write a comprehensive, accurate README that replaces the current starter template. Content is sourced from roadmap.md (vision, feature status, product description) and context files (setup, deploy, architecture).

### Changes Required

#### 1. README.md (root)

**File**: `README.md`

**Intent**: Replace the generic starter template with a project-specific README that explains what BMC AI Advisor is, what's shipped, and how to use the codebase.

**Contract**: The README will contain these sections in order:

- Hero: title + tagline + 1-2 sentence problem/solution statement (from roadmap §Vision recap)
- What it does: bullet list of shipped features (canvas fill, critique, sharing, account deletion)
- Tech stack: list + brief description (Astro 6 SSR, React 19, TypeScript, Tailwind 4, Supabase auth, Cloudflare Workers)
- Prerequisites: Node v22.14.0 (from .nvmrc)
- Getting Started: quick steps (npm install, env setup, npm run dev)
- Local Setup — Supabase: both local (Docker-based, full instructions from current README) and cloud (instructions from current README), with troubleshooting
- Local Setup — Cloudflare: .dev.vars setup (from CLAUDE.md)
- Available Scripts: npm run commands from CLAUDE.md
- Project Structure: brief tree of key folders (src/, public/, wrangler.jsonc)
- Deployment: build + wrangler deploy, secrets via wrangler secret put, CI on push
- AI Provider Setup: Anthropic API key (or OpenRouter env var) for local development
- Context & Quality Docs: links to roadmap.md (feature status), architecture.md (system design), test-plan.md (quality gates), prd.md (requirements), deploy-plan.md (if present)
- License: MIT

No code snippets needed — structure is clear from existing docs, and setup steps follow standard patterns already established in the current README.

### Success Criteria

#### Automated Verification

- `npm run lint` passes (no ESLint or formatting errors in the markdown)
- No broken links in the context/foundation/ folder (manual check: all linked files exist)
- Markdown is valid (renders without errors on GitHub)

#### Manual Verification

- Content reads naturally end-to-end without jargon leaks
- Problem/solution opening is clear to someone unfamiliar with BMC or the startup context
- Feature list matches what the roadmap lists as "done" (canvas-schema F-01 through share-link S-04)
- Unshipped features are not mentioned (idea-regenerate, PIN protection are absent)
- Setup instructions are complete enough that a developer with Docker can run locally without external help
- Deployment instructions match the current CI/CD pipeline (build, test, wrangler deploy on main)
- All links to context/foundation files work and point to the right sections
- Tone is welcoming to both first-time contributors and seasoned developers
- No reference to removed/renamed files (e.g., no mention of the old Welcome.astro that's being replaced with landing page)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Write the Complete README

#### Automated

- [x] 1.1 Write README.md with all sections
- [x] 1.2 `npm run lint` passes (Prettier + ESLint on markdown)

#### Manual

- [x] 1.3 Problem/solution opening is clear and compelling
- [x] 1.4 Feature list reflects shipped features only (no unshipped work mentioned)
- [x] 1.5 Local setup instructions are comprehensive and tested against current codebase
- [x] 1.6 Deploy instructions match CI/CD reality
- [x] 1.7 All links to context/foundation files work and point to the right sections
- [x] 1.8 Tone is welcoming and professional (no jargon, clear for both devs and founders)
