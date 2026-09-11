# Add weekly npm Dependabot PRs

## Overview

Enable GitHub Dependabot to automatically create weekly pull requests for npm dependency updates, bringing updates into the CI validation pipeline instead of allowing silent dependency drift. All updates will be grouped into a single weekly PR to minimize inbox noise while keeping the review surface manageable.

## Current State Analysis

- npm dependencies managed in `package.json` (currently managed manually)
- CI pipeline in `.github/workflows/ci.yml` runs lint → build → test → deploy on every push and PR
- No Dependabot configuration currently present
- GitHub Dependabot alerts are available but not yet enabled

### Key Discoveries:

- CI already validates all PRs (lint, build, test pass required before merge), so Dependabot PRs will be automatically gated
- The project uses npm with Node 22 (pinned in `.nvmrc`)
- No existing dependency-update PRs to clean up
- Weekly cadence from roadmap aligns with keeping the notification burden reasonable

## Desired End State

Dependabot is configured to:

- Check for npm updates every Monday (or on a regular weekly schedule)
- Group all updates into a single PR per week
- Auto-merge patch + minor updates for dev dependencies (eslint, prettier, vitest, etc.) when CI passes
- Require manual review for production dependency updates and major version bumps
- GitHub Dependabot alerts are enabled for security advisories

A reviewer can see all pending updates in one place (a single weekly PR), and the CI pipeline validates the changes automatically.

## What We're NOT Doing

- Auto-merging production dependency updates — safety requirement for first-party code
- Creating separate dev/prod PRs — single grouped PR keeps noise down
- Enabling branch protection rule changes — will use existing CI validation as the gate
- Configuring allow/deny lists for specific packages — trust semver discipline for now

## Implementation Approach

1. Create `.github/dependabot.yml` with the npm ecosystem, weekly schedule, and grouping strategy
2. Configure auto-merge rules for dev-only dependencies via GitHub branch protection (if not already configured)
3. Verify the first Dependabot PR arrives and CI validates it
4. Optionally enable GitHub Dependabot alerts in the repository settings

---

## Phase 1: Create `.github/dependabot.yml`

### Overview

Add the Dependabot configuration file to enable automated npm update detection and PR creation with the decided grouping and auto-merge strategy.

### Changes Required:

#### 1. GitHub Dependabot configuration

**File**: `.github/dependabot.yml`

**Intent**: Create a new Dependabot configuration that tells GitHub to check npm for updates every week, bundle all updates into a single PR, and set up auto-merge rules for development dependencies (patterns like eslint-_, prettier, vitest, @types/_, @testing-library/\*).

**Contract**: A `dependabot.yml` file with:

- `version: 2` (YAML version)
- `updates:` array with one entry for npm
- `package-ecosystem: npm`
- `directory: /` (root of the repo)
- `schedule.interval: weekly` (check every Monday by default)
- `groups:` configuration to bundle all updates into one PR
- `allow:` / `deny-patterns:` to auto-merge only dev dependencies

**Reference configuration:**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
    groups:
      development:
        dependency-type: "dev"
        patterns:
          - "@eslint*"
          - "@types/*"
          - "@testing-library/*"
          - "prettier*"
          - "vitest*"
          - "typescript*"
      all-updates:
        patterns: ["*"]
    auto-merge:
      - match:
          dependency-type: "dev"
          update-type: ["patch", "minor"]
        automerge-strategy: "auto"
    open-pull-requests-limit: 1
    pull-request-branch-name:
      separator: "/"
    reviewers:
      - "adriankondrat"
    assignees:
      - "adriankondrat"
```

### Success Criteria:

#### Automated Verification:

- `.github/dependabot.yml` exists and is valid YAML: `npm run lint` passes (if linting YAML files)
- Syntax can be verified via GitHub's UI once pushed (GitHub will report any config errors)
- File is in the correct location and readable

#### Manual Verification:

- Push the change and within 24 hours (or after GitHub processes it), a Dependabot PR appears
- The PR title follows Dependabot's convention (e.g., "chore(deps): bump ... weekly update")
- CI runs on the PR and passes (lint, build, test all green)
- PR body shows the grouped updates and links to each package's release notes
- Verify the weekly schedule is active in the GitHub "Code security and analysis" settings

**Implementation Note**: After pushing this change, Dependabot typically processes the config within 24 hours. The first PR may take a few days to appear depending on when the weekly check runs. Once the first PR is created, verify CI passes and the grouping/auto-merge logic is working as expected.

---

## Phase 2: Enable GitHub Dependabot Alerts (Optional)

### Overview

Enable GitHub Dependabot security alerts to receive notifications of known vulnerabilities in dependencies (independent of the update PRs).

### Changes Required:

#### 1. Enable Dependabot alerts in GitHub settings

**Intent**: This is a one-time repository setting (no code change). Enable "Dependabot alerts" in the repository's "Code security and analysis" settings so you receive notifications of known security issues in dependencies.

**How**: In the GitHub repository, go to Settings > Code security and analysis, and toggle on "Dependabot alerts" if not already enabled.

**Rationale**: Security advisories surface CVEs and known vulnerabilities before they become active exploits. With alerts enabled, you can proactively decide whether to update immediately (for high-severity issues) or wait for the weekly Dependabot PR.

### Success Criteria:

#### Automated Verification:

- None — this is a UI setting, not code.

#### Manual Verification:

- Navigate to Repository Settings > Code security and analysis
- Confirm "Dependabot alerts" toggle is ON
- Optionally: create a test alert by adding a known-vulnerable package to `package.json`, then revert (GitHub will show a test alert in the Security tab)

---

## Testing Strategy

### Integration Points:

- **Dependabot PR workflow**: First PR should arrive within 24–48 hours. Verify:
  - PR is created by `dependabot[bot]`
  - All updates are grouped into a single PR
  - Dev dependencies have `automerge: true` or similar label
  - Prod dependencies require manual review
  - CI passes (all checks green)

- **CI validation**: Confirm the existing CI workflow in `.github/workflows/ci.yml` runs on Dependabot PRs (GitHub automatically runs CI for all PRs to `main`).

### Manual Testing Steps:

1. Push `.github/dependabot.yml` to a branch and open a PR
2. Merge to `main` once CI passes
3. Wait 24–48 hours for the first Dependabot PR to appear
4. Verify the PR:
   - Title and body match Dependabot conventions
   - All grouped updates are listed
   - CI workflow runs and passes
   - Check that auto-merge rules are applied (dev dependencies should auto-merge if green)
5. Monitor the Dependabot security alerts page (Settings > Security > Dependabot alerts) for any active vulnerabilities

## Performance Considerations

None — Dependabot runs on GitHub's infrastructure and does not impact application performance. PR creation is asynchronous and non-blocking.

## References

- Roadmap S-13: `context/foundation/roadmap.md` (lines 267–278)
- GitHub Dependabot documentation: https://docs.github.com/en/code-security/dependabot
- Existing CI workflow: `.github/workflows/ci.yml` (already validates all PRs)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Create `.github/dependabot.yml`

#### Automated

- [x] 1.1 `.github/dependabot.yml` exists with valid YAML syntax

#### Manual

- [ ] 1.2 First Dependabot PR arrives within 24–48 hours
- [ ] 1.3 CI passes on the first PR (lint, build, test all green)
- [ ] 1.4 Verify grouping strategy: all updates in a single PR

### Phase 2: Enable GitHub Dependabot Alerts (Optional)

#### Manual

- [ ] 2.1 Dependabot alerts toggle is ON in Settings > Code security and analysis
