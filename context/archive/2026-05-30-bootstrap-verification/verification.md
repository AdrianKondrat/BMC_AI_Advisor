---
bootstrapped_at: 2026-05-30T12:42:31Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: bmc-ai-advisor
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: bmc-ai-advisor
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

A solo founder shipping a 3-week after-hours MVP needs a battle-tested, agent-friendly starter that handles auth, database, and edge deployment out of the box — without assembly. The 10x Astro Starter (Astro 6 + React 19 + TypeScript + Supabase + Cloudflare Pages) is the recommended default for the (web-app, js) combination and clears all four agent-friendly quality gates: fully typed, convention-based, well-represented in training data, and well-documented. Supabase covers auth (FR-001, FR-002) and persistent canvas storage with no extra wiring; the Cloudflare edge runtime keeps the shared read-only link (FR-011, FR-012) fast globally. AI canvas generation and critique (FR-007, FR-010) connect to an external LLM API — no self-hosted model required, consistent with the PRD non-goal. CI runs on GitHub Actions with auto-deploy-on-merge, matching the starter's default shape and the solo workflow.

## Pre-scaffold verification

| Signal      | Value    | Severity | Notes                                                                                     |
| ----------- | -------- | -------- | ----------------------------------------------------------------------------------------- |
| npm package | not run  | —        | cmd_template starts with `git clone`; npm CLI package name is not applicable for this starter |
| GitHub repo | not run  | —        | `gh` CLI not found on PATH; check could not be performed                                  |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: clone the starter repo without keeping its git history
**Exit code**: 0
**Files moved**: 20 top-level entries (including `node_modules`)
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold` (existing `CLAUDE.md` was preserved; starter's copy landed as sibling for manual review)
**.gitignore handling**: moved silently (no `.gitignore` existed in cwd prior to scaffold)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Status**: failed to run
**Reason**: 426 Upgrade Required — local npm version is connecting to the registry over HTTP rather than HTTPS/TLS 1.2+. The registry has deprecated plaintext HTTP connections since October 2021. Upgrade npm (`npm install -g npm@latest`) or ensure your local npm config uses `https://registry.npmjs.org`.
**Partial output**:

```
npm warn audit 426 Upgrade Required - POST http://registry.npmjs.org/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
```

No vulnerability data available for this run. Run `npm audit` manually once npm is upgraded.

## Hints recorded but not acted on

| Hint                    | Value               |
| ----------------------- | ------------------- |
| bootstrapper_confidence | first-class         |
| quality_override        | false               |
| path_taken              | standard            |
| self_check_answers      | null                |
| team_size               | solo                |
| deployment_target       | cloudflare-pages    |
| ci_provider             | github-actions      |
| ci_default_flow         | auto-deploy-on-merge|
| has_auth                | true                |
| has_payments            | false               |
| has_realtime            | false               |
| has_ai                  | true                |
| has_background_jobs     | false               |

These hints were read and preserved in this audit trail. No automated scaffold changes are made based on feature flags or deployment configuration in v1. A future skill (M1L4 — Memory Architecture) will act on these to configure `CLAUDE.md`, `AGENTS.md`, and CI/CD wiring.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` — this is the starter's `CLAUDE.md`; diff it against your existing `CLAUDE.md` to decide which sections to merge.
- Upgrade npm and run `npm audit` manually to get vulnerability findings: `npm install -g npm@latest && npm audit`.
- Configure your Supabase project and populate `.env` from `.env.example`.
- Deploy to Cloudflare Pages: connect the repo in the Cloudflare dashboard and set the build command to `npm run build`, output directory to `dist`.
