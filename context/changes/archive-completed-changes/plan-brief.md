# Archive Completed Changes — Plan Brief

> Full plan: `context/changes/archive-completed-changes/plan.md`

## What & Why

Move 13 finished folders out of `context/changes/` into `context/archive/`, using the existing `/10x-archive` skill for the 12 that follow the `change.md` lifecycle plus one manual move for a pre-lifecycle artifact. This closes roadmap slice S-11: "`context/changes/` holds only in-flight work."

## Starting Point

`context/changes/` has 15 folders. Only `account-deletion` (13/36 Progress items pending) is genuinely active. The other 14 are either fully implemented/reviewed or, in one case, a legacy pre-`change.md` bootstrap record. The roadmap's S-11 implementation brief lists 10 of these folders — written before `agent-hooks` and `product-landing-page` finished today, so it's missing two folders that are also done.

## Desired End State

`context/changes/` contains exactly `account-deletion` and this change (`archive-completed-changes`). The 13 finished folders live under `context/archive/<date>-<name>/`. `roadmap.md`'s S-10 (`architecture-evidence`) row flips from `ready` to `done`; every other roadmap slice that was already marked `done` stays that way with no duplicate entries.

## Key Decisions Made

| Decision                                                 | Choice                                                | Why (1 sentence)                                                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Include `agent-hooks` / `product-landing-page`?          | Yes                                                   | Both finished today after the brief was written; the brief's intent (archive what's done) covers them even though its literal list doesn't. |
| Archive `architecture-evidence` now?                     | Yes                                                   | Automated checks all pass; 4 unchecked manual boxes fit `/10x-archive`'s documented manual-only warn-and-continue path.                     |
| How to handle `bootstrap-verification` (no `change.md`)? | Manual `git mv`, no stamping                          | It predates the change lifecycle entirely; `/10x-archive` can't process a folder with no `change.md` to read.                               |
| `share-link-integrity`'s uncommitted `plan-brief.md`?    | Commit it first, then archive                         | It's finished content just never committed — folding it in keeps the archive clean instead of leaving the folder out this round.            |
| Missing-impl-review warnings (5 folders)?                | Continue archiving each time                          | No impl-review was ever produced for these; re-litigating per-prompt adds nothing.                                                          |
| Mechanism                                                | Drive `/10x-archive` per change-id via the Skill tool | The skill already handles stamping, `git mv`, roadmap sync, and committing — no reason to hand-roll it.                                     |

## Scope

**In scope:** archiving 13 folders (12 via `/10x-archive`, 1 manual); the roadmap sync side effects `/10x-archive` performs automatically.

**Out of scope:** `account-deletion` (still active); backfilling missing `impl-review.md` files; completing `architecture-evidence`'s manual checks; changing `/10x-archive`'s `SKILL.md` to handle table-shaped `## Done` sections (worked around procedurally instead).

## Architecture / Approach

Sequential `/10x-archive` invocations, one change-id at a time — each must fully commit before the next starts, since the skill's own pre-flight check inspects staged state left over from the prior call. Folders are grouped by roadmap-interaction risk: no-match folders first (zero roadmap side effects), then already-`done` folders (idempotent Status flips, but the `## Done` table-vs-bullet-list shape mismatch needs watching), then the one manual move, then a final verification pass.

## Phases at a Glance

| Phase                                | What it delivers                         | Key risk                                                                                                |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1. Prep                              | Loose `plan-brief.md` committed          | None — trivial commit                                                                                   |
| 2. Archive (no roadmap match)        | 4 folders archived                       | Low — no roadmap side effects                                                                           |
| 3. Archive (already done in roadmap) | 7 folders archived, S-10 flipped to done | `## Done` section is a table, not the bullet list `/10x-archive` expects — watch for a malformed append |
| 4. Manual archive                    | `bootstrap-verification` moved           | Low — simple `git mv`, no skill involved                                                                |
| 5. Verify                            | Confirm final state                      | Low — read-only checks                                                                                  |

**Prerequisites:** none — all target folders are already committed clean except `share-link-integrity` (handled in Phase 1).
**Estimated effort:** ~1 session, mostly mechanical skill invocations.

## Open Risks & Assumptions

- Assumes `/10x-archive`'s roadmap-close step correctly skips the bullet-append sub-edit when it hits the table-shaped `## Done` section, per the skill's own documented fallback rule. If it doesn't, the plan calls for stopping and fixing `roadmap.md` by hand before committing.
- Assumes no other session is concurrently editing `context/changes/` or `roadmap.md` during this run (a concurrent session already changed `architecture-evidence`'s state mid-conversation once).

## Success Criteria (Summary)

- `context/changes/` contains only `account-deletion` and `archive-completed-changes`.
- All 13 folders exist under `context/archive/` with correct date-prefixed names.
- `roadmap.md` is internally consistent: S-10 shows `done`, no duplicate or malformed `## Done` entries.
