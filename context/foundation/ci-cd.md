# Continuous Integration and Deployment Pipeline

## Overview

The CI/CD pipeline automates testing and deployment for every code change pushed to the `main` branch. Built with GitHub Actions, the workflow runs on every push and pull request, ensuring that code meets quality standards (lint, build, tests) before it reaches production. On successful push to `main`, the pipeline automatically deploys the application to Cloudflare Workers, making changes immediately available to users.

The workflow file is located at `.github/workflows/ci.yml`.

## Trigger

The workflow is triggered by two events:

- **Push to `main`** — automatically runs all checks and deploys on successful completion
- **Pull request to `main`** — runs all checks but does NOT deploy (deployment is skipped on PRs as a safety measure)

## Workflow Steps

Each step is part of a single CI job running on `ubuntu-latest`. The steps execute in order:

### 1. Checkout code

- **Command**: `actions/checkout@v4`
- **Purpose**: Clone the repository code so subsequent steps can access and build it

### 2. Setup Node 22 with npm cache

- **Command**: `actions/setup-node@v4` with `node-version: 22` and `cache: npm`
- **Purpose**: Install Node.js 22 (matching `.nvmrc`) and configure npm to cache dependencies for faster subsequent runs

### 3. Install dependencies

- **Command**: `npm ci`
- **Purpose**: Install exact dependency versions from `package-lock.json` (clean install, more reliable than `npm install`)

### 4. Sync Astro environment

- **Command**: `npx astro sync`
- **Purpose**: Generate Astro's internal type definitions and configuration caches required for TypeScript checking

### 5. Lint code

- **Command**: `npm run lint`
- **Purpose**: Run ESLint with type-checked rules to catch code quality issues, style violations, and potential bugs before they reach production

### 6. Build application

- **Command**: `npm run build` (with `SUPABASE_URL` and `SUPABASE_KEY` env vars injected)
- **Purpose**: Compile the Astro SSR application into production-ready output. Supabase secrets are provided to the build so that server-side code can access auth configuration at build time. This build step does not deploy — it only verifies that the application compiles without errors.

### 7. Write test secrets to .dev.vars

- **Command**: `printf 'SUPABASE_URL=%s\nSUPABASE_KEY=%s\nOPENROUTER_API_KEY=test-dummy\n' "$SUPABASE_URL" "$SUPABASE_KEY" > dist/server/.dev.vars`
- **Purpose**: Create a `.dev.vars` file in the Astro build output directory (`dist/server/`) containing Supabase credentials for the test runner. Miniflare (used by Vitest to simulate Cloudflare Workers locally) reads this file to provide runtime environment variables to tests. The `OPENROUTER_API_KEY` is set to a dummy value in CI since tests do not make real AI API calls.

### 8. Run tests

- **Command**: `npm test` (with `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY` env vars injected)
- **Purpose**: Execute the full Vitest integration and unit test suite. Supabase credentials (including the service role key for privileged operations) are provided so tests can authenticate and interact with the Supabase database. Tests run inside a Cloudflare Workers simulation (miniflare) to catch edge-specific issues before production deploy.

### 9. Deploy to Cloudflare Workers

- **Command**: `npx wrangler deploy` (with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` env vars injected)
- **Condition**: **Runs only on push to `main`, not on pull requests** (controlled by `if: github.event_name == 'push'`)
- **Purpose**: Upload the compiled application to Cloudflare Workers. This is the only step that makes changes visible to users. By restricting deployment to push events (not PRs), the pipeline prevents accidental deployments from review branches and ensures only main-branch commits reach production.

## Required GitHub Secrets

The following GitHub repository secrets must be configured for the workflow to function. These are set in the GitHub repository settings (Settings > Secrets and variables > Actions).

| Secret Name                 | Purpose                                                           | Source                                                                                          |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project endpoint URL                                     | From `https://app.supabase.com/` > Project Settings > API                                       |
| `SUPABASE_KEY`              | Supabase anon public API key                                      | From `https://app.supabase.com/` > Project Settings > API                                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for privileged DB operations in tests) | From `https://app.supabase.com/` > Project Settings > API                                       |
| `CLOUDFLARE_API_TOKEN`      | API token for wrangler to authenticate with Cloudflare            | From Cloudflare dashboard > Account > API Tokens (create token with Workers deploy permissions) |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare account ID where the Workers application is deployed   | From Cloudflare dashboard > Account > Workers (visible on the Workers overview page)            |

All secrets are injected into the workflow as environment variables and are never logged or exposed in workflow output.

## Verification

To view a successful workflow run:

1. Go to the repository on GitHub
2. Click the **Actions** tab
3. Select a workflow run from the list
4. Each step will show a green checkmark (✓) if successful or a red ✗ if failed
5. Clicking a failed step reveals the error message and log output for debugging

**Evidence of a successful run:**

- All nine steps show green checkmarks
- The "Deploy to Cloudflare Workers" step is present and green (only visible on main branch pushes)
- The workflow completes in under 5 minutes typically

The workflow automatically reruns on new commits to `main`. Push failures block further deployment until fixed; PR failures are reported as status checks but do not block merging (the team decides whether to merge failed PRs).
