# Agent Hooks Implementation Plan

## Overview

Deliver S-09 ("agent edits of source files are lint-checked immediately, with failing output fed back") by extending the two hook layers that already exist in this repo — the Claude Code `PostToolUse` hook and the husky pre-commit gate — rather than introducing a new tool. Lint/format is already wired per-edit; this plan adds scoped test execution at whichever layer can afford it.

## Current State Analysis

- `.claude/settings.json` already defines a `PostToolUse` hook (matcher `Write|Edit`) with two steps: Prettier `--write` on the edited file, then ESLint on `*.{ts,tsx,astro}` files, exiting `2` on lint failure so the agent sees the output. This is the lint half of S-09 — already shipped, not part of this plan.
- `.husky/pre-commit` runs `npx lint-staged`; `package.json`'s `lint-staged` config runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`. No tests currently run at any git-hook layer.
- `vitest.config.ts` defines two Vitest projects:
  - `workerd` — `tests/integration/**/*.test.ts`, uses `@cloudflare/vitest-pool-workers`, and requires `dist/server/wrangler.json` to exist (i.e., a prior `npm run build`).
  - `unit` — `tests/unit/**/*.test.{ts,tsx}`, jsdom environment, no build required.
- Every test file that exercises the roadmap's named risk areas (`src/lib/**`, `src/pages/api/**`) lives under `tests/integration/**` (the `workerd` project). `tests/unit/` only covers React components (`CanvasEditor.test.tsx`, `NewCanvasForm.test.tsx`), which exercise `src/components/**` — the single highest-churn directory in the repo (12 commits/30d per `test-plan.md` §1) but not named in the roadmap's S-09 brief.
- `astro.config.mjs`'s `env.schema` marks `SUPABASE_URL`/`SUPABASE_KEY`/etc. as `optional: true`, so `npm run build` succeeds without local secrets configured — it won't hard-fail a pre-commit gate purely for missing env vars.
- The roadmap's S-09 implementation brief (`context/foundation/roadmap.md`) says to add `.cursor/hooks.json`. This repo is driven by Claude Code, not Cursor — confirmed by the `.claude/settings.json` hook already in place — so that instruction is stale and is not followed literally.

### Key Discoveries:

- `.claude/settings.json:2-23` — existing `PostToolUse` hook array; new steps are appended here, not a new file.
- `vitest.config.ts:69-116` — `workerd` project needs `./dist/server/wrangler.json` (built output); `unit` project needs nothing but source.
- `package.json:57-64` — current `lint-staged` config; new risk-area entry is added alongside the existing two.
- `.github/workflows/ci.yml:18-20` — CI already does `npm run build` before `npm test`, confirming build-then-test is the established pattern for the `workerd` project; this plan reuses that ordering at pre-commit instead of inventing a new one.
- `context/foundation/test-plan.md` §5 (Quality Gates table) lists the post-edit ESLint hook as "already wired" and unit+integration tests as "required after Phase 1" without pinning a specific hook layer — this plan's pre-commit test gate satisfies that requirement without changing the table itself (out of scope per lesson boundaries).

## Desired End State

After this plan:

- Editing a file under `src/components/**` via Write/Edit triggers `vitest related <file> --run --project unit` in the same `PostToolUse` hook that already runs Prettier/ESLint; a failing related test exits `2` and the agent sees the failure text immediately, same severity as a lint error.
- Staging a commit that touches `src/lib/**` or `src/pages/api/**` triggers one `npm run build` followed by `vitest related <staged files> --run --project workerd` via `lint-staged`; a build or test failure blocks the commit, same as an ESLint failure does today.
- Editing or staging files outside these paths (e.g. `src/lib/utils.ts` at pre-edit, `README.md` at pre-commit) does not trigger any new build or test run — both new hook steps no-op fast when their path glob doesn't match.
- No existing hook step (lint, format) changes behavior.

