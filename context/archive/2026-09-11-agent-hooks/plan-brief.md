# Agent Hooks — Plan Brief

> Full plan: `context/changes/agent-hooks/plan.md`

## What & Why

Deliver roadmap slice S-09: after an agent edits a source file, the right checks run automatically and a failure is fed back — instead of only surfacing at commit or CI. ESLint/Prettier per-edit is already wired; this plan adds scoped test execution, split across two hook layers so nothing slow blocks the per-edit loop.

## Starting Point

`.claude/settings.json` already runs Prettier + ESLint on every `Write`/`Edit` (exit 2 on lint failure). `.husky/pre-commit` runs `lint-staged`, which only does ESLint/Prettier today — no tests run at any hook layer yet. Every test that covers the roadmap's named risk areas (`src/lib/**`, `src/pages/api/**`) lives in the `workerd` Vitest project, which needs `npm run build` first; only React component tests (`src/components/**`) run without a build.

## Desired End State

Editing a `src/components/**` file triggers its related fast unit test immediately, same severity as lint. Committing a change to `src/lib/**` or `src/pages/api/**` triggers one build + scoped integration test run before the commit lands. Everything else is unaffected and stays fast.

## Key Decisions Made

| Decision                                                     | Choice                                                   | Why (1 sentence)                                                                              | Source |
| ------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Where to run `src/lib/**`/`src/pages/api/**` tests           | Pre-commit (husky), not per-edit                         | Their only tests need a Cloudflare Workers build — too slow for the per-edit loop.            | Plan   |
| Whether to cover `src/components/**` in the hook             | Yes, add it even though the roadmap brief didn't name it | Highest-churn dir in the repo, and its tests are fast (jsdom, no build) — ideal per-edit fit. | Plan   |
| Pre-commit build failure handling                            | Block the commit, same as lint                           | Consistent failure semantics across every gate; no silent regressions slip through.           | Plan   |
| Per-edit component test failure handling                     | Block (exit 2), same as lint                             | Keeps the agent's self-correction signal consistent across all per-edit checks.               | Plan   |
| Hook tool assumption in roadmap brief (`.cursor/hooks.json`) | Extend `.claude/settings.json` instead                   | Repo is Claude Code-driven; a Claude Code hook already exists there.                          | Plan   |

## Scope

**In scope:**

- New `PostToolUse` step in `.claude/settings.json` for `src/components/**`
- New `scripts/test-staged-risk.sh` + a `lint-staged` entry in `package.json` for `src/lib/**`/`src/pages/api/**`

**Out of scope:**

- Migrating husky to Lefthook
- Adding a build step to the per-edit hook
- Running the full test suite at any new hook layer
- Changing `vitest.config.ts`, CI, or `test-plan.md`'s risk map/quality gates
- `.cursor/hooks.json`

## Architecture / Approach

Two-layer split: fast, buildless checks (component unit tests) run per-edit; checks that need a build (risk-area integration tests) run once per commit. Both layers reuse `vitest related` scoped to the touched/staged files — never the full suite — and both block (non-zero exit) on failure, matching the existing lint step's severity.

## Phases at a Glance

| Phase                                         | What it delivers                                                 | Key risk                                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1. Per-edit component test hook               | `src/components/**` edits run related unit tests immediately     | Vitest cold-start could occasionally exceed the 45s timeout                                             |
| 2. Pre-commit risk-area integration test gate | `src/lib/**`/`src/pages/api/**` commits run build + scoped tests | Local Supabase credentials must be present for real DB-touching tests to pass, same as `npm test` today |

**Prerequisites:** none — both phases only touch config/scripts in a repo that already has Vitest, husky, and lint-staged installed.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes `vitest related` correctly resolves module graphs for both the `unit` and `workerd` projects when given file paths in either absolute or repo-relative form — verified via the manual test steps in each phase.
- The pre-commit build cost adds real wall time to commits that touch `src/lib/**`/`src/pages/api/**` (not to other commits) — accepted tradeoff per the "Build failure" decision above.

## Success Criteria (Summary)

- An agent-introduced regression in a `src/components/**` file is caught and fed back within the same turn, before the agent moves on.
- An agent-introduced regression in `src/lib/**` or `src/pages/api/**` cannot be committed, even if it slipped past the per-edit lint hook.
- No unrelated edit or commit gets slower.
