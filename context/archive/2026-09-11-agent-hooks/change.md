---
change_id: agent-hooks
title: Per-edit lint and scoped test hooks for agent file edits
status: archived
created: 2026-09-11
updated: 2026-09-11
archived_at: 2026-09-11T20:17:23Z
---

## Notes

Source: `context/foundation/roadmap.md` — S-09 "Agent hooks" (current sprint #1, Architect track).

- **Outcome:** after an agent writes or edits a source file, lint (and, for risk-area files, related tests) run automatically; a failing check returns to the agent instead of waiting for commit.
- **PRD refs:** test-plan §4 (per-edit gate recommended; currently only husky + lint-staged at commit).
- **Risk:** a slow per-edit hook blocks every save — keep the handler to ESLint on the touched file; scoped Vitest only on `src/lib/**` and `src/pages/api/**`. Full typecheck and full suite stay at commit/CI.
- **Implementation brief (roadmap):** Add `.cursor/hooks.json` with a `PostToolUse` matcher for `Write|Edit`. Shell handler: ESLint on `tool_input.file_path`; if the path is a risk area, `npx vitest related <file> --run`. Exit 2 on failure. Do not migrate husky to Lefthook.
- Prerequisites: none. Parallel with S-05, S-07, S-08, S-10, S-11, S-12, S-13.
