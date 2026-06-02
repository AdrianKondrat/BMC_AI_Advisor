---
project: "BMC AI Advisor"
context_type: greenfield
created: 2026-05-30
updated: 2026-05-30
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "primary persona"
      decision: "First-time founders — someone with a business idea but no structured business-model experience"
    - topic: "pain moment"
      decision: "All three stages — blank canvas paralysis, shallow/inconsistent fill, can't turn canvas into investor-ready plan"
    - topic: "status quo"
      decision: "Blank Miro/Notion templates + guesswork, generic ChatGPT prompting, MBA course exercises"
    - topic: "core insight"
      decision: "Existing tools are static — no AI critique loop that understands BMC block relationships or the investor lens"
    - topic: "auth model"
      decision: "Email/OAuth login — canvases saved to account; enables returning and sharing"
    - topic: "role model"
      decision: "Flat user model — every logged-in user has the same capabilities; sharing is view-only links, no viewer role in MVP"
    - topic: "MVP scope"
      decision: "Scoped down: fill + critique + share (business plan generation deferred to v2)"
    - topic: "timeline"
      decision: "3 weeks after-hours"
  frs_drafted: 12
  quality_check_status: accepted
---

## Vision & Problem Statement

First-time founders spend hours filling a Business Model Canvas with no guidance, producing shallow, internally inconsistent blocks they don't know how to critique or connect. The moment they want to share their idea with an investor or advisor, they face a second wall: the canvas is a grid of notes, not a coherent narrative.

The insight: existing BMC tools (Canvanizer, Strategyzer, plain templates) let you fill the canvas but provide no feedback loop. Generic AI tools (ChatGPT) can fill the canvas on demand but have no understanding of the relationships between blocks, no investor lens, and produce no shareable output. The gap is a domain-aware AI that fills, critiques, and translates — in one continuous flow.

## User & Persona

**Primary persona:** Alex — a first-time founder, 25–40, working on a side project or early-stage startup. Has an idea and some domain knowledge but no business-model training. Reaches for a BMC template because someone told them to, stares at 9 empty boxes, and either guesses or abandons it. If they do fill it, the result feels like a homework exercise, not a strategic document. When an advisor asks to see their business model, they send a screenshot of a half-filled grid.

## Access Control

Authenticated founders only. Sign-up and sign-in via email/password or OAuth (e.g., Google). Flat user model — every logged-in user has identical capabilities: create, edit, delete, and share canvases. Sharing is a view-only link anyone can open without an account. No viewer role, no admin role, no team workspaces in MVP. Unauthenticated users can view shared canvases but cannot create or edit.

## Success Criteria

### Primary
A first-time founder can: sign in, describe their business idea in plain text, receive an AI-generated Business Model Canvas with all 9 blocks filled, edit any block, receive an AI critique of the canvas's internal consistency, and share a read-only link — all within a single session. The product has worked when this flow completes without the user needing external help.

### Secondary
A founder can re-prompt the AI to rework a specific block after the initial fill (iterative single-block refinement). This adds a conversational improvement loop without requiring a full redesign of the output.

### Guardrails
- Shared canvas is permanently read-only for recipients — a recipient must never be able to modify the founder's canvas.
- AI output is always structured to the 9 named BMC blocks — never returned as free-form text the founder must parse into blocks.
- A founder's idea input and canvas content must never appear in any other user's session or canvas.
- A logged-in founder's canvas edits persist across refresh and session close — no silent data loss.

## Functional Requirements

### Authentication
- FR-001: Founder can sign up with email/password or OAuth. Priority: must-have
  > Socrates: Counter-argument considered: "Auth adds friction that kills early testing." Resolution: kept; auth is required to support the sharing use case — without an account, there's no stable identity to attach a canvas to.
- FR-002: Founder can sign in to access their canvases. Priority: must-have
  > Socrates: Same resolution as FR-001 — auth is foundational for sharing. Stands as written.

### Canvas Management
- FR-003: Founder can create a new canvas, auto-named from the idea text (and rename it afterward). Priority: must-have
  > Socrates: Counter-argument considered: "Forcing naming at creation adds friction." Resolution: modified — canvas is auto-named from the first words of the idea input; founder can rename later. Reduces friction without removing naming.
- FR-004: Founder can view a list of their saved canvases. Priority: must-have
  > Socrates: No counter-argument surfaced. Stands as written.
- FR-005: Founder can delete a canvas. Priority: must-have
  > Socrates: Counter-argument considered: "Soft-delete safer for v1." Resolution: kept as hard delete; delete is standard expected UX and deferring it is paternalistic.

### AI Canvas Generation
- FR-006: Founder can input a plain-text description of their business idea. Priority: must-have
  > Socrates: No counter-argument surfaced beyond FR-007. Stands as written.
- FR-007: Founder can trigger AI to fill all 9 BMC blocks from their idea input. Priority: must-have
  > Socrates: Counter-argument considered: "One-shot fill produces low-quality blocks for vague ideas — guided interview better." Resolution: kept; one-shot fill is the hook. The wow moment of seeing all 9 blocks filled instantly is the core proposition. Interview mode can be v2.
