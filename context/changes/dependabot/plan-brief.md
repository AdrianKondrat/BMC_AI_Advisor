# Add weekly npm Dependabot PRs — Plan Brief

> Full plan: `context/changes/dependabot/plan.md`
> Roadmap reference: `context/foundation/roadmap.md` (S-13)

## What & Why

Enable GitHub Dependabot to automatically create weekly pull requests for npm dependency updates. Currently, dependencies update silently (manual updates or CI tools); this brings updates into the review pipeline so CI validates every change before it lands on `main`. Dependencies stay current, security patches are visible, and updates are gated by the existing CI validation.

## Starting Point

The project has:

- npm dependencies in `package.json` (manually managed)
- A CI workflow (`ci.yml`) that runs lint → build → test on every push and PR
- No Dependabot configuration yet
- Clean slate: no existing dependency-update PRs to manage

## Desired End State

Dependabot creates one grouped PR every Monday containing all npm updates (patch + minor + major). The PR automatically validates through CI. Development dependencies (eslint, prettier, vitest, @types, @testing-library) auto-merge when CI passes; production dependencies require manual review. Security alerts are enabled in GitHub settings to proactively surface CVEs.

## Key Decisions Made

| Decision                       | Choice                                  | Why (1 sentence)                                                                                     | Source |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| Grouping strategy              | Single grouped PR per week              | Keeps inbox noise to one PR/week while surfacing all updates in one review, matching roadmap intent. | Plan   |
| Auto-merge scope               | Patch + minor for dev dependencies only | Dev tooling churn is routine; prod updates always get human review for safety.                       | Plan   |
| Update schedule                | Weekly (Monday)                         | Balances staying current with avoiding update fatigue — matches the roadmap "weekly, grouped" spec.  | Plan   |
| GitHub Dependabot alerts       | Enable                                  | Low-cost security visibility: proactively surface CVEs independent of scheduled update PRs.          | Plan   |
| Existing dependency-update PRs | None to manage                          | Clean slate — no conflicts or duplicate work.                                                        | Plan   |

## Scope

**In scope:**

- Add `.github/dependabot.yml` with npm ecosystem config
- Configure weekly schedule, grouping, and auto-merge rules
- Enable GitHub Dependabot security alerts (optional)
- Verify first Dependabot PR arrives and CI validates it

**Out of scope:**

- Auto-merge for production dependencies (always require manual review)
- Separate dev/prod PRs (single grouped PR to minimize noise)
- Branch protection rule changes (use existing CI as gate)
- Package allow/deny lists (trust semver discipline)

## Architecture / Approach

Dependabot runs on GitHub's infrastructure (no local setup needed). Configuration is declarative: a single `.github/dependabot.yml` file tells GitHub which package manager to watch, how often to check, and how to group/merge updates. The existing CI workflow automatically validates every Dependabot PR — no changes to CI needed.

```
GitHub detects npm updates
      ↓
Dependabot groups them (weekly, all updates in 1 PR)
      ↓
PR created + CI triggered (lint, build, test)
      ↓
Dev dependencies auto-merge if CI passes
      ↓
Prod dependencies wait for manual review
```

## Phases at a Glance

| Phase     | What it delivers                                          | Key risk                                   |
| --------- | --------------------------------------------------------- | ------------------------------------------ |
| 1. Config | `.github/dependabot.yml` created and pushed to `main`     | Config syntax error; GitHub rejects it.    |
| 2. Verify | First Dependabot PR arrives; CI passes; grouping verified | First PR takes 24–48 hours; patience test. |

**Prerequisites:** None — this is a standalone config file.
**Estimated effort:** ~15 minutes to write and push config + 1–2 days to see the first PR and verify it works.

## Open Risks & Assumptions

- **Timing**: First Dependabot PR may take 24–48 hours to appear; GitHub's processing schedule is not instant.
- **Auto-merge confidence**: Auto-merge requires dev-dependency pattern matching to work correctly. If patterns don't match expected package names, dev updates may require manual merge. Monitored in Phase 2.
- **Semver trust**: Auto-merge patch + minor assumes packages follow semantic versioning discipline. A mistagged breaking change could ship unreviewed (mitigated by CI validation catching most breaks).

## Success Criteria (Summary)

- `.github/dependabot.yml` is merged to `main`
- First Dependabot PR appears within 48 hours with all updates grouped
- CI passes on the first PR (lint, build, test all green)
- GitHub Dependabot alerts are enabled in repository settings