**Verification**: run the manual steps in each phase below; confirm `git log` shows no changes to `test-plan.md`, `.github/workflows/ci.yml`, or `vitest.config.ts` (none of this plan's changes touch quality-gate definitions or CI).

## What We're NOT Doing

- Not migrating husky to Lefthook — husky already works (per CLAUDE.md Lesson 3 guidance: "If Husky already works, don't migrate").
- Not adding `npm run build` (or any test step) to the per-edit `PostToolUse` hook for `src/lib/**`/`src/pages/api/**` — the build cost makes that too slow for per-edit and would violate the "keep per-edit hooks fast" rule.
- Not running the full test suite (`npm test`) at any new hook layer — only `vitest related` scoped to the touched/staged files.
- Not adding new test files, changing `vitest.config.ts`, or changing CI (`.github/workflows/ci.yml`).
- Not changing `context/foundation/test-plan.md`'s risk map or quality-gate definitions — that's `/10x-test-plan`'s job, not this change.
- Not adding scoped testing for `src/pages/share/**` — no test currently targets that route directly (test-plan §6.3: the page route always returns 200 and is not an enforcement point; only the API route `src/pages/api/share/[token].ts` is tested, which is already covered by the `src/pages/api/**` glob).
- Not adding a `.cursor/hooks.json` — the roadmap brief's tool assumption is stale for this repo.

## Implementation Approach

Split the S-09 outcome across the two layers that can actually afford each check, per CLAUDE.md Lesson 3's own routing rule ("is it fast enough for per-edit, or should it wait for commit"):

- **Per-edit (fast, no build)**: scoped `unit`-project Vitest tests for `src/components/**`, the one risk-relevant area whose tests don't need a build.
- **Pre-commit (build is acceptable)**: scoped `workerd`-project Vitest tests (build + `vitest related`) for `src/lib/**` and `src/pages/api/**`, the areas the roadmap named but whose only tests require a build.

Both blocking behaviors mirror the existing ESLint step's severity (exit non-zero aborts), so the failure semantics stay consistent across every gate in the repo.

## Critical Implementation Details

**lint-staged batching**: the new pre-commit entry uses a single combined glob key, `"src/{lib,pages/api}/**/*.ts": "scripts/test-staged-risk.sh"`, rather than two separate glob keys both pointing at the script. lint-staged runs one task invocation per matched glob key; two keys mapping to the same script would trigger two separate `npm run build` runs in a single commit when both `src/lib` and `src/pages/api` files are staged together. The brace-expansion glob keeps it to one invocation, one build.

**Path matching in the per-edit hook**: `tool_input.file_path` may arrive as an absolute or repo-relative path depending on how the tool was invoked, unlike the existing lint step (which only checks the file extension, not directory). The new step's regex anchors on `(^|/)src/components/` so it matches either form: `jq -r '.tool_input.file_path // empty' | { read -r f || exit 0; [[ "$f" =~ (^|/)src/components/.*\.(ts|tsx)$ ]] || exit 0; npx vitest related "$f" --run --project unit || exit 2; }`.

## Phase 1: Per-edit component test hook

### Overview

Add a third `PostToolUse` step to the existing Claude Code hook so edits under `src/components/**` run their related fast jsdom unit tests immediately, mirroring the existing lint step's exit-2 blocking behavior.

### Changes Required:

#### 1. Extend the PostToolUse hook

**File**: `.claude/settings.json`

**Intent**: After the existing Prettier and ESLint steps, add a step that, only for `src/components/**/*.{ts,tsx}` edits, runs the file's related `unit`-project Vitest tests and exits `2` on failure so the failure text reaches the agent's context — the same self-correction path the lint step already provides.

**Contract**: Append a third object to `hooks.PostToolUse[0].hooks` (same array the Prettier/ESLint steps live in): `{ "type": "command", "command": "jq -r '.tool_input.file_path // empty' | { read -r f || exit 0; [[ \"$f\" =~ (^|/)src/components/.*\\.(ts|tsx)$ ]] || exit 0; npx vitest related \"$f\" --run --project unit || exit 2; }", "timeout": 45, "statusMessage": "Testing component..." }`. The 45s timeout (vs. the existing steps' 30s) accounts for Vitest's cold-start cost, which is heavier than a single ESLint invocation.

### Success Criteria:

#### Automated Verification:

- `.claude/settings.json` is valid JSON: `jq . .claude/settings.json`
- Running the new hook's command manually against an existing components test target succeeds: `npx vitest related src/components/NewCanvasForm.tsx --run --project unit`

#### Manual Verification:

- Use Claude Code's Edit tool to introduce a failing assertion into `src/components/NewCanvasForm.tsx` (or its test); confirm the hook blocks with exit 2 and the agent's next turn shows the Vitest failure output.
- Edit `src/lib/utils.ts` via the Edit tool; confirm the new step does not fire (no `vitest` process spawned, hook returns immediately) — only Prettier/ESLint run, as before.

---

## Phase 2: Pre-commit risk-area integration test gate

### Overview

Add a batching script and wire it into `lint-staged` so a commit touching `src/lib/**` or `src/pages/api/**` triggers one build and one scoped `workerd`-project Vitest run before the commit is allowed to land.

### Changes Required:

#### 1. Batching script

**File**: `scripts/test-staged-risk.sh` (new)

**Intent**: Receive the staged risk-area file paths as arguments, build the app once, then run `vitest related` against exactly those files — so pre-commit tests the actual regression surface without rebuilding once per matched glob or running the full suite.

**Contract**: Executable bash script; `chmod +x` after creation. Exits `0` immediately if invoked with zero arguments (defensive — lint-staged only calls it on a match, but this keeps the script safe to run standalone). Otherwise: `set -euo pipefail; npm run build; npx vitest related "$@" --run --project workerd`. Any non-zero exit from either command propagates and aborts the script, which lint-staged treats as a failed task and blocks the commit — same failure semantics as the existing `eslint --fix` entry.

#### 2. Wire the script into lint-staged

**File**: `package.json`

**Intent**: Add a third `lint-staged` entry so any staged file under `src/lib/**` or `src/pages/api/**` routes through the new script, without touching the two existing entries.

**Contract**: Add `"src/{lib,pages/api}/**/*.ts": "scripts/test-staged-risk.sh"` to the existing `lint-staged` object (alongside `"*.{ts,tsx,astro}"` and `"*.{json,css,md}"`).

### Success Criteria:

#### Automated Verification:

- `bash -n scripts/test-staged-risk.sh` (syntax check)
- `scripts/test-staged-risk.sh` is executable: `test -x scripts/test-staged-risk.sh`
- `npm run lint` still passes unaffected
- Staging a change to `src/lib/services/ai.ts` and running `npx lint-staged` locally triggers a build and a scoped `vitest related` run that passes on clean code

#### Manual Verification:

- Deliberately break the logic in `src/pages/api/canvases/index.ts`, stage it, and attempt `git commit`; confirm husky blocks the commit and the Vitest failure output is visible in the terminal.
- Revert the breakage, stage only `README.md`, and run `git commit`; confirm it completes quickly with no build or Vitest invocation triggered.

---

## Testing Strategy

### Unit Tests:

Not applicable — this plan configures existing hook/test infrastructure; it does not add new application code or new test files.

### Integration Tests:

Not applicable — same reason as above. The existing `tests/unit/**` and `tests/integration/**` suites are reused as-is by the new hook steps.

### Manual Testing Steps:

1. Trigger a failing `src/components/**` edit via Claude Code and confirm the per-edit hook blocks with the Vitest failure text visible to the agent (Phase 1 manual criterion 1).
2. Trigger a non-matching edit (`src/lib/utils.ts`) and confirm no test step fires per-edit (Phase 1 manual criterion 2).
3. Stage a breaking change under `src/pages/api/**` and confirm `git commit` is blocked by the pre-commit gate (Phase 2 manual criterion 1).
4. Stage an unrelated file and confirm `git commit` stays fast with no build triggered (Phase 2 manual criterion 2).

## Performance Considerations

The split exists specifically to keep the per-edit loop fast: `src/lib/**`/`src/pages/api/**` tests all require a Cloudflare Workers build (`npm run build`, non-trivial wall time), so they run once per commit instead of once per edit. `src/components/**` tests need no build and stay per-edit. Neither new step runs the full test suite — both scope to `vitest related` against the specific touched/staged files.

## Migration Notes

Not applicable — no data or schema changes; this plan only adds hook configuration and one new script file.

## References

- Roadmap: `context/foundation/roadmap.md` — S-09 "Agent hooks" (outcome, risk, implementation brief)
- Test plan: `context/foundation/test-plan.md` §1 (hot-spot dirs), §4 (stack, workerd vs unit projects), §5 (quality gates)
- Change identity: `context/changes/agent-hooks/change.md`
- Existing hook to extend: `.claude/settings.json:2-23`
- Existing pre-commit config to extend: `package.json:57-64` (lint-staged), `.husky/pre-commit`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Per-edit component test hook

#### Automated

- [x] 1.1 `.claude/settings.json` is valid JSON
- [x] 1.2 `npx vitest related src/components/NewCanvasForm.tsx --run --project unit` succeeds

#### Manual

- [x] 1.3 Failing component edit blocks the hook with exit 2 and visible Vitest output
- [x] 1.4 Non-matching edit (`src/lib/utils.ts`) does not trigger the new test step

### Phase 2: Pre-commit risk-area integration test gate

#### Automated

- [ ] 2.1 `bash -n scripts/test-staged-risk.sh` passes
- [ ] 2.2 `scripts/test-staged-risk.sh` is executable
- [ ] 2.3 `npm run lint` still passes
- [ ] 2.4 Staged `src/lib/services/ai.ts` change triggers a passing build + scoped `vitest related` run via `npx lint-staged`

#### Manual

- [ ] 2.5 Breaking change under `src/pages/api/**` blocks `git commit`
- [ ] 2.6 Unrelated staged file (`README.md`) commits fast with no build triggered