- FR-008: Founder can edit the content of any individual BMC block. Priority: must-have
  > Socrates: Counter-argument considered: "Free-form editing breaks AI consistency assumptions." Resolution: kept; no tool that doesn't let you edit its output will be trusted. Versioned edit tracking is a v2 concern.
- FR-009: Founder can re-prompt AI to refine a specific block. Priority: nice-to-have
  > Socrates: Counter-argument considered: "Single-block re-prompt bleeds into chatbot UX with more design complexity than it looks." Resolution: kept as nice-to-have; iterative refinement is the product's long-term moat and shipping it in v1 (even optionally) gives early usage data.

### AI Critique
- FR-010: Founder can trigger an AI critique of the full canvas. Priority: must-have
  > Socrates: Counter-argument considered: "Critique without industry context is generic." Resolution: kept; even generic cross-block consistency critique is more useful than nothing and is the core differentiator over static tools. Industry context is v2.

### Sharing
- FR-011: Founder can generate a shareable read-only link for a canvas, with an expiry option or PIN. Priority: must-have
  > Socrates: Counter-argument considered: "Bare permanent links are a founder IP risk — unannounced startup ideas on a never-expiring public link." Resolution: modified — share link must include an expiry option (e.g., 30 days) or PIN at minimum. Permanent links without access control are a privacy liability.
- FR-012: Anyone with the valid link (and PIN if set) can view the canvas without an account. Priority: must-have
  > Socrates: No counter-argument surfaced. Stands as written (updated to reflect FR-011 PIN modification).

## Business Logic

The application evaluates a Business Model Canvas for internal block consistency, quality completeness, and investor-lens assumptions — and surfaces the gaps as structured, block-scoped critique.

The rule operates on two inputs the founder provides: their plain-text business idea (used to generate the canvas) and the 9 filled BMC blocks (used for critique). The output is structured critique: each identified gap or weakness is tagged to the specific block it belongs to, classified by type (consistency gap, completeness gap, or investor-challenge assumption), and accompanied by a one-sentence explanation. The founder encounters the critique after the canvas is filled, as an optional second step — they choose when to run it and can edit any block before or after.

The same evaluation logic applies whether the canvas was AI-generated or manually edited by the founder.

## Non-Functional Requirements

- A founder sees visible progress feedback during any AI operation (canvas fill or critique) that takes longer than two seconds; the wait does not produce a blank screen.
- A founder's business idea text and canvas content are not retained in operator-accessible storage after the session ends, and are not used as training data.
- A recipient opening a share link sees the full canvas render within three seconds on a standard broadband connection.
- The product is fully usable on the latest two major versions of the four mainstream desktop browsers (Chrome, Firefox, Safari, Edge).

## User Stories

### US-01: Founder generates and shares a Business Model Canvas from an idea

- **Given** a signed-in founder with no existing canvas
- **When** they type a plain-text description of their business idea and trigger AI fill
- **Then** they see all 9 BMC blocks populated with relevant, structured content

#### Acceptance Criteria
- All 9 blocks contain non-empty, idea-specific content (not generic placeholders)
- Each block is independently editable after generation
- The canvas is auto-saved and visible in the founder's canvas list

### US-02: Founder receives and acts on an AI critique

- **Given** a founder with a filled canvas (AI-generated or manually edited)
- **When** they trigger the AI critique
- **Then** they receive block-level feedback identifying gaps, inconsistencies, or weak points

#### Acceptance Criteria
- Critique is scoped to named BMC blocks, not free-form paragraphs
- At least one cross-block relationship is evaluated (e.g., Value Proposition ↔ Customer Segment alignment)
- Founder can still edit blocks after reading the critique

### US-03: Founder shares canvas with an investor

- **Given** a founder with a completed canvas
- **When** they generate a share link (with optional expiry or PIN)
- **Then** the recipient can view the full canvas in read-only mode without creating an account

#### Acceptance Criteria
- Shared view shows all 9 blocks and any critique that was run
- Recipient cannot edit any block
- Link respects the expiry/PIN settings the founder chose

## Timeline Budget
- mvp_weeks: 3
- after_hours_only: true
- hard_deadline: 2026-07-01

## Non-Goals
- **No business plan / narrative generation in v1.** Scoped down in Phase 3. Full-journey flow (fill → critique → business plan) is explicitly v2. Reason: reduces MVP scope to a shippable 3-week target.
- **No team workspaces or multi-user collaboration.** Flat single-user model only. No shared editing, no comment threads, no org accounts. Reason: collaboration features add significant UX and data-model complexity before the core value is proven.
- **No self-hosted or fine-tuned AI model.** AI calls use an OpenAI-compatible SDK pointed at either **OpenRouter** (`openrouter.ai/api/v1`) or **OpenAI directly** (`api.openai.com/v1`), selected via `AI_PROVIDER` env var. No code changes needed to switch providers. No custom model training, no hosted inference. Reason: model hosting is expensive and complex; the two-backend setup enables model flexibility while keeping the integration surface minimal.
- **No mobile-native app.** Web app only. A responsive layout may work on mobile browsers but there is no dedicated iOS or Android build. Reason: native apps require separate build/deploy pipelines and are out of scope for the July 1st deadline.
