# CI/CD Evidence Implementation Plan

## Overview

Create `context/foundation/ci-cd.md` — a reference document that explains the GitHub Actions pipeline used for continuous integration and deployment. The document will detail each step of the workflow, the secrets it requires, and how reviewers can verify the pipeline is working correctly. This document serves dual purposes: proving the pipeline is real and complete (for submission review), and providing future developers with enough understanding to maintain or extend the pipeline.

## Current State Analysis

Your CI/CD pipeline is fully functional and production-ready:

- **Workflow file**: `.github/workflows/ci.yml` exists and runs on every push and PR to `main`
- **Pipeline steps**: checkout → Node 22 setup → npm ci → astro sync → lint → build → write test secrets → test → deploy
- **Deploy behavior**: `wrangler deploy` runs only on `push`, not on PRs
- **Secrets**: Five GitHub Secrets configured (`SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
- **Runtime**: Deploys to Cloudflare Workers via `wrangler`
- **Test runner**: Vitest, with Supabase bindings passed through `.dev.vars`

The pipeline is already documented implicitly in the YAML file, but not in prose form. Reviewers must read the workflow YAML directly to understand the sequence and purpose.

## Desired End State

After this plan is complete:

- **`context/foundation/ci-cd.md` exists** and is readable by someone unfamiliar with the YAML syntax
- **Document structure**: Overview → Trigger → Workflow steps (with "what" and "why") → Required secrets → Verification
- **Evidence included**: Link to or screenshot of a green workflow run (proof the pipeline is real)
- **Dual purpose satisfied**: Reviewers see proof of a complete pipeline; future developers can understand and modify it without reverse-engineering the YAML

## Key Discoveries

- The workflow already passes Supabase secrets through environment variables for the build step, then writes them to `.dev.vars` for miniflare in tests — this two-stage approach is a deliberate pattern, not a quirk
- Deploy step uses `if: github.event_name == 'push'` to prevent accidental deployments from PR CI runs — important safety constraint to highlight
- The `.dev.vars` file location `dist/server/.dev.vars` is specific to how Astro's Cloudflare adapter stages the Worker bundle — documenting this helps future maintainers understand why that path is used

## What We're NOT Doing

- **Not redesigning the pipeline**: Document what exists, don't suggest optimizations (e.g., adding Playwright, adding security scans, parallel jobs)
- **Not covering local setup**: Skip instructions on running `wrangler login`, setting `.dev.vars` locally, or manual `wrangler deploy` — those belong in a developer runbook, not a CI/CD pipeline explanation
- **Not documenting Supabase migrations**: The pipeline doesn't run migrations; that's a separate operational step
- **Not creating CI automation for this doc**: No hook to auto-regenerate the doc when the workflow changes — treat this as a snapshot with the note that drift is possible

## Implementation Approach

A straightforward two-phase approach:

1. **Draft the documentation** — Write prose sections mapping to each step of the workflow, explain the "why" briefly, list required secrets, and note where to verify success
2. **Verify and finalize** — Run the pipeline once more (or identify a recent green run), capture the screenshot/URL as proof, and review the doc for accuracy

The document will be formatted as Markdown and placed in the `context/foundation/` directory alongside similar architectural documents (`infrastructure.md`, `test-plan.md`).

## Phase 1: Write the CI/CD Documentation

### Overview

Create the main documentation file that readers will consult. The document should explain the pipeline in plain language, step by step, so someone unfamiliar with GitHub Actions YAML can follow the flow.

### Changes Required

#### 1. `context/foundation/ci-cd.md`

**File**: `context/foundation/ci-cd.md`

**Intent**: Create a new document explaining the GitHub Actions pipeline. Sections should cover: what triggers the workflow, each step in sequence (with command and purpose), required GitHub Secrets, and how to verify success. The document is both a proof of pipeline completeness and a reference for future modifications.

**Contract**: The file structure should follow:

- **Overview** — one paragraph explaining the pipeline
- **Trigger** — when the workflow runs (push/PR to `main`)
- **Workflow Steps** — each step from the YAML in execution order, with command and 1-2 sentence purpose
- **Required GitHub Secrets** — table of secret names, their purpose, and source
- **Verification** — how to view a successful run in GitHub Actions (with screenshot/URL reference)

No code snippets needed; the document references the YAML file path for readers who want the authoritative source.

### Success Criteria

#### Automated Verification

- File exists at `context/foundation/ci-cd.md`
- File is valid Markdown (no syntax errors)
- File contains all required sections: Overview, Trigger, Workflow Steps, Required Secrets, Verification
- All five GitHub Secrets are listed in the table

#### Manual Verification

- Documentation reads clearly and is understandable to someone unfamiliar with GitHub Actions
- Step-by-step sequence matches the actual workflow order in `.github/workflows/ci.yml`
- Purpose statements (the "why") are accurate and useful
- Cross-check: all commands mentioned exist in the actual workflow file
- Document is not longer than ~3 printed pages (avoid bloat)

**Implementation Note**: After writing the document, pause here. Verify the file exists and reads correctly before moving to Phase 2.

---

## Phase 2: Verify and Finalize

### Overview

Confirm the documentation is accurate against the live pipeline and capture evidence (screenshot or URL) of a successful workflow run.

### Changes Required

#### 1. Verification Against Live Workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Cross-check the documentation against the actual workflow file to ensure no steps are missing, misstated, or out of order. This is a human-review step, not a change to the file itself.

**Contract**: Line-by-line comparison:

- Each `- run:` or `- name: ... run:` step in the YAML appears in the documentation with its command accurate
- The `if:` condition on the deploy step (`if: github.event_name == 'push'`) is called out as an important safety measure
- Secret references (`${{ secrets.X }}`) are listed in the Secrets table

#### 2. Capture and Link a Green Workflow Run

**File**: `context/foundation/ci-cd.md` (update the Verification section)

**Intent**: Include a link to or screenshot of a recent successful workflow run, proving the pipeline exists and is functional.

**Contract**: Add to the Verification section:

- Link to a specific successful workflow run (e.g., `github.com/org/repo/actions/runs/12345`) — or
- Screenshot of the Actions page showing a green checkmark + all steps passing

If a screenshot is included, save it as `context/foundation/ci-cd-screenshot.png` and reference it in the Markdown as `![CI workflow success](./ci-cd-screenshot.png)`.

### Success Criteria

#### Automated Verification

- No changes to source files (`.github/workflows/ci.yml` remains unmodified)
- Documentation file still passes Markdown validation

#### Manual Verification

- Documentation is cross-checked line-by-line against the workflow YAML — no discrepancies
- A live workflow run is visible and shows all steps passing
- Screenshot/URL is present in the Verification section of the document
- Review for typos, clarity, and factual accuracy — especially around secret names and step order
- Document reads naturally and serves both reviewers and future developers equally

**Implementation Note**: After this phase completes and all verifications pass, the change is ready for submission.

---

## Testing Strategy

This is a documentation task, not code, so "testing" means verification and review rather than automated tests.

### Documentation Verification

- **Completeness**: All steps from the workflow YAML are mentioned in the documentation
- **Accuracy**: Command strings are exact matches to the YAML
- **Clarity**: Each step's purpose is stated in plain language, no jargon
- **Consistency**: Secret names match GitHub's repository settings exactly (case-sensitive)

### Cross-Reference Checks

- Verify the workflow trigger conditions (`push` and `pull_request` on `main`)
- Confirm the deploy step runs only on `push`, not `pull_request`
- Check that the miniflare `.dev.vars` path matches the actual Astro build output directory
- Ensure all secret references in the workflow are listed in the documentation

### Evidence Capture

- Link or screenshot of a successful workflow run (proves the pipeline is real)
- Ideally, a run that exercises all branches (at least one push to `main` and one PR run visible)

## References

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Infrastructure context: `context/foundation/infrastructure.md` (covers Cloudflare Workers deployment)
- Test plan: `context/foundation/test-plan.md` (covers testing strategy that CI runs)
- Related change: `S-10: architecture-evidence` (a sibling documentation artifact covering architecture overview)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Write the CI/CD Documentation

#### Automated

- [x] 1.1 File created at `context/foundation/ci-cd.md`
- [x] 1.2 Markdown syntax is valid (no parsing errors)
- [x] 1.3 All required sections present (Overview, Trigger, Workflow Steps, Required Secrets, Verification)

#### Manual

- [x] 1.4 Content reads clearly to someone unfamiliar with GitHub Actions
- [x] 1.5 Workflow steps match `.github/workflows/ci.yml` in order and command accuracy
- [x] 1.6 Purpose statements ("why") for each step are clear and useful
- [x] 1.7 Document is appropriately scoped (~3 pages max, not bloated)

### Phase 2: Verify and Finalize

#### Automated

- [ ] 2.1 Cross-check: all workflow steps documented, no omissions
- [ ] 2.2 Cross-check: all secrets from workflow appear in documentation table
- [ ] 2.3 Markdown still valid after updates

#### Manual

- [ ] 2.4 Verify deploy step condition (`if: github.event_name == 'push'`) is highlighted
- [ ] 2.5 Screenshot/URL of green workflow run is visible and captured
- [ ] 2.6 Evidence (screenshot/URL) is included in the Verification section
- [ ] 2.7 Final review: no typos, consistency across document, tone appropriate
